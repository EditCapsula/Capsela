import { describe, expect, it } from "vitest";
import { basculerStyle, champsProfilStyle, libelleStyles, MAX_STYLES, stylesLabels } from "../profile";
import { EMPTY_PROFILE } from "../profile";

describe("basculerStyle — un ou deux styles, le premier est le principal", () => {
  it("ajoute un style, puis un second", () => {
    expect(basculerStyle([], "minimaliste")).toEqual(["minimaliste"]);
    expect(basculerStyle(["minimaliste"], "boheme")).toEqual(["minimaliste", "boheme"]);
  });
  it("retire un style choisi ; le second devient principal", () => {
    expect(basculerStyle(["minimaliste", "boheme"], "minimaliste")).toEqual(["boheme"]);
    expect(basculerStyle(["minimaliste", "boheme"], "boheme")).toEqual(["minimaliste"]);
  });
  it("au plafond, un troisième remplace le second, jamais le principal", () => {
    expect(MAX_STYLES).toBe(2);
    expect(basculerStyle(["minimaliste", "boheme"], "romantique")).toEqual(["minimaliste", "romantique"]);
  });
  it("ne mute pas l'entrée", () => {
    const e = ["minimaliste"];
    basculerStyle(e, "boheme");
    expect(e).toEqual(["minimaliste"]);
  });
});

describe("libellés des styles", () => {
  it("un style, deux styles, aucun, id inconnu ignoré", () => {
    expect(libelleStyles(["minimaliste"], "femme")).toBe("Minimaliste");
    expect(libelleStyles(["minimaliste", "boheme"], "femme")).toBe("Minimaliste et Bohème");
    expect(libelleStyles([], "femme")).toBe("");
    expect(stylesLabels(["inconnu", "boheme"], "femme")).toEqual(["Bohème"]);
  });
  it("la complétude du profil lit tous les styles", () => {
    const champ = (styles: string[]) => champsProfilStyle({ ...EMPTY_PROFILE, gender: "femme", styles }).find((c) => c.cle === "style")!;
    expect(champ([]).renseigne).toBe(false);
    expect(champ(["boheme"]).renseigne).toBe(true);
  });
});
