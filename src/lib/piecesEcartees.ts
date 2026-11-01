/**
 * LES PIÈCES DE CAPSULE ÉCARTÉES, gardées sur l'appareil (01/11/2026, demandé
 * par la propriétaire : « il faut garder en mémoire cette pièce »).
 *
 * Une pièce suggérée par la capsule sort de la capsule quand on la déclare
 * possédée (« J'ai déjà » : la fiche ajoutée au dressing la remplace) ou qu'on
 * la retire. Jusqu'ici, cette liste (`state.suggestedExcluded`) ne vivait qu'en
 * mémoire : au rechargement, la pièce revenait dans la capsule, en double de
 * celle du dressing.
 *
 * Même solution que recommandationsRecentes.ts : une liste d'identifiants du
 * catalogue en localStorage, rangée par compte, effacée avec le compte
 * (donneesLocales.ts). Aucune table serveur : la synchroniser entre appareils
 * demanderait une migration.
 */

export const clePiecesEcartees = (userId: string | null): string => `capsela.piecesEcartees.${userId ?? "demo"}`;

/** Identifiants valides, sans doublon, dans l'ordre. Pure : tout ce qui n'est pas une liste de nombres est ignoré. */
export function normaliserPiecesEcartees(brut: unknown): number[] {
  if (!Array.isArray(brut)) return [];
  return [...new Set(brut.filter((n): n is number => typeof n === "number" && Number.isFinite(n)))];
}

export function lirePiecesEcartees(userId: string | null): number[] {
  if (typeof window === "undefined") return [];
  try {
    const brut = window.localStorage.getItem(clePiecesEcartees(userId));
    return brut ? normaliserPiecesEcartees(JSON.parse(brut)) : [];
  } catch {
    return [];
  }
}

/** Défensif : le stockage peut manquer (navigation privée), rien ne doit alors échouer. */
export function ecrirePiecesEcartees(userId: string | null, ids: number[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(clePiecesEcartees(userId), JSON.stringify(normaliserPiecesEcartees(ids)));
  } catch {
    // Stockage indisponible : la mémoire de la session suffit.
  }
}
