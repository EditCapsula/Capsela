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
 * URL publique Storage des visuels de style (recette 20/08/2026 — génération
 * OpenAI, script `generate-style-visuals.mjs`, bucket `catalog-images`
 * existant, préfixe dédié `style-visuals/`, jamais le pipeline catalogue —
 * cf. en-tête du script). `NEXT_PUBLIC_SUPABASE_URL` est déjà un env public
 * (lu ainsi dans `supabase.ts`), sûr à exposer côté client.
 */
const STYLE_VISUALS_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog-images/style-visuals`
  : "";
function styleVisualUrl(gender: "femme" | "homme", slug: string): string {
  return STYLE_VISUALS_BASE ? `${STYLE_VISUALS_BASE}/${gender}/${slug}.webp` : "";
}

/**
 * Deux libellés changent côté homme (romantique → Créatif / Artistique,
 * glamour → Élégant / Sophistiqué) ; les ids et les 6 autres libellés sont
 * identiques dans les deux genres. `romantique`/`glamour` gardent une entrée
 * homme (pour que `styleLabel()` ne casse jamais sur une valeur historique)
 * mais n'ont volontairement PAS de visuel ni de carte dans la grille
 * d'onboarding homme — cf. `EXPOSED_STYLE_IDS` plus bas, décision arrêtée le
 * 20/08/2026, aucun équivalent masculin à ces deux styles.
 */
export const STYLE_CONFIG: Record<"femme" | "homme", Record<StyleId, StyleCardConfig>> = {
  femme: {
    minimaliste: { label: "Minimaliste", desc: "Épuré, essentiel et intemporel.", asset: styleVisualUrl("femme", "minimaliste") },
    casual_chic: { label: "Casual chic", desc: "Décontracté mais soigné, facile au quotidien.", asset: styleVisualUrl("femme", "casual-chic") },
    classique_chic: { label: "Classique chic", desc: "Élégant, féminin et toujours approprié.", asset: styleVisualUrl("femme", "classique-chic") },
    romantique: { label: "Romantique", desc: "Douceur, fluidité et détails féminins.", asset: styleVisualUrl("femme", "romantique") },
    boheme: { label: "Bohème", desc: "Naturel, libre et inspiré des voyages.", asset: styleVisualUrl("femme", "boheme") },
    streetwear: { label: "Streetwear", desc: "Urbain, confort et attitude décontractée.", asset: styleVisualUrl("femme", "streetwear") },
    preppy: { label: "Preppy", desc: "Soigné, frais et esprit collegiate.", asset: styleVisualUrl("femme", "preppy") },
    glamour: { label: "Glamour", desc: "Sophistiqué, audacieux et résolument élégant.", asset: styleVisualUrl("femme", "glamour") },
  },
  homme: {
    minimaliste: { label: "Minimaliste", desc: "Épuré, essentiel et intemporel.", asset: styleVisualUrl("homme", "minimaliste") },
    casual_chic: { label: "Casual chic", desc: "Décontracté mais soigné, facile au quotidien.", asset: styleVisualUrl("homme", "casual-chic") },
    classique_chic: { label: "Classique chic", desc: "Élégant et toujours approprié.", asset: styleVisualUrl("homme", "classique-chic") },
    // Pas de visuel — jamais affiché dans la grille homme (EXPOSED_STYLE_IDS), entrée conservée uniquement pour styleLabel().
    romantique: { label: "Créatif / Artistique", desc: "Original, expressif, hors des codes classiques.", asset: "" },
    boheme: { label: "Bohème", desc: "Naturel, libre et inspiré des voyages.", asset: styleVisualUrl("homme", "boheme") },
    streetwear: { label: "Streetwear", desc: "Urbain, confort et attitude décontractée.", asset: styleVisualUrl("homme", "streetwear") },
    preppy: { label: "Preppy", desc: "Soigné, frais et esprit collegiate.", asset: styleVisualUrl("homme", "preppy") },
    // Pas de visuel — jamais affiché dans la grille homme (EXPOSED_STYLE_IDS), entrée conservée uniquement pour styleLabel().
    glamour: { label: "Élégant / Sophistiqué", desc: "Raffiné, maîtrisé et résolument chic.", asset: "" },
  },
};

/**
 * Styles réellement proposés dans la grille d'onboarding par genre (visuels
 * de style, recette 20/08/2026) — Homme n'a pas d'équivalent à Romantique/
 * Glamour, décision arrêtée le 20/08/2026 : jamais un 9e id, jamais une
 * conversion, ces deux familles ne sont simplement pas proposées côté Homme.
 */
export const EXPOSED_STYLE_IDS: Record<"femme" | "homme", StyleId[]> = {
  femme: [...STYLE_IDS],
  homme: STYLE_IDS.filter((id) => id !== "romantique" && id !== "glamour"),
};

export function exposedStyleIds(gender: Gender | null): StyleId[] {
  return EXPOSED_STYLE_IDS[gender === "homme" ? "homme" : "femme"];
}

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

/**
 * Champs dont les valeurs valides dépendent du genre — mécanique
 * générique de revalidation (recette 20/08/2026). Branché sur la
 * morphologie pour l'instant.
 *
 * ⚠️ Depuis la tâche "visuels de l'écran Style" (20/08/2026), Homme n'expose
 * plus que 6 styles sur 8 (EXPOSED_STYLE_IDS) — le style est donc redevenu
 * un candidat légitime pour ce mécanisme (un profil Femme avec `romantique`/
 * `glamour` qui passe à Homme a désormais une valeur réellement hors des
 * options proposées). Explicitement PAS branché ici : cette tâche visuels
 * excluait toute modification des règles de revalidation de son périmètre.
 * À traiter dans une tâche dédiée, pas silencieusement au fil d'une autre.
 *
 * État "à revalider" CALCULÉ, jamais stocké : dérivé de
 * valeur_stockée ∉ valeurs_autorisées(genre_courant) à chaque lecture,
 * jamais une colonne booléenne (source de désynchronisation à chaque
 * écriture qui oublierait de la mettre à jour).
 *
 * Cas particulier — `valuesFor(genre)` vide : le champ n'a AUCUNE valeur
 * possible pour ce genre (morphologie côté Homme, taxonomie non activée
 * en P0, Tâche 4), ce n'est pas juste "à revalider avec un mauvais choix
 * actuel". Traité comme NON APPLICABLE : effacé silencieusement au
 * changement de genre, jamais de modale ni de bloc "à compléter" — il
 * n'existe aucun écran de resaisie pour ce genre, en proposer un
 * violerait la Tâche 4 ("aucun écran, rien n'indique qu'une étape a été
 * retirée pour Homme").
 */
export interface GenderDependentField {
  key: string;
  /** Utilisé dans la modale d'invitation et le bloc "à compléter". */
  fieldLabel: string;
  ctaLabel: string;
  get: (p: Profile) => string | null;
  clear: () => Partial<Profile>;
  valuesFor: (gender: Gender | null) => readonly string[];
}

export const GENDER_DEPENDENT_FIELDS: GenderDependentField[] = [
  {
    key: "morphology",
    fieldLabel: "Ta silhouette",
    ctaLabel: "ENREGISTRER MA MORPHOLOGIE",
    get: (p) => p.morphology,
    clear: () => ({ morphology: null }),
    valuesFor: (g) => (g === "femme" ? MORPHOLOGIES : []),
  },
];

/** Le champ a de vraies valeurs possibles pour ce genre, et la valeur stockée n'en fait pas partie. */
export function fieldNeedsRevalidation(field: GenderDependentField, profile: Profile): boolean {
  const value = field.get(profile);
  if (!value) return false;
  const allowed = field.valuesFor(profile.gender);
  return allowed.length > 0 && !allowed.includes(value);
}

/** Le champ n'a aucune valeur possible pour ce genre (feature non activée) — à effacer silencieusement, jamais à revalider. */
export function fieldNotApplicable(field: GenderDependentField, profile: Profile): boolean {
  return !!field.get(profile) && field.valuesFor(profile.gender).length === 0;
}

export function profileNeedsRevalidation(profile: Profile): boolean {
  return GENDER_DEPENDENT_FIELDS.some((f) => fieldNeedsRevalidation(f, profile));
}

/**
 * À appliquer au changement de genre : (a) efface silencieusement les
 * champs non applicables au nouveau genre, (b) retourne le premier champ
 * qui reste "à revalider" après cet effacement (valeurs possibles non
 * vides, valeur stockée hors de cet ensemble) pour déclencher l'invitation
 * immédiate — ou `null` si rien à revalider.
 */
export function applyGenderChange(profile: Profile, gender: Gender): { patch: Partial<Profile>; revalidate: GenderDependentField | null } {
  let patch: Partial<Profile> = { gender };
  const next = { ...profile, gender };
  GENDER_DEPENDENT_FIELDS.forEach((f) => {
    if (fieldNotApplicable(f, next)) patch = { ...patch, ...f.clear() };
  });
  const after = { ...next, ...patch };
  const revalidate = GENDER_DEPENDENT_FIELDS.find((f) => fieldNeedsRevalidation(f, after)) ?? null;
  return { patch, revalidate };
}

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
