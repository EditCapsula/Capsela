import { describe, expect, it } from "vitest";
import { evenementsDuSejour, libelleEvenement, situationsDesEvenements, sousIdEvenement, type EvenementValise } from "../evenementsValise";
import { planningDeLaValise, planningDuProgramme } from "../planningValise";
import { situationsDuProgramme, type MeteoJour } from "../valise";
import { looksValiseDuJour } from "../valiseDuJour";
import type { ValiseGardee } from "../valises";
import type { Item } from "../types";

/** LES ÉVÉNEMENTS DATÉS D'UNE VALISE (22/10/2026). */

const JOURS = ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"];
const meteos: MeteoJour[] = JOURS.map((jour, i) => ({ jour, temp: 18 + i * 4, label: "Ensoleillé", prevue: false }));
const mariage: EvenementValise = { id: "m", type: "ceremonie", jour: "2026-10-25", moment: "soir", nom: "Mariage de Léa" };
const reunion: EvenementValise = { id: "r", type: "travail_reunion", jour: "2026-10-26", moment: "jour" };
const horsSejour: EvenementValise = { id: "h", type: "diner", jour: "2026-11-02", moment: "soir" };

describe("evenementsDuSejour", () => {
  it("garde ceux du séjour, dans l'ordre (jour, puis journée avant soirée) ; ignore un jour hors séjour ou un type inconnu", () => {
    const soirMemeJour: EvenementValise = { id: "s", type: "diner", jour: "2026-10-26", moment: "soir" };
    const inconnu: EvenementValise = { id: "x", type: "inexistant", jour: "2026-10-25", moment: "jour" };
    expect(evenementsDuSejour([soirMemeJour, horsSejour, reunion, mariage, inconnu], JOURS).map((e) => e.id)).toEqual(["m", "r", "s"]);
    expect(evenementsDuSejour(undefined, JOURS)).toEqual([]);
  });
});

describe("libelleEvenement", () => {
  it("son nom s'il en a un, sinon son type", () => {
    expect(libelleEvenement(mariage)).toBe("Mariage de Léa");
    expect(libelleEvenement(reunion)).toBe("Réunion · travail");
    expect(libelleEvenement({ type: "diner", nom: "   " })).toBe("Dîner");
  });
});

describe("situationsDesEvenements", () => {
  it("une situation par événement : son occasion mère, la météo de son seul jour, son sous-identifiant", () => {
    const s = situationsDesEvenements([mariage, reunion, horsSejour], meteos);
    expect(s).toHaveLength(2);
    expect(s[0]).toMatchObject({ occasion: "evenement_perso", jours: ["2026-10-25"], sousIds: [sousIdEvenement(mariage)] });
    expect(s[0].meteo.temp).toBe(22);
    expect(s[1]).toMatchObject({ occasion: "travail_formel", jours: ["2026-10-26"], sousIds: ["evt:r"] });
  });
});

describe("le planning place les événements à leur jour et leur moment", () => {
  const programme = [{ id: "diner", frequence: 4 }, { id: "visites", frequence: 2 }];
  const situations = [...situationsDuProgramme(programme, meteos, ["quotidien"]), ...situationsDesEvenements([mariage], meteos)];
  const iMariage = situations.findIndex((s) => s.sousIds?.includes("evt:m"));
  const iDiner = situations.findIndex((s) => s.sousIds?.includes("diner"));
  const looks = [
    { ids: [1, 2], situations: [iDiner], elargie: false },
    { ids: [3, 4], situations: [iMariage], elargie: false },
  ];

  it("le mariage tombe le 25 au soir, avec le look qui lui répond, distingué des activités", () => {
    const plan = planningDuProgramme(programme, JOURS, situations, looks, [mariage]);
    const ev = plan.filter((c) => c.evenement);
    expect(ev).toEqual([{ jour: "2026-10-25", creneau: "soir", sousId: "evt:m", libelle: "Mariage de Léa", look: 1, evenement: true }]);
  });

  it("les activités étalées évitent son créneau quand elles le peuvent", () => {
    const plan = planningDuProgramme([{ id: "diner", frequence: 3 }], JOURS, situations, looks, [mariage]);
    expect(plan.filter((c) => c.sousId === "diner").map((c) => c.jour)).not.toContain("2026-10-25");
  });

  it("sans événement : le planning d'avant, inchangé", () => {
    const sansSituationEvt = situationsDuProgramme(programme, meteos, ["quotidien"]);
    expect(planningDuProgramme(programme, JOURS, sansSituationEvt, looks.slice(0, 1))).toEqual(planningDuProgramme(programme, JOURS, sansSituationEvt, looks.slice(0, 1), []));
  });
});

