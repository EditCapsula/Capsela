import { describe, expect, it } from "vitest";
import { libelleMembreDepuis, moisAnneeInscription } from "../membreDepuis";

describe("libelleMembreDepuis", () => {
  it("dit le mois et l'année d'inscription", () => {
    expect(libelleMembreDepuis("2026-10-15T12:00:00Z")).toBe("Membre depuis octobre 2026");
    expect(libelleMembreDepuis("2025-08-10T12:00:00.000000+00:00")).toBe("Membre depuis août 2025");
  });

  it("ne dit rien sans date lisible", () => {
    expect(libelleMembreDepuis(null)).toBeNull();
    expect(libelleMembreDepuis(undefined)).toBeNull();
    expect(libelleMembreDepuis("")).toBeNull();
    expect(libelleMembreDepuis("pas une date")).toBeNull();
  });
});

describe("moisAnneeInscription", () => {
  it("dit le mois et l'année seuls, ou rien", () => {
    expect(moisAnneeInscription("2026-08-10T12:00:00Z")).toBe("août 2026");
    expect(moisAnneeInscription(null)).toBeNull();
    expect(moisAnneeInscription("pas une date")).toBeNull();
  });
});
