// Miroir Deno de src/lib/visualKey.ts — dupliqué volontairement (runtime
// Deno séparé du bundle Next.js, cf. _shared/imagePrompt.ts). À garder
// synchronisé si les dictionnaires évoluent côté app.

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

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

export function normalizeVisualColor(raw: string | null | undefined): string {
  const key = (raw || "").trim().toLowerCase();
  return COLOR_BUCKETS[key] || slug(raw || "");
}

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

export function normalizeVisualSubtype(raw: string | null | undefined): string {
  const key = (raw || "").trim().toLowerCase();
  return SUBTYPE_BUCKETS[key] || slug(raw || "");
}

const VISUALLY_SIGNIFICANT_MATIERES = new Set(["cuir"]);

export interface VisualKeyInput {
  genre: string | null;
  category: string | null; // canonique interne (haut, chaussures...), pas la catégorie brute DB
  sousType: string | null;
  couleur: string | null;
  matiere: string | null;
  coupe?: string | null;
}

/**
 * Clé visuelle resserrée — cf. src/lib/visualKey.ts (source de vérité) pour
 * la logique complète. "oversize" ajouté seulement pour coupe = "Ample"
 * (recette 20/08/2026) — seule coupe qui change visiblement la silhouette.
 */
export function computeVisualKey(input: VisualKeyInput): string {
  const matiereSlug = slug(input.matiere || "");
  const parts = [
    input.genre || "unisexe",
    input.category || "",
    normalizeVisualSubtype(input.sousType),
    normalizeVisualColor(input.couleur),
    VISUALLY_SIGNIFICANT_MATIERES.has(matiereSlug) ? matiereSlug : "",
    input.coupe === "Ample" ? "oversize" : "",
  ];
  return parts.map(slug).filter(Boolean).join("_");
}
