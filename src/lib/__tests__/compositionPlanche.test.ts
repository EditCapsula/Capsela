import { describe, expect, it } from "vitest";
import { GABARITS_PLANCHE, PROFONDEUR_PLANCHE, composerPlanche, type EmplacementPlanche, type RolePlanche } from "../compositionEditoriale";
import type { CategoryKey } from "../types";

// La planche des heros « Look du jour », « Tenue du jour », « Tenue planifiée » (30/09/2026).

const aire = (e: EmplacementPlanche) => e.l * e.h;
const recouvrement = (a: EmplacementPlanche, b: EmplacementPlanche) =>
  Math.max(0, Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
let id = 0;
const p = (cat: CategoryKey, photoUrl?: string) => ({ id: ++id, cat, photoUrl });

describe("GABARITS_PLANCHE — une silhouette hiérarchisée, pas une grille", () => {
  for (const [nom, g] of Object.entries(GABARITS_PLANCHE)) {
    const autres = [g.dessus, g.bas, g.chaussures, g.sac, ...g.petits].filter((e): e is EmplacementPlanche => Boolean(e));

    it(`${nom} : tout dans la largeur`, () => {
      for (const e of [g.hero, ...autres]) {
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.x + e.l).toBeLessThanOrEqual(100);
      }
    });

    it(`${nom} : héro > surcouche > bas > chaussures ≥ sac > accessoires`, () => {
      for (const e of autres) expect(aire(g.hero)).toBeGreaterThan(aire(e));
      if (g.dessus && g.bas) expect(aire(g.dessus)).toBeGreaterThan(aire(g.bas));
      if (g.dessus) expect(aire(g.dessus)).toBeGreaterThan(aire(g.chaussures));
      if (g.bas) expect(aire(g.bas)).toBeGreaterThan(aire(g.chaussures));
      expect(aire(g.chaussures)).toBeGreaterThanOrEqual(aire(g.sac));
      for (const e of g.petits) expect(aire(e)).toBeLessThan(aire(g.sac));
    });

    it(`${nom} : des chevauchements légers — la pièce de derrière reste aux deux tiers visible, le héro à 85 %`, () => {
      const poses: [RolePlanche, EmplacementPlanche][] = [["hero", g.hero], ["chaussures", g.chaussures], ["sac", g.sac]];
      if (g.dessus) poses.push(["dessus", g.dessus]);
      if (g.bas) poses.push(["bas", g.bas]);
      g.petits.forEach((e) => poses.push(["petit", e]));
      let heroCache = 0;
      for (let i = 0; i < poses.length; i++)
        for (let j = i + 1; j < poses.length; j++) {
          const [ri, ei] = poses[i];
          const [rj, ej] = poses[j];
          const derriere = PROFONDEUR_PLANCHE[ri] <= PROFONDEUR_PLANCHE[rj] ? ei : ej;
          const r = recouvrement(ei, ej);
          expect(r, `${ri}/${rj}`).toBeLessThanOrEqual(aire(derriere) / 3);
          if (derriere === g.hero) heroCache += r;
        }
      expect(heroCache).toBeLessThanOrEqual(aire(g.hero) * 0.15);
    });
  }
});

describe("composerPlanche — les rôles lus sur la tenue réelle", () => {
  const roles = (items: ReturnType<typeof p>[]) => new Map(composerPlanche(items).pieces.map((x) => [x.item.id, x.role]));

  it("le haut photographié porté devient le héro, même s'il n'est pas le premier", () => {
    const [simple, porte] = [p("haut"), p("haut", "https://photo")];
    const r = roles([simple, porte, p("jupe"), p("chaussures")]);
    expect(r.get(porte.id)).toBe("hero");
    // L'autre haut est porté par-dessus, faute de veste.
    expect(r.get(simple.id)).toBe("dessus");
  });

  it("une robe est le héro ; veste et manteau sont des surcouches, pas des accessoires", () => {
    const robe = p("robe");
    const veste = p("veste");
    const r = roles([veste, p("sac"), robe, p("chaussures")]);
    expect(r.get(robe.id)).toBe("hero");
    expect(r.get(veste.id)).toBe("dessus");
  });

  it("le manteau prend le gabarit du manteau ; sans surcouche, aucun emplacement ne l'attend", () => {
    const avec = composerPlanche([p("haut"), p("pantalon"), p("manteau"), p("chaussures"), p("sac")]);
    expect(avec.pieces.map((x) => x.role).sort()).toEqual(["bas", "chaussures", "dessus", "hero", "sac"]);
    const sans = composerPlanche([p("haut"), p("pantalon"), p("chaussures")]);
    expect(sans.pieces.map((x) => x.role).sort()).toEqual(["bas", "chaussures", "hero"]);
  });

  it("chaque pièce présente est posée une fois, dans la planche, surcouche derrière et accessoires devant", () => {
    const items = [p("bijou"), p("sac"), p("chaussures"), p("jean"), p("veste"), p("haut", "https://photo")];
    const { pieces, hauteur } = composerPlanche(items);
    expect(pieces).toHaveLength(items.length);
    for (const { case: c } of pieces) {
      expect(c.x).toBeGreaterThanOrEqual(-1e-9);
      expect(c.x + c.l).toBeLessThanOrEqual(100 + 1e-9);
      expect(c.y + c.h).toBeLessThanOrEqual(hauteur + 1e-9);
    }
    const ordre = pieces.map((x) => x.role);
    expect(ordre[0]).toBe("dessus");
    expect(ordre.indexOf("hero")).toBeLessThan(ordre.indexOf("bas"));
    expect(ordre.slice(-2).sort()).toEqual(["chaussures", "sac"]);
  });

  it("une tenue vide ne pose rien", () => {
    expect(composerPlanche([])).toEqual({ pieces: [], hauteur: 0 });
  });
});
