import { describe, expect, it } from "vitest";
import { chemiseAmpleSurCombinaison, estChemiseAmple, evaluateBlocking } from "../logic";
import { MILD, item } from "./fixtures";
import type { Item } from "../types";

/**
 * CHEMISE AMPLE SUR UNE COMBINAISON SANS MANCHES (16/10/2026, demandé). Exception à R-B5 : la chemise ample se porte ouverte
 * par-dessus. Le reste de R-B5 ne bouge pas.
 */

const chemiseAmple = item({ id: 1, category: "hauts", name: "Chemise ample en lin", sous_type: "Chemise", coupe: "Ample" });
const chemiseDroite = item({ id: 2, category: "hauts", name: "Chemise blanche", sous_type: "Chemise" });
const tshirtAmple = item({ id: 3, category: "hauts", name: "T-shirt oversize", sous_type: "T-shirt", coupe: "Ample" });
const pantalon = item({ id: 4, category: "pantalons", name: "Pantalon droit", sous_type: "Pantalon" });
const combi = (manches?: Item["manches"]): Item => ({
  ...item({ id: 5, category: "combinaisons", name: "Combinaison fluide", sous_type: "Combinaison" }),
  manches,
});
const robeSansManches: Item = { ...item({ id: 6, category: "robes", name: "Robe droite", sous_type: "Robe" }), manches: "sans" };

const rb5 = (pieces: Item[], occasion: Parameters<typeof evaluateBlocking>[1] = "quotidien") =>
  evaluateBlocking(pieces, occasion, MILD).some((h) => h.id === "R-B5");

describe("chemiseAmpleSurCombinaison", () => {
  it("reconnaît une chemise ample, par sa coupe ou son nom", () => {
    expect(estChemiseAmple(chemiseAmple)).toBe(true);
    expect(estChemiseAmple(item({ id: 7, category: "hauts", name: "Chemise oversize rayée", sous_type: "Chemise" }))).toBe(true);
    expect(estChemiseAmple(chemiseDroite)).toBe(false);
    expect(estChemiseAmple(tshirtAmple)).toBe(false);
  });

  it("exige des manches DÉCLARÉES « sans » sur une combinaison", () => {
    expect(chemiseAmpleSurCombinaison(chemiseAmple, combi("sans"))).toBe(true);
    expect(chemiseAmpleSurCombinaison(chemiseAmple, combi("courtes"))).toBe(false);
    expect(chemiseAmpleSurCombinaison(chemiseAmple, combi(undefined))).toBe(false);
    expect(chemiseAmpleSurCombinaison(chemiseAmple, robeSansManches)).toBe(false);
  });
});

describe("R-B5 et la chemise ample", () => {
  it("n'alerte plus sur une chemise ample + combinaison sans manches, même en contexte habillé", () => {
    expect(rb5([combi("sans"), chemiseAmple])).toBe(false);
    expect(rb5([combi("sans"), chemiseAmple], "soiree")).toBe(false);
  });

  it("alerte toujours pour une chemise droite, un bas, ou des manches inconnues", () => {
    expect(rb5([combi("sans"), chemiseDroite])).toBe(true);
    expect(rb5([combi("sans"), pantalon])).toBe(true);
    expect(rb5([combi(undefined), chemiseAmple], "soiree")).toBe(true);
  });
});
