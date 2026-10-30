import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { candidatsDeRemplacement, generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, ShoeType } from "../types";

// R-S23 (30/10/2026, demandé : « on ne met pas ensemble deux pièces sans manches, surtout en automne ou hiver »). Mesuré dans la MÊME
// exécution, sur le même pool, avec et sans le levier `deuxSansManches`.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Beige", hex: "#D8C8B0", season: "Toutes saisons", worn: null, matiere: "Coton", ...over }) as Item;
const DEBARDEUR = 4001;
const GILET = 4004;
const BLAZER = 4005;
const POOL: Item[] = [
  p(DEBARDEUR, "haut", "Débardeur côtelé", { manches: "sans" }),
  p(4002, "pantalon", "Pantalon large"),
  p(4003, "chaussures", "Mocassins", { shoeType: "Mocassins" as ShoeType }),
  p(GILET, "veste", "Gilet de tailleur sans manches", { manches: "sans" }),
  p(BLAZER, "veste", "Blazer", { manches: "longues" }),
];
const automne = weatherForDay(15, "Nuageux", "Automne");
const ete = weatherForDay(24, "Ensoleillé", "Été");
const ensemble = (meteo: ReturnType<typeof weatherForDay>, deuxSansManches?: boolean) => {
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const ids = generateOutfitWithFallback(POOL, meteo, "quotidien", "Présentiel", "Verre", [], "femme", null, deuxSansManches ? { deuxSansManches } : undefined).ids;
    if (ids.includes(DEBARDEUR) && ids.includes(GILET)) n++;
  }
  return n;
};

describe("R-S23 — jamais deux pièces sans manches ensemble", () => {
  it("automne : le débardeur et le gilet sans manches ne sortent jamais ensemble ; sans la règle, si", () => {
    expect(ensemble(automne)).toBe(0);
    expect(ensemble(automne, true)).toBeGreaterThan(0);
  });
  it("été : préférence, le blazer à manches passe avant le gilet sans manches", () => {
    expect(ensemble(ete)).toBe(0);
  });
  it("remplacer la veste d'une tenue au débardeur : jamais le gilet sans manches en automne", () => {
    const tenue = POOL.filter((i) => [DEBARDEUR, 4002, 4003, BLAZER].includes(i.id));
    expect(candidatsDeRemplacement(tenue, POOL, BLAZER, "veste", "quotidien", "Présentiel", "Verre", automne).map((i) => i.id)).not.toContain(GILET);
  });
});
