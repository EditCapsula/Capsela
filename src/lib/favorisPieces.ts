/**
 * LES PIÈCES FAVORITES DE LA CAPSULE, gardées sur l'appareil (01/11/2026, demandé par la propriétaire : « crée des favoris »,
 * les cœurs de l'onglet Explorer).
 *
 * Aucune structure équivalente n'existait : « Mes looks » enregistre des tenues, pas des pièces. Même solution que
 * piecesEcartees.ts : une liste de clés en localStorage, rangée par compte, effacée avec le compte (donneesLocales.ts). Les clés
 * sont celles de `cleEntree` (« c » + identifiant du catalogue, « d » + identifiant du dressing) : les deux numérotations sont
 * indépendantes et pourraient se croiser. Les retrouver sur un autre appareil demanderait une migration.
 */

export const cleFavorisPieces = (userId: string | null): string => `capsela.favorisPieces.${userId ?? "demo"}`;

/** Clés valides (« c » ou « d » suivi d'un entier), sans doublon. Pure. */
export function normaliserFavoris(brut: unknown): string[] {
  if (!Array.isArray(brut)) return [];
  return [...new Set(brut.filter((k): k is string => typeof k === "string" && /^[cd]-?\d+$/.test(k)))];
}

export function lireFavorisPieces(userId: string | null): string[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(cleFavorisPieces(userId));
    return brut ? normaliserFavoris(JSON.parse(brut)) : [];
  } catch {
    return [];
  }
}

export function ecrireFavorisPieces(userId: string | null, cles: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(cleFavorisPieces(userId), JSON.stringify(normaliserFavoris(cles)));
  } catch {
    // Stockage indisponible : les favoris tiennent le temps de la session.
  }
}
