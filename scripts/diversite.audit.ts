import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CATALOG, type CatalogItem } from "../src/lib/catalog";
import { CHALEUR_HORS_SAISON, computeDefaultCapsule, saisonCapsuleDuJour, weatherForDay } from "../src/lib/capsule";
import { CATS } from "../src/lib/data";
import { genererTenueDiversifiee, piecesPrincipales, recentsDuJour, type RecommandationJour } from "../src/lib/diversite";
import { CHAUSSURES_OUVERTES, isCompleteOutfit } from "../src/lib/logic";
import { composeWardrobePool } from "../src/lib/selectors";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CapsuleSeason, CategoryKey, Item } from "../src/lib/types";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";

// DIVERSIFICATION SUR CINQ JOURS — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE.
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : catalogue RÉEL si Supabase répond,
// profils d'audit femme (8 styles), occasion « Travail / Bureau » (la tenue d'un
// jour travaillé), un dressing réel synthétique à côté de la capsule, et la
// MÊME semaine météo pour les deux bras, mêmes graines : lundi 18° soleil,
// mardi 19°, mercredi 21°, jeudi 12° pluie, vendredi 13° pluie. Seul varie le
// bras : « avant » = un tirage par jour sans mémoire (le moteur d'origine) ;
// « après » = la couche de diversité lisant les jours précédents.
//
// Mesures par semaine : combinaisons de pièces principales (haut + bas, ou robe)
// DISTINCTES sur 5 jours, jours consécutifs aux mêmes pièces principales, tenues
// incomplètes, pièces au-dessus de leur borne haute, chaussures ouvertes sous la
// pluie, et réutilisation des chaussures et des vestes (qui doit rester permise).

const SEMAINE = [
  { nom: "Lun", temp: 18, label: "Ensoleillé" },
  { nom: "Mar", temp: 19, label: "Ensoleillé" },
  { nom: "Mer", temp: 21, label: "Ensoleillé" },
  { nom: "Jeu", temp: 12, label: "Pluvieux" },
  { nom: "Ven", temp: 13, label: "Pluvieux" },
] as const;
const JOURS = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
const GRAINES = Number(process.env.GRAINES ?? 30);
const CAT_KEYS: CategoryKey[] = CATS.map(([k]) => k);

