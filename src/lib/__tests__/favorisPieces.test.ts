import { afterEach, describe, expect, it, vi } from "vitest";
import { ecrireFavorisPieces, lireFavorisPieces, normaliserFavoris } from "../favorisPieces";

// Les cœurs de l'onglet Explorer (01/11/2026), gardés sur l'appareil.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("favorisPieces", () => {
  it("ne garde que des clés de pièce valides, sans doublon", () => {
    expect(normaliserFavoris(["c12", "d4", "c12", "x1", 5, "c"])).toEqual(["c12", "d4"]);
  });

  it("écrit puis relit, par compte ; un stockage absent ne fait rien échouer", () => {
    const donnees = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => donnees.get(k) ?? null, setItem: (k: string, v: string) => void donnees.set(k, v) } });
    ecrireFavorisPieces("u1", ["c1", "d2"]);
    expect(lireFavorisPieces("u1")).toEqual(["c1", "d2"]);
    expect(lireFavorisPieces("u2")).toEqual([]);
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } } });
    expect(lireFavorisPieces("u1")).toEqual([]);
    expect(() => ecrireFavorisPieces("u1", ["c1"])).not.toThrow();
  });
});
