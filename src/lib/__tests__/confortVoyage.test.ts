import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// R-S19 (14/10/2026, signalé : des mocassins « pas confortables » poussés pour un trajet) — en Voyage, les baskets d'abord et les pièces
// les plus décontractées (formalité ≤ 1) d'abord. Mesuré dans la MÊME exécution, sur le même pool, avec et sans le levier.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
const BASKETS = 1003;
const POOL: Item[] = [
  p(1001, "haut", "T-shirt basique"),
  p(1002, "pantalon", "Pantalon tailleur"),
  p(1006, "jean", "Jean droit"),
  p(BASKETS, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType }),
  p(1004, "chaussures", "Mocassins", { shoeType: "Mocassins" as ShoeType }),
  p(1005, "chaussures", "Ballerines", { shoeType: "Ballerines" as ShoeType }),
  p(1007, "sac", "Sac cabas", { sacType: "Cabas" }),
];
const meteo = weatherForDay(18, "Nuageux", "Automne");
const taux = (occ: OccasionKey, id: number, sansConfortVoyage?: boolean) => {
  let n = 0;
  for (let i = 0; i < 120; i++)
    if (generateOutfitWithFallback(POOL, meteo, occ, "Présentiel", "Verre", [], "femme", null, sansConfortVoyage ? { sansConfortVoyage } : undefined).ids.includes(id)) n++;
  return n;
};

describe("R-S19 — confort en Voyage", () => {
  it("les baskets à chaque trajet ; sans la règle, une fois sur trois environ", () => {
    expect(taux("voyage", BASKETS)).toBe(120);
    expect(taux("voyage", BASKETS, true)).toBeLessThan(100);
  });

  it("le bas le plus décontracté d'abord (jean plutôt que pantalon tailleur)", () => {
    expect(taux("voyage", 1002)).toBe(0);
    expect(taux("voyage", 1002, true)).toBeGreaterThan(0);
  });

  it("les autres occasions ne changent pas", () => {
    expect(taux("quotidien", BASKETS)).toBeLessThan(120);
  });
});
