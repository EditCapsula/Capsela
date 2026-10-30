import { describe, expect, it } from "vitest";
import { creneauxDeLaPiece, vetementsDeLaValise, vetementsParFamille } from "../valiseVetements";
import type { CreneauPlanning } from "../planningValise";
import type { CategoryKey, Item } from "../types";

/** LES VÊTEMENTS DE LA VALISE (30/10/2026) : uniques par identifiant, provenance, suggestions à part. */

const piece = (id: number, cat: CategoryKey, name = `P${id}`): Item => ({ id, cat, name, hex: "#000", color: "Noir", season: "Toutes saisons", worn: 0 }) as Item;
const pool = [piece(1, "pull", "Pull beige"), piece(2, "pantalon", "Pantalon noir"), piece(3, "chaussures"), piece(4, "sac"), piece(5, "robe"), piece(900, "veste", "Trench (capsule)")];
const resoudre = (id: number) => pool.find((p) => p.id === id);
// Trois tenues : le pull dans les trois, le pantalon dans deux, les chaussures dans toutes ; la suggestion 900 dans une.
const looks = [{ ids: [1, 2, 3, 4] }, { ids: [1, 2, 3, 900] }, { ids: [1, 5, 3, 4] }];

describe("vetementsDeLaValise", () => {
  it("une pièce portée dans plusieurs tenues n'apparaît qu'une fois, avec la référence de toutes ses tenues", () => {
    const { aEmporter } = vetementsDeLaValise([1, 2, 3, 4, 5, 900, 1], looks, [900], resoudre);
    expect(aEmporter.map((v) => v.item.id)).toEqual([1, 2, 3, 4, 5]);
    expect(aEmporter.find((v) => v.item.id === 1)?.tenues).toEqual([0, 1, 2]);
    expect(aEmporter.find((v) => v.item.id === 2)?.tenues).toEqual([0, 1]);
  });

  it("une suggestion n'est jamais comptée parmi les pièces à emporter ; elle garde sa tenue", () => {
    const { aEmporter, aAjouter } = vetementsDeLaValise([1, 2, 3, 4, 5, 900], looks, [900], resoudre);
    expect(aEmporter.some((v) => v.item.id === 900)).toBe(false);
    expect(aAjouter).toEqual([{ item: pool[5], tenues: [1] }]);
  });

  it("sans suggestion : rien à compléter ; une pièce introuvable est ignorée", () => {
    const r = vetementsDeLaValise([1, 2, 77], looks, undefined, resoudre);
    expect(r.aAjouter).toEqual([]);
    expect(r.aEmporter.map((v) => v.item.id)).toEqual([1, 2]);
  });

  it("ne modifie jamais les tenues", () => {
    const avant = JSON.stringify(looks);
    vetementsDeLaValise([1, 2, 3, 4, 5, 900], looks, [900], resoudre);
    expect(JSON.stringify(looks)).toBe(avant);
  });
});

describe("vetementsParFamille", () => {
  it("chaque famille compte ses pièces uniques ; les familles vides sont omises", () => {
    const { aEmporter } = vetementsDeLaValise([1, 2, 3, 4, 5, 900], looks, [900], resoudre);
    expect(vetementsParFamille(aEmporter).map((f) => [f.titre, f.vetements.length])).toEqual([
      ["Hauts", 1],
      ["Bas", 1],
      ["Robes & combinaisons", 1],
      ["Chaussures", 1],
      ["Sacs", 1],
    ]);
  });
});

describe("creneauxDeLaPiece", () => {
  it("les créneaux du planning dont la tenue porte la pièce", () => {
    const planning: CreneauPlanning[] = [
      { jour: "2026-11-05", creneau: "jour", sousId: "visites", libelle: "Visites", look: 0 },
      { jour: "2026-11-06", creneau: "soir", sousId: "diner", libelle: "Dîner", look: 1 },
      { jour: "2026-11-07", creneau: "jour", sousId: "visites", libelle: "Visites", look: null },
    ];
    expect(creneauxDeLaPiece(planning, looks, 900).map((c) => c.jour)).toEqual(["2026-11-06"]);
    expect(creneauxDeLaPiece(planning, looks, 1).map((c) => c.jour)).toEqual(["2026-11-05", "2026-11-06"]);
  });
});
