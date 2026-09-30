import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CATALOG, type CatalogItem } from "../src/lib/catalog";
import {
  computeDefaultCapsule,
  contexteCapsule,
  estDeSaison,
  saisonCapsulePourMeteo,
  weatherForDay,
} from "../src/lib/capsule";
import { CATS, OCCASIONS, type Weather } from "../src/lib/data";
import { CHAUSSURES_OUVERTES, generateOutfitWithFallback } from "../src/lib/logic";
import { composeWardrobePool } from "../src/lib/selectors";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";

// LE CALENDRIER D'ABORD, SAUF VRAIE CHALEUR — AVANT / APRÈS, MÊME EXÉCUTION.
// LECTURE SEULE.
//
// SIGNALÉ LE 30/09/2026, capture à l'appui : 21° à 19 h, « Travail / Bureau »,
// la tenue du jour propose un haut sans manches et des sandales à talons.
// Cause lue dans le code : depuis le 15/09, dès 20° la journée compte comme de
// l'été (saisonThermique), et le vivier de la tenue est la capsule d'été dès
// 19° (saisonCapsulePourMeteo). Arbitrage de la propriétaire : option 2, « le
// calendrier d'abord, sauf vraie chaleur », seuil à fixer après mesure.
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : profils d'audit femme, tous les
// styles exposés, toutes les occasions, graines déterministes identiques pour
// tous les bras. Seuls varient la journée et le bras.
//
// LEVIERS (point 2), tous deux facultatifs, omis = règle en production :
//   L1  `weatherForDay(…, chaleurHorsSaison)` — en automne-hiver calendaire,
//       la moitié printemps-été n'est admise (seasons / saisons du jour) qu'à
//       partir du seuil ;
//   L2  `saisonCapsulePourMeteo(…, { calendaire, chaleurHorsSaison })` — le
//       vivier de la tenue reste dans la moitié automne-hiver sous le seuil.
// Ils interagissent : le vivier décide des pièces de la capsule, L1 de
// celles qu'on garde parmi elles et parmi les pièces réelles. Mesurés seuls
// et ensemble (point 3), pour trois seuils.
//
// DEUX SCÉNARIOS, jamais extrapolés l'un à l'autre (point 4) :
//   A · dressing vide : la capsule seule, sur le catalogue RÉEL si les
//       variables Supabase sont là (la clé publique suffit : le catalogue se
//       lit comme dans l'app), sinon sur le CATALOGUE DE REPLI (catalog.ts),
//       qui n'a AUCUNE borne de température — « hors max » et « nue < min »
//       y valent 0 par construction et ne prouvent rien. Le rapport dit en
//       tête lequel a servi ;
//   B · un dressing réel synthétique, bâti sur le cas signalé : un haut sans
//       manches coché Été, des sandales à talons Printemps + Été, à côté de
//       pièces d'automne et de pièces toutes saisons. Les pièces réelles n'ont
//       pas de bornes de température (dressing_items n'en a pas).
//
// TÉMOINS : printemps et été calendaires. Les leviers n'agissent qu'en
// automne-hiver ; toute différence sur les témoins serait un défaut.

const N = Number(process.env.TIRAGES ?? 8);
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const CAT_KEYS: CategoryKey[] = CATS.map(([k]) => k);
const SEUILS = [22, 24, 26];

type Bras = { nom: string; l1?: number; l2?: number };
const BRAS: Bras[] = [
  { nom: "avant (production)" },
  ...SEUILS.flatMap((s): Bras[] => [
    { nom: `L1 seul, ${s}°`, l1: s },
    { nom: `L2 seul, ${s}°`, l2: s },
    { nom: `L1 + L2, ${s}°`, l1: s, l2: s },
  ]),
];

const JOURNEES: { calendaire: CapsuleSeason; temp: number }[] = [
  ...[17, 19, 20, 21, 22, 23, 24, 25, 26, 28, 30].map((temp) => ({ calendaire: "Automne" as CapsuleSeason, temp })),
  { calendaire: "Hiver", temp: 21 },
  { calendaire: "Hiver", temp: 25 },
  { calendaire: "Printemps", temp: 21 },
  { calendaire: "Printemps", temp: 28 },
  { calendaire: "Été", temp: 21 },
];
const label = (t: number) => (t >= 23 ? "Ensoleillé" : "Nuageux");

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

interface Compte { tenues: number; cellules: number; horsCalendrier: number; ouvertes: number; horsMax: number; nueSousMin: number }
const zero = (): Compte => ({ tenues: 0, cellules: 0, horsCalendrier: 0, ouvertes: 0, horsMax: 0, nueSousMin: 0 });
const pct = (n: number, t: number) => (t ? `${((n / t) * 100).toFixed(0)} %` : "—").padStart(6);

let CATALOGUE: CatalogItem[] = CATALOG;

