import { describe, expect, it } from "vitest";
import { appliquerPeriode, arriveeAuMilieu, destinationDuJour, etapeDuJour, etapesRetenues, joursParEtape, libelleItineraire, periodesDesDestinations, periodeValide, type EtapeSejour } from "../etapesSejour";

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

describe("une destination, ses dates", () => {
  it("les dates de chaque destination se lisent dans le départ, les arrivées et le retour", () => {
    expect(periodesDesDestinations("2026-11-16", "2026-11-22", ["2026-11-18", "2026-11-20"])).toEqual([
      { debut: "2026-11-16", fin: "2026-11-18" },
      { debut: "2026-11-18", fin: "2026-11-20" },
      { debut: "2026-11-20", fin: "2026-11-22" },
    ]);
    expect(periodesDesDestinations("", "", [""])).toEqual([{ debut: "", fin: "" }, { debut: "", fin: "" }]);
  });
  it("choisir les dates d'une destination déplace le départ, l'arrivée voisine ou le retour", () => {
    const etat = { depart: "2026-11-16", retour: "2026-11-22", arrivees: ["2026-11-18", "2026-11-20"] };
    expect(appliquerPeriode(etat, 0, { debut: "2026-11-15", fin: "2026-11-17" })).toEqual({ depart: "2026-11-15", retour: "2026-11-22", arrivees: ["2026-11-17", "2026-11-20"] });
    expect(appliquerPeriode(etat, 1, { debut: "2026-11-18", fin: "2026-11-21" })).toEqual({ depart: "2026-11-16", retour: "2026-11-22", arrivees: ["2026-11-18", "2026-11-21"] });
    expect(appliquerPeriode(etat, 2, { debut: "2026-11-20", fin: "2026-11-24" })).toEqual({ depart: "2026-11-16", retour: "2026-11-24", arrivees: ["2026-11-18", "2026-11-20"] });
  });
  it("une destination ajoutée partage les dates de la dernière ; trop courtes : ses dates restent à choisir", () => {
    const jours = (a: string, b: string) => {
      const out: string[] = [];
      for (let d = new Date(`${a}T12:00:00`); d <= new Date(`${b}T12:00:00`); d.setDate(d.getDate() + 1)) out.push(d.toISOString().slice(0, 10));
      return out;
    };
    expect(arriveeAuMilieu({ debut: "2026-11-16", fin: "2026-11-22" }, jours)).toBe("2026-11-19");
    expect(arriveeAuMilieu({ debut: "2026-11-16", fin: "2026-11-17" }, jours)).toBe("");
    expect(periodeValide({ debut: "2026-11-17", fin: "2026-11-17" })).toBe(false);
  });
});
