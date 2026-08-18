// Miroir Deno de src/lib/imagePrompt.ts — dupliqué volontairement : les
// Edge Functions Supabase tournent dans un runtime Deno séparé du bundle
// Next.js et ne peuvent pas importer directement depuis src/lib. Les deux
// fichiers doivent être tenus synchronisés si les dictionnaires évoluent.
//
// Correctif 18/08/2026 (mapping incorrect constaté : un pantalon affichait
// une veste/chemise) : le sujet de l'image ne doit JAMAIS être interprété
// depuis `name` en texte libre. Priorité stricte sous_type > category >
// name (name n'apparaît plus du tout dans le prompt). Composition et
// exclusions spécifiques par catégorie pour empêcher structurellement
// OpenAI de produire un autre type de vêtement, + validation de cohérence
// avant tout appel API (buildImagePrompt.ok).

export interface VestiaireRow {
  id: number;
  name: string | null;
  category: string | null;
  sous_type: string | null;
  couleur_dominante: string | null;
  matiere: string | null;
  genre: string | null;
  coupe: string | null;
}

export const CATEGORY_CANON: Record<string, string> = {
  hauts: "haut",
  pulls_gilets: "pull",
  pantalons: "pantalon",
  jeans: "jean",
  jupes: "jupe",
  shorts: "short",
  robes: "robe",
  combinaisons: "combinaison",
  vestes_blazers: "veste",
  manteaux_exterieurs: "manteau",
  chaussures: "chaussures",
  sacs: "sac",
  bijoux: "bijou",
  accessoires: "accessoire",
  haut: "haut",
  pull: "pull",
  pantalon: "pantalon",
  jean: "jean",
  jupe: "jupe",
  short: "short",
  robe: "robe",
  combinaison: "combinaison",
  veste: "veste",
  manteau: "manteau",
  sac: "sac",
  bijou: "bijou",
  accessoire: "accessoire",
};

/** Les 14 catégories officielles du catalogue, utilisées comme noms de dossier Storage (genre/{dossier}/...). */
export const CATEGORY_FOLDER: Record<string, string> = {
  haut: "hauts",
  pull: "pulls-gilets",
  pantalon: "pantalons",
  jean: "jeans",
  jupe: "jupes",
  short: "shorts",
  robe: "robes",
  combinaison: "combinaisons",
  veste: "vestes-blazers",
  manteau: "manteaux-exterieurs",
  chaussures: "chaussures",
  sac: "sacs",
  bijou: "bijoux",
  accessoire: "accessoires",
};

/** Nom du produit en anglais — utilisé UNIQUEMENT comme repli quand sous_type ne correspond à rien de connu (jamais depuis `name`). */
const CATEGORY_EN: Record<string, string> = {
  haut: "top",
  pull: "sweater",
  pantalon: "trousers",
  jean: "jeans",
  jupe: "skirt",
  short: "shorts",
  robe: "dress",
  combinaison: "jumpsuit",
  veste: "jacket",
  manteau: "coat",
  chaussures: "shoes",
  sac: "bag",
  bijou: "jewelry piece",
  accessoire: "accessory",
};

/** Sous-types reconnus comme nom complet du produit (correspondance exacte du sous_type entier). */
const SUBTYPE_EN: Record<string, string> = {
  // Chaussures
  baskets: "sneakers",
  bottines: "ankle boots",
  bottes: "boots",
  escarpins: "pumps",
  sandales: "sandals",
  mocassins: "loafers",
  ballerines: "ballet flats",
  "chaussures d'intérieur": "house slippers",
  // Sacs
  "sac à main": "handbag",
  cabas: "tote bag",
  bandoulière: "crossbody bag",
  pochette: "clutch bag",
  "sac à dos": "backpack",
  // Bijoux
  collier: "necklace",
  "boucles d'oreilles": "earrings",
  bracelet: "bracelet",
  bague: "ring",
  montre: "watch",
  // Accessoires
  ceinture: "belt",
  foulard: "scarf",
  écharpe: "scarf",
  chapeau: "hat",
  casquette: "cap",
  lunettes: "sunglasses",
  collants: "tights",
  "chaussettes hautes": "knee-high socks",
  // Hauts / pulls
  "t-shirt": "t-shirt",
  chemise: "shirt",
  chemisier: "blouse",
  blouse: "blouse",
  débardeur: "tank top",
  top: "top",
  polo: "polo shirt",
  sweat: "sweatshirt",
  gilet: "cardigan",
  cardigan: "cardigan",
  // Vestes / manteaux
  blazer: "blazer",
  trench: "trench coat",
  parka: "parka",
  doudoune: "puffer jacket",
  caban: "pea coat",
  imperméable: "raincoat",
  perfecto: "leather jacket",
  // Bas
  legging: "leggings",
  jogging: "jogging pants",
  bermuda: "bermuda shorts",
  // Robes / combinaisons
  combishort: "playsuit",
  salopette: "dungarees",
};

