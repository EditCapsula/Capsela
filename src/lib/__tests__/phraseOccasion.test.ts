import { describe, expect, it } from "vitest";
import { DATE_CONTEXTS, OCCASIONS, WORK_MODES } from "../data";
import { libelleDeclencheur, phraseOccasion } from "../phraseOccasion";
import type { TravelMode } from "../types";

const SOUS = { workMode: "Présentiel" as const, dateContext: "Verre" as const, travelMode: "Court trajet" as const };

describe("phraseOccasion — la ligne sous les onglets de Tenue", () => {
  it("une phrase pour chaque occasion du référentiel, aucune pour « all »", () => {
    for (const [key] of OCCASIONS) {
      const p = phraseOccasion(key, SOUS);
      expect(p?.debut, key).toBeTruthy();
      expect(p?.fin, key).toBeTruthy();
    }
    expect(phraseOccasion("all", SOUS)).toBeNull();
  });

  it("une phrase pour chaque sous-occasion, distincte des autres de la même occasion", () => {
    const travail = WORK_MODES.map((workMode) => phraseOccasion("travail_formel", { ...SOUS, workMode })?.fin);
    const date = DATE_CONTEXTS.map(([dateContext]) => phraseOccasion("date", { ...SOUS, dateContext })?.fin);
    const voyage = (["Court trajet", "Longue distance"] as TravelMode[]).map((travelMode) => phraseOccasion("voyage", { ...SOUS, travelMode })?.fin);
    for (const liste of [travail, date, voyage]) {
      expect(liste.every(Boolean)).toBe(true);
      expect(new Set(liste).size).toBe(liste.length);
    }
  });

  it("les exemples du brief", () => {
    expect(phraseOccasion("travail_formel", SOUS)).toEqual({ debut: "Une journée", fin: "au bureau" });
    expect(phraseOccasion("travail_formel", { ...SOUS, workMode: "Télétravail" })).toEqual({ debut: "Une journée", fin: "en télétravail" });
    expect(phraseOccasion("date", SOUS)).toEqual({ debut: "Un rendez-vous", fin: "autour d'un verre" });
    expect(phraseOccasion("date", { ...SOUS, dateContext: "Restaurant / date romantique" })).toEqual({ debut: "Un dîner", fin: "en tête-à-tête" });
  });

  it("le déclencheur garde la première partie d'un libellé composé", () => {
    expect(libelleDeclencheur("Restaurant / date romantique")).toBe("Restaurant");
    expect(libelleDeclencheur("Cinéma / balade")).toBe("Cinéma");
    expect(libelleDeclencheur("Télétravail")).toBe("Télétravail");
  });
});
