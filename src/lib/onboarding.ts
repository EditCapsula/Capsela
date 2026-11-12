import type { Screen } from "./types";

/**
 * L'ONBOARDING OBLIGATOIRE ET SA REPRISE (12/11/2026, brief « Corrections 2.3 », point 2.1 — arbitrage de la propriétaire qui remplace
 * la règle du 17/08/2026 « un compte existant n'est jamais renvoyé vers l'onboarding »).
 *
 * POURQUOI. Testé sur la 2.2 : un compte créé n'a vu aucune question. Deux causes, mesurées dans le code :
 *   1. Dans l'app, le retour de la connexion Apple ou Google ne recharge pas la page : la session arrivait (`signedIn`) AVANT le profil
 *      et avant le signal « compte tout juste créé », posés après la lecture du profil. L'effet de navigation partait donc sur l'accueil
 *      avec un signal encore faux, et ne revenait plus, l'écran n'étant plus un écran d'accueil.
 *   2. Une inscription par e-mail avec confirmation : la personne confirme, revient par « Se connecter », et l'app la croyait ancienne.
 * Les deux cas disparaissent si la décision ne repose plus sur « ce compte vient-il d'être créé ? » mais sur ce qui compte :
 * le profil est-il TERMINÉ (`profiles.completed`) ? Un compte ne vaut jamais profil terminé.
 *
 * La progression est gardée en base, dans `profiles.prefs.onboardingEtape` (jsonb, sans migration) : chaque « Continuer » enregistre
 * le brouillon et l'étape atteinte ; fermer l'app ou se déconnecter reprend là. La fin du parcours pose `completed` et efface l'étape.
 */

/** Ce que l'app doit faire d'une session connectée : ouvrir le questionnaire, quitter l'écran d'accueil, ou rien. */
export type DecisionSession = "questionnaire" | "accueil" | null;

/** Les écrans d'avant la connexion : une session ouverte n'a rien à y faire. */
export const ECRANS_AVANT_CONNEXION: ReadonlySet<Screen> = new Set<Screen>(["welcome", "onboarding", "auth", "login"]);

export function decisionSession(p: {
  signedIn: boolean;
  /** Le profil est lu (ou le mode démo). Tant qu'il ne l'est pas, on ne conclut rien de son absence. */
  profileLoaded: boolean;
  /** Le profil n'a pas pu être lu (réseau) : on ne force jamais le questionnaire sur une lecture ratée. */
  profilIllisible: boolean;
  completed: boolean;
  screen: Screen;
}): DecisionSession {
  if (!p.signedIn) return null;
  if (p.profilIllisible) return ECRANS_AVANT_CONNEXION.has(p.screen) ? "accueil" : null;
  if (!p.profileLoaded) return null;
  if (!p.completed) return p.screen === "profileSetup" ? null : "questionnaire";
  return ECRANS_AVANT_CONNEXION.has(p.screen) ? "accueil" : null;
}

/**
 * La première étape du questionnaire : le prénom. L'écran ne la pose qu'à qui n'en a pas (une connexion Apple ne le transmet pas
 * toujours) ; sinon il ouvre la suivante, le genre.
 */
export const PREMIERE_ETAPE = "prenom";

