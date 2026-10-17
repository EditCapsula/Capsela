import { describe, expect, it } from "vitest";
import { composerSlides, slideDeLOccasion, slidesDuJour } from "../carrousel";

const propositions = { travail: [1, 2, 3], quotidien: [4, 5, 6], soiree: [7, 8, 9] };

describe("slideDeLOccasion", () => {
  it("rattache les occasions du store aux quatre slides, et rien d'autre", () => {
    expect(slideDeLOccasion("travail_formel")).toBe("travail");
    expect(slideDeLOccasion("quotidien")).toBe("quotidien");
    expect(slideDeLOccasion("soiree")).toBe("soiree");
    expect(slideDeLOccasion("date")).toBe("soiree");
    expect(slideDeLOccasion("sport")).toBe("sport");
    expect(slideDeLOccasion("cocooning")).toBeNull();
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

  it("un plan d'une occasion sans slide (sport, voyage…) garde la première place", () => {
    const s = composerSlides({ tenueDuJour: [20, 21], occasion: "voyage", planAujourdhui: true, propositions });
    expect(s[0]).toMatchObject({ id: "travail", ids: [20, 21], source: "plan", occasion: "voyage" });
    expect(s.slice(1).map((x) => x.id)).toEqual(["quotidien", "soiree"]);
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

  it("une occasion hors carrousel (cocooning) ne montre que les propositions", () => {
    const s = composerSlides({ tenueDuJour: [10], occasion: "cocooning", planAujourdhui: false, propositions });
    expect(s.map((x) => x.source)).toEqual(["proposition", "proposition", "proposition"]);
  });

  it("sans tenue du jour, ni propositions : aucune slide", () => {
    expect(composerSlides({ tenueDuJour: [], occasion: "quotidien", planAujourdhui: false, propositions: {} })).toEqual([]);
  });

  it("un jour de repos ou de congés : quotidien, sport, soirée — jamais le travail (17/10/2026)", () => {
    expect(slidesDuJour(false)).toEqual(["quotidien", "sport", "soiree"]);
    const s = composerSlides({
      tenueDuJour: [10, 11],
      occasion: "quotidien",
      planAujourdhui: false,
      propositions: { ...propositions, sport: [12, 13, 14] },
      jourTravaille: false,
    });
    expect(s.map((x) => x.id)).toEqual(["quotidien", "sport", "soiree"]);
    expect(s[1]).toMatchObject({ occasion: "sport", surtitre: "Pour ton sport", source: "proposition" });
  });

  it("une tenue du jour choisie hors du jeu du jour garde sa slide, en tête", () => {
    const s = composerSlides({ tenueDuJour: [10, 11], occasion: "travail_formel", planAujourdhui: false, propositions: { sport: [12], soiree: [7] }, jourTravaille: false });
    expect(s.map((x) => x.id)).toEqual(["travail", "sport", "soiree"]);
    expect(s[0].source).toBe("jour");
  });
});
