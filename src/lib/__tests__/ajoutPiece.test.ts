import { describe, expect, it } from "vitest";
import { occasionsRetenues, suggestName, suggestOccasions } from "../attributes";
import { saisonParDefaut, seasonSuggestion } from "../data";
import { basculerSaison, libelleSaisons, saisonsDe, saisonsDepuisSeason, saisonsParDefaut, seasonDepuisSaisons } from "../saisons";

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

describe("quatre saisons (saisons.ts)", () => {
  it("déduit la valeur à trois choix que lit le moteur", () => {
    expect(seasonDepuisSaisons(["Été"])).toBe("Printemps / Été");
    expect(seasonDepuisSaisons(["Printemps", "Été"])).toBe("Printemps / Été");
    expect(seasonDepuisSaisons(["Automne", "Hiver"])).toBe("Automne / Hiver");
    expect(seasonDepuisSaisons(["Printemps", "Automne"])).toBe("Toutes saisons");
    expect(seasonDepuisSaisons(["Printemps", "Été", "Automne", "Hiver"])).toBe("Toutes saisons");
  });

  it("aller-retour : une valeur à trois choix redevient elle-même", () => {
    for (const s of ["Printemps / Été", "Automne / Hiver", "Toutes saisons"] as const) {
      expect(seasonDepuisSaisons(saisonsDepuisSeason(s))).toBe(s);
    }
  });

  it("propose la suggestion à l'ajout, sinon les quatre", () => {
    expect(saisonsParDefaut("manteau", "Manteau")).toEqual(["Automne", "Hiver"]);
    expect(saisonsParDefaut("robe", "Robe longue noire")).toEqual(["Printemps", "Été", "Automne", "Hiver"]);
  });

  it("lit les saisons enregistrées, sinon celles de la valeur à trois choix", () => {
    expect(saisonsDe({ season: "Toutes saisons", saisons: ["Hiver", "Automne"] })).toEqual(["Automne", "Hiver"]);
    expect(saisonsDe({ season: "Printemps / Été" })).toEqual(["Printemps", "Été"]);
    expect(saisonsDe({ season: "Automne / Hiver", saisons: [] })).toEqual(["Automne", "Hiver"]);
  });

  it("coche dans l'ordre de l'année et ne décoche jamais la dernière", () => {
    expect(basculerSaison(["Hiver"], "Printemps")).toEqual(["Printemps", "Hiver"]);
    expect(basculerSaison(["Automne", "Hiver"], "Hiver")).toEqual(["Automne"]);
    expect(basculerSaison(["Automne"], "Automne")).toEqual(["Automne"]);
  });

  it("libellé : « Toutes saisons » pour les quatre, sinon la liste", () => {
    expect(libelleSaisons(["Automne", "Hiver"])).toBe("Automne · Hiver");
    expect(libelleSaisons(["Été"])).toBe("Été");
    expect(libelleSaisons(["Hiver", "Été", "Printemps", "Automne"])).toBe("Toutes saisons");
  });
});
