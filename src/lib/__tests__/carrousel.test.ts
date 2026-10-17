import { describe, expect, it } from "vitest";
import { composerSlides, slideDeLOccasion, slidesDuJour, typeDeJour } from "../carrousel";

const propositions = { travail: [1, 2, 3], quotidien: [4, 5, 6], soiree: [7, 8, 9] };

describe("slideDeLOccasion", () => {
  it("rattache chaque occasion du store à sa slide (17/10/2026 : une slide par occasion)", () => {
    expect(slideDeLOccasion("travail_formel")).toBe("travail");
    expect(slideDeLOccasion("quotidien")).toBe("quotidien");
    expect(slideDeLOccasion("soiree")).toBe("soiree");
    expect(slideDeLOccasion("date")).toBe("date");
    expect(slideDeLOccasion("sport")).toBe("sport");
    expect(slideDeLOccasion("cocooning")).toBe("cocooning");
    expect(slideDeLOccasion("voyage")).toBe("voyage");
    expect(slideDeLOccasion("evenement_perso")).toBe("ceremonie");
    expect(slideDeLOccasion("all")).toBeNull();
    expect(slideDeLOccasion(null)).toBeNull();
  });
});

describe("composerSlides", () => {
  it("met la tenue du jour en tête, les autres dans l'ordre travail, quotidien, soirée (17/10/2026)", () => {
    // Signalé : un samedi (jour non travaillé), la slide Travail passait devant la tenue Quotidien du jour.
    const s = composerSlides({ tenueDuJour: [10, 11, 12], occasion: "quotidien", planAujourdhui: false, propositions });
    expect(s.map((x) => x.id)).toEqual(["quotidien", "travail", "soiree"]);
    expect(s[0]).toMatchObject({ ids: [10, 11, 12], source: "jour" });
    expect(s[1]).toMatchObject({ ids: [1, 2, 3], source: "proposition" });
    expect(s[2]).toMatchObject({ ids: [7, 8, 9], source: "proposition" });
  });

  it("un jour travaillé, la tenue du jour Travail reste la première", () => {
    const s = composerSlides({ tenueDuJour: [10, 11, 12], occasion: "travail_formel", planAujourdhui: false, propositions });
    expect(s.map((x) => x.id)).toEqual(["travail", "quotidien", "soiree"]);
    expect(s[0].source).toBe("jour");
  });

  it("une tenue planifiée est montrée en premier, sur la slide de SON occasion : les deux autres occasions restent (15/10/2026)", () => {
    // Signalé : un plan « Soirée » prenait la slide Travail, et la proposition Soirée (mêmes pièces principales) tombait.
    const s = composerSlides({ tenueDuJour: [20, 21], occasion: "soiree", planAujourdhui: true, propositions: { travail: [1, 2, 3], quotidien: [4, 5, 6] } });
    expect(s.map((x) => x.id)).toEqual(["soiree", "travail", "quotidien"]);
    expect(s[0]).toMatchObject({ ids: [20, 21], source: "plan", occasion: "soiree" });
    expect(s.slice(1).every((x) => x.source === "proposition")).toBe(true);
  });

  it("un plan d'une autre occasion (voyage) passe en tête, sur sa propre slide", () => {
    const s = composerSlides({ tenueDuJour: [20, 21], occasion: "voyage", planAujourdhui: true, propositions });
    expect(s[0]).toMatchObject({ id: "voyage", ids: [20, 21], source: "plan", occasion: "voyage" });
    expect(s.slice(1).map((x) => x.id)).toEqual(["travail", "quotidien", "soiree"]);
  });

  it("un plan sans occasion prend la première slide du jour", () => {
    const s = composerSlides({ tenueDuJour: [20, 21], occasion: "all", planAujourdhui: true, propositions });
    expect(s[0]).toMatchObject({ id: "travail", ids: [20, 21], source: "plan" });
  });


  it("ne montre jamais deux fois la même tenue, quel que soit l'ordre des ids", () => {
    const s = composerSlides({ tenueDuJour: [3, 2, 1], occasion: "quotidien", planAujourdhui: false, propositions });
    expect(s.map((x) => x.id)).toEqual(["quotidien", "soiree"]);
    expect(s[0].source).toBe("jour");
  });

  it("omet une slide sans tenue valide", () => {
    const s = composerSlides({ tenueDuJour: [10], occasion: "travail_formel", planAujourdhui: false, propositions: { quotidien: [], soiree: [7] } });
    expect(s.map((x) => x.id)).toEqual(["travail", "soiree"]);
  });

  it("sans occasion (« all ») ni plan, la tenue du jour n'a pas de slide : seules les propositions", () => {
    const s = composerSlides({ tenueDuJour: [10], occasion: "all", planAujourdhui: false, propositions });
    expect(s.map((x) => x.source)).toEqual(["proposition", "proposition", "proposition"]);
  });


  it("sans tenue du jour, ni propositions : aucune slide", () => {
    expect(composerSlides({ tenueDuJour: [], occasion: "quotidien", planAujourdhui: false, propositions: {} })).toEqual([]);
  });

  it("le type du jour se lit sur l'occasion par défaut de « Mon rythme »", () => {
    expect(typeDeJour("travail_formel")).toBe("travail");
    expect(typeDeJour("quotidien")).toBe("repos");
    expect(typeDeJour("cocooning")).toBe("conges");
  });

  it("l'ordre du jour : travail d'abord en semaine, jamais le week-end ni en congés (17/10/2026)", () => {
    expect(slidesDuJour("travail")).toEqual(["travail", "quotidien", "soiree", "date", "sport", "voyage", "cocooning", "ceremonie"]);
    expect(slidesDuJour("repos")).toEqual(["quotidien", "sport", "soiree", "date", "cocooning", "voyage", "ceremonie"]);
    expect(slidesDuJour("conges")).toEqual(["quotidien", "cocooning", "sport", "soiree", "date", "voyage", "ceremonie"]);
  });

  it("un samedi : quotidien, sport, soirée, puis les slides tirées en défilant", () => {
    const s = composerSlides({
      tenueDuJour: [10, 11],
      occasion: "quotidien",
      planAujourdhui: false,
      propositions: { ...propositions, sport: [12, 13, 14], date: [15, 16] },
      jour: "repos",
    });
    // La proposition Travail existe mais n'est jamais affichée un jour de repos.
    expect(s.map((x) => x.id)).toEqual(["quotidien", "sport", "soiree", "date"]);
    expect(s[1]).toMatchObject({ occasion: "sport", surtitre: "Pour ton sport", source: "proposition" });
    expect(s[3]).toMatchObject({ occasion: "date", surtitre: "Pour ton rendez-vous" });
  });

  it("en congés, la tenue Cocooning du jour ouvre le carrousel", () => {
    const s = composerSlides({ tenueDuJour: [30, 31], occasion: "cocooning", planAujourdhui: false, propositions: { quotidien: [4, 5], sport: [12] }, jour: "conges" });
    expect(s.map((x) => x.id)).toEqual(["cocooning", "quotidien", "sport"]);
    expect(s[0].source).toBe("jour");
  });

  it("une tenue du jour choisie hors de l'ordre du jour (le travail un samedi) garde sa slide, en tête", () => {
    const s = composerSlides({ tenueDuJour: [10, 11], occasion: "travail_formel", planAujourdhui: false, propositions: { sport: [12], soiree: [7] }, jour: "repos" });
    expect(s.map((x) => x.id)).toEqual(["travail", "sport", "soiree"]);
    expect(s[0].source).toBe("jour");
  });
});
