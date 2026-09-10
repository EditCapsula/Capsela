import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { CLOTHING_CATS, evaluateBlocking, generateOutfitWithFallback, type LeviersMesure } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// D'OÙ VIENNENT LES −106 VIOLATIONS DE P1' ? — LECTURE SEULE.
//
// L'audit P1' a mesuré A = 2736, B = 2630, C = 2654. La baisse de 106 entre A
// et B N'EST PAS une amélioration tant que sa cause n'est pas établie. C'est
// la même exigence que celle appliquée au +13 de R-B8 : une variation
// s'explique avant d'être interprétée, dans les deux sens.
//
// MÉTHODE. Comparaison APPARIÉE. Les cellules, les capsules et les graines
// sont celles de l'audit P1' — mêmes clés `saison|style|occasion|k`, sans le
// bras — de sorte que chaque tirage produit une PAIRE (A, B) comparable pièce
// à pièce. Les totaux doivent donc reproduire 2736 / 2630 / 2654 : s'ils ne
// les reproduisent pas, ce script décompose autre chose que la mesure qu'on
// cherche à expliquer, et il le dit au lieu de conclure.
//
// ATTRIBUTION. Pour chaque règle qui tire dans A et pas dans B sur la même
// paire, le DÉCLENCHEUR est identifié par retrait unitaire : une pièce p de A
// est déclencheuse si retirer p éteint CETTE règle. C'est une définition
// opérationnelle, calculable, et vérifiable — pas une intuition sur ce qui
// « devrait » déclencher la règle. Quatre familles, jamais confondues :
//
//   1 · REMPLACÉE PAR LE PULL — toutes les déclencheuses de A sont absentes
//       de B, et B a bien un pull en dessus principal que A n'avait pas.
//       C'est le seul cas où la baisse est imputable à P1' lui-même.
//   2 · REMPLACÉE PAR AUTRE CHOSE — les déclencheuses sont absentes de B mais
//       B n'a pas de pull principal : la divergence est PROPAGÉE (le levier a
//       décalé le tirage), pas causée.
//   3 · MÊME PIÈCE, CONTEXTE CHANGÉ — une déclencheuse est toujours dans B,
//       mais la règle ne tire plus : c'est le reste de la tenue qui a changé.
//   4 · POPULATION — l'un des deux bras ne produit pas de tenue sur ce tirage.
//       La règle ne baisse pas : elle n'est pas évaluée.
//
// Le sens inverse (règle qui tire dans B et pas dans A) est compté avec la
// même rigueur : un delta net de −106 peut cacher des centaines de mouvements
// dans les deux sens, et ne rien devoir à P1'.
//
// Aucun fichier de production modifié. Aucune écriture en base.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
/** Identique à l'audit P1' : toute autre valeur mesurerait un autre tirage. */
const N = 40;
const P1: LeviersMesure = { pullCommeHautPrincipal: "base" };
/** Règle affichée mais hors total, comme dans l'audit P1' d'origine. */
const HORS_TOTAL = "R-B1";

const BRAS: { court: string; nom: string; leviers: (occ: OccasionKey) => LeviersMesure | undefined }[] = [
  { court: "A", nom: "A · production actuelle", leviers: () => undefined },
  { court: "B", nom: "B · P1' partout", leviers: () => P1 },
  { court: "C", nom: "C · P1' sauf entretien", leviers: (occ) => (occ === "entretien" ? undefined : P1) },
];

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

/** Le pull est le dessus principal : présent, sans `haut`, sans robe ni combinaison. */
const pullPrincipal = (p: Item[]) =>
  p.some((i) => i.cat === "pull") &&
  !p.some((i) => i.cat === "haut") &&
  !p.some((i) => i.cat === "robe" || i.cat === "combinaison");

type Famille = "pull" | "autre" | "contexte" | "population";

