import { describe, expect, it } from "vitest";
import { decisionSession } from "../onboarding";

/** L'ONBOARDING OBLIGATOIRE (12/11/2026, onboarding.ts, brief 2.3 point 2.1). */
const base = { signedIn: true, profileLoaded: true, profilIllisible: false, completed: false, screen: "auth" as const };

describe("decisionSession", () => {
  it("un nouveau compte (profil non terminé) part au questionnaire, d'où qu'il arrive", () => {
    expect(decisionSession(base)).toBe("questionnaire");
    expect(decisionSession({ ...base, screen: "login" })).toBe("questionnaire");
    // Le cas mesuré sur la 2.2 : l'app était déjà partie sur l'accueil quand le profil est arrivé.
    expect(decisionSession({ ...base, screen: "home" })).toBe("questionnaire");
  });

  it("n'en décide rien tant que le profil n'est pas lu : la session arrive avant lui dans l'app", () => {
    expect(decisionSession({ ...base, profileLoaded: false })).toBeNull();
  });

  it("ne relance pas le questionnaire déjà ouvert", () => {
    expect(decisionSession({ ...base, screen: "profileSetup" })).toBeNull();
  });

  it("un compte au profil terminé ne repasse jamais par l'onboarding", () => {
    expect(decisionSession({ ...base, completed: true })).toBe("accueil");
    expect(decisionSession({ ...base, completed: true, screen: "home" })).toBeNull();
    expect(decisionSession({ ...base, completed: true, screen: "wardrobe" })).toBeNull();
  });

  it("une lecture du profil ratée n'impose jamais le questionnaire", () => {
    expect(decisionSession({ ...base, profileLoaded: false, profilIllisible: true })).toBe("accueil");
    expect(decisionSession({ ...base, profileLoaded: false, profilIllisible: true, screen: "home" })).toBeNull();
  });

  it("sans session, rien", () => {
    expect(decisionSession({ ...base, signedIn: false })).toBeNull();
  });
});
