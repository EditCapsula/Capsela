import { miseEnValeurDuGenre, miseEnValeurPosee, PREFERENCES_SILHOUETTE_VIDES, type PreferencesSilhouette } from "./preferencesSilhouette";
import { COLORIMETRIE_VIDE, type Colorimetrie } from "./colorimetrie";
export { PAL_COULEURS } from "./palCouleurs";
import { PAL_COULEURS } from "./palCouleurs";
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
  /**
   * LEGACY, LECTURE SEULE. L'étape « tons chauds / tons froids » est retirée
   * de l'onboarding le 25/09/2026 : une affinité déclarée n'est pas une
   * colorimétrie, et la laisser côtoyer une vraie analyse entretenait la
   * confusion. La colonne reste en base et reste lue — on n'écrase pas ce
   * que des profils ont déjà renseigné — mais plus rien ne l'écrit.
   */
  paletteAffinite: Affinite | null;
  paletteIntensite: Intensite | null;
  /** Résultat d'analyse colorimétrique, ou `{ statut: "aucune" }`. */
  colorimetrie: Colorimetrie;
  tailleHaut: string | null;
  tailleBas: string | null;
  pointure: string | null;
  /** Style : choix unique — un id de StyleId (tableau pour évolution future). */
  styles: string[];
  morphology: string | null;
  city: string;
  completed: boolean;
  prefs: ProfilePrefs;
  /** Mise en valeur et coupes préférées (31/10/2026, preferencesSilhouette.ts) : `null` par champ = jamais posé. */
  preferencesSilhouette: PreferencesSilhouette;
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
  colorimetrie: COLORIMETRIE_VIDE,
  tailleHaut: null,
  tailleBas: null,
  pointure: null,
  styles: [],
  morphology: null,
  city: "Paris",
  completed: false,
  prefs: DEFAULT_PREFS,
  preferencesSilhouette: PREFERENCES_SILHOUETTE_VIDES,
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
 * déjà distingués par aucune logique en aval), dédupliqué (« Gris » #8E8B85
 * existait dans deux listes). Ordre du nuancier figé par le brief UX
 * "Ta palette" du 24/08/2026 (neutres sombres → neutres clairs → bruns →
 * couleurs vives) — ne pas réordonner sans revalidation, la grille 4
 * colonnes de ProfileSetupScreen s'appuie sur cet ordre exact.
 */
export const MIN_PALETTE_COULEURS = 1;
// Plus de maximum depuis le 30/10/2026 (demandé : « enlève la limite de couleurs, l'utilisateur peut choisir tout ce qu'il veut ») ;
// six auparavant (brief « Ta palette » du 24/08/2026). La palette reste une préférence molle du moteur (R-S10).

export const AFFINITE_OPTIONS: Affinite[] = ["Tons chauds", "Tons froids", "Les deux", "Je ne sais pas"];
export const INTENSITE_OPTIONS: Intensite[] = ["Douces et discrètes", "Profondes et intenses", "Lumineuses", "Un mélange"];

/** Hex d'une teinte de la palette personnelle, par son nom — pour ne pas recopier les valeurs. */
const pal = (nom: string): string => {
  const hex = PAL_COULEURS.find(([n]) => n === nom)?.[1];
  if (!hex) throw new Error(`Teinte absente de PAL_COULEURS : ${nom}`);
  return hex;
};

/**
 * LA REPRÉSENTATION VISUELLE DE CHAQUE INTENSITÉ (30/09/2026, brief
 * « Intensité des couleurs ») : une phrase et cinq pastilles, affichées à
 * côté du libellé dans l'onboarding, et `libelleRecap` quand le libellé de
 * l'option ne se suffit pas au récapitulatif. Purement illustratif — l'option
 * enregistrée reste le libellé d'INTENSITE_OPTIONS, et aucune de ces teintes
 * n'entre dans le moteur ni dans la palette de l'utilisatrice.
 *
 * Les teintes viennent de PAL_COULEURS quand elle en a une qui convient ;
 * sinon (tons clairs désaturés, couleurs lumineuses, que la palette
 * personnelle n'a pas), une valeur propre à l'illustration, choisie pour
 * rester élégante : aucune teinte néon.
 */
