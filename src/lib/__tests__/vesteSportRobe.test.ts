import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { vetementDeSport } from "../attributes";
import { candidatsDeRemplacement, generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, ShoeType } from "../types";

// R-B24 (01/11/2026, signalé en capture : « la veste de training n'est pas à associer avec une robe »). Mesuré avec et sans le levier
// `vesteDeSportSurRobe`, sur le même pool, dans la même exécution.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Prune", hex: "#5B2A4A", season: "Toutes saisons", worn: null, matiere: "Coton", ...over }) as Item;
const ROBE = p(7001, "robe", "Robe longue manches longues", { occasion: ["quotidien", "voyage"] as Item["occasion"] });
const TRAINING = p(7002, "veste", "Veste de training", { occasion: ["quotidien", "voyage", "sport"] as Item["occasion"] });
const BASKETS = p(7003, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType });
const frais = weatherForDay(14, "Nuageux", "Automne");
const avecTraining = (sansRegle: boolean) => {
  let n = 0;
  for (let i = 0; i < 300; i++) {
    const r = generateOutfitWithFallback([ROBE, TRAINING, BASKETS], frais, "voyage", "Présentiel", "Verre", [], "femme", null, sansRegle ? { vesteDeSportSurRobe: true } : undefined);
    if (r.ids.includes(ROBE.id) && r.ids.includes(TRAINING.id)) n++;
  }
  return n;
};

describe("R-B24 — pas de veste de sport sur une robe", () => {
  it("vetementDeSport : le nom ou le niveau sport", () => {
    expect(vetementDeSport(TRAINING)).toBe(true);
    expect(vetementDeSport(p(1, "veste", "Veste en jean"))).toBe(false);
    expect(vetementDeSport(p(2, "veste", "Veste légère", { niveauFormalite: 0 }))).toBe(true);
  });
  it("la robe ne reçoit jamais la veste de training ; sans la règle, elle la recevait", () => {
    expect(avecTraining(false)).toBe(0);
    expect(avecTraining(true)).toBeGreaterThan(0);
  });
  it("remplacer la veste d'une tenue en robe : la veste de training n'est pas proposée", () => {
    const blazer = p(7004, "veste", "Blazer droit");
    const proposees = candidatsDeRemplacement([ROBE, blazer, BASKETS], [ROBE, blazer, TRAINING, BASKETS], blazer.id, "veste", "quotidien");
    expect(proposees.map((i) => i.id)).not.toContain(TRAINING.id);
  });
});
