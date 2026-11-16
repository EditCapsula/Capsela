import { coupeOf } from "./attributes";
import type { CoupePreferee } from "./preferencesSilhouette";
import type { Item } from "./types";

/*
 * LES COUPES D'UNE PIÈCE, au sens des « coupes préférées » du profil (31/10/2026, lot 4,
 * docs/onboarding-evolution/diagnostic-et-proposition.md § 2.4 et question 4).
 *
 * ARBITRAGE ÉDITORIAL validé par la propriétaire le 31/10/2026 pour Fluides / Structurées : le NOM d'abord, puis la MATIÈRE ;
 * sinon rien. Ajustées / Amples : `coupeOf` (la colonne `coupe`, sinon le nom), déjà lu ailleurs par le moteur. Droites : le
 * nom seul (« droit », « droite »). Une pièce peut avoir plusieurs coupes (un blazer droit structuré) ou aucune : AUCUNE coupe
 * connue = aucun bonus, aucune pénalité (règle du brief : une information manquante ne pénalise pas).
 *
 * Accessoires, chaussures, sacs, bijoux : aucune coupe. Seuls les vêtements portent une coupe.
 */

const VETEMENTS = new Set(["haut", "pull", "veste", "manteau", "robe", "combinaison", "pantalon", "jean", "jupe", "short"]);

const NOM_FLUIDE = /fluide|drap[ée]|\bflou|vaporeu/i;
const NOM_STRUCTURE = /blazer|tailleur|trench|caban|perfecto|costume|structur/i;
const MATIERE_STRUCTUREE = /structur|tweed|feutre/i;
const MATIERE_EPAISSE = /[ée]pais/i;
const MATIERE_FLUIDE = /soie|satin|viscose|cr[êe]pe|jersey|lyocell|tencel|modal|mousseline|fluide/i;

type PieceCoupe = Pick<Item, "name" | "cat" | "coupe" | "matiere"> & { matiereBrute?: string };

/** Fluide, structurée ou ni l'un ni l'autre : le nom tranche, sinon la matière ; une matière « épaisse » ne se déduit pas. */
export function tenueDeLaMatiere(it: PieceCoupe): "fluides" | "structurees" | null {
  if (NOM_FLUIDE.test(it.name)) return "fluides";
  if (NOM_STRUCTURE.test(it.name)) return "structurees";
  const m = it.matiereBrute ?? it.matiere ?? "";
  if (MATIERE_STRUCTUREE.test(m)) return "structurees";
  if (MATIERE_EPAISSE.test(m)) return null;
  if (MATIERE_FLUIDE.test(m)) return "fluides";
  return null;
}

export function coupesDeLaPiece(it: PieceCoupe): Set<CoupePreferee> {
  const coupes = new Set<CoupePreferee>();
  if (!VETEMENTS.has(it.cat)) return coupes;
  const c = coupeOf(it as Item);
  if (c === "ajusté") coupes.add("ajustees");
  if (c === "oversize") coupes.add("amples");
  if (/\bdroite?s?\b/i.test(it.name)) coupes.add("droites");
  const t = tenueDeLaMatiere(it);
  if (t) coupes.add(t);
  return coupes;
}

/** 1 si la pièce a au moins une des coupes préférées ; 0 sinon, et toujours 0 sans préférence (null, [] « Cela dépend »). */
export function accordCoupe(it: PieceCoupe, preferees: readonly CoupePreferee[] | null | undefined): 0 | 1 {
  if (!preferees?.length) return 0;
  const c = coupesDeLaPiece(it);
  return preferees.some((p) => c.has(p)) ? 1 : 0;
}

/**
 * LES COUPES PRÉFÉRÉES DANS LES TENUES (16/11/2026, demandé : « est-ce que tu prends bien en compte les préférences en termes de coupes
 * d'un utilisateur ? » — jusqu'ici, la capsule seule les lisait ; « oui, prépare-le »). Même principe que la silhouette ronde (R-S20) :
 * un BONUS de tenue (R-S31), sans malus ni phrase — deux vêtements ou plus d'une coupe préférée : +6 ; un seul : +3 —, et, là où le
 * moteur ne tire qu'une fois, le meilleur de quelques tirages (meilleurTirageMorphologique). Une coupe inconnue ne compte pas.
 * HORS PRODUCTION tant que la mesure avant / après (scripts/coupes-preferees-moteur.audit.ts) n'est pas validée.
 */
export const BONUS_COUPES_PREFEREES_EN_PRODUCTION = false;

export function bonusCoupesPreferees(pieces: readonly PieceCoupe[], preferees: readonly CoupePreferee[] | null | undefined): 0 | 3 | 6 {
  if (!preferees?.length) return 0;
  const n = pieces.filter((p) => accordCoupe(p, preferees) === 1).length;
  return n >= 2 ? 6 : n === 1 ? 3 : 0;
}
