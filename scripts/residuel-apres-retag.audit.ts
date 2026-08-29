import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor, styleFit } from "../src/lib/capsule";
import { formalityOf } from "../src/lib/attributes";
import { CLOTHING_CATS, TOP_LAYER_CATS, generateOutfitWithFallback } from "../src/lib/logic";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey, Season } from "../src/lib/types";
import { STYLE_ID_TO_CATALOG_LABEL, type StyleId } from "../src/lib/profile";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE P0 · RÉPARTITION DES CELLULES RÉSIDUELLES APRÈS RETAG. LECTURE SEULE.
//
// C'est la mesure nommée comme manquante à l'arbitrage : sans elle, aucun
// volume de création n'est dimensionnable, et la répartition des 5 cellules
// evenement_perso résiduelles restait explicitement NON VÉRIFIÉE.
//
// Trois choses, séparément et jamais confondues :
//   · festive et evenement_perso mesurées SÉPARÉMENT — les mesures
//     précédentes les confondaient dans « éligible à l'une OU l'autre » ;
//   · la grille complète 4 saisons × 8 styles, nommée cellule par cellule ;
//   · la chaîne à trois niveaux — candidat au pool, retenu par la sélection,
//     produisant une tenue F4 complète — car seul le troisième niveau compte.
//
// Le retag porte sur les QUATRE pièces démontrées. #100891 en est exclue :
// elle n'entre dans aucune capsule, son retag est sans effet.
//
// RETAG SIMULÉ EN MÉMOIRE. AUCUN UPDATE. Aucune création, aucun volume proposé.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCC4: OccasionKey[] = ["festive", "evenement_perso"];
const OCC3: OccasionKey[] = ["travail_formel", "entretien", "soiree"];
const UNEPIECE: CategoryKey[] = ["robe", "combinaison"];
const TIRAGES = 20;
/** Les quatre retags démontrés, et l'ensemble d'occasions arrêté à l'arbitrage. */
const RETAG_IDS = new Set([101038, 100801, 100855, 100993]);
const RETAG_OCC: OccasionKey[] = ["quotidien", "travail_formel", "entretien", "soiree", "date", "evenement_perso"];

function passeRB3(it: Item, occ: OccasionKey, min: number): boolean {
  return (
    !CLOTHING_CATS.includes(it.cat) ||
    Boolean(it.occasion && it.occasion.includes(occ)) ||
    (TOP_LAYER_CATS.includes(it.cat) && formalityOf(it) > 0) ||
    formalityOf(it) >= min
  );
}

