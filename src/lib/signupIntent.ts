/**
 * Intention de création de compte, portée à travers l'aller-retour OAuth.
 *
 * POURQUOI CE MODULE EXISTE. `signInGoogle` quitte l'application : Google
 * reprend la main, puis la ramène sur l'origine, ce qui démonte et remonte
 * l'app. Aucun state React ne survit à ça — d'où `sessionStorage`, qui
 * survit au rechargement dans le même onglet et disparaît avec lui.
 *
 * LE DÉFAUT QU'IL CORRIGE (signalé le 14/09/2026 : « si je crée un compte
 * avec Google, on me redirige directement sur la homepage alors qu'on est
 * censé me faire passer sur l'onboarding »). La lecture était destructive et
 * appelée depuis DEUX endroits qui se déclenchent tous les deux au retour
 * OAuth — `getUser()` et `onAuthStateChange`. Le premier arrivé lisait
 * "signup", vidait la clé et posait justSignedUp à true ; le second lisait
 * une clé vide et le REPOSAIT à false. Le questionnaire était donc sauté
 * quel que soit l'ordre d'arrivée, puisque le perdant écrasait le gagnant.
 *
 * La consommation est donc mémorisée : le premier appel lit et vide le
 * stockage, les suivants rendent la même réponse. Deux appelants
 * concurrents obtiennent la même valeur au lieu de se contredire, et
 * l'intention reste consommée exactement une fois.
 */

const AUTH_INTENT_KEY = "capsela.authIntent";

/** null tant que l'intention n'a pas été consommée dans ce chargement de page. */
let consomme: boolean | null = null;

/**
 * Pose l'intention avant de déclencher `signInGoogle` — le seul point
 * d'entrée Google, exposé uniquement sur l'écran « Créer un compte ».
 */
export function markSignupIntent(): void {
  consomme = null;
  try {
    sessionStorage.setItem(AUTH_INTENT_KEY, "signup");
  } catch {
    // sessionStorage indisponible : au pire l'utilisatrice atterrit sur la
    // Homepage au lieu du questionnaire, jamais l'inverse.
  }
}

/**
 * Rend true si cette session vient de créer un compte. Idempotent : appelable
 * par plusieurs gestionnaires concurrents sans qu'aucun n'efface la réponse
 * de l'autre.
 */
export function consumeSignupIntent(): boolean {
  if (consomme === null) {
    let v: string | null = null;
    try {
      v = sessionStorage.getItem(AUTH_INTENT_KEY);
      sessionStorage.removeItem(AUTH_INTENT_KEY);
    } catch {
      // idem : absence de stockage = pas d'intention.
    }
    consomme = v === "signup";
  }
  return consomme;
}

/** Remet à zéro à la déconnexion, pour qu'une création de compte suivante dans le même onglet reparte propre. */
export function forgetSignupIntent(): void {
  consomme = null;
  try {
    sessionStorage.removeItem(AUTH_INTENT_KEY);
  } catch {
    // rien à oublier si le stockage est indisponible.
  }
}

/**
 * UN COMPTE TOUT JUSTE CRÉÉ (11/11/2026, signalé : « Quand je choisis Continuer avec Apple alors que je dois créer un compte, je n'ai
 * pas les étapes d'onboarding »). Apple et Google créent le compte à la première connexion, depuis « Se connecter » aussi — écran qui
 * ne pose jamais d'intention d'inscription. Un compte se reconnaît neuf à ses dates Supabase : créé il y a moins de FENETRE_COMPTE_NEUF_MS,
 * et sa dernière connexion est celle de sa création (à une minute près). Un compte existant n'est jamais concerné (règle du 17/08/2026).
 */
export const FENETRE_COMPTE_NEUF_MS = 10 * 60 * 1000;

export function compteToutJusteCree(
  user: { created_at?: string | null; last_sign_in_at?: string | null } | null | undefined,
  maintenant: number = Date.now()
): boolean {
  const cree = user?.created_at ? Date.parse(user.created_at) : NaN;
  if (!Number.isFinite(cree) || maintenant - cree > FENETRE_COMPTE_NEUF_MS || maintenant < cree - 60_000) return false;
  const derniere = user?.last_sign_in_at ? Date.parse(user.last_sign_in_at) : cree;
  return Number.isFinite(derniere) && Math.abs(derniere - cree) <= 60_000;
}
