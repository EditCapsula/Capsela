import { describe, expect, it } from "vitest";
import { demanderChoixChaussures, lireChoixChaussures, oublierChoixChaussures } from "../intentionTenue";

// L'intention « choisir des chaussures » (13/11/2026) : elle ne sert qu'une fois.
describe("intentionTenue", () => {
  it("lue autant de fois qu'il faut, jusqu'à ce qu'on l'oublie", () => {
    expect(lireChoixChaussures()).toBe(false);
    demanderChoixChaussures();
    expect(lireChoixChaussures()).toBe(true);
    expect(lireChoixChaussures()).toBe(true);
    oublierChoixChaussures();
    expect(lireChoixChaussures()).toBe(false);
  });
});
