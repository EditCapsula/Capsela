import { describe, expect, it } from "vitest";
import { premiereAppellation, sansBarre } from "../barre";

// LE « / » NE S'AFFICHE PAS (18/10/2026) : un point médian entre deux appellations, jamais dans « 50/50 ».
describe("sansBarre", () => {
  it("entre deux appellations, un point médian", () => {
    expect(sansBarre("Restaurant / date romantique")).toBe("Restaurant · date romantique");
    expect(sansBarre("Cinéma / balade")).toBe("Cinéma · balade");
    expect(sansBarre("Babies / Mary Jane")).toBe("Babies · Mary Jane");
    expect(sansBarre("Panier/Sac en rafia")).toBe("Panier · Sac en rafia");
  });
  it("jamais entre deux chiffres, et rien à changer sans barre", () => {
    expect(sansBarre("Top 50/50 coton")).toBe("Top 50/50 coton");
    expect(sansBarre("Verre")).toBe("Verre");
  });
});

describe("premiereAppellation", () => {
  it("garde le premier nom, avec « / » comme avec « · »", () => {
    expect(premiereAppellation("Babies / Mary Jane")).toBe("Babies");
    expect(premiereAppellation("Babies · Mary Jane")).toBe("Babies");
    expect(premiereAppellation("Top 50/50 coton")).toBe("Top 50/50 coton");
  });
});
