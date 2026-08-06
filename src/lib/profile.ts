export type Gender = "femme" | "homme" | "neutre" | "non_precise";

export interface Profile {
  displayName: string;
  gender: Gender | null;
  /** Taille en cm. */
  heightCm: number | null;
  /** Taille de confection (XS–XXL). */
  clothingSize: string | null;
  /** Pointure EU. */
  shoeSize: number | null;
  /** Styles préférés (multi). */
  styles: string[];
  morphology: string | null;
  /** Goûts : couleurs préférées (noms de la palette). */
  favoriteColors: string[];
  /** Goûts : matières / préférences libres (multi). */
  tastes: string[];
  completed: boolean;
}

export const EMPTY_PROFILE: Profile = {
  displayName: "",
  gender: null,
  heightCm: null,
  clothingSize: null,
  shoeSize: null,
  styles: [],
  morphology: null,
  favoriteColors: [],
  tastes: [],
  completed: false,
};

export const GENDERS: { key: Gender; label: string }[] = [
  { key: "femme", label: "Femme" },
  { key: "homme", label: "Homme" },
  { key: "neutre", label: "Neutre / non-binaire" },
  { key: "non_precise", label: "Préfère ne pas dire" },
];

export const CLOTHING_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

export const STYLE_OPTIONS = [
  "Casual",
  "Classique",
  "Minimaliste",
  "Bohème",
  "Chic",
  "Streetwear",
  "Sportswear",
  "Vintage",
  "Romantique",
  "Rock",
];

export const MORPHOLOGIES: { key: string; label: string; hint: string }[] = [
  { key: "A", label: "A · Pyramide", hint: "Épaules plus étroites que les hanches" },
  { key: "V", label: "V · Pyramide inversée", hint: "Épaules plus larges que les hanches" },
  { key: "H", label: "H · Rectangle", hint: "Épaules, taille et hanches alignées" },
  { key: "X", label: "X · Sablier", hint: "Taille marquée, épaules et hanches équilibrées" },
  { key: "O", label: "O · Ronde", hint: "Courbes généreuses, taille peu marquée" },
];

export const TASTE_OPTIONS = [
  "Matières naturelles",
  "Coupes amples",
  "Coupes ajustées",
  "Unis",
  "Imprimés",
  "Tons neutres",
  "Couleurs vives",
  "Pièces de seconde main",
];
