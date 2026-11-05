import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback, SEUIL_COLLANT_SANS_BORNE } from "../logic";
import { composeWardrobePool } from "../selectors";
import type { CategoryKey, Item, ShoeType } from "../types";

// R-B19 bis (05/11/2026, signalé : une robe du dressing à 6 °C, sans collants ; seuil de 15 °C validé par la propriétaire). Mesuré dans la
// MÊME exécution, sur le même dressing : AVANT = levier `sansCollantParDefaut`, APRÈS = production. La robe et la jupe viennent du dressing :
// aucune température minimale déclarée. Mesuré le 05/11/2026 : avant, les collants n'entraient que tirés comme simple accessoire (32 % des
// tenues avec la robe, 22 % avec la jupe à 6 °C) ; après, 100 %.
const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, occasion: ["quotidien", "travail_formel"], ...over }) as Item;
const collants = p(9, "accessoire", "Collants opaques", { accessoireType: "Collants", meteoMinTemp: 3, meteoMaxTemp: 15 });
const ROBE = [p(1, "robe", "Robe nuisette"), p(2, "chaussures", "Mocassins", { shoeType: "Mocassins" as ShoeType }), p(3, "sac", "Sac", { sacType: "Sac à main" }), collants];
const JUPE = [p(1, "haut", "Pull"), p(4, "jupe", "Jupe midi"), p(2, "chaussures", "Bottines", { shoeType: "Bottines" as ShoeType }), collants];

const part = (dressing: Item[], temp: number, avant: boolean) => {
  let n = 0;
  for (let i = 0; i < 100; i++) {
    const r = generateOutfitWithFallback(dressing, weatherForDay(temp, "Ensoleillé", "Automne"), "quotidien", "Présentiel", "Verre", [], "femme", null, avant ? { sansCollantParDefaut: true } : undefined);
    if (r.ids.includes(9)) n++;
  }
  return n / 100;
};

describe("R-B19 bis : une robe ou une jupe sans borne déclarée appelle des collants sous 15 °C", () => {
  it("robe du dressing à 6 °C : collants seulement au hasard des accessoires avant, toujours après", () => {
    expect(part(ROBE, 6, true)).toBeLessThan(0.6);
    expect(part(ROBE, 6, false)).toBe(1);
  });
  it("jupe du dressing à 6 °C : de même", () => {
    expect(part(JUPE, 6, true)).toBeLessThan(0.6);
    expect(part(JUPE, 6, false)).toBe(1);
  });
  it("au-dessus du seuil, pas de collants", () => {
    expect(SEUIL_COLLANT_SANS_BORNE).toBe(15);
    // Au-dessus du seuil, la règle ne force rien : les collants ne restent qu'un accessoire possible, comme avant.
    expect(part(ROBE, 18, false)).toBeLessThan(0.6);
  });
  it("une pièce qui déclare sa borne garde la sienne", () => {
    const robeBornee = [{ ...ROBE[0], meteoMinTemp: 5 }, ...ROBE.slice(1)];
    expect(part(robeBornee, 8, false)).toBeLessThan(0.6);
    expect(part(robeBornee, 3, false)).toBe(1);
  });
  it("jamais imposés pour un profil homme : la règle ne change rien pour lui", () => {
    let n = 0;
    for (let i = 0; i < 100; i++) {
      const r = generateOutfitWithFallback(JUPE, weatherForDay(6, "Ensoleillé", "Automne"), "quotidien", "Présentiel", "Verre", [], "homme", null);
      if (r.ids.includes(9)) n++;
    }
    expect(n).toBeLessThan(100);
  });
  it("une ceinture du dressing ne retire plus les collants de la capsule du pool ; des collants au dressing, eux, suffisent", () => {
    const ceinture = p(20, "accessoire", "Ceinture", { accessoireType: "Ceinture" });
    const collantsCapsule = { ...collants, id: 100009 };
    const pool = composeWardrobePool([ceinture], [collantsCapsule, p(100010, "accessoire", "Foulard", { accessoireType: "Foulard" })], ["accessoire"]);
    expect(pool.map((i) => i.id).sort((a, b) => a - b)).toEqual([20, 100009]);
    const avecLesSiens = composeWardrobePool([ceinture, collants], [collantsCapsule], ["accessoire"]);
    expect(avecLesSiens.map((i) => i.id).sort((a, b) => a - b)).toEqual([9, 20]);
  });
});
