import { describe, expect, it } from "vitest";
import {
  echeanceLongue,
  groupesParMois,
  jourDecale,
  joursAutour,
  libelleMoisAnnee,
  marqueDuJour,
  momentsLibres,
  planificationsParJour,
} from "../agendaLooks";
import type { TenuePlanifiee } from "../planifier";
import type { ValiseGardee } from "../valises";

// L'AGENDA DE PLANIFIER (17/10/2026) : calendrier, jour, liste — les marques suivent les planifications réelles.
const tenue = (id: string, jour: string, moment: TenuePlanifiee["moment"] = "Soirée"): TenuePlanifiee => ({
  id, jour, moment, occasion: "soiree", sousChoix: null, lieu: "Paris", typeLieu: null, dressingSeul: false, pieceIds: [1, 2], temp: null, weatherLabel: null,
});
const valise = (id: string, depart: string, retour: string) => ({ id, destination: "Rome", depart, retour, looks: [], occasions: [] }) as unknown as ValiseGardee;

describe("jourDecale", () => {
  it("passe les fins de mois et d'année, en jour local", () => {
    expect(jourDecale("2026-10-31", 1)).toBe("2026-11-01");
    expect(jourDecale("2026-12-31", 1)).toBe("2027-01-01");
    expect(jourDecale("2026-03-01", -1)).toBe("2026-02-28");
    // Changement d'heure (25/10/2026 en France) : pas de jour sauté ni doublé.
    expect(jourDecale("2026-10-24", 2)).toBe("2026-10-26");
  });
});

describe("planificationsParJour et marqueDuJour", () => {
  const parJour = planificationsParJour(
    [tenue("a", "2026-10-20", "Soirée"), tenue("b", "2026-10-20", "Matin"), tenue("c", "2026-10-21")],
    [valise("v", "2026-10-24", "2026-10-26")]
  );
  it("un jour à deux looks est « plusieurs », dans l'ordre des moments", () => {
    expect(marqueDuJour(parJour.get("2026-10-20"))).toEqual({ looks: "plusieurs", voyage: false });
    expect(parJour.get("2026-10-20")!.tenues.map((t) => t.moment)).toEqual(["Matin", "Soirée"]);
  });
  it("un jour à un look est « un » ; un jour sans rien, « aucun »", () => {
    expect(marqueDuJour(parJour.get("2026-10-21")).looks).toBe("un");
    expect(marqueDuJour(parJour.get("2026-10-22"))).toEqual({ looks: "aucun", voyage: false });
  });
  it("une valise marque chaque jour de son séjour, sans compter comme un look", () => {
    for (const j of ["2026-10-24", "2026-10-25", "2026-10-26"]) expect(marqueDuJour(parJour.get(j))).toEqual({ looks: "aucun", voyage: true });
    expect(parJour.has("2026-10-27")).toBe(false);
  });
  it("une valise au retour avant le départ ne marque que son départ", () => {
    const p = planificationsParJour([], [valise("w", "2026-11-03", "2026-11-01")]);
    expect([...p.keys()]).toEqual(["2026-11-03"]);
  });
});

describe("joursAutour et momentsLibres", () => {
  it("le jour choisi au centre", () => {
    expect(joursAutour("2026-10-20")).toEqual(["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);
  });
  it("les moments déjà pris ne sont plus proposés", () => {
    expect(momentsLibres([{ moment: "Soirée" }, { moment: "Matin" }])).toEqual(["Toute la journée", "Après-midi"]);
  });
});

describe("groupesParMois et libellés", () => {
  it("groupe dans l'ordre reçu, une valise sur son départ", () => {
    const g = groupesParMois([
      { type: "tenue", tenue: tenue("a", "2026-10-20") },
      { type: "valise", valise: valise("v", "2026-10-31", "2026-11-02") },
      { type: "tenue", tenue: tenue("b", "2026-11-03") },
    ]);
    expect(g.map((x) => [x.libelle, x.items.length])).toEqual([["Octobre 2026", 2], ["Novembre 2026", 1]]);
    expect(libelleMoisAnnee("2027-01-05")).toBe("Janvier 2027");
  });
  it("l'échéance ne dit rien d'un jour passé", () => {
    expect(echeanceLongue("2026-10-19", "2026-10-17")).toBe("Dans 2 jours");
    expect(echeanceLongue("2026-10-18", "2026-10-17")).toBe("Demain");
    expect(echeanceLongue("2026-10-16", "2026-10-17")).toBeNull();
  });
});
