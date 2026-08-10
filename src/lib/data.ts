import type { CategoryKey, City, Item, OccasionKey, Season } from "./types";

export const CATS: [CategoryKey, string, string][] = [
  ["haut", "Haut", "Hauts"],
  ["bas", "Bas", "Bas"],
  ["robe", "Robe", "Robes"],
  ["chaussures", "Chaussures", "Chaussures"],
  ["accessoire", "Accessoire", "Accessoires"],
];

export const CATLABEL: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
export const CATPLURAL: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
CATS.forEach(([key, label, plural]) => {
  CATLABEL[key] = label;
  CATPLURAL[key] = plural;
});

// name, cat, colorName, hex, season, lastWornDays(null=jamais), seedInCapsule
const RAW: [string, CategoryKey, string, string, Season, number | null, boolean][] = [
  ["Chemise en lin", "haut", "Blanc cassé", "#EDE4D6", "Été", 3, true],
  ["Pull col rond", "haut", "Camel", "#C08A5E", "Hiver", 12, true],
  ["T-shirt coton", "haut", "Crème", "#E7DCC8", "Toutes saisons", 1, true],
  ["Blouse en soie", "haut", "Rose poudré", "#D3AE9F", "Printemps", 24, true],
  ["Débardeur côtelé", "haut", "Noir", "#2A2724", "Été", 5, true],
  ["Gilet fin", "haut", "Taupe", "#A8967C", "Automne", 40, true],
  ["Chemisier rayé", "haut", "Bleu grisé", "#8A96A0", "Toutes saisons", 8, true],
  ["Sweat molleton", "haut", "Gris", "#9B968F", "Hiver", 60, false],
  ["Top cache-cœur", "haut", "Terracotta", "#B07A4E", "Été", 6, true],
  ["Chemise oversize", "haut", "Olive", "#8A8560", "Automne", 15, true],
  ["Pull torsadé", "haut", "Brique", "#9E5A3C", "Hiver", 90, true],
  ["Jean droit", "bas", "Denim", "#5E6E7C", "Toutes saisons", 2, true],
  ["Pantalon tailleur", "bas", "Taupe", "#A8967C", "Automne", 9, true],
  ["Jupe midi", "bas", "Olive", "#8A8560", "Printemps", 20, true],
  ["Short en lin", "bas", "Crème", "#E7DCC8", "Été", null, false],
  ["Jean brut", "bas", "Marine", "#3A4152", "Toutes saisons", 4, true],
  ["Pantalon large", "bas", "Noir", "#2A2724", "Toutes saisons", 7, true],
  ["Chino", "bas", "Sable", "#D9C9B2", "Printemps", 30, true],
  ["Robe portefeuille", "robe", "Terracotta", "#B07A4E", "Été", 11, true],
  ["Robe chemise", "robe", "Marine", "#3A4152", "Automne", 18, true],
  ["Robe pull", "robe", "Gris", "#9B968F", "Hiver", null, false],
  ["Robe longue", "robe", "Rouille", "#A9613F", "Été", 22, true],
  ["Bottines cuir", "chaussures", "Chocolat", "#7C5436", "Automne", 5, true],
  ["Baskets blanches", "chaussures", "Blanc cassé", "#EDE4D6", "Toutes saisons", 1, true],
  ["Sandales tressées", "chaussures", "Camel", "#C08A5E", "Été", 14, true],
  ["Escarpins", "chaussures", "Bordeaux", "#6E3B3A", "Hiver", null, false],
  ["Mocassins", "chaussures", "Camel", "#C08A5E", "Automne", 10, true],
  ["Ballerines", "chaussures", "Taupe", "#A8967C", "Printemps", 33, true],
  ["Bottes hautes", "chaussures", "Noir", "#2A2724", "Hiver", 25, true],
  ["Ceinture cuir", "accessoire", "Rouille", "#A9613F", "Toutes saisons", 3, true],
  ["Foulard soie", "accessoire", "Moutarde", "#C39A50", "Printemps", 45, true],
  ["Sac cabas", "accessoire", "Camel", "#C08A5E", "Toutes saisons", 2, true],
  ["Écharpe laine", "accessoire", "Bordeaux", "#6E3B3A", "Hiver", 70, true],
  ["Chapeau feutre", "accessoire", "Chocolat", "#7C5436", "Automne", 50, true],
];

export interface SeedItem extends Item {
  seed: boolean;
}

export const SEED_ITEMS: SeedItem[] = RAW.map((r, i) => ({
  id: i + 1,
  name: r[0],
  cat: r[1],
  color: r[2],
  hex: r[3],
  season: r[4],
  worn: r[5],
  seed: r[6],
}));

export const PALETTE: [string, string][] = [
  ["Blanc cassé", "#EDE4D6"],
  ["Crème", "#E7DCC8"],
  ["Sable", "#D9C9B2"],
  ["Rose poudré", "#D3AE9F"],
  ["Camel", "#C08A5E"],
  ["Caramel", "#B57F4E"],
  ["Terracotta", "#B07A4E"],
  ["Rouille", "#A9613F"],
  ["Brique", "#9E5A3C"],
  ["Chocolat", "#7C5436"],
  ["Moutarde", "#C39A50"],
  ["Olive", "#8A8560"],
  ["Kaki", "#6E6A4C"],
  ["Vert sauge", "#9AA389"],
  ["Taupe", "#A8967C"],
  ["Gris", "#9B968F"],
  ["Bleu grisé", "#8A96A0"],
  ["Denim", "#5E6E7C"],
  ["Marine", "#3A4152"],
  ["Bordeaux", "#6E3B3A"],
  ["Noir", "#2A2724"],
];

