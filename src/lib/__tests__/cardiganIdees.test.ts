import { describe, expect, it } from "vitest";
import { representativeWeatherFor } from "../capsule";
import { getOutfitsForItem } from "../logic";
import type { CategoryKey, Item, Season } from "../types";

/*
 * « Les idées de tenues » d'une maille ouverte (14/11/2026, signalé : « Cardigan structuré » de la capsule, aucune idée). Comme le
 * manteau (manteauIdees.test.ts), getOutfitsForItem la porte par-dessus les tenues tirées, aux conditions de R-B8 et R-B5. Mesuré dans
 * la même exécution, levier coupé (mailleOuverteParDessus: false) puis ouvert, sur le même pool.
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

const cardigan = piece("pull", "Cardigan structuré", "Automne / Hiver", { subtype: "Cardigan", color: "Camel", hex: "#B08A5E", matiere: "Laine" });
const pool: Item[] = [
  piece("haut", "T-shirt blanc", "Toutes saisons", { rolePiece: "base" }),
  piece("haut", "Chemise blanche", "Toutes saisons", { rolePiece: "base", subtype: "Chemise" }),
  piece("pantalon", "Pantalon noir"),
  piece("jean", "Jean brut"),
  piece("veste", "Blazer marine", "Toutes saisons", { subtype: "Blazer" }),
  piece("chaussures", "Mocassins noirs", "Toutes saisons", { shoeType: "Mocassins" }),
  piece("chaussures", "Baskets blanches", "Toutes saisons", { shoeType: "Baskets" }),
  piece("sac", "Sac cuir"),
  cardigan,
];
const automne = representativeWeatherFor("Automne");

describe("getOutfitsForItem — une maille ouverte portée par-dessus", () => {
  it("des idées avec le cardigan, plus qu'avant (même exécution, même pool)", () => {
    const avant = getOutfitsForItem(cardigan.id, pool, automne, [], { mailleOuverteParDessus: false }, "femme", "Automne");
    const apres = getOutfitsForItem(cardigan.id, pool, automne, [], {}, "femme", "Automne");
    expect(apres.length).toBeGreaterThan(0);
    expect(apres.length).toBeGreaterThanOrEqual(avant.length);
    for (const v of apres) expect(v.ids).toContain(cardigan.id);
  });

  it("jamais avec une veste (le cardigan prend sa place), ni en contexte habillé", () => {
    const apres = getOutfitsForItem(cardigan.id, pool, automne, [], {}, "femme", "Automne");
    const veste = pool.find((p) => p.cat === "veste")!;
    expect(apres.some((v) => v.ids.includes(veste.id))).toBe(false);
    expect(apres.some((v) => v.occasion === "travail_formel")).toBe(false);
  });

  it("hors saison, pas d'idée", () => {
    expect(getOutfitsForItem(cardigan.id, pool, representativeWeatherFor("Été"), [], {}, "femme", "Été")).toEqual([]);
  });

  it("une maille fermée n'est pas concernée", () => {
    const pull = { ...cardigan, id: 999, name: "Pull col rond", subtype: "Pull col rond" };
    const avant = getOutfitsForItem(pull.id, [...pool, pull], automne, [], { mailleOuverteParDessus: false }, "femme", "Automne");
    const apres = getOutfitsForItem(pull.id, [...pool, pull], automne, [], {}, "femme", "Automne");
    expect(apres.map((v) => v.ids.join(","))).toEqual(avant.map((v) => v.ids.join(",")));
  });
});
