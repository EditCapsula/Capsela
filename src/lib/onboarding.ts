import type { Screen } from "./types";

/**
 * L'ONBOARDING D'UN NOUVEAU COMPTE, ET SA REPRISE (12/11/2026, brief « Corrections 2.3 », point 2.1).
 *
 * LA RÈGLE, ARBITRÉE PAR LA PROPRIÉTAIRE LE 12/11/2026 : un compte EXISTANT n'est jamais renvoyé vers l'onboarding, quelle que soit la
 * complétude de son profil (règle du 17/08/2026, reconduite). Un compte NEUF y passe, et le reprend là où il l'a laissé tant qu'il ne
 * l'a pas terminé.
 *
 * POURQUOI CE MODULE. Testé sur la 2.2 : un compte tout juste créé avec Apple n'a vu aucune question. Dans l'app, le retour de la
 * connexion ne recharge pas la page : la session arrivait (`signedIn`) AVANT le profil et avant le signal « compte neuf », posés après
 * la lecture du profil. La navigation tranchait entre les deux — sur l'accueil — et ne revenait plus, l'écran n'étant plus un écran
 * d'accueil. Désormais elle attend le profil, et le signal est posé avec lui (auth.tsx, loadProfile).
 *
 * Un compte est NEUF (`nouveauCompte`) s'il vient d'être créé (intention d'inscription, dates Supabase) ou s'il n'a encore AUCUNE
 * ligne de profil. Un onboarding commencé (`onboardingEnCours`) se reconnaît à l'étape gardée en base, `profiles.prefs.onboardingEtape`
 * (jsonb, sans migration), posée dès l'ouverture du questionnaire puis à chaque « Continuer » : fermer l'app ou se déconnecter reprend
 * là. La fin du parcours pose `completed` et efface l'étape. Un compte ne vaut jamais profil terminé.
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
  /** Compte tout juste créé, ou sans aucune ligne de profil. */
  nouveauCompte: boolean;
  /** Un onboarding commencé et pas terminé (l'étape gardée en base). */
  onboardingEnCours: boolean;
  screen: Screen;
}): DecisionSession {
  if (!p.signedIn) return null;
  if (p.profilIllisible) return ECRANS_AVANT_CONNEXION.has(p.screen) ? "accueil" : null;
  if (!p.profileLoaded) return null;
  if (!p.completed && (p.nouveauCompte || p.onboardingEnCours)) return p.screen === "profileSetup" ? null : "questionnaire";
  return ECRANS_AVANT_CONNEXION.has(p.screen) ? "accueil" : null;
}

/**
 * La première étape du questionnaire : le prénom. L'écran ne la pose qu'à qui n'en a pas (une connexion Apple ne le transmet pas
 * toujours) ; sinon il ouvre la suivante, le genre.
 */
export const PREMIERE_ETAPE = "prenom";