/**
 * `etoffe` (31/10/2026, arbitrage : les 4 options gardées, visuel d'étoffe à la place des pastilles sur l'étape) : une étoffe drapée
 * montre le REGISTRE sans se lire comme une couleur choisie. Les pastilles restent pour le récapitulatif et « Ta palette ».
 */
export const INTENSITE_VISUELS: Record<Intensite, { description: string; pastilles: string[]; etoffe: string; libelleRecap?: string }> = {
  "Douces et discrètes": {
    etoffe: "/onboarding/intensite/douces.webp",
    description: "Des tons neutres et pastel, pour des looks tout en douceur.",
    // crème, beige clair, vieux rose, taupe clair, sauge très désaturée
    pastilles: [pal("Crème"), pal("Sable"), pal("Rose poudré"), "#BDB2A3", "#B8BEAF"],
  },
  "Profondes et intenses": {
    etoffe: "/onboarding/intensite/profondes.webp",
    description: "Des couleurs riches et affirmées, pour plus de caractère.",
    pastilles: [pal("Bordeaux"), pal("Marine"), pal("Vert bouteille"), pal("Chocolat"), pal("Prune")],
  },
  Lumineuses: {
    etoffe: "/onboarding/intensite/lumineuses.webp",
    description: "Des teintes claires et éclatantes, pour des looks qui illuminent.",
    // jaune soleil, corail, rose vif, turquoise, bleu lumineux
    pastilles: ["#E6C24F", "#E57C60", "#D65C82", "#3E9E9A", "#5B93CF"],
  },
  "Un mélange": {
    etoffe: "/onboarding/intensite/melange.webp",
    description: "J'aime varier entre des tons doux, intenses et lumineux.",
    // Au récapitulatif, « Un mélange » ne dit pas de quoi (30/09/2026, demandé) :
    // on y écrit ce que le mélange contient. La valeur enregistrée ne change pas.
    libelleRecap: "Tons doux, intenses et lumineux",
    // neutre clair, pastel, profonde, naturelle, lumineuse
    pastilles: [pal("Crème"), pal("Rose poudré"), pal("Bordeaux"), pal("Kaki"), "#E57C60"],
  },
};

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
 * Style utilisateur — sélection unique, 9 ids stables et jamais renommés (8, puis `creatif` le 30/10/2026)
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
  // 9e style (30/10/2026, validé par la propriétaire : un id `creatif` commun aux deux genres), qui lève l'arbitrage du 20/08/2026
  // « jamais un 9e id ». Référentiel : les capsules Créatif femme et homme (docs/capsules/creatif/).
  "creatif",
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
  creatif: "Créatif",
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
/**
 * VISUELS DES STYLES HOMME (fournis le 30/10/2026, demandé : « mets à jour les visuels des styles hommes partout où ils apparaissent ») :
 * flat lays servis par l'app (public/images/styles/homme/), au format des visuels femme — portrait 3:4, 900 × 1200 WebP — pour que les
 * grilles de l'étape Style soient identiques dans les deux genres. Générés en 1024 × 1536, élargis de 64 px de fond de chaque côté
 * (bord recopié) plutôt que recoupés en hauteur : aucun élément coupé, même échelle sur toute la série.
 */
const VISUEL_STYLE_HOMME = (slug: string) => `/images/styles/homme/${slug}.webp`;

