import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { type CatalogItem } from "../src/lib/catalog";
import { CHALEUR_HORS_SAISON, computeDefaultCapsule, STRATEGIE_PRODUCTION, weatherForDay, type SelectionStrategy } from "../src/lib/capsule";
import { CATS, OCCASIONS } from "../src/lib/data";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { composeWardrobePool } from "../src/lib/selectors";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";

// LE MANTEAU D'AUTOMNE-HIVER DANS UNE CAPSULE ÉTÉ — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE.
//
// SIGNALÉ LE 01/10/2026 : « le manteau cape structuré apparaît dans une capsule
// été » (étiqueté Suggestion). Cause : le filet ensure("manteau") puise dans le
// catalogue non filtré par saison dès qu'aucun manteau de saison n'est retenu.
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : catalogue RÉEL, profils femme, 8
// styles, capsule Été, météo du jour 28° puis 20°, aucune exclusion puis 1, 2 et
// 3 remplacements successifs du manteau (chemin « Remplacer » de l'écran
// Capsule), mêmes tirages. Un seul levier : `manteauHorsSaisonEte`
// (« avant » = "admis", « après » = production). Aucune extrapolation à un
// dressing réel (point 4).
//
// « manteau A/H » : capsules contenant un manteau déclaré Automne / Hiver.
// « sans manteau » : capsules sans aucun manteau. « cellules » : couples style ×
// occasion couverts par au moins une tenue — ne doit pas baisser.

const N = Number(process.env.TIRAGES ?? 6);
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const CAT_KEYS: CategoryKey[] = CATS.map(([k]) => k);
const BRAS: { nom: string; s: SelectionStrategy }[] = [
  { nom: "avant", s: { ...STRATEGIE_PRODUCTION, manteauHorsSaisonEte: "admis" } },
  { nom: "après", s: STRATEGIE_PRODUCTION },
];
function mulberry32(a: number): () => number {
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function graine(c: string): number { let h = 2166136261; for (let i = 0; i < c.length; i++) { h ^= c.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function tirer<T>(c: string, f: () => T): T { const v = Math.random; Math.random = mulberry32(graine(c)); try { return f(); } finally { Math.random = v; } }

describe("manteau d'automne-hiver en capsule Été", () => {
  it("mesure avant et après dans la même exécution", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const cle = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !cle) throw new Error("Supabase non configuré");
    const { data, error } = await createClient(url, cle).from("vestiaire_universel").select("*").order("id").returns<VestiaireRow[]>();
    if (error || !data?.length) throw new Error(`Lecture impossible : ${error?.message ?? "vide"}`);
    const cat = data.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true).map(rowToCatalogItem).filter((x): x is CatalogItem => Boolean(x));
    console.log(`CONFIGURATION GELÉE : catalogue RÉEL, ${cat.length} pièces, ${STYLES_FEMME.length} styles femme, capsule Été, ${N} tirages, graines identiques.`);
    for (const temp of [28, 20]) {
      const w = weatherForDay(temp, "Ensoleillé", "Été", CHALEUR_HORS_SAISON);
      for (const depth of [0, 1, 2, 3]) {
        const ligne: string[] = [];
        for (const b of BRAS) {
          let capsules = 0, ah = 0, sans = 0, cellules = 0, tenues = 0;
          for (const style of STYLES_FEMME) {
            const prof = profilAudit({ gender: "femme", styles: [style] });
            const exclus: number[] = [];
            let capsule = computeDefaultCapsule(prof, w, exclus, "Été", cat, b.s);
            for (let k = 0; k < depth; k++) { const m = capsule.find((p) => p.cat === "manteau"); if (!m) break; exclus.push(m.id); capsule = computeDefaultCapsule(prof, w, exclus, "Été", cat, b.s); }
            capsules += 1;
            const manteaux = capsule.filter((p) => p.cat === "manteau");
            if (!manteaux.length) sans += 1;
            if (manteaux.some((p) => p.season === "Automne / Hiver")) ah += 1;
            for (const occ of OCCS) {
              let ok = false;
              for (let k = 0; k < N; k++) {
                const gen = composeWardrobePool(capsule, capsule, CAT_KEYS, { completerPourOccasion: occ, saison: w, exclureHorsOccasion: true });
                const ids = tirer(`${style}|${occ}|${k}`, () => generateOutfitWithFallback(gen, w, occ, "Présentiel", "Verre", [], "femme", null).ids);
                if (ids.length) { ok = true; tenues += 1; }
              }
              if (ok) cellules += 1;
            }
          }
          ligne.push(`${b.nom}: manteau A/H ${ah}/${capsules} · sans manteau ${sans}/${capsules} · tenues ${tenues} · cellules ${cellules}`);
        }
        console.log(`Été, météo ${temp}°, ${depth} remplacement(s) | ${ligne.join("   ||   ")}`);
      }
    }
  }, 1_800_000);
});
