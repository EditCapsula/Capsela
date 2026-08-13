import type { AccessoireType, BijouType, CategoryKey, Coupe, Item, Matiere, SacType } from "./types";
import { SUBTYPES } from "./data";

/**
 * Attributs du moteur de règles stylistiques (matière, coupe, formalité,
 * statement, métal, rôle de superposition). Matière et coupe sont
 * auto-détectées à la saisie du nom (comme la saison) mais restent
 * modifiables et jamais bloquantes ; les autres attributs sont de pures
 * déductions, jamais saisies par l'utilisatrice.
 */

export const MATIERES: Matiere[] = ["Coton", "Lin", "Laine", "Soie", "Cuir", "Denim", "Synthétique"];
export const COUPES: Coupe[] = ["Serré", "Ajusté", "Ample"];

/** Pré-suggestion de matière à l'ajout — jamais imposée, l'utilisateur peut toujours la changer. */
export function detectMatiere(name: string): Matiere | null {
  const n = (name || "").toLowerCase();
  if (/lin/.test(n)) return "Lin";
  if (/laine|pull|gilet|tricot/.test(n)) return "Laine";
  if (/soie/.test(n)) return "Soie";
  if (/cuir|bottine|escarpin|mocassin|perfecto/.test(n)) return "Cuir";
  if (/jean|denim/.test(n)) return "Denim";
  if (/coton|t-shirt|chemise/.test(n)) return "Coton";
  if (/sweat|molleton|jogging|synthétique|synthetique|polyester/.test(n)) return "Synthétique";
  return null;
}

/** Pré-suggestion de coupe à l'ajout — jamais imposée, l'utilisateur peut toujours la changer. */
export function detectCoupe(name: string): Coupe | null {
  const n = (name || "").toLowerCase();
  if (/oversize|large|ample/.test(n)) return "Ample";
  if (/slim|moulant|ajusté/.test(n)) return "Ajusté";
  if (/skinny|serré/.test(n)) return "Serré";
  return null;
}

/** Coupe non pertinente pour ces catégories — masquée à la saisie. */
export function isCoupeApplicable(cat: CategoryKey): boolean {
  return !["chaussures", "sac", "bijou", "accessoire"].includes(cat);
}

/** Taille non pertinente pour ces catégories — masquée à la saisie. */
export function isSizeApplicable(cat: CategoryKey): boolean {
  return !["sac", "bijou", "accessoire"].includes(cat);
}

/** Pré-suggestion de type de sac à l'ajout — jamais imposée, jamais bloquante. */
export function detectSacType(name: string): SacType | null {
  const n = (name || "").toLowerCase();
  if (/cabas/.test(n)) return "Cabas";
  if (/bandoulière/.test(n)) return "Bandoulière";
  if (/dos/.test(n)) return "Sac à dos";
  if (/pochette/.test(n)) return "Pochette";
  if (/\bsac\b/.test(n)) return "Sac à main";
  return null;
}

/** Pré-suggestion de type de bijou à l'ajout — jamais imposée, jamais bloquante. */
export function detectBijouType(name: string): BijouType | null {
  const n = (name || "").toLowerCase();
  if (/collier/.test(n)) return "Collier";
  if (/boucle/.test(n)) return "Boucles d'oreilles";
  if (/bracelet/.test(n)) return "Bracelet";
  if (/bague/.test(n)) return "Bague";
  if (/montre/.test(n)) return "Montre";
  return null;
}

/** Pré-suggestion de type d'accessoire à l'ajout — jamais imposée, jamais bloquante. */
export function detectAccessoireType(name: string): AccessoireType | null {
  const n = (name || "").toLowerCase();
  if (/ceinture/.test(n)) return "Ceinture";
  if (/foulard/.test(n)) return "Foulard";
  if (/écharpe/.test(n)) return "Écharpe";
  if (/casquette/.test(n)) return "Casquette";
  if (/chapeau/.test(n)) return "Chapeau";
  if (/lunette/.test(n)) return "Lunettes";
  if (/collant/.test(n)) return "Collants";
  if (/chaussette/.test(n)) return "Chaussettes hautes";
  return null;
}

/** Pré-suggestion de sous-type générique (haut, pull, bas, robe, veste, manteau...) — jamais imposée, jamais bloquante (sauf blocage produit pour veste/manteau, géré à la saisie). */
export function detectSubtype(cat: CategoryKey, name: string): string | null {
  const options = SUBTYPES[cat];
  if (!options) return null;
  const n = (name || "").toLowerCase();
  const found = options.find((opt) => n.includes(opt.toLowerCase()));
  if (found) return found;
  if (cat === "veste") {
    if (/perfecto/.test(n)) return "Perfecto";
    if (/jean|denim/.test(n)) return "Veste en jean";
    if (/légère|leger|coupe-vent/.test(n)) return "Veste légère";
  }
  if (cat === "manteau") {
    if (/imperméable|impermeable|k-way|kway/.test(n)) return "Imperméable";
  }
  return null;
}

