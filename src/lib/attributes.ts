import type { AccessoireType, BijouType, CategoryKey, Coupe, IntensiteCouleur, Item, Matiere, OccasionKey, SacType, ShoeType, Tons } from "./types";
import { CATLABEL, SUBTYPES } from "./data";

/**
 * Attributs du moteur de règles stylistiques (matière, coupe, formalité,
 * statement, métal, rôle de superposition). Matière et coupe sont
 * auto-détectées à la saisie du nom (comme la saison) mais restent
 * modifiables et jamais bloquantes ; les autres attributs sont de pures
 * déductions, jamais saisies par l'utilisatrice.
 */

// Liste élargie (recette 24/08/2026, signalé : liste trop courte pour que
// l'analyse photo puisse retenir la bonne matière sur des pièces réelles).
export const MATIERES: Matiere[] = [
  "Coton",
  "Lin",
  "Laine",
  "Cachemire",
  "Soie",
  "Viscose",
  "Cuir",
  "Daim",
  "Denim",
  "Velours",
  "Polyester",
  "Nylon",
  "Synthétique",
];
export const COUPES: Coupe[] = ["Serré", "Ajusté", "Ample"];

/** Pré-suggestion de matière à l'ajout — jamais imposée, l'utilisateur peut toujours la changer. */
export function detectMatiere(name: string): Matiere | null {
  const n = (name || "").toLowerCase();
  if (/cachemire|cashmere/.test(n)) return "Cachemire";
  if (/lin/.test(n)) return "Lin";
  if (/laine|pull|gilet|tricot|maille/.test(n)) return "Laine";
  if (/soie/.test(n)) return "Soie";
  if (/viscose/.test(n)) return "Viscose";
  if (/daim|suède|suede/.test(n)) return "Daim";
  if (/cuir|bottine|escarpin|mocassin|perfecto/.test(n)) return "Cuir";
  if (/jean|denim/.test(n)) return "Denim";
  if (/velours/.test(n)) return "Velours";
  if (/polyester/.test(n)) return "Polyester";
  if (/nylon/.test(n)) return "Nylon";
  if (/coton|t-shirt|chemise/.test(n)) return "Coton";
  if (/sweat|molleton|jogging|synthétique|synthetique/.test(n)) return "Synthétique";
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

/**
 * Pré-suggestion de type de sac à l'ajout — jamais imposée, jamais bloquante.
 * Correctif 23/08/2026 (signalé : "Gourde de sport", un accessoire, catégorisée
 * à tort en sac) — l'ancien /sport|gym|fitness/ matchait ces mots seuls
 * n'importe où dans le nom, donc n'importe quel article "de sport" (gourde,
 * casquette, chaussettes...) était pris pour un sac de sport. Exige
 * désormais la mention explicite d'un sac (même esprit que les autres
 * branches ci-dessous, toutes ancrées sur le mot du produit lui-même).
 */
export function detectSacType(name: string): SacType | null {
  const n = (name || "").toLowerCase();
  if (/sac de sport|sac de gym|sac de fitness|gym bag/.test(n)) return "Sac de sport";
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
  if (/gourde/.test(n)) return "Gourde";
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
 * Pré-suggestion d'occasions à l'ajout d'une pièce (recette 24/08/2026,
 * "Ajouter une pièce" repensé — Capsela recommande plutôt que de demander à
 * l'utilisatrice de déterminer seule les 10 occasions compatibles).
 * Heuristique de premier jet, uniquement par catégorie (+ type de chaussure
 * pour distinguer le sport) — jamais imposée, modifiable via "Modifier les
 * occasions". À affiner plus tard avec un vrai signal de formalité si
 * besoin (matière, coupe...).
 */
const OCCASIONS_DEFAULT_BY_CAT: Partial<Record<CategoryKey, OccasionKey[]>> = {
  haut: ["quotidien", "travail_formel"],
  pull: ["quotidien", "cocooning"],
  pantalon: ["quotidien", "travail_formel"],
  jean: ["quotidien"],
  jupe: ["quotidien", "soiree"],
  short: ["quotidien", "sport"],
  robe: ["soiree", "date", "evenement_perso"],
  combinaison: ["soiree", "date"],
  veste: ["quotidien", "travail_formel", "date", "soiree"],
  manteau: ["quotidien", "travail_formel", "date", "soiree"],
  chaussures: ["quotidien", "travail_formel"],
  sac: ["quotidien", "travail_formel"],
  bijou: ["quotidien", "soiree"],
  accessoire: ["quotidien"],
};

export function suggestOccasions(cat: CategoryKey, shoeType?: ShoeType | null): OccasionKey[] {
  if (cat === "chaussures" && shoeType === "Baskets") return ["quotidien", "sport"];
  return OCCASIONS_DEFAULT_BY_CAT[cat] || ["quotidien"];
}

/**
 * Nom composé automatiquement à la fin de l'analyse photo (recette
 * 24/08/2026, "Manteau en laine chocolat") — jamais imposé, appliqué
 * uniquement tant que l'utilisatrice n'a pas touché le champ elle-même
 * (addNameTouched, store.tsx). Purement client, aucun appel OpenAI
 * supplémentaire : recompose simplement les champs déjà détectés.
 */
export function suggestName(
  cat: CategoryKey,
  subtype: string | null | undefined,
  matiere: Matiere | null | undefined,
  colorName: string | null | undefined
): string {
  const parts = [subtype || CATLABEL[cat]];
  if (matiere) parts.push(`en ${matiere.toLowerCase()}`);
  if (colorName) parts.push(colorName.toLowerCase());
  return parts.join(" ");
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
  if (it.statement != null) return it.statement;
  const text = n(it);
  if (/imprimé|paillet|clouté|brodé|fleuri|graphique|rayé/.test(text)) return true;
  return !isNeutralColor(it.color) && it.color !== "Beige rosé";
}

/** Métal dominant — pertinent pour bijou/accessoire uniquement. */
export function metalOf(it: Item): "or" | "argent" | "aucun" {
  if (it.cat !== "bijou" && it.cat !== "accessoire") return "aucun";
  if (it.metalDominant) return it.metalDominant;
  const text = n(it);
  if (/dor[ée]/.test(text)) return "or";
  if (/argent[ée]/.test(text)) return "argent";
  return "aucun";
}

/** Types de haut jamais portés ouverts par-dessus un autre haut/une robe, même en coupe oversize — un t-shirt ample reste un t-shirt, pas une chemise ouverte (correctif 21/08/2026, signalé : t-shirt oversize proposé en layering sur une robe). */
const NEVER_LAYER_RE = /t-shirt|d[ée]bardeur|\bpolo\b|crop top|maillot|jersey|bandeau|brassière/;

/**
 * Rôle de la pièce dans la superposition — catégories haut et pull uniquement.
 * ajusté/regular → base (portée en dessous), oversize → calque (par-dessus),
 * sauf les types NEVER_LAYER_RE qui restent "base" quelle que soit la coupe.
 */
export function rolePieceOf(it: Item): "base" | "calque" | "piece_unique" {
  if (it.cat !== "haut" && it.cat !== "pull") return "piece_unique";
  if (it.rolePiece) return it.rolePiece;
  if (NEVER_LAYER_RE.test(((it.subtype || "") + " " + it.name).toLowerCase())) return "base";
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

/** Saturation et luminosité (0-1) approximées depuis le hex — complète hueOf pour dériver tons/intensité. */
function satLightOf(hex: string): { s: number; l: number } {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16) / 255;
  const g = parseInt(v.slice(2, 4), 16) / 255;
  const b = parseInt(v.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min));
  return { s, l };
}

/**
 * Ton chaud/froid de la couleur — la valeur stockée prime (source :
 * vestiaire_universel), sinon déduite du hex (teinte + quasi-neutres gris/
 * blanc/noir/très clairs ou très foncés rangés dans "les_deux"). Sert au
 * rapprochement avec l'affinité de palette du profil (Tons chauds/froids).
 */
export function tonsOf(it: Item): Tons {
  if (it.tonsCouleur) return it.tonsCouleur;
  const { s, l } = satLightOf(it.hex);
  if (s < 0.12 || l > 0.92 || l < 0.08) return "les_deux";
  const h = hueOf(it.hex);
  if (h < 70 || h >= 320) return "chauds";
  if (h >= 150 && h < 320) return "froids";
  return "les_deux";
}

/**
 * Intensité de la couleur — la valeur stockée prime (source :
 * vestiaire_universel), sinon déduite du hex (saturation/luminosité). Sert au
 * rapprochement avec l'intensité de palette du profil.
 */
export function intensiteOf(it: Item): IntensiteCouleur {
  if (it.intensiteCouleur) return it.intensiteCouleur;
  const { s, l } = satLightOf(it.hex);
  if (s < 0.18) return "douce";
  if (l < 0.35 && s > 0.3) return "intense";
  if (l > 0.6 && s > 0.35) return "lumineuse";
  return "melange";
}
