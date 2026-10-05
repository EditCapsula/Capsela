import { describe, expect, it } from "vitest";
import { ONBOARDING_SLIDES } from "../data";

describe("onboarding — cinq écrans, une histoire", () => {
  it("style, dressing, tenues, valises, puis le compte", () => {
    expect(ONBOARDING_SLIDES.map((s) => s.kicker)).toEqual(["Ton style", "Ton dressing", "Tes tenues", "Tes valises", "L’édit Capsela"]);
  });
  it("chaque écran a un titre en lignes, et une phrase", () => {
    for (const s of ONBOARDING_SLIDES) {
      expect(s.title.length).toBeGreaterThanOrEqual(2);
      expect(s.body.length).toBeGreaterThan(40);
    }
    expect(ONBOARDING_SLIDES[2].title.join(" ")).toBe("Chaque matin, tu sais quoi porter.");
    expect(ONBOARDING_SLIDES[4].title).toEqual(["Ton dressing.", "Ton style.", "Ton quotidien."]);
  });
  it("aucune formule marketing proscrite, ni « 30 à 40 pièces » présenté comme une règle", () => {
    const texte = JSON.stringify(ONBOARDING_SLIDES).toLowerCase();
    for (const mot of ["révolutionne", "libère", "l'ia qui", "expérience unique", "futur de la mode", "assistant mode", "30 à 40"]) expect(texte).not.toContain(mot);
  });
});
