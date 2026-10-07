// Le prompt des visuels « hero » (08/10/2026) — une SECONDE image par pièce du catalogue, posée à plat avec des plis naturels
// (flat lay éditorial), pour le hero « Ton look du jour » : la maquette validée montre des pièces posées, pas des pièces de
// face comme portées par un mannequin invisible. Ce visuel ne remplace jamais le visuel standard (url_image) : il vit dans une
// colonne à part (url_image_hero, migration 0049) et l'app retombe sur le standard quand il manque.
//
// Le sujet (le produit, sa couleur, sa matière, sa coupe) est celui de buildImagePrompt, inchangé : un blazer reste un blazer.
// Seul le gabarit de PRÉSENTATION change — vue du dessus, pose naturelle, fond transparent même pour une pièce claire (le hero
// est terracotta : un T-shirt blanc s'y détache, contrairement au fond blanc de l'app qui imposait un gris).
import { buildImagePrompt, type BuiltPrompt, type TrendRule, type VestiaireRow } from "./imagePrompt.ts";

/** La pose naturelle de chaque catégorie — ce qui distingue un flat lay d'une vue de face. */
const POSE: Record<string, string> = {
  haut: "The t-shirt lies loosely, slightly asymmetrical, with soft natural creases, one sleeve relaxed at a slight angle.",
  pull: "The knit lies loosely with soft natural folds, one sleeve gently angled across the body.",
  veste: "The jacket lies open-collared with its lapels visible, one sleeve folded across the body so the cuff shows, soft natural creases.",
  manteau: "The coat lies with its lapels visible, one sleeve folded across the body so the cuff shows, soft natural creases.",
  pantalon: "The trousers lie in a slight diagonal, one leg a little offset from the other, soft natural creases at the knees and hem.",
  jean: "The jeans lie in a slight diagonal, one leg a little offset from the other, soft natural creases at the knees and hem.",
  short: "The shorts lie flat with one leg slightly offset, soft natural creases.",
  jupe: "The skirt lies flat and slightly turned, with soft natural folds in the fabric.",
  robe: "The dress lies flat and slightly turned, one sleeve or strap relaxed, soft natural folds in the skirt.",
  combinaison: "The jumpsuit lies flat and slightly turned, legs a little offset, soft natural folds.",
  chaussures: "A pair of shoes placed side by side at a slight diagonal, one slightly ahead of the other.",
  sac: "The handbag stands slightly tilted, its handles resting naturally.",
  bijou: "The jewelry piece lies naturally, slightly turned.",
  accessoire: "The accessory lies naturally, slightly turned, with soft folds if it is made of fabric.",
};

/** L'orientation, la même d'une pièce à l'autre : le haut du vêtement vers le haut de l'image, les chaussures pointe en haut à droite. */
const ORIENTATION: Record<string, string> = {
  haut: "Neckline at the top of the image.",
  pull: "Neckline at the top of the image.",
  veste: "Collar at the top of the image.",
  manteau: "Collar at the top of the image.",
  pantalon: "Waistband at the top of the image, hems at the bottom.",
  jean: "Waistband at the top of the image, hems at the bottom.",
  short: "Waistband at the top of the image, hems at the bottom.",
  jupe: "Waistband at the top of the image, hem at the bottom.",
  robe: "Neckline at the top of the image, hem at the bottom.",
  combinaison: "Neckline at the top of the image, hems at the bottom.",
  chaussures: "Toes pointing toward the upper right of the image.",
  sac: "Upright, handles at the top.",
  bijou: "Upright, clasp at the top if it has one.",
  accessoire: "Upright, in its natural orientation.",
};

/** Ce qui précède le gabarit commun dans le prompt de buildImagePrompt : le titre et le bloc de conception, à garder. */
const DEBUT_GABARIT_COMMUN = "Single fashion item only.";

export function buildHeroImagePrompt(row: VestiaireRow, trend?: TrendRule | null): BuiltPrompt {
  const base = buildImagePrompt(row, trend);
  const coupe = base.prompt.indexOf(DEBUT_GABARIT_COMMUN);
  // Le gabarit commun a changé de forme : on refuse plutôt que de produire un prompt hybride.
  if (coupe < 0) return { ...base, ok: false };
  const tete = base.prompt.slice(0, coupe).replace("Premium ecommerce cutout product image of", "Editorial flat lay photograph of");
  const exclusions = base.prompt
    .slice(coupe)
    .split("\n")
    .filter((l) => /^No (?!person|model|mannequin|visible body|body parts|hanger|furniture|props|text|logo|brand|additional)/.test(l));
  const gabarit = [
    "Single fashion item only.",
    "The whole item is fully visible: nothing cropped, nothing hidden, nothing folded over in a way that hides its shape.",
    "Shot from directly above, the item laid out on a surface like a stylist's flat lay for a fashion magazine.",
    POSE[base.canonCategory] || "The item lies naturally with soft folds.",
    ORIENTATION[base.canonCategory] || "Upright, consistent orientation.",
    "Realistic proportions, true to a real garment: no distortion, no exaggeration of any part.",
    "Same camera, same top-down angle and same distance for every item: the item is centered and fills about 75% of the frame along its longest side, with an empty margin on all four sides.",
    "Not worn, not on a hanger: no person, no model, no mannequin, no ghost mannequin, no visible body, no body parts, no legs, no feet, no hanger.",
    "No furniture.",
    "No props.",
    "No text.",
    "No logo.",
    "No brand.",
    "No additional clothing unless structurally part of the product.",
    ...exclusions,
    "Transparent background, whatever the color of the product.",
    "Soft, even, homogeneous light across the whole item: no harsh highlights, no deep shadows, no color cast.",
    "A very light, natural soft shadow directly under the item, barely visible, never dark or hard.",
    "Realistic premium material texture.",
    "Photorealistic.",
    "High resolution, high detail.",
    "Sharp clean edges.",
  ].join("\n");
  return { ...base, prompt: [tete.trimEnd(), "", gabarit].join("\n") };
}
