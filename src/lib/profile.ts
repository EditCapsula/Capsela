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
  /** Style : choix unique — un id de StyleId (tableau pour évolution future). */
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

/**
 * Style utilisateur — sélection unique, 8 ids stables et jamais renommés
 * (Tâche 7, arbitrages du 20/08/2026). Seuls le libellé, la description et
 * le visuel varient selon le genre (STYLE_CONFIG) ; l'id seul est
 * persisté sur `profiles.styles` — un libellé stocké deviendrait faux au
 * premier changement de genre.
 */
export const STYLE_IDS = [
  "minimaliste",
  "casual_chic",
  "classique_chic",
  "romantique",
  "boheme",
  "streetwear",
  "preppy",
  "glamour",
] as const;
export type StyleId = (typeof STYLE_IDS)[number];

/**
 * Pont vers le libellé français encore utilisé par la colonne `styles` du
 * catalogue (vestiaire_universel) et par STYLE_FIT (capsule.ts) — jamais
 * renommé côté catalogue : un id de profil utilisateur n'est pas un
 * libellé d'article, les deux évoluent indépendamment.
 */
export const STYLE_ID_TO_CATALOG_LABEL: Record<StyleId, string> = {
  minimaliste: "Minimaliste",
  casual_chic: "Casual chic",
  classique_chic: "Classique chic",
  romantique: "Romantique",
  boheme: "Bohème",
  streetwear: "Streetwear",
  preppy: "Preppy",
  glamour: "Glamour",
};

export interface StyleCardConfig {
  label: string;
  desc: string;
  /** Chemin déclaré explicitement, jamais dérivé de l'id — homme/creatif-artistique correspond à l'id romantique. */
  asset: string;
}

/**
 * Placeholders (aplat beige + nom du style) en attendant les 16 assets
 * réels — l'écran ne se livre qu'une fois ces visuels produits. Deux
 * libellés changent côté homme (romantique → Créatif / Artistique,
 * glamour → Élégant / Sophistiqué) ; les ids et les 6 autres libellés
 * sont identiques dans les deux genres.
 */
export const STYLE_CONFIG: Record<"femme" | "homme", Record<StyleId, StyleCardConfig>> = {
  femme: {
    minimaliste: { label: "Minimaliste", desc: "Épuré, essentiel et intemporel.", asset: "/styles/femme/minimaliste.svg" },
    casual_chic: { label: "Casual chic", desc: "Décontracté mais soigné, facile au quotidien.", asset: "/styles/femme/casual-chic.svg" },
    classique_chic: { label: "Classique chic", desc: "Élégant, féminin et toujours approprié.", asset: "/styles/femme/classique-chic.svg" },
    romantique: { label: "Romantique", desc: "Douceur, fluidité et détails féminins.", asset: "/styles/femme/romantique.svg" },
    boheme: { label: "Bohème", desc: "Naturel, libre et inspiré des voyages.", asset: "/styles/femme/boheme.svg" },
    streetwear: { label: "Streetwear", desc: "Urbain, confort et attitude décontractée.", asset: "/styles/femme/streetwear.svg" },
    preppy: { label: "Preppy", desc: "Soigné, frais et esprit collegiate.", asset: "/styles/femme/preppy.svg" },
    glamour: { label: "Glamour", desc: "Féminin, audacieux et résolument élégant.", asset: "/styles/femme/glamour.svg" },
  },
  homme: {
    minimaliste: { label: "Minimaliste", desc: "Épuré, essentiel et intemporel.", asset: "/styles/homme/minimaliste.svg" },
    casual_chic: { label: "Casual chic", desc: "Décontracté mais soigné, facile au quotidien.", asset: "/styles/homme/casual-chic.svg" },
    classique_chic: { label: "Classique chic", desc: "Élégant et toujours approprié.", asset: "/styles/homme/classique-chic.svg" },
    romantique: { label: "Créatif / Artistique", desc: "Original, expressif, hors des codes classiques.", asset: "/styles/homme/creatif-artistique.svg" },
    boheme: { label: "Bohème", desc: "Naturel, libre et inspiré des voyages.", asset: "/styles/homme/boheme.svg" },
    streetwear: { label: "Streetwear", desc: "Urbain, confort et attitude décontractée.", asset: "/styles/homme/streetwear.svg" },
    preppy: { label: "Preppy", desc: "Soigné, frais et esprit collegiate.", asset: "/styles/homme/preppy.svg" },
    glamour: { label: "Élégant / Sophistiqué", desc: "Raffiné, maîtrisé et résolument chic.", asset: "/styles/homme/elegant-sophistique.svg" },
  },
};

export function styleConfigFor(gender: Gender | null): Record<StyleId, StyleCardConfig> {
  return STYLE_CONFIG[gender === "homme" ? "homme" : "femme"];
}

export function styleLabel(id: string | undefined | null, gender: Gender | null): string {
  if (!id) return "";
  return styleConfigFor(gender)[id as StyleId]?.label ?? "";
}

/**
 * Morphologie — taxonomie féminine uniquement en P0 (Tâche 5, arbitrages du
 * 20/08/2026). Valeurs préfixées `f_` : "Rectangle" et "Triangle inversé"
 * seront un jour partagés avec une taxonomie homme non activée, mais avec
 * des règles de scoring différentes (R-S9) — le préfixe évite qu'un
 * changement de genre fasse silencieusement scorer une valeur sous la
 * mauvaise taxonomie. Le texte affiché vit dans MORPHOLOGY_LABELS, jamais
 * dans la valeur stockée.
 */
export const MORPHOLOGIES = ["f_sablier", "f_poire", "f_pomme", "f_rectangle", "f_triangle_inverse"];

export const MORPHOLOGY_LABELS: Record<string, string> = {
  f_sablier: "Taille bien marquée",
  f_poire: "Hanches plus marquées que les épaules",
  f_pomme: "Silhouette plutôt ronde et régulière",
  f_rectangle: "Silhouette plutôt fine et droite",
  f_triangle_inverse: "Épaules plus larges que les hanches",
};

export function morphologyLabel(m: string | null): string {
  return MORPHOLOGY_LABELS[m ?? ""] ?? "";
}

export const MORPHO_HINTS: Record<string, string> = {
  f_rectangle: "Épaules, taille et hanches sont assez alignées, sans marquage particulier.",
  f_sablier: "Tes épaules et tes hanches ont une largeur proche, avec une taille nettement plus fine.",
  f_triangle_inverse: "Tes épaules paraissent plus larges que tes hanches, forme en V.",
  f_poire: "Tes hanches sont plus larges que tes épaules, forme en A.",
  f_pomme: "Le buste, la taille et les hanches suivent une même largeur généreuse, sans creux marqué.",
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
