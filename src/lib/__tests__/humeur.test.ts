import { describe, expect, it } from "vitest";
import { BONUS_HUMEUR_MAX, affiniteHumeur, choisirParHumeur, HUMEURS, humeursProposees, libelleHumeur } from "../humeur";
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

  it("propose les cinq préférences du brief du 04/11/2026, dans leur ordre", () => {
    expect(humeursProposees(null).map((h) => h.key)).toEqual(["confortable", "elegant", "feminin", "decontracte", "leger"]);
    // Audacieux n'est plus proposé mais reste lisible pour les plans déjà gardés.
    expect(HUMEURS.map((h) => h.key)).toContain("audacieux");
  });

  it("léger et ventilé : matières qui respirent, manches courtes ou sans, short, chaussures ouvertes", () => {
    expect(affiniteHumeur([piece(1, "haut", { matiere: "Lin" })], "leger")).toBe(1);
    expect(affiniteHumeur([piece(2, "haut", { manches: "courtes" })], "leger")).toBe(1);
    expect(affiniteHumeur([piece(3, "short")], "leger")).toBe(1);
    expect(affiniteHumeur([piece(4, "chaussures", { shoeType: "Sandales" })], "leger")).toBe(1);
    expect(affiniteHumeur([piece(5, "pull", { matiere: "Laine", manches: "longues" })], "leger")).toBe(0);
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

describe("mots et choix selon le genre du profil", () => {
  it("profil homme : pas de « Glamour »", () => {
    expect(humeursProposees("homme").map((h) => h.label)).toEqual(["Confort", "Plus habillé", "Décontracté", "Léger et ventilé"]);
  });
  it("profil femme ou non renseigné : les cinq préférences", () => {
    const attendu = ["Confort", "Plus habillé", "Glamour", "Décontracté", "Léger et ventilé"];
    expect(humeursProposees("femme").map((h) => h.label)).toEqual(attendu);
    expect(humeursProposees(null).map((h) => h.label)).toEqual(attendu);
  });
  it("un plan ancien « Audacieux » garde son libellé", () => {
    expect(libelleHumeur("audacieux", "femme")).toBe("Audacieuse");
    expect(libelleHumeur("elegant", null)).toBe("Plus habillé");
  });
});
