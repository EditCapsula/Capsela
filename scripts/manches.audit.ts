import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CATALOG, type CatalogItem } from "../src/lib/catalog";
import {
  CHALEUR_HORS_SAISON,
  computeDefaultCapsule,
  saisonCapsuleDuJour,
  weatherForDay,
} from "../src/lib/capsule";
import { CATS, OCCASIONS, type Weather } from "../src/lib/data";
import { brasNus } from "../src/lib/manches";
import { generateOutfitWithFallback, violatesOuterwearRule, type LeviersMesure } from "../src/lib/logic";
import { composeWardrobePool } from "../src/lib/selectors";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";

// LA LONGUEUR DES MANCHES — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE.
//
// DEMANDÉ LE 01/10/2026 : « ajouter la notion de manches longues ». Item.manches
// (migration 0042) est lue en trois endroits : la veste par temps frais n'est
// plus forcée sur un haut à manches longues ; ce haut est préféré sous
// SEUIL_SOIREE_FRAICHE ; il compte parmi les pièces clés d'automne-hiver.
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : profils d'audit femme, tous les
// styles, toutes les occasions, graines déterministes identiques pour les deux
// bras, météo et vivier de production. Un seul levier : `manchesIgnorees`
// (« avant » le pose, « après » l'omet).
//
// DEUX SCÉNARIOS, jamais extrapolés (point 4). A : le catalogue RÉEL n'a AUCUNE
// donnée de manches tant que la colonne n'est pas renseignée — les deux bras
// DOIVENT y être identiques, c'est le test d'innocuité. B : un dressing
// synthétique où les hauts portent leurs manches (sans, courtes, longues).
//
// « bras nus sans couche » : haut sans manches ou à manches courtes, sans
// veste, manteau ni pull. « haut longues » : part des tenues dont le haut est
// à manches longues. « R-B9 » : doit rester à 0.

const N = Number(process.env.TIRAGES ?? 8);
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const CAT_KEYS: CategoryKey[] = CATS.map(([k]) => k);
const AVANT: LeviersMesure = { manchesIgnorees: true };
const BRAS: { nom: string; leviers?: LeviersMesure }[] = [{ nom: "avant", leviers: AVANT }, { nom: "après" }];

const JOURNEES: { calendaire: CapsuleSeason; temp: number }[] = [
  ...[8, 12, 15, 18, 20, 21, 22, 25].map((temp) => ({ calendaire: "Automne" as CapsuleSeason, temp })),
  { calendaire: "Hiver", temp: 5 },
  { calendaire: "Printemps", temp: 18 },
  { calendaire: "Printemps", temp: 24 },
  { calendaire: "Été", temp: 28 },
];
const label = (t: number) => (t >= 23 ? "Ensoleillé" : "Nuageux");

let idPiece = 1;
const piece = (name: string, cat: CategoryKey, over: Partial<Item>): Item =>
  ({ id: idPiece++, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: 0, ...over }) as Item;
