import { describe, expect, it } from "vitest";
import { bonusCoupesPreferees } from "../coupesPieces";
import { computeLookScore } from "../logic";
import { meilleurTirageMorphologique } from "../silhouetteRonde";
import type { Weather } from "../data";
import type { Item } from "../types";

// R-S31, les coupes préférées dans les tenues (16/11/2026) : un bonus sans malus, hors production tant que la mesure n'est pas validée.

const p = (id: number, cat: Item["cat"], name: string): Item => ({ id, name, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 1 }) as Item;
const MILD: Weather = { season: "Printemps / Été", temp: 18, label: "Ensoleillé" } as Weather;
const fluide = p(1, "haut", "Blouse fluide");
const structure = p(2, "veste", "Blazer structuré");
const pantalon = p(3, "pantalon", "Pantalon");
const chaussures = p(4, "chaussures", "Mocassins");

describe("bonusCoupesPreferees", () => {
  it("+3 pour un vêtement d'une coupe préférée, +6 pour deux ; rien sans préférence", () => {
    expect(bonusCoupesPreferees([fluide, pantalon], ["fluides"])).toBe(3);
    expect(bonusCoupesPreferees([fluide, structure], ["fluides", "structurees"])).toBe(6);
    expect(bonusCoupesPreferees([fluide, structure], null)).toBe(0);
    expect(bonusCoupesPreferees([pantalon], ["amples"])).toBe(0);
  });
});

describe("computeLookScore — R-S31", () => {
  const look = [fluide, pantalon, chaussures];
  it("éteinte (production d'aujourd'hui) : le score ne change pas", () => {
    const sans = computeLookScore(look, "quotidien", [], null, new Set(), MILD).score;
    expect(computeLookScore(look, "quotidien", [], null, new Set(), MILD, "Présentiel", "Verre", [], null, undefined, null, ["fluides"]).score).toBe(sans);
  });
  it("allumée : un bonus, jamais un malus", () => {
    const off = computeLookScore(look, "quotidien", [], null, new Set(), MILD, "Présentiel", "Verre", [], null, { coupesPreferees: false }, null, ["fluides"]).score;
    const on = computeLookScore(look, "quotidien", [], null, new Set(), MILD, "Présentiel", "Verre", [], null, { coupesPreferees: true }, null, ["fluides"]).score;
    const autre = computeLookScore(look, "quotidien", [], null, new Set(), MILD, "Présentiel", "Verre", [], null, { coupesPreferees: true }, null, ["amples"]).score;
    expect(on).toBeGreaterThanOrEqual(off);
    expect(autre).toBe(off);
  });
});

describe("meilleurTirageMorphologique — avec les coupes préférées", () => {
  const pool = [fluide, structure, pantalon, chaussures];
  const suite = (...t: number[][]) => {
    let i = 0;
    return () => ({ ids: t[Math.min(i++, t.length - 1)] });
  };
  it("éteinte : le premier tirage, comme avant", () => {
    expect(meilleurTirageMorphologique(suite([3, 4], [1, 3, 4]), pool, null, null, false, ["fluides"], false).ids).toEqual([3, 4]);
  });
  it("allumée : la tenue qui sert le mieux les coupes préférées", () => {
    expect(meilleurTirageMorphologique(suite([3, 4], [1, 3, 4]), pool, null, null, false, ["fluides"], true).ids).toEqual([1, 3, 4]);
  });
  it("sans préférence : un seul tirage", () => {
    expect(meilleurTirageMorphologique(suite([3, 4], [1, 3, 4]), pool, null, null, false, null, true).ids).toEqual([3, 4]);
  });
});
