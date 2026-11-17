import type { CategoryKey, Item } from "./types";

/**
 * L'ORDRE DES PIÈCES D'UNE TENUE, À L'AFFICHAGE (17/11/2026, signalé sur le calendrier : la tenue du jour montrait le manteau, le sac et
 * un bijou, et ses pièces principales derrière « +5 »). Les pièces principales d'abord (robe ou combinaison, haut, bas), puis les couches
 * (pull, veste, manteau), les chaussures, et les accessoires en dernier (sac, bijou, accessoire). C'est l'ordre que le résumé d'un look
 * de valise suivait déjà (valise.ts), réutilisé ici.
 */
export const ORDRE_PIECES: readonly CategoryKey[] = ["robe", "combinaison", "haut", "pull", "pantalon", "jean", "jupe", "short", "veste", "manteau", "chaussures", "sac", "bijou", "accessoire"];

const rang = (cat: CategoryKey): number => {
  const i = ORDRE_PIECES.indexOf(cat);
  return i < 0 ? ORDRE_PIECES.length : i;
};

/** Les pièces dans l'ordre d'affichage ; à rang égal, l'ordre reçu (tri stable). Ne modifie pas le tableau reçu. */
export function trierPiecesDeTenue<T extends Pick<Item, "cat">>(pieces: readonly T[]): T[] {
  return pieces.map((p, i) => ({ p, i })).sort((a, b) => rang(a.p.cat) - rang(b.p.cat) || a.i - b.i).map(({ p }) => p);
}
