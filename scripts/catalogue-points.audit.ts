import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { type CatalogItem } from "../src/lib/catalog";
import { CHALEUR_HORS_SAISON, computeDefaultCapsule, saisonCapsuleDuJour, weatherForDay } from "../src/lib/capsule";
import { CATS, OCCASIONS, type Weather } from "../src/lib/data";
import { CHAUSSURES_OUVERTES, generateOutfitWithFallback } from "../src/lib/logic";
import { composeWardrobePool } from "../src/lib/selectors";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";

// DEUX POINTS DE DONNÉES DU CATALOGUE — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE.
//
// 1. PLANCHER DES CHAUSSURES OUVERTES : les pièces de CHAUSSURES_OUVERTES sans
//    meteo_min_temp reçoivent 16° (la valeur de leurs voisines, 15 à 17°).
// 2. BLAZERS EN LIN « Toutes saisons » : restreints à Printemps / Été.
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : catalogue RÉEL, profils femme,
// tous les styles, toutes les occasions, graines identiques pour tous les bras,
// dressing vide (capsule seule). Leviers : « plancher » et « lin », seuls puis
// ensemble. Aucune extrapolation au dressing réel (point 4).
//
// « ouvertes sans plancher » : tenues portant une chaussure ouverte sans borne
// basse dans le catalogue. « blazer lin » : tenues portant un blazer en lin
// dont la saison déclarée est « Toutes saisons ». « cellules » : couples
// style × occasion couverts — ne doit pas baisser.

const N = Number(process.env.TIRAGES ?? 6);
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const CAT_KEYS: CategoryKey[] = CATS.map(([k]) => k);
const PLANCHER = 16;
const JOURNEES: { calendaire: CapsuleSeason; temp: number }[] = [
  ...[8, 12, 15, 18, 21].map((temp) => ({ calendaire: "Automne" as CapsuleSeason, temp })),
  { calendaire: "Hiver", temp: 5 },
  { calendaire: "Printemps", temp: 12 },
  { calendaire: "Printemps", temp: 15 },
  { calendaire: "Printemps", temp: 18 },
  { calendaire: "Été", temp: 28 },
];
const label = (t: number) => (t >= 23 ? "Ensoleillé" : "Nuageux");

const ouverte = (p: Item) => p.cat === "chaussures" && !!p.shoeType && CHAUSSURES_OUVERTES.includes(p.shoeType);
const blazerLin = (p: Item) => p.cat === "veste" && /lin\b/i.test(`${p.name} ${p.matiere ?? ""}`);

function variante(base: CatalogItem[], plancher: boolean, lin: boolean): CatalogItem[] {
  return base.map((p) => {
    if (plancher && ouverte(p) && p.meteoMinTemp == null) return { ...p, meteoMinTemp: PLANCHER };
    if (lin && blazerLin(p) && p.season === "Toutes saisons") return { ...p, season: "Printemps / Été", saisons: ["Printemps", "Été"] } as CatalogItem;
    return p;
  });
}

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function graine(cle: string): number {
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function tirer<T>(cle: string, f: () => T): T {
  const vrai = Math.random;
  Math.random = mulberry32(graine(cle));
  try { return f(); } finally { Math.random = vrai; }
}

const pct = (n: number, t: number) => (t ? `${((n / t) * 100).toFixed(0)} %` : "—");

describe("plancher des chaussures ouvertes et blazers en lin", () => {
  it("mesure les bras dans la même exécution", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const cle = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !cle) throw new Error("Supabase non configuré : audit impossible");
    const { data, error } = await createClient(url, cle).from("vestiaire_universel").select("*").order("id").returns<VestiaireRow[]>();
    if (error || !data?.length) throw new Error(`Lecture impossible : ${error?.message ?? "vide"}`);
    const base = data.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true).map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    console.log(`CONFIGURATION GELÉE : catalogue RÉEL (vestiaire_universel), ${base.length} pièces, ${STYLES_FEMME.length} styles femme, ${OCCS.length} occasions, ${N} tirages, graines identiques.`);
    console.log(`Concernées : ${base.filter((p) => ouverte(p) && p.meteoMinTemp == null).length} chaussures ouvertes sans plancher ; ${base.filter((p) => blazerLin(p) && p.season === "Toutes saisons").length} blazers/vestes en lin « Toutes saisons ».`);
    const BRAS = [
      { nom: "base", p: false, l: false },
      { nom: "plancher", p: true, l: false },
      { nom: "lin", p: false, l: true },
      { nom: "les deux", p: true, l: true },
    ];
    for (const j of JOURNEES) {
      console.log(`\n── ${j.calendaire}, ${j.temp}° ──`);
      console.log(`${"bras".padEnd(10)}${"tenues".padStart(7)}${"cellules".padStart(10)}${"ouvertes s/ plancher".padStart(22)}${"blazer lin".padStart(12)}`);
      const w: Weather = weatherForDay(j.temp, label(j.temp), j.calendaire, CHALEUR_HORS_SAISON);
      const vivier = saisonCapsuleDuJour(j.temp, j.calendaire);
      for (const b of BRAS) {
        const cat = variante(base, b.p, b.l);
        let tenues = 0, cellules = 0, ouv = 0, lin = 0;
        for (const style of STYLES_FEMME) {
          const profil = profilAudit({ gender: "femme", styles: [style] });
          const capsule = computeDefaultCapsule(profil, w, [], vivier, cat);
          const index = new Map<number, Item>(capsule.map((p) => [p.id, p]));
          // Les marqueurs se lisent sur le catalogue de BASE : le bras « plancher » les a modifiés.
          const origine = new Map<number, CatalogItem>(base.map((p) => [p.id, p]));
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const gen = composeWardrobePool(capsule, capsule, CAT_KEYS, { completerPourOccasion: occ, saison: w, exclureHorsOccasion: true });
              const ids = tirer(`${style}|${occ}|${k}`, () => generateOutfitWithFallback(gen, w, occ, "Présentiel", "Verre", [], "femme", null).ids);
              if (!ids.length) continue;
              couverte = true; tenues += 1;
              const pieces = ids.map((id) => origine.get(id) ?? index.get(id)).filter((p): p is Item => Boolean(p));
              if (pieces.some((p) => ouverte(p) && p.meteoMinTemp == null)) ouv += 1;
              if (pieces.some((p) => blazerLin(p) && p.season === "Toutes saisons")) lin += 1;
            }
            if (couverte) cellules += 1;
          }
        }
        console.log(`${b.nom.padEnd(10)}${String(tenues).padStart(7)}${String(cellules).padStart(10)}${(String(ouv) + " (" + pct(ouv, tenues) + ")").padStart(22)}${(String(lin) + " (" + pct(lin, tenues) + ")").padStart(12)}`);
      }
    }
  }, 1_800_000);
});
