import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import {
  CAPSULE_SEASONS, capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor, weatherSeasonBucket,
} from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS, type Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey, Season } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE P0 · EXPOSITION RÉELLE EN FONCTION DE LA TEMPÉRATURE. LECTURE SEULE.
//
// CE QUE CET AUDIT EXISTE POUR VÉRIFIER, ET QUI M'AVAIT ÉCHAPPÉ :
//
// store.tsx (correctif du 23/08/2026) construit la météo réelle avec DEUX
// buckets quand ils divergent :
//   const season = weatherSeasonBucket(geoCity.temp);
//   const calendarBucket = capsuleSeasonBucket(currentSeasonKey());
//   seasons = calendarBucket === season ? [season, "Toutes saisons"]
//                                       : [season, calendarBucket, "Toutes saisons"];
// La tenue du jour n'est donc PAS exposée au défaut : son commentaire décrit
// déjà le problème et le résout. Mon rapport P0 affirmait le contraire.
//
// En revanche representativeWeatherFor n'a jamais reçu ce correctif : elle ne
// pose qu'un seul bucket, dérivé de la température. C'est le seul site
// réellement défaillant — « Comment porter cette pièce ? ».
//
// ET UNE QUESTION QUE JE DOIS À MA PROPRE CORRECTION : sur les sites qui
// utilisent la météo RÉELLE à deux buckets (viewExploredOutfit,
// findCompatibleStyles), filtrer désormais sur le seul bucket de la capsule
// est-il plus RESTRICTIF qu'avant ? Si oui, j'ai introduit une régression.
//
// Trois référentiels sont donc comparés, à chaque température :
//   A — météo réelle telle que store.tsx la construit (1 ou 2 buckets)
//   B — representativeWeatherFor (1 bucket, dérivé de la température)
//   C — bucket de la capsule seul (comportement après mon correctif)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEMPS = [-5, 0, 5, 10, 14, 16, 18, 19, 20, 22, 24, 28, 33];
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const TIRAGES = 6;
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";

/** Météo réelle, reproduite à l'identique de store.tsx (correctif 23/08/2026). */
function meteoReelle(temp: number, saisonCalendaire: CapsuleSeason): Weather {
  const season = weatherSeasonBucket(temp);
  const calendarBucket = capsuleSeasonBucket(saisonCalendaire);
  const seasons: Season[] =
    calendarBucket === season ? [season, "Toutes saisons"] : [season, calendarBucket, "Toutes saisons"];
  return { season, temp, label: temp < 10 ? "Froid" : temp < 20 ? "Doux" : "Chaud", seasons };
}

const retenues = (capsule: CatalogItem[], seasons: readonly Season[]) => capsule.filter((it) => seasons.includes(it.season));