describe("P0 — cellules résiduelles après retag", () => {
  it("répartit style × saison, festive et evenement_perso séparément", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    const simule: CatalogItem[] = pool.map((it) => (RETAG_IDS.has(it.id) ? { ...it, occasion: [...RETAG_OCC] } : it));
    console.log(`\nRetag simulé sur ${RETAG_IDS.size} pièces : ${[...RETAG_IDS].join(", ")}`);
    console.log(`Occasions écrites : ${RETAG_OCC.join(", ")}`);

    const capsule = (saison: CapsuleSeason, style: StyleId, src: CatalogItem[]) =>
      computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, src);

    const replie = (caps: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, occ: OccasionKey, s: CapsuleSeason) => {
      for (let k = 0; k < TIRAGES; k++) {
        const r = generateOutfitWithFallback(caps, w, occ, "Présentiel", "Verre", [], "femme", s);
        if (r.ids.length && !r.formalityDowngraded) return false;
      }
      return true;
    };

    // ═══ 1 · GRILLE COMPLÈTE, PAR OCCASION DE PALIER 4 ═══
    const residuelles: { occ: OccasionKey; saison: CapsuleSeason; style: StyleId }[] = [];
    for (const occ of OCC4) {
      console.log(`\n════════ 1 · ${occ.toUpperCase()} — REPLI APRÈS RETAG (× = replie) ════════`);
      console.log(`  ${"saison".padEnd(11)}${STYLES_FEMME.map((s) => s.slice(0, 9).padStart(11)).join("")}${"total".padStart(9)}`);
      let total = 0;
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        const ligne = STYLES_FEMME.map((style) => {
          const r = replie(capsule(saison, style, simule), w, occ, saison);
          if (r) { total += 1; residuelles.push({ occ, saison, style }); }
          return r ? "×" : "·";
        });
        console.log(`  ${saison.padEnd(11)}${ligne.map((c) => c.padStart(11)).join("")}${String(ligne.filter((c) => c === "×").length).padStart(9)}`);
      }
      console.log(`  ⟹ ${total} cellules sur 32 replient encore.`);
    }

    // ═══ 2 · LES CELLULES RÉSIDUELLES, NOMMÉES ═══
    console.log(`\n════════ 2 · CELLULES RÉSIDUELLES, NOMMÉES ════════`);
    for (const occ of OCC4) {
      const l = residuelles.filter((r) => r.occ === occ);
      console.log(`\n  ${occ} — ${l.length} cellules :`);
      const parStyle = new Map<string, CapsuleSeason[]>();
      for (const r of l) parStyle.set(r.style, [...(parStyle.get(r.style) ?? []), r.saison]);
      for (const [style, saisons] of parStyle) {
        console.log(`    ${style.padEnd(16)}${saisons.length === 4 ? "les 4 saisons" : saisons.join(", ")}`);
      }
      if (!l.length) console.log(`    aucune.`);
    }

    // ═══ 3 · OÙ LA CHAÎNE CASSE, CELLULE PAR CELLULE ═══
    console.log(`\n════════ 3 · OÙ LA CHAÎNE CASSE, POUR CHAQUE CELLULE RÉSIDUELLE ════════`);
    console.log(`  N1 = une-pièces du CATALOGUE éligibles au palier 4 pour cette occasion,`);
    console.log(`       passant le filtre de style, le bucket de la capsule et les bornes de`);
    console.log(`       température. N2 = combien d'entre elles la SÉLECTION retient.`);
    console.log(`  N1 = 0 ⟹ la création est la seule issue.`);
    console.log(`  N1 > 0 et N2 = 0 ⟹ c'est la sélection, pas le catalogue.`);
    console.log(`  ${"occasion".padEnd(18)}${"saison".padEnd(11)}${"style".padEnd(16)}${"N1".padStart(5)}${"N2".padStart(5)}${"verdict".padStart(14)}`);
    for (const r of residuelles) {
      const w = representativeWeatherFor(r.saison);
      const bucket: Season[] = [capsuleSeasonBucket(r.saison), "Toutes saisons"];
      const label = STYLE_ID_TO_CATALOG_LABEL[r.style];
      const eligible = (it: CatalogItem) =>
        UNEPIECE.includes(it.cat) &&
        styleFit(it, label) &&
        bucket.includes(it.season) &&
        passeRB3(it, r.occ, 4) &&
        (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
        (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp);
      const n1 = simule.filter(eligible).length;
      const caps = capsule(r.saison, r.style, simule);
      const n2 = caps.filter(eligible).length;
      const verdict = n1 === 0 ? "CATALOGUE" : n2 === 0 ? "SÉLECTION" : "AUTRE";
      console.log(`  ${r.occ.padEnd(18)}${r.saison.padEnd(11)}${r.style.padEnd(16)}${String(n1).padStart(5)}${String(n2).padStart(5)}${verdict.padStart(14)}`);
    }
    const parVerdict = new Map<string, number>();
    for (const r of residuelles) {
      const w = representativeWeatherFor(r.saison);
      const bucket: Season[] = [capsuleSeasonBucket(r.saison), "Toutes saisons"];
      const label = STYLE_ID_TO_CATALOG_LABEL[r.style];
      const n1 = simule.filter((it) =>
        UNEPIECE.includes(it.cat) && styleFit(it, label) && bucket.includes(it.season) && passeRB3(it, r.occ, 4) &&
        (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) && (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp)).length;
      const k = n1 === 0 ? "CATALOGUE" : "AUTRE";
      parVerdict.set(k, (parVerdict.get(k) ?? 0) + 1);
    }
    console.log(`\n  Synthèse : ${[...parVerdict.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")} sur ${residuelles.length} cellules.`);

    // ═══ 4 · OCCASIONS DE FORMALITÉ 3 APRÈS RETAG ═══
    console.log(`\n════════ 4 · FORMALITÉ 3 APRÈS RETAG (le retag les déclare aussi) ════════`);
    console.log(`  ${"occasion".padEnd(18)}${"sans retag".padStart(12)}${"avec retag".padStart(12)}${"écart".padStart(9)}`);
    for (const occ of OCC3) {
      let sans = 0, avec = 0;
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES_FEMME) {
          if (replie(capsule(saison, style, pool), w, occ, saison)) sans += 1;
          if (replie(capsule(saison, style, simule), w, occ, saison)) avec += 1;
        }
      }
      console.log(`  ${occ.padEnd(18)}${(sans + "/32").padStart(12)}${(avec + "/32").padStart(12)}${String(sans - avec).padStart(9)}`);
    }
    console.log(`\n  LECTURE SEULE. Retag simulé en mémoire, aucun UPDATE, aucune création.`);
  }, 900_000);
});
