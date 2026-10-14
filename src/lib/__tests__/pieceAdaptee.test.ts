import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import { adapteeALOccasion, composeWardrobePool } from "../selectors";
import type { CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// LA PIÈCE ADAPTÉE À L'OCCASION D'ABORD (14/10/2026, demandé). Mesuré dans la MÊME exécution, sur le même dressing et la même
// capsule : AVANT = `pieceAdaptee` absent et levier `sansConfortVoyage` (comportement du matin), APRÈS = production.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
const CATS: CategoryKey[] = ["haut", "pantalon", "jean", "chaussures", "sac"];
const meteo = weatherForDay(18, "Nuageux", "Automne");
// Le dressing (ids < 1001) : des babies, un pantalon tailleur, un haut.
const BABIES = 10;
const DRESSING = [
  p(BABIES, "chaussures", "Babies / Mary Jane", { shoeType: "Ballerines" as ShoeType }),
  p(11, "pantalon", "Pantalon tailleur"),
  p(12, "haut", "T-shirt basique"),
];
// La capsule : des baskets, des escarpins, un jogger en coton stretch, un sac.
const BASKETS = 1003;
const ESCARPINS = 1004;
const CAPSULE = [
  p(BASKETS, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType }),
  p(ESCARPINS, "chaussures", "Escarpins", { shoeType: "Escarpins" as ShoeType }),
  p(1006, "pantalon", "Pantalon jogger", { matiere: "Coton / élasthanne" as Item["matiere"] }),
  p(1007, "sac", "Sac cabas", { sacType: "Cabas" }),
];
const taux = (occ: OccasionKey, id: number, pieceAdaptee: boolean) => {
  const pool = composeWardrobePool(DRESSING, CAPSULE, CATS, { completerPourOccasion: occ, saison: meteo, exclureHorsOccasion: true, pieceAdaptee });
  let n = 0;
  const leviers = pieceAdaptee ? undefined : { sansConfortVoyage: true };
  for (let i = 0; i < 100; i++) if (generateOutfitWithFallback(pool, meteo, occ, "Présentiel", "Verre", [], "femme", null, leviers).ids.includes(id)) n++;
  return n;
};

describe("la pièce adaptée à l'occasion d'abord", () => {
  it("Voyage : les baskets de la capsule plutôt que les babies du dressing", () => {
    // Avant : les babies du dressing la plupart du temps (les baskets de la capsule déclarent « Voyage » depuis le même jour et
    // complètent la catégorie, sans être préférées).
    expect(taux("voyage", BABIES, false)).toBeGreaterThan(0);
    expect(taux("voyage", BASKETS, true)).toBe(100);
    expect(taux("voyage", BABIES, true)).toBe(0);
  });

  it("Voyage : le jogger en coton de la capsule plutôt que le pantalon tailleur du dressing", () => {
    expect(taux("voyage", 11, false)).toBeGreaterThan(0);
    expect(taux("voyage", 11, true)).toBe(0);
    expect(taux("voyage", 1006, true)).toBe(100);
  });

  it("Cérémonie : des escarpins de la capsule plutôt que les babies", () => {
    expect(taux("evenement_perso", ESCARPINS, false)).toBe(0);
    expect(taux("evenement_perso", ESCARPINS, true)).toBe(100);
  });

  it("une pièce adaptée du dressing garde la priorité", () => {
    const dressing = [...DRESSING, p(13, "chaussures", "Mes baskets", { shoeType: "Baskets" as ShoeType })];
    const pool = composeWardrobePool(dressing, CAPSULE, CATS, { completerPourOccasion: "voyage", saison: meteo, exclureHorsOccasion: true, pieceAdaptee: true });
    // Les baskets du dressing conviennent : aucune paire de la capsule n'est ajoutée, ses babies restent (le moteur préfère les baskets).
    expect(pool.filter((i) => i.cat === "chaussures").map((i) => i.id)).toEqual([BABIES, 13]);
  });

  it("les baskets du dressing pour un trajet, même déclarées Quotidien et Sport seulement", () => {
    const MES_BASKETS = 14;
    const dressing = [...DRESSING, p(MES_BASKETS, "chaussures", "Mes baskets", { shoeType: "Baskets" as ShoeType, occasion: ["quotidien", "sport"] })];
    const tirer = (adaptee: boolean) => {
      const pool = composeWardrobePool(dressing, CAPSULE, CATS, { completerPourOccasion: "voyage", saison: meteo, exclureHorsOccasion: true, pieceAdaptee: adaptee });
      let n = 0;
      for (let i = 0; i < 100; i++) if (generateOutfitWithFallback(pool, meteo, "voyage", "Présentiel", "Verre", [], "femme", null, adaptee ? undefined : { sansConfortVoyage: true }).ids.includes(MES_BASKETS)) n++;
      return n;
    };
    expect(tirer(true)).toBe(100);
  });

  it("sans préférence du moteur, rien n'est inventé", () => {
    expect(adapteeALOccasion(DRESSING[0], "quotidien")).toBe(true);
    expect(adapteeALOccasion(DRESSING[1], "travail_formel")).toBe(true);
  });
});
