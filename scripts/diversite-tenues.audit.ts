import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor, weatherSeasonBucket } from "../src/lib/capsule";
import { generateOutfitWithFallback, getOutfitsForItem } from "../src/lib/logic";
import { OCCASIONS, type Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey, Season } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE P0 · DIVERSITÉ DES TENUES, AVANT ET APRÈS CORRECTIF. LECTURE SEULE.
//
// L'audit d'exposition a établi que le défaut ne faisait perdre AUCUNE tenue :
// 100 % de réussite dans les trois référentiels. Son coût annoncé était donc
// la DIVERSITÉ — le seul coût encore non chiffré. C'est ce que cet audit
// mesure, sans supposer d'avance qu'il est important.
//
// Deux mesures, parce qu'elles ne disent pas la même chose :
//
//   §2 le moteur générique — nombre de tenues DISTINCTES et part de la
//      capsule réellement utilisée, sur les 320 couples saison × style ×
//      occasion. Mesure interne, comparable d'un référentiel à l'autre.
//
//   §3 l'écran réel — getOutfitsForItem, dont la longueur du tableau EST
//      littéralement « combien de façons de porter cette pièce » affichées
//      à l'utilisatrice. C'est la seule métrique qu'elle voit.
//
// Trois référentiels, comme pour l'exposition :
//   A météo réelle (store.tsx, 1 ou 2 buckets) — avant, sur les sites météo
//   B representativeWeatherFor (1 bucket) — avant, sur « Comment porter »
//   C bucket de la capsule — après correctif

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const TIRAGES = 100;
const REPETITIONS = 3;
const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";

/** Météo réelle, reproduite à l'identique de store.tsx (correctif 23/08/2026). */
function meteoReelle(temp: number, saisonCalendaire: CapsuleSeason): Weather {
  const season = weatherSeasonBucket(temp);
  const calendarBucket = capsuleSeasonBucket(saisonCalendaire);
  const seasons: Season[] =
    calendarBucket === season ? [season, "Toutes saisons"] : [season, calendarBucket, "Toutes saisons"];
  return { season, temp, label: temp < 10 ? "Froid" : temp < 20 ? "Doux" : "Chaud", seasons };
}

