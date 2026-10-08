import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { isRainy } from "../data";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, OccasionKey, Season, ShoeType } from "../types";

// PLUIE ET CHAUSSURES OUVERTES — corrigé le 30/09/2026 (signalé : « il pleut
// et l'application me propose une tenue avec des chaussures ouvertes »).
// Deux défauts : « Pluvieux », le libellé de la pluie ordinaire, n'était pas
// reconnu comme de la pluie ; et seules les sandales étaient écartées.

describe("isRainy — tout le vocabulaire des précipitations réellement produit", () => {
  it("fonction Edge weather : pluie, bruine, orage, neige", () => {
    for (const label of ["Pluvieux", "Pluie légère", "Orageux", "Neigeux"]) expect(isRainy({ label })).toBe(true);
  });
  it("variantes : averses, bruine, pluie, neige", () => {
    for (const label of ["Averses", "Bruine", "Pluie", "Neige"]) expect(isRainy({ label })).toBe(true);
  });
  it("temps sec : jamais", () => {
    for (const label of ["Ensoleillé", "Nuageux", "Couvert", "Brumeux", "Venteux", ""]) expect(isRainy({ label })).toBe(false);
  });
});

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons" as Season, worn: null, ...over }) as Item;
const OUVERTES: ShoeType[] = ["Sandales", "Sandales à talons", "Mules", "Slingbacks", "Espadrilles"];
const FERMEES: ShoeType[] = ["Baskets", "Bottines", "Bottes", "Mocassins", "Escarpins", "Derbies", "Ballerines"];
const pool = (): Item[] => [
  p(1, "haut", "Chemisier", { subtype: "Chemise" }),
  p(2, "pantalon", "Pantalon droit", { subtype: "Pantalon" }),
  p(3, "jupe", "Jupe midi", { subtype: "Midi" }),
  ...[...OUVERTES, ...FERMEES].map((t, i) => p(100 + i, "chaussures", t, { shoeType: t })),
];
const chaussuresTirees = (label: string, temp: number, occ: OccasionKey, n = 80): Set<string> => {
  const pl = pool();
  const w = weatherForDay(temp, label, "Automne");
  const vues = new Set<string>();
  for (let i = 0; i < n; i++) {
    const r = generateOutfitWithFallback(pl, w, occ);
    const sh = r.ids.map((id) => pl.find((x) => x.id === id)).find((x) => x?.cat === "chaussures");
    if (sh?.shoeType) vues.add(sh.shoeType);
  }
  return vues;
};

describe("R-B21 — aucune chaussure ouverte sous la pluie ou la neige", () => {
  for (const label of ["Pluvieux", "Pluie légère", "Orageux", "Neigeux"]) {
    for (const occ of ["quotidien", "festive"] as OccasionKey[]) {
      it(`${label}, ${occ} : ni sandales, ni mules, ni slingbacks, ni espadrilles`, () => {
        const vues = chaussuresTirees(label, 15, occ);
        expect(vues.size).toBeGreaterThan(0);
        for (const t of OUVERTES) expect(vues.has(t)).toBe(false);
      });
    }
  }

  it("par temps sec, les chaussures ouvertes restent possibles", () => {
    const vues = chaussuresTirees("Ensoleillé", 24, "evenement_perso", 120);
    expect(OUVERTES.some((t) => vues.has(t))).toBe(true);
  });
});
