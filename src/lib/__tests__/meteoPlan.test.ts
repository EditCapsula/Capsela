import { describe, expect, it } from "vitest";
import { meteoPourLaDate } from "../meteoPlan";
import { weatherForDay } from "../capsule";
import { composeWardrobePool } from "../selectors";
import { generateOutfitWithFallback } from "../logic";
import { HORIZON_PREVISION_JOURS } from "../prevision";
import type { CategoryKey, Item } from "../types";

// TENUE PLANIFIÉE : la météo de la DATE (08/10/2026) et des chaussures de la saison de la date.

const AUJOURDHUI = weatherForDay(11, "Nuageux", "Automne");
const dans = (jours: number) => new Date(2026, 9, 8 + jours, 12);

describe("meteoPourLaDate", () => {
  it("au-delà de l'horizon : la température habituelle de la saison de la date, pas les 11° d'aujourd'hui", () => {
    const juillet = meteoPourLaDate({ date: new Date(2027, 6, 14, 12), creneau: null, aujourdhui: AUJOURDHUI, auDela: true });
    expect(juillet.temp).toBeGreaterThan(AUJOURDHUI.temp + 5);
    expect(juillet.saisons).toContain("Été");
  });
  it("une prévision pour le créneau prime, avec la saison de la date", () => {
    const m = meteoPourLaDate({ date: dans(2), auDela: false, creneau: { temp: 7, tempMin: 5, tempMax: 9, label: "Pluie", creneaux: 3 }, aujourdhui: AUJOURDHUI });
    expect(m.temp).toBe(7);
    expect(m.label).toBe("Pluie");
  });
  it("dans la couverture mais sans réponse : la météo d'aujourd'hui, la mesure la plus proche", () => {
    const m = meteoPourLaDate({ date: dans(HORIZON_PREVISION_JOURS), creneau: null, aujourdhui: AUJOURDHUI, auDela: false });
    expect(m.temp).toBe(11);
  });
  it("au-delà, la climatologie du LIEU prime sur la température de la saison ; elle ne donne jamais de pluie sans raison", () => {
    const rome = meteoPourLaDate({ date: new Date(2027, 6, 14, 12), creneau: null, aujourdhui: AUJOURDHUI, auDela: true, climat: { tempMin: 20, tempMax: 32, pluie: 0.1, annees: 5 } });
    expect(rome.temp).toBe(26);
    expect(rome.label).toBe("Ensoleillé");
    const bergen = meteoPourLaDate({ date: new Date(2027, 6, 14, 12), creneau: null, aujourdhui: AUJOURDHUI, auDela: true, climat: { tempMin: 9, tempMax: 15, pluie: 0.7, annees: 5 } });
    expect(bergen.temp).toBe(12);
    expect(bergen.label).toBe("Pluvieux");
  });
  it("sans date : la météo d'aujourd'hui, telle quelle", () => {
    expect(meteoPourLaDate({ date: null, creneau: null, aujourdhui: AUJOURDHUI, auDela: false })).toBe(AUJOURDHUI);
  });
});

describe("une tenue planifiée pour l'été, planifiée en automne, a des chaussures d'été", () => {
  const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
    ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
  const dressing: Item[] = [
    p(1, "haut", "T-shirt"),
    p(2, "pantalon", "Pantalon"),
    // Les seules chaussures du dressing sont déclarées pour l'automne et l'hiver.
    p(3, "chaussures", "Bottines", { season: "Automne / Hiver", saisons: ["Automne", "Hiver"], shoeType: "Bottines" }),
  ];
  const capsuleEte: Item[] = [p(1099, "chaussures", "Sandales", { season: "Printemps / Été", saisons: ["Été"], shoeType: "Sandales" })];
  it("la capsule de la date complète la catégorie, et les bottines d'automne ne sont jamais prises", () => {
    const meteo = meteoPourLaDate({ date: new Date(2027, 6, 14, 12), creneau: null, aujourdhui: AUJOURDHUI, auDela: true });
    const cats = ["haut", "pantalon", "chaussures"] as CategoryKey[];
    const pool = composeWardrobePool(dressing, capsuleEte, cats, { completerPourOccasion: "quotidien", saison: meteo, exclureHorsOccasion: true, completerPourSaison: meteo });
    for (let i = 0; i < 30; i++) {
      const r = generateOutfitWithFallback(pool, meteo, "quotidien", "Présentiel", "Verre", [], "femme");
      const chaussures = r.ids.map((id) => pool.find((x) => x.id === id)).filter((x) => x?.cat === "chaussures");
      expect(chaussures.map((c) => c?.id)).toEqual([1099]);
    }
  });
});
