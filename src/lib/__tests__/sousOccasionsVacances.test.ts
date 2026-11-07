import { describe, expect, it } from "vitest";
import { sousOccasionDuChoix, sousOccasionDuLibelle } from "../activitesSejour";
import { elementProgramme, programmeDesChoix, SOUS_OCCASIONS_VACANCES } from "../programmeValise";

/** LES SOUS-OCCASIONS VACANCES (07/11/2026, brief « Création de l'occasion Vacances »). */
describe("une activité concrète, une sous-occasion", () => {
  it("le séjour à Pékin du brief", () => {
    const pekin: [string, string][] = [
      ["Visiter le Palais d'Été", "visites"],
      ["Explorer les hutongs", "visites"],
      ["Visiter un musée", "visites"],
      ["Marché de rue", "shopping"],
      ["Se promener sur la Grande Muraille", "randonnee"],
      ["Balade en bateau", "excursion"],
      ["Assister à un spectacle d'opéra", "restaurant"],
      ["Se détendre dans un spa traditionnel", "spa"],
    ];
    for (const [libelle, attendu] of pekin) expect([libelle, sousOccasionDuLibelle(libelle)]).toEqual([libelle, attendu]);
  });

  it("un marché n'est pas une marche, et l'inverse", () => {
    expect(sousOccasionDuLibelle("Faire le marché")).toBe("shopping");
    expect(sousOccasionDuLibelle("Marché nocturne")).toBe("shopping");
    expect(sousOccasionDuLibelle("Marche dans la forêt")).toBe("balade");
    expect(sousOccasionDuLibelle("Une longue marche")).toBe("randonnee");
  });

  it("sans mot reconnu, l'activité du choix ; sans rien, aucune", () => {
    expect(sousOccasionDuChoix({ libelle: "Journée libre à Hoi An", activite: "ville" })).toBe("visites");
    expect(sousOccasionDuChoix({ libelle: "Moment pour soi", activite: "detente" })).toBe("detente");
    expect(sousOccasionDuChoix({ libelle: "Rien de précis", activite: null })).toBeNull();
  });

  it("les dix sous-occasions existent dans le programme, chacune avec sa mère du moteur", () => {
    expect(SOUS_OCCASIONS_VACANCES).toHaveLength(10);
    const meres = Object.fromEntries(SOUS_OCCASIONS_VACANCES.map((v) => [v.id, elementProgramme(v.id)?.mere]));
    expect(meres).toEqual({
      visites: "quotidien",
      randonnee: "sport",
      plage: "quotidien",
      piscine: "quotidien",
      spa: "cocooning",
      shopping: "quotidien",
      excursion: "quotidien",
      restaurant: "soiree",
      activite_sportive: "sport",
      detente: "cocooning",
    });
  });
});

describe("programmeDesChoix : une entrée par sous-occasion, jamais une par activité", () => {
  it("trois visites font UNE entrée, d'au moins trois jours ; le trajet s'ajoute", () => {
    const p = programmeDesChoix([{ sousId: "visites" }, { sousId: "visites" }, { sousId: "visites" }, { sousId: "spa" }], 8);
    expect(p.map((x) => x.id)).toEqual(["visites", "spa", "trajet"]);
    expect(p.find((x) => x.id === "visites")!.frequence).toBe(3);
    expect(p.find((x) => x.id === "spa")!.frequence).toBe(2);
  });

  it("les jours datés priment ; bornés par le séjour", () => {
    const jours = ["2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"];
    expect(programmeDesChoix([{ sousId: "plage", jours }], 4).find((x) => x.id === "plage")!.frequence).toBe(4);
    expect(programmeDesChoix([{ sousId: "plage", jours: [...jours, "2026-11-28"] }], 4).find((x) => x.id === "plage")!.frequence).toBe(4);
  });

  it("aucune activité rattachée : le quotidien, comme avant", () => {
    expect(programmeDesChoix([{ sousId: null }], 5).map((x) => x.id)).toEqual(["quotidien"]);
  });
});
