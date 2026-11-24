/**
 * ÉVÉNEMENTS DE MESURE D'AUDIENCE (01/11/2026, refonte de « Ma Capsule », brief 7.4 : consultation d'une fiche, clic affilié,
 * pièce déjà possédée, avec leur provenance).
 *
 * On complète la mesure existante, sans système parallèle : Google Analytics n'est chargé qu'après consentement (App.tsx,
 * consent.ts) et pose alors `window.gtag`. Sans lui (refus, pas encore de choix, NEXT_PUBLIC_GA_ID absent), rien n'est envoyé ni
 * gardé. Jamais de donnée personnelle : des identifiants de pièces du catalogue, une saison, un onglet.
 */
/**
 * L'ID DE MESURE GOOGLE ANALYTICS (24/11/2026) : celui du flux Web « capsela.app », communiqué par la propriétaire. La variable
 * NEXT_PUBLIC_GA_ID, quand elle est posée (Vercel, builds des apps), le remplace ; sinon il vaut pour tout build de PRODUCTION — la
 * variable n'a pas pu être ajoutée dans Vercel le même jour. En développement (`next dev`), rien : aucune mesure ni bandeau sur un
 * poste de travail. Un ID de mesure n'est pas un secret : il figure dans le code de toute page mesurée. La mesure ne charge toujours
 * qu'après consentement (consent.ts).
 */
export const ID_MESURE_CAPSELA = "G-D5KJXCVKCV";
export const idMesure = (): string =>
  process.env.NEXT_PUBLIC_GA_ID || (process.env.NODE_ENV === "production" ? ID_MESURE_CAPSELA : "");

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
