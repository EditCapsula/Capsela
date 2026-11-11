import { describe, expect, it } from "vitest";
import { basculerStyle, champsProfilStyle, libelleStyles, MAX_STYLES, stylesLabels } from "../profile";
import { EMPTY_PROFILE } from "../profile";

describe("basculerStyle — un à trois styles, le premier est le principal", () => {
  it("ajoute un style, puis un second", () => {
    expect(basculerStyle([], "minimaliste")).toEqual(["minimaliste"]);
    expect(basculerStyle(["minimaliste"], "boheme")).toEqual(["minimaliste", "boheme"]);
  });
  it("retire un style choisi ; le second devient principal", () => {
    expect(basculerStyle(["minimaliste", "boheme"], "minimaliste")).toEqual(["boheme"]);
    expect(basculerStyle(["minimaliste", "boheme"], "boheme")).toEqual(["minimaliste"]);
  });
  it("un troisième s'ajoute (11/11/2026) ; au plafond, un quatrième remplace le dernier, jamais le principal", () => {
    expect(MAX_STYLES).toBe(3);
    expect(basculerStyle(["minimaliste", "boheme"], "romantique")).toEqual(["minimaliste", "boheme", "romantique"]);
    expect(basculerStyle(["minimaliste", "boheme", "romantique"], "preppy")).toEqual(["minimaliste", "boheme", "preppy"]);
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
    expect(libelleStyles(["minimaliste", "boheme", "romantique"], "femme")).toBe("Minimaliste, Bohème et Romantique");
    expect(libelleStyles([], "femme")).toBe("");
    expect(stylesLabels(["inconnu", "boheme"], "femme")).toEqual(["Bohème"]);
  });
  it("la complétude du profil lit tous les styles", () => {
    const champ = (styles: string[]) => champsProfilStyle({ ...EMPTY_PROFILE, gender: "femme", styles }).find((c) => c.cle === "style")!;
    expect(champ([]).renseigne).toBe(false);
    expect(champ(["boheme"]).renseigne).toBe(true);
  });
});
