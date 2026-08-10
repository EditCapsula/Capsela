export type Gender = "femme" | "homme" | "neutre" | "non_precise";

export interface ProfilePrefs {
  notifEnabled: boolean;
  notifTime: string;
  geoConsent: boolean;
  weatherFromGeo: boolean;
  unitSystem: "metric" | "imperial";
  workDays: string[];
  onVacation: boolean;
}

export interface Profile {
  displayName: string;
  birthdate: string | null;
  gender: Gender | null;
  /** Couleurs préférées : valeurs hex de la palette, 3 max. */
  favoriteColors: string[];
  tailleHaut: string | null;
  tailleBas: string | null;
  pointure: string | null;
  /** Style : choix unique (tableau pour évolution future). */
  styles: string[];
  morphology: string | null;
  city: string;
  completed: boolean;
  prefs: ProfilePrefs;
}

export const DEFAULT_PREFS: ProfilePrefs = {
  notifEnabled: true,
  notifTime: "08:00",
  geoConsent: true,
  weatherFromGeo: true,
  unitSystem: "metric",
  workDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"],
  onVacation: false,
};

export const EMPTY_PROFILE: Profile = {
  displayName: "",
  birthdate: null,
  gender: null,
  favoriteColors: [],
  tailleHaut: null,
  tailleBas: null,
  pointure: null,
  styles: [],
  morphology: null,
  city: "Paris",
  completed: false,
  prefs: DEFAULT_PREFS,
};

export const GENDERS: { key: Gender; label: string }[] = [
  { key: "femme", label: "Femme" },
  { key: "homme", label: "Homme" },
  { key: "neutre", label: "Neutre / non-binaire" },
  { key: "non_precise", label: "Préfère ne pas dire" },
];

export function genderLabel(g: Gender | null): string {
  return GENDERS.find((x) => x.key === g)?.label ?? "";
}

/** Palette du questionnaire goûts (27 teintes, sélection 3 max). */
export const PROFILE_PALETTE: [string, string][] = [
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

export const MAX_PROFILE_COLORS = 3;

export function colorNameFromHex(hex: string): string | null {
  return PROFILE_PALETTE.find(([, h]) => h === hex)?.[0] ?? null;
}

export const STYLE_OPTIONS = [
  "Minimaliste",
  "Bohème",
  "Classique chic",
  "Working girl",
  "Romantique",
  "Streetwear",
  "Casual chic",
  "Sportswear",
  "Preppy",
  "Rock",
  "Vintage / rétro",
  "Glamour",
  "Éclectique",
  "Nature / éco",
];

export const MORPHOLOGIES = [
  "Silhouette plutôt fine et droite",
  "Taille bien marquée",
  "Épaules plus larges que les hanches",
  "Hanches plus marquées que les épaules",
  "Silhouette plutôt ronde et régulière",
];

export const MORPHO_HINTS: Record<string, string> = {
  "Silhouette plutôt fine et droite":
    "Épaules, taille et hanches sont assez alignées, sans marquage particulier.",
  "Taille bien marquée":
    "Tes épaules et tes hanches ont une largeur proche, avec une taille nettement plus fine.",
  "Épaules plus larges que les hanches":
    "Tes épaules paraissent plus larges que tes hanches, forme en V.",
  "Hanches plus marquées que les épaules":
    "Tes hanches sont plus larges que tes épaules, forme en A.",
  "Silhouette plutôt ronde et régulière":
    "Le buste, la taille et les hanches suivent une même largeur généreuse, sans creux marqué.",
};

export const TAILLES_HAUT = ["XS", "S", "M", "L", "XL", "XXL"];
export const TAILLES_BAS = ["34", "36", "38", "40", "42", "44", "46"];
export const TAILLES_BAS_HOMME = ["38", "40", "42", "44", "46", "48", "50"];

export function taillesBasFor(gender: Gender | null): string[] {
  return gender === "homme" ? TAILLES_BAS_HOMME : TAILLES_BAS;
}

export function tailleBasLabelFor(gender: Gender | null): string {
  return gender === "homme" ? "Taille de bas (tour de taille)" : "Taille de bas";
}

export const WORK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
