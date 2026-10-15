import { isCatalogId } from "@/lib/catalog";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * L'OUVERTURE D'UNE PIÈCE depuis un hero (accueil, carrousel, Tenue, look planifié…). Du 14/10/2026 au 15/10/2026 : un APERÇU en
 * feuille (ApercuPiece), puis « Voir la fiche ». Depuis le 15/10/2026 (demandé : « au clic sur une pièce depuis le hero, affiche la
 * page détaillée de la pièce ») : la FICHE directement, en suggestion pour une pièce de la capsule — la même destination que le
 * bouton « Voir la fiche » de l'aperçu, une étape de moins. La flèche de la fiche ramène à l'écran du hero (pieceReturn).
 */
export function useOuvrirPiece() {
  const { actions } = useCapsela();
  return (it: Item) => actions.openItem(it.id, isCatalogId(it.id));
}
