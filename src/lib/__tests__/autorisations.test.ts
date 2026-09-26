import { describe, expect, it } from "vitest";
import { decisionAcces, decisionSelonRegle, premiumRequis, reactionRefusServeur } from "../autorisations";
import { etatSimule, PROFILS_SIMULES, resoudreProfilSimule } from "../simulationPremium";

const MAINTENANT = new Date("2026-09-25T12:00:00Z");

describe("phase de test (26/09/2026) — AVIS_DE_STYLISTE → ACCES_LIBRE", () => {
  it("accès direct quel que soit le statut, sans vérification ni Gate", () => {
    for (const etat of ["premium", "gratuit", "inconnu"] as const) {
      expect(decisionAcces("AVIS_DE_STYLISTE", etat, false)).toBe("acces");
    }
  });

  it("pas de badge Premium tant que la fonctionnalité est libre", () => {
    expect(premiumRequis("AVIS_DE_STYLISTE")).toBe(false);
  });
});

// La règle du lancement reste testée telle quelle : repasser
// AVIS_DE_STYLISTE à "PREMIUM_REQUIRED" réactive exactement ce comportement.
describe("decisionSelonRegle — PREMIUM_REQUIRED (règle du lancement)", () => {
  it("Premium confirmé : accès", () => {
    expect(decisionSelonRegle("PREMIUM_REQUIRED", "premium", false)).toBe("acces");
  });

  it("gratuit (y compris abonnement expiré) : Premium Gate", () => {
    expect(decisionSelonRegle("PREMIUM_REQUIRED", "gratuit", false)).toBe("gate");
  });

  it("inconnu : jamais pris pour du Premium — vérification d'abord", () => {
    expect(decisionSelonRegle("PREMIUM_REQUIRED", "inconnu", false)).toBe("verification");
  });

  it("toujours inconnu après vérification : comportement sûr, le Gate", () => {
    expect(decisionSelonRegle("PREMIUM_REQUIRED", "inconnu", true)).toBe("gate");
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
    const d = decisionSelonRegle("PREMIUM_REQUIRED", etat, false);
    return d === "verification" ? decisionSelonRegle("PREMIUM_REQUIRED", etat, true) : d;
  };
  it("sous PREMIUM_REQUIRED : PREMIUM_ACTIVE → accès ; FREE, EXPIRED, UNKNOWN, DEMO → Gate", () => {
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