/** Mots-clés de coupe/style repérés DANS sous_type (jamais dans name) — ajoutés comme modificateurs, ne changent jamais le type de produit. */
const MODIFIER_EN: Record<string, string> = {
  fluide: "flowy",
  fluides: "flowy",
  ample: "wide-leg",
  amples: "wide-leg",
  large: "loose",
  larges: "loose",
  droit: "straight-leg",
  droite: "straight",
  slim: "slim-fit",
  skinny: "skinny",
  moulant: "fitted",
  moulante: "fitted",
  oversize: "oversized",
  "plissé": "pleated",
  "plissée": "pleated",
  crayon: "pencil",
  midi: "midi-length",
  mini: "mini",
  long: "long",
  longue: "long",
  court: "short",
  courte: "short",
  "évasé": "flared",
  "évasée": "flared",
  cargo: "cargo-style",
  bootcut: "bootcut",
  flare: "flared",
  mom: "mom-fit",
  boyfriend: "boyfriend-fit",
  portefeuille: "wrap",
  "croisée": "wrap",
  tailleur: "tailored",
};

/** Cols/encolures reconnus en bigramme (2 mots consécutifs) n'importe où dans sous_type. */
const NECKLINE_EN: Record<string, string> = {
  "col v": "v-neck",
  "col rond": "crew neck",
  "col roulé": "turtleneck",
  "col bateau": "boat neck",
  "col claudine": "peter pan collar",
  "col chemise": "collared",
  "col cheminée": "funnel neck",
};

const COLOR_EN: Record<string, string> = {
  blanc: "white",
  "blanc cassé": "off-white",
  crème: "cream",
  ivoire: "ivory",
  sable: "sand beige",
  beige: "beige",
  "beige rosé": "dusty pink beige",
  camel: "camel",
  caramel: "caramel",
  terracotta: "terracotta",
  rouille: "rust",
  brique: "brick red",
  chocolat: "chocolate brown",
  marron: "brown",
  moutarde: "mustard yellow",
  kaki: "khaki",
  "vert sauge": "sage green",
  "vert bouteille": "bottle green",
  vert: "green",
  taupe: "taupe",
  "rose poudré": "dusty pink",
  rose: "pink",
  corail: "coral",
  "gris clair": "light grey",
  gris: "grey",
  "gris anthracite": "charcoal grey",
  "bleu ciel": "sky blue",
  denim: "denim blue",
  bleu: "blue",
  marine: "navy blue",
  prune: "plum purple",
  violet: "purple",
  bordeaux: "burgundy",
  rouge: "red",
  jaune: "yellow",
  orange: "orange",
  noir: "black",
  doré: "gold",
  argenté: "silver",
  cuivré: "copper",
  "or rose": "rose gold",
  bronze: "bronze",
  perle: "pearl white",
};

/** Coupe structurée (champ dédié `coupe`, distinct du texte libre de sous_type) — recette 18/08/2026. */
const COUPE_EN: Record<string, string> = {
  "Serré": "fitted",
  "Ajusté": "tailored",
  "Ample": "loose-fitting",
};

/** Toutes les matières (contrairement à la clé visuelle, qui n'en retient qu'une partie pour la déduplication) — décrire fidèlement le tissu aide la génération, même sans dédupliquer dessus. */
const MATIERE_EN: Record<string, string> = {
  coton: "cotton",
  lin: "linen",
  laine: "wool",
  soie: "silk",
  cuir: "leather",
  denim: "denim",
  "synthétique": "synthetic fabric",
};

/** Composition spécifique par catégorie — empêche structurellement une confusion de type de vêtement (ex. veste générée pour un pantalon). */
const CATEGORY_COMPOSITION: Record<string, string> = {
  pantalon: "Complete pair of trousers, visible from waistband to hem. Both legs clearly visible.",
  jean: "Complete pair of jeans, visible from waistband to hem. Both legs clearly visible.",
  short: "Complete shorts, waistband to hem visible.",
  haut: "Complete top, front view.",
  pull: "Complete sweater, front view.",
  robe: "Complete dress, full length visible, from shoulders to hem.",
  jupe: "Complete skirt, waistband to hem visible.",
  combinaison: "Complete jumpsuit, full length visible.",
  chaussures: "Pair of shoes, both shoes visible.",
  sac: "Single handbag, fully visible.",
  bijou: "Single jewelry item, centered.",
  veste: "Complete blazer or jacket, front view.",
  manteau: "Complete coat, front view.",
  accessoire: "Single accessory item, centered.",
};

/** Exclusions spécifiques par catégorie (garde-fou supplémentaire contre la confusion de type). */
const CATEGORY_EXCLUDE: Record<string, string[]> = {
  pantalon: ["shirt", "jacket", "blazer", "shoes", "dress"],
  jean: ["shirt", "jacket", "blazer", "shoes", "dress"],
  short: ["shirt", "jacket", "shoes"],
  haut: ["jacket", "trousers", "dress", "skirt"],
  pull: ["jacket", "trousers", "dress"],
  robe: ["trousers", "jacket", "shirt"],
  jupe: ["trousers", "shirt", "jacket"],
  combinaison: ["jacket", "shirt", "dress"],
  veste: ["shirt", "trousers", "dress"],
  manteau: ["shirt", "trousers", "dress"],
  chaussures: ["bag", "clothing item"],
  sac: ["shoes", "clothing item"],
  bijou: ["clothing item", "shoes", "bag"],
  accessoire: ["clothing item", "shoes"],
};

