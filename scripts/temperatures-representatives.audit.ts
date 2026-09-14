import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import {
  CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor,
  STRATEGIE_PRODUCTION, type SelectionStrategy,
} from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LES QUATRE TEMPÉRATURES REPRÉSENTATIVES — MESURE DES TROIS LEVIERS OUVERTS.
// LECTURE SEULE.
//
// CE QUI CONDUIT ICI. `erreurs-bornes` (14/09) a réduit les 144 couples de
// `coherence-bornes` à 15 exclusions DÉMONTRÉES par contrefactuel. Deux
// constats en sortent, et aucun ne se règle par du SQL :
//
//   · 5 des 15 disparaîtraient sans toucher aux données, par les deux réglages
//     déjà mesurés et non appliqués — Printemps 16→14 et Hiver 6→4. Écrire du
//     SQL avant de les trancher corrigerait des données pour compenser un
//     réglage qu'on s'apprête peut-être à changer (point 8).
//   · 7 des 10 restants sont l'AUTOMNE, et ce sont toutes des pièces chaudes
//     bornées entre 10 et 13° contre une représentative de 14° : manteaux de
//     laine, pulls épais, robe pull, écharpe. Un vestiaire d'automne dont
//     chaque manteau est exclu de l'automne ressemble moins à dix erreurs de
//     saisie indépendantes qu'à un réglage. `Automne 14°` n'a JAMAIS été
//     mesuré, contrairement à Printemps et Hiver.
//
// CE QUE MESURE CE SCRIPT. Les trois leviers, la baseline, et chaque candidat
// dans la MÊME exécution sur le MÊME pool. Été reste fixe à 24° : aucun couple
// démontré ne le met en cause, et il n'a pas à bouger sans justification.
//
// INTERACTIONS (point 2). La composition d'une capsule ne dépend QUE de la
// température de sa propre saison — `computeDefaultCapsule` est appelée saison
// par saison et rien n'y croise les autres. Les trois leviers sont donc
// structurellement indépendants sur la composition, et mesurer les
// combinaisons n'y apprendrait rien de plus que les leviers seuls. Ce n'est
// PAS vrai du décompte des pièces mortes : une pièce qui déclare Automne ET
// Hiver n'est morte que si elle est exclue des deux. La section 4 évalue donc
// la grille COMPLÈTE des combinaisons sur ce seul critère, à partir des
// mesures par saison — pas d'extrapolation, les mêmes exclusions recomposées.
//
// LES DEUX CONTRE-MESURES, sans lesquelles ce script ne serait qu'un moyen de
// tout élargir. Baisser une température fait entrer les pièces chaudes, mais
// elle en SORT les pièces bornées bas en min. Chaque candidat est donc jugé
// sur un NET — exclusions résolues moins exclusions créées — et sur les tenues
// hors plage produites à cette même température.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié. La
// couture `SelectionStrategy.tempRepresentative` est facultative : omise, elle
// reproduit exactement la production.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;

/** Copie de logic.ts:684 — les catégories dont la génération ignore le `min`. */
const EXEMPTEES: CategoryKey[] = ["haut", "pull", "robe", "combinaison", "jupe", "short"];
/** Copie de tenues-hors-plage — ce qui compense une pièce portée sous son min. */
const COUCHES: CategoryKey[] = ["pull", "veste", "manteau"];

/** Les candidats mesurés. Le premier de chaque liste est la production. */
const CANDIDATS: Record<CapsuleSeason, number[]> = {
  Printemps: [16, 15, 14],
  Été: [24],
  Automne: [14, 13, 12, 11],
  Hiver: [6, 5, 4],
};

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

