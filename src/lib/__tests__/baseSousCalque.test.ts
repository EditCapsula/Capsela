import { describe, expect, it } from "vitest";
import { generateOutfit } from "../logic";
import { MILD, item } from "./fixtures";
import type { CatalogItem } from "../catalog";

/**
 * BASE SOUS UN CALQUE SEUL (02/10/2026). Une tenue 100 % capsule ne doit pas afficher
 * « un débardeur ou un t-shirt dessous compléterait » : le moteur pose le haut de base lui-même.
 */

// La fixture décale les identifiants : on les relit sur les pièces plutôt que de les supposer.
const ID = (n: number) => item({ id: n, category: "hauts", name: "x" }).id;

const pool = (avecBase: boolean): CatalogItem[] => [
  item({ id: 1, category: "hauts", name: "Chemise oversize", sous_type: "Chemise", coupe: "Ample", meteo_min_temp: 8, meteo_max_temp: 26 }),
  ...(avecBase ? [item({ id: 5, category: "hauts", name: "Débardeur", sous_type: "Débardeur", meteo_min_temp: 10, meteo_max_temp: 30 })] : []),
  item({ id: 2, category: "pantalons", name: "Pantalon droit", sous_type: "Pantalon", meteo_min_temp: 5, meteo_max_temp: 28 }),
  item({ id: 3, category: "chaussures", name: "Mocassins", sous_type: "Mocassins", meteo_min_temp: 5, meteo_max_temp: 28 }),
];

describe("un calque n'est jamais le seul haut quand une base existe", () => {
  it("avec un débardeur dans le pool, la chemise oversize part toujours avec lui", () => {
    let vues = 0;
    for (let n = 0; n < 200; n++) {
      const { ids } = generateOutfit(pool(true), MILD, "quotidien", "Présentiel", "Verre", [], "femme");
      if (ids.includes(ID(1))) { vues++; expect(ids, `tirage ${n}`).toContain(ID(5)); };
    }
    // Le test ne prouve rien si la chemise n'est jamais tirée.
    expect(vues).toBeGreaterThan(20);
  });

  it("sans haut de base, rien n'est forcé", () => {
    const { ids } = generateOutfit(pool(false), MILD, "quotidien", "Présentiel", "Verre", [], "femme");
    expect(ids).not.toContain(ID(5));
  });
});
