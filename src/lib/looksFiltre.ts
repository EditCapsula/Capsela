import { isWishlistLook } from "./selectors";
import type { SavedLook } from "./types";

/**
 * Filtres des looks, partagés par le Dressing et « Mes looks » (refonte du
 * 25/09/2026). « wishlist » = looks contenant des pièces suggérées ; il n'a
 * pas d'onglet, il est posé par la ligne « ✦ Looks suggérés par Capsela ».
 */
export type FiltreLooks = "all" | "saved" | "created" | "wishlist";

export function filtrerLooks(looks: SavedLook[], filtre: FiltreLooks): SavedLook[] {
  return looks.filter(
    (l) =>
      filtre === "all" ||
      (filtre === "saved" && l.source === "saved") ||
      (filtre === "created" && l.source === "created") ||
      (filtre === "wishlist" && isWishlistLook(l))
  );
}
