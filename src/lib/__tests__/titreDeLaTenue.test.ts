import { describe, expect, it } from "vitest";
import { articleDefini, nomCourtTitre, titreDeLaTenue } from "../dressingSections";
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
    expect(titreDeLaTenue([p("robe", "Robe noire"), p("chaussures", "Escarpins noirs")])?.b).toBe("et les escarpins noirs");
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

describe("nomCourtTitre (18/10/2026 : raccourcir sans perdre ce qui dit la pièce)", () => {
  it("un nom assez court reste entier", () => {
    expect(nomCourtTitre("Chemise en lin")).toBe("Chemise en lin");
    expect(nomCourtTitre("Short de sport")).toBe("Short de sport");
    expect(nomCourtTitre("Jupe midi plissée")).toBe("Jupe midi plissée");
    expect(nomCourtTitre("Robe portefeuille")).toBe("Robe portefeuille");
  });
  it("rien après « / » ni entre parenthèses", () => {
    expect(nomCourtTitre("Babies / Mary Jane")).toBe("Babies");
    expect(nomCourtTitre("Panier/Sac en rafia")).toBe("Panier");
    expect(nomCourtTitre("Jean droit (brut)")).toBe("Jean droit");
  });
  it("un nom long perd ses derniers mots, sans finir sur un mot de liaison", () => {
    expect(nomCourtTitre("Pantalon tailleur taille haute")).toBe("Pantalon tailleur");
    expect(nomCourtTitre("Blazer structuré en laine")).toBe("Blazer structuré");
    expect(nomCourtTitre("Veste en jean délavée")).toBe("Veste en jean");
    expect(nomCourtTitre("Sandales à talons fins dorées")).toBe("Sandales à talons");
  });
  it("le titre de la slide utilise ces noms", () => {
    expect(titreDeLaTenue([p("jupe", "Jupe midi plissée"), p("haut", "Chemisier rayé en coton bio")])).toEqual({
      a: "La jupe midi plissée",
      b: "et le chemisier rayé",
    });
  });
});
