import type {
  AccessoireType,
  BijouType,
  CategoryKey,
  City,
  DateContext,
  OccasionKey,
  SacType,
  Season,
  ShoeType,
  WorkMode,
} from "./types";

/** Source unique du numéro de version — partagée entre l'écran Profil et l'écran Informations légales, pour éviter toute divergence d'affichage. */
export const APP_VERSION = "1.4.0";

export const CATS: [CategoryKey, string, string][] = [
  ["haut", "Haut", "Hauts"],
  ["pull", "Pull / Gilet", "Pulls & gilets"],
  ["pantalon", "Pantalon", "Pantalons"],
  ["jean", "Jean", "Jeans"],
  ["jupe", "Jupe", "Jupes"],
  ["short", "Short", "Shorts"],
  ["robe", "Robe", "Robes"],
  ["combinaison", "Combinaison", "Combinaisons"],
  ["veste", "Veste / Blazer", "Vestes & blazers"],
  ["manteau", "Manteau", "Manteaux & extérieurs"],
  ["chaussures", "Chaussures", "Chaussures"],
  ["sac", "Sac", "Sacs"],
  ["bijou", "Bijou", "Bijoux"],
  ["accessoire", "Accessoire", "Accessoires"],
];

/** Sous-types génériques par catégorie — pré-suggérés à la saisie du nom, toujours facultatifs (seul le type de chaussure bloque, cf. SHOE_TYPES/R-B6). */
export const SUBTYPES: Partial<Record<CategoryKey, string[]>> = {
  haut: ["T-shirt", "Top", "Débardeur", "Chemise", "Chemisier", "Blouse", "Polo", "Sweat"],
  pull: ["Pull", "Gilet", "Cardigan", "Col roulé"],
  pantalon: ["Pantalon", "Tailleur", "Cargo", "Legging", "Jogging"],
  jean: ["Droit", "Slim", "Skinny", "Mom", "Boyfriend", "Wide leg", "Flare"],
  jupe: ["Mini", "Midi", "Longue", "Crayon", "Plissée"],
  short: ["Short", "Bermuda"],
  robe: ["Courte", "Midi", "Longue", "Chemise", "Portefeuille", "Pull"],
  combinaison: ["Combinaison", "Combishort", "Salopette"],
  veste: ["Blazer", "Veste légère", "Perfecto", "Veste en jean", "Surchemise"],
  manteau: ["Manteau", "Trench", "Caban", "Doudoune", "Parka", "Imperméable"],
};

/** Catégories du sous-type générique pour lesquelles il est obligatoire — aucune : seul le type de chaussure bloque (mécanisme séparé, cf. addShoeType/R-B6). */
export const SUBTYPE_REQUIRED: CategoryKey[] = [];

/** Catégories regroupées sous "bas" pour la taille, l'anti-répétition et le picker de tenue. */
export const BAS_CATS: CategoryKey[] = ["pantalon", "jean", "short"];

export const CATLABEL: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
export const CATPLURAL: Record<CategoryKey, string> = {} as Record<CategoryKey, string>;
CATS.forEach(([key, label, plural]) => {
  CATLABEL[key] = label;
  CATPLURAL[key] = plural;
});

/** Palette de couleurs pour les pièces du dressing (27 teintes) — indépendante de la palette personnelle du profil. */
export const PALETTE: [string, string][] = [
  ["Blanc", "#F7F4EE"],
  ["Blanc cassé", "#EDE4D6"],
  ["Crème", "#E7DCC8"],
  ["Sable", "#D9C9B2"],
  ["Camel", "#C08A5E"],
  ["Caramel", "#B4835A"],
  ["Terracotta", "#B4735A"],
  ["Rouille", "#A9613F"],
  ["Brique", "#9E5A3C"],
  ["Chocolat", "#7C5436"],
  ["Moutarde", "#C39A50"],
  ["Kaki", "#8A8560"],
  ["Vert sauge", "#9AA389"],
  ["Vert bouteille", "#3F5342"],
  ["Taupe", "#A8967C"],
  ["Beige rosé", "#D8C3B4"],
  ["Rose poudré", "#D3AE9F"],
  ["Corail", "#C9846A"],
  ["Gris clair", "#C7C2B9"],
  ["Gris", "#9B968F"],
  ["Gris anthracite", "#4B4A47"],
  ["Bleu ciel", "#A9BFCB"],
  ["Denim", "#5E6E7C"],
  ["Marine", "#3A4152"],
  ["Prune", "#5B3A4A"],
  ["Bordeaux", "#6E3B3A"],
  ["Noir", "#2A2724"],
];

export const SEASONS: Season[] = ["Printemps / Été", "Automne / Hiver", "Toutes saisons"];

/**
 * Pré-suggestion de saison à l'ajout d'une pièce : jamais appliquée d'office,
 * l'utilisateur doit toujours confirmer (contrainte produit).
 */
export function seasonSuggestion(cat: CategoryKey, name: string): Season | null {
  if (cat === "veste" || cat === "manteau" || cat === "pull") return "Automne / Hiver";
  if (/lin|short|débardeur|sandal|combinaison/.test((name || "").toLowerCase())) return "Printemps / Été";
  return null;
}

