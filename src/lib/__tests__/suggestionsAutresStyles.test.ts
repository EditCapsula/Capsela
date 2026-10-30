import { describe, expect, it } from "vitest";
import { representativeWeatherFor } from "../capsule";
import { piecesDAutresStyles, styleAffiche } from "../suggestionsAutresStyles";
import type { Item } from "../types";

const meteo = representativeWeatherFor("Été");
const paire = (id: number, genre: string, extra: Partial<Item> = {}) =>
  ({ id, name: `Paire ${id}`, cat: "chaussures", color: "Noir", hex: "#000", season: "Toutes saisons", genre, ...extra }) as unknown as Item;

describe("piecesDAutresStyles — le reste du catalogue, sans rien relâcher", () => {
  const catalogue = [
    paire(1, "femme"),
    paire(2, "homme"),
    paire(3, "unisexe"),
    paire(4, "femme"),
    paire(5, "femme", { season: "Automne / Hiver" } as Partial<Item>),
    { ...paire(6, "femme"), cat: "sac" } as Item,
  ];
  const base = { dejaProposees: new Set([4]), exclues: [] as number[], meteo };

  it("jamais l'autre genre ; l'unisexe reste", () => {
    expect(piecesDAutresStyles(catalogue, "chaussures", { ...base, gender: "femme" }).map((i) => i.id)).toEqual([1, 3]);
    expect(piecesDAutresStyles(catalogue, "chaussures", { ...base, gender: "homme" }).map((i) => i.id)).toEqual([2, 3]);
  });

  it("ni ce que la capsule propose déjà, ni une pièce écartée, ni hors saison, ni une autre catégorie", () => {
    expect(piecesDAutresStyles(catalogue, "chaussures", { ...base, gender: "femme", exclues: [1] }).map((i) => i.id)).toEqual([3]);
  });
});

describe("styleAffiche — le style nommé, jamais deviné", () => {
  it("le premier style déclaré hors profil, au libellé du genre", () => {
    expect(styleAffiche({ styleTags: ["Minimaliste", "Bohème"] }, ["minimaliste"], "femme")).toBe("Bohème");
    expect(styleAffiche({ styleTags: ["Glamour"] }, ["minimaliste"], "homme")).toBe("Élégant / Sophistiqué");
  });
  it("sans style déclaré lisible : « Autre style »", () => {
    expect(styleAffiche({}, ["minimaliste"], "femme")).toBe("Autre style");
    expect(styleAffiche({ styleTags: ["Minimaliste"] }, ["minimaliste"], "femme")).toBe("Autre style");
  });
  it("des chaussures d'intérieur ne sont d'aucun style : rien à nommer (30/10/2026)", () => {
    expect(styleAffiche({ styleTags: ["Minimaliste"], shoeType: "Chaussures d'intérieur" }, ["boheme"], "femme")).toBeNull();
  });
});
