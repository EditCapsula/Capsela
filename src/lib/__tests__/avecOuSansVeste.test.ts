import { describe, expect, it } from "vitest";
import { cleLook, fusionnerAvecOuSansVeste } from "../ideesLooks";
import type { ItemOutfitVariation } from "../logic";

// AVEC OU SANS VESTE (06/11/2026) : deux idées qui ne diffèrent que par une veste ne font qu'un look.
const pool = [
  { id: 1, cat: "robe" as const },
  { id: 2, cat: "chaussures" as const },
  { id: 3, cat: "sac" as const },
  { id: 4, cat: "veste" as const },
  { id: 5, cat: "veste" as const },
  { id: 6, cat: "accessoire" as const },
];
const v = (ids: number[], occasion: ItemOutfitVariation["occasion"] = "date"): ItemOutfitVariation => ({ ids, occasion, score: 1 });

describe("fusionnerAvecOuSansVeste", () => {
  it("le look sans veste disparaît, celui avec est marqué « Avec ou sans veste »", () => {
    const r = fusionnerAvecOuSansVeste([v([1, 2, 3, 6]), v([1, 4, 2, 3, 6])], pool, 1);
    expect(r.variations.map((x) => x.ids)).toEqual([[1, 4, 2, 3, 6]]);
    expect(r.vesteFacultative.has(cleLook([1, 4, 2, 3, 6]))).toBe(true);
  });
  it("deux vestes différentes sur la même base : deux looks, tous deux « avec ou sans veste »", () => {
    const r = fusionnerAvecOuSansVeste([v([1, 2, 3]), v([1, 4, 2, 3]), v([1, 5, 2, 3])], pool, 1);
    expect(r.variations).toHaveLength(2);
    expect(r.vesteFacultative.size).toBe(2);
  });
  it("des looks qui diffèrent par autre chose qu'une veste restent distincts, sans mention", () => {
    const r = fusionnerAvecOuSansVeste([v([1, 2, 3]), v([1, 2, 6])], pool, 1);
    expect(r.variations).toHaveLength(2);
    expect(r.vesteFacultative.size).toBe(0);
  });
  it("la pièce choisie n'est jamais une veste facultative", () => {
    const r = fusionnerAvecOuSansVeste([v([4, 1, 2]), v([4, 1, 2, 3])], pool, 4);
    expect(r.variations).toHaveLength(2);
    expect(r.vesteFacultative.size).toBe(0);
  });
});
