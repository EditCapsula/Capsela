import { describe, expect, it } from "vitest";
import { candidatsDeRemplacement, generateOutfit } from "../logic";
import { tenueDeSport, vaAvecLeSport, vetementDeSport } from "../attributes";
import { choisir, piecesComposees, piecesParEmplacement, selectionDeDepart, type EntreeCapsule } from "../capsuleOnglets";
import { at, item } from "./fixtures";
import type { Item } from "../types";

/**
 * R-S30 (20/11/2026, demandé en capture d'une brassière sur une jupe, un trench et des collants : « pas de brassière ou tenue de sport avec
 * des pièces non sport »). Mesuré avant / après dans la même exécution (levier sportAvecNonSport), sur le même pool.
 */
const T = "Automne, Hiver";
const brassiere = item({ id: 1, category: "hauts", name: "Brassière noire", sous_type: "Brassière", couleur_dominante: "Noir", saison_capsule: T });
const tshirt = item({ id: 2, category: "hauts", name: "Chemise blanche", sous_type: "Chemise", couleur_dominante: "Blanc", saison_capsule: T });
const teeShirt = item({ id: 9, category: "hauts", name: "T-shirt gris", sous_type: "T-shirt", couleur_dominante: "Gris", saison_capsule: T });
const jupe = item({ id: 3, category: "jupe", name: "Jupe midi chocolat", sous_type: "Jupe", couleur_dominante: "Chocolat", saison_capsule: T });
const legging = item({ id: 4, category: "pantalon", name: "Legging noir", sous_type: "Legging", couleur_dominante: "Noir", saison_capsule: T });
const sweat = item({ id: 5, category: "pull", name: "Sweat gris", sous_type: "Sweat", couleur_dominante: "Gris", saison_capsule: T });
const baskets = item({ id: 6, category: "chaussures", name: "Baskets blanches", sous_type: "Baskets", couleur_dominante: "Blanc", saison_capsule: T });
const pool = [brassiere, tshirt, jupe, legging, sweat, baskets] as Item[];
const tirages = (leviers?: { sportAvecNonSport?: boolean }) =>
  Array.from({ length: 300 }, () => generateOutfit(pool, at(12), "all", "Présentiel", "Verre", [], "femme", undefined, undefined, undefined, leviers as never).ids);
const avec = (ids: number[], ...p: Item[]) => p.every((x) => ids.includes(x.id));

describe("tenueDeSport : le sport au sens strict", () => {
  it("brassière, legging, jogging le sont ; un sweat est un vêtement de sport sans être une tenue de sport stricte", () => {
    expect(tenueDeSport(brassiere as Item)).toBe(true);
    expect(tenueDeSport(legging as Item)).toBe(true);
    expect(tenueDeSport(sweat as Item)).toBe(false);
    expect(vetementDeSport(sweat as Item)).toBe(true);
    expect(tenueDeSport(jupe as Item)).toBe(false);
    expect(vaAvecLeSport(teeShirt as Item)).toBe(true);
    expect(vaAvecLeSport(tshirt as Item)).toBe(false);
  });
});

describe("le moteur : une tenue de sport ne reçoit que des pièces de sport", () => {
  it("avant / après, même pool, 300 tirages : la brassière sur une jupe, plus jamais", () => {
    const avant = tirages({ sportAvecNonSport: true }).filter((ids) => avec(ids, brassiere as Item, jupe as Item)).length;
    const apres = tirages().filter((ids) => avec(ids, brassiere as Item, jupe as Item)).length;
    expect(avant).toBeGreaterThan(0);
    expect(apres).toBe(0);
  });
  it("la brassière reste proposée, avec le legging ; le legging, jamais sous une chemise", () => {
    const apres = tirages();
    expect(apres.some((ids) => avec(ids, brassiere as Item, legging as Item))).toBe(true);
    expect(apres.some((ids) => avec(ids, tshirt as Item, legging as Item))).toBe(false);
  });
  it("sans bas de sport, la brassière n'est pas tirée (la tenue ne reste jamais sans bas)", () => {
    const sansLegging = pool.filter((i) => i.id !== legging.id);
    for (let k = 0; k < 100; k++) {
      const r = generateOutfit(sansLegging, at(12), "all", "Présentiel", "Verre", [], "femme");
      expect(r.ids).not.toContain(brassiere.id);
    }
  });
});

