import { isCatalogId } from "@/lib/catalog";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * L'OUVERTURE D'UNE PIÈCE depuis un hero (14/10/2026, demandé : « dans chaque hero, tous les éléments sont cliquables ») : la même
 * destination que le rail « Les pièces de ta tenue » — la fiche pour une pièce du dressing, « comment porter » pour une suggestion de
 * la capsule.
 */
export function useOuvrirPiece() {
  const { actions } = useCapsela();
  return (it: Item) => (isCatalogId(it.id) ? actions.openItemOutfits(it.id) : actions.openItem(it.id, false));
}
