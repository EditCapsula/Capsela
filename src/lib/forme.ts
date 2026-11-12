import type { CategoryKey, Couche, Item, Longueur } from "./types";

/*
 * LA LONGUEUR ET LA COUCHE D'UNE PIÈCE (12/11/2026, retour d'une testeuse : « robe longue noire + kimono + manteau court » ; choisi par
 * la propriétaire : les demander à l'ajout de la pièce, et les lire sur la photo). Colonnes `longueur` et `couche`, migration 0062.
 *
 *   · LA LONGUEUR (courte, midi, longue) d'une robe, d'une jupe, d'un manteau ;
 *   · LA COUCHE d'une veste : structurée (blazer, perfecto, veste en jean) ou fluide (kimono, veste souple) — une veste fluide ne se
 *     porte pas sous un manteau.
 *
 * Facultatives, jamais déduites d'un nom : une pièce sans valeur est INCONNUE, et le moteur la traite comme avant. L'analyse de la photo
 * les propose (« Détecté par Capsela »), la personne les confirme ou les change. Ce sont des attributs du VÊTEMENT, jamais de la personne.
 *
 * LES LISTES restent identiques à celles des fonctions Edge (supabase/functions/_shared/enumsPiece.ts) : un test le verrouille.
 */
export const LONGUEURS: readonly { valeur: Longueur; libelle: string }[] = [
  { valeur: "courte", libelle: "Courte" },
  { valeur: "midi", libelle: "Midi" },
  { valeur: "longue", libelle: "Longue" },
];
export const COUCHES: readonly { valeur: Couche; libelle: string; aide: string }[] = [
  { valeur: "structuree", libelle: "Structurée", aide: "Blazer, perfecto, veste en jean" },
  { valeur: "fluide", libelle: "Fluide", aide: "Kimono, veste souple" },
];

export const CATEGORIES_A_LONGUEUR: readonly CategoryKey[] = ["robe", "jupe", "manteau"];
export const aUneLongueur = (cat: CategoryKey): boolean => CATEGORIES_A_LONGUEUR.includes(cat);
export const aUneCouche = (cat: CategoryKey): boolean => cat === "veste";

export function longueurDepuis(brut: string | null | undefined): Longueur | undefined {
  return LONGUEURS.find((l) => l.valeur === brut)?.valeur;
}
export function coucheDepuis(brut: string | null | undefined): Couche | undefined {
  return COUCHES.find((c) => c.valeur === brut)?.valeur;
}

export const libelleLongueur = (l: Longueur): string => LONGUEURS.find((x) => x.valeur === l)!.libelle;
export const libelleCouche = (c: Couche): string => COUCHES.find((x) => x.valeur === c)!.libelle;

/** Une veste déclarée fluide : la couche légère qui ne se porte pas sous un manteau. Inconnue : false (le moteur comme avant). */
export const estCoucheFluide = (it: Pick<Item, "cat" | "couche">): boolean => it.cat === "veste" && it.couche === "fluide";
