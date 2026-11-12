import { describe, expect, it } from "vitest";
import { alternativesClassees, lienAffiliationValide, poolDeRemplacement, remplacerDansIds, type ContexteLook } from "../remplacementPiece";
import type { Item } from "../types";
import { at, item } from "./fixtures";

/** Le remplacement d'une pièce d'un look (12/11/2026, remplacementPiece.ts). */
const T = "Printemps, Été, Automne, Hiver";
const dressing = (id: number, cat: Item["cat"], name: string, color = "Noir", hex = "#1D1A16"): Item => ({ id, cat, name, color, hex, worn: null }) as Item;

describe("provenance", () => {
  const perso = dressing(1, "haut", "T-shirt");
  const suggestion = item({ id: 50, category: "hauts", name: "Chemise", saison_capsule: T });
  it("une pièce du dressing se remplace dans le dressing ; une suggestion, dans le dressing et la capsule", () => {
    expect(poolDeRemplacement(perso, [perso, dressing(2, "haut", "Pull")], [suggestion]).map((p) => p.id)).toEqual([1, 2]);
    expect(poolDeRemplacement(suggestion, [perso], [suggestion, suggestion]).map((p) => p.id)).toEqual([1, suggestion.id]);
  });
});

describe("remplacerDansIds", () => {
  it("remplace la pièce à sa place, sans toucher aux autres ; jamais un doublon", () => {
    expect(remplacerDansIds([1, 2, 3], 2, 9)).toEqual([1, 9, 3]);
    expect(remplacerDansIds([1, 2, 3], 2, 3)).toEqual([1, 2, 3]);
    expect(remplacerDansIds([1, 2, 3], 7, 9)).toEqual([1, 2, 3]);
  });
});

describe("lien d'affiliation", () => {
  it("seulement une adresse http(s) valide", () => {
    expect(lienAffiliationValide("https://boutique.example/p/1")).toBe("https://boutique.example/p/1");
    expect(lienAffiliationValide("javascript:alert(1)")).toBeNull();
    expect(lienAffiliationValide("pas un lien")).toBeNull();
    expect(lienAffiliationValide(undefined)).toBeNull();
  });
});

describe("alternativesClassees", () => {
  const w = at(18, "Printemps / Été");
  const c: ContexteLook = { occasion: "quotidien", workMode: "Présentiel", dateContext: "Verre", weather: w, palette: [], morphology: null, colorimetrie: null, gender: "femme" };
  const haut = item({ id: 1, category: "hauts", name: "T-shirt blanc", couleur_dominante: "Blanc", saison_capsule: T, manches: "courtes" });
  const pantalon = item({ id: 2, category: "pantalons", name: "Pantalon noir", saison_capsule: T });
  const chaussures = item({ id: 3, category: "chaussures", name: "Baskets blanches", sous_type: "Baskets", couleur_dominante: "Blanc", saison_capsule: T });
  const look = [haut, pantalon, chaussures];
  it("exclut la pièce touchée et celles du look ; la même catégorie d'abord", () => {
    const pool = [
      haut,
      pantalon,
      chaussures,
      item({ id: 4, category: "jupes", name: "Jupe noire", saison_capsule: T }),
      item({ id: 5, category: "pantalons", name: "Jean brut", couleur_dominante: "Denim", saison_capsule: T }),
    ];
    const alts = alternativesClassees(look, pantalon, pool, c);
    expect(alts.length).toBeGreaterThan(0);
    expect(alts.map((p) => p.id)).not.toContain(pantalon.id);
    expect(alts.map((p) => p.id)).not.toContain(haut.id);
    expect(alts[0]?.cat).toBe("pantalon");
  });
});
