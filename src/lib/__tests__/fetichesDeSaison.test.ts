import { describe, expect, it } from "vitest";
import { debutDeSaison, deLaSaison, mostWornPiecesDeSaison } from "../selectors";
import type { HistoryEntry, Item } from "../types";

// PIÈCES FÉTICHES PAR SAISON (11/10/2026) : le classement ne compte que les ports depuis le début de la saison calendaire en cours.

const piece = (id: number): Item => ({ id, name: `Pièce ${id}`, cat: "haut", color: "Noir", hex: "#000000", season: "Toutes saisons", worn: null }) as Item;
const pool = [1, 2, 3, 4].map(piece);
const entree = (id: string, date: Date, pieceIds: number[]): HistoryEntry => ({ id, ts: date.getTime(), pieceIds, occasion: "quotidien" as HistoryEntry["occasion"] });

describe("debutDeSaison", () => {
  it("découpe au mois près, hiver à cheval sur deux années", () => {
    expect(debutDeSaison(new Date(2026, 9, 11))).toEqual(new Date(2026, 8, 1));
    expect(debutDeSaison(new Date(2026, 6, 3))).toEqual(new Date(2026, 5, 1));
    expect(debutDeSaison(new Date(2026, 3, 3))).toEqual(new Date(2026, 2, 1));
    expect(debutDeSaison(new Date(2026, 11, 20))).toEqual(new Date(2026, 11, 1));
    expect(debutDeSaison(new Date(2027, 0, 15))).toEqual(new Date(2026, 11, 1));
  });
  it("le titre se dit avec le bon article", () => {
    expect(deLaSaison("Automne")).toBe("de l'automne");
    expect(deLaSaison("Printemps")).toBe("du printemps");
  });
});

describe("mostWornPiecesDeSaison", () => {
  const maintenant = new Date(2026, 9, 11);
  const histo = [
    // L'été : la pièce 1 est portée cinq fois.
    ...[1, 2, 3, 4, 5].map((j) => entree(`e${j}`, new Date(2026, 6, j), [1])),
    // L'automne : la pièce 2 deux fois, la 3 une fois.
    entree("a1", new Date(2026, 8, 5), [2]),
    entree("a2", new Date(2026, 9, 1), [2, 3]),
  ];
  it("ne compte que la saison en cours, avec ses propres nombres de ports", () => {
    const r = mostWornPiecesDeSaison(histo, pool, maintenant);
    expect(r.map((x) => [x.item.id, x.count])).toEqual([[2, 2], [3, 1]]);
  });
  it("une saison sans tenue portée rend une liste vide", () => {
    expect(mostWornPiecesDeSaison(histo, pool, new Date(2026, 11, 5))).toEqual([]);
  });
  it("une entrée postérieure à maintenant n'est pas comptée", () => {
    const r = mostWornPiecesDeSaison([entree("f", new Date(2026, 9, 20), [4])], pool, maintenant);
    expect(r).toEqual([]);
  });
});
