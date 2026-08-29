import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor, styleFit } from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { CLOTHING_CATS, TOP_LAYER_CATS } from "../src/lib/logic";
import { BAS_CATS, effectiveFormality } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLE_ID_TO_CATALOG_LABEL } from "../src/lib/profile";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE 15 · CHANTIER C — MÉCANIQUE DU PALIER 4. LECTURE SEULE.
//
// L'audit de couverture a montré que festive et evenement_perso replient dans
// 16 cellules sur 32. Deux hypothèses causales ont été successivement posées
// puis cassées :
//
//   H1 (cassée) « le catalogue tague trop peu de pièces sur ces occasions ».
//       Réfutée par arithmétique : evenement_perso est porté par 28 cellules
//       sur 32 et replie dans 16, donc >= 12 cellules portent l'occasion ET
//       replient ; festive n'est porté que par 10 cellules et 6 au moins
//       atteignent le palier 4 sans aucune pièce taguée.
//
//   H2 (cassée) « le palier 4 n'est atteignable que par une robe ou une
//       combinaison, aucun bas du catalogue n'atteignant la formalité 4 ».
//       Réfutée par lecture du code : R-B3 (logic.ts) laisse passer une pièce
//       si l'UNE de quatre conditions est vraie, et la deuxième — correctif du
//       23/08/2026 — exempte du plancher toute pièce explicitement taguée sur
//       l'occasion. Une jupe de formalité 1 taguée `festive` passe donc le
//       palier 4. Il y a DEUX portes, pas une.
//
// Cet audit ne pose pas de troisième hypothèse. Il énumère exhaustivement les
// quatre clauses de R-B3, compte ce qui passe par chacune, et laisse la cause
// se lire dans les nombres.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const BUCKETS = ["Printemps / Été", "Automne / Hiver"] as const;
const OCC4: OccasionKey[] = ["festive", "evenement_perso"];
const BOTTOMS: CategoryKey[] = [...BAS_CATS, "jupe"];
const UNEPIECE: CategoryKey[] = ["robe", "combinaison"];

const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const declare = (it: Item, o: OccasionKey) => Boolean(it.occasion && it.occasion.includes(o));
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";

/** Les quatre clauses de R-B3, recopiées verbatim de logic.ts (jamais résumées). */
function passeRB3(it: Item, occ: OccasionKey, minFormality: number): boolean {
  return (
    !CLOTHING_CATS.includes(it.cat) ||
    Boolean(it.occasion && it.occasion.includes(occ)) ||
    (TOP_LAYER_CATS.includes(it.cat) && formalityOf(it) > 0) ||
    formalityOf(it) >= minFormality
  );
}
/** Par quelle clause une pièce passe-t-elle ? Ordre identique au court-circuit du code. */
function porteRB3(it: Item, occ: OccasionKey, min: number): string {
  if (!CLOTHING_CATS.includes(it.cat)) return "hors-vetement";
  if (it.occasion && it.occasion.includes(occ)) return "occasion-declaree";
  if (TOP_LAYER_CATS.includes(it.cat) && formalityOf(it) > 0) return "haut-exempte";
  if (formalityOf(it) >= min) return "formalite-suffisante";
  return "BLOQUEE";
}

