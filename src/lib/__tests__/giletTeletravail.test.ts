import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, ShoeType } from "../types";

// R-B12 étendue et R-S27 (01/11/2026, demandé en capture : « en télétravail propose plutôt un gilet et pas de manteau ni de veste »).
// Mesuré avec et sans le levier `vesteEnTeletravail`, sur le même pool.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Camel", hex: "#B08A5A", season: "Toutes saisons", worn: null, matiere: "Laine", ...over }) as Item;
const ROBE = p(9001, "robe", "Robe longue manches longues");
const TRENCH = p(9002, "manteau", "Trench-coat");
const BLAZER = p(9003, "veste", "Blazer droit");
const GILET = p(9004, "pull", "Cardigan en maille", { subtype: "Cardigan" });
const PULL = p(9005, "pull", "Pull col rond", { subtype: "Pull col rond" });
const CHAUSSONS = p(9006, "chaussures", "Chaussures d'intérieur", { shoeType: "Chaussures d'intérieur" as ShoeType });
const froid = weatherForDay(11, "Ensoleillé", "Automne");
const tirer = (avant = false) =>
  generateOutfitWithFallback([ROBE, TRENCH, BLAZER, GILET, PULL, CHAUSSONS], froid, "travail_formel", "Télétravail", "Verre", [], "femme", null, avant ? { vesteEnTeletravail: true } : undefined);

describe("Télétravail — un gilet, ni veste ni manteau", () => {
  it("jamais de veste ni de manteau ; sans la règle, le manteau du froid revenait", () => {
    for (let i = 0; i < 100; i++) {
      const ids = tirer().ids;
      expect(ids).not.toContain(TRENCH.id);
      expect(ids).not.toContain(BLAZER.id);
    }
    expect(Array.from({ length: 50 }, () => tirer(true).ids).some((ids) => ids.includes(TRENCH.id))).toBe(true);
  });
  it("par 11°, le gilet est posé — une maille ouverte, jamais deux mailles", () => {
    for (let i = 0; i < 100; i++) {
      const ids = tirer().ids;
      if (ids.includes(ROBE.id)) expect(ids).toContain(GILET.id);
      expect(ids.filter((id) => id === GILET.id || id === PULL.id).length).toBeLessThanOrEqual(1);
    }
  });
});
