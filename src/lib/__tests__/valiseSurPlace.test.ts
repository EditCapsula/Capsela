import { describe, expect, it } from "vitest";
import { coordonneesDuJour, distanceKm, DISTANCE_SUR_PLACE_KM, loinDeLaValise } from "../valiseDuJour";

/**
 * PAS SUR PLACE, PAS DE VALISE (24/11/2026, arbitré : B). Signalé : un look de spa à l'accueil à Pantin par 5°, la valise étant
 * ailleurs. Aujourd'hui, une position connue à plus de 50 km de la destination du jour : la tenue du jour revient au dressing.
 */
const PANTIN = { lat: 48.894, lon: 2.409 };
const PARIS = { lat: 48.857, lon: 2.352 };
const LISBONNE = { lat: 38.722, lon: -9.139 };
const PORTO = { lat: 41.15, lon: -8.61 };
const valise = { depart: "2026-11-20", retour: "2026-11-28", lieu: { name: "Lisbonne", country: "Portugal", ...LISBONNE } };

describe("loinDeLaValise", () => {
  it("la distance : Pantin – Paris quelques km, Pantin – Lisbonne plus de 1 400 km", () => {
    expect(distanceKm(PANTIN, PARIS)).toBeLessThan(10);
    expect(distanceKm(PANTIN, LISBONNE)).toBeGreaterThan(1400);
    expect(DISTANCE_SUR_PLACE_KM).toBe(50);
  });
  it("à Pantin pendant un séjour à Lisbonne : loin ; à Lisbonne : sur place", () => {
    expect(loinDeLaValise(valise, "2026-11-24", PANTIN)).toBe(true);
    expect(loinDeLaValise(valise, "2026-11-24", LISBONNE)).toBe(false);
  });
  it("le jour du départ et celui du retour, on voyage : la valise vaut, où que l'on soit", () => {
    expect(loinDeLaValise(valise, "2026-11-20", PANTIN)).toBe(false);
    expect(loinDeLaValise(valise, "2026-11-28", PANTIN)).toBe(false);
  });
  it("position ou coordonnées inconnues : la valise s'applique, comme avant", () => {
    expect(loinDeLaValise(valise, "2026-11-24", null)).toBe(false);
    expect(loinDeLaValise({ depart: "2026-11-20", retour: "2026-11-28" }, "2026-11-24", PANTIN)).toBe(false);
  });
  it("un road trip : la ville de l'étape du jour ; une étape sans coordonnées ne conclut rien", () => {
    const roadTrip = {
      depart: "2026-11-20",
      retour: "2026-11-28",
      etapes: [
        { destination: "Lisbonne", arrivee: "2026-11-20", ...LISBONNE },
        { destination: "Porto", arrivee: "2026-11-24", ...PORTO },
        { destination: "Coimbra", arrivee: "2026-11-26" },
      ],
    };
    expect(coordonneesDuJour(roadTrip, "2026-11-25")).toEqual(PORTO);
    expect(loinDeLaValise(roadTrip, "2026-11-25", PORTO)).toBe(false);
    expect(loinDeLaValise(roadTrip, "2026-11-22", PORTO)).toBe(true);
    expect(loinDeLaValise(roadTrip, "2026-11-27", PANTIN)).toBe(false);
  });
});