/** Mots attendus dans le nom du produit pour chaque catégorie — sert à la validation de cohérence avant l'appel API. */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  haut: ["top", "shirt", "blouse", "tank top", "turtleneck", "polo", "sweatshirt"],
  pull: ["sweater", "cardigan"],
  pantalon: ["trousers", "pants"],
  jean: ["jeans"],
  jupe: ["skirt"],
  short: ["shorts"],
  robe: ["dress"],
  combinaison: ["jumpsuit", "playsuit", "dungarees"],
  veste: ["jacket", "blazer"],
  manteau: ["coat", "parka", "puffer jacket", "raincoat"],
  chaussures: ["shoes", "sneakers", "boots", "flats", "sandals", "loafers", "pumps", "slippers"],
  sac: ["bag", "handbag", "tote", "backpack", "clutch"],
  bijou: ["necklace", "earrings", "bracelet", "ring", "watch", "jewelry"],
  accessoire: ["belt", "scarf", "hat", "cap", "sunglasses", "tights", "socks", "accessory"],
};

function translate(dict: Record<string, string>, raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return dict[raw.trim().toLowerCase()];
}

export interface BuiltPrompt {
  prompt: string;
  ok: boolean;
  noun: string;
  canonCategory: string;
}

/**
 * Construit le prompt anglais et valide sa cohérence avec la catégorie —
 * cf. src/lib/imagePrompt.ts pour la version app (source de vérité, à
 * garder synchronisée). `ok: false` signale un sujet incompatible avec la
 * catégorie : l'appelant ne doit JAMAIS appeler l'API de génération dans ce cas.
 */
export function buildImagePrompt(row: VestiaireRow): BuiltPrompt {
  const canonCategory = CATEGORY_CANON[(row.category || "").trim().toLowerCase()] || "accessoire";
  const genreRaw = (row.genre || "").trim().toLowerCase();
  const genreEn = genreRaw === "femme" ? "women's" : genreRaw === "homme" ? "men's" : "unisex";
  const colorRaw = row.couleur_dominante || "";
  const colorEn = translate(COLOR_EN, colorRaw) || (colorRaw ? colorRaw.toLowerCase() : "");
  const matiereEn = translate(MATIERE_EN, row.matiere);

  // Sujet du produit : sous_type > category > (jamais name). sous_type
  // complet reconnu tel quel s'il correspond à un nom déjà complet (ex.
  // "ballerines"), sinon repli sur la catégorie — jamais interprété
  // librement depuis le nom de la pièce.
  const sousTypeRaw = (row.sous_type || "").trim().toLowerCase();
  const noun = translate(SUBTYPE_EN, sousTypeRaw) || CATEGORY_EN[canonCategory] || "item";

  // Modificateurs de coupe/style : mots-clés repérés dans sous_type (en mot
  // seul ou en bigramme pour les cols/encolures, ex. "col v"), plus le champ
  // structuré `coupe` (Serré/Ajusté/Ample) quand renseigné.
  const sousTypeTokens = sousTypeRaw.split(/[\s/]+/).filter(Boolean);
  const sousTypeBigrams = sousTypeTokens.slice(0, -1).map((w, i) => `${w} ${sousTypeTokens[i + 1]}`);
  const modifiers = Array.from(
    new Set(
      [
        ...sousTypeTokens.map((w) => MODIFIER_EN[w]),
        ...sousTypeBigrams.map((b) => NECKLINE_EN[b]),
        row.coupe ? COUPE_EN[row.coupe] : undefined,
      ].filter((w): w is string => Boolean(w))
    )
  );

  const productDescription = [genreEn, colorEn, ...modifiers, matiereEn, noun].filter(Boolean).join(" ");

  const ok = (CATEGORY_KEYWORDS[canonCategory] || []).some((kw) => noun.includes(kw));

  const composition = CATEGORY_COMPOSITION[canonCategory] || "Single fashion item, fully visible.";
  const excludeLines = (CATEGORY_EXCLUDE[canonCategory] || []).map((w) => `No ${w}.`);

  const prompt = [
    `Premium ecommerce cutout product image of ${productDescription}.`,
    "",
    composition,
    "",
    "Single fashion item only.",
    "Entire product fully visible, with no part cropped or extending beyond the frame.",
    "Generous empty margin on all four sides between the product and the edge of the image.",
    "Centered.",
    "Front or slight three-quarter view.",
    "No person.",
    "No model.",
    "No mannequin.",
    "No body parts.",
    ...excludeLines,
    "No hanger.",
    "No furniture.",
    "No props.",
    "No text.",
    "No logo.",
    "No brand.",
    "No additional clothing.",
    "Clean isolated product presentation.",
    "Very soft subtle shadow.",
    "Transparent background if supported.",
    "Photorealistic.",
    "Designed to remain clearly recognizable as a small mobile ecommerce thumbnail.",
  ].join("\n");

  return { prompt, ok, noun, canonCategory };
}
