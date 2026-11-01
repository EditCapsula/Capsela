import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, ShoeType } from "../types";

// R-S26 (01/11/2026, arbitré : option A) — en Voyage, haut + bas confortables d'abord ; sans haut ni bas de voyage, une tenue de
// sport ; la robe ou la combinaison en dernier. Et la pièce unique tentée à chaque essai quand le pool n'a ni haut ni bas.
// Mesuré avec et sans le levier `sansSportEnVoyage`, sur le même pool.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, matiere: "Coton", ...over }) as Item;
const sportSeul = ["sport"] as Item["occasion"];
const COMBI = p(8001, "combinaison", "Combinaison en coton");
const HAUT_SPORT = p(8002, "haut", "Haut technique manches longues", { occasion: sportSeul, niveauFormalite: 0 });
const LEGGING = p(8003, "pantalon", "Legging de sport", { occasion: sportSeul, niveauFormalite: 0 });
const T_SHIRT = p(8004, "haut", "T-shirt basique");
const JOGGER = p(8005, "pantalon", "Pantalon jogger souple");
const BASKETS = p(8006, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType });
const automne = weatherForDay(16, "Nuageux", "Automne");
const tirer = (pool: Item[], sansRegle = false) =>
  generateOutfitWithFallback(pool, automne, "voyage", "Présentiel", "Verre", [], "femme", null, sansRegle ? { sansSportEnVoyage: true } : undefined);

describe("R-S26 — en Voyage, une tenue de sport avant la combinaison", () => {
  it("sans haut ni bas de voyage : la tenue de sport, jamais la combinaison ; sans la règle, la combinaison", () => {
    const pool = [COMBI, HAUT_SPORT, LEGGING, BASKETS];
    for (let i = 0; i < 100; i++) {
      const ids = tirer(pool).ids;
      expect(ids).toContain(HAUT_SPORT.id);
      expect(ids).toContain(LEGGING.id);
      expect(ids).not.toContain(COMBI.id);
    }
    expect(tirer(pool, true).ids).not.toContain(LEGGING.id);
  });
  it("un haut et un bas de voyage existent : ils passent, le sport n'est pas tiré", () => {
    const pool = [COMBI, HAUT_SPORT, LEGGING, T_SHIRT, JOGGER, BASKETS];
    for (let i = 0; i < 100; i++) {
      const ids = tirer(pool).ids;
      expect(ids).not.toContain(HAUT_SPORT.id);
      expect(ids).not.toContain(LEGGING.id);
    }
  });
  it("ni haut ni bas du tout : la combinaison à chaque fois (plus de tenue vide, 1 sur ~20 000 avant)", () => {
    const pool = [COMBI, BASKETS];
    for (let i = 0; i < 20000; i++) expect(tirer(pool).ids).toContain(COMBI.id);
  });
});
