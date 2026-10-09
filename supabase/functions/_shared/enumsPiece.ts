// Les listes de valeurs d'une pièce (catégories, sous-types, matières, types de chaussures / sacs / bijoux / accessoires, palette)
// partagées par les fonctions qui LISENT des photos : analyze-dressing-photo (une pièce) et importer-tenue (toute une tenue).
// Une seule source côté serveur (10/10/2026) ; chaque liste doit rester synchronisée avec son original côté app
// (src/lib/data.ts, src/lib/attributes.ts) — le test paletteEnrichie.test.ts vérifie la palette, mot pour mot.

export const CATEGORY_KEYS = [
  "haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison",
  "veste", "manteau", "chaussures", "sac", "bijou", "accessoire",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const SUBTYPES: Partial<Record<CategoryKey, string[]>> = {
  haut: ["T-shirt", "Top", "Débardeur", "Chemise", "Chemisier", "Blouse", "Polo", "Sweat"],
  pull: ["Pull", "Gilet", "Cardigan", "Col roulé"],
  pantalon: ["Pantalon", "Tailleur", "Cargo", "Legging", "Jogging"],
  jean: ["Droit", "Slim", "Skinny", "Mom", "Boyfriend", "Wide leg", "Flare"],
  jupe: ["Mini", "Midi", "Longue", "Crayon", "Plissée"],
  short: ["Short", "Bermuda"],
  robe: ["Courte", "Midi", "Longue", "Chemise", "Portefeuille", "Pull"],
  combinaison: ["Combinaison", "Combishort", "Salopette"],
  veste: ["Blazer", "Veste légère", "Perfecto", "Veste en jean", "Surchemise"],
  manteau: ["Manteau", "Trench", "Caban", "Doudoune", "Parka", "Imperméable"],
};

// Liste élargie (recette 24/08/2026, signalé : liste trop courte pour que
// l'analyse retienne la bonne matière sur des pièces réelles) — doit rester
// synchronisée avec MATIERES (src/lib/attributes.ts, app-side).
export const MATIERES = [
  "Coton", "Lin", "Laine", "Cachemire", "Soie", "Viscose",
  "Cuir", "Daim", "Denim", "Velours", "Polyester", "Nylon", "Synthétique",
] as const;
export const SHOE_TYPES = [
  "Baskets", "Bottines", "Bottes", "Escarpins", "Sandales", "Sandales à talons",
  "Espadrilles", "Mocassins", "Ballerines", "Chaussures d'intérieur",
] as const;
export const SAC_TYPES = ["Sac à main", "Cabas", "Bandoulière", "Pochette", "Sac à dos", "Sac de sport"] as const;
export const BIJOU_TYPES = ["Collier", "Boucles d'oreilles", "Bracelet", "Bague", "Montre"] as const;
export const ACCESSOIRE_TYPES = [
  "Ceinture", "Foulard", "Écharpe", "Chapeau", "Casquette", "Lunettes",
  "Collants", "Chaussettes hautes", "Gourde",
] as const;

export const PALETTE: [string, string][] = [
  ["Blanc", "#F7F4EE"], ["Blanc cassé", "#EDE4D6"], ["Crème", "#E7DCC8"], ["Sable", "#D9C9B2"],
  ["Camel", "#C08A5E"], ["Caramel", "#B4835A"], ["Terracotta", "#B4735A"], ["Rouille", "#A9613F"],
  ["Brique", "#9E5A3C"], ["Chocolat", "#7C5436"], ["Moutarde", "#C39A50"], ["Kaki", "#8A8560"],
  ["Vert sauge", "#9AA389"], ["Vert bouteille", "#3F5342"], ["Taupe", "#A8967C"], ["Beige rosé", "#D8C3B4"],
  ["Rose poudré", "#D3AE9F"], ["Corail", "#C9846A"], ["Gris clair", "#C7C2B9"], ["Gris", "#9B968F"],
  ["Gris anthracite", "#4B4A47"], ["Bleu ciel", "#A9BFCB"], ["Denim", "#5E6E7C"], ["Marine", "#3A4152"],
  ["Prune", "#5B3A4A"], ["Bordeaux", "#6E3B3A"], ["Noir", "#2A2724"],
  // Ajouts du 02/10/2026 — COPIE de src/lib/data.ts (PALETTE) ; le test miroir exige l'identique.
  ["Rouge", "#933B33"], ["Bleu", "#4A6280"], ["Beige", "#CDBBA2"], ["Marron", "#964B00"],
  ["Cognac", "#9A5B34"], ["Rouge cerise", "#A32B33"], ["Vieux rose", "#C08A85"], ["Rose pâle", "#EBCFCB"],
  ["Fuchsia", "#B83B78"], ["Jaune", "#E0BE3C"], ["Orange", "#D9772B"], ["Abricot", "#E8A97E"],
  ["Vert olive", "#6B6E4A"], ["Vert forêt", "#2F4A38"], ["Émeraude", "#1F6B58"], ["Menthe", "#B7D3C1"],
  ["Bleu nuit", "#2B3350"], ["Bleu cobalt", "#1E4FA3"], ["Turquoise", "#3A9A9E"], ["Lavande", "#A99BC4"],
  ["Ivoire", "#F0EAE0"], ["Champagne", "#E8D9B5"], ["Nude", "#D9BBA0"], ["Gris perle", "#D3D0CB"],
];
export const PALETTE_BIJOU: [string, string][] = [
  ["Doré", "#C9A24B"], ["Argenté", "#B9BEC4"], ["Cuivré", "#B8734A"], ["Or rose", "#D4A995"],
  ["Bronze", "#8C6A3F"], ["Perle", "#EDE6DA"], ["Noir mat", "#2A2724"],
];

/** Distance euclidienne RGB — trouve la teinte de palette existante la plus proche d'un hex libre, jamais une couleur hors palette. */
export function nearestPaletteColor(hex: string, palette: [string, string][]): [string, string] {
  const [r, g, b] = hexToRgb(hex);
  let best = palette[0];
  let bestDist = Infinity;
  for (const entry of palette) {
    const [pr, pg, pb] = hexToRgb(entry[1]);
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  if (!Number.isFinite(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

