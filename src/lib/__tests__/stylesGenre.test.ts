import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE, applyGenderChange, basculerStyle, stylesDuGenre } from "../profile";

// 14/10/2026 — signalé : un profil passé de Femme à Homme gardait « Glamour » (absent des styles Homme) ; il comptait dans la limite de
// deux styles sans être visible, donc aucun autre style ne pouvait être choisi.
describe("styles et genre", () => {
  it("stylesDuGenre écarte les styles que le genre ne propose pas, en gardant l'ordre", () => {
    expect(stylesDuGenre(["glamour", "minimaliste"], "homme")).toEqual(["minimaliste"]);
    expect(stylesDuGenre(["glamour", "minimaliste"], "femme")).toEqual(["glamour", "minimaliste"]);
    expect(stylesDuGenre(["romantique"], "homme")).toEqual([]);
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