/**
 * Occasion, libellé, sous-libellé, niveau de formalité minimum requis
 * (0 = sport, 1 = décontracté, 3 = business casual, 4 = habillé), groupe
 * d'affichage (principale = mise en avant, secondaire = "Autres occasions")
 * — alimente R-B3 (incohérence occasion) et R-B6 (baskets non éligibles).
 * Taxonomie révisée (recette 12/08/2026) : "Événement professionnel" retiré
 * (couvert par Rendez-vous important / Travail-bureau), "Sortie festive"
 * ajoutée, "Date" a désormais une formalité variable selon son sous-contexte
 * (cf. DATE_CONTEXTS) — la valeur ci-dessous n'est qu'un repli par défaut.
 */
export const OCCASIONS: [OccasionKey, string, string, number, "principale" | "secondaire"][] = [
  ["quotidien", "Quotidien / Décontracté", "Courses, école, journée libre", 1, "principale"],
  ["travail_formel", "Travail / Bureau", "Journée de travail", 3, "principale"],
  ["entretien", "Rendez-vous important", "Entretien, réunion clé", 4, "principale"],
  ["date", "Date", "Tête-à-tête", 3, "principale"],
  ["soiree", "Sortie / Soirée", "Bar, dîner, entre amis", 3, "principale"],
  ["festive", "Sortie festive", "Club, anniversaire, bal", 3, "principale"],
  ["sport", "Sport", "Actif, technique", 0, "principale"],
  ["cocooning", "Cocooning / Maison", "Chez soi, détente", 0, "principale"],
  ["voyage", "Voyage / Déplacement", "Confortable, polyvalent", 1, "secondaire"],
  ["evenement_perso", "Événement / Cérémonie", "Mariage, baptême", 4, "secondaire"],
];

/** Sous-contexte de l'occasion "Date" — seul déterminant de sa formalité (recette 12/08/2026). */
export const DATE_CONTEXTS: [DateContext, number][] = [
  ["Restaurant / date romantique", 4],
  ["Verre", 1],
  ["Cinéma / balade", 1],
  ["Activité", 1],
  ["Soirée festive", 3],
];
export const DATE_CONTEXT_FORMALITY: Record<DateContext, number> = {} as Record<DateContext, number>;
DATE_CONTEXTS.forEach(([key, formality]) => {
  DATE_CONTEXT_FORMALITY[key] = formality;
});

/** Libellés courts pour les chips d'occasion à l'ajout d'une pièce (espace restreint). */
export const OCC_SHORT: Partial<Record<OccasionKey, string>> = {
  quotidien: "Quotidien",
  travail_formel: "Travail",
  entretien: "Rendez-vous",
  date: "Date",
  soiree: "Sortie",
  festive: "Sortie festive",
  evenement_perso: "Cérémonie",
};

export const OCC_LABELS: Record<OccasionKey, string> = { all: "Toutes" } as Record<OccasionKey, string>;
export const OCC_FORMALITY: Record<OccasionKey, number> = { all: 0 } as Record<OccasionKey, number>;
export const OCC_GROUP: Record<OccasionKey, "principale" | "secondaire"> = { all: "principale" } as Record<
  OccasionKey,
  "principale" | "secondaire"
>;
OCCASIONS.forEach(([key, label, , formality, group]) => {
  OCC_LABELS[key] = label;
  OCC_FORMALITY[key] = formality;
  OCC_GROUP[key] = group;
});

/**
 * Formalité minimum effective d'une occasion — "travail_formel" varie selon
 * le sous-choix Présentiel (business casual) / Télétravail (décontracté),
 * "date" varie selon son sous-contexte (cf. DATE_CONTEXTS), les autres
 * occasions gardent leur valeur fixe de OCC_FORMALITY.
 */
export function effectiveFormality(occasion: OccasionKey, workMode: WorkMode, dateContext: DateContext = "Verre"): number {
  if (occasion === "travail_formel") return workMode === "Télétravail" ? 1 : 3;
  if (occasion === "date") return DATE_CONTEXT_FORMALITY[dateContext] ?? 1;
  return OCC_FORMALITY[occasion] ?? 0;
}

/** Type de chaussure — obligatoire si catégorie = chaussures, nécessaire à R-B6. */
export const SHOE_TYPES: ShoeType[] = [
  "Baskets", "Bottines", "Bottes", "Escarpins", "Sandales", "Mocassins", "Ballerines", "Chaussures d'intérieur",
];
/** Sous-types — pré-suggérés à la saisie du nom, jamais bloquants. */
export const SAC_TYPES: SacType[] = ["Sac à main", "Cabas", "Bandoulière", "Pochette", "Sac à dos"];
export const BIJOU_TYPES: BijouType[] = ["Collier", "Boucles d'oreilles", "Bracelet", "Bague", "Montre"];
export const ACCESSOIRE_TYPES: AccessoireType[] = [
  "Ceinture", "Foulard", "Écharpe", "Chapeau", "Casquette", "Lunettes", "Collants", "Chaussettes hautes",
];

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
  if (d == null) return "Jamais porté";
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
