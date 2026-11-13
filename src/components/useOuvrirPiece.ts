import { ouvrirFeuillePiece } from "@/components/FeuillePieceGlobale";
import type { Item } from "@/lib/types";

/**
 * L'OUVERTURE D'UNE PIÈCE VUE DANS UN LOOK (hero, flat lay, grille, rail, idée de look, avis d'un proche).
 *
 * Historique : un aperçu en feuille (14/10/2026), puis la fiche complète directement (15/10/2026), puis, sur les flat lays de l'accueil,
 * de Tenue et de Planifier, la feuille courte avec « Remplacer » (12/11/2026, RemplacementPiece). Depuis le 13/11/2026 (harmonisation
 * des fiches, validée : « une pièce vue dans un look ouvre la feuille courte partout ») : la même feuille courte, sans « Remplacer »
 * là où le look ne se modifie pas (FeuillePieceGlobale) ; « Voir » ouvre la fiche complète, ou la fiche de suggestion. Un écran dont
 * le look se modifie passe son propre `onPiece` (useRemplacementPiece).
 */
export function useOuvrirPiece() {
  return (it: Item) => ouvrirFeuillePiece(it);
}
