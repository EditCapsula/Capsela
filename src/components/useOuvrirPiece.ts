import { isCatalogId } from "@/lib/catalog";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * L'OUVERTURE D'UNE PIÈCE depuis un hero (14/10/2026, demandé : « dans chaque hero, tous les éléments sont cliquables ») : la même
 * destination que le rail « Les pièces de ta tenue » — la FICHE de la pièce, pour une pièce du dressing comme pour une suggestion de la
 * capsule (« Suggestion », avec ses informations). Plus « Comment porter … ? » depuis un hero (14/10/2026, demandé).
 */
export function useOuvrirPiece() {
  const { actions } = useCapsela();
  return (it: Item) => actions.openItem(it.id, isCatalogId(it.id));
}
