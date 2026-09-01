import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import {
  CAPSULE_SEASONS, STRATEGIE_PRODUCTION, type SelectionStrategy,
  computeDefaultCapsule, representativeWeatherFor,
} from "../src/lib/capsule";
import { evaluateBlocking, generateOutfitWithFallback, type LeviersMesure } from "../src/lib/logic";
import { fermetureMaille } from "../src/lib/attributes";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// MAILLES FERMÉES — MESURE AVANT / APRÈS. LECTURE SEULE.
//
// Le chantier arbitré le 31/08/2026 comporte DEUX changements, et ils
// n'agissent pas au même endroit :
//
//   ÉTÉ            capsule.ts — une maille fermée n'entre pas dans une capsule
//                  Été, ni par la sélection ni par ensure("pull").
//   SUPERPOSITION  logic.ts — la règle « deux mailles fermées ne se
//                  superposent pas » devient EFFECTIVE. Elle existait depuis
//                  le 31/08 mais comparait `subtype` par égalité stricte et ne
//                  voyait 0 maille fermée sur 34 : elle était inerte.
//
// Quatre bras, DANS LA MÊME EXÉCUTION, sur les MÊMES capsules et les MÊMES
// tirages (règle d'audit, points 1 à 3) : la ligne de base, chaque levier
// seul, et la combinaison. Les bras isolés ne servent pas à « faire mieux » :
// ils servent à ATTRIBUER un effet à l'un ou l'autre changement.
//
// CE QUE CETTE MESURE NE DÉCIDE PAS. Une baisse de mortalité n'est PAS une
// victoire en soi : il faut lire simultanément ce qui ressuscite, ce qui
// devient nouvellement mort, la couverture et les violations de règles dures.
// Le nombre de tenues distinctes n'est PAS un objectif — une hausse n'est pas
// un gain, une baisse n'est pas une perte ; il figure en dernier et ne se lit
// qu'après tout le reste. Le chantier MANTEAU reste séparé : rien ici ne
// conclut sur lui.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "—").padStart(6) + (t ? " %" : "  ");

/**
 * Le bras « avant » neutralise les DEUX changements. Il ne réutilise PAS
 * STRATEGIE_LEGACY, qui bougerait aussi le rang morphologique et le signal V2
 * — trois leviers au lieu d'un, et plus aucune attribution possible.
 */
const AVANT_ETE: SelectionStrategy = { ...STRATEGIE_PRODUCTION, maillesFermeesEte: "admises" };
const AVANT_SUPERPOSITION: LeviersMesure = { superpositionMaillesFermees: true };

const BRAS: { nom: string; court: string; strategy: SelectionStrategy; leviers?: LeviersMesure }[] = [
  { nom: "AVANT · les deux inertes", court: "AV", strategy: AVANT_ETE, leviers: AVANT_SUPERPOSITION },
  { nom: "ÉTÉ seul", court: "ÉTÉ", strategy: STRATEGIE_PRODUCTION, leviers: AVANT_SUPERPOSITION },
  { nom: "SUPERPOSITION seule", court: "SUP", strategy: AVANT_ETE },
  { nom: "APRÈS · production", court: "AP", strategy: STRATEGIE_PRODUCTION },
];

/** Graine partagée par tous les bras — cf. le commentaire de pull-contrat. */
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

interface Resultat {
  vus: Set<number>;
  tenues: number;
  occCouvertes: number;
  violations: number;
  parRegle: Map<string, number>;
  distinctes: Set<string>;
  deuxMaillesFermees: number;
  taillePool: number;
  taillePar: Map<CapsuleSeason, number>;
  pullsEnCapsule: Set<number>;
  echantillon: string[];
}

