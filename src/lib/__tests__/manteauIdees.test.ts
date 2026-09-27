import { describe, expect, it } from "vitest";
import { representativeWeatherFor } from "../capsule";
import { getOutfitsForItem } from "../logic";
import type { CategoryKey, Item, Season } from "../types";

/*
 * « Les idées de tenues » d'un manteau (27/09/2026, signalé : aucune idée
 * pour un manteau du dressing). generateOutfit n'ajoute presque jamais de
 * manteau ; getOutfitsForItem le porte désormais par-dessus les tenues
 * tirées, quand sa saison, sa température et l'occasion l'admettent.
 */

let n = 0;
const piece = (cat: CategoryKey, name: string, season: Season = "Toutes saisons", extra: Partial<Item> = {}): Item => ({
  id: ++n,
  name,
  cat,
  color: "Noir",
  hex: "#2A2724",
  season,
  worn: 2,
  occasion: ["quotidien", "travail_formel", "soiree", "sport", "cocooning", "voyage", "date"],
  ...extra,
});

const manteau = piece("manteau", "Manteau chocolat", "Automne / Hiver", { color: "Chocolat", hex: "#4A3326" });
const pool: Item[] = [
  piece("haut", "Pull fin crème"),
  piece("haut", "T-shirt blanc"),
  piece("pantalon", "Pantalon noir"),
  piece("jean", "Jean brut"),
  piece("chaussures", "Bottines noires", "Toutes saisons", { shoeType: "Bottines" }),
  piece("chaussures", "Baskets blanches", "Toutes saisons", { shoeType: "Baskets" }),
  piece("sac", "Sac cuir"),
  manteau,
];

describe("getOutfitsForItem — un manteau porté par-dessus", () => {
  it("en automne : des idées, toutes avec le manteau", () => {
    const idees = getOutfitsForItem(manteau.id, pool, representativeWeatherFor("Automne"), [], {}, "femme", "Automne");
    expect(idees.length).toBeGreaterThan(0);
    for (const v of idees) expect(v.ids).toContain(manteau.id);
  });

  it("jamais en Sport ni en Cocooning (règles du vêtement de dessus)", () => {
    const idees = getOutfitsForItem(manteau.id, pool, representativeWeatherFor("Automne"), [], {}, "femme", "Automne");
    expect(idees.some((v) => v.occasion === "sport" || v.occasion === "cocooning")).toBe(false);
  });

  it("en été, un manteau d'automne / hiver n'a pas d'idée", () => {
    expect(getOutfitsForItem(manteau.id, pool, representativeWeatherFor("Été"), [], {}, "femme", "Été")).toEqual([]);
  });

  it("sa plage de température est respectée", () => {
    const leger = { ...manteau, id: 999, meteoMinTemp: 15 };
    expect(getOutfitsForItem(leger.id, [...pool, leger], representativeWeatherFor("Automne"), [], {}, "femme", "Automne")).toEqual([]);
  });
});
