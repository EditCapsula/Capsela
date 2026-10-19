import { describe, expect, it } from "vitest";
import { estBabies, generateurMoteur, sansBabiesHorsTravail } from "../valise";
import { MILD, item } from "./fixtures";
import type { OccasionKey } from "../types";

/** PAS DE BABIES EN VACANCES (19/10/2026, demandé) : dans une valise, les babies ne servent qu'aux looks Travail · Bureau. */

const babies = item({ id: 1, category: "chaussures", name: "Babies / Mary Jane", sous_type: "Mocassins" });
const maryJane = item({ id: 2, category: "chaussures", name: "Mary Janes vernies", sous_type: "Ballerines" });
const mocassins = item({ id: 3, category: "chaussures", name: "Mocassins cuir", sous_type: "Mocassins" });
const baskets = item({ id: 4, category: "chaussures", name: "Baskets blanches", sous_type: "Baskets" });
const pool = [
  babies,
  baskets,
  item({ id: 5, category: "hauts", name: "T-shirt blanc", sous_type: "T-shirt" }),
  item({ id: 6, category: "pantalon", name: "Pantalon droit", sous_type: "Pantalon" }),
  item({ id: 7, category: "sac", name: "Cabas", sous_type: "Cabas" }),
];

describe("babies et valise", () => {
  it("reconnaît les babies à leur nom, pas au type de chaussure", () => {
    expect(estBabies(babies)).toBe(true);
    expect(estBabies(maryJane)).toBe(true);
    expect(estBabies(mocassins)).toBe(false);
    expect(estBabies(baskets)).toBe(false);
  });

  it("les retire hors Travail · Bureau, les garde pour un événement professionnel", () => {
    for (const o of ["quotidien", "voyage", "soiree", "evenement_perso"] as OccasionKey[]) {
      expect(sansBabiesHorsTravail(pool, o).some(estBabies)).toBe(false);
    }
    expect(sansBabiesHorsTravail(pool, "travail_formel")).toEqual(pool);
  });

  it("aucun look de vacances tiré par le moteur ne contient de babies", () => {
    const generer = generateurMoteur([], "femme");
    for (let k = 0; k < 30; k++) {
      for (const occasion of ["quotidien", "voyage"] as OccasionKey[]) {
        const t = generer(pool, { occasion, meteo: MILD, jours: ["2026-10-20"] });
        expect(t?.ids ?? []).not.toContain(babies.id);
      }
    }
  });
});
