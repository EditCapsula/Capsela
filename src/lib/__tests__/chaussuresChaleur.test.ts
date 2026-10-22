import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { chaussuresPourLaChaleur, generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// R-S20 — PAS DE MOCASSINS PAR FORTE CHALEUR (22/10/2026, signalé : « il fait plus de 25 degrés et tu proposes des mocassins »).
// Avant et après mesurés dans la même exécution, sur le même pool : seul le levier sansChaussuresLegeresParLaChaleur change.

const ETE = { season: "Toutes saisons" } as Partial<Item>;
const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Blanc", hex: "#F2EEE6", worn: null, ...ETE, ...over }) as Item;
const MOCASSINS = 3;
const POOL: Item[] = [
  p(1, "haut", "T-shirt en coton", { subtype: "T-shirt" }),
  p(2, "pantalon", "Pantalon en lin", { subtype: "Pantalon" }),
  p(MOCASSINS, "chaussures", "Mocassins", { shoeType: "Mocassins" as ShoeType, color: "Camel", hex: "#C08A5E" }),
  p(4, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType }),
  p(5, "chaussures", "Ballerines", { shoeType: "Ballerines" as ShoeType, color: "Noir", hex: "#2A2724" }),
  p(6, "sac", "Cabas", { sacType: "Cabas" }),
  p(7, "robe", "Robe chemise", { subtype: "Robe" }),
];
const OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "date", "soiree", "voyage"];
const mocassins = (temp: number, avant: boolean) => {
  const w = weatherForDay(temp, "Ensoleillé", "Été");
  let n = 0, total = 0;
  for (const occ of OCCASIONS)
    for (let i = 0; i < 80; i++) {
      const r = generateOutfitWithFallback(POOL, w, occ, "Présentiel", "Verre", [], "femme", null, avant ? { sansChaussuresLegeresParLaChaleur: true } : undefined);
      if (!r.ids.length) continue;
      total++;
      if (r.ids.includes(MOCASSINS)) n++;
    }
  return { n, total };
};

describe("R-S20 — chaussures fermées et chaudes par forte chaleur", () => {
  it("à 28°, plus aucun mocassin quand une autre paire existe ; avant, ils étaient proposés", () => {
    const avant = mocassins(28, true);
    const apres = mocassins(28, false);
    expect(avant.n).toBeGreaterThan(0);
    expect(apres.n).toBe(0);
    expect(apres.total).toBe(avant.total);
  });

  it("sous 25°, rien ne change : les mocassins restent proposés", () => {
    expect(mocassins(20, false).n).toBeGreaterThan(0);
  });

  it("préférence molle : une seule paire, fermée, est gardée", () => {
    const seule = [p(1, "chaussures", "Derbies", { shoeType: "Derbies" as ShoeType })];
    expect(chaussuresPourLaChaleur(seule, { temp: 30 })).toEqual(seule);
    expect(chaussuresPourLaChaleur([...seule, p(2, "chaussures", "Sandales", { shoeType: "Sandales" as ShoeType })], { temp: 30 }).map((i) => i.id)).toEqual([2]);
    // Sans type : le nom décide.
    expect(chaussuresPourLaChaleur([p(3, "chaussures", "Bottines en daim"), p(4, "chaussures", "Espadrilles")], { temp: 26 }).map((i) => i.id)).toEqual([4]);
  });
});
