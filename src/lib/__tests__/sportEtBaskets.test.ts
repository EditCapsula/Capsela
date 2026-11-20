import { describe, expect, it } from "vitest";
import { candidatsDeRemplacement, generateOutfit } from "../logic";
import { avancer, choisir, piecesComposees, piecesParEmplacement, type EntreeCapsule } from "../capsuleOnglets";
import { at, item } from "./fixtures";
import type { Item } from "../types";

/**
 * R-S29 (20/11/2026, demandé : « pas de pantalon de sport ou de haut de sport avec des chaussures autres que des baskets »). Mesuré avant /
 * après dans la même exécution (levier chaussuresLibresAvecSport), sur le même pool.
 */
const T = "Automne, Hiver";
const jogging = item({ id: 1, category: "pantalon", name: "Pantalon de jogging gris", sous_type: "Jogging", couleur_dominante: "Gris", saison_capsule: T, niveau_formalite: "sport" });
const pullFin = item({ id: 2, category: "hauts", name: "T-shirt manches longues noir", sous_type: "T-shirt", couleur_dominante: "Noir", saison_capsule: T });
const derbies = item({ id: 3, category: "chaussures", name: "Derbies noires", sous_type: "Derbies", couleur_dominante: "Noir", saison_capsule: T });
const baskets = item({ id: 4, category: "chaussures", name: "Baskets blanches", sous_type: "Baskets", couleur_dominante: "Blanc", saison_capsule: T });
const pool = [jogging, pullFin, derbies, baskets];
const tirages = (leviers?: { chaussuresLibresAvecSport?: boolean }) => {
  const sorties: number[][] = [];
  for (let i = 0; i < 200; i++) sorties.push(generateOutfit(pool, at(12), "all", "Présentiel", "Verre", [], "femme", undefined, undefined, undefined, leviers as never).ids);
  return sorties;
};

describe("le moteur : un vêtement de sport part avec des baskets", () => {
  it("avant / après, même pool, 200 tirages", () => {
    const avant = tirages({ chaussuresLibresAvecSport: true }).filter((ids) => ids.includes(jogging.id) && ids.includes(derbies.id)).length;
    const apres = tirages().filter((ids) => ids.includes(jogging.id) && ids.includes(derbies.id)).length;
    expect(avant).toBeGreaterThan(0);
    expect(apres).toBe(0);
  });
  it("le jogging reste proposé, avec les baskets", () => {
    expect(tirages().some((ids) => ids.includes(jogging.id) && ids.includes(baskets.id))).toBe(true);
  });
});

describe("Remplacer : symétrique du tirage", () => {
  it("les chaussures d'une tenue avec un jogging : des baskets seulement", () => {
    const c = candidatsDeRemplacement([jogging, pullFin, baskets] as Item[], pool as Item[], baskets.id, "chaussures", "quotidien");
    expect(c.map((i) => i.id)).not.toContain(derbies.id);
  });
  it("un bas de sport n'est pas proposé quand la tenue garde des derbies", () => {
    const toile = item({ id: 5, category: "pantalon", name: "Pantalon droit", sous_type: "Pantalon", couleur_dominante: "Noir", saison_capsule: T });
    const c = candidatsDeRemplacement([toile, pullFin, derbies] as Item[], [...pool, toile] as Item[], toile.id, "pantalon", "quotidien");
    expect(c.map((i) => i.id)).not.toContain(jogging.id);
  });
});

describe("Composer : pas de jogging avec des derbies", () => {
  const droit = item({ id: 6, category: "pantalon", name: "Pantalon droit noir", sous_type: "Pantalon", couleur_dominante: "Noir", saison_capsule: T });
  const sugg = (it: Item): EntreeCapsule => ({ item: it, possedee: false });
  const groupes = piecesParEmplacement([pullFin, droit, jogging, derbies, baskets].map((i) => sugg(i as Item)));
  const ids = (sel: Parameters<typeof piecesComposees>[1]) => piecesComposees(groupes, sel).map((e) => e.item.id);
  const iBas = (id: number) => groupes.bas.findIndex((e) => e.item.id === id);
  const iCh = (id: number) => groupes.chaussures.findIndex((e) => e.item.id === id);
  it("poser le jogging passe les chaussures en baskets", () => {
    const sel = choisir({ haut: 0, bas: iBas(droit.id), chaussures: iCh(derbies.id) }, "bas", iBas(jogging.id), groupes);
    expect(ids(sel)).toEqual(expect.arrayContaining([jogging.id, baskets.id]));
    expect(ids(sel)).not.toContain(derbies.id);
  });
  it("choisir les derbies remplace le jogging par un bas qui n'est pas de sport", () => {
    const sel = choisir({ haut: 0, bas: iBas(jogging.id), chaussures: iCh(baskets.id) }, "chaussures", iCh(derbies.id), groupes);
    expect(ids(sel)).toEqual(expect.arrayContaining([droit.id, derbies.id]));
    expect(ids(sel)).not.toContain(jogging.id);
  });
  it("les flèches ne posent jamais un jogging avec des derbies", () => {
    let sel = { haut: 0, bas: iBas(droit.id), chaussures: iCh(derbies.id) } as Parameters<typeof piecesComposees>[1];
    for (let i = 0; i < 12; i++) {
      sel = avancer(sel, i % 2 ? "bas" : "chaussures", groupes, 1);
      const p = ids(sel);
      expect(p.includes(jogging.id) && p.includes(derbies.id)).toBe(false);
    }
  });
});
