// Miroir Deno de src/lib/imagePrompt.ts — dupliqué volontairement : les
// Edge Functions Supabase tournent dans un runtime Deno séparé du bundle
// Next.js et ne peuvent pas importer directement depuis src/lib. Les deux
// fichiers doivent être tenus synchronisés si les dictionnaires évoluent.

export interface VestiaireRow {
  id: number;
  name: string | null;
  category: string | null;
  sous_type: string | null;
  couleur_dominante: string | null;
  matiere: string | null;
  genre: string | null;
  styles: string | null;
}

const CATEGORY_CANON: Record<string, string> = {
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
  "col roulé": "turtleneck",
  gilet: "cardigan",
  cardigan: "cardigan",
  blazer: "blazer",
  trench: "trench coat",
  parka: "parka",
  doudoune: "puffer jacket",
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

const MATIERE_EN: Record<string, string> = {
  coton: "cotton",
  lin: "linen",
  laine: "wool",
  soie: "silk",
  cuir: "leather",
  denim: "denim",
  synthétique: "synthetic fabric",
};

const STYLE_EN: Record<string, string> = {
  minimaliste: "minimalist",
  "casual chic": "casual chic",
  "classique chic": "classic chic",
  romantique: "romantic",
  "bohème": "bohemian",
  streetwear: "streetwear",
  preppy: "preppy",
  glamour: "glamorous",
};

function translate(dict: Record<string, string>, raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  return dict[raw.trim().toLowerCase()];
}

/** Construit le prompt anglais de génération à partir d'une ligne vestiaire_universel brute — cf. src/lib/imagePrompt.ts pour la version app (source de vérité, à garder synchronisée). */
export function buildImagePrompt(row: VestiaireRow): string {
  const genreEn = (row.genre || "").trim().toLowerCase() === "femme" ? "women's" : "unisex";
  const canonCat = CATEGORY_CANON[(row.category || "").trim().toLowerCase()] || "accessoire";
  const colorRaw = row.couleur_dominante || "";
  const colorEn = translate(COLOR_EN, colorRaw) || colorRaw.toLowerCase() || "neutral";
  const matiereEn = translate(MATIERE_EN, row.matiere);
  const productEn = translate(SUBTYPE_EN, row.sous_type) || CATEGORY_EN[canonCat] || "item";
  const styleList = (row.styles || "")
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const stylesEn =
    Array.from(new Set((styleList.length ? styleList : ["Casual chic"]).map((s) => translate(STYLE_EN, s) || s.toLowerCase()))).join(
      " "
    );

  const productDescription = [genreEn, colorEn, matiereEn, productEn].filter(Boolean).join(" ");

  return [
    `Professional premium ecommerce product photography of ${productDescription}, ${stylesEn} style.`,
    "",
    "Single product only.",
    "No person.",
    "No feet.",
    "No mannequin.",
    "No model.",
    "No text.",
    "No logo.",
    "No brand.",
    "",
    "Product centered and fully visible.",
    "Soft natural studio lighting.",
    "Warm ivory beige background.",
    "Subtle realistic shadow.",
    "Minimal premium French fashion aesthetic.",
    "Square composition.",
    "Photorealistic.",
  ].join("\n");
}

/** Dossier de rangement Storage — {genre}/{category} (les deux seules valeurs de genre existantes côté app : femme, unisexe). */
export function storageFolderFor(row: VestiaireRow): string {
  const genre = (row.genre || "").trim().toLowerCase() === "femme" ? "femme" : "unisexe";
  const canonCat = CATEGORY_CANON[(row.category || "").trim().toLowerCase()] || "accessoire";
  return `${genre}/${canonCat}`;
}
