import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { candidatsDeRemplacement, estSacADos, generateOutfitWithFallback } from "../logic";
import type { CategoryKey, DateContext, Item, OccasionKey, SacType, ShoeType } from "../types";

// R-B23 (14/10/2026, signalé) : un sac à dos, même du dressing, n'est jamais proposé en Soirée, Rendez-vous amoureux ni Cérémonie.
// Arbitré à ces trois occasions entières (tous types de date) ; Travail / Bureau le garde.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
// Ids < 1001 : des pièces du DRESSING réel — le sac à dos est le seul sac.
const SAC_A_DOS = 50;
const POOL: Item[] = [
  p(1, "robe", "Robe noire", { subtype: "Robe" }),
  p(2, "haut", "Chemisier", {}),
  p(3, "pantalon", "Pantalon tailleur", {}),
  p(4, "chaussures", "Escarpins", { shoeType: "Escarpins" as ShoeType }),
  p(5, "chaussures", "Mocassins", { shoeType: "Mocassins" as ShoeType }),
  p(SAC_A_DOS, "sac", "Sac à dos en cuir", { sacType: "Sac à dos" as SacType }),
];
const meteo = weatherForDay(18, "Nuageux", "Automne");
const sacADosTire = (occ: OccasionKey, date: DateContext = "Verre") => {
  let n = 0;
  for (let i = 0; i < 80; i++) if (generateOutfitWithFallback(POOL, meteo, occ, "Présentiel", date, [], "femme", null).ids.includes(SAC_A_DOS)) n++;
  return n;
};

describe("R-B23 — pas de sac à dos pour une occasion habillée", () => {
  it("le type déclaré, sinon le nom", () => {
    expect(estSacADos({ cat: "sac", sacType: "Sac à dos", name: "Sac Eastpak" })).toBe(true);
    expect(estSacADos({ cat: "sac", name: "Sac à dos imprimé" })).toBe(true);
    expect(estSacADos({ cat: "sac", sacType: "Pochette", name: "Pochette" })).toBe(false);
    expect(estSacADos({ cat: "robe", name: "Robe dos nu" })).toBe(false);
  });

  it("jamais tiré en Soirée, Rendez-vous (tous types de date) ni Cérémonie, même seul sac du dressing", () => {
    expect(sacADosTire("soiree")).toBe(0);
    expect(sacADosTire("evenement_perso")).toBe(0);
    for (const [date] of [["Restaurant / date romantique"], ["Verre"], ["Cinéma / balade"], ["Activité"], ["Soirée festive"]] as [DateContext][]) {
      expect(sacADosTire("date", date), date).toBe(0);
    }
  });

  it("Travail / Bureau le garde", () => {
    expect(sacADosTire("travail_formel")).toBeGreaterThan(0);
  });

  it("jamais proposé en remplacement ni en ajout pour ces occasions", () => {
    const tenue = POOL.filter((i) => [1, 4].includes(i.id));
    const ids = (occ: OccasionKey) => candidatsDeRemplacement(tenue, POOL, -1, "sac", occ, "Présentiel", "Verre", meteo).map((i) => i.id);
    expect(ids("soiree")).not.toContain(SAC_A_DOS);
    expect(ids("date")).not.toContain(SAC_A_DOS);
    expect(ids("evenement_perso")).not.toContain(SAC_A_DOS);
    expect(ids("travail_formel")).toContain(SAC_A_DOS);
  });
});
