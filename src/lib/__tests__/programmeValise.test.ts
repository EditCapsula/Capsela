import { describe, expect, it } from "vitest";
import {
  borneFrequence,
  couvertureMeteo,
  elementProgramme,
  frequenceAjoutee,
  libelleFrequence,
  occasionsDuProgramme,
  occasionsProposees,
  plafondFrequence,
  programmeDepuisOccasions,
  programmeParDefaut,
  SOUS_OCCASIONS,
  TOUS_LES_ELEMENTS,
} from "../programmeValise";
import { OCCASIONS } from "../data";

describe("programmeValise — des sous-occasions rattachées aux occasions de Capsela", () => {
  it("les dix occasions de Capsela sont toutes proposées, aucune retirée", () => {
    for (const [k] of OCCASIONS.filter(([x]) => x !== "all")) expect(elementProgramme(k)?.generique).toBe(true);
  });

  it("chaque sous-occasion a une occasion mère qui existe — jamais une nouvelle clé", () => {
    const cles = OCCASIONS.map(([k]) => k);
    for (const s of SOUS_OCCASIONS) expect(cles).toContain(s.mere);
  });

  it("les rattachements arbitrés : plage et piscine → quotidien (chaleur), spa → cocooning, restaurant → sortie / soirée, randonnée → sport", () => {
    expect(elementProgramme("plage")).toMatchObject({ mere: "quotidien", contrainte: "chaleur" });
    expect(elementProgramme("piscine")).toMatchObject({ mere: "quotidien", contrainte: "chaleur" });
    expect(elementProgramme("spa")?.mere).toBe("cocooning");
    expect(elementProgramme("restaurant")?.mere).toBe("soiree");
    expect(elementProgramme("randonnee")).toMatchObject({ mere: "sport", contrainte: "outdoor" });
    expect(elementProgramme("trajet")?.mere).toBe("voyage");
  });

  it("aucun identifiant en double", () => {
    const ids = TOUS_LES_ELEMENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("les occasions mères d'un programme : sans doublon, dans l'ordre", () => {
    expect(occasionsDuProgramme([{ id: "visites", frequence: 5 }, { id: "plage", frequence: 2 }, { id: "restaurant", frequence: 3 }, { id: "trajet", frequence: 2 }])).toEqual([
      "quotidien",
      "soiree",
      "voyage",
    ]);
  });
});

describe("fréquences — bornées par le créneau, pas par la somme", () => {
  it("un jour ou un soir : au plus les jours du séjour ; un trajet : deux au plus", () => {
    expect(plafondFrequence("jour", 10)).toBe(10);
    expect(plafondFrequence("soir", 10)).toBe(10);
    expect(plafondFrequence("trajet", 10)).toBe(2);
    expect(plafondFrequence("trajet", 1)).toBe(1);
  });
  it("une fréquence se borne à 1 au minimum et au plafond du créneau", () => {
    expect(borneFrequence(0, "jour", 10)).toBe(1);
    expect(borneFrequence(14, "jour", 10)).toBe(10);
    expect(borneFrequence(5, "trajet", 10)).toBe(2);
  });
  it("accordée", () => {
    expect(libelleFrequence("jour", 1)).toBe("1 jour");
    expect(libelleFrequence("jour", 5)).toBe("5 jours");
    expect(libelleFrequence("soir", 3)).toBe("3 soirs");
    expect(libelleFrequence("trajet", 2)).toBe("2 trajets");
  });
  it("les fréquences peuvent se chevaucher : leur somme dépasse la durée sans être refusée", () => {
    const p = programmeParDefaut("plage", 10);
    const joursDActivite = p.filter((x) => elementProgramme(x.id)?.creneau === "jour").reduce((s, x) => s + x.frequence, 0);
    expect(joursDActivite).toBeGreaterThan(0);
    for (const x of p) expect(x.frequence).toBeLessThanOrEqual(plafondFrequence(elementProgramme(x.id)!.creneau, 10));
  });
});

describe("programmeParDefaut — Capsela propose", () => {
  it("plage / resort sur 10 jours : visites, plage, piscine, restaurant et trajet", () => {
    const p = programmeParDefaut("plage", 10);
    expect(p.map((x) => x.id)).toEqual(["visites", "plage", "piscine", "restaurant", "trajet"]);
    expect(p.find((x) => x.id === "visites")?.frequence).toBe(4);
    expect(p.find((x) => x.id === "trajet")?.frequence).toBe(2);
  });
  it("un séjour d'un jour : toutes les fréquences restent à 1 au moins, aucun plafond dépassé", () => {
    for (const x of programmeParDefaut("city_break", 1)) {
      expect(x.frequence).toBeGreaterThanOrEqual(1);
      expect(x.frequence).toBeLessThanOrEqual(1);
    }
  });
  it("chaque type de séjour propose au moins une occasion", () => {
    for (const t of ["plage", "city_break", "nature", "week_end", "professionnel", "road_trip", "evenement", "montagne", "detente", "multi_activites", "autre"] as const) {
      expect(programmeParDefaut(t, 7).length).toBeGreaterThan(0);
    }
  });
  it("les occasions proposées en second ne reprennent pas ce qui est déjà retenu", () => {
    const p = programmeParDefaut("plage", 10);
    const propo = occasionsProposees("plage", p).map((e) => e.id);
    expect(propo).toEqual(["soiree", "sport", "shopping"]);
    expect(occasionsProposees("plage", [...p, { id: "sport", frequence: 1 }]).map((e) => e.id)).toEqual(["soiree", "shopping"]);
  });
  it("une occasion ajoutée à la main : un créneau, ou deux trajets", () => {
    expect(frequenceAjoutee(elementProgramme("sport")!, 10)).toBe(1);
    expect(frequenceAjoutee(elementProgramme("trajet")!, 10)).toBe(2);
  });
  it("une ancienne valise (occasions seules) retrouve un programme sans fréquence inventée", () => {
    expect(programmeDepuisOccasions(["quotidien", "soiree"], 7)).toEqual([{ id: "quotidien", frequence: 1 }, { id: "soiree", frequence: 1 }]);
  });
});

describe("couvertureMeteo — ce que la météo connaît du séjour", () => {
  const m = (jour: string, prevue: boolean) => ({ jour, temp: 20, label: "Ensoleillé", prevue });
  it("20–23 oct. prévus, 24–29 oct. sans prévision", () => {
    const meteos = ["20", "21", "22", "23"].map((d) => m(`2026-10-${d}`, true)).concat(["24", "25", "26", "27", "28", "29"].map((d) => m(`2026-10-${d}`, false)));
    expect(couvertureMeteo(meteos)).toEqual({ avecPrevision: ["20–23 oct."], sansPrevision: ["24–29 oct."] });
  });
  it("aucune prévision : tout est sans prévision, jamais une plage prévue", () => {
    expect(couvertureMeteo([m("2026-10-20", false), m("2026-10-21", false)])).toEqual({ avecPrevision: [], sansPrevision: ["20–21 oct."] });
  });
  it("un séjour à cheval sur deux mois", () => {
    expect(couvertureMeteo([m("2026-09-30", true), m("2026-10-01", true)]).avecPrevision).toEqual(["30 sept. – 1 oct."]);
  });
});