let idPiece = 1;
const piece = (name: string, cat: CategoryKey, over: Partial<Item>): Item =>
  ({ id: idPiece++, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
const DRESSING: Item[] = [
  piece("Chemise blanche", "haut", { subtype: "Chemise", color: "Blanc", hex: "#F4F1EA" }),
  piece("Blouse écrue", "haut", { subtype: "Blouse", color: "Crème", hex: "#E7DCC8" }),
  piece("Top rayé", "haut", { color: "Marine", hex: "#2B3A55" }),
  piece("Pull fin", "pull", { color: "Gris", hex: "#9A9690" }),
  piece("Jean brut", "jean", { color: "Marine", hex: "#2B3A55" }),
  piece("Pantalon noir", "pantalon", {}),
  piece("Pantalon beige", "pantalon", { color: "Beige", hex: "#D9C7A7" }),
  piece("Jupe midi", "jupe", { color: "Camel", hex: "#B58A5A" }),
  piece("Robe noire", "robe", {}),
  piece("Blazer noir", "veste", {}),
  piece("Trench", "manteau", { color: "Beige", hex: "#CBB38E" }),
  piece("Baskets blanches", "chaussures", { shoeType: "Baskets", color: "Blanc", hex: "#F4F1EA" }),
  piece("Bottines", "chaussures", { shoeType: "Bottines" }),
  piece("Mocassins", "chaussures", { shoeType: "Mocassins" }),
  piece("Sac cabas camel", "sac", { color: "Camel", hex: "#B58A5A", sacType: "Cabas" as never }),
];

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function avecGraine<T>(graine: number, f: () => T): T {
  const vrai = Math.random;
  Math.random = mulberry32(graine);
  try { return f(); } finally { Math.random = vrai; }
}

let CATALOGUE: CatalogItem[] = CATALOG;

interface Mesure { combinaisonsDistinctes: number; joursConsecutifsIdentiques: number; incompletes: number; horsMax: number; ouvertesPluie: number; chaussuresReutilisees: number; vestesReutilisees: number }

function semaine(styleIndex: number, graine: number, diversifier: boolean): { mesure: Mesure; rendu: string[] } {
  const style = STYLES_FEMME[styleIndex];
  const profil = profilAudit({ gender: "femme", styles: [style] });
  const calendaire: CapsuleSeason = "Automne";
  const meteoJour = (m: (typeof SEMAINE)[number]) => weatherForDay(m.temp, m.label, calendaire, CHALEUR_HORS_SAISON);
  // La capsule se construit sur la météo du jour d'ouverture, comme dans l'app.
  const capsule: CatalogItem[] = computeDefaultCapsule(profil, meteoJour(SEMAINE[0]), [], saisonCapsuleDuJour(SEMAINE[0].temp, calendaire), CATALOGUE);
  const pool: Item[] = composeWardrobePool(DRESSING, capsule, CAT_KEYS);
  const index = new Map<number, Item>([...pool, ...capsule, ...DRESSING].map((p) => [p.id, p]));
  const recommandees: Record<string, RecommandationJour> = {};
  const m: Mesure = { combinaisonsDistinctes: 0, joursConsecutifsIdentiques: 0, incompletes: 0, horsMax: 0, ouvertesPluie: 0, chaussuresReutilisees: 0, vestesReutilisees: 0 };
  const signatures: string[] = [];
  const rendu: string[] = [];
  let chaussuresVeille: number | null = null;
  let vesteVeille: number | null = null;
  SEMAINE.forEach((jour, i) => {
    const weather = meteoJour(jour);
    const recents = diversifier ? recentsDuJour({ jour: JOURS[i], portees: [], planifiees: [], recommandees }) : [];
    const gen = pool; // même vivier pour les deux bras
    const r = avecGraine(graine * 1000 + i, () =>
      genererTenueDiversifiee({ pool: gen, weather, occasion: "travail_formel", workMode: "Présentiel", dateContext: "Verre", preferredHexes: [], gender: "femme", morphology: profil.morphology, recents }));
    recommandees[JOURS[i]] = { ids: r.ids, temp: jour.temp, label: jour.label };
    const pieces = r.ids.map((id) => index.get(id)).filter((p): p is Item => Boolean(p));
    if (!isCompleteOutfit(pieces)) m.incompletes++;
    for (const p of pieces) if (p.meteoMaxTemp != null && jour.temp > p.meteoMaxTemp) m.horsMax++;
    if (jour.label === "Pluvieux" && pieces.some((p) => p.cat === "chaussures" && p.shoeType && CHAUSSURES_OUVERTES.includes(p.shoeType))) m.ouvertesPluie++;
    const sig = piecesPrincipales(r.ids, [...index.values()]).join("-");
    if (i > 0 && sig === signatures[i - 1]) m.joursConsecutifsIdentiques++;
    signatures.push(sig);
    const chaussures = pieces.find((p) => p.cat === "chaussures")?.id ?? null;
    const veste = pieces.find((p) => p.cat === "veste" || p.cat === "manteau")?.id ?? null;
    if (chaussures != null && chaussures === chaussuresVeille) m.chaussuresReutilisees++;
    if (veste != null && veste === vesteVeille) m.vestesReutilisees++;
    chaussuresVeille = chaussures;
    vesteVeille = veste;
    rendu.push(`${jour.nom} ${String(jour.temp).padStart(2)}° ${jour.label.padEnd(9)} → ${pieces.map((p) => p.name).join(" + ")}`);
  });
  m.combinaisonsDistinctes = new Set(signatures).size;
  return { mesure: m, rendu };
}

describe("diversification sur cinq jours", () => {
  it("avant / après, sur la même semaine météo", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const cle = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let source = "catalogue de REPLI, sans bornes de température";
    if (url && cle) {
      const { data, error } = await createClient(url, cle).from("vestiaire_universel").select("*").order("id").returns<VestiaireRow[]>();
      if (!error && data?.length) {
        CATALOGUE = data.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true).map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
        source = "catalogue RÉEL (vestiaire_universel)";
      }
    }
    console.log(`CONFIGURATION GELÉE : ${source}, ${CATALOGUE.length} pièces, ${STYLES_FEMME.length} styles femme, ${GRAINES} graines, occasion Travail / Bureau, semaine : ${SEMAINE.map((j) => `${j.nom} ${j.temp}° ${j.label}`).join(" · ")}.`);
    const cumul = { avant: [] as Mesure[], apres: [] as Mesure[] };
    for (let s = 0; s < STYLES_FEMME.length; s++) {
      for (let g = 1; g <= GRAINES; g++) {
        cumul.avant.push(semaine(s, g, false).mesure);
        cumul.apres.push(semaine(s, g, true).mesure);
      }
    }
    const moy = (l: Mesure[], k: keyof Mesure) => (l.reduce((a, x) => a + x[k], 0) / l.length).toFixed(2);
    const somme = (l: Mesure[], k: keyof Mesure) => l.reduce((a, x) => a + x[k], 0);
    console.log(`\n  ${"par semaine (moyenne)".padEnd(46)}${"avant".padStart(8)}${"après".padStart(8)}`);
    for (const [k, nom] of [
      ["combinaisonsDistinctes", "combinaisons principales distinctes (sur 5)"],
      ["joursConsecutifsIdentiques", "jours consécutifs aux mêmes pièces principales"],
      ["chaussuresReutilisees", "chaussures réutilisées d'un jour à l'autre"],
      ["vestesReutilisees", "vestes / manteaux réutilisés d'un jour à l'autre"],
    ] as [keyof Mesure, string][]) console.log(`  ${nom.padEnd(46)}${moy(cumul.avant, k).padStart(8)}${moy(cumul.apres, k).padStart(8)}`);
    console.log(`\n  ${"contraintes (total sur toutes les semaines)".padEnd(46)}${"avant".padStart(8)}${"après".padStart(8)}`);
    for (const [k, nom] of [["incompletes", "tenues incomplètes"], ["horsMax", "pièces au-dessus de leur borne haute"], ["ouvertesPluie", "chaussures ouvertes sous la pluie"]] as [keyof Mesure, string][])
      console.log(`  ${nom.padEnd(46)}${String(somme(cumul.avant, k)).padStart(8)}${String(somme(cumul.apres, k)).padStart(8)}`);
    for (const [s, g] of [[0, 3], [3, 7]] as const) {
      console.log(`\n  EXEMPLE — style « ${STYLES_FEMME[s]} », graine ${g}`);
      const av = semaine(s, g, false);
      const ap = semaine(s, g, true);
      console.log("   AVANT (un tirage par jour, sans mémoire) :");
      av.rendu.forEach((l) => console.log("     " + l));
      console.log("   APRÈS (diversité sur cinq jours) :");
      ap.rendu.forEach((l) => console.log("     " + l));
    }
  }, 900_000);
});
