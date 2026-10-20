import { describe, expect, it } from "vitest";
import { decalerMois, grilleDuMois, toucherJour } from "../calendrierPeriode";

/** UN SEUL CALENDRIER POUR LES DATES DU SÉJOUR (20/10/2026). */

describe("grilleDuMois", () => {
  it("octobre 2026 commence un jeudi : trois cases vides, puis le 1er ; des semaines entières", () => {
    const g = grilleDuMois(2026, 9);
    expect(g.slice(0, 4)).toEqual([null, null, null, "2026-10-01"]);
    expect(g.length % 7).toBe(0);
    expect(g.filter(Boolean)).toHaveLength(31);
    expect(g.filter(Boolean).at(-1)).toBe("2026-10-31");
  });

  it("un mois qui commence un lundi n'a pas de case vide au début", () => {
    expect(grilleDuMois(2026, 5)[0]).toBe("2026-06-01");
  });
});

describe("toucherJour", () => {
  const vide = { depart: "", retour: "" };
  it("premier toucher : le départ ; second : le retour", () => {
    const a = toucherJour(vide, "2026-10-25");
    expect(a).toEqual({ depart: "2026-10-25", retour: "" });
    expect(toucherJour(a, "2026-10-29")).toEqual({ depart: "2026-10-25", retour: "2026-10-29" });
  });

  it("un jour avant le départ devient le nouveau départ ; le même jour fait un séjour d'un jour", () => {
    const a = { depart: "2026-10-25", retour: "" };
    expect(toucherJour(a, "2026-10-22")).toEqual({ depart: "2026-10-22", retour: "" });
    expect(toucherJour(a, "2026-10-25")).toEqual({ depart: "2026-10-25", retour: "2026-10-25" });
  });

  it("une période complète, touchée à nouveau, recommence par le départ", () => {
    expect(toucherJour({ depart: "2026-10-25", retour: "2026-10-29" }, "2026-11-02")).toEqual({ depart: "2026-11-02", retour: "" });
  });
});

describe("decalerMois", () => {
  it("passe d'une année à l'autre", () => {
    expect(decalerMois(2026, 11, 1)).toEqual({ annee: 2027, mois: 0 });
    expect(decalerMois(2026, 0, -1)).toEqual({ annee: 2025, mois: 11 });
  });
});
