import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { estDenim, matiereDeVoyage } from "../attributes";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// R-S19 (14/10/2026, signalé : des mocassins « pas confortables » poussés pour un trajet ; puis « pas de denim, une matière plus
// confortable : coton stretch ou mélangé en automne-hiver, lin ou coton naturel au printemps-été ») — en Voyage, les baskets d'abord,
// les pièces décontractées hors denim d'abord, puis la matière de la saison. Mesuré dans la MÊME exécution, sur le même pool, avec et
// sans le levier `sansConfortVoyage`.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
const BASKETS = 1003;
const TAILLEUR = 1002;
const JEAN = 1006;
const STRETCH = 1008;
const LIN = 1009;
const POOL: Item[] = [
  p(1001, "haut", "T-shirt basique", { matiere: "Coton" }),
  p(TAILLEUR, "pantalon", "Pantalon tailleur"),
  p(JEAN, "jean", "Jean droit", { matiere: "Denim" }),
  p(STRETCH, "pantalon", "Pantalon jogger", { matiere: "Coton / élasthanne" as Item["matiere"] }),
  p(LIN, "pantalon", "Pantalon large fluide", { matiere: "Lin" }),
  p(BASKETS, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType }),
  p(1004, "chaussures", "Mocassins", { shoeType: "Mocassins" as ShoeType }),
  p(1005, "chaussures", "Ballerines", { shoeType: "Ballerines" as ShoeType }),
  p(1007, "sac", "Sac cabas", { sacType: "Cabas" }),
];
const automne = weatherForDay(14, "Nuageux", "Automne");
const ete = weatherForDay(26, "Ensoleillé", "Été");
const taux = (occ: OccasionKey, id: number, meteo = automne, sansConfortVoyage?: boolean) => {
  let n = 0;
  for (let i = 0; i < 120; i++)
    if (generateOutfitWithFallback(POOL, meteo, occ, "Présentiel", "Verre", [], "femme", null, sansConfortVoyage ? { sansConfortVoyage } : undefined).ids.includes(id)) n++;
  return n;
};

describe("R-S19 — confort en Voyage", () => {
  it("les baskets à chaque trajet ; sans la règle, une fois sur trois environ", () => {
    expect(taux("voyage", BASKETS)).toBe(120);
    expect(taux("voyage", BASKETS, automne, true)).toBeLessThan(100);
  });

  it("automne-hiver : le coton stretch, jamais le jean ni le tailleur", () => {
    expect(taux("voyage", STRETCH)).toBe(120);
    expect(taux("voyage", JEAN)).toBe(0);
    expect(taux("voyage", TAILLEUR)).toBe(0);
    expect(taux("voyage", JEAN, automne, true)).toBeGreaterThan(0);
  });

  it("printemps-été : le lin, jamais le jean", () => {
    expect(taux("voyage", LIN, ete)).toBe(120);
    expect(taux("voyage", JEAN, ete)).toBe(0);
  });

  it("les autres occasions ne changent pas", () => {
    expect(taux("quotidien", BASKETS)).toBeLessThan(120);
    expect(taux("quotidien", JEAN)).toBeGreaterThan(0);
  });
});

describe("matiereDeVoyage — lue sur la matière déclarée (texte libre du catalogue)", () => {
  const m = (matiere: string, cat: CategoryKey = "pantalon") => p(1, cat, "Pièce", { matiere: matiere as Item["matiere"] });
  it("automne-hiver : coton stretch ou mélangé", () => {
    expect(matiereDeVoyage(m("Coton / élasthanne"), "Automne / Hiver")).toBe(true);
    expect(matiereDeVoyage(m("Laine / coton"), "Automne / Hiver")).toBe(true);
    expect(matiereDeVoyage(m("Jersey de coton"), "Automne / Hiver")).toBe(true);
    expect(matiereDeVoyage(m("Coton"), "Automne / Hiver")).toBe(false);
    expect(matiereDeVoyage(m("Viscose / élasthanne"), "Automne / Hiver")).toBe(false);
  });
  it("printemps-été : lin ou coton naturel", () => {
    expect(matiereDeVoyage(m("Lin / viscose"), "Printemps / Été")).toBe(true);
    expect(matiereDeVoyage(m("Coton léger"), "Printemps / Été")).toBe(true);
    expect(matiereDeVoyage(m("Polyamide / élasthanne"), "Printemps / Été")).toBe(false);
  });
  it("jamais le denim ; les pièces hors vêtements ne sont pas jugées", () => {
    expect(estDenim(p(1, "jean", "Jean droit"))).toBe(true);
    expect(matiereDeVoyage(m("Denim stretch / coton"), "Automne / Hiver")).toBe(false);
    expect(matiereDeVoyage(m("Cuir", "chaussures"), "Automne / Hiver")).toBe(true);
  });
});
