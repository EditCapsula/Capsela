import { describe, expect, it } from "vitest";
import { BONUS_HUMEUR_MAX, affiniteHumeur, choisirParHumeur, HUMEURS } from "../humeur";
import { MARGE_PERTINENCE } from "../diversite";
import type { CategoryKey, Item } from "../types";

const piece = (id: number, cat: CategoryKey, extra: Partial<Item> = {}): Item =>
  ({ id, name: `p${id}`, cat, color: "Beige", hex: "#d9cbb6", season: "Toutes saisons", worn: null, ...extra }) as Item;

// L'humeur ne départage que des tenues déjà compatibles et proches en score (07/10/2026) : elle ne passe jamais devant
// une tenue nettement mieux notée, et sans signal elle laisse le tirage d'origine.
describe("humeur d'un événement", () => {
  it("le bonus maximal reste sous la marge de pertinence", () => {
    expect(BONUS_HUMEUR_MAX).toBeLessThan(MARGE_PERTINENCE);
  });

  it("propose cinq humeurs", () => {
    expect(HUMEURS.map((h) => h.key)).toEqual(["elegant", "feminin", "decontracte", "audacieux", "confortable"]);
  });

  it("l'affinité compte la part des pièces principales qui conviennent, accessoires exclus", () => {
    const blazer = piece(1, "veste", { niveauFormalite: 3 });
    const baskets = piece(2, "chaussures", { shoeType: "Baskets" });
    const sac = piece(3, "sac", { niveauFormalite: 4 });
    expect(affiniteHumeur([blazer, baskets, sac], "elegant")).toBe(0.5);
    expect(affiniteHumeur([sac], "elegant")).toBe(0);
  });

  it("départage deux tenues proches vers l'humeur choisie", () => {
    const pool = [piece(1, "robe"), piece(2, "pantalon", { niveauFormalite: 1 })];
    const candidats = [
      { ids: [2], score: 80 },
      { ids: [1], score: 79 },
    ];
    expect(choisirParHumeur(candidats, pool, "feminin")).toBe(1);
    expect(choisirParHumeur(candidats, pool, "decontracte")).toBe(0);
  });

  it("ne passe jamais devant une tenue nettement mieux notée", () => {
    const pool = [piece(1, "robe"), piece(2, "pantalon", { niveauFormalite: 1 })];
    const candidats = [
      { ids: [2], score: 90 },
      { ids: [1], score: 90 - MARGE_PERTINENCE - 1 },
    ];
    expect(choisirParHumeur(candidats, pool, "feminin")).toBe(0);
  });

  it("sans candidat, ne choisit rien", () => {
    expect(choisirParHumeur([], [], "elegant")).toBe(-1);
  });
});
