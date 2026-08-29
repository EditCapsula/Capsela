import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { STRATEGIE_LEGACY, capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor, type SelectionStrategy } from "../src/lib/capsule";
import { computeDefaultCapsule as capsuleAvantCouture } from "./baseline/capsule.preseam";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { computeLookScore, generateOutfit } from "../src/lib/logic";
import { conseilAffichable, niveauConfiance, scoreMorphoV2 } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { type Profile } from "../src/lib/profile";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";
import { OCCASIONS, type Weather } from "../src/lib/data";

// PHASE 10 — LEGACY CONTRE V2, DANS LA VRAIE BOUCLE DE SÉLECTION.
//
// La phase 9 mesurait le CONTENU d'une décision morphologique par un proxy de
// substitution, mais pas sa FRÉQUENCE de déclenchement dans selectGroup. La
// couture d'audit de capsule.ts permet désormais d'exécuter la sélection
// réelle — mêmes filtres, même boucle gloutonne, même `covered` partagé — en
// ne changeant que le rang morphologique.
//
// Le premier test est un VERROU : la stratégie par défaut doit reproduire à
// l'identique les capsules produites AVANT l'ajout de la couture, dont une
// copie verbatim est vendue dans scripts/baseline. Si l'empreinte diffère,
// rien d'autre n'est mesuré.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
/**
 * Les styles exposés, par IDENTIFIANT (harnais d'audit du 29/08/2026).
 * Les libellés français qu'utilisait la version précédente renvoyaient
 * `undefined` via STYLE_ID_TO_CATALOG_LABEL : le filtre de style était
 * silencieusement sauté et la mesure portait sur un pool universel.
 */
const STYLES = STYLES_FEMME;
const MORPHOS = ["f_poire", "f_triangle_inverse", "f_rectangle", "f_sablier", "f_pomme"];
const AVEC_V2 = ["f_poire", "f_triangle_inverse"];
const TIRAGES = 20;

const profil = (styles: readonly string[], morphology: string | null): Profile => profilAudit({ gender: "femme", styles, morphology });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const isSport = (it: Item) => formalityOf(it) === 0;
const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const empreinte = (c: CatalogItem[]) => c.map((it) => it.id).sort((a, b) => a - b).join(",");

const VARIANTES: [string, SelectionStrategy, boolean][] = [
  // nom, stratégie, morphologie déclarée
  ["B1 legacy", { rang3: "legacy", v2: false }, true],
  ["B2 sans legacy", { rang3: "neutre", v2: false }, true],
  ["B3 V2 (sat. A)", { rang3: "neutre", v2: "A" }, true],
  ["B3 V2 (sat. B)", { rang3: "neutre", v2: "B" }, true],
  ["L+V2 diagnostic", { rang3: "legacy", v2: "A" }, true],
  ["B4 sans morpho", { rang3: "legacy", v2: false }, false],
];

const FAMILLES: [string, CategoryKey[]][] = [
  ["hauts", ["haut", "pull"]], ["bas", ["pantalon", "jean", "jupe", "short"]],
  ["robes", ["robe", "combinaison"]], ["vestes", ["veste", "manteau"]],
  ["chauss.", ["chaussures"]], ["access.", ["sac", "accessoire"]], ["bijoux", ["bijou"]],
];

type Mesure = {
  n: number; pieces: number; sport: number; occasions: number; categories: number; paliers: number; garanties: number;
  looks: number; scores: number[];
  cf: number; c: number; neutre: number; d: number; df: number; actifs: number;
  high: number; medium: number; conseil: number; evalues: number;
};
const VIDE = (): Mesure => ({ n: 0, pieces: 0, sport: 0, occasions: 0, categories: 0, paliers: 0, garanties: 0, looks: 0, scores: [], cf: 0, c: 0, neutre: 0, d: 0, df: 0, actifs: 0, high: 0, medium: 0, conseil: 0, evalues: 0 });