describe("P0 — exposition en fonction de la température", () => {
  it("mesure les trois référentiels et cherche une régression de mon correctif", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    // ═══ 1 · COMPOSITION DES CAPSULES — CE QUE CHAQUE BUCKET PEUT COÛTER ═══
    console.log(`\n════════ 1 · COMPOSITION SAISONNIÈRE DES CAPSULES ════════`);
    console.log(`  La perte maximale d'un référentiel à un seul bucket est la part de pièces`);
    console.log(`  portant l'AUTRE bucket. Les « Toutes saisons » ne sont jamais perdues.`);
    console.log(`  ${"saison".padEnd(11)}${"capsule".padStart(9)}${"P/É".padStart(8)}${"A/H".padStart(8)}${"tt sais.".padStart(10)}${"perte max".padStart(11)}`);
    const capsules = new Map<string, CatalogItem[]>();
    for (const saison of CAPSULE_SEASONS) {
      let tot = 0, pe = 0, ah = 0, ts = 0;
      for (const style of STYLES_FEMME) {
        // Capsule bâtie avec la météo représentative, comme en production.
        const c = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, pool);
        capsules.set(`${saison}|${style}`, c);
        tot += c.length;
        pe += c.filter((it) => it.season === "Printemps / Été").length;
        ah += c.filter((it) => it.season === "Automne / Hiver").length;
        ts += c.filter((it) => it.season === "Toutes saisons").length;
      }
      const propre = capsuleSeasonBucket(saison) === "Printemps / Été" ? pe : ah;
      console.log(`  ${saison.padEnd(11)}${(tot / 8).toFixed(1).padStart(9)}${(pe / 8).toFixed(1).padStart(8)}${(ah / 8).toFixed(1).padStart(8)}${(ts / 8).toFixed(1).padStart(10)}${pct(propre, tot).padStart(11)}`);
    }

    // ═══ 2 · PART DE CAPSULE RETENUE, PAR TEMPÉRATURE ET PAR RÉFÉRENTIEL ═══
    console.log(`\n════════ 2 · PART DE CAPSULE RETENUE PAR LE FILTRE SAISON ════════`);
    console.log(`  A = météo réelle (store.tsx, 1 ou 2 buckets) · B = representativeWeatherFor`);
    console.log(`  C = bucket de la capsule (après correctif). Saison calendaire = saison affichée.`);
    for (const saison of CAPSULE_SEASONS) {
      console.log(`\n  ── capsule ${saison} (bucket ${capsuleSeasonBucket(saison)}) ──`);
      console.log(`     ${"temp".padStart(6)}${"A météo réelle".padStart(17)}${"B repr.".padStart(11)}${"C capsule".padStart(12)}${"B → C".padStart(9)}${"A → C".padStart(9)}`);
      for (const temp of TEMPS) {
        const wA = meteoReelle(temp, saison);
        const wB = representativeWeatherFor(saison);
        const bucketC: Season[] = [capsuleSeasonBucket(saison), "Toutes saisons"];
        let tot = 0, a = 0, b = 0, c = 0;
        for (const style of STYLES_FEMME) {
          const caps = capsules.get(`${saison}|${style}`)!;
          tot += caps.length;
          a += retenues(caps, wA.seasons).length;
          b += retenues(caps, wB.seasons).length;
          c += retenues(caps, bucketC).length;
        }
        const flag = a > c ? "  ← C plus restrictif" : "";
        console.log(`     ${String(temp).padStart(6)}${pct(a, tot).padStart(17)}${pct(b, tot).padStart(11)}${pct(c, tot).padStart(12)}` +
          `${(((c - b) / tot) * 100).toFixed(1).padStart(8)}%${(((c - a) / tot) * 100).toFixed(1).padStart(8)}%${flag}`);
      }
    }

    // ═══ 3 · SAISON PARCOURUE ≠ SAISON CALENDAIRE ═══
    console.log(`\n════════ 3 · QUAND L'UTILISATRICE PARCOURT UNE AUTRE SAISON ════════`);
    console.log(`  viewExploredOutfit et findCompatibleStyles utilisent la météo RÉELLE, dont le`);
    console.log(`  bucket calendaire vient de currentSeasonKey() — pas de la saison parcourue.`);
    console.log(`  ${"capsule".padEnd(11)}${"calendrier".padEnd(11)}${"temp".padStart(6)}${"A météo réelle".padStart(17)}${"C capsule".padStart(12)}${"écart".padStart(9)}`);
    for (const saison of CAPSULE_SEASONS) {
      for (const calendrier of CAPSULE_SEASONS) {
        if (capsuleSeasonBucket(calendrier) === capsuleSeasonBucket(saison)) continue;
        for (const temp of [6, 16, 24]) {
          const wA = meteoReelle(temp, calendrier);
          const bucketC: Season[] = [capsuleSeasonBucket(saison), "Toutes saisons"];
          let tot = 0, a = 0, c = 0;
          for (const style of STYLES_FEMME) {
            const caps = capsules.get(`${saison}|${style}`)!;
            tot += caps.length; a += retenues(caps, wA.seasons).length; c += retenues(caps, bucketC).length;
          }
          console.log(`  ${saison.padEnd(11)}${calendrier.padEnd(11)}${String(temp).padStart(6)}${pct(a, tot).padStart(17)}${pct(c, tot).padStart(12)}${(((c - a) / tot) * 100).toFixed(1).padStart(8)}%`);
        }
        break;
      }
    }

    // ═══ 4 · EFFET SUR LES TENUES, PAS SEULEMENT SUR LE POOL ═══
    console.log(`\n════════ 4 · EFFET SUR LES TENUES RÉELLEMENT PRODUITES ════════`);
    console.log(`  Part des couples occasion × style produisant une tenue complète, par référentiel.`);
    console.log(`  ${"saison".padEnd(11)}${"temp".padStart(6)}${"A météo réelle".padStart(17)}${"B repr.".padStart(11)}${"C capsule".padStart(12)}`);
    for (const saison of CAPSULE_SEASONS) {
      for (const temp of [6, 16, 24]) {
        const wA = meteoReelle(temp, saison);
        const wB = representativeWeatherFor(saison);
        let n = 0, a = 0, b = 0, c = 0;
        for (const style of STYLES_FEMME) {
          const caps = capsules.get(`${saison}|${style}`)!;
          for (const occ of OCCS) {
            n += 1;
            const essai = (w: Weather, s: CapsuleSeason | null) => {
              for (let k = 0; k < TIRAGES; k++) {
                if (!generateOutfitWithFallback(caps, w, occ, "Présentiel", "Verre", [], "femme", s).noCompleteOutfit) return 1;
              }
              return 0;
            };
            a += essai(wA, null);
            b += essai(wB, null);
            c += essai(wB, saison);
          }
        }
        console.log(`  ${saison.padEnd(11)}${String(temp).padStart(6)}${pct(a, n).padStart(17)}${pct(b, n).padStart(11)}${pct(c, n).padStart(12)}`);
      }
    }
    console.log(`\n  LECTURE SEULE. Aucune écriture, aucun retag, aucune modification.`);
  }, 900_000);
});
