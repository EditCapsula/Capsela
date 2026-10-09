import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { piecesCles } from "../capsuleEcran";
import { generateOutfitWithFallback } from "../logic";
import { aDesManches, brasNus, libelleManches, manchesDepuis } from "../manches";
import type { CategoryKey, Item, Manches, OccasionKey, Season } from "../types";

// LA LONGUEUR DES MANCHES — 01/10/2026 (« Il faudrait ajouter la notion de
// manches longues »). Colonne `manches`, migration 0042.

describe("manches — lecture et libellés", () => {
  it("seules les trois valeurs sont lues, le reste est inconnu", () => {
    expect(manchesDepuis("longues")).toBe("longues");
    expect(manchesDepuis("courtes")).toBe("courtes");
    expect(manchesDepuis("sans")).toBe("sans");
    for (const v of ["", "long", "Longues", null, undefined]) expect(manchesDepuis(v)).toBeUndefined();
  });
  it("les catégories qui ont des manches", () => {
    for (const c of ["haut", "pull", "robe", "combinaison", "veste", "manteau"] as CategoryKey[]) expect(aDesManches(c), c).toBe(true);
    for (const c of ["pantalon", "jupe", "chaussures", "sac"] as CategoryKey[]) expect(aDesManches(c), c).toBe(false);
  });
  it("libellés et bras nus", () => {
    expect(libelleManches("sans")).toBe("Sans manches");
    expect(libelleManches("longues")).toBe("Manches longues");
    expect(brasNus({ manches: "sans" })).toBe(true);
    expect(brasNus({ manches: "courtes" })).toBe(true);
    expect(brasNus({ manches: "longues" })).toBe(false);
    expect(brasNus({})).toBe(false);
  });
});

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons" as Season, worn: null, ...over }) as Item;
const base = (hauts: Item[]): Item[] => [
  ...hauts,
  p(10, "pantalon", "Pantalon", { subtype: "Pantalon" }),
  p(11, "chaussures", "Mocassins", { shoeType: "Mocassins" }),
  p(12, "veste", "Veste", { subtype: "Blazer" }),
  p(13, "sac", "Sac", { sacType: "Cabas" }),
];
const tirer = (pool: Item[], temp: number, occ: OccasionKey = "quotidien", n = 120, leviers?: Parameters<typeof generateOutfitWithFallback>[8]) => {
  const w = weatherForDay(temp, "Nuageux", "Automne");
  return Array.from({ length: n }, () => generateOutfitWithFallback(pool, w, occ, "Présentiel", "Verre", [], "femme", null, leviers).ids);
};
const unSeul = (m?: Manches) => base([p(1, "haut", "Haut", m ? { manches: m } : {})]);

describe("veste intégrée par temps frais — selon les manches", () => {
  it("bras nus (sans, courtes) : la veste accompagne chaque tenue", () => {
    for (const m of ["sans", "courtes"] as Manches[]) for (const ids of tirer(unSeul(m), 18, "quotidien", 40)) expect(ids, m).toContain(12);
  });
  it("manches inconnues : comme avant, la veste est forcée", () => {
    for (const ids of tirer(unSeul(), 18, "quotidien", 40)) expect(ids).toContain(12);
  });
  it("manches longues : la veste redevient un tirage à part", () => {
    expect(tirer(unSeul("longues"), 18).map((ids) => ids.includes(12))).toContain(false);
  });
  it("le levier manchesIgnorees rend la règle d'origine", () => {
    for (const ids of tirer(unSeul("longues"), 18, "quotidien", 40, { manchesIgnorees: true })) expect(ids).toContain(12);
  });
});

describe("haut à manches longues préféré par temps frais", () => {
  const pool = base([p(1, "haut", "Débardeur", { manches: "sans" }), p(2, "haut", "T-shirt", { manches: "courtes" }), p(3, "haut", "Chemise", { manches: "longues" })]);
  const haut = (ids: number[]) => ids.find((id) => id <= 3);
  it("à 18°, toujours le haut à manches longues", () => {
    for (const ids of tirer(pool, 18, "quotidien", 60)) expect(haut(ids)).toBe(3);
  });
  it("à 25°, les trois restent tirables", () => {
    expect(new Set(tirer(pool, 25, "quotidien", 200).map(haut)).size).toBe(3);
  });
  it("jamais en Cocooning", () => {
    expect(new Set(tirer(pool, 18, "cocooning", 200).map(haut)).size).toBeGreaterThan(1);
  });
  it("sans aucune donnée de manches, rien ne change", () => {
    const sansDonnee = base([p(1, "haut", "A"), p(2, "haut", "B"), p(3, "haut", "C")]);
    expect(new Set(tirer(sansDonnee, 18, "quotidien", 200).map(haut)).size).toBe(3);
  });
  it("le levier manchesIgnorees rend la règle d'origine", () => {
    expect(new Set(tirer(pool, 18, "quotidien", 200, { manchesIgnorees: true }).map(haut)).size).toBe(3);
  });
});

describe("pièces clés — un haut à manches longues compte en automne-hiver", () => {
  const piece = (id: number, over: Partial<Item>): Item => p(id, "haut", "Pièce " + id, over);
  it("retenu parmi les pièces clés d'une capsule d'hiver, pas un haut sans manches", () => {
    const capsule = [piece(1, { manches: "sans", estBasiqueCapsule: true }), piece(2, { manches: "longues" })];
    expect(piecesCles(capsule, 3, "Hiver").map((i) => i.id)).toEqual([2]);
  });
  it("sans manches renseignées : toujours exclu, comme avant", () => {
    expect(piecesCles([piece(1, {})], 3, "Hiver")).toEqual([]);
  });
  it("en été, les manches ne comptent pas", () => {
    expect(piecesCles([piece(1, { manches: "sans" })], 3, "Été").map((i) => i.id)).toEqual([1]);
  });
});
