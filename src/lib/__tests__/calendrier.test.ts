import { describe, expect, it } from "vitest";
import { grilleDuMois, joursDeLaSemaine, listeDuCalendrier, lundiDe, moisDecale, tenueDuCalendrier } from "../calendrier";
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
