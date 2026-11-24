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
 * LE CHARGEMENT DE GOOGLE ANALYTICS (24/11/2026), appelé seulement après consentement (App.tsx, consent.ts). Écrit ici plutôt que
 * par le composant de @next/third-parties, qui n'accepte aucun réglage : il fallait poser, AVANT la première visite comptée,
 *   · la PLATEFORME (demandé : distinguer le site et les apps dans un même flux Web — les apps affichent le site dans une vue web) :
 *     propriété utilisateur `plateforme_capsela` (web, android, ios), à déclarer dans Google Analytics (Admin → Définitions
 *     personnalisées, dimension de portée Utilisateur). Rien de personnel : le type d'appareil ;
 *   · la DURÉE DES COOKIES `_ga` : 13 mois au plus, jamais prolongée à chaque visite (recommandation de la CNIL ; page « Cookies et
 *     traceurs ») — par défaut, gtag.js les garde deux ans et les renouvelle à chaque visite.
 * Une seule fois par lancement ; ne jette jamais.
 */
export const DUREE_COOKIE_GA_S = 13 * 30 * 24 * 3600;
let gaCharge = false;

export function chargerGoogleAnalytics(id: string, plateforme: string): void {
  if (gaCharge || typeof window === "undefined" || !id) return;
  gaCharge = true;
  try {
    const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void };
    w.dataLayer = w.dataLayer || [];
    // La forme exacte de gtag : il pousse son objet `arguments`, pas un tableau.
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    } as (...args: unknown[]) => void;
    w.gtag("js", new Date());
    w.gtag("set", "user_properties", { plateforme_capsela: plateforme });
    w.gtag("config", id, { cookie_expires: DUREE_COOKIE_GA_S, cookie_update: false });
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
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