const DRESSING: Item[] = [
  piece("Blouse satin sans manches", "haut", { manches: "sans", color: "Bleu ciel", hex: "#BFD3E6", season: "Printemps / Été", saisons: ["Été"] }),
  piece("T-shirt blanc", "haut", { manches: "courtes", color: "Blanc", hex: "#F4F1EA", season: "Printemps / Été", saisons: ["Printemps", "Été"] }),
  piece("Chemise blanche", "haut", { manches: "longues", color: "Blanc", hex: "#F4F1EA" }),
  piece("Pull col roulé", "pull", { color: "Camel", hex: "#B58A5A", season: "Automne / Hiver", saisons: ["Automne", "Hiver"] }),
  piece("Gilet fin", "pull", { color: "Gris", hex: "#9A9690" }),
  piece("Jupe crayon noire", "jupe", {}),
  piece("Pantalon droit", "pantalon", { color: "Marine", hex: "#2B3A55" }),
  piece("Short en lin", "short", { color: "Beige", hex: "#D9C7A7", season: "Printemps / Été", saisons: ["Été"] }),
  piece("Robe d'été fleurie", "robe", { color: "Rose", hex: "#E6B8B8", season: "Printemps / Été", saisons: ["Été"] }),
  piece("Blazer noir", "veste", {}),
  piece("Trench", "manteau", { color: "Beige", hex: "#CBB38E", season: "Automne / Hiver", saisons: ["Printemps", "Automne"] }),
  piece("Sandales à talons", "chaussures", { shoeType: "Sandales à talons", season: "Printemps / Été", saisons: ["Printemps", "Été"] }),
  piece("Escarpins", "chaussures", { shoeType: "Escarpins" }),
  piece("Bottines", "chaussures", { shoeType: "Bottines", season: "Automne / Hiver", saisons: ["Automne", "Hiver"] }),
  piece("Baskets blanches", "chaussures", { shoeType: "Baskets", color: "Blanc", hex: "#F4F1EA" }),
  piece("Sac cabas camel", "sac", { color: "Camel", hex: "#B58A5A", sacType: "Cabas" }),
  piece("Bracelet argent", "bijou", { color: "Argent", hex: "#C0C0C0", bijouType: "Bracelet" }),
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
function tirer<T>(cle: string, f: () => T): T {
  const vrai = Math.random;
  Math.random = mulberry32(grainePour(cle));
  try { return f(); } finally { Math.random = vrai; }
}

interface Compte { tenues: number; cellules: number; brasNusSansCouche: number; hautLongues: number; avecVeste: number; violationsRB9: number; horsMax: number }
const zero = (): Compte => ({ tenues: 0, cellules: 0, brasNusSansCouche: 0, hautLongues: 0, avecVeste: 0, violationsRB9: 0, horsMax: 0 });
const pct = (n: number, t: number) => (t ? `${((n / t) * 100).toFixed(0)} %` : "—").padStart(7);

let CATALOGUE: CatalogItem[] = CATALOG;

function mesurer(scenario: "A" | "B", j: { calendaire: CapsuleSeason; temp: number }, leviers?: LeviersMesure): Compte {
  const w: Weather = weatherForDay(j.temp, label(j.temp), j.calendaire, CHALEUR_HORS_SAISON);
  const vivier = saisonCapsuleDuJour(j.temp, j.calendaire);
  const c = zero();
  for (const style of STYLES_FEMME) {
    const profil = profilAudit({ gender: "femme", styles: [style] });
    const capsule: CatalogItem[] = computeDefaultCapsule(profil, w, [], vivier, CATALOGUE);
    const pool: Item[] = scenario === "A" ? capsule : composeWardrobePool(DRESSING, capsule, CAT_KEYS);
    const index = new Map<number, Item>([...pool, ...capsule, ...DRESSING].map((p) => [p.id, p]));
    for (const occ of OCCS) {
      let couverte = false;
      for (let k = 0; k < N; k++) {
        const gen = composeWardrobePool(pool, capsule, CAT_KEYS, { completerPourOccasion: occ, saison: w, exclureHorsOccasion: true });
        const ids = tirer(`${style}|${occ}|${k}`, () =>
          generateOutfitWithFallback(gen, w, occ, "Présentiel", "Verre", [], "femme", null, leviers).ids);
        if (!ids.length) continue;
        couverte = true;
        c.tenues += 1;
        const pieces = ids.map((id) => index.get(id)).filter((p): p is Item => Boolean(p));
        const dessus = pieces.some((p) => p.cat === "veste" || p.cat === "manteau");
        if (dessus) c.avecVeste += 1;
        const haut = pieces.find((p) => p.cat === "haut");
        if (haut && brasNus(haut) && !dessus && !pieces.some((p) => p.cat === "pull")) c.brasNusSansCouche += 1;
        if (haut?.manches === "longues") c.hautLongues += 1;
        if (violatesOuterwearRule(pieces)) c.violationsRB9 += 1;
        for (const p of pieces) if (p.meteoMaxTemp != null && j.temp > p.meteoMaxTemp) c.horsMax += 1;
      }
      if (couverte) c.cellules += 1;
    }
  }
  return c;
}

describe("la veste par temps frais, dans la tenue", () => {
  it("mesure avant et après, dans la même exécution", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const cle = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let source = "catalogue de REPLI, sans bornes de température";
    if (url && cle) {
      const { data, error } = await createClient(url, cle).from("vestiaire_universel").select("*").order("id").returns<VestiaireRow[]>();
      if (!error && data?.length) {
        CATALOGUE = data.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
          .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
        source = "catalogue RÉEL (vestiaire_universel)";
      } else console.log(`Lecture Supabase impossible (${error?.message ?? "vide"}) : repli.`);
    }
    console.log(`CONFIGURATION GELÉE : ${source}, ${CATALOGUE.length} pièces, ${STYLES_FEMME.length} styles femme, ${OCCS.length} occasions, ${N} tirages, graines identiques pour les deux bras.`);
    for (const scenario of ["A", "B"] as const) {
      console.log(`\n════════ SCÉNARIO ${scenario} — ${scenario === "A" ? "dressing vide, capsule seule" : "dressing synthétique"} ════════`);
      for (const j of JOURNEES) {
        console.log(`\n  ── ${j.calendaire}, ${j.temp}° ──`);
        console.log(`  ${"bras".padEnd(8)}${"tenues".padStart(7)}${"cellules".padStart(10)}${"bras nus s/ couche".padStart(20)}${"haut longues".padStart(14)}${"avec veste".padStart(12)}${"R-B9".padStart(6)}${"hors max".padStart(10)}`);
        for (const b of BRAS) {
          const c = mesurer(scenario, j, b.leviers);
          console.log(`  ${b.nom.padEnd(8)}${String(c.tenues).padStart(7)}${String(c.cellules).padStart(10)}${pct(c.brasNusSansCouche, c.tenues).padStart(20)}${pct(c.hautLongues, c.tenues).padStart(14)}${pct(c.avecVeste, c.tenues).padStart(12)}${String(c.violationsRB9).padStart(6)}${String(c.horsMax).padStart(10)}`);
        }
      }
    }
  }, 1_800_000);
});
