import { describe, expect, it } from "vitest";
import { decisionRetour } from "../retourSysteme";
import { garderContexte, lireContexte, oublierContexte } from "../memoireEcrans";

/** LE RETOUR ANDROID ET LE CONTEXTE RETROUVÉ (22/10/2026). */

describe("decisionRetour", () => {
  it("une feuille ouverte se ferme d'abord, même sur un écran à bouton Retour", () => {
    expect(decisionRetour({ superposition: true, bouton: true, ecran: "piece" })).toBe("fermer");
  });
  it("sinon le bouton Retour de l'écran", () => {
    expect(decisionRetour({ superposition: false, bouton: true, ecran: "valise" })).toBe("bouton");
  });
  it("un écran de la barre du bas sans bouton revient à l'accueil", () => {
    for (const ecran of ["wardrobe", "capsule", "planifier", "history"] as const) {
      expect(decisionRetour({ superposition: false, bouton: false, ecran })).toBe("accueil");
    }
  });
  it("l'onboarding revient à son étape précédente ; l'accueil ferme l'app", () => {
    expect(decisionRetour({ superposition: false, bouton: false, ecran: "onboarding" })).toBe("etapePrecedente");
    expect(decisionRetour({ superposition: false, bouton: false, ecran: "home" })).toBe("quitter");
    expect(decisionRetour({ superposition: false, bouton: false, ecran: "welcome" })).toBe("quitter");
  });
});

describe("le contexte d'un écran", () => {
  it("gardé, relu, puis oublié par la barre du bas", () => {
    expect(lireContexte("wardrobe")).toBeNull();
    garderContexte("wardrobe", { groupeId: "robes" });
    expect(lireContexte("wardrobe")).toEqual({ groupeId: "robes" });
    oublierContexte("wardrobe");
    expect(lireContexte("wardrobe")).toBeNull();
  });
});
