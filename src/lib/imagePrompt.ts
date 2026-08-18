import type { CatalogItem } from "./catalog";

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

/** Sous-types reconnus comme nom complet du produit (correspondance exacte du sous-type entier). */
const SUBTYPE_EN: Record<string, string> = {
  baskets: "sneakers",
  bottines: "ankle boots",
  bottes: "boots",
  escarpins: "pumps",
  sandales: "sandals",
  mocassins: "loafers",
  ballerines: "ballet flats",
  "chaussures d'intérieur": "house slippers",
  "sac à main": "handbag",
  cabas: "tote bag",
  bandoulière: "crossbody bag",
  pochette: "clutch bag",
  "sac à dos": "backpack",
  collier: "necklace",
  "boucles d'oreilles": "earrings",
  bracelet: "bracelet",
  bague: "ring",
  montre: "watch",
  ceinture: "belt",
  foulard: "scarf",
  écharpe: "scarf",
  chapeau: "hat",
  casquette: "cap",
  lunettes: "sunglasses",
  collants: "tights",
  "chaussettes hautes": "knee-high socks",
  "t-shirt": "t-shirt",
  chemise: "shirt",
  chemisier: "blouse",
  blouse: "blouse",
  débardeur: "tank top",
  top: "top",
  polo: "polo shirt",
  sweat: "sweatshirt",
  "col roulé": "turtleneck",
  gilet: "cardigan",
  cardigan: "cardigan",
  blazer: "blazer",
  trench: "trench coat",
  parka: "parka",
  doudoune: "puffer jacket",
  caban: "pea coat",
  imperméable: "raincoat",
  perfecto: "leather jacket",
  legging: "leggings",
  jogging: "jogging pants",
  bermuda: "bermuda shorts",
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

/** Toutes les matières (contrairement à la clé visuelle, qui n'en retient qu'une partie pour la déduplication) — décrire fidèlement le tissu aide la génération, même sans dédupliquer dessus. */
const MATIERE_EN: Record<string, string> = {
  Coton: "cotton",
  Lin: "linen",
  Laine: "wool",
  Soie: "silk",
  Cuir: "leather",
  Denim: "denim",
  "Synthétique": "synthetic fabric",
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

function translate(dict: Record<string, string>, raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  return dict[raw.trim().toLowerCase()];
}

export interface BuiltPrompt {
  prompt: string;
  ok: boolean;
  noun: string;
}

/**
 * Construit automatiquement le prompt anglais de génération d'image et
 * valide sa cohérence avec la catégorie (recette 18/08/2026, correctif
 * mapping incorrect). Priorité stricte sous_type > category > jamais name :
 * `name` (texte libre saisi par l'admin) n'apparaît jamais dans le prompt,
 * seul le sujet reconnu depuis sous_type/category peut le déterminer.
 * Miroir exact de la logique Deno utilisée par l'Edge Function
 * (supabase/functions/_shared/imagePrompt.ts, à garder synchronisée) —
 * conservée côté app pour un futur aperçu/regénération manuelle en
 * administration (structure seulement, pas de back-office pour l'instant).
 */
export function buildImagePrompt(item: CatalogItem): BuiltPrompt {
  const canonCategory = item.cat;
  const genreEn = item.genre === "femme" ? "women's" : item.genre === "homme" ? "men's" : "unisex";
  const colorEn = translate(COLOR_EN, item.color) || (item.color ? item.color.toLowerCase() : "");
  const matiereEn = item.matiere ? MATIERE_EN[item.matiere] : undefined;

  const subtypeSource = (item.subtype || item.shoeType || item.sacType || item.bijouType || item.accessoireType || "")
    .trim()
    .toLowerCase();
  const noun = translate(SUBTYPE_EN, subtypeSource) || CATEGORY_EN[canonCategory] || "item";

  const modifiers = Array.from(
    new Set(
      subtypeSource
        .split(/[\s/]+/)
        .map((w) => MODIFIER_EN[w])
        .filter((w): w is string => Boolean(w))
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

  return { prompt, ok, noun };
}