describe("Phase 15 — mécanique du palier 4", () => {
  it("énumère les portes de R-B3 et dimensionne l'enrichissement", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`\nCatalogue exploitable : ${pool.length} pièces.`);

    // ═══ 1 · LA COLONNE niveau_formalite ═══
    console.log(`\n════════ 1 · COLONNE niveau_formalite ════════`);
    const remplies = brutes.filter((r) => r.niveau_formalite != null);
    console.log(`  Renseignée : ${remplies.length}/${brutes.length} (${pct(remplies.length, brutes.length)})`);
    const valeurs = new Map<string, number>();
    for (const r of brutes) {
      const k = r.niveau_formalite == null ? "(vide)" : String(r.niveau_formalite);
      valeurs.set(k, (valeurs.get(k) ?? 0) + 1);
    }
    console.log(`  Valeurs : ${[...valeurs.entries()].sort().map(([k, v]) => `${k}→${v}`).join("  ")}`);
    console.log(`\n  LA question du 21/08/2026 : un BAS atteint-il la formalité 4 ?`);
    const basF4 = pool.filter((it) => BOTTOMS.includes(it.cat) && formalityOf(it) >= 4);
    console.log(`  Bas (${BOTTOMS.join("/")}) de formalité >= 4 : ${basF4.length}`);
    for (const it of basF4.slice(0, 20)) console.log(`    #${it.id} ${it.cat} — ${it.name} (formalité ${formalityOf(it)})`);
    if (!basF4.length) console.log(`    aucun — la note du 21/08/2026 est CONFIRMÉE sur le catalogue d'aujourd'hui.`);

    // ═══ 2 · FORMALITÉ EFFECTIVE PAR CATÉGORIE ═══
    console.log(`\n════════ 2 · FORMALITÉ EFFECTIVE (formalityOf) PAR CATÉGORIE ════════`);
    console.log(`  ${"catégorie".padEnd(14)}${"n".padStart(5)}${"f=0".padStart(6)}${"f=1".padStart(6)}${"f=3".padStart(6)}${"f=4".padStart(6)}${"dont colonne".padStart(14)}${"dont regex".padStart(12)}`);
    const cats = [...new Set(pool.map((it) => it.cat))].sort();
    for (const cat of cats) {
      const l = pool.filter((it) => it.cat === cat);
      const n = (f: number) => l.filter((it) => formalityOf(it) === f).length;
      const parColonne = l.filter((it) => it.niveauFormalite != null).length;
      console.log(`  ${String(cat).padEnd(14)}${String(l.length).padStart(5)}${String(n(0)).padStart(6)}${String(n(1)).padStart(6)}${String(n(3)).padStart(6)}${String(n(4)).padStart(6)}${String(parColonne).padStart(14)}${String(l.length - parColonne).padStart(12)}`);
    }

    // ═══ 3 · LES QUATRE PORTES DE R-B3 VERS LE PALIER 4 ═══
    console.log(`\n════════ 3 · CHEMIN R-B3 VERS LE PALIER 4 ════════`);
    for (const occ of OCC4) {
      const min = effectiveFormality(occ, "Présentiel", "Verre");
      console.log(`\n  ── ${occ} (palier demandé ${min}) ──`);
      console.log(`  ${"catégorie".padEnd(14)}${"total".padStart(7)}${"passe".padStart(7)}${"occ.decl".padStart(10)}${"haut exempt".padStart(13)}${"form>=4".padStart(9)}${"bloquée".padStart(9)}`);
      for (const cat of cats) {
        const l = pool.filter((it) => it.cat === cat);
        const par = (p: string) => l.filter((it) => porteRB3(it, occ, min) === p).length;
        console.log(`  ${String(cat).padEnd(14)}${String(l.length).padStart(7)}${String(l.filter((it) => passeRB3(it, occ, min)).length).padStart(7)}` +
          `${String(par("occasion-declaree")).padStart(10)}${String(par("haut-exempte")).padStart(13)}${String(par("formalite-suffisante")).padStart(9)}${String(par("BLOQUEE")).padStart(9)}`);
      }
      // Une tenue complète = robe/combinaison, OU haut + bas (hasCoreOutfit).
      const unePiece = pool.filter((it) => UNEPIECE.includes(it.cat) && passeRB3(it, occ, min));
      const bas = pool.filter((it) => BOTTOMS.includes(it.cat) && passeRB3(it, occ, min));
      console.log(`  ⟹ une-pièce éligibles : ${unePiece.length}   ·   bas éligibles : ${bas.length}`);
      console.log(`     dont bas passant PAR LE TAG et non par la formalité : ${bas.filter((it) => formalityOf(it) < min).length}`);
    }

    // ═══ 4 · DIMENSIONNEMENT : CANDIDATS PAR STYLE × BUCKET ═══
    console.log(`\n════════ 4 · CANDIDATS AU PALIER 4 PAR STYLE × BUCKET SAISONNIER ════════`);
    console.log(`  Compte les pièces du CATALOGUE (avant toute sélection) capables d'ouvrir le palier 4.`);
    for (const occ of OCC4) {
      const min = effectiveFormality(occ, "Présentiel", "Verre");
      console.log(`\n  ── ${occ} ──`);
      console.log(`  ${"style".padEnd(16)}${BUCKETS.map((b) => (b + " 1p").padStart(22)).join("")}${BUCKETS.map((b) => (b + " bas").padStart(22)).join("")}`);
      for (const style of STYLES_FEMME) {
        const label = STYLE_ID_TO_CATALOG_LABEL[style];
        const cellules = BUCKETS.flatMap((b) => [
          pool.filter((it) => UNEPIECE.includes(it.cat) && styleFit(it, label) && (it.season === b || it.season === "Toutes saisons") && passeRB3(it, occ, min)).length,
        ]).concat(BUCKETS.map((b) =>
          pool.filter((it) => BOTTOMS.includes(it.cat) && styleFit(it, label) && (it.season === b || it.season === "Toutes saisons") && passeRB3(it, occ, min)).length));
        console.log(`  ${style.padEnd(16)}${cellules.map((n) => String(n).padStart(22)).join("")}`);
      }
    }

    // ═══ 4bis · Y A-T-IL DE QUOI RE-TAGUER, OU FAUT-IL CRÉER ? ═══
    // Décide entre « créer des pièces » et « déclarer l'occasion sur
    // l'existant » : sans ce compte, l'arbitrage n'est pas décidable.
    console.log(`\n════════ 4bis · UNE-PIÈCES EXISTANTES PAR STYLE, PAR FORMALITÉ ════════`);
    console.log(`  ${"style".padEnd(16)}${"1p total".padStart(10)}${"f=1".padStart(6)}${"f=3".padStart(6)}${"f=4".padStart(6)}${"P/É".padStart(6)}${"A/H".padStart(6)}${"tt sais.".padStart(10)}`);
    for (const style of STYLES_FEMME) {
      const label = STYLE_ID_TO_CATALOG_LABEL[style];
      const l = pool.filter((it) => UNEPIECE.includes(it.cat) && styleFit(it, label));
      const nf = (f: number) => l.filter((it) => formalityOf(it) === f).length;
      const ns = (b: string) => l.filter((it) => it.season === b).length;
      console.log(`  ${style.padEnd(16)}${String(l.length).padStart(10)}${String(nf(1)).padStart(6)}${String(nf(3)).padStart(6)}${String(nf(4)).padStart(6)}` +
        `${String(ns("Printemps / Été")).padStart(6)}${String(ns("Automne / Hiver")).padStart(6)}${String(ns("Toutes saisons")).padStart(10)}`);
    }
    console.log(`\n  Lecture : une une-pièce de formalité 3 déjà présente dans un style manquant peut`);
    console.log(`  être ouverte au palier 4 par une DÉCLARATION d'occasion (clause 2 de R-B3), sans`);
    console.log(`  créer de pièce. Un style à 0 une-pièce n'a aucune autre issue que la création.`);

    // ═══ 5 · LA PROPRIÉTÉ LOCALE EST-ELLE SUFFISANTE ? ═══
    console.log(`\n════════ 5 · PRÉSENCE DANS LE POOL ⟹ PRÉSENCE DANS LA CAPSULE ? ════════`);
    console.log(`  Test empirique sur les couples où le catalogue contient déjà un candidat.`);
    console.log(`  ${"saison".padEnd(11)}${"style".padEnd(16)}${"cand. pool".padStart(12)}${"dans capsule".padStart(14)}${"tenue 4 ?".padStart(11)}`);
    let avecCandidat = 0, retenu = 0;
    for (const saison of SAISONS) {
      const w = representativeWeatherFor(saison);
      const bucket = capsuleSeasonBucket(saison);
      for (const style of STYLES_FEMME) {
        const label = STYLE_ID_TO_CATALOG_LABEL[style];
        const min = 4;
        const candidats = pool.filter((it) =>
          (UNEPIECE.includes(it.cat) || BOTTOMS.includes(it.cat)) && styleFit(it, label) &&
          (it.season === bucket || it.season === "Toutes saisons") &&
          OCC4.some((o) => passeRB3(it, o, min)) &&
          (formalityOf(it) >= 4 || OCC4.some((o) => declare(it, o))));
        if (!candidats.length) continue;
        avecCandidat += 1;
        const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool);
        const ids = new Set(capsule.map((it) => it.id));
        const dans = candidats.filter((it) => ids.has(it.id)).length;
        if (dans) retenu += 1;
        const tenue4 = capsule.some((it) => UNEPIECE.includes(it.cat) && OCC4.some((o) => passeRB3(it, o, 4)))
          || (capsule.some((it) => it.cat === "haut") && capsule.some((it) => BOTTOMS.includes(it.cat) && OCC4.some((o) => passeRB3(it, o, 4))));
        console.log(`  ${saison.padEnd(11)}${style.padEnd(16)}${String(candidats.length).padStart(12)}${String(dans).padStart(14)}${(tenue4 ? "oui" : "NON").padStart(11)}`);
      }
    }
    console.log(`\n  Couples avec au moins un candidat au catalogue : ${avecCandidat}`);
    console.log(`  ... dont la capsule en retient au moins un : ${retenu} (${pct(retenu, avecCandidat)})`);
    console.log(`  Si ce taux vaut 100 %, la propriété locale est NÉCESSAIRE et empiriquement suffisante`);
    console.log(`  sur les cas observés — ce qui ne la démontre pas suffisante en général.`);

    // ═══ 6 · LE CAS STREETWEAR : OBSTACLE MÉCANIQUE OU ÉDITORIAL ? ═══
    console.log(`\n════════ 6 · STREETWEAR × PALIER 4 ════════`);
    console.log(`  styleFit lit d'abord it.styleTags (colonne \`styles\`) et ne retombe sur ses`);
    console.log(`  expressions régulières que si la colonne est vide.`);
    const sansTag = pool.filter((it) => !it.styleTags || !it.styleTags.length).length;
    console.log(`  Pièces sans styleTags (donc soumises à la regex) : ${sansTag}/${pool.length}`);
    const sw = pool.filter((it) => styleFit(it, "Streetwear"));
    console.log(`  Pièces Streetwear : ${sw.length}`);
    console.log(`    dont robes/combinaisons : ${sw.filter((it) => UNEPIECE.includes(it.cat)).length}`);
    console.log(`    dont formalité >= 3     : ${sw.filter((it) => formalityOf(it) >= 3).length}`);
    console.log(`    dont formalité = 4      : ${sw.filter((it) => formalityOf(it) === 4).length}`);
    console.log(`    dont taguées festive ou evenement_perso : ${sw.filter((it) => OCC4.some((o) => declare(it, o))).length}`);
    console.log(`\n  VERDICT MÉCANIQUE : la colonne \`styles\` étant remplie à ${pct(pool.length - sansTag, pool.length)},`);
    console.log(`  une pièce taguée « Streetwear » passe styleFit quel que soit son nom. Le moteur`);
    console.log(`  n'oppose donc AUCUN obstacle à une une-pièce Streetwear de formalité 4.`);
    console.log(`  La contrainte est éditoriale, pas technique. Elle ne se tranche pas ici.`);

    // ═══ 7 · CE QUI PORTE DÉJÀ LES OCCASIONS DE PALIER 4 ═══
    console.log(`\n════════ 7 · QUI PORTE festive / evenement_perso, ET DANS QUELLE CATÉGORIE ════════`);
    console.log(`  (le tag sur une chaussure ou un sac ne construit aucune tenue : hasCoreOutfit`);
    console.log(`   exige une robe/combinaison, ou un haut ET un bas)`);
    for (const occ of OCC4) {
      const l = pool.filter((it) => occasionsDe(it).includes(occ));
      const parCat = new Map<string, number>();
      for (const it of l) parCat.set(it.cat, (parCat.get(it.cat) ?? 0) + 1);
      const structurant = l.filter((it) => UNEPIECE.includes(it.cat) || BOTTOMS.includes(it.cat)).length;
      console.log(`\n  ${occ} : ${l.length} pièces`);
      console.log(`    ${[...parCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join("  ")}`);
      console.log(`    ⟹ structurantes (une-pièce ou bas) : ${structurant} — les seules qui ouvrent le palier.`);
    }
  }, 900_000);
});