describe("la tenue du jour reprend l'événement pendant le séjour", () => {
  const piece = (id: number, cat: Item["cat"]): Item => ({ id, cat, name: `P${id}`, hex: "#000", color: "Noir", season: "Toutes saisons", worn: 0 }) as Item;
  const pool = [piece(1, "haut"), piece(2, "pantalon"), piece(3, "chaussures"), piece(4, "sac"), piece(5, "robe"), piece(6, "chaussures")];
  const programme = [{ id: "visites", frequence: 4 }];
  const situations = [...situationsDuProgramme(programme, meteos, ["quotidien"]), ...situationsDesEvenements([mariage], meteos)];
  const v: ValiseGardee = {
    version: 2,
    id: "v1",
    destination: "Lisbonne",
    depart: JOURS[0],
    retour: JOURS[3],
    bagage: "M",
    sejour: null,
    occasions: ["quotidien", "evenement_perso"],
    meteos,
    situations,
    pieceIds: [1, 2, 3, 4, 5, 6],
    looks: [
      { ids: [1, 2, 3, 4], situations: situations.map((_, i) => i).filter((i) => situations[i].occasion === "quotidien"), elargie: false },
      { ids: [5, 6, 4], situations: [situations.length - 1], elargie: false },
    ],
    situationsSansLook: [],
    programme,
    evenements: [mariage],
  };

  it("le 25, le look du mariage est le plan du soir, avec l'occasion de l'événement", () => {
    const r = looksValiseDuJour(v, "2026-10-25", pool);
    expect(r.soir).toMatchObject({ moment: "Soirée", occasion: "evenement_perso", pieceIds: [5, 6, 4] });
    expect(looksValiseDuJour(v, "2026-10-24", pool).soir).toBeNull();
  });

  it("une valise sans programme mais avec un événement a un planning", () => {
    expect(planningDeLaValise({ ...v, programme: undefined }, JOURS, v.looks).map((c) => c.sousId)).toEqual(["evt:m"]);
  });
});

describe("les autres créneaux évitent le look d'un événement quand un autre look leur répond", () => {
  const programme = [{ id: "diner", frequence: 3 }];
  const situations = [...situationsDuProgramme(programme, meteos, ["quotidien"]), ...situationsDesEvenements([mariage], meteos)];
  const iMariage = situations.findIndex((s) => s.sousIds?.includes("evt:m"));
  // La météo varie d'un jour à l'autre : le dîner a une situation par groupe de météo.
  const diners = situations.flatMap((s, i) => (s.sousIds?.includes("diner") ? [i] : []));

  it("deux looks du soir : le mariage garde le sien, les dîners prennent l'autre", () => {
    const looks = [
      { ids: [1, 2], situations: [...diners, iMariage], elargie: false },
      { ids: [3, 4], situations: diners, elargie: false },
    ];
    const plan = planningDuProgramme(programme, JOURS, situations, looks, [mariage]);
    const lookMariage = plan.find((c) => c.evenement)!.look;
    expect(plan.filter((c) => c.sousId === "diner").every((c) => c.look !== lookMariage)).toBe(true);
  });

  it("un seul look du soir : partagé, jamais retiré aux dîners", () => {
    const looks = [{ ids: [1, 2], situations: [...diners, iMariage], elargie: false }];
    const plan = planningDuProgramme(programme, JOURS, situations, looks, [mariage]);
    expect(plan.every((c) => c.look === 0)).toBe(true);
  });
});

describe("le type « Autre »", () => {
  it("prend l'occasion Quotidien, la plus neutre, et se lit « Autre » sans nom", () => {
    const autre: EvenementValise = { id: "a", type: "quotidien", jour: "2026-10-24", moment: "jour" };
    expect(situationsDesEvenements([autre], meteos)[0]).toMatchObject({ occasion: "quotidien", sousIds: ["evt:a"] });
    expect(libelleEvenement(autre)).toBe("Autre");
  });
});