export const STYLE_CONFIG: Record<"femme" | "homme", Record<StyleId, StyleCardConfig>> = {
  femme: {
    minimaliste: { label: "Minimaliste", desc: "Épuré, essentiel et intemporel.", asset: styleVisualUrl("femme", "minimaliste") },
    casual_chic: { label: "Casual chic", desc: "Décontracté mais soigné, facile au quotidien.", asset: styleVisualUrl("femme", "casual-chic") },
    classique_chic: { label: "Classique chic", desc: "Élégant, féminin et toujours approprié.", asset: styleVisualUrl("femme", "classique-chic") },
    romantique: { label: "Romantique", desc: "Douceur, fluidité et détails féminins.", asset: styleVisualUrl("femme", "romantique") },
    boheme: { label: "Bohème", desc: "Naturel, libre et inspiré des voyages.", asset: styleVisualUrl("femme", "boheme") },
    streetwear: { label: "Streetwear", desc: "Urbain, confort et attitude décontractée.", asset: styleVisualUrl("femme", "streetwear") },
    preppy: { label: "Preppy", desc: "Soigné, frais et esprit collégial.", asset: styleVisualUrl("femme", "preppy") },
    glamour: { label: "Glamour", desc: "Sophistiqué, audacieux et résolument élégant.", asset: styleVisualUrl("femme", "glamour") },
    creatif: { label: "Créatif", desc: "Imprimés, couleurs et lignes inattendues.", asset: "/images/styles/creatif.webp" },
  },
  homme: {
    minimaliste: { label: "Minimaliste", desc: "Épuré, essentiel et intemporel.", asset: VISUEL_STYLE_HOMME("minimaliste") },
    casual_chic: { label: "Casual chic", desc: "Décontracté mais soigné, facile au quotidien.", asset: VISUEL_STYLE_HOMME("casual-chic") },
    classique_chic: { label: "Classique chic", desc: "Élégant et toujours approprié.", asset: VISUEL_STYLE_HOMME("classique-chic") },
    // Pas de visuel — jamais affiché dans la grille homme (EXPOSED_STYLE_IDS), entrée conservée uniquement pour styleLabel().
    // Inchangée au passage de Créatif (30/10/2026, arbitré : « tu ne touches pas au style romantique caché de l'homme ») : Créatif est
    // un id à part, `creatif`.
    romantique: { label: "Créatif / Artistique", desc: "Original, expressif, hors des codes classiques.", asset: "" },
    boheme: { label: "Bohème", desc: "Naturel, libre et inspiré des voyages.", asset: VISUEL_STYLE_HOMME("boheme") },
    streetwear: { label: "Streetwear", desc: "Urbain, confort et attitude décontractée.", asset: VISUEL_STYLE_HOMME("streetwear") },
    preppy: { label: "Preppy", desc: "Soigné, frais et esprit collégial.", asset: VISUEL_STYLE_HOMME("preppy") },
    // Pas de visuel — jamais affiché dans la grille homme (EXPOSED_STYLE_IDS), entrée conservée uniquement pour styleLabel().
    glamour: { label: "Élégant / Sophistiqué", desc: "Raffiné, maîtrisé et résolument chic.", asset: "" },
    creatif: { label: "Créatif / Artistique", desc: "Original, expressif, hors des codes classiques.", asset: VISUEL_STYLE_HOMME("creatif") },
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

/**
 * VISUELS DE L'ÉTAPE « STYLE », CÔTÉ FEMME (fournis le 25/09/2026) — des
 * flat lays éditoriaux, sans personne, au format portrait 900 × 1200 (3:4
 * exact), servis depuis public/images/styles/. Fournis en PNG (12,2 Mo les
 * huit), convertis en WebP qualité 82 (842 Ko) : écart mesuré ≥ 35,7 dB de
 * PSNR sur l'image la plus détaillée, sans différence visible à 100 %.
 *
 * UNE RÉFÉRENCE PROPRE À CET ÉCRAN, et non un remplacement de
 * STYLE_CONFIG[…].asset : ces images-là sont aussi lues par les cartes
 * « Explorer d'autres styles » (TenuesScreen) et par l'onboarding d'accueil
 * (OnboardingScreen), hors du périmètre demandé. Les ids restent ceux de
 * StyleId : aucune donnée métier ne change.
 */
export const VISUELS_ETAPE_STYLE_FEMME: Record<StyleId, string> = {
  minimaliste: "/images/styles/minimaliste.webp",
  casual_chic: "/images/styles/casual-chic.webp",
  classique_chic: "/images/styles/classique-chic.webp",
  romantique: "/images/styles/romantique.webp",
  boheme: "/images/styles/boheme.webp",
  streetwear: "/images/styles/streetwear.webp",
  preppy: "/images/styles/preppy.webp",
  glamour: "/images/styles/glamour.webp",
  creatif: "/images/styles/creatif.webp",
};

export function styleConfigFor(gender: Gender | null): Record<StyleId, StyleCardConfig> {
  return STYLE_CONFIG[gender === "homme" ? "homme" : "femme"];
}

export function styleLabel(id: string | undefined | null, gender: Gender | null): string {
  if (!id) return "";
  return styleConfigFor(gender)[id as StyleId]?.label ?? "";
}

/**
 * DEUX STYLES AU PLUS (05/10/2026, demandé : « choisir 2 ou 3 styles » ; arbitré à 2 : au-delà, la capsule — environ 30
 * pièces hors sport — se dilue entre trop d'univers, et l'effet de 3 styles n'est pas mesuré). Le PREMIER choisi est le
 * style principal : c'est lui que lisent les écrans à un seul style (exploration d'autres styles, styleCoverage) ; le
 * second élargit seulement le catalogue d'où la capsule tire ses pièces (computeDefaultCapsule : « l'un des styles »).
 * `profiles.styles` est déjà une liste : aucune migration. Reprend un essai de multi-sélection du 20/08/2026, abandonné
 * alors sans raison écrite.
 */
export const MAX_STYLES = 2;

/**
 * Le choix d'un style : un style choisi se retire (le second devient alors le principal) ; un style absent s'ajoute ; à
 * `MAX_STYLES`, il remplace le second — jamais le principal, qui ne change que si on le retire.
 */
/**
 * Les styles qui existent pour ce genre (14/10/2026, signalé : un profil passé de Femme à Homme gardait « Glamour », absent des styles
 * Homme — invisible à l'écran mais compté dans la limite de deux : impossible d'en choisir un autre). Les ids hors genre sont écartés ;
 * l'ordre est gardé, donc le principal reste le principal s'il existe encore.
 */
export function stylesDuGenre(styles: readonly string[], gender: Gender | null): string[] {
  const permis = new Set<string>(exposedStyleIds(gender));
  return styles.filter((s) => permis.has(s));
}


export function basculerStyle(styles: readonly string[], id: string): string[] {
  if (styles.includes(id)) return styles.filter((s) => s !== id);
  if (styles.length >= MAX_STYLES) return [...styles.slice(0, MAX_STYLES - 1), id];
  return [...styles, id];
}

/** Les libellés des styles choisis, dans l'ordre du choix, sans les ids inconnus du genre. */
export function stylesLabels(styles: readonly string[], gender: Gender | null): string[] {
  return styles.map((id) => styleLabel(id, gender)).filter(Boolean);
}

/** « Preppy », ou « Preppy et Casual chic » : le texte d'un profil à un ou deux styles. */
export function libelleStyles(styles: readonly string[], gender: Gender | null): string {
  return stylesLabels(styles, gender).join(" et ");
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

/**
 * La forme courte d'une silhouette, pour la nommer au fil d'une phrase.
 *
 * `MORPHOLOGY_LABELS` décrit la silhouette en une proposition entière
 * (« Hanches plus marquées que les épaules ») : juste dans une fiche de
 * profil, bancal inséré dans une phrase de l'écran Capsule. Ces deux formes
 * reprennent le vocabulaire que `MORPHO_HINTS` emploie déjà — « forme en A »,
 * « forme en V » — plutôt que d'inventer un nom, et surtout plutôt que de
 * réintroduire les noms de fruits que le projet a écartés.
 *
 * Seules les morphologies qui orientent réellement la sélection ont besoin
 * d'être nommées ainsi (cf. MORPHOLOGIES_AVEC_DIRECTION, capsule.ts) — un test
 * verrouille que la table les couvre toutes, pour qu'aucune ne s'affiche vide.
 */
export const SILHOUETTE_FORME: Record<string, string> = {
  f_poire: "en A",
  f_triangle_inverse: "en V",
};

export function silhouetteForme(m: string | null): string {
  return SILHOUETTE_FORME[m ?? ""] ?? "";
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
  // Un style que le nouveau genre ne propose pas n'est plus un choix valable : il est retiré, au lieu de rester caché et de bloquer la sélection.
  const stylesValides = stylesDuGenre(profile.styles, gender);
  if (stylesValides.length !== profile.styles.length) patch = { ...patch, styles: stylesValides };
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

/**
 * COMPLÉTUDE DU PROFIL STYLE (refonte du profil, 25/09/2026).
 *
 * Aucun pourcentage inventé : la complétude est le rapport entre les champs
 * du profil style qui s'APPLIQUENT à cette personne et ceux qui sont
 * renseignés. Un champ sans aucune valeur possible pour son genre n'est pas
 * « manquant », il n'existe pas pour elle : la morphologie côté Homme
 * (taxonomie non activée, Tâche 4) ou tant que le genre n'est pas connu —
 * même règle que GENDER_DEPENDENT_FIELDS.valuesFor.
 *
 * Une valeur « à revalider » (stockée mais hors des valeurs de son genre)
 * compte comme manquante : elle n'est plus une réponse valable.
 *
 * Les tailles ne comptent comme renseignées que complètes (haut, bas,
 * pointure) : chacune pré-remplit l'ajout d'une pièce de sa catégorie.
 */
export type ChampProfilStyle = "genre" | "style" | "morphologie" | "mise_en_valeur" | "coupes" | "palette" | "tailles";

export interface ChampCompletude {
  cle: ChampProfilStyle;
  libelle: string;
  renseigne: boolean;
}

export function champsProfilStyle(profile: Profile): ChampCompletude[] {
  const morpho = GENDER_DEPENDENT_FIELDS.find((f) => f.key === "morphology")!;
  const champs: ChampCompletude[] = [
    { cle: "genre", libelle: "Genre", renseigne: Boolean(genderLabel(profile.gender)) },
    { cle: "style", libelle: "Style", renseigne: stylesLabels(profile.styles, profile.gender).length > 0 },
  ];
  if (morpho.valuesFor(profile.gender).length > 0) {
    champs.push({
      cle: "morphologie",
      libelle: "Morphologie",
      renseigne: Boolean(profile.morphology) && !fieldNeedsRevalidation(morpho, profile),
    });
  }
  // Mise en valeur et coupes (31/10/2026, arbitrage : elles COMPTENT, même si le pourcentage des profils existants baisse). La
  // réponse neutre (« Aucune préférence », « Cela dépend ») est une réponse : seul `null` (jamais posé) manque.
  // Pas de mise en valeur pour un homme (31/10/2026) : le champ n'existe pas pour lui, comme la morphologie.
  if (miseEnValeurPosee(profile.gender)) {
    champs.push({ cle: "mise_en_valeur", libelle: "Mise en valeur", renseigne: miseEnValeurDuGenre(profile.preferencesSilhouette.miseEnValeur, profile.gender) !== null });
  }
  champs.push({ cle: "coupes", libelle: "Coupes préférées", renseigne: profile.preferencesSilhouette.coupes !== null });
  champs.push(
    { cle: "palette", libelle: "Palette", renseigne: profile.paletteCouleurs.length > 0 },
    { cle: "tailles", libelle: "Tailles", renseigne: Boolean(profile.tailleHaut && profile.tailleBas && profile.pointure) }
  );
  return champs;
}

export interface Completude {
  total: number;
  renseignes: number;
  manquants: ChampCompletude[];
  /** Arrondi à l'entier — calculé, jamais écrit en dur. */
  pourcentage: number;
}

export function completudeProfil(profile: Profile): Completude {
  const champs = champsProfilStyle(profile);
  const manquants = champs.filter((c) => !c.renseigne);
  const renseignes = champs.length - manquants.length;
  return { total: champs.length, renseignes, manquants, pourcentage: Math.round((renseignes / champs.length) * 100) };
}


/**
 * LA PROCHAINE INFORMATION À RENSEIGNER (12/10/2026, brief « Refonte UX/UI de Mon profil »). Dérivée des MÊMES champs que
 * completudeProfil (champsProfilStyle) : aucun pourcentage ni critère de plus. Priorité = l'ordre des champs du questionnaire
 * (genre, style, morphologie, palette, tailles) ; pour les tailles, la première absente de haut, bas, pointure. `null` quand le profil est complet.
 *
 * CHAQUE « POURQUOI » EST VRAI DANS LE CODE (règle du projet, cf. ProfileScreen) : le genre adapte les pièces et styles proposés, le style
 * définit l'univers de la capsule, la silhouette n'oriente la sélection que pour deux silhouettes (« peut orienter »), la palette oriente
 * les couleurs de la capsule et des tenues, les tailles pré-remplissent l'ajout d'une pièce — elles ne filtrent aucune suggestion, la
 * phrase « pour affiner les recommandations de chaussures » serait donc fausse. Jamais de message négatif sur la morphologie.
 */
export interface ProchaineActionProfil {
  cle: ChampProfilStyle;
  message: string;
  cta: string;
}

export function prochaineActionProfil(profile: Profile): ProchaineActionProfil | null {
  const manquant = completudeProfil(profile).manquants[0];
  if (!manquant) return null;
  switch (manquant.cle) {
    case "genre":
      return { cle: "genre", message: "Indique ton genre : il adapte les pièces et les styles proposés.", cta: "Renseigner mon genre" };
    case "style":
      return { cle: "style", message: "Choisis ton style : il définit l'univers de tes recommandations.", cta: "Choisir mon style" };
    case "morphologie":
      return { cle: "morphologie", message: "Renseigne ta silhouette : elle peut orienter les coupes et proportions de ta capsule.", cta: "Compléter ma morphologie" };
    // Aucun effet moteur pour l'instant (lot 4, après audit) : la phrase ne promet rien de plus que ce que le code fait.
    case "mise_en_valeur":
      return { cle: "mise_en_valeur", message: "Dis-nous ce que tu aimes mettre en valeur : c'est noté dans ton profil.", cta: "Indiquer ce que j'aime mettre en valeur" };
    case "coupes":
      return { cle: "coupes", message: "Indique les coupes dans lesquelles tu te sens le mieux : c'est noté dans ton profil.", cta: "Choisir mes coupes" };
    case "palette":
      return { cle: "palette", message: "Choisis tes couleurs : elles orientent la capsule et tes tenues.", cta: "Choisir ma palette" };
    case "tailles":
      if (!profile.tailleHaut) return { cle: "tailles", message: "Ajoute ta taille de haut : elle est pré-remplie quand tu ajoutes une pièce.", cta: "Renseigner ma taille de haut" };
      if (!profile.tailleBas) return { cle: "tailles", message: "Ajoute ta taille de bas : elle est pré-remplie quand tu ajoutes une pièce.", cta: "Renseigner ma taille de bas" };
      return { cle: "tailles", message: "Ajoute ta pointure : elle est pré-remplie quand tu ajoutes une paire de chaussures.", cta: "Renseigner ma pointure" };
  }
}
