import { describe, expect, it } from "vitest";
import { INTENSITE_OPTIONS, INTENSITE_VISUELS, PAL_COULEURS } from "../profile";

// L'étape « Intensité de couleurs » de l'onboarding (30/09/2026) : chaque
// option garde son libellé enregistré et reçoit une illustration.

describe("INTENSITE_VISUELS — une illustration par option, sans seconde liste d'options", () => {
  it("couvre exactement les options enregistrables, dans le même ordre", () => {
    expect(Object.keys(INTENSITE_VISUELS)).toEqual(INTENSITE_OPTIONS);
  });

  it("cinq pastilles hex et une phrase courte par option", () => {
    for (const o of INTENSITE_OPTIONS) {
      const v = INTENSITE_VISUELS[o];
      expect(v.pastilles).toHaveLength(5);
      for (const hex of v.pastilles) expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(v.description.length).toBeGreaterThan(10);
      expect(v.description.length).toBeLessThanOrEqual(70);
    }
  });

  it("les familles se distinguent : aucune palette identique à une autre", () => {
    const cles = INTENSITE_OPTIONS.map((o) => INTENSITE_VISUELS[o].pastilles.join(","));
    expect(new Set(cles).size).toBe(INTENSITE_OPTIONS.length);
  });

  it("les teintes profondes sont celles de la palette personnelle, pas des copies", () => {
    const hexPal = new Set(PAL_COULEURS.map(([, h]) => h));
    for (const hex of INTENSITE_VISUELS["Profondes et intenses"].pastilles) expect(hexPal.has(hex)).toBe(true);
  });
});
