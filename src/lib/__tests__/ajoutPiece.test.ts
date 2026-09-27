import { describe, expect, it } from "vitest";
import { occasionsRetenues, suggestName, suggestOccasions } from "../attributes";
import { saisonParDefaut, seasonSuggestion } from "../data";

// Refonte « Ajouter une pièce » (27/09/2026) : ce que l'écran propose sans
// que l'utilisatrice ait rien saisi — nom, saison, occasions.

describe("suggestName — accord de la couleur", () => {
  it("accorde la couleur au libellé de catégorie féminin (signalé : « Robe longue noir »)", () => {
    expect(suggestName("robe", "Longue", null, "Noir")).toBe("Robe longue noire");
  });

  it("le complément de matière ne change pas l'accord", () => {
    expect(suggestName("robe", "Longue", "Laine", "Noir")).toBe("Robe longue en laine noire");
  });

  it("accorde au féminin pluriel pour les chaussures", () => {
    expect(suggestName("chaussures", null, null, "Blanc")).toBe("Chaussures blanches");
  });

  it("laisse le masculin singulier tel quel", () => {
    expect(suggestName("manteau", null, "Laine", "Gris")).toBe("Manteau en laine gris");
  });

  it("n'accorde jamais une couleur invariable (nom de couleur ou couleur composée)", () => {
    expect(suggestName("jupe", "Midi", null, "Bordeaux")).toBe("Jupe midi bordeaux");
    expect(suggestName("robe", null, null, "Blanc cassé")).toBe("Robe blanc cassé");
  });

  it("accorde les métaux du bijou au masculin de « Bijou »", () => {
    expect(suggestName("bijou", null, null, "Doré")).toBe("Bijou doré");
  });
});

describe("saisonParDefaut — la saison ne bloque plus l'ajout", () => {
  it("reprend la suggestion quand il y en a une", () => {
    expect(saisonParDefaut("manteau", "Manteau")).toBe("Automne / Hiver");
    expect(saisonParDefaut("haut", "Chemise en lin")).toBe("Printemps / Été");
  });

  it("retombe sur « Toutes saisons » sans suggestion, jamais sur null", () => {
    expect(seasonSuggestion("robe", "Robe longue noire")).toBeNull();
    expect(saisonParDefaut("robe", "Robe longue noire")).toBe("Toutes saisons");
  });
});

describe("occasionsRetenues", () => {
  it("montre la suggestion de la catégorie tant que rien n'est touché, pas la valeur d'ouverture", () => {
    expect(occasionsRetenues(false, ["travail_formel"], "robe")).toEqual(suggestOccasions("robe"));
  });

  it("suit le type de chaussure affiché", () => {
    expect(occasionsRetenues(false, ["travail_formel"], "chaussures", "Baskets")).toEqual(["quotidien", "sport"]);
  });

  it("garde la sélection de l'utilisatrice dès qu'elle l'a modifiée, même vide", () => {
    expect(occasionsRetenues(true, ["sport"], "robe")).toEqual(["sport"]);
    expect(occasionsRetenues(true, [], "robe")).toEqual([]);
  });
});
