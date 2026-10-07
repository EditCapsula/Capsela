import { describe, expect, it } from "vitest";
import { MARGE_SECURITE, attribuerRoles, composerFlatLay, generateur, type PieceFlatLay } from "../flatLay";
import type { CategoryKey } from "../types";

let n = 0;
const p = (cat: CategoryKey, ratio = 0.8): PieceFlatLay => ({ id: ++n, cat, ratio });
const roles = (pieces: PieceFlatLay[]) => Object.fromEntries(attribuerRoles(pieces).map((r) => [r.piece.cat, r.role]));

describe("attribuerRoles — la pièce héro suit l'ordre du brief", () => {
  it("robe > manteau > veste > pantalon/jupe > top", () => {
    expect(roles([p("robe"), p("manteau"), p("veste"), p("haut")]).robe).toBe("hero");
    expect(roles([p("manteau"), p("veste"), p("pantalon"), p("pull")]).manteau).toBe("hero");
    expect(roles([p("veste"), p("pantalon"), p("haut")]).veste).toBe("hero");
    expect(roles([p("pantalon"), p("haut")]).pantalon).toBe("hero");
    expect(roles([p("haut")]).haut).toBe("hero");
  });
  it("une combinaison compte comme une robe", () => {
    expect(roles([p("combinaison"), p("sac")]).combinaison).toBe("hero");
  });
  it("sous une veste : le haut est le second plan, le bas le bas, puis chaussures, sac et accessoires", () => {
    const r = roles([p("veste"), p("haut"), p("pantalon"), p("chaussures"), p("sac"), p("bijou")]);
    expect(r).toMatchObject({ veste: "hero", haut: "secondaire", pantalon: "bas", chaussures: "chaussures", sac: "sac", bijou: "accessoire" });
  });
  it("chaque pièce a un seul rôle", () => {
    const pieces = [p("veste"), p("manteau"), p("haut"), p("pull"), p("pantalon"), p("jupe"), p("sac"), p("chaussures"), p("bijou"), p("accessoire")];
    const sortie = attribuerRoles(pieces);
    expect(sortie.length).toBe(pieces.length);
    expect(new Set(sortie.map((s) => s.piece.id)).size).toBe(pieces.length);
  });
});

describe("composerFlatLay — déterministe, borné, sans grille", () => {
  const look = () => [p("veste", 0.9), p("haut", 0.9), p("pantalon", 0.5), p("chaussures", 1.3), p("sac", 1), p("bijou", 1.2)];

  it("la même graine donne exactement la même composition", () => {
    const pieces = look();
    expect(composerFlatLay(pieces, "12,15,40")).toEqual(composerFlatLay(pieces, "12,15,40"));
  });

  it("des graines différentes donnent des compositions différentes", () => {
    const pieces = look();
    const vues = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(composerFlatLay(pieces, "look-" + i).pieces.map((q) => [Math.round(q.x), Math.round(q.angle)]))));
    expect(vues.size).toBeGreaterThan(6);
  });

  it("les inclinaisons restent dans les plages du brief (pièce de rang : héro ±4, secondaire ±5, chaussures ±8, sac ±6, accessoires ±10)", () => {
    const lim = { hero: 4, secondaire: 5, bas: 4, chaussures: 8, sac: 6, accessoire: 10 } as const;
    for (let i = 0; i < 40; i++)
      for (const q of composerFlatLay(look(), "g" + i).pieces) expect(Math.abs(q.angle)).toBeLessThanOrEqual(lim[q.role] + 1e-9);
  });

  it("tout reste dans la zone de sécurité, et la pièce héro est la plus grande (hors pièces très hautes)", () => {
    for (let i = 0; i < 40; i++) {
      const { pieces } = composerFlatLay(look(), "z" + i);
      for (const q of pieces) {
        expect(q.x - q.l / 2).toBeGreaterThanOrEqual(MARGE_SECURITE - 6);
        expect(q.x + q.l / 2).toBeLessThanOrEqual(100 - MARGE_SECURITE + 6);
      }
      const hero = pieces.find((q) => q.role === "hero")!;
      for (const q of pieces) if (q.role !== "hero") expect(hero.l).toBeGreaterThanOrEqual(q.l);
    }
  });

  it("le sac et les chaussures ne sont jamais insignifiants (≥ 20 % de la largeur)", () => {
    for (let i = 0; i < 40; i++)
      for (const q of composerFlatLay(look(), "s" + i).pieces) if (q.role === "sac" || q.role === "chaussures") expect(q.l).toBeGreaterThanOrEqual(20);
  });

  it("le haut est sous la veste, la veste sur le bas, chaussures et sac au-dessus", () => {
    const z = Object.fromEntries(composerFlatLay(look(), "z").pieces.map((q) => [q.role, q.z]));
    expect(z.secondaire).toBeLessThan(z.bas);
    expect(z.bas).toBeLessThan(z.hero);
    expect(z.hero).toBeLessThan(z.chaussures);
    expect(z.chaussures).toBeLessThan(z.sac);
  });

  it("aucune pièce : rien", () => {
    expect(composerFlatLay([], "x").pieces).toEqual([]);
  });
});

describe("generateur — stable", () => {
  it("rend la même suite pour la même graine", () => {
    const a = generateur("abc");
    const b = generateur("abc");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
