import type { AccessoireType, BijouType, CategoryKey, City, OccasionKey, SacType, Season, ShoeType } from "./types";
import { PROFILE_PALETTE } from "./profile";

export const CATS: [CategoryKey, string, string][] = [
  ["haut", "Haut", "Hauts"],
  ["pantalon", "Pantalon", "Pantalons"],
  ["jean", "Jean", "Jeans"],
  ["short", "Short", "Shorts"],
  ["robe", "Robe", "Robes"],
  ["manteau", "Manteau", "Manteaux"],
  ["pull", "Pull / Gilet", "Pulls / Gilets"],
  ["combinaison", "Combinaison", "Combinaisons"],
  ["jupe", "Jupe", "Jupes"],
  ["chaussures", "Chaussures", "Chaussures"],
  ["sac", "Sac", "Sacs"],
  ["bijou", "Bijou", "Bijoux"],
  ["accessoire", "Accessoire", "Accessoires"],
];

/** Catégories regroupées sous "bas" pour la taille, l'anti-répétition et le picker de tenue. */
export const BAS_CATS: CategoryKey[] = ["pantalon", "jean", "short"];

export const CATLABEL: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
export const CATPLURAL: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
CATS.forEach(([key, label, plural]) => {
  CATLABEL[key] = label;
  CATPLURAL[key] = plural;
});

/** Palette de couleurs des pièces — la même que celle du profil (27 teintes). */
export const PALETTE: [string, string][] = PROFILE_PALETTE;

export const SEASONS: Season[] = ["Printemps / Été", "Automne / Hiver", "Toutes saisons"];

/**
 * Pré-suggestion de saison à l'ajout d'une pièce : jamais appliquée d'office,
 * l'utilisateur doit toujours confirmer (contrainte produit).
 */
export function seasonSuggestion(cat: CategoryKey, name: string): Season | null {
  if (cat === "manteau" || cat === "pull") return "Automne / Hiver";
  if (/lin|short|débardeur|sandal|combinaison/.test((name || "").toLowerCase())) return "Printemps / Été";
  return null;
}

/**
 * Occasion, libellé, sous-libellé, niveau de formalité minimum requis
 * (0 = sport, 1 = décontracté, 3 = business casual, 4 = habillé) — alimente
 * R-B3 (incohérence occasion) et R-B6 (baskets non éligibles).
 */
export const OCCASIONS: [OccasionKey, string, string, number][] = [
  ["quotidien", "Quotidien / bureau décontracté", "Journée type", 1],
  ["travail_formel", "Travail formel", "Bureau, réunions", 3],
  ["entretien", "Réunion importante / entretien", "Ça compte", 4],
  ["date", "Rendez-vous / date", "Date, dîner", 3],
  ["soiree", "Soirée / sortie entre amis", "Cocktail, sortie", 3],
  ["evenement_pro", "Événement pro", "Conférence, salon", 4],
  ["evenement_perso", "Événement perso formel", "Mariage, baptême", 4],
  ["sport", "Sport", "Actif, décontracté", 0],
  ["voyage", "Voyage", "Confortable, polyvalent", 1],
  ["meteo", "Météo changeante", "Superposable", 1],
  ["cocooning", "Cocooning", "Chez soi, détente", 0],
];

export const OCC_LABELS: Record<OccasionKey, string> = { all: "Toutes" } as Record<OccasionKey, string>;
export const OCC_FORMALITY: Record<OccasionKey, number> = { all: 0 } as Record<OccasionKey, number>;
OCCASIONS.forEach(([key, label, , formality]) => {
  OCC_LABELS[key] = label;
  OCC_FORMALITY[key] = formality;
});

/** Type de chaussure — obligatoire si catégorie = chaussures, nécessaire à R-B6. */
export const SHOE_TYPES: ShoeType[] = ["Basket / sneaker", "Escarpin", "Mocassin", "Botte / bottine", "Sandale"];
/** Sous-types — pré-suggérés à la saisie du nom, jamais bloquants. */
export const SAC_TYPES: SacType[] = ["Cabas", "Bandoulière", "Sac à dos", "Pochette", "Sac seau"];
export const BIJOU_TYPES: BijouType[] = ["Collier", "Boucles d'oreilles", "Bracelet", "Bague", "Broche"];
export const ACCESSOIRE_TYPES: AccessoireType[] = ["Ceinture", "Foulard", "Écharpe", "Chapeau", "Lunettes", "Gants"];

/** Palette dédiée au bijou (tons métalliques) — remplace la palette générale pour cette catégorie. */
export const PALETTE_BIJOU: [string, string][] = [
  ["Doré", "#C9A24B"],
  ["Argenté", "#B9BEC4"],
  ["Cuivré", "#B8734A"],
  ["Or rose", "#D4A995"],
  ["Bronze", "#8C6A3F"],
  ["Perle", "#EDE6DA"],
  ["Noir mat", "#2A2724"],
];

export const CITIES: City[] = [
  { city: "Paris", country: "France", temp: 24, label: "Ensoleillé" },
  { city: "Lyon", country: "France", temp: 27, label: "Ensoleillé" },
  { city: "Marseille", country: "France", temp: 29, label: "Grand soleil" },
  { city: "Nantes", country: "France", temp: 21, label: "Éclaircies" },
  { city: "Lille", country: "France", temp: 18, label: "Nuageux" },
  { city: "Bordeaux", country: "France", temp: 26, label: "Ensoleillé" },
  { city: "Toulouse", country: "France", temp: 28, label: "Grand soleil" },
  { city: "Strasbourg", country: "France", temp: 20, label: "Éclaircies" },
  { city: "Rennes", country: "France", temp: 19, label: "Nuageux" },
  { city: "Nice", country: "France", temp: 30, label: "Grand soleil" },
  { city: "Bruxelles", country: "Belgique", temp: 19, label: "Nuageux" },
  { city: "Genève", country: "Suisse", temp: 22, label: "Éclaircies" },
  { city: "Montréal", country: "Canada", temp: 25, label: "Ensoleillé" },
  { city: "Casablanca", country: "Maroc", temp: 27, label: "Ensoleillé" },
  { city: "Londres", country: "Royaume-Uni", temp: 20, label: "Nuageux" },
  { city: "Barcelone", country: "Espagne", temp: 28, label: "Grand soleil" },
  { city: "Berlin", country: "Allemagne", temp: 21, label: "Éclaircies" },
  { city: "Dakar", country: "Sénégal", temp: 31, label: "Grand soleil" },
];

export const CONTACTS = ["Léa", "Chloé", "Sacha", "Mon copain"];

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

export function isBag(it: { cat?: CategoryKey; name: string }): boolean {
  return it.cat === "sac" || /\bsac\b/i.test(it.name);
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
