import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, morphoFit, morphoVigilance, representativeWeatherFor, type SelectionStrategy } from "../src/lib/capsule";
import { formalityOf } from "../src/lib/attributes";
import { computeLookScore, generateOutfit } from "../src/lib/logic";
import { conseilAffichable, effetMorphologique, niveauConfiance, scoreMorphoV2 } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item } from "../src/lib/types";
import { EMPTY_PROFILE, type Profile } from "../src/lib/profile";
import { OCCASIONS, type Weather } from "../src/lib/data";

// PHASE 11 — LECTURE SEULE.
//
// Trois objets :
//   1. dire d'où vient réellement le signal legacy (donnée déclarée ou repli
//      par expression régulière) — je l'ai qualifié de « regex » en phase 10
//      sans le vérifier, et morphoFit lit d'abord it.morphologyTags ;
//   2. refaire la mesure avec des RÉPÉTITIONS indépendantes, pour disposer
//      d'un écart-type et d'un intervalle de confiance au lieu d'une valeur
//      ponctuelle dont la phase 10 a montré qu'elle portait jusqu'à 4,8
//      points de bruit ;
//   3. instrumenter la seule cellule qui régresse — triangle inversé × été —
//      pour savoir QUELLE pièce et QUELLE règle du score en sont la cause.
//
// L'oracle des phases précédentes n'apparaît plus : c'est une stratégie
// gloutonne optimisée par régénération, battue sur certaines cellules, donc
// un point de comparaison expérimental et rien d'autre.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const STYLES = ["Casual chic", "Classique", "Glamour", "Bohème", "Streetwear", "Minimaliste"];
const MORPHOS = ["f_poire", "f_triangle_inverse"];
const REPETITIONS = 5;
const TIRAGES = 40;

const profil = (styles: string[], morphology: string | null): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles, morphology });
const pctf = (x: number) => (x * 100).toFixed(1);
const isSport = (it: Item) => formalityOf(it) === 0;
const CLOTHING: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];

const VARIANTES: [string, SelectionStrategy, boolean][] = [
  ["B1 legacy", { rang3: "legacy", v2: false }, true],
  ["B2 sans legacy", { rang3: "neutre", v2: false }, true],
  ["V2 (sat. A)", { rang3: "neutre", v2: "A" }, true],
  ["B4 sans morpho", { rang3: "legacy", v2: false }, false],
];

/** Une répétition = un jeu de tirages indépendant, d'où l'écart-type. */
type Rep = {
  looks: number; scoreMoy: number; p10: number; p90: number;
  compensation: number; defavorable: number; neutre: number; conseil: number;
  rs9Bonus: number; rs9Penalite: number;
};

function mesurerUneFois(capsule: CatalogItem[], w: Weather, morphology: string): Rep {
  const sig = new Set<string>();
  const scores: number[] = [];
  let actifs = 0, comp = 0, defav = 0, neutre = 0, conseil = 0, evalues = 0, bonus = 0, penalite = 0;
  for (const [o] of OCCASIONS) {
    for (let k = 0; k < TIRAGES; k++) {
      const { ids } = generateOutfit(capsule, w, o, "Présentiel", "Verre", [], "femme");
      if (!ids.length) continue;
      const pieces = capsule.filter((it) => ids.includes(it.id));
      sig.add([...ids].sort((a, b) => a - b).join("-"));
      scores.push(computeLookScore(pieces, o, [], morphology, new Set<string>(), w).score);
      // R-S9 recalculé à l'identique de logic.ts, sans toucher au score :
      // c'est le seul terme morphologique du 0–120 aujourd'hui.
      const vetements = pieces.filter((i) => CLOTHING.includes(i.cat));
      if (vetements.some((i) => morphoFit(i, morphology))) bonus += 1;
      else if (vetements.some((i) => morphoVigilance(i, morphology))) penalite += 1;
      if (pieces.every(isSport)) continue;
      evalues += 1;
      const s = scoreMorphoV2(pieces, morphology);
      if (s.actif) {
        actifs += 1;
        if (s.delta > 0) comp += 1; else if (s.delta === 0) neutre += 1; else defav += 1;
      }
      if (niveauConfiance(pieces) !== "LOW" && niveauConfiance(pieces) !== "UNKNOWN" && conseilAffichable(pieces, morphology)) conseil += 1;
    }
  }
  const tri = [...scores].sort((a, b) => a - b);
  return {
    looks: sig.size,
    scoreMoy: scores.reduce((a, b) => a + b, 0) / (scores.length || 1),
    p10: tri[Math.floor(0.1 * tri.length)] ?? 0,
    p90: tri[Math.floor(0.9 * tri.length)] ?? 0,
    compensation: actifs ? comp / actifs : 0,
    defavorable: actifs ? defav / actifs : 0,
    neutre: actifs ? neutre / actifs : 0,
    conseil: evalues ? conseil / evalues : 0,
    rs9Bonus: scores.length ? bonus / scores.length : 0,
    rs9Penalite: scores.length ? penalite / scores.length : 0,
  };
}

