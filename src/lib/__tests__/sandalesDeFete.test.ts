import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, Item, OccasionKey, ShoeType } from "../types";

// SANDALES À TALONS DE FÊTE EN AUTOMNE — demandé le 01/10/2026 (« pour une
// cérémonie ou une soirée festive tu peux proposer des sandales à talons même
// en automne »). Mesuré par scripts/sandales-fete.audit.ts.

const AUT = { season: "Automne / Hiver", saisons: ["Automne", "Hiver"] } as Partial<Item>;
const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
const SANDALES = 99;
const POOL: Item[] = [
  p(1, "robe", "Robe de soirée", { ...AUT, subtype: "Robe" }),
  p(2, "robe", "Robe de cérémonie", { ...AUT, subtype: "Robe" }),
  p(3, "chaussures", "Bottines", { ...AUT, shoeType: "Bottines" as ShoeType }),
  p(4, "chaussures", "Escarpins", { ...AUT, shoeType: "Escarpins" as ShoeType }),
  p(5, "sac", "Pochette", { ...AUT, sacType: "Pochette" }),
  p(6, "haut", "Top", AUT), p(7, "jupe", "Jupe", AUT),
  p(SANDALES, "chaussures", "Sandales à talons", { season: "Printemps / Été", saisons: ["Été"], shoeType: "Sandales à talons" as ShoeType }),
];
const taux = (occ: OccasionKey, label = "Nuageux", calendaire: "Automne" | "Hiver" = "Automne", leviers?: Parameters<typeof generateOutfitWithFallback>[8], temp = 15) => {
  const w = weatherForDay(temp, label, calendaire);
  let n = 0;
  for (let i = 0; i < 150; i++) if (generateOutfitWithFallback(POOL, w, occ, "Présentiel", "Verre", [], "femme", null, leviers).ids.includes(SANDALES)) n++;
  return n;
};

describe("sandales à talons de fête en automne", () => {
  it("proposées pour une sortie festive et une cérémonie", () => {
    expect(taux("festive")).toBeGreaterThan(0);
    expect(taux("evenement_perso")).toBeGreaterThan(0);
  });

  it("jamais pour les autres occasions", () => {
    for (const occ of ["quotidien", "travail_formel", "entretien", "date", "soiree", "voyage"] as OccasionKey[]) {
      expect(taux(occ), occ).toBe(0);
    }
  });

  it("jamais sous la pluie (R-B21)", () => {
    expect(taux("festive", "Pluvieux")).toBe(0);
    expect(taux("evenement_perso", "Pluvieux")).toBe(0);
  });

  it("jamais par temps d'hiver (5°) — la saison du jour doit comprendre l'automne", () => {
    expect(taux("festive", "Nuageux", "Hiver", undefined, 5)).toBe(0);
  });

  it("le levier sansSandalesDeFeteEnAutomne rend la règle d'origine", () => {
    expect(taux("festive", "Nuageux", "Automne", { sansSandalesDeFeteEnAutomne: true })).toBe(0);
  });
});

describe("R-B22 — chaussures d'été jamais sous 15°, dressing réel compris (08/10/2026)", () => {
  // Une sandale du dressing déclare souvent toute l'année : la saison ne doit pas suffire à la proposer par 11°.
  const DRESSING_SANDALES = 98;
  const pool = (extra: Item[]) => [...POOL.filter((i) => i.id !== SANDALES), ...extra];
  const toute = (id: number, name: string, over: Partial<Item> = {}) => p(id, "chaussures", name, { season: "Toutes saisons", saisons: ["Printemps", "Été", "Automne", "Hiver"], ...over });
  const taux2 = (extra: Item[], occ: OccasionKey, temp: number, label = "Nuageux", calendaire: "Automne" | "Hiver" = "Automne") => {
    const w = weatherForDay(temp, label, calendaire);
    let n = 0;
    for (let i = 0; i < 150; i++) if (generateOutfitWithFallback(pool(extra), w, occ, "Présentiel", "Verre", [], "femme", null).ids.some((id) => extra.some((e) => e.id === id))) n++;
    return n;
  };

  it("des sandales du dressing déclarées sur toute l'année ne sont pas proposées à 11°", () => {
    const sandales = toute(DRESSING_SANDALES, "Sandales", { shoeType: "Sandales" as ShoeType });
    for (const occ of ["festive", "evenement_perso", "quotidien", "date", "soiree"] as OccasionKey[]) expect(taux2([sandales], occ, 11), occ).toBe(0);
  });

  it("de même pour des sandales à talons et des espadrilles, et pour une pièce sans type reconnue par son nom", () => {
    expect(taux2([toute(DRESSING_SANDALES, "Sandales à talons", { shoeType: "Sandales à talons" as ShoeType })], "festive", 11)).toBe(0);
    expect(taux2([toute(DRESSING_SANDALES, "Espadrilles", { shoeType: "Espadrilles" as ShoeType })], "quotidien", 11)).toBe(0);
    expect(taux2([toute(DRESSING_SANDALES, "Mes sandales dorées")], "quotidien", 11)).toBe(0);
  });

  it("elles restent proposées quand il fait doux : 15° et plus", () => {
    const sandales = toute(DRESSING_SANDALES, "Sandales", { shoeType: "Sandales" as ShoeType });
    expect(taux2([sandales], "quotidien", 22, "Ensoleillé", "Automne")).toBeGreaterThan(0);
  });

  it("les mules et les slingbacks ne sont pas concernées", () => {
    const mules = toute(DRESSING_SANDALES, "Mules", { shoeType: "Mules" as ShoeType });
    expect(taux2([mules], "quotidien", 11)).toBeGreaterThan(0);
  });

  it("le levier sansFiltreChaussuresDEte rend le comportement d'avant", () => {
    const sandales = toute(DRESSING_SANDALES, "Sandales", { shoeType: "Sandales" as ShoeType });
    const w = weatherForDay(11, "Nuageux", "Automne");
    let n = 0;
    for (let i = 0; i < 150; i++) if (generateOutfitWithFallback(pool([sandales]), w, "quotidien", "Présentiel", "Verre", [], "femme", null, { sansFiltreChaussuresDEte: true }).ids.includes(DRESSING_SANDALES)) n++;
    expect(n).toBeGreaterThan(0);
  });
});
