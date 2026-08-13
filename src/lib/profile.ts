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

export type Affinite = "Tons chauds" | "Tons froids" | "Les deux" | "Je ne sais pas";
export type Intensite = "Douces et discrètes" | "Profondes et intenses" | "Lumineuses" | "Un mélange";

export interface Profile {
  displayName: string;
  birthdate: string | null;
  gender: Gender | null;
  /** Palette personnelle (remplace l'ancien choix simple de 3 couleurs, recette 12/08/2026). */
  paletteBase: string | null;
  paletteNeutres: string[];
  paletteAccents: string[];
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
  paletteBase: null,
  paletteNeutres: [],
  paletteAccents: [],
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
  { key: "neutre", label: "Neutre / non-binaire" },
  { key: "non_precise", label: "Préfère ne pas dire" },
];

export function genderLabel(g: Gender | null): string {
  return GENDERS.find((x) => x.key === g)?.label ?? "";
}

/** Palette personnelle — construction guidée en 3 étapes (recette 12/08/2026, section 27). */
export const PAL_BASE: [string, string][] = [
  ["Noir", "#2A2724"],
  ["Marine", "#3A4152"],
  ["Gris", "#8E8B85"],
  ["Chocolat", "#5A4436"],
  ["Blanc / écru", "#EDE4D6"],
];
export const PAL_NEUTRES: [string, string][] = [
  ["Blanc", "#F7F4EE"],
  ["Crème", "#E7DCC8"],
  ["Sable", "#DCCFBC"],
  ["Beige", "#CDBBA2"],
  ["Taupe", "#A8967C"],
  ["Camel", "#C08A5E"],
  ["Gris", "#8E8B85"],
  ["Kaki", "#6E7358"],
];
export const PAL_ACCENTS: [string, string][] = [
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
export const MAX_PALETTE_NEUTRES = 3;
export const MAX_PALETTE_ACCENTS = 3;

export const AFFINITE_OPTIONS: Affinite[] = ["Tons chauds", "Tons froids", "Les deux", "Je ne sais pas"];
export const INTENSITE_OPTIONS: Intensite[] = ["Douces et discrètes", "Profondes et intenses", "Lumineuses", "Un mélange"];

/** Cherche le nom d'une teinte hex dans les 3 listes de la palette personnelle. */
export function paletteColorName(hex: string): string | null {
  return (
    PAL_BASE.find(([, h]) => h === hex)?.[0] ??
    PAL_NEUTRES.find(([, h]) => h === hex)?.[0] ??
    PAL_ACCENTS.find(([, h]) => h === hex)?.[0] ??
    null
  );
}

/** Toutes les teintes de la palette personnelle, à plat — alimente R-S10 et la préférence de sélection à la génération. */
export function paletteHexes(profile: Profile): string[] {
  return [profile.paletteBase, ...profile.paletteNeutres, ...profile.paletteAccents].filter(
    (x): x is string => Boolean(x)
  );
}

/** Résumé affichable de la palette personnelle : "Base : X · Neutres : Y, Z · Accents : ...". */
export function paletteSummary(profile: Profile): string {
  const parts: string[] = [];
  if (profile.paletteBase) parts.push("Base : " + paletteColorName(profile.paletteBase));
  if (profile.paletteNeutres.length) {
    parts.push("Neutres : " + profile.paletteNeutres.map(paletteColorName).filter(Boolean).join(", "));
  }
  if (profile.paletteAccents.length) {
    parts.push("Accents : " + profile.paletteAccents.map(paletteColorName).filter(Boolean).join(", "));
  }
  return parts.join(" · ") || "Non renseignée";
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
