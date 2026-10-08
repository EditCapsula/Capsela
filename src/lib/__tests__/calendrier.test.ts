import { describe, expect, it } from "vitest";
import { AVENIR_JOURS, AVENIR_MAX, RECENTES_MAX, dateCourte, dateMoyenne, historiqueParMois, joursPassesAvecTenue, vueListe, grilleDuMois, grilleDuMoisComplete, jourAbrege, joursDeLaSemaine, numeroDeSemaine, joursRestantsDeLaSemaine, listeDeLaSemaine, listeDuCalendrier, lundiDe, moisDecale, tenueDuCalendrier } from "../calendrier";
import type { TenuePlanifiee } from "../planifier";
import type { HistoryEntry } from "../types";

const AUJ = "2026-10-10";
const plan = (jour: string, pieceIds = [1, 2], over: Partial<TenuePlanifiee> = {}): TenuePlanifiee => ({
  id: `p-${jour}`,
  jour,
  moment: "Soirée",
  occasion: "soiree",
  sousChoix: null,
  lieu: "Paris",
  typeLieu: null,
  dressingSeul: true,
  pieceIds,
  temp: 18,
  weatherLabel: "Nuageux",
  ...over,
});
const porte = (jour: string, pieceIds = [3, 4]): HistoryEntry => ({ id: `h-${jour}`, ts: new Date(`${jour}T12:00:00`).getTime(), pieceIds, occasion: "quotidien", temp: 15, weatherLabel: "Ciel dégagé" });
const proposee = { pieceIds: [7, 8], occasion: "travail_formel" as const };

describe("tenueDuCalendrier", () => {
  it("passé avec historique : portée ; passé avec seulement un plan : planifiée, jamais déduite portée", () => {
    expect(tenueDuCalendrier("2026-10-08", AUJ, [porte("2026-10-08")], [], null)).toMatchObject({ statut: "porte", pieceIds: [3, 4], temp: 15 });
    expect(tenueDuCalendrier("2026-10-07", AUJ, [], [plan("2026-10-07")], null)).toMatchObject({ statut: "planifiee", pieceIds: [1, 2] });
  });
  it("aujourd'hui : le plan du jour d'abord, sinon la tenue proposée, sinon rien", () => {
    expect(tenueDuCalendrier(AUJ, AUJ, [], [plan(AUJ)], proposee)).toMatchObject({ statut: "du_jour", pieceIds: [1, 2] });
    expect(tenueDuCalendrier(AUJ, AUJ, [], [], proposee)).toMatchObject({ statut: "du_jour", pieceIds: [7, 8], plan: null });
    expect(tenueDuCalendrier(AUJ, AUJ, [], [], null)).toBeNull();
  });
  it("futur : seulement les plans ; la tenue proposée n'y est jamais projetée", () => {
    expect(tenueDuCalendrier("2026-10-14", AUJ, [], [plan("2026-10-14")], proposee)).toMatchObject({ statut: "planifiee" });
    expect(tenueDuCalendrier("2026-10-15", AUJ, [], [], proposee)).toBeNull();
  });
  it("un plan sans pièce ne compte pas", () => {
    expect(tenueDuCalendrier("2026-10-14", AUJ, [], [plan("2026-10-14", [])], null)).toBeNull();
  });
});