/** Moyenne et demi-intervalle de confiance à 95 % sur les répétitions. */
function ic(valeurs: number[]): [number, number] {
  const n = valeurs.length;
  const moy = valeurs.reduce((a, b) => a + b, 0) / n;
  const variance = valeurs.reduce((a, b) => a + (b - moy) ** 2, 0) / (n - 1 || 1);
  return [moy, 1.96 * Math.sqrt(variance / n)];
}
const fmt = (m: number, d: number, mult = 100) => `${(m * mult).toFixed(1)}±${(d * mult).toFixed(1)}`;

describe("Phase 11 — origine du legacy, plancher de bruit, diagnostic été", () => {
  it("mesure avec répétitions et instrumente la cellule qui régresse", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    // ═══ 1. D'OÙ VIENT LE SIGNAL LEGACY ? ═══
    console.log(`\n════════ 1 · ORIGINE DU SIGNAL LEGACY ════════`);
    const avecTags = pool.filter((it) => it.morphologyTags && it.morphologyTags.length);
    console.log(`  Catalogue exploitable                        : ${pool.length}`);
    console.log(`  Pièces avec une colonne « morphologies »     : ${avecTags.length} (${pctf(avecTags.length / pool.length)} %)`);
    console.log(`  Pièces retombant sur l'expression régulière  : ${pool.length - avecTags.length} (${pctf(1 - avecTags.length / pool.length)} %)`);
    console.log(`\n  ${"morphologie".padEnd(20)}${"morphoFit vrai".padStart(15)}${"dont par donnée".padStart(17)}${"dont par regex".padStart(16)}`);
    for (const m of ["f_poire", "f_triangle_inverse", "f_rectangle", "f_sablier", "f_pomme"]) {
      const vrais = pool.filter((it) => morphoFit(it, m));
      const parDonnee = vrais.filter((it) => it.morphologyTags && it.morphologyTags.length).length;
      console.log(`  ${m.padEnd(20)}${String(vrais.length).padStart(15)}${String(parDonnee).padStart(17)}${String(vrais.length - parDonnee).padStart(16)}`);
    }

    // ═══ 2-3. MESURE AVEC RÉPÉTITIONS ═══
    console.log(`\n════════ 2 · MESURE RÉPÉTÉE (${REPETITIONS} répétitions × ${TIRAGES} tirages × ${OCCASIONS.length} occasions × ${STYLES.length} styles) ════════`);
    console.log(`  Les valeurs sont « moyenne ± demi-intervalle de confiance à 95 % » sur les répétitions.`);

    for (const morphology of MORPHOS) {
      console.log(`\n\n════════════════ ${morphology} ════════════════`);
      for (const saison of [...SAISONS, "TOUTES" as const]) {
        const cellules = new Map<string, Rep[]>(VARIANTES.map(([n]) => [n, []]));
        const saisonsCiblees = saison === "TOUTES" ? SAISONS : [saison];
        for (const [nom, strategy, avecMorpho] of VARIANTES) {
          for (let r = 0; r < REPETITIONS; r++) {
            const cumul: Rep[] = [];
            for (const s of saisonsCiblees) {
              const w = representativeWeatherFor(s);
              for (const style of STYLES) {
                const capsule = computeDefaultCapsule(profil([style], avecMorpho ? morphology : null), w, [], s, pool, strategy);
                cumul.push(mesurerUneFois(capsule, w, morphology));
              }
            }
            // Une répétition = l'agrégat sur les styles (et saisons) de la cellule.
            const moy = (f: (x: Rep) => number) => cumul.reduce((a, b) => a + f(b), 0) / cumul.length;
            cellules.get(nom)!.push({
              looks: cumul.reduce((a, b) => a + b.looks, 0),
              scoreMoy: moy((x) => x.scoreMoy), p10: moy((x) => x.p10), p90: moy((x) => x.p90),
              compensation: moy((x) => x.compensation), defavorable: moy((x) => x.defavorable),
              neutre: moy((x) => x.neutre), conseil: moy((x) => x.conseil),
              rs9Bonus: moy((x) => x.rs9Bonus), rs9Penalite: moy((x) => x.rs9Penalite),
            });
          }
        }
        console.log(`\n──── ${String(saison).toUpperCase()} ────`);
        console.log(`  ${"variante".padEnd(17)}${"looks".padStart(12)}${"score".padStart(13)}${"compens.".padStart(13)}${"défav.".padStart(13)}${"conseil".padStart(12)}${"R-S9 +10".padStart(12)}${"R-S9 -5".padStart(11)}`);
        for (const [nom] of VARIANTES) {
          const reps = cellules.get(nom)!;
          const [lm, ld] = ic(reps.map((x) => x.looks));
          const [sm, sd] = ic(reps.map((x) => x.scoreMoy));
          const [cm, cd] = ic(reps.map((x) => x.compensation));
          const [dm, dd] = ic(reps.map((x) => x.defavorable));
          const [nm, nd] = ic(reps.map((x) => x.conseil));
          const [bm, bd] = ic(reps.map((x) => x.rs9Bonus));
          const [pm, pd] = ic(reps.map((x) => x.rs9Penalite));
          console.log(`  ${nom.padEnd(17)}${fmt(lm, ld, 1).padStart(12)}${fmt(sm, sd, 1).padStart(13)}${fmt(cm, cd).padStart(13)}${fmt(dm, dd).padStart(13)}${fmt(nm, nd).padStart(12)}${fmt(bm, bd).padStart(12)}${fmt(pm, pd).padStart(11)}`);
        }
      }
    }

    // ═══ 4. DIAGNOSTIC TRIANGLE INVERSÉ × ÉTÉ ═══
    console.log(`\n\n════════ 4 · DIAGNOSTIC — TRIANGLE INVERSÉ × ÉTÉ ════════`);
    const w = representativeWeatherFor("Été");
    for (const style of STYLES) {
      const b2 = computeDefaultCapsule(profil([style], "f_triangle_inverse"), w, [], "Été", pool, { rang3: "neutre", v2: false });
      const v2 = computeDefaultCapsule(profil([style], "f_triangle_inverse"), w, [], "Été", pool, { rang3: "neutre", v2: "A" });
      const idsB2 = new Set(b2.map((it) => it.id));
      const idsV2 = new Set(v2.map((it) => it.id));
      const entrantes = v2.filter((it) => !idsB2.has(it.id));
      const sortantes = b2.filter((it) => !idsV2.has(it.id));
      if (!entrantes.length) continue;
      console.log(`\n  ── ${style} ──`);
      const decrire = (it: CatalogItem, sens: string) => {
        const e = effetMorphologique(it);
        console.log(`     ${sens} ${String(it.id).padStart(6)} ${it.name.padEnd(40).slice(0, 40)} [${it.cat}] form.${formalityOf(it)} ${it.color?.padEnd(14).slice(0, 14) ?? ""} ` +
          `ép${e.epaules} ta${e.taille} ha${e.hanches} ${e.confiance} · R-S9 ${morphoFit(it, "f_triangle_inverse") ? "+10" : morphoVigilance(it, "f_triangle_inverse") ? "-5" : "—"}`);
      };
      sortantes.forEach((it) => decrire(it, "sort "));
      entrantes.forEach((it) => decrire(it, "entre"));
    }

    console.log(`\nAudit en lecture seule — aucune règle de production modifiée.`);
  }, 3_600_000);
});
