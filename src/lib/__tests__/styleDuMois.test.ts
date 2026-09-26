import { describe, expect, it } from "vitest";
import { deLaSaisonEnCours, styleDuMois } from "../selectors";
import type { HistoryEntry, Item, OccasionKey, Season } from "../types";

const t = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const NOW = t(2026, 9, 26);
let n = 0;
const tenue = (occasion: OccasionKey, ts = t(2026, 9, 10)): HistoryEntry => ({ id: "h" + n++, ts, pieceIds: [1], occasion });

describe("styleDuMois — l'occasion du mois, en nombres absolus", () => {
  it("aucune tenue ce mois-ci : vide (les mois précédents ne comptent pas)", () => {
    expect(styleDuMois([tenue("travail_formel", t(2026, 8, 30))], NOW)).toEqual({ etat: "vide", total: 0 });
  });

  it("moins de 3 tenues : peu, jamais de conclusion", () => {
    expect(styleDuMois([tenue("travail_formel"), tenue("travail_formel")], NOW)).toEqual({ etat: "peu", total: 2 });
  });

  it("5 tenues travail sur 7 : tendance 5 / 7, majoritaire", () => {
    const h = [...Array(5)].map(() => tenue("travail_formel")).concat([tenue("soiree"), tenue("quotidien")]);
    expect(styleDuMois(h, NOW)).toEqual({ etat: "tendance", total: 7, occasion: "travail_formel", compte: 5, majorite: true });
  });

  it("en tête sans dépasser la moitié : tendance, non majoritaire", () => {
    const h = [tenue("soiree"), tenue("soiree"), tenue("quotidien"), tenue("all"), tenue("travail_formel")];
    expect(styleDuMois(h, NOW)).toMatchObject({ etat: "tendance", occasion: "soiree", compte: 2, total: 5, majorite: false });
  });

  it("égalité en tête : aucune occasion n'est affirmée", () => {
    expect(styleDuMois([tenue("soiree"), tenue("quotidien"), tenue("travail_formel")], NOW)).toEqual({ etat: "egalite", total: 3 });
  });

  it("des tenues sans occasion notée : sans_occasion", () => {
    expect(styleDuMois([tenue("all"), tenue("all"), tenue("all")], NOW)).toEqual({ etat: "sans_occasion", total: 3 });
  });
});

describe("deLaSaisonEnCours — la règle de la capsule", () => {
  const piece = (season: Season): Item => ({ id: 1, name: "Pièce", cat: "haut", color: "Bleu", hex: "#123", season, worn: null });

  it("fin septembre : automne/hiver et toutes saisons, pas le printemps/été", () => {
    expect(deLaSaisonEnCours(piece("Automne / Hiver"), NOW)).toBe(true);
    expect(deLaSaisonEnCours(piece("Toutes saisons"), NOW)).toBe(true);
    expect(deLaSaisonEnCours(piece("Printemps / Été"), NOW)).toBe(false);
  });

  it("en juillet, l'inverse", () => {
    expect(deLaSaisonEnCours(piece("Printemps / Été"), t(2026, 7, 10))).toBe(true);
    expect(deLaSaisonEnCours(piece("Automne / Hiver"), t(2026, 7, 10))).toBe(false);
  });
});
