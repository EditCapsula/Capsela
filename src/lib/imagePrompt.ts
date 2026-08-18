import type { CatalogItem } from "./catalog";

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
  // Chaussures (ShoeType)
  baskets: "sneakers",
  bottines: "ankle boots",
  bottes: "boots",
  escarpins: "pumps",
  sandales: "sandals",
  mocassins: "loafers",
  ballerines: "ballet flats",
  "chaussures d'intérieur": "house slippers",
  // Sac (SacType)
  "sac à main": "handbag",
  cabas: "tote bag",
  bandoulière: "crossbody bag",
  pochette: "clutch bag",
  "sac à dos": "backpack",
  // Bijou (BijouType)
  collier: "necklace",
  "boucles d'oreilles": "earrings",
  bracelet: "bracelet",
  bague: "ring",
  montre: "watch",
  // Accessoire (AccessoireType)
  ceinture: "belt",
  foulard: "scarf",
  écharpe: "scarf",
  chapeau: "hat",
  casquette: "cap",
  lunettes: "sunglasses",
  collants: "tights",
  "chaussettes hautes": "knee-high socks",
  // Sous-types génériques courants (haut/pull/bas/robe/veste/manteau — texte libre)
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

function translate(dict: Record<string, string>, raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  return dict[raw.trim().toLowerCase()];
}

/**
 * Construit automatiquement le prompt anglais de génération d'image à
 * partir des attributs de la pièce (recette 18/08/2026 v2, gabarit commun
 * et minimal) — seuls genre/produit/couleur/matière (si pertinente,
 * uniquement le cuir) varient. Le style n'entre plus dans le prompt,
 * cohérent avec son exclusion de la clé visuelle (n'affecte pas l'apparence
 * du produit). Miroir exact de la logique Deno utilisée par l'Edge Function
 * (supabase/functions/_shared/imagePrompt.ts, à garder synchronisée) —
 * conservée côté app pour un futur aperçu/regénération manuelle en
 * administration (structure seulement, pas de back-office pour l'instant).
 */
export function buildImagePrompt(item: CatalogItem): string {
  const genreEn = item.genre === "femme" ? "women's" : "unisex";
  const colorEn = translate(COLOR_EN, item.color) || item.color.toLowerCase() || "neutral";
  const matiereEn = item.matiere === "Cuir" ? "leather" : undefined;
  const subtypeSource = item.subtype || item.shoeType || item.sacType || item.bijouType || item.accessoireType;
  const productEn =
    translate(SUBTYPE_EN, subtypeSource) || translate(CATEGORY_EN, item.cat) || CATEGORY_EN[item.cat] || "item";
  const productDescription = [genreEn, colorEn, matiereEn, productEn].filter(Boolean).join(" ");

  return [
    `Premium ecommerce product photo of ${productDescription}.`,
    "",
    "Single product only. No person. No model. No text. No logo.",
    "Centered product. Warm ivory background. Soft studio light.",
    "Realistic. Minimal French fashion aesthetic. Square composition.",
  ].join("\n");
}