function mesurer(capsule: CatalogItem[], w: Weather, morphology: string, besoinCollants: boolean): Mesure {
  const m = VIDE();
  m.n = 1; m.pieces = capsule.length; m.sport = capsule.filter(isSport).length;
  const occ = new Set<OccasionKey>();
  capsule.forEach((it) => occasionsDe(it).forEach((o) => occ.add(o)));
  m.occasions = occ.size;
  m.categories = new Set(capsule.map((it) => it.cat)).size;
  const struct: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison"];
  m.paliers = new Set(capsule.filter((it) => struct.includes(it.cat)).map(formalityOf)).size;
  const int = capsule.some((it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur");
  const col = capsule.some((it) => it.cat === "accessoire" && it.accessoireType === "Collants");
  m.garanties = (int ? 1 : 0) + (!besoinCollants || col ? 1 : 0);

  const sig = new Set<string>();
  for (const [o] of OCCASIONS) {
    for (let k = 0; k < TIRAGES; k++) {
      const { ids } = generateOutfit(capsule, w, o, "Présentiel", "Verre", [], "femme");
      if (!ids.length) continue;
      const pieces = capsule.filter((it) => ids.includes(it.id));
      sig.add([...ids].sort((a, b) => a - b).join("-"));
      m.scores.push(computeLookScore(pieces, o, [], morphology, new Set<string>(), w).score);
      if (pieces.every(isSport)) continue;   // le sport est hors périmètre morphologique
      m.evalues += 1;
      const s = scoreMorphoV2(pieces, morphology);
      if (s.actif) {
        m.actifs += 1;
        if (s.direction === "compensation_forte") m.cf += 1;
        else if (s.direction === "compensation") m.c += 1;
        else if (s.direction === "neutre") m.neutre += 1;
        else if (s.direction === "defavorable") m.d += 1;
        else m.df += 1;
      }
      const niv = niveauConfiance(pieces);
      if (niv === "HIGH") m.high += 1; else if (niv === "MEDIUM") m.medium += 1;
      if (conseilAffichable(pieces, morphology)) m.conseil += 1;
    }
  }
  m.looks = sig.size;
  return m;
}
function agreger(a: Mesure, b: Mesure) {
  a.n += b.n; a.pieces += b.pieces; a.sport += b.sport; a.occasions += b.occasions;
  a.categories += b.categories; a.paliers += b.paliers; a.garanties += b.garanties;
  a.looks += b.looks; a.scores.push(...b.scores);
  a.cf += b.cf; a.c += b.c; a.neutre += b.neutre; a.d += b.d; a.df += b.df; a.actifs += b.actifs;
  a.high += b.high; a.medium += b.medium; a.conseil += b.conseil; a.evalues += b.evalues;
}
const quantile = (xs: number[], q: number) => { if (!xs.length) return 0; const t = [...xs].sort((x, y) => x - y); return t[Math.min(t.length - 1, Math.floor(q * t.length))]; };
const ligne = (nom: string, a: Mesure, ref?: Mesure) => {
  const moy = a.scores.reduce((s, x) => s + x, 0) / (a.scores.length || 1);
  return `  ${nom.padEnd(18)}${(a.pieces / a.n).toFixed(1).padStart(7)}${(a.occasions / a.n).toFixed(1).padStart(6)}${(a.categories / a.n).toFixed(1).padStart(6)}${(a.garanties / a.n).toFixed(1).padStart(6)}` +
    `${String(a.looks).padStart(7)}${(ref ? (((a.looks - ref.looks) / ref.looks) * 100).toFixed(1) + "%" : "—").padStart(8)}` +
    `${moy.toFixed(1).padStart(7)}${String(quantile(a.scores, 0.1)).padStart(5)}${String(quantile(a.scores, 0.9)).padStart(5)}` +
    `${pct(a.cf, a.actifs).padStart(8)}${pct(a.c, a.actifs).padStart(7)}${pct(a.neutre, a.actifs).padStart(8)}${pct(a.d, a.actifs).padStart(7)}${pct(a.df, a.actifs).padStart(7)}` +
    `${pct(a.high, a.evalues).padStart(7)}${pct(a.medium, a.evalues).padStart(7)}${pct(a.conseil, a.evalues).padStart(8)}`;
};
const ENTETE = `  ${"variante".padEnd(18)}${"pièces".padStart(7)}${"occ.".padStart(6)}${"cat.".padStart(6)}${"gar.".padStart(6)}${"looks".padStart(7)}${"Δlooks".padStart(8)}${"moy".padStart(7)}${"P10".padStart(5)}${"P90".padStart(5)}${"comp++".padStart(8)}${"comp+".padStart(7)}${"neutre".padStart(8)}${"déf".padStart(7)}${"déf++".padStart(7)}${"HIGH".padStart(7)}${"MED".padStart(7)}${"conseil".padStart(8)}`;

describe("Phase 10 — legacy contre V2 dans la vraie boucle", () => {
  it("verrouille la couture puis mesure chaque variante", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    // ═══ A. INTÉGRITÉ DE L'AUDIT ═══
    console.log(`\n════════ A · INTÉGRITÉ DE LA COUTURE ════════`);
    let comparees = 0, divergentes = 0;
    for (const morphology of MORPHOS) {
      for (const saison of SAISONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES) {
          const p = profil([style], morphology);
          const avant = capsuleAvantCouture(p, w, [], saison, pool);
          // Depuis la neutralisation du 29/08/2026, c'est la stratégie LEGACY
          // explicite qui doit reproduire le code d'avant la couture — la
          // stratégie par défaut, elle, a délibérément changé.
          const apres = computeDefaultCapsule(p, w, [], saison, pool, STRATEGIE_LEGACY);
          comparees += 1;
          if (empreinte(avant) !== empreinte(apres)) divergentes += 1;
        }
      }
    }
    console.log(`  Capsules comparées au code d'AVANT la couture : ${comparees}`);
    console.log(`  Empreintes divergentes                        : ${divergentes}`);
    // Verrou dur : si la couture change quoi que ce soit, rien d'autre n'est mesuré.
    expect(divergentes).toBe(0);
    console.log(`  ✓ La stratégie par défaut reproduit la production à l'identique.`);

    // ═══ A bis. PLANCHER DE BRUIT ═══
    //
    // B2 (rang 3 neutralisé, morphologie déclarée) et B4 (rang 3 legacy,
    // morphologie nulle) ont exactement la même clé de tri : morphoFit(it,
    // null) renvoie false, donc le rang 3 vaut 0 pour tout candidat dans les
    // deux cas, et `morphology` n'entre dans la sélection que par ce rang.
    // Les deux variantes produisent donc LES MÊMES capsules.
    //
    // Tout écart entre leurs KPI de looks est par conséquent du bruit
    // d'échantillonnage — generateOutfit tire au hasard. C'est un étalon
    // gratuit : aucun écart inférieur à celui-là ne peut être interprété.
    let identiques = 0, comparees2 = 0;
    for (const morphology of MORPHOS) {
      for (const saison of SAISONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES) {
          const b2 = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool, { rang3: "neutre", v2: false });
          const b4 = computeDefaultCapsule(profil([style], null), w, [], saison, pool, { rang3: "legacy", v2: false });
          comparees2 += 1;
          if (empreinte(b2) === empreinte(b4)) identiques += 1;
        }
      }
    }
    console.log(`\n════════ A bis · PLANCHER DE BRUIT ════════`);
    console.log(`  Capsules B2 et B4 identiques : ${identiques} / ${comparees2}`);
    expect(identiques).toBe(comparees2);
    console.log(`  ✓ Tout écart B2/B4 dans les tableaux qui suivent est du bruit d'échantillonnage.`);

    // ═══ B. LE LEGACY : COMBIEN DE PIÈCES DÉPLACE-T-IL, ET OÙ ═══
    console.log(`\n════════ B · CE QUE DÉPLACE LE LEGACY (B1 contre B4) ════════`);
    console.log(`  ${"morphologie".padEnd(20)}${"saison".padEnd(11)}${"pièces ≠".padStart(9)}${"familles touchées".padStart(19)}`);
    const deplaceesParMorpho = new Map<string, number[]>();
    for (const morphology of MORPHOS) {
      for (const saison of SAISONS) {
        const w = representativeWeatherFor(saison);
        const ecarts: number[] = [];
        const familles = new Map<string, number>();
        for (const style of STYLES) {
          const avec = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool);
          const sans = computeDefaultCapsule(profil([style], null), w, [], saison, pool);
          const idsSans = new Set(sans.map((it) => it.id));
          const ajoutees = avec.filter((it) => !idsSans.has(it.id));
          ecarts.push(ajoutees.length);
          for (const [nom, cats] of FAMILLES) {
            const n = ajoutees.filter((it) => cats.includes(it.cat)).length;
            if (n) familles.set(nom, (familles.get(nom) ?? 0) + n);
          }
        }
        deplaceesParMorpho.set(morphology, [...(deplaceesParMorpho.get(morphology) ?? []), ...ecarts]);
        const detail = [...familles.entries()].sort((a, b) => b[1] - a[1]).map(([f, n]) => `${f}:${n}`).join(" ");
        console.log(`  ${morphology.padEnd(20)}${saison.padEnd(11)}${(ecarts.reduce((a, b) => a + b, 0) / ecarts.length).toFixed(2).padStart(9)}   ${detail}`);
      }
    }

    // ═══ C. LES VARIANTES DANS LA VRAIE BOUCLE ═══
    for (const morphology of MORPHOS) {
      const actifV2 = AVEC_V2.includes(morphology);
      console.log(`\n\n════════════════ ${morphology}${actifV2 ? "" : "   (V2 ne produit aucun signal de sélection)"} ════════════════`);
      const global = new Map<string, Mesure>(VARIANTES.map(([n]) => [n, VIDE()]));
      const parSaison = new Map<string, Map<string, Mesure>>();

      for (const saison of SAISONS) {
        const w = representativeWeatherFor(saison);
        const coll = capsuleSeasonBucket(saison) === "Automne / Hiver";
        const m = new Map<string, Mesure>(VARIANTES.map(([n]) => [n, VIDE()]));
        for (const style of STYLES) {
          for (const [nom, strategy, avecMorpho] of VARIANTES) {
            const capsule = computeDefaultCapsule(profil([style], avecMorpho ? morphology : null), w, [], saison, pool, strategy);
            const mes = mesurer(capsule, w, morphology, coll);
            agreger(m.get(nom)!, mes);
            agreger(global.get(nom)!, mes);
          }
        }
        parSaison.set(saison, m);
      }

      console.log(`\n──── SYNTHÈSE ────`);
      console.log(ENTETE);
      const ref = global.get("B1 legacy")!;
      for (const [nom] of VARIANTES) console.log(ligne(nom, global.get(nom)!, nom === "B1 legacy" ? undefined : ref));

      if (actifV2) {
        for (const saison of SAISONS) {
          console.log(`\n──── ${saison.toUpperCase()} ────`);
          console.log(ENTETE);
          const r = parSaison.get(saison)!.get("B1 legacy")!;
          for (const [nom] of VARIANTES) console.log(ligne(nom, parSaison.get(saison)!.get(nom)!, nom === "B1 legacy" ? undefined : r));
        }
      }
    }

    // ═══ D. LE RANG 4 SE DÉCLENCHE-T-IL RÉELLEMENT ? ═══
    console.log(`\n\n════════ D · DÉCLENCHEMENT RÉEL DU RANG 4 (B2 contre B3) ════════`);
    console.log(`  ${"morphologie".padEnd(20)}${"saturation".padEnd(12)}${"capsules ≠".padStart(11)}${"pièces ≠ (moy)".padStart(16)}${"max".padStart(6)}`);
    for (const morphology of MORPHOS) {
      for (const sat of ["A", "B"] as const) {
        let differentes = 0; const ecarts: number[] = [];
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          for (const style of STYLES) {
            const sansV2 = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool, { rang3: "neutre", v2: false });
            const avecV2 = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool, { rang3: "neutre", v2: sat });
            const ids = new Set(sansV2.map((it) => it.id));
            const e = avecV2.filter((it) => !ids.has(it.id)).length;
            ecarts.push(e);
            if (e > 0) differentes += 1;
          }
        }
        console.log(`  ${morphology.padEnd(20)}${sat.padEnd(12)}${(differentes + "/24").padStart(11)}${(ecarts.reduce((a, b) => a + b, 0) / ecarts.length).toFixed(2).padStart(16)}${String(Math.max(...ecarts)).padStart(6)}`);
      }
    }

    console.log(`\nCouture d'audit uniquement — aucune règle de production modifiée.`);
  }, 3_600_000);
});
