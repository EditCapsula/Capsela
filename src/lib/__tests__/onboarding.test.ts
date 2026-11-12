import { describe, expect, it } from "vitest";
import { decisionSession } from "../onboarding";

/**
 * L'ONBOARDING D'UN NOUVEAU COMPTE (12/11/2026, onboarding.ts). Arbitré par la propriétaire : un compte existant n'y est jamais
 * renvoyé ; un compte neuf y passe et le reprend tant qu'il ne l'a pas terminé.
 */
const neuf = { signedIn: true, profileLoaded: true, profilIllisible: false, completed: false, nouveauCompte: true, onboardingEnCours: false, screen: "auth" as const };
const existant = { ...neuf, nouveauCompte: false };

describe("decisionSession", () => {
  it("un compte neuf part au questionnaire, d'où qu'il arrive", () => {
    expect(decisionSession(neuf)).toBe("questionnaire");
    expect(decisionSession({ ...neuf, screen: "login" })).toBe("questionnaire");
    // Le cas mesuré sur la 2.2 (Apple) : l'app était déjà partie sur l'accueil quand le profil est arrivé.
    expect(decisionSession({ ...neuf, screen: "home" })).toBe("questionnaire");
  });

  it("un compte existant au profil incomplet n'est jamais renvoyé vers l'onboarding (règle du 17/08/2026)", () => {
    expect(decisionSession(existant)).toBe("accueil");
    expect(decisionSession({ ...existant, screen: "home" })).toBeNull();
  });

  it("un onboarding commencé et interrompu se reprend, même quand le compte n'est plus « tout juste créé »", () => {
    expect(decisionSession({ ...existant, onboardingEnCours: true })).toBe("questionnaire");
    expect(decisionSession({ ...existant, onboardingEnCours: true, screen: "home" })).toBe("questionnaire");
  });

  it("un profil terminé ne repasse jamais par l'onboarding", () => {
    expect(decisionSession({ ...neuf, completed: true })).toBe("accueil");
    expect(decisionSession({ ...neuf, completed: true, onboardingEnCours: true, screen: "home" })).toBeNull();
  });

  it("n'en décide rien tant que le profil n'est pas lu : la session arrive avant lui dans l'app", () => {
    expect(decisionSession({ ...neuf, profileLoaded: false })).toBeNull();
  });

  it("ne relance pas le questionnaire déjà ouvert", () => {
    expect(decisionSession({ ...neuf, screen: "profileSetup" })).toBeNull();
  });

  it("une lecture du profil ratée n'impose jamais le questionnaire", () => {
    expect(decisionSession({ ...neuf, profileLoaded: false, profilIllisible: true })).toBe("accueil");
    expect(decisionSession({ ...neuf, profileLoaded: false, profilIllisible: true, screen: "home" })).toBeNull();
  });

  it("sans session, rien", () => {
    expect(decisionSession({ ...neuf, signedIn: false })).toBeNull();
  });
});
