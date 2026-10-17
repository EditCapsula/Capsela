import { describe, expect, it } from "vitest";
import { articleDefini, titreDeLaTenue } from "../dressingSections";
import type { CategoryKey, Item } from "../types";

// LE TITRE D'UNE SLIDE TIRÉ DE SA TENUE (17/10/2026) : les deux pièces maîtresses, avec leur vrai nom.
let n = 0;
const p = (cat: CategoryKey, name: string): Item => ({ id: ++n, name, cat, color: "Noir", hex: "#222222", season: "Toutes saisons", worn: null });

describe("articleDefini", () => {
  it("s'accorde avec le nom de la pièce, pas avec sa catégorie", () => {
    expect(articleDefini(p("haut", "Chemise blanche"))).toBe("la");
    expect(articleDefini(p("haut", "T-shirt noir"))).toBe("le");
    expect(articleDefini(p("chaussures", "Baskets blanches"))).toBe("les");
    expect(articleDefini(p("veste", "Escarpins vernis"))).toBe("les");
  });
  it("élide devant une voyelle ou un h muet", () => {
    expect(articleDefini(p("pull", "Écharpe en laine"))).toBe("l'");
    expect(articleDefini(p("veste", "Imperméable beige"))).toBe("l'");
  });
  it("retombe sur la catégorie pour un nom inconnu", () => {
    expect(articleDefini(p("jupe", "Midi plissée"))).toBe("la");
  });
});

describe("titreDeLaTenue", () => {
  it("haut et bas : le bas, puis le haut", () => {
    expect(titreDeLaTenue([p("haut", "Marinière"), p("jean", "Jean brut"), p("chaussures", "Baskets blanches")])).toEqual({
      a: "Le jean brut",
      b: "et la marinière",
    });
  });
  it("robe : elle, puis la veste, sinon les chaussures", () => {
    expect(titreDeLaTenue([p("robe", "Robe noire"), p("chaussures", "Escarpins noirs"), p("veste", "Blazer camel")])).toEqual({
      a: "La robe noire",
      b: "et le blazer camel",
    });
    expect(titreDeLaTenue([p("robe", "Robe noire"), p("chaussures", "Escarpins noirs")]).b).toBe("et les escarpins noirs");
  });
  it("sans pièce reconnue, rien : l'appelant garde son titre", () => {
    expect(titreDeLaTenue([p("sac", "Cabas")])).toBeNull();
  });
  it("deux tenues différentes donnent deux titres différents", () => {
    const a = titreDeLaTenue([p("pantalon", "Pantalon tailleur"), p("haut", "Chemise blanche")]);
    const b = titreDeLaTenue([p("short", "Short en lin"), p("haut", "T-shirt rayé")]);
    expect(a).not.toEqual(b);
  });
});
