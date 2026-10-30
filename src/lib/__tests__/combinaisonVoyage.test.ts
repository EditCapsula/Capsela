import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// R-S21 (30/10/2026, demandé : « pour le voyage on évite de proposer une combinaison car ce n'est pas pratique ») — en Voyage, la pièce
// unique est une robe ; sans robe, haut + bas. Mesuré dans la MÊME exécution, sur le même pool, avec et sans le levier
// `combinaisonEnVoyage`.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, matiere: "Coton", ...over }) as Item;
const COMBINAISON = 2001;
const ROBE = 2002;
const BASE: Item[] = [
  p(2003, "haut", "T-shirt basique"),
  p(2004, "pantalon", "Pantalon jogger"),
  p(2005, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType }),
  p(2006, "sac", "Sac cabas", { sacType: "Cabas" }),
];
const combinaison = p(COMBINAISON, "combinaison", "Combinaison en coton");
const robe = p(ROBE, "robe", "Robe t-shirt");
const automne = weatherForDay(16, "Nuageux", "Automne");
const taux = (pool: Item[], occ: OccasionKey, id: number, combinaisonEnVoyage?: boolean) => {
  let n = 0;
  for (let i = 0; i < 200; i++)
    if (generateOutfitWithFallback(pool, automne, occ, "Présentiel", "Verre", [], "femme", null, combinaisonEnVoyage ? { combinaisonEnVoyage } : undefined).ids.includes(id)) n++;
  return n;
};

describe("R-S21 — pas de combinaison en Voyage", () => {
  it("avec haut + bas possibles, jamais de combinaison ; sans la règle, elle sortait", () => {
    const pool = [...BASE, combinaison];
    expect(taux(pool, "voyage", COMBINAISON)).toBe(0);
    expect(taux(pool, "voyage", COMBINAISON, true)).toBeGreaterThan(0);
  });

  it("une robe et une combinaison : la robe seule, quand la pièce unique est tirée", () => {
    const pool = [...BASE, combinaison, robe];
    expect(taux(pool, "voyage", COMBINAISON)).toBe(0);
    expect(taux(pool, "voyage", ROBE)).toBeGreaterThan(0);
  });

  it("sans haut ni bas, la combinaison reste proposée : toujours une tenue", () => {
    const pool = [combinaison, ...BASE.filter((i) => i.cat !== "haut" && i.cat !== "pantalon")];
    expect(taux(pool, "voyage", COMBINAISON)).toBe(200);
  });

  it("les autres occasions ne changent pas", () => {
    expect(taux([...BASE, combinaison], "quotidien", COMBINAISON)).toBeGreaterThan(0);
  });
});
