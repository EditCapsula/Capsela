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
import { CHAUSSURES_OUVERTES, generateOutfitWithFallback, type LeviersMesure } from "../src/lib/logic";
import { composeWardrobePool } from "../src/lib/selectors";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";

// LES SANDALES À TALONS DE FÊTE EN AUTOMNE — AVANT / APRÈS, MÊME EXÉCUTION.
// LECTURE SEULE.
//
// DEMANDÉ LE 01/10/2026 : « pour une cérémonie ou une soirée festive tu peux
// proposer des sandales à talons même en automne ». Exemption de SAISON pour
// cette chaussure et ces deux occasions (festive, evenement_perso), en
// automne ; température, pluie (R-B21) et le reste de la tenue inchangés.
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : profils d'audit femme, tous les
// styles, toutes les occasions, graines déterministes identiques pour les deux
// bras, météo et vivier de production. Un seul levier :
// `sansSandalesDeFeteEnAutomne` — « avant » le pose, « après » l'omet.
// Scénarios A (catalogue RÉEL si Supabase, sinon repli SANS bornes de
// température, dit en tête) et B (dressing synthétique), jamais extrapolés.
//
// « sandales fête » : part des tenues festive + evenement_perso portant des
// sandales à talons. « sandales autres » : même part sur les huit autres
// occasions — doit rester identique avant/après. « ouvertes pluie » : tenues
// aux chaussures ouvertes sous la pluie — doit rester à 0.

const N = Number(process.env.TIRAGES ?? 8);
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const CAT_KEYS: CategoryKey[] = CATS.map(([k]) => k);
const AVANT: LeviersMesure = { sansSandalesDeFeteEnAutomne: true };
const BRAS: { nom: string; leviers?: LeviersMesure }[] = [{ nom: "avant", leviers: AVANT }, { nom: "après" }];

const JOURNEES: { calendaire: CapsuleSeason; temp: number; pluie?: boolean }[] = [
  ...[8, 12, 15, 18, 21, 25].map((temp) => ({ calendaire: "Automne" as CapsuleSeason, temp })),
  { calendaire: "Automne", temp: 15, pluie: true },
  { calendaire: "Hiver", temp: 5 },
  { calendaire: "Printemps", temp: 18 },
  { calendaire: "Été", temp: 28 },
];
const label = (t: number, pluie?: boolean) => (pluie ? "Pluvieux" : t >= 23 ? "Ensoleillé" : "Nuageux");

let idPiece = 1;
const piece = (name: string, cat: CategoryKey, over: Partial<Item>): Item =>
  ({ id: idPiece++, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: 0, ...over }) as Item;
const DRESSING: Item[] = [
  piece("Blouse satin sans manches", "haut", { color: "Bleu ciel", hex: "#BFD3E6", season: "Printemps / Été", saisons: ["Été"] }),
  piece("T-shirt blanc", "haut", { color: "Blanc", hex: "#F4F1EA", season: "Printemps / Été", saisons: ["Printemps", "Été"] }),
  piece("Chemise blanche", "haut", { color: "Blanc", hex: "#F4F1EA" }),
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

interface Compte { tenues: number; cellules: number; tenuesFete: number; sandFete: number; tenuesAutres: number; sandAutres: number; ouvertesPluie: number; horsMax: number }
const zero = (): Compte => ({ tenues: 0, cellules: 0, tenuesFete: 0, sandFete: 0, tenuesAutres: 0, sandAutres: 0, ouvertesPluie: 0, horsMax: 0 });
const pct = (n: number, t: number) => (t ? `${((n / t) * 100).toFixed(0)} %` : "—").padStart(7);

let CATALOGUE: CatalogItem[] = CATALOG;

function mesurer(scenario: "A" | "B", j: { calendaire: CapsuleSeason; temp: number; pluie?: boolean }, leviers?: LeviersMesure): Compte {
  const w: Weather = weatherForDay(j.temp, label(j.temp, j.pluie), j.calendaire, CHALEUR_HORS_SAISON);
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
        const sandales = pieces.some((p) => p.cat === "chaussures" && p.shoeType === "Sandales à talons");
        if ((occ as string) === "festive" || occ === "evenement_perso") { c.tenuesFete += 1; if (sandales) c.sandFete += 1; }
        else { c.tenuesAutres += 1; if (sandales) c.sandAutres += 1; }
        if (j.pluie && pieces.some((p) => p.cat === "chaussures" && p.shoeType && CHAUSSURES_OUVERTES.includes(p.shoeType))) c.ouvertesPluie += 1;
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
        console.log(`\n  ── ${j.calendaire}, ${j.temp}°${j.pluie ? ", pluie" : ""} ──`);
        console.log(`  ${"bras".padEnd(8)}${"tenues".padStart(7)}${"cellules".padStart(10)}${"sandales fête".padStart(15)}${"sandales autres".padStart(17)}${"ouvertes pluie".padStart(16)}${"hors max".padStart(10)}`);
        for (const b of BRAS) {
          const c = mesurer(scenario, j, b.leviers);
          console.log(`  ${b.nom.padEnd(8)}${String(c.tenues).padStart(7)}${String(c.cellules).padStart(10)}${pct(c.sandFete, c.tenuesFete).padStart(15)}${pct(c.sandAutres, c.tenuesAutres).padStart(17)}${String(c.ouvertesPluie).padStart(16)}${String(c.horsMax).padStart(10)}`);
        }
      }
    }
  }, 1_800_000);
});
