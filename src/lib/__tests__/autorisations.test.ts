import { describe, expect, it } from "vitest";
import { decisionAcces, reactionRefusServeur } from "../autorisations";
import { etatSimule, PROFILS_SIMULES, resoudreProfilSimule } from "../simulationPremium";

const MAINTENANT = new Date("2026-09-25T12:00:00Z");

describe("decisionAcces — AVIS_DE_STYLISTE → PREMIUM_REQUIRED", () => {
  it("Premium confirmé : accès", () => {
    expect(decisionAcces("AVIS_DE_STYLISTE", "premium", false)).toBe("acces");
  });

  it("gratuit (y compris abonnement expiré) : Premium Gate", () => {
    expect(decisionAcces("AVIS_DE_STYLISTE", "gratuit", false)).toBe("gate");
  });

  it("inconnu : jamais pris pour du Premium — vérification d'abord", () => {
    expect(decisionAcces("AVIS_DE_STYLISTE", "inconnu", false)).toBe("verification");
  });

  it("toujours inconnu après vérification : comportement sûr, le Gate", () => {
    expect(decisionAcces("AVIS_DE_STYLISTE", "inconnu", true)).toBe("gate");
  });
});

describe("reactionRefusServeur — Gate pour un refus d'abonnement, erreur pour une panne", () => {
  it("403 → Premium Gate", () => expect(reactionRefusServeur(403)).toBe("gate"));
  it("503 (statut impossible à vérifier) → message + Réessayer, jamais le Gate", () =>
    expect(reactionRefusServeur(503)).toBe("erreur_reessayer"));
});

describe("simulation du statut Premium — parcours de chaque profil", () => {
  const parcours = (profil: (typeof PROFILS_SIMULES)[number]) => {
    const etat = etatSimule(profil, MAINTENANT);
    const d = decisionAcces("AVIS_DE_STYLISTE", etat, false);
    return d === "verification" ? decisionAcces("AVIS_DE_STYLISTE", etat, true) : d;
  };
  it("PREMIUM_ACTIVE → accès ; FREE, EXPIRED, UNKNOWN, DEMO → Gate", () => {
    expect(PROFILS_SIMULES.map((p) => [p, parcours(p)])).toEqual([
      ["PREMIUM_ACTIVE", "acces"],
      ["FREE", "gate"],
      ["EXPIRED", "gate"],
      ["UNKNOWN", "gate"],
      ["DEMO", "gate"],
    ]);
  });

  it("EXPIRED passe par la vraie règle d'expiration", () => {
    expect(etatSimule("EXPIRED", MAINTENANT)).toBe("gratuit");
  });
});

describe("resoudreProfilSimule — jamais en production (TEST 10)", () => {
  it("production : aucune simulation, quelle que soit la demande", () => {
    expect(resoudreProfilSimule("production", "PREMIUM_ACTIVE", "PREMIUM_ACTIVE")).toBeNull();
  });

  it("développement : l'URL prime, puis la valeur mémorisée", () => {
    expect(resoudreProfilSimule("development", "FREE", "PREMIUM_ACTIVE")).toBe("FREE");
    expect(resoudreProfilSimule("development", null, "EXPIRED")).toBe("EXPIRED");
  });

  it("AUCUNE ou valeur inconnue : simulation arrêtée", () => {
    expect(resoudreProfilSimule("development", "AUCUNE", "FREE")).toBeNull();
    expect(resoudreProfilSimule("development", "ADMIN", null)).toBeNull();
  });
});
