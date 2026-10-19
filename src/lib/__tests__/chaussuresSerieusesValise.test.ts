import { describe, expect, it } from "vitest";
import { generateurMoteur, sansChaussuresSerieusesHorsTravail, tropSerieusePourLesVacances } from "../valise";
import { MILD, item } from "./fixtures";
import type { OccasionKey } from "../types";

/** PAS DE MOCASSINS NI DE DERBIES EN VACANCES (19/10/2026, demandé) : dans une valise, ils ne servent qu'aux looks Travail · Bureau. */

const mocassins = item({ id: 1, category: "chaussures", name: "Babies / Mary Jane", sous_type: "Mocassins" });
const derbies = item({ id: 2, category: "chaussures", name: "Derbies cuir", sous_type: "Derbies" });
const ballerines = item({ id: 3, category: "chaussures", name: "Mary Janes vernies", sous_type: "Ballerines" });
const baskets = item({ id: 4, category: "chaussures", name: "Baskets blanches", sous_type: "Baskets" });
const pool = [
  mocassins,
  derbies,
  baskets,
  item({ id: 5, category: "hauts", name: "T-shirt blanc", sous_type: "T-shirt" }),
  item({ id: 6, category: "pantalon", name: "Pantalon droit", sous_type: "Pantalon" }),
  item({ id: 7, category: "sac", name: "Cabas", sous_type: "Cabas" }),
];

describe("mocassins, derbies et valise", () => {
  it("reconnaît les mocassins et les derbies à leur type de chaussure, pas au nom", () => {
    expect(tropSerieusePourLesVacances(mocassins)).toBe(true);
    expect(tropSerieusePourLesVacances(derbies)).toBe(true);
    expect(tropSerieusePourLesVacances(ballerines)).toBe(false);
    expect(tropSerieusePourLesVacances(baskets)).toBe(false);
  });

  it("les retire hors Travail · Bureau, les garde pour un événement professionnel", () => {
    for (const o of ["quotidien", "voyage", "soiree", "evenement_perso"] as OccasionKey[]) {
      expect(sansChaussuresSerieusesHorsTravail(pool, o).some(tropSerieusePourLesVacances)).toBe(false);
    }
    expect(sansChaussuresSerieusesHorsTravail(pool, "travail_formel")).toEqual(pool);
  });

  it("aucun look de vacances tiré par le moteur ne contient de mocassins ni de derbies", () => {
    const generer = generateurMoteur([], "femme");
    for (let k = 0; k < 30; k++) {
      for (const occasion of ["quotidien", "voyage"] as OccasionKey[]) {
        const ids = generer(pool, { occasion, meteo: MILD, jours: ["2026-10-20"] })?.ids ?? [];
        expect(ids).not.toContain(mocassins.id);
        expect(ids).not.toContain(derbies.id);
      }
    }
  });
});
