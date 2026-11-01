import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { chaussureHabillee } from "../attributes";
import { generateOutfitWithFallback } from "../logic";
import { composeWardrobePool } from "../selectors";
import type { CategoryKey, Item, ShoeType } from "../types";

// R-S25 (01/11/2026, demandé : « pour une sortie en soirée propose des chaussures habillées pour les femmes ; s'il n'y en a aucune,
// indique qu'une paire de chaussures pour couvrir l'occasion est manquante »). Avec et sans le levier, dans la même exécution.

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, matiere: "Coton", ...over }) as Item;
const soiree = ["soiree"] as Item["occasion"];
const ROBE = p(6001, "robe", "Robe nuisette", { occasion: soiree });
const BASKETS = p(6002, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType });
const MOCASSINS = p(6003, "chaussures", "Mocassins", { shoeType: "Mocassins" as ShoeType, niveauFormalite: 3 });
const BOTTINES_TALON = p(6004, "chaussures", "Bottines à talon", { shoeType: "Bottines" as ShoeType });
const automne = weatherForDay(15, "Nuageux", "Automne");
const tirer = (pool: Item[], genre: "femme" | "homme", sansRegle = false) =>
  generateOutfitWithFallback(pool, automne, "soiree", "Présentiel", "Verre", [], genre, null, sansRegle ? { sansChaussuresHabilleesEnSoiree: true } : undefined);

describe("chaussureHabillee", () => {
  it("talons et paires déclarées habillées ; ni mocassins business casual ni baskets", () => {
    expect(chaussureHabillee(p(1, "chaussures", "Escarpins", { shoeType: "Escarpins" as ShoeType }))).toBe(true);
    expect(chaussureHabillee(BOTTINES_TALON)).toBe(true);
    expect(chaussureHabillee(p(2, "chaussures", "Ballerines satinées", { niveauFormalite: 4 }))).toBe(true);
    expect(chaussureHabillee(MOCASSINS)).toBe(false);
    expect(chaussureHabillee(BASKETS)).toBe(false);
  });
});

describe("R-S25 — en soirée, des chaussures habillées pour une femme, ou la paire manquante", () => {
  it("sans paire habillée : aucune chaussure, et le manque est signalé", () => {
    for (let i = 0; i < 50; i++) {
      const r = tirer([ROBE, MOCASSINS], "femme");
      expect(r.ids).toContain(ROBE.id);
      expect(r.ids).not.toContain(MOCASSINS.id);
      expect(r.missingCats).toContain("chaussures");
    }
  });
  it("sans la règle, les mocassins passaient", () => {
    expect(tirer([ROBE, MOCASSINS], "femme", true).ids).toContain(MOCASSINS.id);
  });
  it("une paire habillée existe : c'est elle", () => {
    for (let i = 0; i < 50; i++) expect(tirer([ROBE, MOCASSINS, BOTTINES_TALON], "femme").ids).toContain(BOTTINES_TALON.id);
  });
  it("un profil homme n'est pas concerné", () => {
    expect(tirer([ROBE, MOCASSINS], "homme").ids).toContain(MOCASSINS.id);
  });
  it("la capsule relaie un dressing sans paire habillée", () => {
    const pool = composeWardrobePool([MOCASSINS], [BOTTINES_TALON], ["chaussures"], {
      completerPourOccasion: "soiree",
      exclureHorsOccasion: true,
      pieceAdaptee: true,
      genre: "femme",
    });
    expect(pool.map((i) => i.id)).toContain(BOTTINES_TALON.id);
  });
});
