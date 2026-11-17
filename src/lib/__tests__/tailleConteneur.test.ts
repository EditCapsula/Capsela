import { describe, expect, it } from "vitest";
import { hauteurVisuelStyle, largeurPlanche, styleLargeurPlanche } from "../tailleConteneur";

describe("tailleConteneur", () => {
  it("la planche prend toute la largeur quand le cadre est assez haut", () => {
    expect(largeurPlanche(200, 400, 112)).toBe(200);
  });
  it("la planche est bornée par la hauteur quand le cadre est plat", () => {
    expect(largeurPlanche(400, 112, 112)).toBe(100);
  });
  it("sans mesure, l'expression d'origine en unités de conteneur", () => {
    expect(styleLargeurPlanche(null, 125)).toBe("min(100cqw, calc(100cqh * 0.8))");
    expect(styleLargeurPlanche({ w: 0, h: 10 }, 125)).toContain("cqw");
  });
  it("mesurée, en pixels", () => {
    expect(styleLargeurPlanche({ w: 300, h: 250 }, 125)).toBe("200px");
  });
  it("le visuel des styles garde ses bornes", () => {
    expect(hauteurVisuelStyle(100, true)).toBe(160);
    expect(hauteurVisuelStyle(330, true)).toBeCloseTo(316.8);
    expect(hauteurVisuelStyle(330, false)).toBeCloseTo(363);
    expect(hauteurVisuelStyle(800, false)).toBe(460);
  });
});
