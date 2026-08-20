import type { CatalogItem } from "./catalog";

/** Slug ASCII simple (minuscules, sans accents, mots séparés par _) — pour composer une clé stable et lisible. */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Regroupe les variantes de couleur visuellement équivalentes sous un seul
 * mot générique (recette 18/08/2026 v2) — sinon "écru"/"ivoire"/"crème"
 * généreraient chacun leur propre asset pour un rendu quasi identique.
 * Retombe sur le mot d'origine (slugifié) si aucun regroupement ne
 * correspond : mieux vaut une clé un peu plus fine qu'une couleur perdue.
 */
const COLOR_BUCKETS: Record<string, string> = {
  écru: "ecru",
  ivoire: "ecru",
  crème: "ecru",
  "blanc cassé": "ecru",
  blanc: "blanc",
  camel: "camel",
  "cognac clair": "camel",
  caramel: "camel",
  tan: "camel",
  "beige clair": "beige",
  sable: "beige",
  nude: "beige",
  "taupe clair": "beige",
  beige: "beige",
  taupe: "beige",
  "beige rosé": "beige",
  bordeaux: "bordeaux",
  "lie-de-vin": "bordeaux",
  "lie de vin": "bordeaux",
  grenat: "bordeaux",
  prune: "bordeaux",
  noir: "noir",
  "gris anthracite": "gris",
  "gris clair": "gris",
  gris: "gris",
  marine: "marine",
  denim: "bleu",
  "bleu ciel": "bleu",
  bleu: "bleu",
  kaki: "kaki",
  "vert sauge": "vert",
  "vert bouteille": "vert",
  vert: "vert",
  terracotta: "terracotta",
  rouille: "terracotta",
  brique: "terracotta",
  chocolat: "marron",
  marron: "marron",
  moutarde: "moutarde",
  jaune: "jaune",
  corail: "corail",
  "rose poudré": "rose",
  rose: "rose",
  rouge: "rouge",
  orange: "orange",
  violet: "violet",
  doré: "dore",
  "or rose": "dore",
  argenté: "argente",
  cuivré: "cuivre",
  bronze: "bronze",
  perle: "ecru",
};

/** Normalise une couleur libre vers son bucket visuel générique (ex. "Blanc cassé" -> "ecru"). */
export function normalizeVisualColor(raw: string): string {
  const key = (raw || "").trim().toLowerCase();
  return COLOR_BUCKETS[key] || slug(raw);
}

/**
 * Regroupe les variantes de sous-type sous une seule valeur canonique — ex.
 * "ballerine"/"ballerines classiques"/"ballerines plates" partagent toutes
 * "ballerines". À garder distinct de display_name (le libellé affiché à
 * l'utilisatrice, ex. "Ballerines / Mocassins") : jamais de sous-type
 * composite type "ballerines_mocassins" dans la clé visuelle.
 */
const SUBTYPE_BUCKETS: Record<string, string> = {
  ballerine: "ballerines",
  ballerines: "ballerines",
  "ballerines classiques": "ballerines",
  "ballerines plates": "ballerines",
  "t-shirt col rond": "tshirt",
  "tee-shirt": "tshirt",
  tshirt: "tshirt",
  "t-shirt": "tshirt",
  "t-shirt basique": "tshirt",
  cabas: "cabas",
  "grand cabas": "cabas",
  "tote cuir": "cabas",
  "sac cabas": "cabas",
  "sac à main": "sac_a_main",
  bandoulière: "sac_bandouliere",
  pochette: "pochette",
  "sac à dos": "sac_a_dos",
  chemise: "chemise",
  chemisier: "chemisier",
  blouse: "chemisier",
  débardeur: "debardeur",
  top: "top",
  "col roulé": "col_roule",
  gilet: "gilet",
  cardigan: "gilet",
  "pull col rond": "pull",
  pull: "pull",
  blazer: "blazer",
  trench: "trench",
  parka: "manteau",
  doudoune: "doudoune",
  manteau: "manteau",
  escarpins: "escarpins",
  bottines: "bottines",
  bottes: "bottes",
  sandales: "sandales",
  "sandales à talons": "sandales_talons",
  espadrilles: "espadrilles",
  mocassins: "mocassins",
  baskets: "baskets",
  "chaussures d'intérieur": "chaussons",
  collier: "collier",
  "boucles d'oreilles": "boucles_oreilles",
  bracelet: "bracelet",
  bague: "bague",
  montre: "montre",
  ceinture: "ceinture",
  foulard: "foulard",
  écharpe: "echarpe",
  chapeau: "chapeau",
  casquette: "casquette",
  lunettes: "lunettes",
  collants: "collants",
  "chaussettes hautes": "chaussettes",
};

/** Normalise un sous-type libre vers sa valeur canonique unique (ex. "Ballerines plates" -> "ballerines"). */
export function normalizeVisualSubtype(raw: string): string {
  const key = (raw || "").trim().toLowerCase();
  return SUBTYPE_BUCKETS[key] || slug(raw);
}

/** Seules ces matières changent réellement l'apparence du produit (cuir vs tissu) — les autres (coton/lin/laine/soie/denim/synthétique) n'entrent jamais dans la clé. */
const VISUALLY_SIGNIFICANT_MATIERES = new Set(["cuir"]);

/**
 * Clé visuelle resserrée d'une pièce du catalogue (recette 18/08/2026 v2,
 * complétée 20/08/2026 — coupe oversize) : genre_category_sousType_couleur,
 * matiere ajoutée seulement si elle change réellement l'apparence (cuir),
 * "oversize" ajouté seulement pour coupe = "Ample" (silhouette visiblement
 * différente d'une coupe ajustée/regular — ex. permet à une même chemise en
 * version base/ajustée et calque/oversize d'avoir chacune leur propre
 * visuel). Deux articles avec la même clé peuvent réutiliser exactement le
 * même visuel — styles/occasion/morphologies/saison/niveau de formalité/
 * rôle de superposition n'entrent jamais dans la clé, ils n'influencent
 * jamais l'apparence du produit lui-même (contrairement à la coupe).
 * Ex. "femme_chaussures_ballerines_beige", "homme_hauts_chemise_blanc_oversize".
 */
export function computeVisualKey(item: CatalogItem): string {
  const subtypeRaw = item.subtype || item.shoeType || item.sacType || item.bijouType || item.accessoireType || "";
  const matiereSlug = slug(item.matiere || "");
  const parts = [
    item.genre,
    item.cat,
    normalizeVisualSubtype(subtypeRaw),
    normalizeVisualColor(item.color),
    VISUALLY_SIGNIFICANT_MATIERES.has(matiereSlug) ? matiereSlug : "",
    item.coupe === "Ample" ? "oversize" : "",
  ];
  return parts.map(slug).filter(Boolean).join("_");
}
