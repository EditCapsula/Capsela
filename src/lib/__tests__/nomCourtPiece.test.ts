import { describe, expect, it } from "vitest";
import { nomCourtPiece } from "../selectors";

describe("nomCourtPiece — vitrine des pièces fétiches", () => {
  it("garde la première appellation d'un nom double", () => {
    expect(nomCourtPiece("Sandales plates / Tropéziennes")).toBe("Sandales plates");
    expect(nomCourtPiece("Panier / Sac en rafia")).toBe("Panier");
  });

  it("rend un nom simple tel quel", () => {
    expect(nomCourtPiece("Sac en cuir brique")).toBe("Sac en cuir brique");
  });

  it("ne coupe pas une barre sans espaces (ce n'est pas une double appellation)", () => {
    expect(nomCourtPiece("Top 50/50 coton")).toBe("Top 50/50 coton");
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(nomCourtPiece(" / Mocassins")).toBe("/ Mocassins");
  });
});
