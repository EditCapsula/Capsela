import { describe, expect, it } from "vitest";
import { computeDefaultCapsule } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import { EMPTY_PROFILE, type Profile } from "../profile";
import { estDansLUnivers, filtrerParUnivers } from "../univers";
import { at, item } from "./fixtures";

/** L'UNIVERS DU PROFIL FILTRE AVANT LE SCORE (12/11/2026, univers.ts, brief 2.3 point 2.3). */
const T = "Printemps, Été, Automne, Hiver";
const profil = (gender: Profile["gender"]): Profile => ({ ...EMPTY_PROFILE, gender });

describe("estDansLUnivers", () => {
  it("garde l'unisexe et les pièces sans genre (le dressing) dans les deux univers, jamais l'autre univers", () => {
    expect(estDansLUnivers({ genre: "unisexe" }, "homme")).toBe(true);
    expect(estDansLUnivers({}, "homme")).toBe(true);
    expect(estDansLUnivers({ genre: "femme" }, "homme")).toBe(false);
    expect(estDansLUnivers({ genre: "homme" }, "femme")).toBe(false);
    expect(estDansLUnivers({ genre: "femme" }, "femme")).toBe(true);
  });

  it("sans genre au profil, jamais le catalogue féminin par défaut : l'unisexe seul", () => {
    const pieces = [{ id: 1, genre: "femme" }, { id: 2, genre: "homme" }, { id: 3, genre: "unisexe" }, { id: 4 }];
    expect(filtrerParUnivers(pieces, null).map((p) => p.id)).toEqual([3, 4]);
  });
});

describe("capsule", () => {
  it("un profil homme ne reçoit aucune pièce femme, même quand il reste moins de 16 pièces (garde-fou retiré)", () => {
    const pool = [
      ...Array.from({ length: 30 }, (_, k) => item({ id: 1000 + k, category: k % 2 ? "robes" : "hauts", name: `Pièce femme ${k}`, genre: "femme", saison_capsule: T })),
      item({ id: 2000, category: "hauts", name: "T-shirt homme", genre: "homme", saison_capsule: T }),
      item({ id: 2001, category: "pantalons", name: "Chino homme", genre: "homme", saison_capsule: T }),
      item({ id: 2002, category: "chaussures", name: "Baskets", sous_type: "Baskets", genre: "unisexe", saison_capsule: T }),
    ];
    const capsule = computeDefaultCapsule(profil("homme"), at(18, "Printemps / Été"), [], "Printemps", pool);
    expect(capsule.length).toBeGreaterThan(0);
    expect(capsule.some((p) => p.genre === "femme")).toBe(false);
  });
});

describe("moteur de tenues", () => {
  it("écarte une pièce de l'autre univers avant le score, quel que soit le pool reçu", () => {
    const pool = [
      item({ id: 1, category: "hauts", name: "Blouse", genre: "femme", couleur_dominante: "Blanc", saison_capsule: T }),
      item({ id: 2, category: "jupes", name: "Jupe midi", genre: "femme", saison_capsule: T }),
      item({ id: 3, category: "hauts", name: "T-shirt", genre: "homme", couleur_dominante: "Blanc", saison_capsule: T }),
      item({ id: 4, category: "pantalons", name: "Chino", genre: "homme", couleur_dominante: "Beige", saison_capsule: T }),
      item({ id: 5, category: "chaussures", name: "Baskets", sous_type: "Baskets", genre: "unisexe", saison_capsule: T }),
    ];
    const femmes = new Set(pool.filter((p) => p.genre === "femme").map((p) => p.id));
    const hommes = new Set(pool.filter((p) => p.genre === "homme").map((p) => p.id));
    const w = at(18, "Printemps / Été");
    const homme = generateOutfitWithFallback(pool, w, "quotidien", "Présentiel", "Verre", [], "homme");
    expect(homme.ids.length).toBeGreaterThan(0);
    expect(homme.ids.some((id) => femmes.has(id))).toBe(false);
    const femme = generateOutfitWithFallback(pool, w, "quotidien", "Présentiel", "Verre", [], "femme");
    expect(femme.ids.some((id) => hommes.has(id))).toBe(false);
    const sansGenre = generateOutfitWithFallback(pool, w, "quotidien", "Présentiel", "Verre", [], null);
    expect(sansGenre.ids.some((id) => femmes.has(id) || hommes.has(id))).toBe(false);
  });
});
