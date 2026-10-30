import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// R-S24 (30/10/2026, demandé : « pour les soirées ou cérémonies, privilégie des talons pour les femmes »). Mesuré dans la MÊME exécution,
// sur le même pool, avec et sans le levier `sansTalonsEnSoiree`.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, matiere: "Coton", ...over }) as Item;
const ESCARPINS = 5004;
const POOL: Item[] = [
  p(5001, "robe", "Robe nuisette", { occasion: ["soiree", "evenement_perso", "date"] as Item["occasion"] }),
  p(5002, "chaussures", "Ballerines", { shoeType: "Ballerines" as ShoeType, occasion: ["soiree", "evenement_perso"] as Item["occasion"] }),
  p(5003, "chaussures", "Mules plates", { shoeType: "Mules" as ShoeType, occasion: ["soiree", "evenement_perso"] as Item["occasion"] }),
  p(ESCARPINS, "chaussures", "Escarpins", { shoeType: "Escarpins" as ShoeType }),
];
const automne = weatherForDay(17, "Nuageux", "Automne");
const taux = (occ: OccasionKey, genre: "femme" | "homme", sansTalonsEnSoiree?: boolean) => {
  let n = 0;
  for (let i = 0; i < 200; i++)
    if (generateOutfitWithFallback(POOL, automne, occ, "Présentiel", "Verre", [], genre, null, sansTalonsEnSoiree ? { sansTalonsEnSoiree } : undefined).ids.includes(ESCARPINS)) n++;
  return n;
};

describe("R-S24 — des talons en soirée et en cérémonie, pour une femme", () => {
  it("soirée : les escarpins à chaque tirage ; sans la règle, pas toujours", () => {
    expect(taux("soiree", "femme")).toBe(200);
    expect(taux("soiree", "femme", true)).toBeLessThan(200);
  });
  it("cérémonie : les escarpins à chaque tirage, plus jamais les mules plates", () => {
    expect(taux("evenement_perso", "femme")).toBe(200);
  });
  it("un profil homme : rien n'est imposé, les escarpins ne sortent pas à chaque tirage", () => {
    expect(taux("soiree", "homme")).toBeLessThan(200);
  });
});
