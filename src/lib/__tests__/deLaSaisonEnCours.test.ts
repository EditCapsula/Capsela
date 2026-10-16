import { describe, expect, it } from "vitest";
import { deLaSaisonEnCours } from "../selectors";
import type { Item, Season } from "../types";

const t = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const NOW = t(2026, 9, 26);

describe("deLaSaisonEnCours — la règle de la capsule", () => {
  const piece = (season: Season): Item => ({ id: 1, name: "Pièce", cat: "haut", color: "Bleu", hex: "#123", season, worn: null });

  it("fin septembre : automne/hiver et toutes saisons, pas le printemps/été", () => {
    expect(deLaSaisonEnCours(piece("Automne / Hiver"), NOW)).toBe(true);
    expect(deLaSaisonEnCours(piece("Toutes saisons"), NOW)).toBe(true);
    expect(deLaSaisonEnCours(piece("Printemps / Été"), NOW)).toBe(false);
  });

  it("en juillet, l'inverse", () => {
    expect(deLaSaisonEnCours(piece("Printemps / Été"), t(2026, 7, 10))).toBe(true);
    expect(deLaSaisonEnCours(piece("Automne / Hiver"), t(2026, 7, 10))).toBe(false);
  });
});
