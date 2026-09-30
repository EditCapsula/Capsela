import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback, SEUIL_SOIREE_FRAICHE, violatesOuterwearRule } from "../logic";
import type { CategoryKey, Item, OccasionKey, Season } from "../types";

// LA VESTE PAR TEMPS FRAIS, DANS LA TENUE — 30/09/2026 (signalé : un top sans
// manches à 18°, la veste n'arrivait qu'en repli dans « Compléter la tenue »).
// Mesuré par scripts/veste-fraiche.audit.ts ; ces tests verrouillent la règle.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons" as Season, worn: null, ...over }) as Item;
const POOL: Item[] = [
  p(1, "haut", "Top drapé col bénitier"),
  p(2, "pantalon", "Pantalon palazzo", { subtype: "Pantalon" }),
  p(3, "chaussures", "Babies", { shoeType: "Ballerines" }),
  p(4, "veste", "Veste courte", { subtype: "Blazer" }),
  p(5, "sac", "Sac", { sacType: "Cabas" }),
];
const tirages = (temp: number, occ: OccasionKey, pool: Item[] = POOL, n = 60, leviers?: Parameters<typeof generateOutfitWithFallback>[8]) => {
  const w = weatherForDay(temp, "Nuageux", "Automne");
  return Array.from({ length: n }, () => generateOutfitWithFallback(pool, w, occ, "Présentiel", "Verre", [], "femme", null, leviers).ids);
};
const avecVeste = (ids: number[]) => ids.includes(4);

describe("veste intégrée par temps frais", () => {
  it("le seuil est celui de la suggestion R-S14 : 21°", () => {
    expect(SEUIL_SOIREE_FRAICHE).toBe(21);
  });

  it("à 18°, chaque tenue d'un haut porte la veste du pool", () => {
    for (const occ of ["quotidien", "travail_formel", "date"] as OccasionKey[]) {
      for (const ids of tirages(18, occ)) {
        expect(ids, occ).toContain(1);
        expect(avecVeste(ids), occ).toBe(true);
      }
    }
  });

  it("jamais de veste sans vêtement de base en dessous (R-B9)", () => {
    for (const ids of tirages(18, "quotidien")) {
      expect(violatesOuterwearRule(ids.map((id) => POOL.find((x) => x.id === id)!))).toBe(false);
    }
  });

  it("au-dessus du seuil, la veste reste un tirage à part", () => {
    const t = tirages(24, "quotidien", POOL, 120).map(avecVeste);
    expect(t).toContain(false);
  });

  it("ni en Sport ni en Cocooning", () => {
    for (const occ of ["cocooning", "sport"] as OccasionKey[]) {
      expect(tirages(18, occ, POOL, 120).map(avecVeste), occ).toContain(false);
    }
  });

  it("sans veste dans le pool, la tenue reste complète (le repli R-S14 prend le relais)", () => {
    const sansVeste = POOL.filter((x) => x.cat !== "veste");
    for (const ids of tirages(18, "quotidien", sansVeste, 20)) expect(ids).toEqual(expect.arrayContaining([1, 2, 3]));
  });

  it("le levier vesteFraicheFacultative rend la règle d'origine", () => {
    expect(tirages(18, "quotidien", POOL, 120, { vesteFraicheFacultative: true }).map(avecVeste)).toContain(false);
  });
});