function mesurer(scenario: "A" | "B", j: { calendaire: CapsuleSeason; temp: number }, bras: Bras, exemple?: string[]): Compte {
  const w: Weather = weatherForDay(j.temp, label(j.temp), j.calendaire, bras.l1);
  const vivier = saisonCapsulePourMeteo(j.temp, undefined, bras.l2 != null ? { calendaire: j.calendaire, chaleurHorsSaison: bras.l2 } : undefined);
  const calendrier = contexteCapsule(j.calendaire);
  const c = zero();
  for (const style of STYLES_FEMME) {
    const profil = profilAudit({ gender: "femme", styles: [style] });
    const capsule: CatalogItem[] = computeDefaultCapsule(profil, w, [], vivier, CATALOGUE);
    const pool: Item[] = scenario === "A" ? capsule : composeWardrobePool(DRESSING, capsule, CAT_KEYS);
    const index = new Map<number, Item>([...pool, ...capsule, ...DRESSING].map((p) => [p.id, p]));
    for (const occ of OCCS) {
      let couverte = false;
      for (let k = 0; k < N; k++) {
        // Même chemin que `regen` (store.tsx) : complétion par occasion, puis le moteur unique.
        const gen = composeWardrobePool(pool, capsule, CAT_KEYS, { completerPourOccasion: occ, saison: w, exclureHorsOccasion: true });
        const ids = tirer(`${style}|${occ}|${k}`, () =>
          generateOutfitWithFallback(gen, w, occ, "Présentiel", "Verre", [], "femme").ids);
        if (!ids.length) continue;
        couverte = true;
        c.tenues += 1;
        const pieces = ids.map((id) => index.get(id)).filter((p): p is Item => Boolean(p));
        if (pieces.some((p) => !estDeSaison(p, calendrier))) c.horsCalendrier += 1;
        if (pieces.some((p) => p.cat === "chaussures" && p.shoeType && CHAUSSURES_OUVERTES.includes(p.shoeType))) c.ouvertes += 1;
        const couche = pieces.some((p) => p.cat === "pull" || p.cat === "veste" || p.cat === "manteau");
        for (const p of pieces) {
          if (p.meteoMaxTemp != null && j.temp > p.meteoMaxTemp) c.horsMax += 1;
          if (p.meteoMinTemp != null && j.temp < p.meteoMinTemp && !couche) c.nueSousMin += 1;
        }
        if (exemple && occ === "travail_formel" && k === 0 && exemple.length < 3) exemple.push(`${style} : ${pieces.map((p) => p.name).join(" · ")}`);
      }
      if (couverte) c.cellules += 1;
    }
  }
  return c;
}

describe("le calendrier d'abord, sauf vraie chaleur", () => {
  it("mesure les deux leviers, seuls et ensemble, sur trois seuils", async () => {
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
    const CELLULES = STYLES_FEMME.length * OCCS.length;
    console.log(`CONFIGURATION GELÉE : ${source}, ${CATALOGUE.length} pièces, ${STYLES_FEMME.length} styles femme, ${OCCS.length} occasions, ${N} tirages, graines identiques pour tous les bras.`);
    console.log(`« hors calendrier » : tenues avec au moins une pièce qui n'est pas de la saison du calendrier.`);
    console.log(`« ouvertes » : tenues avec des chaussures ouvertes. « hors max » : pièces portées au-dessus de leur borne haute (le problème du 15/09).`);
    console.log(`« nue < min » : pièces sous leur borne basse sans aucune couche. « cellules » : style × occasion avec au moins une tenue, sur ${CELLULES}.`);

    for (const scenario of ["A", "B"] as const) {
      console.log(`\n════════ SCÉNARIO ${scenario} — ${scenario === "A" ? "dressing vide, capsule seule" : "dressing synthétique du cas signalé"} ════════`);
      for (const j of JOURNEES) {
        console.log(`\n  ── ${j.calendaire}, ${j.temp}° ──   vivier avant : ${saisonCapsulePourMeteo(j.temp)}`);
        console.log(`  ${"bras".padEnd(22)}${"tenues".padStart(7)}${"cellules".padStart(10)}${"hors cal.".padStart(11)}${"ouvertes".padStart(10)}${"hors max".padStart(10)}${"nue<min".padStart(9)}`);
        for (const bras of BRAS) {
          const exemple: string[] | undefined = scenario === "B" && j.calendaire === "Automne" && j.temp === 21 ? [] : undefined;
          const c = mesurer(scenario, j, bras, exemple);
          console.log(`  ${bras.nom.padEnd(22)}${String(c.tenues).padStart(7)}${String(c.cellules).padStart(10)}${pct(c.horsCalendrier, c.tenues).padStart(11)}${pct(c.ouvertes, c.tenues).padStart(10)}${String(c.horsMax).padStart(10)}${String(c.nueSousMin).padStart(9)}`);
          if (exemple?.length && (bras.nom.startsWith("avant") || bras.nom === "L1 + L2, 24°")) for (const e of exemple) console.log(`      bureau · ${e}`);
        }
      }
    }
  }, 1_800_000);
});
