import { describe, expect, it } from "vitest";
import { choisirVariation, clePrincipale, ecartPrincipal, piecesPrincipales, tenueAUnSocle, varieSubstantiellement } from "../logic";
import type { CategoryKey, Item } from "../types";

const piece = (id: number, cat: CategoryKey): Item => ({ id, name: `${cat} ${id}`, cat, color: "Noir", hex: "#000", season: "Toutes saisons", worn: null });
const POOL: Item[] = [
  piece(1, "robe"),
  piece(2, "robe"),
  piece(10, "haut"),
  piece(11, "haut"),
  piece(20, "pantalon"),
  piece(30, "chaussures"),
  piece(31, "chaussures"),
  piece(40, "veste"),
  piece(50, "sac"),
  piece(60, "bijou"),
  piece(61, "bijou"),
  piece(70, "accessoire"),
];

describe("pièces principales — vêtements et chaussures, jamais sac, bijou, accessoire", () => {
  it("écarte sac, bijou et accessoire, trie et dédoublonne", () => {
    expect(piecesPrincipales([60, 30, 1, 50, 70, 1], POOL)).toEqual([1, 30]);
  });
  it("deux tenues qui ne diffèrent que par un bijou ont la même clé", () => {
    expect(clePrincipale([1, 30, 50, 60], POOL)).toBe(clePrincipale([1, 30, 50, 61], POOL));
  });
});

describe("varieSubstantiellement — variation réelle, pas cosmétique", () => {
  it("même robe, mêmes chaussures, même sac, autre bijou : pas une nouvelle tenue", () => {
    expect(varieSubstantiellement([1, 30, 50, 60], [1, 30, 50, 61], POOL)).toBe(false);
  });
  it("même robe, seules les chaussures changent : pas une nouvelle tenue", () => {
    expect(varieSubstantiellement([1, 30], [1, 31], POOL)).toBe(false);
  });
  it("le socle change (autre robe) : nouvelle tenue", () => {
    expect(varieSubstantiellement([1, 30], [2, 30], POOL)).toBe(true);
  });
  it("de la robe à haut + pantalon : nouvelle silhouette", () => {
    expect(varieSubstantiellement([1, 30], [10, 20, 30], POOL)).toBe(true);
  });
  it("même socle, mais chaussures ET veste changent : nouvelle tenue", () => {
    expect(varieSubstantiellement([1, 30], [1, 31, 40], POOL)).toBe(true);
  });
  it("une tenue vide n'est jamais une variation", () => {
    expect(varieSubstantiellement([1, 30], [], POOL)).toBe(false);
  });
  it("écart compté sur les seules pièces principales, un remplacement = un changement", () => {
    expect(ecartPrincipal([1, 30, 60], [2, 30, 61], POOL)).toBe(1);
    expect(ecartPrincipal([1, 30], [1, 31, 40], POOL)).toBe(2);
  });
});

describe("choisirVariation — le premier tirage vraiment nouveau, sinon le plus éloigné", () => {
  const suite = (tirages: number[][]) => {
    let i = 0;
    return () => tirages[Math.min(i++, tirages.length - 1)];
  };
  it("saute les variations cosmétiques et garde la première vraie", () => {
    const r = choisirVariation(suite([[1, 30, 61], [1, 31], [2, 30]]), (t) => t, [1, 30, 60], new Set(), POOL);
    expect(r).toEqual({ choix: [2, 30], substantielle: true });
  });
  it("écarte une tenue déjà vue ou refusée (clé principale)", () => {
    const evitees = new Set([clePrincipale([2, 30], POOL)]);
    const r = choisirVariation(suite([[2, 30, 60], [10, 20, 31]]), (t) => t, [1, 30], evitees, POOL);
    expect(r.choix).toEqual([10, 20, 31]);
  });
  it("aucune vraie variation possible : rend la plus éloignée et le dit", () => {
    const r = choisirVariation(suite([[1, 30, 61], [1, 31]]), (t) => t, [1, 30, 60], new Set(), POOL, 2);
    expect(r).toEqual({ choix: [1, 31], substantielle: false });
  });
});

describe("tenueAUnSocle — jamais « prête » avec un sac seul", () => {
  const p = (id: number) => POOL.find((i) => i.id === id)!;
  it("un sac seul n'est pas une tenue", () => {
    expect(tenueAUnSocle([p(50)])).toBe(false);
  });
  it("sac + chaussures non plus", () => {
    expect(tenueAUnSocle([p(50), p(30)])).toBe(false);
  });
  it("une robe suffit à faire un socle", () => {
    expect(tenueAUnSocle([p(1), p(50)])).toBe(true);
  });
  it("haut + bas font un socle", () => {
    expect(tenueAUnSocle([p(10), p(20)])).toBe(true);
  });
});
