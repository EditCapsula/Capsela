import { describe, expect, it } from "vitest";
import { composerSlides, slideDeLOccasion } from "../carrousel";

const propositions = { travail: [1, 2, 3], quotidien: [4, 5, 6], soiree: [7, 8, 9] };

describe("slideDeLOccasion", () => {
  it("rattache les occasions du store aux trois slides, et rien d'autre", () => {
    expect(slideDeLOccasion("travail_formel")).toBe("travail");
    expect(slideDeLOccasion("quotidien")).toBe("quotidien");
    expect(slideDeLOccasion("soiree")).toBe("soiree");
    expect(slideDeLOccasion("date")).toBe("soiree");
    expect(slideDeLOccasion("sport")).toBeNull();
    expect(slideDeLOccasion("all")).toBeNull();
    expect(slideDeLOccasion(null)).toBeNull();
  });
});

describe("composerSlides", () => {
  it("garde l'ordre travail, quotidien, soirée, avec la tenue du jour sur la slide de son occasion", () => {
    const s = composerSlides({ tenueDuJour: [10, 11, 12], occasion: "quotidien", planAujourdhui: false, propositions });
    expect(s.map((x) => x.id)).toEqual(["travail", "quotidien", "soiree"]);
    expect(s[1]).toMatchObject({ ids: [10, 11, 12], source: "jour" });
    expect(s[0]).toMatchObject({ ids: [1, 2, 3], source: "proposition" });
    expect(s[2]).toMatchObject({ ids: [7, 8, 9], source: "proposition" });
  });

  it("une tenue planifiée prend la première slide, quelle que soit son occasion, et garde l'occasion du plan", () => {
    const s = composerSlides({ tenueDuJour: [20, 21], occasion: "soiree", planAujourdhui: true, propositions });
    expect(s[0]).toMatchObject({ id: "travail", ids: [20, 21], source: "plan", occasion: "soiree" });
    expect(s.slice(1).map((x) => x.id)).toEqual(["quotidien", "soiree"]);
    expect(s.slice(1).every((x) => x.source === "proposition")).toBe(true);
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

  it("une occasion hors carrousel (sport) ne montre que les propositions", () => {
    const s = composerSlides({ tenueDuJour: [10], occasion: "sport", planAujourdhui: false, propositions });
    expect(s.map((x) => x.source)).toEqual(["proposition", "proposition", "proposition"]);
  });

  it("sans tenue du jour, ni propositions : aucune slide", () => {
    expect(composerSlides({ tenueDuJour: [], occasion: "quotidien", planAujourdhui: false, propositions: {} })).toEqual([]);
  });
});