describe("grilles", () => {
  it("octobre 2026 : lundi d'abord, le 1er est un jeudi, 31 jours, cases hors mois nulles", () => {
    const g = grilleDuMois(2026, 9);
    expect(g.every((s) => s.length === 7)).toBe(true);
    expect(g[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(g.flat().filter(Boolean)).toHaveLength(31);
    expect(g[g.length - 1].filter(Boolean).pop()).toBe("2026-10-31");
  });
  it("un mois qui commence un lundi n'a pas de case vide en tête", () => {
    expect(grilleDuMois(2026, 5)[0][0]).toBe("2026-06-01");
  });
  it("la semaine : lundi à dimanche autour d'un jour", () => {
    expect(lundiDe("2026-10-10")).toBe("2026-10-05");
    expect(joursDeLaSemaine("2026-10-10")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(joursDeLaSemaine("2026-10-11")[0]).toBe("2026-10-05");
  });
  it("navigation de mois : à cheval sur l'année", () => {
    expect(moisDecale("2026-10-10", 1)).toBe("2026-11-01");
    expect(moisDecale("2026-01-20", -1)).toBe("2025-12-01");
  });
});

describe("listeDuCalendrier", () => {
  it("à venir (aujourd'hui compris) puis passées, chacune dans son ordre", () => {
    const maintenant = new Date(2026, 9, 10, 12);
    const l = listeDuCalendrier(AUJ, [porte("2026-10-08"), porte("2026-10-03")], [plan("2026-10-14"), plan("2026-10-12")], proposee, maintenant);
    expect(l.avenir.map((t) => t.jour)).toEqual([AUJ, "2026-10-12", "2026-10-14"]);
    expect(l.passees.map((t) => t.jour)).toEqual(["2026-10-08", "2026-10-03"]);
  });
  it("calendrier libre : deux listes vides", () => {
    const l = listeDuCalendrier(AUJ, [], [], null, new Date(2026, 9, 10, 12));
    expect(l).toEqual({ avenir: [], passees: [] });
  });
});

describe("Mon planning — mois complet, semaine en cours, libellés courts", () => {
  it("le mois complet remplit la première et la dernière semaine avec les vrais jours voisins, estompés", () => {
    const g = grilleDuMoisComplete(2026, 9); // octobre 2026 : le 1er est un jeudi
    expect(g.every((s) => s.length === 7)).toBe(true);
    expect(g[0].map((c) => c.jour)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(g[0].map((c) => c.horsMois)).toEqual([true, true, true, false, false, false, false]);
    const derniere = g[g.length - 1];
    expect(derniere.at(-1)).toEqual({ jour: "2026-11-01", horsMois: true });
    expect(derniere.find((c) => c.jour === "2026-10-31")?.horsMois).toBe(false);
  });

  it("le mois complet garde exactement les cases du mois de grilleDuMois, dans le même ordre", () => {
    for (const [annee, mois] of [[2026, 9], [2026, 1], [2027, 0], [2026, 11]] as const) {
      const simple = grilleDuMois(annee, mois).flat().filter((j): j is string => j !== null);
      const complet = grilleDuMoisComplete(annee, mois).flat().filter((c) => !c.horsMois).map((c) => c.jour);
      expect(complet).toEqual(simple);
      expect(grilleDuMoisComplete(annee, mois).length).toBe(grilleDuMois(annee, mois).length);
    }
  });

  it("les jours restants de la semaine vont d'aujourd'hui au dimanche inclus, sans les jours passés", () => {
    expect(joursRestantsDeLaSemaine("2026-10-07")).toEqual(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(joursRestantsDeLaSemaine("2026-10-11")).toEqual(["2026-10-11"]);
    expect(joursRestantsDeLaSemaine("2026-10-05")).toHaveLength(7);
  });

  it("la liste de la semaine garde un jour à venir sans tenue et masque un jour passé sans tenue", () => {
    const semaine = listeDeLaSemaine("2026-10-07", [porte("2026-10-05")], [plan("2026-10-09"), plan("2026-10-10", [])], null);
    expect(semaine.map((s) => s.jour)).toEqual(["2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(semaine.map((s) => s.tenue?.statut ?? null)).toEqual([null, null, "planifiee", null, null]);
    // Le lundi 5 est porté mais passé : il n'est pas dans « Cette semaine » (il reste dans les tenues passées).
    expect(semaine.some((s) => s.jour === "2026-10-05")).toBe(false);
  });

  it("aujourd'hui porte la tenue proposée quand il n'y a pas de plan", () => {
    const semaine = listeDeLaSemaine("2026-10-07", [], [], proposee);
    expect(semaine[0].tenue?.statut).toBe("du_jour");
    expect(semaine[0].tenue?.pieceIds).toEqual([7, 8]);
  });

  it("les libellés courts : « Mer. 7 oct. » et « Lun »", () => {
    expect(dateCourte("2026-10-07")).toBe("Mer. 7 oct.");
    expect(dateCourte("2026-06-02")).toBe("Mar. 2 juin");
    expect(dateCourte("2026-09-30")).toBe("Mer. 30 sept.");
    expect(jourAbrege("2026-10-05")).toBe("Lun");
    expect(jourAbrege("2026-10-11")).toBe("Dim");
  });
});

describe("numéro de semaine simple (la semaine du 1er janvier est la 1re)", () => {
  it("la semaine du 28 septembre au 4 octobre 2026 est la 40e, celle du 5 au 11 octobre la 41e", () => {
    for (const j of joursDeLaSemaine("2026-09-28")) expect(numeroDeSemaine(j)).toBe(40);
    for (const j of joursDeLaSemaine("2026-10-05")) expect(numeroDeSemaine(j)).toBe(41);
    expect(numeroDeSemaine("2026-10-08")).toBe(41);
  });
  it("le Nouvel An : la semaine qui contient le 1er janvier est la 1re, en entier", () => {
    // 2026 : le 1er janvier est un jeudi, la semaine va du lundi 29 décembre 2025 au dimanche 4 janvier 2026.
    for (const j of joursDeLaSemaine("2026-01-01")) expect(numeroDeSemaine(j)).toBe(1);
    expect(numeroDeSemaine("2026-01-05")).toBe(2);
    // 2027 : le 1er janvier est un vendredi ; la semaine du 28 décembre 2026 au 3 janvier 2027 est la 1re de 2027.
    for (const j of joursDeLaSemaine("2027-01-01")) expect(numeroDeSemaine(j)).toBe(1);
    expect(numeroDeSemaine("2026-12-27")).toBe(52);
    expect(numeroDeSemaine("2027-01-04")).toBe(2);
  });
  it("elle ne diffère de l'ISO qu'autour du Nouvel An : le 30 décembre 2024 est en semaine 1 (ISO 1 aussi), le 3 janvier 2021 en semaine 1 (ISO 53)", () => {
    expect(numeroDeSemaine("2024-12-30")).toBe(1);
    expect(numeroDeSemaine("2021-01-03")).toBe(1);
  });
  it("sept jours d'une même semaine ont toujours le même numéro", () => {
    for (const lundi of ["2026-03-02", "2026-06-29", "2026-12-28", "2028-01-03"])
      expect(new Set(joursDeLaSemaine(lundi).map(numeroDeSemaine)).size).toBe(1);
  });
});

describe("vue Liste : courte, et l'historique à part", () => {
  const AUJ2 = "2026-10-08";
  const porteLe = (jour: string, pieceIds = [3, 4]) => porte(jour, pieceIds);
  const lesPortees = (jours: string[]) => jours.map((j) => porteLe(j));

  it("À VENIR : les tenues des dix prochains jours, sans les jours vides, six au plus", () => {
    const plans = [plan("2026-10-11"), plan("2026-10-15"), plan("2026-10-25"), plan("2026-10-12", [])];
    const v = vueListe(AUJ2, [], plans, proposee);
    expect(v.avenir.map((t) => t.jour)).toEqual(["2026-10-08", "2026-10-11", "2026-10-15"]);
    // 25 octobre est à 17 jours : hors des dix jours ; 12 octobre n'a pas de pièce : pas une tenue.
    expect(v.avenir.every((t) => t.jour < "2026-10-18")).toBe(true);
    const beaucoup = Array.from({ length: 9 }, (_, i) => plan(`2026-10-${String(9 + i).padStart(2, "0")}`));
    expect(vueListe(AUJ2, [], beaucoup, proposee).avenir).toHaveLength(AVENIR_MAX);
    expect(AVENIR_JOURS).toBe(10);
  });

  it("RÉCEMMENT PORTÉES : les quatre dernières tenues passées seulement, de la plus récente à la plus ancienne", () => {
    const h = lesPortees(["2026-10-07", "2026-10-05", "2026-10-04", "2026-10-01", "2026-09-27", "2026-09-26", "2026-08-31"]);
    const v = vueListe(AUJ2, h, [], null);
    expect(v.recentes.map((t) => t.jour)).toEqual(["2026-10-07", "2026-10-05", "2026-10-04", "2026-10-01"]);
    expect(v.recentes).toHaveLength(RECENTES_MAX);
    expect(v.nbPassees).toBe(7);
  });

  it("une tenue passée planifiée mais non portée garde le statut « planifiée » ; si elle a été portée, « portée » passe devant", () => {
    const v = vueListe(AUJ2, [porteLe("2026-10-06")], [plan("2026-10-06"), plan("2026-10-05")], null);
    expect(v.recentes.map((t) => [t.jour, t.statut])).toEqual([["2026-10-06", "porte"], ["2026-10-05", "planifiee"]]);
  });

  it("les jours passés avec une tenue : portés ou planifiés, sans doublon, jamais aujourd'hui ni le futur", () => {
    const jours = joursPassesAvecTenue(AUJ2, [porteLe("2026-10-07"), porteLe("2026-10-08"), porteLe("2026-10-07", [9])], [plan("2026-10-07"), plan("2026-10-09"), plan("2026-10-03")], );
    expect(jours).toEqual(["2026-10-07", "2026-10-03"]);
  });

  it("l'historique complet est regroupé par mois, du plus récent au plus ancien, avec son filtre", () => {
    const h = lesPortees(["2026-10-07", "2026-10-01", "2026-09-27", "2026-09-26", "2026-08-31"]);
    const plans = [plan("2026-09-14")];
    const tout = historiqueParMois(AUJ2, h, plans);
    expect(tout.map((m) => [m.cle, m.libelle, m.tenues.length])).toEqual([["2026-10", "Octobre 2026", 2], ["2026-09", "Septembre 2026", 3], ["2026-08", "Août 2026", 1]]);
    expect(tout[1].tenues.map((t) => t.jour)).toEqual(["2026-09-27", "2026-09-26", "2026-09-14"]);
    expect(historiqueParMois(AUJ2, h, plans, "portees").flatMap((m) => m.tenues).every((t) => t.statut === "porte")).toBe(true);
    expect(historiqueParMois(AUJ2, h, plans, "planifiees").flatMap((m) => m.tenues.map((t) => t.jour))).toEqual(["2026-09-14"]);
    expect(historiqueParMois(AUJ2, [], [])).toEqual([]);
  });

  it("la date d'une ligne : « Mer. 7 octobre »", () => {
    expect(dateMoyenne("2026-10-07")).toBe("Mer. 7 octobre");
    expect(dateMoyenne("2026-08-31")).toBe("Lun. 31 août");
  });
});
