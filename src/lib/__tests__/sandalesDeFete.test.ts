import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// SANDALES À TALONS DE FÊTE EN AUTOMNE — demandé le 01/10/2026 (« pour une
// cérémonie ou une soirée festive tu peux proposer des sandales à talons même
// en automne »). Mesuré par scripts/sandales-fete.audit.ts.

const AUT = { season: "Automne / Hiver", saisons: ["Automne", "Hiver"] } as Partial<Item>;
const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
const SANDALES = 99;
const POOL: Item[] = [
  p(1, "robe", "Robe de soirée", { ...AUT, subtype: "Robe" }),
  p(2, "robe", "Robe de cérémonie", { ...AUT, subtype: "Robe" }),
  p(3, "chaussures", "Bottines", { ...AUT, shoeType: "Bottines" as ShoeType }),
  p(4, "chaussures", "Escarpins", { ...AUT, shoeType: "Escarpins" as ShoeType }),
  p(5, "sac", "Pochette", { ...AUT, sacType: "Pochette" }),
  p(6, "haut", "Top", AUT), p(7, "jupe", "Jupe", AUT),
  p(SANDALES, "chaussures", "Sandales à talons", { season: "Printemps / Été", saisons: ["Été"], shoeType: "Sandales à talons" as ShoeType }),
];
const taux = (occ: OccasionKey, label = "Nuageux", calendaire: "Automne" | "Hiver" = "Automne", leviers?: Parameters<typeof generateOutfitWithFallback>[8], temp = 15) => {
  const w = weatherForDay(temp, label, calendaire);
  let n = 0;
  for (let i = 0; i < 150; i++) if (generateOutfitWithFallback(POOL, w, occ, "Présentiel", "Verre", [], "femme", null, leviers).ids.includes(SANDALES)) n++;
  return n;
};

describe("sandales à talons de fête en automne", () => {
  it("proposées pour une sortie festive et une cérémonie", () => {
    expect(taux("festive")).toBeGreaterThan(0);
    expect(taux("evenement_perso")).toBeGreaterThan(0);
  });

  it("jamais pour les autres occasions", () => {
    for (const occ of ["quotidien", "travail_formel", "entretien", "date", "soiree", "voyage"] as OccasionKey[]) {
      expect(taux(occ), occ).toBe(0);
    }
  });

  it("jamais sous la pluie (R-B21)", () => {
    expect(taux("festive", "Pluvieux")).toBe(0);
    expect(taux("evenement_perso", "Pluvieux")).toBe(0);
  });

  it("jamais par temps d'hiver (5°) — la saison du jour doit comprendre l'automne", () => {
    expect(taux("festive", "Nuageux", "Hiver", undefined, 5)).toBe(0);
  });

  it("le levier sansSandalesDeFeteEnAutomne rend la règle d'origine", () => {
    expect(taux("festive", "Nuageux", "Automne", { sansSandalesDeFeteEnAutomne: true })).toBe(0);
  });
});
