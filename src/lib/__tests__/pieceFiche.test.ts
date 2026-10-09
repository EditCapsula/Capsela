import { describe, expect, it } from "vitest";
import { champsManquants, phraseQuandPorter, phraseSaisons, titreEnDeuxTemps } from "../pieceFiche";

describe("fiche d'une pièce", () => {
  it("saisons en toutes lettres, dans l'ordre", () => {
    expect(phraseSaisons(["Automne", "Printemps"])).toBe("Au printemps et en automne");
    expect(phraseSaisons(["Été"])).toBe("En été");
    expect(phraseSaisons(["Printemps", "Été", "Automne"])).toBe("Au printemps, en été et en automne");
    expect(phraseSaisons(["Printemps", "Été", "Automne", "Hiver"])).toBe("Toute l'année");
  });

  it("n'affirme que les occasions enregistrées", () => {
    expect(phraseQuandPorter(["Hiver"], undefined)).toBe("En hiver.");
    expect(phraseQuandPorter(["Hiver"], ["quotidien", "soiree"])).toBe("En hiver — quotidien / Décontracté, soirée.");
  });

  it("titre en deux temps", () => {
    expect(titreEnDeuxTemps("Veste en daim")).toEqual({ debut: "Veste", fin: "en daim" });
    expect(titreEnDeuxTemps("Robe midi")).toEqual({ debut: "Robe", fin: "midi" });
    expect(titreEnDeuxTemps("Sac")).toEqual({ debut: "Sac", fin: "" });
  });

  it("champs manquants selon la catégorie", () => {
    expect(champsManquants({ cat: "veste" })).toEqual(["matière", "coupe", "taille"]);
    expect(champsManquants({ cat: "veste", matiere: "Daim", coupe: "Ample", size: "M" })).toEqual([]);
    expect(champsManquants({ cat: "chaussures", matiere: "Cuir" })).toEqual(["pointure"]);
    expect(champsManquants({ cat: "bijou", matiere: "Or" as never })).toEqual([]);
  });
});
