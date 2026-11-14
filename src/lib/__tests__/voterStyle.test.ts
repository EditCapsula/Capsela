import { describe, expect, it } from "vitest";
import { MAX_STYLES, voterStyle } from "../profile";

// 14/11/2026 : la découverte des styles de l'onboarding (J'aime / Pas pour moi, trois styles au plus).
describe("voterStyle", () => {
  it("J'aime ajoute un style, à la suite des autres", () => {
    expect(voterStyle(["boheme"], "preppy", "aime")).toEqual({ styles: ["boheme", "preppy"], bloque: false });
  });
  it("J'aime sur un style déjà choisi le retire", () => {
    expect(voterStyle(["boheme", "preppy"], "boheme", "aime")).toEqual({ styles: ["preppy"], bloque: false });
  });
  it("Pas pour moi retire un style choisi, et ne change rien sinon", () => {
    expect(voterStyle(["boheme", "preppy"], "preppy", "pasPourMoi")).toEqual({ styles: ["boheme"], bloque: false });
    expect(voterStyle(["boheme"], "preppy", "pasPourMoi")).toEqual({ styles: ["boheme"], bloque: false });
  });
  it("au plafond, un nouveau J'aime est bloqué, jamais substitué", () => {
    const trois = ["boheme", "preppy", "minimaliste"];
    expect(trois).toHaveLength(MAX_STYLES);
    expect(voterStyle(trois, "streetwear", "aime")).toEqual({ styles: trois, bloque: true });
  });
});