describe("mailles fermées — avant / après", () => {
  it("mesure les quatre bras dans la même exécution, sur les mêmes tirages", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    console.log(`Catalogue exploitable : ${pool.length} pièces sur ${rows.length} lignes.`);
    console.log(`${N} tirages par cellule × occasion, 4 saisons × 8 styles × 10 occasions, 4 bras.`);

    const vide = (): Resultat => ({
      vus: new Set(), tenues: 0, occCouvertes: 0, violations: 0, parRegle: new Map(), distinctes: new Set(),
      deuxMaillesFermees: 0, taillePool: 0, taillePar: new Map(), pullsEnCapsule: new Set(), echantillon: [],
    });
    const res = new Map<string, Resultat>(BRAS.map((b) => [b.court, vide()]));
    const mortes = new Map<string, Set<string>>(BRAS.map((b) => [b.court, new Set()]));
    const mortesParSaison = new Map<string, Map<CapsuleSeason, number>>(BRAS.map((b) => [b.court, new Map()]));
    const mortesParCat = new Map<string, Map<CategoryKey, number>>(BRAS.map((b) => [b.court, new Map()]));

    for (const b of BRAS) {
      const r = res.get(b.court)!;
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES_FEMME) {
          const capsule = computeDefaultCapsule(
            profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool, b.strategy
          );
          r.taillePool += capsule.length;
          r.taillePar.set(saison, (r.taillePar.get(saison) ?? 0) + capsule.length);
          for (const it of capsule) if (it.cat === "pull") r.pullsEnCapsule.add(it.id);

          const vusIci = new Set<number>();
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const vraiRandom = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}`));
              let ids: number[];
              try {
                ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison, b.leviers).ids;
              } finally {
                Math.random = vraiRandom;
              }
              if (!ids.length) continue;
              couverte = true;
              r.tenues += 1;
              r.distinctes.add(`${saison}|${style}|${occ}|${[...ids].sort((x, y) => x - y).join(",")}`);
              for (const id of ids) { r.vus.add(id); vusIci.add(id); }
              const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];

              // La métrique qui dit si la règle de superposition MORD.
              const fermees = pieces.filter((p) => fermetureMaille(p) === "fermée");
              if (fermees.length >= 2) {
                r.deuxMaillesFermees += 1;
                if (r.echantillon.length < 12) {
                  r.echantillon.push(`${saison} · ${style} · ${occ} — ${fermees.map((p) => p.name).join(" + ")}`);
                }
              }

              // R-B1 exclue : elle compare la saison de la pièce à la météo,
              // alors que la génération suit le référentiel de la capsule.
              // Bruit constant, identique aux quatre bras (cf. pull-contrat).
              for (const h of evaluateBlocking(pieces, occ, w, "Présentiel", "Verre")) {
                if (h.id === "R-B1") continue;
                r.violations += 1;
                r.parRegle.set(h.id, (r.parRegle.get(h.id) ?? 0) + 1);
              }
            }
            if (couverte) r.occCouvertes += 1;
          }
          for (const it of capsule) {
            if (vusIci.has(it.id)) continue;
            mortes.get(b.court)!.add(`${saison}|${style}|${it.id}`);
            const ps = mortesParSaison.get(b.court)!;
            ps.set(saison, (ps.get(saison) ?? 0) + 1);
            const pc = mortesParCat.get(b.court)!;
            pc.set(it.cat, (pc.get(it.cat) ?? 0) + 1);
          }
        }
      }
    }

    const mAV = mortes.get("AV")!;

    // ═══ 1 · MORTALITÉ ═══
    console.log(`\n════════ 1 · MORTALITÉ ════════`);
    console.log(`  Une baisse n'est PAS une victoire à elle seule : lire « nouvelles mortes » en`);
    console.log(`  regard, et la couverture au § 3. « Nouvelles mortes » n'est jamais soldé avec`);
    console.log(`  « ressuscitées » — c'est le signal de régression.`);
    console.log(`  ${"bras".padEnd(26)}${"mortes".padStart(8)}${"taux".padStart(10)}${"ressusc.".padStart(11)}${"NOUVELLES MORTES".padStart(19)}`);
    for (const b of BRAS) {
      const m = mortes.get(b.court)!;
      const r = res.get(b.court)!;
      const ress = [...mAV].filter((k) => !m.has(k)).length;
      const nouv = [...m].filter((k) => !mAV.has(k)).length;
      console.log(`  ${b.nom.padEnd(26)}${String(m.size).padStart(8)}${pct(m.size, r.taillePool).padStart(10)}` +
        `${(b.court === "AV" ? "—" : String(ress)).padStart(11)}${(b.court === "AV" ? "—" : String(nouv)).padStart(19)}`);
    }

    console.log(`\n  Par saison :`);
    console.log(`  ${"bras".padEnd(26)}${CAPSULE_SEASONS.map((s) => s.padStart(12)).join("")}`);
    for (const b of BRAS) {
      console.log(`  ${b.nom.padEnd(26)}` +
        CAPSULE_SEASONS.map((s) => String(mortesParSaison.get(b.court)!.get(s) ?? 0).padStart(12)).join(""));
    }

    const cats = [...new Set(BRAS.flatMap((b) => [...mortesParCat.get(b.court)!.keys()]))].sort();
    console.log(`\n  Par catégorie :`);
    console.log(`  ${"catégorie".padEnd(16)}${BRAS.map((b) => b.court.padStart(9)).join("")}`);
    for (const cat of cats) {
      console.log(`  ${cat.padEnd(16)}` + BRAS.map((b) => String(mortesParCat.get(b.court)!.get(cat) ?? 0).padStart(9)).join(""));
    }
    console.log(`  Le chantier MANTEAU reste séparé : cette ligne ne conclut rien sur lui.`);

    // ═══ 2 · LES PULLS, SPÉCIFIQUEMENT ═══
    console.log(`\n════════ 2 · LES PULLS ════════`);
    console.log(`  ${"bras".padEnd(26)}${"en capsule".padStart(12)}${"morts".padStart(9)}${"taux mort.".padStart(12)}${"vs AVANT".padStart(11)}`);
    const pullsMorts = (court: string) =>
      [...mortes.get(court)!].filter((k) => index.get(Number(k.split("|")[2]))?.cat === "pull").length;
    const basePulls = pullsMorts("AV");
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      const m = pullsMorts(b.court);
      console.log(`  ${b.nom.padEnd(26)}${String(r.pullsEnCapsule.size).padStart(12)}${String(m).padStart(9)}` +
        `${pct(m, r.pullsEnCapsule.size).padStart(12)}${(b.court === "AV" ? "—" : (m - basePulls >= 0 ? "+" : "") + (m - basePulls)).padStart(11)}`);
    }
    console.log(`  « en capsule » = pulls distincts retenus par la sélection, toutes cellules.`);

    // ═══ 3 · COUVERTURE D'OCCASION — CRITÈRE BLOQUANT ═══
    console.log(`\n════════ 3 · COUVERTURE D'OCCASION ════════`);
    console.log(`  Aucune perte n'est acceptable sans nouvel arbitrage. 320 = 32 capsules × 10 occasions.`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      const ecart = r.occCouvertes - res.get("AV")!.occCouvertes;
      console.log(`  ${b.nom.padEnd(26)}${`${r.occCouvertes}/320`.padStart(10)}${(b.court === "AV" ? "—" : (ecart >= 0 ? "+" : "") + ecart).padStart(10)}`);
    }

    // ═══ 4 · VIOLATIONS DE RÈGLES DURES ═══
    console.log(`\n════════ 4 · VIOLATIONS DE RÈGLES DURES ════════`);
    console.log(`  ${"bras".padEnd(26)}${"tenues".padStart(9)}${"violations".padStart(12)}${"par tenue".padStart(12)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(26)}${String(r.tenues).padStart(9)}${String(r.violations).padStart(12)}${(r.tenues ? (r.violations / r.tenues).toFixed(3) : "—").padStart(12)}`);
    }
    const regles = [...new Set(BRAS.flatMap((b) => [...res.get(b.court)!.parRegle.keys()]))].sort();
    console.log(`\n  ${"règle".padEnd(10)}${BRAS.map((b) => b.court.padStart(9)).join("")}`);
    for (const rg of regles) {
      console.log(`  ${rg.padEnd(10)}` + BRAS.map((b) => String(res.get(b.court)!.parRegle.get(rg) ?? 0).padStart(9)).join(""));
    }

    // ═══ 5 · LA RÈGLE MORD-ELLE ? ═══
    console.log(`\n════════ 5 · DEUX MAILLES FERMÉES DANS LA MÊME TENUE ════════`);
    console.log(`  C'est la métrique qui dit si le correctif fait ce qu'il prétend. Avant, elle`);
    console.log(`  affichait 0,0 % pendant que l'échantillon montrait des pulls superposés :`);
    console.log(`  la règle ne VOYAIT rien. Ici elle compte les tenues réellement concernées.`);
    console.log(`  ${"bras".padEnd(26)}${"tenues".padStart(9)}${"part".padStart(10)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(26)}${String(r.deuxMaillesFermees).padStart(9)}${pct(r.deuxMaillesFermees, r.tenues).padStart(10)}`);
    }
    console.log(`\n  Échantillon du bras AVANT — ce que la production produisait sans le voir :`);
    for (const t of res.get("AV")!.echantillon) console.log(`     ${t}`);
    if (res.get("AP")!.deuxMaillesFermees > 0) {
      console.log(`\n  >>> ANOMALIE : le bras APRÈS en produit encore. Échantillon :`);
      for (const t of res.get("AP")!.echantillon) console.log(`     ${t}`);
    }

    // ═══ 6 · TAILLE DES CAPSULES ═══
    console.log(`\n════════ 6 · TAILLE DES CAPSULES ════════`);
    console.log(`  Exclure des pièces réduit mécaniquement le pool. À surveiller sur l'Été seul.`);
    console.log(`  ${"bras".padEnd(26)}${CAPSULE_SEASONS.map((s) => s.padStart(12)).join("")}`);
    for (const b of BRAS) {
      console.log(`  ${b.nom.padEnd(26)}` + CAPSULE_SEASONS.map((s) => String(res.get(b.court)!.taillePar.get(s) ?? 0).padStart(12)).join(""));
    }

    // ═══ 7 · DIVERSITÉ — INDICATEUR SECONDAIRE, JAMAIS UN OBJECTIF ═══
    console.log(`\n════════ 7 · DIVERSITÉ ════════`);
    console.log(`  Une hausse n'est PAS un gain, une baisse n'est PAS une perte. Le nombre de`);
    console.log(`  looks possibles n'est pas un KPI produit : à lire seulement après §1 à §5.`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      const ecart = r.distinctes.size - res.get("AV")!.distinctes.size;
      console.log(`  ${b.nom.padEnd(26)}${String(r.distinctes.size).padStart(10)}${(b.court === "AV" ? "—" : (ecart >= 0 ? "+" : "") + ecart).padStart(10)}`);
    }

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucun appelant de production modifié.`);
  });
});