describe("P0 — diversité des tenues", () => {
  it("chiffre le seul coût du défaut qui restait non mesuré", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    const capsules = new Map<string, CatalogItem[]>();
    for (const saison of CAPSULE_SEASONS) {
      for (const style of STYLES_FEMME) {
        capsules.set(`${saison}|${style}`, computeDefaultCapsule(
          profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, pool));
      }
    }

    // ═══ 1 · PLANCHER DE BRUIT ═══
    console.log(`\n════════ 1 · PLANCHER DE BRUIT (${REPETITIONS} répétitions × ${TIRAGES} tirages) ════════`);
    console.log(`  La génération est stochastique : tout écart inférieur à la dispersion ci-dessous`);
    console.log(`  n'est pas un effet du correctif.`);

    // ═══ 2 · MOTEUR GÉNÉRIQUE — TENUES DISTINCTES ET COUVERTURE DE LA CAPSULE ═══
    type Mesure = { distinctes: number[]; utilisees: number[]; taille: number };
    const mesurer = (capsule: CatalogItem[], w: Weather, s: CapsuleSeason | null): Mesure => {
      const distinctes: number[] = [], utilisees: number[] = [];
      for (let r = 0; r < REPETITIONS; r++) {
        const sig = new Set<string>(); const vues = new Set<number>();
        for (const occ of OCCS) {
          for (let k = 0; k < TIRAGES / OCCS.length * 10; k++) {
            const res = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", s);
            if (!res.ids.length) continue;
            sig.add(occ + ":" + [...res.ids].sort((a, b) => a - b).join("-"));
            res.ids.forEach((id) => vues.add(id));
          }
        }
        distinctes.push(sig.size); utilisees.push(vues.size);
      }
      return { distinctes, utilisees, taille: capsule.length };
    };

    console.log(`\n════════ 2 · MOTEUR GÉNÉRIQUE — TENUES DISTINCTES ET CAPSULE UTILISÉE ════════`);
    console.log(`  ${"saison".padEnd(11)}${"réf.".padEnd(6)}${"tenues distinctes".padStart(19)}${"± écart".padStart(9)}${"pièces utilisées".padStart(18)}${"/ capsule".padStart(11)}`);
    for (const saison of CAPSULE_SEASONS) {
      const wA = meteoReelle(16, saison);
      const wB = representativeWeatherFor(saison);
      const refs: [string, Weather, CapsuleSeason | null][] = [["A", wA, null], ["B", wB, null], ["C", wB, saison]];
      for (const [nom, w, s] of refs) {
        let dist = 0, uti = 0, taille = 0, ecart = 0;
        for (const style of STYLES_FEMME) {
          const m = mesurer(capsules.get(`${saison}|${style}`)!, w, s);
          dist += moy(m.distinctes); uti += moy(m.utilisees); taille += m.taille;
          ecart += Math.max(...m.distinctes) - Math.min(...m.distinctes);
        }
        const n = STYLES_FEMME.length;
        console.log(`  ${saison.padEnd(11)}${nom.padEnd(6)}${(dist / n).toFixed(1).padStart(19)}${(ecart / n).toFixed(1).padStart(9)}` +
          `${(uti / n).toFixed(1).padStart(18)}${pct(uti, taille).padStart(11)}`);
      }
    }

    // ═══ 3 · L'ÉCRAN RÉEL — « COMMENT PORTER CETTE PIÈCE ? » ═══
    console.log(`\n════════ 3 · ÉCRAN « COMMENT PORTER CETTE PIÈCE ? » (getOutfitsForItem) ════════`);
    console.log(`  La longueur du tableau EST le nombre de façons affichées à l'utilisatrice.`);
    console.log(`  Pivots : toutes les pièces vêtement de la capsule, saison par saison.`);
    console.log(`  ${"saison".padEnd(11)}${"pivots".padStart(8)}${"avant (B)".padStart(11)}${"après (C)".padStart(11)}${"écart".padStart(9)}${"pivots gagnants".padStart(17)}${"pivots perdants".padStart(17)}`);
    const CLOTHING = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      let n = 0, avant = 0, apres = 0, gagnants = 0, perdants = 0;
      for (const style of STYLES_FEMME) {
        const capsule = capsules.get(`${saison}|${style}`)!;
        for (const pivot of capsule.filter((it) => CLOTHING.includes(it.cat))) {
          const a = getOutfitsForItem(pivot.id, capsule, w, [], {}, "femme").length;
          const b = getOutfitsForItem(pivot.id, capsule, w, [], {}, "femme", saison).length;
          n += 1; avant += a; apres += b;
          if (b > a) gagnants += 1; else if (b < a) perdants += 1;
        }
      }
      console.log(`  ${saison.padEnd(11)}${String(n).padStart(8)}${(avant / n).toFixed(2).padStart(11)}${(apres / n).toFixed(2).padStart(11)}` +
        `${(((apres - avant) / n)).toFixed(2).padStart(9)}${(gagnants + "/" + n).padStart(17)}${(perdants + "/" + n).padStart(17)}`);
    }

    // ═══ 4 · LES PIÈCES QUI ÉTAIENT INVISIBLES ═══
    console.log(`\n════════ 4 · PIÈCES DE LA CAPSULE JAMAIS TIRÉES, AVANT ET APRÈS ════════`);
    console.log(`  Une pièce présente dans la capsule mais jamais retenue dans aucune tenue est`);
    console.log(`  une suggestion morte : affichée sur l'écran Capsule, inatteignable en tenue.`);
    console.log(`  ${"saison".padEnd(11)}${"capsule".padStart(9)}${"mortes avant (B)".padStart(18)}${"mortes après (C)".padStart(18)}${"ressuscitées".padStart(14)}`);
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      let taille = 0, mortesB = 0, mortesC = 0;
      for (const style of STYLES_FEMME) {
        const capsule = capsules.get(`${saison}|${style}`)!;
        taille += capsule.length;
        for (const [s, cible] of [[null, "B"], [saison, "C"]] as [CapsuleSeason | null, string][]) {
          const vues = new Set<number>();
          for (const occ of OCCS) {
            for (let k = 0; k < 60; k++) {
              generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", s).ids.forEach((id) => vues.add(id));
            }
          }
          const mortes = capsule.filter((it) => !vues.has(it.id)).length;
          if (cible === "B") mortesB += mortes; else mortesC += mortes;
        }
      }
      const n = STYLES_FEMME.length;
      console.log(`  ${saison.padEnd(11)}${(taille / n).toFixed(1).padStart(9)}${((mortesB / n).toFixed(1) + ` (${pct(mortesB, taille)})`).padStart(18)}` +
        `${((mortesC / n).toFixed(1) + ` (${pct(mortesC, taille)})`).padStart(18)}${((mortesB - mortesC) / n).toFixed(1).padStart(14)}`);
    }
    console.log(`\n  LECTURE SEULE. Aucune écriture, aucun retag, aucune modification.`);
  }, 900_000);
});
