import { describe, expect, it } from "vitest";
import { destinationDuJour, etapeDuJour, etapesRetenues, joursParEtape, libelleItineraire, type EtapeSejour } from "../etapesSejour";

/** LES ÉTAPES D'UN ROAD TRIP (30/10/2026) : dates par étape, chaque jour à une seule ville. */

const JOURS = ["2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09"];
const porto: EtapeSejour = { destination: "Porto", arrivee: "2026-11-07", lat: 41.15, lon: -8.61 };
const faro: EtapeSejour = { destination: "Faro", arrivee: "2026-11-09" };

describe("etapesRetenues", () => {
  it("la première au départ, puis les autres dans l'ordre de leur arrivée", () => {
    const e = etapesRetenues({ destination: "Lisbonne" }, [faro, porto], JOURS[0], JOURS[4]);
    expect(e.map((x) => [x.destination, x.arrivee])).toEqual([
      ["Lisbonne", "2026-11-05"],
      ["Porto", "2026-11-07"],
      ["Faro", "2026-11-09"],
    ]);
  });
  it("écarte une étape sans ville, hors du séjour, ou arrivant le jour du départ ; deux arrivées le même jour : la dernière", () => {
    const madrid: EtapeSejour = { destination: "Madrid", arrivee: "2026-11-07" };
    const e = etapesRetenues(
      { destination: "Lisbonne" },
      [porto, madrid, { destination: "", arrivee: "2026-11-06" }, { destination: "Séville", arrivee: "2026-11-12" }, { destination: "Sintra", arrivee: "2026-11-05" }],
      JOURS[0],
      JOURS[4]
    );
    expect(e.map((x) => x.destination)).toEqual(["Lisbonne", "Madrid"]);
  });
});

describe("chaque jour à une seule ville", () => {
  const etapes = etapesRetenues({ destination: "Lisbonne" }, [porto, faro], JOURS[0], JOURS[4]);
  it("le jour du trajet appartient à la ville d'arrivée", () => {
    expect(etapeDuJour(etapes, "2026-11-06")?.destination).toBe("Lisbonne");
    expect(etapeDuJour(etapes, "2026-11-07")?.destination).toBe("Porto");
  });
  it("les jours groupés par étape, dans l'ordre, sans en perdre un", () => {
    const g = joursParEtape(etapes, JOURS);
    expect(g.map((x) => [x.etape.destination, x.jours.length])).toEqual([
      ["Lisbonne", 2],
      ["Porto", 2],
      ["Faro", 1],
    ]);
    expect(g.flatMap((x) => x.jours)).toEqual(JOURS);
  });
  it("l'itinéraire et la ville d'un jour d'une valise", () => {
    expect(libelleItineraire(etapes)).toBe("Lisbonne → Porto → Faro");
    const v = { destination: libelleItineraire(etapes), etapes };
    expect(destinationDuJour(v, "2026-11-08")).toBe("Porto");
    expect(destinationDuJour({ destination: "Rome" }, "2026-11-08")).toBe("Rome");
  });
});
