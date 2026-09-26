import { describe, expect, it } from "vitest";
import { participePorte, participePorteMaj } from "../logic";
import type { CategoryKey, Item } from "../types";

const piece = (cat: CategoryKey, extra: Partial<Item> = {}): Item => ({ id: 1, name: "Pièce", cat, color: "Noir", hex: "#111", season: "Toutes saisons", worn: null, ...extra });

describe("participePorte — genre et nombre de la pièce", () => {
  it("masculin, féminin", () => {
    expect(participePorte(piece("manteau"))).toBe("porté");
    expect(participePorte(piece("robe"))).toBe("portée");
  });

  it("des bottines : féminin pluriel, lu dans shoeType", () => {
    expect(participePorte(piece("chaussures", { shoeType: "Bottines" }))).toBe("portées");
  });

  it("des mocassins : masculin pluriel, pas le féminin de « chaussures »", () => {
    expect(participePorte(piece("chaussures", { shoeType: "Mocassins" }))).toBe("portés");
  });

  it("des chaussures sans type : le féminin pluriel de la catégorie", () => {
    expect(participePorte(piece("chaussures"))).toBe("portées");
  });

  it("des boucles d'oreilles (sous-type) : féminin pluriel ; majuscule en début de libellé", () => {
    expect(participePorteMaj(piece("bijou", { subtype: "Boucles d'oreilles" }))).toBe("Portées");
  });
});
