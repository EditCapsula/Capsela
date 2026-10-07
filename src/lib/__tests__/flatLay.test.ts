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

  it("les inclinaisons suivent la maquette, à 1,5° près (au signe près si la planche est en miroir)", () => {
    const ref = { hero: 8, secondaire: -8, bas: -12, chaussures: -10, sac: -2 } as const;
    for (let i = 0; i < 40; i++)
      for (const q of composerFlatLay(look(), "g" + i).pieces) {
        if (q.role in ref) expect(Math.abs(q.angle - ref[q.role as keyof typeof ref])).toBeLessThanOrEqual(1.5 + 1e-9);
      }
  });

  it("une veste héro est toujours à droite, le haut à gauche, le bas entre les deux", () => {
    for (let i = 0; i < 40; i++) {
      const par = Object.fromEntries(composerFlatLay(look(), "d" + i).pieces.map((q) => [q.role, q]));
      expect(par.hero.x).toBeGreaterThan(par.bas.x);
      expect(par.bas.x).toBeGreaterThan(par.secondaire.x);
      expect(par.chaussures.x).toBeGreaterThan(par.sac.x);
    }
  });

  it("tout reste dans la zone, rotation comprise, avec la marge de sécurité, et le héro est la plus grande pièce", () => {
    for (let i = 0; i < 40; i++) {
      const { pieces } = composerFlatLay(look(), "z" + i, 112);
      for (const q of pieces) {
        const r = (Math.abs(q.angle) * Math.PI) / 180;
        const w = q.l * Math.cos(r) + q.h * Math.sin(r);
        const h = q.l * Math.sin(r) + q.h * Math.cos(r);
        expect(q.x - w / 2).toBeGreaterThanOrEqual(MARGE_SECURITE - 0.01);
        expect(q.x + w / 2).toBeLessThanOrEqual(100 - MARGE_SECURITE + 0.01);
        expect(q.y - h / 2).toBeGreaterThanOrEqual(MARGE_SECURITE - 0.01 + (112 - 112) / 2);
        expect(q.y + h / 2).toBeLessThanOrEqual(112 - MARGE_SECURITE + 0.01);
      }
    }
  });

  it("le sac et les chaussures ne sont jamais insignifiants (≥ 20 % de la largeur)", () => {
    for (let i = 0; i < 40; i++)
      for (const q of composerFlatLay(look(), "s" + i).pieces) if (q.role === "sac" || q.role === "chaussures") expect(q.l).toBeGreaterThanOrEqual(20);
  });

  it("la veste et le manteau sont toujours au fond, le bas puis le haut devant, puis chaussures, sac, accessoires", () => {
    const z = (pieces: PieceFlatLay[]) => Object.fromEntries(composerFlatLay(pieces, "z").pieces.map((q) => [pieces.find((x) => x.id === q.id)!.cat, q.z]));
    const a = z(look());
    expect(a.veste).toBeLessThan(a.pantalon);
    expect(a.pantalon).toBeLessThan(a.haut);
    expect(a.haut).toBeLessThan(a.chaussures);
    expect(a.chaussures).toBeLessThan(a.sac);
    expect(a.sac).toBeLessThan(a.bijou);
    // Même quand la veste n'est pas le héro (une robe) ou que le manteau est le second plan.
    const b = z([p("robe"), p("veste"), p("sac")]);
    expect(b.veste).toBeLessThan(b.robe);
    const c = z([p("pantalon"), p("manteau"), p("haut")]);
    expect(c.manteau).toBeLessThan(c.pantalon);
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
