import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE, STYLE_ID_TO_CATALOG_LABEL, VISUELS_ETAPE_STYLE_FEMME, applyGenderChange, basculerStyle, styleConfigFor, styleLabel, stylesDuGenre, stylesLus } from "../profile";
import { styleFit } from "../capsule";
import type { Item } from "../types";

// 14/10/2026 — signalé : un profil passé de Femme à Homme gardait « Glamour » (absent des styles Homme) ; il comptait dans la limite de
// deux styles sans être visible, donc aucun autre style ne pouvait être choisi.
describe("styles et genre", () => {
  it("stylesDuGenre écarte les styles que le genre ne propose pas, en gardant l'ordre", () => {
    expect(stylesDuGenre(["glamour", "minimaliste"], "homme")).toEqual(["minimaliste"]);
    expect(stylesDuGenre(["glamour", "minimaliste"], "femme")).toEqual(["glamour", "minimaliste"]);
    expect(stylesDuGenre(["romantique"], "homme")).toEqual([]);
  });

  it("Créatif (30/10/2026) : proposé aux deux genres, avec son libellé et son visuel", () => {
    expect(stylesDuGenre(["creatif"], "femme")).toEqual(["creatif"]);
    expect(stylesDuGenre(["creatif"], "homme")).toEqual(["creatif"]);
    expect(styleLabel("creatif", "femme")).toBe("Créatif");
    expect(styleLabel("creatif", "homme")).toBe("Créatif / Artistique");
    expect(STYLE_ID_TO_CATALOG_LABEL.creatif).toBe("Créatif");
    expect(styleConfigFor("homme").creatif.asset).toBe("/images/styles/homme/creatif.webp");
    expect(VISUELS_ETAPE_STYLE_FEMME.creatif).toBe("/images/styles/creatif.webp");
  });

  it("un profil homme enregistré avec `romantique` (ancien « Créatif / Artistique ») se relit `creatif`, sans doublon", () => {
    expect(stylesLus(["romantique", "minimaliste"], "homme")).toEqual(["creatif", "minimaliste"]);
    expect(stylesLus(["romantique", "creatif"], "homme")).toEqual(["creatif"]);
    // Côté femme, Romantique reste Romantique.
    expect(stylesLus(["romantique"], "femme")).toEqual(["romantique"]);
  });

  it("une femme Romantique qui passe en Homme ne devient pas Créatif", () => {
    const { patch } = applyGenderChange({ ...EMPTY_PROFILE, gender: "femme", styles: ["romantique", "boheme"] }, "homme");
    expect(patch.styles).toEqual(["boheme"]);
  });

  it("changer de genre retire les styles hors genre du profil", () => {
    const { patch } = applyGenderChange({ ...EMPTY_PROFILE, gender: "femme", styles: ["glamour", "minimaliste"] }, "homme");
    expect(patch.styles).toEqual(["minimaliste"]);
  });

  it("changer de genre sans style hors genre ne touche pas aux styles", () => {
    const { patch } = applyGenderChange({ ...EMPTY_PROFILE, gender: "femme", styles: ["minimaliste"] }, "homme");
    expect(patch.styles).toBeUndefined();
  });

  it("un profil déjà dans cet état (Glamour + Minimaliste côté Homme) peut de nouveau choisir un style une fois nettoyé", () => {
    const valides = stylesDuGenre(["glamour", "minimaliste"], "homme");
    expect(valides.length).toBeLessThan(2);
    expect(basculerStyle(valides, "casual_chic")).toEqual(["minimaliste", "casual_chic"]);
  });
});

describe("Créatif — les pièces du dressing (30/10/2026)", () => {
  // Sans étiquettes de style (pièce du dressing), STYLE_FIT lit le nom : un trait créatif affirmé, jamais une pièce unie.
  const piece = (name: string): Item => ({ id: 1, name, cat: "haut", color: "Écru", hex: "#EDE4D6", season: "Toutes saisons", worn: null });
  it("reconnaît un trait créatif dans le nom", () => {
    expect(styleFit(piece("T-shirt graphique"), "Créatif")).toBe(true);
    expect(styleFit(piece("Jupe midi asymétrique"), "Créatif")).toBe(true);
    expect(styleFit(piece("Pull jacquard"), "Créatif")).toBe(true);
  });
  it("une pièce unie n'est pas Créatif", () => {
    expect(styleFit(piece("T-shirt basique blanc"), "Créatif")).toBe(false);
  });
  it("un article du catalogue est lu par ses étiquettes, pas par son nom", () => {
    expect(styleFit({ ...piece("T-shirt graphique"), styleTags: ["Streetwear"] }, "Créatif")).toBe(false);
    expect(styleFit({ ...piece("Pull col V"), styleTags: ["Créatif"] }, "Créatif")).toBe(true);
  });
});
