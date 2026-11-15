import { describe, expect, it } from "vitest";
import { DECOMPTE_SYNTHESE_S, dureeDecompteSynthese, libelleDecompte, phraseCapsule, phraseSilhouette } from "../syntheseProfil";

describe("phraseSilhouette", () => {
  it("ne promet que ce que le moteur fait", () => {
    expect(phraseSilhouette("f_poire")).toContain("dans ta capsule comme dans tes tenues");
    expect(phraseSilhouette("f_sablier")).toBe("Des coupes, volumes et proportions accordés à ta silhouette dans tes tenues.");
    expect(phraseSilhouette("f_pomme")).not.toContain("accordés");
  });
});

describe("phraseCapsule", () => {
  it("ne cite la silhouette que si elle oriente la sélection", () => {
    expect(phraseCapsule({ morphology: "f_poire", nbCouleurs: 3 })).toBe(
      "Nous allons composer une sélection de pièces adaptées à ton style, ta silhouette et tes couleurs préférées."
    );
    expect(phraseCapsule({ morphology: "f_sablier", nbCouleurs: 3 })).toBe("Nous allons composer une sélection de pièces adaptées à ton style et tes couleurs préférées.");
  });
  it("sans couleur choisie, le style seul", () => {
    expect(phraseCapsule({ morphology: null, nbCouleurs: 0 })).toBe("Nous allons composer une sélection de pièces adaptées à ton style.");
  });
});

describe("dureeDecompteSynthese", () => {
  it("vaut le réglage par défaut, ou celui de l'appareil s'il est valable", () => {
    expect(dureeDecompteSynthese(null)).toBe(DECOMPTE_SYNTHESE_S);
    expect(dureeDecompteSynthese("0")).toBe(0);
    expect(dureeDecompteSynthese("12")).toBe(12);
    expect(dureeDecompteSynthese("abc")).toBe(DECOMPTE_SYNTHESE_S);
    expect(dureeDecompteSynthese("-3")).toBe(DECOMPTE_SYNTHESE_S);
  });
  it("accorde « seconde »", () => {
    expect(libelleDecompte(1)).toContain("1 seconde…");
    expect(libelleDecompte(8)).toContain("8 secondes…");
  });
});
