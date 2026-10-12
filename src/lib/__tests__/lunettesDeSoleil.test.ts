import { describe, expect, it } from "vitest";
import { isSunny, necessiteLeSoleil, type Weather } from "../data";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item } from "../types";

// LUNETTES DE SOLEIL (12/10/2026) : jamais dans une tenue proposée sans soleil, même pour une paire du dressing réel qui n'a pas le drapeau.

const piece = (id: number, cat: CategoryKey, name: string, extra: Partial<Item> = {}): Item => ({ id, name, cat, color: "Noir", hex: "#1D1A16", season: "Toutes saisons", worn: null, ...extra });
const meteo = (label: string, temp = 22): Weather => ({ season: "Printemps / Été", temp, label, seasons: ["Printemps / Été"] });

describe("necessiteLeSoleil", () => {
  it("le drapeau du catalogue", () => {
    expect(necessiteLeSoleil(piece(1, "accessoire", "Lunettes", { necessiteSoleil: true }))).toBe(true);
  });
  it("une paire du dressing réel sans drapeau : par le type ou par le nom", () => {
    expect(necessiteLeSoleil(piece(2, "accessoire", "Ray-Ban", { accessoireType: "Lunettes" }))).toBe(true);
    expect(necessiteLeSoleil(piece(3, "accessoire", "Lunettes de soleil écaille"))).toBe(true);
    expect(necessiteLeSoleil(piece(4, "accessoire", "Solaires rondes"))).toBe(true);
  });
  it("des lunettes de vue, ou un autre accessoire : non", () => {
    expect(necessiteLeSoleil(piece(5, "accessoire", "Lunettes de vue", { accessoireType: "Lunettes" }))).toBe(false);
    expect(necessiteLeSoleil(piece(6, "accessoire", "Foulard en soie", { accessoireType: "Foulard" }))).toBe(false);
  });
});

describe("isSunny — du soleil dans le ciel, pas seulement de la chaleur", () => {
  it("ensoleillé et éclaircies, assez chaud : oui", () => {
    expect(isSunny(meteo("Ensoleillé", 22))).toBe(true);
    expect(isSunny(meteo("Éclaircies", 22))).toBe(true);
  });
  it("nuageux, brumeux, pluvieux, orageux, neigeux : non, même à 25 °C", () => {
    for (const l of ["Nuageux", "Brumeux", "Pluvieux", "Pluie légère", "Orageux", "Neigeux"]) expect(isSunny(meteo(l, 25))).toBe(false);
  });
  it("ensoleillé mais froid (UV estimé trop bas) : non, comme avant", () => {
    expect(isSunny(meteo("Ensoleillé", 4))).toBe(false);
  });
});

describe("la tenue proposée", () => {
  const pool = [
    piece(10, "haut", "T-shirt blanc", { hex: "#FFFFFF" }),
    piece(11, "pantalon", "Pantalon noir"),
    piece(12, "chaussures", "Baskets blanches", { shoeType: "Baskets" }),
    piece(13, "accessoire", "Lunettes de soleil", { accessoireType: "Lunettes" }),
  ];
  it("sans soleil (nuageux, pluvieux), aucune paire de lunettes, sur de nombreux tirages", () => {
    for (const label of ["Nuageux", "Pluvieux", "Couvert"]) {
      expect(isSunny(meteo(label))).toBe(false);
      for (let i = 0; i < 60; i++) {
        const r = generateOutfitWithFallback(pool, meteo(label), "quotidien");
        expect(r.ids).not.toContain(13);
      }
    }
  });
});
