import { detectAccessoireType, detectBijouType, detectSacType, detectSubtype } from "./attributes";
import type { CategoryKey, Item, Season, ShoeType } from "./types";

/**
 * Pièce du catalogue de suggestions : sert à composer la capsule par défaut
 * tant que le dressing réel est vide. Ids à partir de 1001 pour ne jamais
 * entrer en collision avec les pièces ajoutées par l'utilisateur.
 */
export interface CatalogItem extends Item {
  /** 'femme' pour les pièces exclues des capsules homme, sinon 'unisexe'. */
  genre: "femme" | "unisexe";
}

// name, cat, colorName, hex
const RAW: [string, CategoryKey, string, string][] = [
  ["Chemise en lin", "haut", "Blanc cassé", "#EDE4D6"],
  ["T-shirt basique", "haut", "Blanc", "#F7F4EE"],
  ["Blouse en soie", "haut", "Rose poudré", "#D3AE9F"],
  ["Chemisier rayé", "haut", "Marine", "#3A4152"],
  ["Débardeur côtelé", "haut", "Noir", "#2A2724"],
  ["Chemise oversize", "haut", "Kaki", "#8A8560"],
  ["Top cache-cœur", "haut", "Terracotta", "#B4735A"],
  ["Blazer structuré", "veste", "Marine", "#3A4152"],
  ["Jean droit", "jean", "Denim", "#5E6E7C"],
  ["Pantalon tailleur", "pantalon", "Taupe", "#A8967C"],
  ["Jean brut", "jean", "Marine", "#3A4152"],
  ["Pantalon large", "pantalon", "Noir", "#2A2724"],
  ["Chino", "pantalon", "Sable", "#D9C9B2"],
  ["Short en lin", "short", "Crème", "#E7DCC8"],
  ["Jupe midi plissée", "jupe", "Kaki", "#8A8560"],
  ["Jupe droite", "jupe", "Noir", "#2A2724"],
  ["Robe portefeuille", "robe", "Terracotta", "#B4735A"],
  ["Robe chemise", "robe", "Marine", "#3A4152"],
  ["Robe longue fluide", "robe", "Rouille", "#A9613F"],
  ["Robe droite", "robe", "Noir", "#2A2724"],
  ["Pull col rond", "pull", "Camel", "#C08A5E"],
  ["Gilet fin", "pull", "Taupe", "#A8967C"],
  ["Pull torsadé", "pull", "Brique", "#9E5A3C"],
  ["Sweat molleton", "pull", "Gris", "#9B968F"],
  ["Trench beige", "manteau", "Sable", "#D9C9B2"],
  ["Manteau laine long", "manteau", "Chocolat", "#7C5436"],
  ["Coupe-vent léger", "manteau", "Marine", "#3A4152"],
  ["Veste en jean", "veste", "Denim", "#5E6E7C"],
  ["Combinaison lin", "combinaison", "Blanc cassé", "#EDE4D6"],
  ["Bottines cuir", "chaussures", "Chocolat", "#7C5436"],
  ["Baskets blanches", "chaussures", "Blanc", "#F7F4EE"],
  ["Sandales tressées", "chaussures", "Camel", "#C08A5E"],
  ["Escarpins", "chaussures", "Bordeaux", "#6E3B3A"],
  ["Mocassins", "chaussures", "Camel", "#C08A5E"],
  ["Ballerines", "chaussures", "Taupe", "#A8967C"],
  ["Sac cabas", "sac", "Camel", "#C08A5E"],
  ["Sac bandoulière", "sac", "Noir", "#2A2724"],
  ["Ceinture cuir", "accessoire", "Rouille", "#A9613F"],
  ["Foulard soie", "accessoire", "Moutarde", "#C39A50"],
  ["Écharpe laine", "accessoire", "Bordeaux", "#6E3B3A"],
  ["Boucles d’oreilles dorées", "bijou", "Doré", "#C9A24B"],
  ["Collier fin", "bijou", "Doré", "#C9A24B"],
];

export function catalogSeasonFor(cat: CategoryKey, name: string): Season {
  if (cat === "veste" || cat === "manteau" || cat === "pull") return "Automne / Hiver";
  if (/lin|short|débardeur|sandal|combinaison/.test((name || "").toLowerCase())) return "Printemps / Été";
  return "Toutes saisons";
}

function catalogShoeTypeFor(cat: CategoryKey, name: string): ShoeType | undefined {
  if (cat !== "chaussures") return undefined;
  const n = name.toLowerCase();
  if (/basket/.test(n)) return "Baskets";
  if (/escarpin/.test(n)) return "Escarpins";
  if (/mocassin/.test(n)) return "Mocassins";
  if (/bottine/.test(n)) return "Bottines";
  if (/botte/.test(n)) return "Bottes";
  if (/sandale/.test(n)) return "Sandales";
  if (/ballerine/.test(n)) return "Ballerines";
  return undefined;
}

export const CATALOG: CatalogItem[] = RAW.map(([name, cat, color, hex], i) => ({
  id: 1001 + i,
  name,
  cat,
  color,
  hex,
  season: catalogSeasonFor(cat, name),
  shoeType: catalogShoeTypeFor(cat, name),
  sacType: cat === "sac" ? detectSacType(name) || undefined : undefined,
  bijouType: cat === "bijou" ? detectBijouType(name) || undefined : undefined,
  accessoireType: cat === "accessoire" ? detectAccessoireType(name) || undefined : undefined,
  subtype: detectSubtype(cat, name) || undefined,
  // Rythme d'exemple : deux pièces sur trois « déjà portées », le reste jamais.
  worn: i % 3 !== 0 ? (i % 5) * 3 + 1 : null,
  genre: cat === "robe" || cat === "jupe" ? "femme" : "unisexe",
}));

export function isCatalogId(id: number): boolean {
  return id >= 1001;
}