describe("les −106 violations de P1'", () => {
  it("décompose l'écart règle par règle et attribue chaque disparition", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));

    const cellules: { saison: CapsuleSeason; style: string; capsule: CatalogItem[]; w: ReturnType<typeof representativeWeatherFor> }[] = [];
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        cellules.push({ saison, style, w, capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool) });
      }
    }
    console.log(`Catalogue : ${pool.length} pièces. ${cellules.length} cellules, ${N} tirages par cellule × occasion.`);

    /** Un tirage, semé sur `cle` seule — la graine ne connaît PAS le bras. */
    const tirage = (
      c: (typeof cellules)[number], occ: OccasionKey, cle: string, lev: LeviersMesure | undefined,
    ): number[] => {
      const vrai = Math.random;
      Math.random = mulberry32(grainePour(cle));
      try {
        return generateOutfitWithFallback(c.capsule, c.w, occ, "Présentiel", "Verre", [], "femme", c.saison, lev).ids;
      } finally { Math.random = vrai; }
    };

    // ═══ 1 · REPRODUIRE LES TOTAUX ════════════════════════════════════════
    //
    // Avant d'expliquer un écart, vérifier qu'on mesure bien le même écart.
    console.log(`\n════════ 1 · LES TOTAUX SONT-ILS CEUX DE L'AUDIT P1' ? ════════`);
    const totaux = new Map<string, { tenues: number; violations: number; parRegle: Map<string, number>; piecesVetement: number; avecExterieur: number }>();
    const tenuesPar = new Map<string, Map<string, number[]>>(); // bras -> clé -> ids
    for (const b of BRAS) {
      totaux.set(b.court, { tenues: 0, violations: 0, parRegle: new Map(), piecesVetement: 0, avecExterieur: 0 });
      tenuesPar.set(b.court, new Map());
    }
    for (const c of cellules) {
      for (const occ of OCCS) {
        for (let k = 0; k < N; k++) {
          const cle = `${c.saison}|${c.style}|${occ}|${k}`;
          for (const b of BRAS) {
            const ids = tirage(c, occ, cle, b.leviers(occ));
            tenuesPar.get(b.court)!.set(cle, ids);
            if (!ids.length) continue;
            const t = totaux.get(b.court)!;
            t.tenues += 1;
            const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];
            for (const h of evaluateBlocking(pieces, occ, c.w, "Présentiel", "Verre")) {
              // R-B1 est HORS TOTAL, exactement comme dans l'audit P1' qu'on
              // cherche à expliquer : elle compare la saison de la pièce à la
              // météo alors que la génération suit le référentiel de la
              // capsule. La compter ici ferait diverger les totaux de la
              // mesure d'origine et rendrait la décomposition inutilisable.
              // Elle reste affichée, séparément, parce qu'elle bouge aussi.
              if (h.id !== HORS_TOTAL) t.violations += 1;
              t.parRegle.set(h.id, (t.parRegle.get(h.id) ?? 0) + 1);
            }
            const vet = pieces.filter((p) => CLOTHING_CATS.includes(p.cat));
            t.piecesVetement += vet.length;
            if (pieces.some((p) => p.cat === "veste" || p.cat === "manteau")) t.avecExterieur += 1;
          }
        }
      }
    }
    console.log(`  ${"bras".padEnd(26)}${"tenues".padStart(9)}${"violations".padStart(12)}${"attendu".padStart(10)}`);
    const ATTENDU: Record<string, number> = { A: 2736, B: 2630, C: 2654 };
    let reproduit = true;
    for (const b of BRAS) {
      const t = totaux.get(b.court)!;
      if (t.violations !== ATTENDU[b.court]) reproduit = false;
      console.log(`  ${b.nom.padEnd(26)}${String(t.tenues).padStart(9)}${String(t.violations).padStart(12)}${String(ATTENDU[b.court]).padStart(10)}`);
    }
    console.log(reproduit
      ? `  >>> Totaux reproduits. La décomposition qui suit porte bien sur la mesure à expliquer.`
      : `  >>> ATTENTION : totaux NON reproduits. La décomposition porte sur CETTE exécution,`);
    if (!reproduit) {
      console.log(`      et les écarts ci-dessous ne peuvent pas être transportés sur l'audit P1'`);
      console.log(`      d'origine sans une nouvelle mesure. À lire comme tel — règle d'audit, point 4.`);
    }

    // ═══ 2 · L'ÉCART RÈGLE PAR RÈGLE ══════════════════════════════════════
    console.log(`\n════════ 2 · A → B, RÈGLE PAR RÈGLE ════════`);
    const regles = [...new Set(BRAS.flatMap((b) => [...totaux.get(b.court)!.parRegle.keys()]))].sort();
    console.log(`  ${"règle".padEnd(10)}${"A".padStart(8)}${"B".padStart(8)}${"C".padStart(8)}${"B−A".padStart(8)}`);
    for (const rg of regles) {
      const a = totaux.get("A")!.parRegle.get(rg) ?? 0;
      const b = totaux.get("B")!.parRegle.get(rg) ?? 0;
      const c = totaux.get("C")!.parRegle.get(rg) ?? 0;
      console.log(`  ${rg.padEnd(10)}${String(a).padStart(8)}${String(b).padStart(8)}${String(c).padStart(8)}${((b - a >= 0 ? "+" : "") + (b - a)).padStart(8)}`
        + (rg === HORS_TOTAL ? "   (hors total — exclue par l'audit P1')" : ""));
    }

    // ═══ 3 · ATTRIBUTION APPARIÉE ═════════════════════════════════════════
    console.log(`\n════════ 3 · ATTRIBUTION PAIRE PAR PAIRE (A vs B) ════════`);
    console.log(`  Le déclencheur est établi par RETRAIT UNITAIRE : p est déclencheuse si`);
    console.log(`  retirer p de la tenue de A éteint cette règle-là.`);
    const familles = new Map<string, Map<Famille, number>>();
    const inverse = new Map<string, number>();
    const inverseFam = new Map<string, Map<Famille, number>>();
    let identiques = 0, divergentes = 0, popA = 0, popB = 0, sansDeclencheur = 0;
    const sousPull = new Map<string, number>();
    const exemples: string[] = [];

    for (const c of cellules) {
      for (const occ of OCCS) {
        for (let k = 0; k < N; k++) {
          const cle = `${c.saison}|${c.style}|${occ}|${k}`;
          const idsA = tenuesPar.get("A")!.get(cle)!;
          const idsB = tenuesPar.get("B")!.get(cle)!;
          const memeTenue = idsA.length === idsB.length && [...idsA].sort().join(",") === [...idsB].sort().join(",");
          if (memeTenue) { identiques += 1; continue; }
          divergentes += 1;

          const piecesA = idsA.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];
          const piecesB = idsB.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];
          const hitsA = new Set(idsA.length ? evaluateBlocking(piecesA, occ, c.w, "Présentiel", "Verre").map((h) => h.id) : []);
          const hitsB = new Set(idsB.length ? evaluateBlocking(piecesB, occ, c.w, "Présentiel", "Verre").map((h) => h.id) : []);
          const nouveauPull = pullPrincipal(piecesB) && !pullPrincipal(piecesA);

          // Les APPARITIONS sont attribuées avec exactement la même méthode que
          // les disparitions — retrait unitaire sur la tenue de B. Ne traiter
          // qu'un sens donnerait un compte-rendu à moitié fait : le net de
          // −106 est une différence entre deux mouvements, pas un seul.
          for (const rg of hitsB) {
            if (hitsA.has(rg)) continue;
            if (rg === HORS_TOTAL) continue;
            const parFam = inverseFam.get(rg) ?? new Map<Famille, number>();
            let fam: Famille;
            if (!idsA.length) fam = "population";
            else {
              const declB = piecesB.filter((p) => {
                const reste = piecesB.filter((q) => q.id !== p.id);
                return !reste.length || !evaluateBlocking(reste, occ, c.w, "Présentiel", "Verre").some((h) => h.id === rg);
              });
              const idsAset = new Set(idsA);
              fam = !declB.length ? "contexte"
                : declB.every((p) => !idsAset.has(p.id))
                  ? (declB.some((p) => p.cat === "pull") ? "pull" : "autre")
                  : "contexte";
            }
            parFam.set(fam, (parFam.get(fam) ?? 0) + 1);
            inverseFam.set(rg, parFam);
            inverse.set(rg, (inverse.get(rg) ?? 0) + 1);
          }

          for (const rg of hitsA) {
            if (hitsB.has(rg)) continue;
            if (rg === HORS_TOTAL) continue;
            const parFam = familles.get(rg) ?? new Map<Famille, number>();
            let fam: Famille;
            if (!idsB.length) { fam = "population"; popB += 1; }
            else {
              const declencheurs = piecesA.filter((p) => {
                const reste = piecesA.filter((q) => q.id !== p.id);
                return !reste.length || !evaluateBlocking(reste, occ, c.w, "Présentiel", "Verre").some((h) => h.id === rg);
              });
              if (!declencheurs.length) { sansDeclencheur += 1; fam = "contexte"; }
              else {
                const idsBset = new Set(idsB);
                const toutesParties = declencheurs.every((p) => !idsBset.has(p.id));
                fam = !toutesParties ? "contexte" : nouveauPull ? "pull" : "autre";
                // Sous-partition de la famille « pull », exigée par le mandat :
                // une règle peut cesser de tirer parce que la COMPOSITION a
                // changé, ou simplement parce que la tenue de B a perdu sa
                // couche extérieure et offre moins de prises. Les deux se
                // ressemblent dans le total et n'ont pas la même valeur.
                if (fam === "pull") {
                  const extA = piecesA.some((p) => p.cat === "veste" || p.cat === "manteau");
                  const extB = piecesB.some((p) => p.cat === "veste" || p.cat === "manteau");
                  const cle = extA && !extB ? "couchePerdue" : extA === extB ? "memeCouche" : "coucheGagnee";
                  sousPull.set(cle, (sousPull.get(cle) ?? 0) + 1);
                }
                if (fam === "pull" && exemples.length < 10) {
                  exemples.push(
                    `${rg} · ${c.saison}/${c.style}/${occ}\n         A : ${piecesA.map((p) => p.name).join(" + ")}` +
                    `\n         B : ${piecesB.map((p) => p.name).join(" + ")}` +
                    `\n         déclencheuse(s) retirée(s) : ${declencheurs.map((p) => p.name).join(", ")}`,
                  );
                }
              }
            }
            parFam.set(fam, (parFam.get(fam) ?? 0) + 1);
            familles.set(rg, parFam);
          }
          if (!idsA.length && idsB.length) popA += 1;
        }
      }
    }

    console.log(`\n  ${identiques} paires identiques (aucun écart possible), ${divergentes} divergentes.`);
    console.log(`  Tirages où A ne produit rien et B si : ${popA}. Où B ne produit rien et A si : ${popB}.`);
    if (sansDeclencheur) console.log(`  ${sansDeclencheur} disparitions sans déclencheur unitaire identifiable — classées « contexte ».`);
    console.log(`\n  DISPARITIONS (règle dans A, absente dans B) :`);
    console.log(`  ${"règle".padEnd(10)}${"total".padStart(8)}${"pull".padStart(8)}${"autre".padStart(8)}${"contexte".padStart(10)}${"popul.".padStart(9)}`);
    const tot = new Map<Famille, number>();
    for (const rg of [...familles.keys()].sort()) {
      const f = familles.get(rg)!;
      const g = (x: Famille) => f.get(x) ?? 0;
      for (const x of ["pull", "autre", "contexte", "population"] as Famille[]) tot.set(x, (tot.get(x) ?? 0) + g(x));
      console.log(`  ${rg.padEnd(10)}${String(g("pull") + g("autre") + g("contexte") + g("population")).padStart(8)}` +
        `${String(g("pull")).padStart(8)}${String(g("autre")).padStart(8)}${String(g("contexte")).padStart(10)}${String(g("population")).padStart(9)}`);
    }
    const somme = [...tot.values()].reduce((a, b) => a + b, 0);
    console.log(`  ${"TOTAL".padEnd(10)}${String(somme).padStart(8)}${String(tot.get("pull") ?? 0).padStart(8)}` +
      `${String(tot.get("autre") ?? 0).padStart(8)}${String(tot.get("contexte") ?? 0).padStart(10)}${String(tot.get("population") ?? 0).padStart(9)}`);

    console.log(`\n  APPARITIONS (règle dans B, absente dans A) :`);
    console.log(`  ${"règle".padEnd(10)}${"total".padStart(8)}${"pull".padStart(8)}${"autre".padStart(8)}${"contexte".padStart(10)}${"popul.".padStart(9)}`);
    let sommeInv = 0;
    for (const rg of [...inverse.keys()].sort()) {
      const f = inverseFam.get(rg) ?? new Map<Famille, number>();
      const g = (x: Famille) => f.get(x) ?? 0;
      console.log(`  ${rg.padEnd(10)}${String(inverse.get(rg)).padStart(8)}${String(g("pull")).padStart(8)}` +
        `${String(g("autre")).padStart(8)}${String(g("contexte")).padStart(10)}${String(g("population")).padStart(9)}`);
      sommeInv += inverse.get(rg)!;
    }
    console.log(`  ${"TOTAL".padEnd(10)}${String(sommeInv).padStart(8)}`);
    console.log(`\n  Mouvement brut : −${somme} / +${sommeInv}. Net : ${sommeInv - somme}.`);
    console.log(`  Le net doit égaler B−A = ${(totaux.get("B")!.violations - totaux.get("A")!.violations)}.`);
    if (sommeInv - somme !== totaux.get("B")!.violations - totaux.get("A")!.violations) {
      console.log(`  >>> ÉCART DE COMPTAGE : l'attribution ne reconstitue pas le net. Ne pas conclure.`);
    }
    const impact = tot.get("pull") ?? 0;
    console.log(`\n  >>> Imputable à P1' lui-même (pièce déclencheuse remplacée par le pull) : ${impact}`);
    console.log(`      sur ${somme} disparitions. Le reste est propagé ou de population, et ne dit`);
    console.log(`      RIEN de la qualité des tenues.`);

    console.log(`\n  Exemples de disparitions imputables au pull (bruts, non retouchés) :`);
    for (const e of exemples) console.log(`     ${e}`);

    // ═══ 4 · LA BAISSE VIENT-ELLE D'UNE TENUE PLUS COURTE ? ═══════════════
    //
    // Les exemples montrent tous le même mouvement : le pull remplace la
    // surchemise ET la tenue perd son blazer ou son trench. Une tenue avec
    // moins de pièces a mécaniquement moins d'occasions de violer une règle.
    // Ce n'est pas une amélioration, c'est une simplification — et la
    // distinction décide de la lecture du −106. Mesuré, pas déduit.
    console.log(`\n════════ 4 · LA TENUE DE B EST-ELLE PLUS COURTE QUE CELLE DE A ? ════════`);
    console.log(`  ${"bras".padEnd(26)}${"tenues".padStart(9)}${"pièces vêtement".padStart(18)}${"par tenue".padStart(11)}${"avec veste/manteau".padStart(20)}`);
    for (const b of BRAS) {
      const t = totaux.get(b.court)!;
      console.log(`  ${b.nom.padEnd(26)}${String(t.tenues).padStart(9)}${String(t.piecesVetement).padStart(18)}` +
        `${(t.piecesVetement / t.tenues).toFixed(2).padStart(11)}${`${t.avecExterieur} (${((t.avecExterieur / t.tenues) * 100).toFixed(1)} %)`.padStart(20)}`);
    }
    console.log(`  Si B porte moins de pièces et moins de couches extérieures que A, alors une`);
    console.log(`  part du −106 tient au NOMBRE de pièces évaluées, pas à leur cohérence.`);
    console.log(`\n  Les ${tot.get("pull") ?? 0} disparitions imputées au pull, selon que la tenue de B a GARDÉ`);
    console.log(`  ou PERDU sa couche extérieure par rapport à celle de A :`);
    const lib: Record<string, string> = {
      memeCouche: "même situation de couche  -> la règle cesse par COMPOSITION",
      couchePerdue: "B a perdu veste/manteau   -> la règle cesse peut-être par ABSENCE",
      coucheGagnee: "B a gagné veste/manteau   -> la règle cesse malgré une couche EN PLUS",
    };
    for (const k of ["memeCouche", "couchePerdue", "coucheGagnee"]) {
      console.log(`     ${String(sousPull.get(k) ?? 0).padStart(5)}  ${lib[k]}`);
    }
    console.log(`  C'est cette répartition, et elle seule, qui dit si le −106 tient à une tenue`);
    console.log(`  autrement composée ou à une tenue simplement plus courte.`);

    console.log(`\n  LECTURE SEULE. Ce script n'interprète pas : une baisse expliquée reste une`);
    console.log(`  baisse, pas une amélioration. Le jugement est éditorial et n'appartient pas`);
    console.log(`  à la mesure.`);
  }, 900_000);
});
