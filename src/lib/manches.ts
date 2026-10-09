import type { CategoryKey, Item, Manches } from "./types";

/**
 * LA LONGUEUR DES MANCHES (01/10/2026, demandé : « Il faudrait ajouter la
 * notion de manches longues » ; colonne `manches`, migration 0042).
 *
 * Trois valeurs, jamais déduites d'un nom ni d'un sous-type : une pièce sans
 * valeur est INCONNUE, et le moteur la traite comme avant. Seules les
 * catégories qui ont des manches la portent — le manteau aussi (09/10/2026) :
 * une doudoune peut être sans manches.
 */

export const MANCHES: readonly { valeur: Manches; libelle: string }[] = [
  { valeur: "sans", libelle: "Sans manches" },
  { valeur: "courtes", libelle: "Manches courtes" },
  { valeur: "longues", libelle: "Manches longues" },
];

/** Les catégories dont la longueur de manches se renseigne. */
export const CATEGORIES_A_MANCHES: readonly CategoryKey[] = ["haut", "pull", "robe", "combinaison", "veste", "manteau"];

export const aDesManches = (cat: CategoryKey): boolean => CATEGORIES_A_MANCHES.includes(cat);

/** Valeur lue en base : une des trois, sinon rien. */
export function manchesDepuis(brut: string | null | undefined): Manches | undefined {
  return brut === "sans" || brut === "courtes" || brut === "longues" ? brut : undefined;
}

export const libelleManches = (m: Manches): string => MANCHES.find((x) => x.valeur === m)!.libelle;

/** Un haut qui laisse les bras nus ou à demi : celui qui appelle une veste par temps frais. */
export const brasNus = (it: Pick<Item, "manches">): boolean => it.manches === "sans" || it.manches === "courtes";