function saisonsDeclarees(raw: string | null): CapsuleSeason[] {
  const jetons = (raw ?? "").split(/[,;|]/).map((s) => sansAccents(s)).filter(Boolean);
  return CAPSULE_SEASONS.filter((s) => jetons.includes(sansAccents(s)));
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function grainePour(cle: string): number {
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

describe("températures représentatives — les trois leviers ouverts", () => {
  it("mesure baseline et candidats dans la même exécution, avec leurs contre-mesures", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const ligne = new Map<number, VestiaireRow>(brutes.map((r) => [VESTIAIRE_ID_OFFSET + r.id, r]));
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    const declarees = new Map(pool.map((it) => [it.id, saisonsDeclarees(ligne.get(it.id)?.saison_capsule ?? null)]));
    console.log(`Catalogue : ${pool.length} pièces.`);
    console.log(`CONFIGURATION GELÉE : profils d'audit, ${STYLES_FEMME.length} styles femme, ${OCCS.length} occasions, ${N} tirages, graines déterministes.`);
    console.log(`Levier unique : la température représentative. Été reste à 24° dans tous les bras.`);
    console.log(`Candidats — ${CAPSULE_SEASONS.map((s) => `${s} ${CANDIDATS[s].join("/")}`).join("  ·  ")}`);

    const strategiePour = (saison: CapsuleSeason, t: number): SelectionStrategy =>
      ({ ...STRATEGIE_PRODUCTION, tempRepresentative: { [saison]: t } });

    const capsuleIds = (src: CatalogItem[], style: string, saison: CapsuleSeason, t: number): Set<number> =>
      new Set(computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }),
        representativeWeatherFor(saison, t), [], saison, src, strategiePour(saison, t)).map((x) => x.id));

    // ═══ 1 · EXCLUSIONS DÉMONTRÉES, SAISON PAR SAISON ════════════════════
    console.log(`\n════════ 1 · EXCLUSIONS DÉMONTRÉES PAR LA BORNE, À CHAQUE TEMPÉRATURE ════════`);
    console.log(`  Une exclusion est DÉMONTRÉE quand la pièce déclare la saison, n'entre dans`);
    console.log(`  aucune des ${STYLES_FEMME.length} capsules, et y entre dès que ses SEULES bornes sont neutralisées.`);
    console.log(`  « sans recours » exclut les artefacts du min sur [${EXEMPTEES.join(", ")}],`);
    console.log(`  que la génération exempte déjà et qu'aucune température ne concerne.`);

    /** exclusions[saison][t] = ids des pièces dont la borne les exclut, démontré. */
    const exclusions = new Map<string, Set<number>>();
    console.log(`\n  ${"saison".padEnd(11)}${"t".padStart(4)}${"capsules".padStart(10)}${"contredits".padStart(12)}${"sans recours".padStart(14)}${"DÉMONTRÉES".padStart(12)}${"vs prod".padStart(9)}`);
    for (const saison of CAPSULE_SEASONS) {
      let refDemo = 0;
      for (const t of CANDIDATS[saison]) {
        const reference = new Map(STYLES_FEMME.map((st) => [st, capsuleIds(pool, st, saison, t)]));
        const taille = [...reference.values()].reduce((a, s) => a + s.size, 0);
        let contredits = 0;
        const sansRecours: CatalogItem[] = [];
        for (const it of pool) {
          if (!(declarees.get(it.id) ?? []).includes(saison)) continue;
          const r = ligne.get(it.id);
          if (!r) continue;
          const horsMax = r.meteo_max_temp != null && t > r.meteo_max_temp;
          const horsMin = !horsMax && r.meteo_min_temp != null && t < r.meteo_min_temp;
          if (!horsMax && !horsMin) continue;
          contredits += 1;
          if (horsMax || !EXEMPTEES.includes(it.cat)) sansRecours.push(it);
        }
        const demo = new Set<number>();
        for (const it of sansRecours) {
          if (STYLES_FEMME.some((st) => reference.get(st)!.has(it.id))) continue;
          const contrefactuel = pool.map((x) =>
            x.id === it.id ? { ...x, meteoMinTemp: undefined, meteoMaxTemp: undefined } : x);
          if (STYLES_FEMME.some((st) => capsuleIds(contrefactuel, st, saison, t).has(it.id))) demo.add(it.id);
        }
        exclusions.set(`${saison}|${t}`, demo);
        if (t === CANDIDATS[saison][0]) refDemo = demo.size;
        const ecart = t === CANDIDATS[saison][0] ? "—" : `${demo.size - refDemo > 0 ? "+" : ""}${demo.size - refDemo}`;
        console.log(`  ${(t === CANDIDATS[saison][0] ? saison : "").padEnd(11)}${String(t).padStart(3)}°${String(taille).padStart(10)}${String(contredits).padStart(12)}${String(sansRecours.length).padStart(14)}${String(demo.size).padStart(12)}${ecart.padStart(9)}`);
      }
    }

    // ═══ 2 · QUI ENTRE, QUI SORT ═════════════════════════════════════════
    console.log(`\n════════ 2 · CE QUE CHAQUE CANDIDAT RÉSOUT ET CE QU'IL CRÉE ════════`);
    console.log(`  Par rapport à la température de production de la même saison. Un candidat qui`);
    console.log(`  créerait plus d'exclusions qu'il n'en résout se disqualifie de lui-même.`);
    for (const saison of CAPSULE_SEASONS) {
      const [prod, ...autres] = CANDIDATS[saison];
      if (!autres.length) continue;
      const base = exclusions.get(`${saison}|${prod}`)!;
      for (const t of autres) {
        const cand = exclusions.get(`${saison}|${t}`)!;
        const resolues = [...base].filter((id) => !cand.has(id));
        const creees = [...cand].filter((id) => !base.has(id));
        console.log(`\n  ${saison} ${prod}° → ${t}°  :  ${resolues.length} résolue(s), ${creees.length} créée(s), net ${creees.length - resolues.length > 0 ? "+" : ""}${creees.length - resolues.length}`);
        for (const id of resolues) console.log(`     résolue  réf ${String(ligne.get(id)!.id).padStart(5)}  ${(index.get(id)!.cat as string).padEnd(11)}min ${String(ligne.get(id)!.meteo_min_temp ?? "—").padStart(4)}  max ${String(ligne.get(id)!.meteo_max_temp ?? "—").padStart(4)}  ${index.get(id)!.name}`);
        for (const id of creees) console.log(`     CRÉÉE    réf ${String(ligne.get(id)!.id).padStart(5)}  ${(index.get(id)!.cat as string).padEnd(11)}min ${String(ligne.get(id)!.meteo_min_temp ?? "—").padStart(4)}  max ${String(ligne.get(id)!.meteo_max_temp ?? "—").padStart(4)}  ${index.get(id)!.name}`);
      }
    }

    // ═══ 3 · TENUES HORS PLAGE À CHAQUE TEMPÉRATURE ══════════════════════
    console.log(`\n════════ 3 · CONTRE-MESURE — TENUES HORS PLAGE À CHAQUE TEMPÉRATURE ════════`);
    console.log(`  Mêmes graines, mêmes occasions ; seule la température varie. « nue sous son min »`);
    console.log(`  exclut ce que le moteur a compensé (couche, ou collants sur jupe/robe — R-B19).`);
    console.log(`\n  ${"saison".padEnd(11)}${"t".padStart(4)}${"tenues".padStart(9)}${"cellules".padStart(10)}${"hors max".padStart(10)}${"nue < min".padStart(11)}`);
    for (const saison of CAPSULE_SEASONS) {
      for (const t of CANDIDATS[saison]) {
        const w = representativeWeatherFor(saison, t);
        let tenues = 0, cellules = 0, horsMax = 0, nue = 0;
        for (const style of STYLES_FEMME) {
          const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }),
            w, [], saison, pool, strategiePour(saison, t));
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${style}|${occ}|${k}`));
              let ids: number[];
              try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids; }
              finally { Math.random = vrai; }
              if (!ids.length) continue;
              couverte = true; tenues += 1;
              const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
              const aUneCouche = pieces.some((p) => COUCHES.includes(p.cat));
              const aDesCollants = pieces.some((p) => p.cat === "accessoire" && p.accessoireType === "Collants");
              const compensee = (p: CatalogItem) =>
                aUneCouche || ((p.cat === "jupe" || p.cat === "robe") && aDesCollants);
              for (const p of pieces) {
                if (p.meteoMaxTemp != null && t > p.meteoMaxTemp) horsMax += 1;
                else if (p.meteoMinTemp != null && t < p.meteoMinTemp && !compensee(p)) nue += 1;
              }
            }
            if (couverte) cellules += 1;
          }
        }
        console.log(`  ${(t === CANDIDATS[saison][0] ? saison : "").padEnd(11)}${String(t).padStart(3)}°${String(tenues).padStart(9)}${`${cellules}/${STYLES_FEMME.length * OCCS.length}`.padStart(10)}${String(horsMax).padStart(10)}${String(nue).padStart(11)}`);
      }
    }

    // ═══ 4 · PIÈCES MORTES — LA GRILLE COMPLÈTE ══════════════════════════
    console.log(`\n════════ 4 · PIÈCES MORTES — GRILLE COMPLÈTE DES COMBINAISONS ════════`);
    console.log(`  Une pièce est MORTE quand la borne l'exclut de TOUTES les saisons qu'elle`);
    console.log(`  déclare. Seul critère où les leviers interagissent : la composition d'une`);
    console.log(`  capsule ne dépend que de sa propre saison, ce décompte dépend des quatre.`);
    console.log(`  Recomposé à partir des mesures de la section 1 — aucune extrapolation.`);
    const morts = (combo: Record<CapsuleSeason, number>): number[] => {
      const out: number[] = [];
      for (const it of pool) {
        const d = declarees.get(it.id) ?? [];
        if (!d.length) continue;
        if (d.every((s) => exclusions.get(`${s}|${combo[s]}`)!.has(it.id))) out.push(it.id);
      }
      return out;
    };
    console.log(`\n  ${"Printemps".padStart(10)}${"Automne".padStart(9)}${"Hiver".padStart(7)}${"mortes".padStart(9)}`);
    let meilleur: { combo: Record<CapsuleSeason, number>; n: number } | null = null;
    for (const p of CANDIDATS.Printemps) for (const a of CANDIDATS.Automne) for (const h of CANDIDATS.Hiver) {
      const combo = { Printemps: p, Été: 24, Automne: a, Hiver: h } as Record<CapsuleSeason, number>;
      const m = morts(combo);
      const prod = p === CANDIDATS.Printemps[0] && a === CANDIDATS.Automne[0] && h === CANDIDATS.Hiver[0];
      console.log(`  ${String(p).padStart(9)}°${String(a).padStart(8)}°${String(h).padStart(6)}°${String(m.length).padStart(9)}${prod ? "   ← production" : ""}`);
      if (!meilleur || m.length < meilleur.n) meilleur = { combo, n: m.length };
    }
    const prodCombo = { Printemps: CANDIDATS.Printemps[0], Été: 24, Automne: CANDIDATS.Automne[0], Hiver: CANDIDATS.Hiver[0] } as Record<CapsuleSeason, number>;
    console.log(`\n  Mortes en production (${CANDIDATS.Printemps[0]}/24/${CANDIDATS.Automne[0]}/${CANDIDATS.Hiver[0]}) :`);
    for (const id of morts(prodCombo))
      console.log(`     réf ${String(ligne.get(id)!.id).padStart(5)}  ${(declarees.get(id) ?? []).join("+").padEnd(28)}min ${String(ligne.get(id)!.meteo_min_temp ?? "—").padStart(4)}  max ${String(ligne.get(id)!.meteo_max_temp ?? "—").padStart(4)}  ${index.get(id)!.name}`);
    if (meilleur) {
      const c = meilleur.combo;
      console.log(`\n  Minimum de la grille : Printemps ${c.Printemps}° · Automne ${c.Automne}° · Hiver ${c.Hiver}° → ${meilleur.n} morte(s).`);
      console.log(`  Ce minimum n'est PAS une recommandation : il ne regarde qu'un critère, et`);
      console.log(`  la section 3 dit ce que chaque baisse coûte en tenues hors plage.`);
    }

    console.log(`\n  LECTURE SEULE. Aucune température changée, aucune donnée touchée.`);
  }, 900_000);
});
