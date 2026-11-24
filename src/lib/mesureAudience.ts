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

/**
 * LA PLATEFORME (24/11/2026, demandé : distinguer le site et les apps dans un même flux Web). Les apps iOS et Android affichent le site
 * dans une vue web : sans ce repère, toutes leurs visites se confondent avec celles du site. Posée en PROPRIÉTÉ UTILISATEUR
 * `plateforme_capsela` (web, android, ios), elle accompagne chaque événement ; à déclarer une fois dans Google Analytics (Admin →
 * Définitions personnalisées, dimension de portée Utilisateur) pour filtrer les rapports. Rien de personnel : le type d'appareil.
 * Appelée seulement après consentement (App.tsx) ; met la commande en file si gtag.js n'est pas encore chargé.
 */
export function poserPlateforme(plateforme: string): void {
  if (typeof window === "undefined") return;
  try {
    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    // La forme exacte de gtag : il pousse son objet `arguments`, pas un tableau.
    const gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    } as (...args: unknown[]) => void;
    gtag("set", "user_properties", { plateforme_capsela: plateforme });
  } catch {
    // La mesure ne doit jamais casser l'écran.
  }
}

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
