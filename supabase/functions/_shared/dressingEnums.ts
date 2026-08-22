// Mirroir Deno des enums de saisie du dressing (src/lib/data.ts / attributes.ts,
// recette 22/08/2026, analyse photo de pièces réelles) — même raison que
// _shared/imagePrompt.ts : une Edge Function ne peut pas importer directement
// le code Next.js (chemins alias, bundling). Ces listes changent rarement ;
// en cas de désynchronisation avec src/lib/data.ts, le pire risque est une
// valeur suggérée non reconnue (ignorée sans casser l'ajout, cf. index.ts),
// jamais un blocage.

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

export const MATIERES = ["Coton", "Lin", "Laine", "Soie", "Cuir", "Denim", "Synthétique"] as const;
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

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  if (!Number.isFinite(n)) return [128, 128, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
