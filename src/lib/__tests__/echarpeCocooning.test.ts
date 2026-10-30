import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { candidatsDeRemplacement, generateOutfitWithFallback } from "../logic";
import type { AccessoireType, CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// R-S22 (30/10/2026, demandé : « pour les tenues cocooning pas besoin de pousser une écharpe en accessoire »). Mesuré dans la MÊME
// exécution, sur le même pool, avec et sans le levier `echarpeEnCocooning`.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Gris", hex: "#9B968F", season: "Toutes saisons", worn: null, matiere: "Coton", ...over }) as Item;
const ECHARPE = 3005;
const POOL: Item[] = [
  p(3001, "haut", "T-shirt basique"),
  p(3002, "pantalon", "Pantalon jogger"),
  p(3003, "chaussures", "Chaussons", { shoeType: "Chaussures d'intérieur" as ShoeType }),
  p(ECHARPE, "accessoire", "Écharpe en laine", { accessoireType: "Écharpe" as AccessoireType }),
  p(3006, "accessoire", "Ceinture tressée", { accessoireType: "Ceinture" as AccessoireType }),
  p(3007, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType }),
];
const automne = weatherForDay(16, "Nuageux", "Automne");
const taux = (occ: OccasionKey, echarpeEnCocooning?: boolean) => {
  let n = 0;
  for (let i = 0; i < 200; i++)
    if (generateOutfitWithFallback(POOL, automne, occ, "Présentiel", "Verre", [], "femme", null, echarpeEnCocooning ? { echarpeEnCocooning } : undefined).ids.includes(ECHARPE)) n++;
  return n;
};

describe("R-S22 — pas d'écharpe en Cocooning", () => {
  it("jamais tirée en Cocooning ; sans la règle, elle sortait", () => {
    expect(taux("cocooning")).toBe(0);
    expect(taux("cocooning", true)).toBeGreaterThan(0);
  });
  it("jamais proposée en remplacement d'un accessoire en Cocooning", () => {
    const tenue = POOL.filter((i) => i.id !== ECHARPE);
    expect(candidatsDeRemplacement(tenue, POOL, 3006, "accessoire", "cocooning", "Présentiel", "Verre", automne).map((i) => i.id)).not.toContain(ECHARPE);
  });
  it("les autres occasions ne changent pas", () => {
    expect(taux("quotidien")).toBeGreaterThan(0);
  });
});