describe("une base qui se porte aussi pour le sport", () => {
  it("un t-shirt accompagne un legging", () => {
    const r = Array.from({ length: 300 }, () => generateOutfit([teeShirt, legging, baskets] as Item[], at(12), "all", "Présentiel", "Verre", [], "femme").ids);
    expect(r.some((ids) => avec(ids, teeShirt as Item, legging as Item))).toBe(true);
  });
});

describe("Remplacer : symétrique", () => {
  it("le bas d'une tenue avec une brassière : des bas de sport seulement", () => {
    const c = candidatsDeRemplacement([brassiere, legging, baskets] as Item[], pool, legging.id, "pantalon", "quotidien");
    expect(c.map((i) => i.id)).not.toContain(jupe.id);
  });
  it("le haut d'une tenue avec une jupe : jamais une brassière", () => {
    const c = candidatsDeRemplacement([tshirt, jupe, baskets] as Item[], pool, tshirt.id, "haut", "quotidien");
    expect(c.map((i) => i.id)).not.toContain(brassiere.id);
  });
});

describe("Composer : pas de brassière avec une jupe", () => {
  const trench = item({ id: 7, category: "manteau", name: "Trench camel", sous_type: "Trench", couleur_dominante: "Camel", saison_capsule: T });
  const collants = item({ id: 8, category: "accessoire", name: "Collants noirs", sous_type: "Collants", couleur_dominante: "Noir", saison_capsule: T });
  const sugg = (it: Item): EntreeCapsule => ({ item: it, possedee: false });
  const groupes = piecesParEmplacement([brassiere, tshirt, jupe, legging, trench, baskets, collants].map((i) => sugg(i as Item)));
  const ids = (sel: Parameters<typeof piecesComposees>[1]) => piecesComposees(groupes, sel).map((e) => e.item.id);
  const i = (cle: keyof typeof groupes, id: number) => groupes[cle].findIndex((e) => e.item.id === id);
  it("les collants du test sont bien reconnus comme collants", () => {
    expect((collants as Item).accessoireType).toBe("Collants");
  });
  it("poser la brassière fait passer le bas en legging, retire le trench et les collants", () => {
    const sel = choisir({ haut: i("haut", tshirt.id), bas: i("bas", jupe.id), dessus: i("dessus", trench.id), chaussures: 0, accessoire: i("accessoire", collants.id) }, "haut", i("haut", brassiere.id), groupes);
    expect(ids(sel)).toEqual(expect.arrayContaining([brassiere.id, legging.id]));
    expect(ids(sel)).not.toContain(jupe.id);
    expect(ids(sel)).not.toContain(trench.id);
    expect(ids(sel)).not.toContain(collants.id);
  });
  it("choisir la jupe remplace la brassière par un haut de ville", () => {
    const sel = choisir({ haut: i("haut", brassiere.id), bas: i("bas", legging.id), chaussures: 0 }, "bas", i("bas", jupe.id), groupes);
    expect(ids(sel)).toEqual(expect.arrayContaining([tshirt.id, jupe.id]));
    expect(ids(sel)).not.toContain(brassiere.id);
  });
  it("la composition de départ ne commence pas par une brassière sur une jupe", () => {
    const sel = selectionDeDepart(groupes, "Automne");
    const poses = ids(sel);
    expect(poses.includes(brassiere.id) && poses.includes(jupe.id)).toBe(false);
  });
});
