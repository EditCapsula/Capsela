/** Genre — 2 valeurs (Tâche 3, arbitrages du 20/08/2026 : "Neutre / non-binaire" et "Préfère ne pas dire" retirés). */
export type Gender = "femme" | "homme";

export interface ProfilePrefs {
  notifEnabled: boolean;
  notifTime: string;
  geoConsent: boolean;
  weatherFromGeo: boolean;
  unitSystem: "metric" | "imperial";
  workDays: string[];
  onVacation: boolean;
}

export type Affinite = "Tons chauds" | "Tons froids" | "Les deux" | "Je ne sais pas";
export type Intensite = "Douces et discrètes" | "Profondes et intenses" | "Lumineuses" | "Un mélange";

export interface Profile {
  displayName: string;
  birthdate: string | null;
  gender: Gender | null;
  /** Palette personnelle (recette 12/08/2026, champ unique depuis le 20/08/2026 — fusion base/neutres/accents, Tâche 8). */
  paletteCouleurs: string[];
  paletteAffinite: Affinite | null;
  paletteIntensite: Intensite | null;
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
  paletteCouleurs: [],
  paletteAffinite: null,
  paletteIntensite: null,
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
];

export function genderLabel(g: Gender | null): string {
  return GENDERS.find((x) => x.key === g)?.label ?? "";
}

/**
 * Palette personnelle — un seul champ multi-sélection (Tâche 8, arbitrages
 * du 20/08/2026 : fusion de PAL_BASE/PAL_NEUTRES/PAL_ACCENTS, qui n'étaient
 * déjà distingués par aucune logique en aval). Ordre conservé (neutres
 * sombres → neutres clairs → couleurs vives) pour une progression lisible
 * dans la grille ; dédupliqué (« Gris » #8E8B85 existait dans deux listes).
 */
export const PAL_COULEURS: [string, string][] = [
  ["Noir", "#2A2724"],
  ["Marine", "#3A4152"],
  ["Gris", "#8E8B85"],
  ["Chocolat", "#5A4436"],
  ["Blanc / écru", "#EDE4D6"],
  ["Blanc", "#F7F4EE"],
  ["Crème", "#E7DCC8"],
  ["Sable", "#DCCFBC"],
  ["Beige", "#CDBBA2"],
  ["Taupe", "#A8967C"],
  ["Camel", "#C08A5E"],
  ["Kaki", "#6E7358"],
  ["Terracotta", "#A66950"],
  ["Bordeaux", "#6E3B3A"],
  ["Prune", "#5B3A4A"],
  ["Rouge", "#933B33"],
  ["Rose poudré", "#D6A9A0"],
  ["Corail", "#CF7358"],
  ["Moutarde", "#C29A3D"],
  ["Vert bouteille", "#3C5347"],
  ["Bleu", "#4A6280"],
];
export const MIN_PALETTE_COULEURS = 1;
export const MAX_PALETTE_COULEURS = 6;

export const AFFINITE_OPTIONS: Affinite[] = ["Tons chauds", "Tons froids", "Les deux", "Je ne sais pas"];
export const INTENSITE_OPTIONS: Intensite[] = ["Douces et discrètes", "Profondes et intenses", "Lumineuses", "Un mélange"];

/** Cherche le nom d'une teinte hex dans la palette personnelle. */
export function paletteColorName(hex: string): string | null {
  return PAL_COULEURS.find(([, h]) => h === hex)?.[0] ?? null;
}

/** Toutes les teintes de la palette personnelle — alimente R-S10 et la préférence de sélection à la génération. */
export function paletteHexes(profile: Profile): string[] {
  return profile.paletteCouleurs.filter((x): x is string => Boolean(x));
}

/** Résumé affichable de la palette personnelle : "Couleurs : X, Y, Z". */
export function paletteSummary(profile: Profile): string {
  if (!profile.paletteCouleurs.length) return "Non renseignée";
  return "Couleurs : " + profile.paletteCouleurs.map(paletteColorName).filter(Boolean).join(", ");
}

export const STYLE_OPTIONS = [
  "Minimaliste",
  "Casual chic",
  "Classique chic",
  "Romantique",
  "Bohème",
  "Streetwear",
  "Preppy",
  "Glamour",
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

/** Plage élargie au-delà du standard S–XL jusqu'aux grandes tailles (recette 13/08/2026). */
export const TAILLES_HAUT = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL", "5XL"];
export const TAILLES_BAS = ["34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "56"];
export const TAILLES_BAS_HOMME = ["38", "40", "42", "44", "46", "48", "50", "52", "54", "56", "58", "60"];

export function taillesBasFor(gender: Gender | null): string[] {
  return gender === "homme" ? TAILLES_BAS_HOMME : TAILLES_BAS;
}

export function tailleBasLabelFor(gender: Gender | null): string {
  return gender === "homme" ? "Taille de bas (tour de taille)" : "Taille de bas";
}

export const WORK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
