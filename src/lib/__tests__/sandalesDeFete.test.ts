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
// Une sandale du CATALOGUE (id ≥ 1001) : l'exemption de fête ne vaut que pour elle — personne n'y a déclaré de saison (cf. « saison déclarée »).
const SANDALES = 1099;
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

describe("la saison déclarée d'une pièce du dressing est une règle dure (08/10/2026)", () => {
  // « Ici j'avais déclaré que les sandales étaient pour l'été » : jamais en automne, quelle que soit l'occasion et même sans autre chaussure.
  const ETE = { season: "Printemps / Été", saisons: ["Été"] } as Partial<Item>;
  const REELLE = 97; // < 1001 : une pièce du dressing
  const sandalesEte = (name: string, shoeType: ShoeType) => p(REELLE, "chaussures", name, { ...ETE, shoeType });
  const sansChaussures = POOL.filter((i) => i.cat !== "chaussures" && i.id !== SANDALES);
  const sorties = (pool: Item[], occ: OccasionKey, temp = 11) => {
    const w = weatherForDay(temp, "Nuageux", "Automne");
    let n = 0;
    for (let i = 0; i < 150; i++) if (generateOutfitWithFallback(pool, w, occ, "Présentiel", "Verre", [], "femme", null).ids.includes(REELLE)) n++;
    return n;
  };

  it("jamais proposées en automne, même quand elles sont la seule paire du dressing (pas de repli « hors saison »)", () => {
    for (const occ of ["quotidien", "festive", "evenement_perso", "date", "soiree", "voyage"] as OccasionKey[])
      expect(sorties([...sansChaussures, sandalesEte("Sandales", "Sandales" as ShoeType)], occ, 17), occ).toBe(0);
  });

  it("même des sandales à talons déclarées pour l'été, pour une sortie festive : l'exemption ne les touche pas", () => {
    expect(sorties([...sansChaussures, sandalesEte("Sandales à talons", "Sandales à talons" as ShoeType)], "festive", 17)).toBe(0);
    expect(sorties([...POOL.filter((i) => i.id !== SANDALES), sandalesEte("Sandales à talons", "Sandales à talons" as ShoeType)], "evenement_perso", 17)).toBe(0);
  });

  it("elles reviennent l'été, et dès que l'utilisatrice les déclare aussi pour l'automne", () => {
    const wEte = weatherForDay(26, "Ensoleillé", "Été" as never);
    // Les vêtements du pool de test sont d'automne : on les ouvre à toute l'année pour que la tenue d'été se compose.
    const toutesSaisons = sansChaussures.map((i) => ({ ...i, season: "Toutes saisons", saisons: ["Printemps", "Été", "Automne", "Hiver"] }) as Item);
    let n = 0;
    for (let i = 0; i < 150; i++) if (generateOutfitWithFallback([...toutesSaisons, sandalesEte("Sandales", "Sandales" as ShoeType)], wEte, "quotidien", "Présentiel", "Verre", [], "femme", null).ids.includes(REELLE)) n++;
    expect(n).toBeGreaterThan(0);
    const aussiAutomne = p(REELLE, "chaussures", "Sandales", { season: "Toutes saisons", saisons: ["Été", "Automne"], shoeType: "Sandales" as ShoeType });
    expect(sorties([...sansChaussures, aussiAutomne], "quotidien", 17)).toBeGreaterThan(0);
  });

  it("le levier saisonDeclareeRelachee rend le comportement d'avant (repli hors saison)", () => {
    const w = weatherForDay(17, "Nuageux", "Automne");
    let n = 0;
    for (let i = 0; i < 150; i++)
      if (generateOutfitWithFallback([...sansChaussures, sandalesEte("Sandales", "Sandales" as ShoeType)], w, "quotidien", "Présentiel", "Verre", [], "femme", null, { saisonDeclareeRelachee: true }).ids.includes(REELLE)) n++;
    expect(n).toBeGreaterThan(0);
  });
});
