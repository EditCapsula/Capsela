import { describe, expect, it } from "vitest";
import { occasionsRetenues, suggestName, suggestOccasions } from "../attributes";
import { saisonParDefaut, seasonSuggestion } from "../data";
import { basculerSaison, enSaisons, libelleSaisons, saisonsDe, saisonsDepuisSeason, saisonsParDefaut, seasonDepuisSaisons } from "../saisons";
import { contexteCapsule, estDeSaison, representativeWeatherFor, saisonsDuJour, saisonThermique, weatherForDay } from "../capsule";

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

describe("le moteur lit les quatre saisons (capsule.ts)", () => {
  const CAL = ["Printemps", "Été", "Automne", "Hiver"] as const;
  const TEMPS = [...Array.from({ length: 41 }, (_, i) => i - 5), 9.5, 19.5];
  const LEGACY = ["Printemps / Été", "Automne / Hiver", "Toutes saisons"] as const;

  it("saison thermique : ≥ 20° Été, 10–19° Automne, sous 10° Hiver", () => {
    expect(saisonThermique(20)).toBe("Été");
    expect(saisonThermique(19)).toBe("Automne");
    expect(saisonThermique(10)).toBe("Automne");
    expect(saisonThermique(9)).toBe("Hiver");
    expect(saisonsDuJour(28, "Automne")).toEqual(["Été", "Automne"]);
    expect(saisonsDuJour(15, "Printemps")).toEqual(["Printemps", "Automne"]);
  });

  it("une pièce sans quatre saisons est jugée exactement comme avant", () => {
    for (const temp of TEMPS) for (const cal of CAL) {
      const w = weatherForDay(temp, "Nuageux", cal);
      for (const season of LEGACY) expect(estDeSaison({ season }, w), `${temp}° ${cal} ${season}`).toBe(w.seasons.includes(season));
    }
  });

  it("DÉMONTRÉ : cocher une moitié d'année entière (ou les quatre) ne change aucune journée", () => {
    for (const temp of TEMPS) for (const cal of CAL) {
      const contextes = [weatherForDay(temp, "Nuageux", cal), representativeWeatherFor(cal, temp), contexteCapsule(cal)];
      for (const ctx of contextes) for (const season of LEGACY) {
        const avant = estDeSaison({ season }, ctx);
        const apres = estDeSaison({ season, saisons: saisonsDepuisSeason(season) }, ctx);
        expect(apres, `${temp}° ${cal} ${season}`).toBe(avant);
      }
    }
  });

  it("une pièce cochée autrement suit son choix", () => {
    const robeEte = { season: seasonDepuisSaisons(["Été"]), saisons: ["Été" as const] };
    const trench = { season: seasonDepuisSaisons(["Printemps", "Automne"]), saisons: ["Printemps" as const, "Automne" as const] };
    // Avant : la robe d'été passait par le calendrier un 8° d'avril, le trench partout.
    expect(estDeSaison(robeEte, weatherForDay(8, "Pluie", "Printemps"))).toBe(false);
    expect(estDeSaison(robeEte, weatherForDay(27, "Ensoleillé", "Automne"))).toBe(true);
    expect(estDeSaison(trench, weatherForDay(3, "Nuageux", "Hiver"))).toBe(false);
    expect(estDeSaison(trench, weatherForDay(30, "Ensoleillé", "Été"))).toBe(false);
    expect(estDeSaison(trench, weatherForDay(15, "Nuageux", "Printemps"))).toBe(true);
    expect(estDeSaison(trench, contexteCapsule("Automne"))).toBe(true);
    expect(estDeSaison(trench, contexteCapsule("Hiver"))).toBe(false);
  });

  it("phrase « se porte … »", () => {
    expect(enSaisons(["Printemps", "Été"])).toBe("au printemps et en été");
    expect(enSaisons(["Été"])).toBe("en été");
    expect(enSaisons(["Hiver", "Printemps", "Automne"])).toBe("au printemps, en automne et en hiver");
  });
});
