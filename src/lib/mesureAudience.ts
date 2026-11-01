/**
 * ÉVÉNEMENTS DE MESURE D'AUDIENCE (01/11/2026, refonte de « Ma Capsule », brief 7.4 : consultation d'une fiche, clic affilié,
 * pièce déjà possédée, avec leur provenance).
 *
 * On complète la mesure existante, sans système parallèle : Google Analytics n'est chargé qu'après consentement (App.tsx,
 * consent.ts) et pose alors `window.gtag`. Sans lui (refus, pas encore de choix, NEXT_PUBLIC_GA_ID absent), rien n'est envoyé ni
 * gardé. Jamais de donnée personnelle : des identifiants de pièces du catalogue, une saison, un onglet.
 */
export type EvenementCapsule = "fiche_piece_capsule" | "clic_lien_affilie" | "piece_deja_possedee";

export function suivreEvenement(nom: EvenementCapsule, parametres: Record<string, string | number>): void {
  if (typeof window === "undefined") return;
  const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
  if (typeof gtag !== "function") return;
  try {
    gtag("event", nom, parametres);
  } catch {
    // La mesure ne doit jamais casser l'écran.
  }
}