const n = (it: Item) => (it.name + " " + it.color).toLowerCase();

/** Couleurs neutres : se combinent librement, ne comptent pas comme "accent". */
export const NEUTRAL_COLORS = new Set([
  "Blanc", "Blanc cassé", "Crème", "Sable", "Camel", "Caramel", "Chocolat",
  "Taupe", "Kaki", "Gris clair", "Gris", "Gris anthracite", "Noir", "Marine", "Denim", "Beige rosé",
]);

export function isNeutralColor(colorName: string): boolean {
  return NEUTRAL_COLORS.has(colorName);
}

const MATIERE_DEFAULT_BY_CAT: Record<string, Matiere> = {
  chaussures: "Cuir",
  sac: "Cuir",
  bijou: "Synthétique",
  accessoire: "Synthétique",
  manteau: "Laine",
  veste: "Laine",
  pull: "Laine",
};

/** Matière dominante — la valeur saisie/suggérée sur la pièce prime, sinon déduite du nom. */
export function matiereOf(it: Item): Matiere {
  if (it.matiere) return it.matiere;
  return detectMatiere(it.name) || MATIERE_DEFAULT_BY_CAT[it.cat] || "Coton";
}

/**
 * Coupe interne à 3 états (utilisée par R-B4/R-S11/rolePieceOf) — la coupe
 * saisie/suggérée sur la pièce prime (Serré/Ajusté → "ajusté", Ample →
 * "oversize"), sinon déduite du nom. Par défaut "regular".
 */
export function coupeOf(it: Item): "ajusté" | "regular" | "oversize" {
  if (it.coupe === "Ample") return "oversize";
  if (it.coupe === "Serré" || it.coupe === "Ajusté") return "ajusté";
  const text = n(it);
  if (/oversize|large|ample|évasé/.test(text)) return "oversize";
  if (/ajusté|moulant|slim|cintré|côtelé/.test(text)) return "ajusté";
  return "regular";
}

/**
 * Niveau de formalité de la pièce elle-même (0 sport → 4 habillé), déduit du
 * nom. Sert à comparer une tenue au niveau_formalite_min de l'occasion
 * (R-B3) et à l'écart de formalité entre pièces (R-B2).
 */
export function formalityOf(it: Item): number {
  if (it.niveauFormalite != null) return it.niveauFormalite;
  const text = n(it);
  if (it.shoeType === "Baskets" || /sweat|jogging|molleton|legging|coupe-vent|survêt/.test(text)) return 0;
  if (/soie|tailleur|smoking|paillet|dentelle/.test(text) && /robe|blouse|combinaison/.test(text)) return 4;
  if (/tailleur|blazer|escarpin|chemis|blouse|gilet|robe chemise|robe droite/.test(text)) return 3;
  return 1;
}

/** Pièce "statement" (imprimé fort, couleur vive, coupe originale) — R-S5, R-S7. */
export function isStatement(it: Item): boolean {
  const text = n(it);
  if (/imprimé|paillet|clouté|brodé|fleuri|graphique|rayé/.test(text)) return true;
  return !isNeutralColor(it.color) && it.color !== "Beige rosé";
}

/** Métal dominant — pertinent pour bijou/accessoire uniquement. */
export function metalOf(it: Item): "or" | "argent" | "aucun" {
  const text = n(it);
  if (it.cat !== "bijou" && it.cat !== "accessoire") return "aucun";
  if (/dor[ée]/.test(text)) return "or";
  if (/argent[ée]/.test(text)) return "argent";
  return "aucun";
}

/**
 * Rôle de la pièce dans la superposition — catégories haut et pull uniquement.
 * ajusté/regular → base (portée en dessous), oversize → calque (par-dessus).
 */
export function rolePieceOf(it: Item): "base" | "calque" | "piece_unique" {
  if (it.cat !== "haut" && it.cat !== "pull") return "piece_unique";
  if (it.rolePiece) return it.rolePiece;
  return coupeOf(it) === "oversize" ? "calque" : "base";
}

/** Teinte (0-360°) approximée depuis le hex, pour l'harmonie du cercle chromatique (R-S2). */
export function hueOf(hex: string): number {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

/** Deux teintes sont adjacentes (≤40°) ou quasi complémentaires (150-210°) sur le cercle chromatique. */
export function huesHarmonious(hexA: string, hexB: string): boolean {
  const a = hueOf(hexA);
  const b = hueOf(hexB);
  const diff = Math.abs(a - b);
  const wrapped = Math.min(diff, 360 - diff);
  return wrapped <= 40 || (wrapped >= 150 && wrapped <= 210);
}
