import { describe, expect, it } from "vitest";
import { apercuAllegement, avecTenue, joursDeLaPiece, nouvelleTenue, piecesAllegeables } from "../ajustementsValise";
import type { CreneauPlanning } from "../planningValise";
import type { Generateur, LookValise, SituationValise } from "../valise";
import type { Item } from "../types";

const piece = (id: number, cat: Item["cat"]): Item => ({ id, name: `P${id}`, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 1 }) as Item;
const look = (ids: number[], situations: number[]): LookValise => ({ ids, situations, elargie: false });
const meteo = { temp: 25 } as SituationValise["meteo"];
const situations: SituationValise[] = [
  { occasion: "quotidien", meteo, jours: ["2026-10-20"] },
  { occasion: "soiree", meteo, jours: ["2026-10-20"] },
];

describe("joursDeLaPiece", () => {
  const jours = ["2026-10-20", "2026-10-21", "2026-10-22"];
  const looks = [look([1, 2], [0]), look([3, 2], [1])];
  const planning: CreneauPlanning[] = [
    { jour: "2026-10-20", creneau: "jour", sousId: "visites", libelle: "Visites", look: 0 },
    { jour: "2026-10-22", creneau: "soir", sousId: "restaurant", libelle: "Restaurant", look: 1 },
    { jour: "2026-10-21", creneau: "jour", sousId: "plage", libelle: "Plage", look: null },
  ];
  it("rend les numéros de jour où la pièce est portée", () => {
    expect(joursDeLaPiece(planning, looks, 2, jours)).toEqual([1, 3]);
    expect(joursDeLaPiece(planning, looks, 1, jours)).toEqual([1]);
  });
  it("un créneau sans look ne compte pas ; une pièce hors planning : vide", () => {
    expect(joursDeLaPiece(planning, looks, 9, jours)).toEqual([]);
  });
});

describe("piecesAllegeables", () => {
  const pieces = [piece(1, "haut"), piece(2, "haut"), piece(3, "pantalon"), piece(4, "pantalon"), piece(5, "sac")];
  const looks = [look([1, 3, 5], [0]), look([1, 4, 5], [0]), look([1, 3, 5], [1]), look([2, 3, 5], [1])];
  const r = piecesAllegeables(pieces, looks);
  it("ne propose que les pièces sous le seuil de polyvalence, les moins utiles d'abord", () => {
    expect(r.map((x) => x.id)).toEqual([2, 4]);
    expect(r.find((x) => x.id === 1)).toBeUndefined();
  });
  it("dit la raison vraie : un doublon est battu par une pièce du même type", () => {
    expect(r[0]).toMatchObject({ id: 2, looks: 1, raison: "doublon" });
    expect(r[1]).toMatchObject({ id: 4, looks: 1, raison: "doublon" });
  });
  it("une pièce dans aucun look : « aucun_look »", () => {
    expect(piecesAllegeables([piece(1, "haut"), piece(7, "jupe")], [look([1], [0])])[0]).toMatchObject({ id: 7, raison: "aucun_look" });
  });
});

describe("apercuAllegement — un plancher, pas une promesse", () => {
  const looks = [look([1, 3, 5], [0]), look([2, 3, 5], [1])];
  it("compte les looks sans pièce retirée et les occasions qui en perdent", () => {
    const a = apercuAllegement([1, 2, 3, 5], looks, situations, [2]);
    expect(a).toEqual({ piecesAvant: 4, piecesApres: 3, looksAvant: 2, looksApres: 1, occasionsPerdues: ["soiree"] });
  });
  it("retirer rien : rien ne change", () => {
    expect(apercuAllegement([1, 2, 3, 5], looks, situations, [])).toMatchObject({ looksApres: 2, occasionsPerdues: [] });
  });
});

describe("nouvelleTenue", () => {
  const dressing = [piece(1, "haut"), piece(2, "pantalon"), piece(3, "chaussures"), piece(4, "sac"), piece(5, "haut"), piece(6, "pantalon")];
  const fixe = (ids: number[]): Generateur => () => ({ ids, elargie: false });
  it("d'abord avec les seules pièces de la valise", () => {
    const t = nouvelleTenue(situations[0], [1, 2, 3, 4], dressing, [], fixe([1, 2, 3, 4]));
    expect(t).toEqual({ ids: [1, 2, 3, 4], ajouts: [] });
  });
  it("à défaut, avec le dressing : les pièces à ajouter sont dites", () => {
    const gen: Generateur = (pool) => (pool.some((p) => p.id === 5) ? { ids: [5, 2, 3, 4], elargie: false } : null);
    expect(nouvelleTenue(situations[0], [1, 2, 3, 4], dressing, [], gen)).toEqual({ ids: [2, 3, 4, 5], ajouts: [5] });
  });
  it("une tenue déjà dans la valise n'est pas proposée une seconde fois", () => {
    expect(nouvelleTenue(situations[0], [1, 2, 3, 4], dressing, [look([1, 2, 3, 4], [0])], fixe([1, 2, 3, 4]))).toBeNull();
  });
  it("le moteur ne trouve rien : rien", () => {
    expect(nouvelleTenue(situations[0], [1], dressing, [], () => null)).toBeNull();
  });
});

describe("avecTenue", () => {
  it("ajoute les pièces et le look, et retire la situation des situations sans look", () => {
    const r = avecTenue({ pieceIds: [1, 2], looks: [], situationsSansLook: [0, 1] }, { ids: [2, 3], ajouts: [3] }, 1);
    expect(r).toEqual({ pieceIds: [1, 2, 3], looks: [{ ids: [2, 3], situations: [1], elargie: false }], situationsSansLook: [0] });
  });
});
