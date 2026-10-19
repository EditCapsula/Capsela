import { describe, expect, it } from "vitest";
import { evaluateBlocking, generateOutfit, manteauHorsPlancher, SEUIL_MANTEAU } from "../logic";
import { at, item } from "./fixtures";
import type { CatalogItem } from "../catalog";
import type { OccasionKey } from "../types";

/**
 * LE MANTEAU PAR LE FROID (19/10/2026, validé). Sous SEUIL_MANTEAU, la tenue part avec un manteau ; le manteau n'est plus
 * soumis au plancher de formalité de l'occasion, sauf un manteau technique en contexte habillé.
 */

const laine = item({ id: 1, category: "manteau", name: "Manteau laine long", sous_type: "Manteau" });
const doudoune = item({ id: 2, category: "manteau", name: "Doudoune courte", sous_type: "Doudoune" });
const pool: CatalogItem[] = [
  laine,
  item({ id: 3, category: "hauts", name: "Chemise blanche", sous_type: "Chemise" }),
  item({ id: 4, category: "pantalon", name: "Pantalon droit", sous_type: "Pantalon" }),
  item({ id: 5, category: "chaussures", name: "Bottines", sous_type: "Bottines" }),
];

const partAvecManteau = (temp: number, occasion: OccasionKey, sansManteauParLeFroid = false) => {
  let avec = 0;
  for (let k = 0; k < 40; k++) {
    const { ids } = generateOutfit(pool, at(temp), occasion, "Présentiel", "Verre", [], "femme", undefined, undefined, null, {
      sansManteauParLeFroid,
    });
    if (ids.includes(laine.id)) avec++;
  }
  return avec / 40;
};

describe("manteau par le froid", () => {
  it("sous le seuil, la tenue part avec le manteau", () => {
    expect(partAvecManteau(SEUIL_MANTEAU - 7, "quotidien")).toBe(1);
  });

  it("au-dessus du seuil, rien n'est ajouté d'office", () => {
    expect(partAvecManteau(SEUIL_MANTEAU + 2, "quotidien")).toBeLessThan(1);
  });

  it("jamais en cocooning", () => {
    expect(partAvecManteau(SEUIL_MANTEAU - 7, "cocooning")).toBe(0);
  });

  it("levier de mesure : sans la règle, le comportement d'avant", () => {
    expect(partAvecManteau(SEUIL_MANTEAU - 7, "quotidien", true)).toBeLessThan(1);
  });
});

describe("manteau et plancher de formalité", () => {
  it("un manteau échappe au plancher, sauf un manteau technique en contexte habillé", () => {
    expect(manteauHorsPlancher(laine, true)).toBe(true);
    expect(manteauHorsPlancher(doudoune, false)).toBe(true);
    expect(manteauHorsPlancher(doudoune, true)).toBe(false);
  });

  it("R-B3 ne juge pas le manteau", () => {
    const robe = item({ id: 6, category: "robes", name: "Robe longue satin", sous_type: "Robe", niveau_formalite: "habille" });
    const escarpins = item({ id: 7, category: "chaussures", name: "Escarpins", sous_type: "Escarpins", niveau_formalite: "habille" });
    const hits = evaluateBlocking([robe, escarpins, laine], "soiree", at(5));
    expect(hits.some((h) => h.id === "R-B3")).toBe(false);
  });
});