export const SEASONS: Season[] = ["Printemps", "Été", "Automne", "Hiver", "Toutes saisons"];

export const OCCASIONS: [OccasionKey, string][] = [
  ["all", "Toutes"],
  ["travail", "Travail"],
  ["weekend", "Week-end"],
  ["sport", "Sport"],
  ["soiree", "Soirée"],
  ["ceremonie", "Cérémonie"],
  ["voyage", "Voyage"],
];

export const OCC_LABELS: Record<OccasionKey, string> = {} as Record<OccasionKey, string>;
OCCASIONS.forEach(([key, label]) => {
  OCC_LABELS[key] = label;
});

export const CITIES: City[] = [
  { city: "Paris 11e", temp: 27, label: "Ensoleillé" },
  { city: "Lyon", temp: 30, label: "Ensoleillé" },
  { city: "Marseille", temp: 32, label: "Grand soleil" },
  { city: "Bordeaux", temp: 28, label: "Éclaircies" },
  { city: "Lille", temp: 22, label: "Nuageux" },
];

export const CAP_SEASONS = ["Printemps 2026", "Été 2026", "Automne 2026", "Hiver 2026"];

export const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
export const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export interface Weather {
  season: Season;
  temp: number;
  label: string;
  seasons: Season[];
}

export function computeWeather(): Weather {
  const m = new Date().getMonth();
  let season: Season, temp: number, label: string;
  if (m === 11 || m <= 1) {
    season = "Hiver";
    temp = 6;
    label = "Frais et couvert";
  } else if (m <= 4) {
    season = "Printemps";
    temp = 16;
    label = "Doux";
  } else if (m <= 7) {
    season = "Été";
    temp = 27;
    label = "Ensoleillé";
  } else {
    season = "Automne";
    temp = 14;
    label = "Nuageux";
  }
  return { season, temp, label, seasons: [season, "Toutes saisons"] };
}

export function isBag(it: { name: string }): boolean {
  return /\bsac\b/i.test(it.name);
}

export function wornAgo(d: number | null | undefined): string {
  if (d == null) return "Jamais portée";
  if (d < 1) return "Porté aujourd’hui";
  if (d === 1) return "Porté hier";
  if (d < 7) return "Porté il y a " + d + " j";
  if (d < 30) return "Porté il y a " + Math.round(d / 7) + " sem";
  if (d < 365) return "Porté il y a " + Math.round(d / 30) + " mois";
  return "Porté il y a +1 an";
}

export const PREMIUM_FEATURES = [
  { icon: "☷", title: "Journal des tenues", body: "Retrouve tout ce que tu as porté, jour par jour, et vois ta semaine d’un coup d’œil." },
  { icon: "⌛", title: "Pièces jamais portées", body: "Un espace dédié pour repérer et enfin sortir les oubliées de ton dressing." },
  { icon: "✎", title: "Corriger tes ports", body: "Marque, ajuste ou annule un « porté aujourd’hui » quand tu changes d’avis." },
  { icon: "🔒", title: "Génération sur mesure", body: "Verrouille une pièce et régénère le reste, ou filtre par occasion (travail / week-end)." },
];

export interface OnboardingSlide {
  kicker: string;
  tag: string;
  glyph: string;
  bg: string;
  glyphColor: string;
  tagColor: string;
  title: string;
  body: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    kicker: "Ton dressing",
    tag: "ce que tu as déjà",
    glyph: "1",
    bg: "#E7DCCB",
    glyphColor: "rgba(166,105,80,.28)",
    tagColor: "#8A6B4A",
    title: "On part de ce que tu possèdes déjà.",
    body: "Photographie tes vêtements un par un. Aucun achat pour commencer — ta capsule naît de ta propre garde-robe.",
  },
  {
    kicker: "Ta capsule",
    tag: "30 à 40 pièces",
    glyph: "2",
    bg: "#D9C9B2",
    glyphColor: "rgba(166,105,80,.26)",
    tagColor: "#7C6A4F",
    title: "30 à 40 pièces, choisies avec soin.",
    body: "Sélectionne l’essentiel qui va vraiment ensemble. Un compteur et la répartition par catégorie t’aident à garder l’équilibre.",
  },
  {
    kicker: "Moins, mais mieux",
    tag: "porte tout",
    glyph: "3",
    bg: "#C9B29A",
    glyphColor: "rgba(166,105,80,.24)",
    tagColor: "#6E5B43",
    title: "Tout porter, enfin.",
    body: "Repère tes pièces jamais portées, compose tes tenues et achète moins. Un dressing plus léger, plus toi.",
  },
];

export function seedHistory(): import("./types").HistoryEntry[] {
  const now = new Date();
  const day = 864e5;
  const seeds: [number, number[], OccasionKey][] = [
    [0, [1, 13, 27, 32, 31], "travail"],
    [0, [3, 15, 24, 32], "sport"],
    [1, [3, 12, 24, 32], "weekend"],
    [2, [19, 26, 32], "soiree"],
    [3, [9, 14, 25, 32], "weekend"],
    [6, [7, 13, 26, 32], "travail"],
  ];
  const arr = seeds.map(([offsetDays, pieceIds, occasion], i) => ({
    id: "h" + i,
    ts: now.getTime() - offsetDays * day,
    pieceIds,
    occasion,
  }));
  const lastYear = new Date(now);
  lastYear.setFullYear(now.getFullYear() - 1);
  arr.push({ id: "hy", ts: lastYear.getTime(), pieceIds: [1, 14, 25, 32, 31], occasion: "weekend" });
  return arr;
}
