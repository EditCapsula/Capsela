import { describe, expect, it } from "vitest";
import { trierPiecesDeTenue } from "../ordrePieces";
import type { CategoryKey } from "../types";

const p = (id: number, cat: CategoryKey) => ({ id, cat });

describe("l'ordre des pièces d'une tenue (17/11/2026)", () => {
  it("pièces principales d'abord, accessoires en dernier", () => {
    const tenue = [p(1, "manteau"), p(2, "sac"), p(3, "bijou"), p(4, "chaussures"), p(5, "pantalon"), p(6, "haut"), p(7, "pull"), p(8, "accessoire")];
    expect(trierPiecesDeTenue(tenue).map((x) => x.cat)).toEqual(["haut", "pull", "pantalon", "manteau", "chaussures", "sac", "bijou", "accessoire"]);
  });
  it("la robe passe devant tout ; à rang égal, l'ordre reçu ; le tableau reçu ne change pas", () => {
    const tenue = [p(1, "bijou"), p(2, "robe"), p(3, "bijou")];
    expect(trierPiecesDeTenue(tenue).map((x) => x.id)).toEqual([2, 1, 3]);
    expect(tenue.map((x) => x.id)).toEqual([1, 2, 3]);
  });
});
