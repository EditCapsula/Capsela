import { describe, expect, it } from "vitest";
import { generateOutfit, SEUIL_MANTEAU } from "../logic";
import { vestePlusLongueQueLeManteau } from "../forme";
import { at, item } from "./fixtures";
import type { CatalogItem } from "../catalog";

/**
 * R-B25, LA LONGUEUR DES COUCHES (12/11/2026, validé : « une veste portée sous un manteau ne doit pas être plus longue que lui »). Levier
 * longueurDesCouches, inactif tant qu'il n'est pas mesuré. Sans longueur connue, rien ne change.
 */

const manteauCourt: CatalogItem = { ...item({ id: 1, category: "manteau", name: "Manteau court en laine", sous_type: "Manteau" }), longueur: "courte" };
const kimonoLong: CatalogItem = { ...item({ id: 2, category: "veste", name: "Kimono long", sous_type: "Veste légère" }), longueur: "longue" };
const pool: CatalogItem[] = [
  manteauCourt,
  kimonoLong,
  { ...item({ id: 3, category: "hauts", name: "Top en coton", sous_type: "Top" }), manches: "courtes" },
  item({ id: 4, category: "pantalon", name: "Pantalon droit", sous_type: "Pantalon" }),
  item({ id: 5, category: "chaussures", name: "Bottines", sous_type: "Bottines" }),
];

const lesDeux = (longueurDesCouches: boolean, p: CatalogItem[] = pool) => {
  let n = 0;
  for (let k = 0; k < 40; k++) {
    const { ids } = generateOutfit(p, at(SEUIL_MANTEAU - 6), "quotidien", "Présentiel", "Verre", [], "femme", undefined, undefined, null, { longueurDesCouches });
    if (ids.includes(manteauCourt.id) && ids.includes(kimonoLong.id)) n++;
  }
  return n;
};

describe("R-B25 — longueur des couches", () => {
  it("une veste plus longue que le manteau ; sans les deux longueurs, jamais", () => {
    expect(vestePlusLongueQueLeManteau({ cat: "veste", longueur: "longue" }, { cat: "manteau", longueur: "courte" })).toBe(true);
    expect(vestePlusLongueQueLeManteau({ cat: "veste", longueur: "courte" }, { cat: "manteau", longueur: "longue" })).toBe(false);
    expect(vestePlusLongueQueLeManteau({ cat: "veste" }, { cat: "manteau", longueur: "courte" })).toBe(false);
  });
  it("sans le levier, le kimono long passe sous le manteau court ; avec, jamais", () => {
    expect(lesDeux(false)).toBeGreaterThan(0);
    expect(lesDeux(true)).toBe(0);
  });
  it("longueurs inconnues : le levier ne change rien", () => {
    const sans = pool.map((p) => ({ ...p, longueur: undefined }));
    expect(lesDeux(true, sans)).toBeGreaterThan(0);
  });
  it("un autre manteau, assez long, passe d'abord : la tenue garde sa veste", () => {
    const manteauLong: CatalogItem = { ...item({ id: 6, category: "manteau", name: "Manteau long en laine", sous_type: "Manteau" }), longueur: "longue" };
    const avecLong = [...pool, manteauLong];
    let gardee = 0;
    for (let k = 0; k < 40; k++) {
      const { ids } = generateOutfit(avecLong, at(SEUIL_MANTEAU - 6), "quotidien", "Présentiel", "Verre", [], "femme", undefined, undefined, null, { longueurDesCouches: true });
      expect(ids.includes(manteauCourt.id) && ids.includes(kimonoLong.id)).toBe(false);
      if (ids.includes(kimonoLong.id) && ids.includes(manteauLong.id)) gardee++;
    }
    expect(gardee).toBeGreaterThan(0);
  });
});
