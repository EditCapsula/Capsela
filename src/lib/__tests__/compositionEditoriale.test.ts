import { describe, expect, it } from "vitest";
import { CONFIGURATIONS_EDITORIALES, composerTenue, type EmplacementEditorial } from "../compositionEditoriale";
import type { CategoryKey } from "../types";

const seChevauchent = (a: EmplacementEditorial, b: EmplacementEditorial) =>
  a.x < b.x + b.cote && b.x < a.x + a.cote && a.y < b.y + b.cote && b.y < a.y + a.cote;

describe("CONFIGURATIONS_EDITORIALES — une vraie composition, pas une grille", () => {
  for (const [n, c] of Object.entries(CONFIGURATIONS_EDITORIALES)) {
    const toutes = [...c.principales, c.chaussures, c.sac, ...c.petits];

    it(`${n} pièce(s) principale(s) : aucun emplacement n'en recouvre un autre, tous dans la largeur`, () => {
      for (let i = 0; i < toutes.length; i++) {
        expect(toutes[i].x).toBeGreaterThanOrEqual(0);
        expect(toutes[i].x + toutes[i].cote).toBeLessThanOrEqual(100);
        for (let j = i + 1; j < toutes.length; j++) expect(seChevauchent(toutes[i], toutes[j]), `${i}/${j}`).toBe(false);
      }
    });

    it(`${n} pièce(s) principale(s) : la hiérarchie du brief`, () => {
      const ref = c.principales[0].cote;
      const r = (e: EmplacementEditorial) => e.cote / ref;
      for (const p of c.principales.slice(1)) expect(r(p)).toBeGreaterThanOrEqual(0.8);
      expect(r(c.chaussures)).toBeGreaterThanOrEqual(0.55);
      expect(r(c.chaussures)).toBeLessThanOrEqual(0.65);
      expect(r(c.sac)).toBeGreaterThanOrEqual(0.45);
      expect(r(c.sac)).toBeLessThanOrEqual(0.55);
      for (const p of c.petits) {
        expect(r(p)).toBeGreaterThanOrEqual(0.35);
        expect(r(p)).toBeLessThanOrEqual(0.45);
      }
    });
  }
});

let n = 0;
const p = (cat: CategoryKey) => ({ id: ++n, cat });

describe("composerTenue — la place selon la catégorie et les pièces présentes", () => {
  it("manteau + robe + sac + bottes : manteau à gauche, robe à droite, sac et chaussures en bas", () => {
    const [manteau, robe, sac, bottes] = [p("manteau"), p("robe"), p("sac"), p("chaussures")];
    const { pieces } = composerTenue([robe, bottes, sac, manteau]);
    const de = (id: number) => pieces.find((x) => x.item.id === id)!.case;
    expect(de(manteau.id).x).toBeLessThan(de(robe.id).x);
    expect(de(manteau.id).cote).toBeGreaterThan(de(robe.id).cote);
    expect(de(sac.id).y).toBeGreaterThan(de(manteau.id).y + de(manteau.id).cote - 1);
    expect(de(bottes.id).y).toBeGreaterThan(de(robe.id).y + de(robe.id).cote - 1);
  });

  it("robe + ballerines + sac : la robe domine, au centre", () => {
    const [robe, ballerines, sac] = [p("robe"), p("chaussures"), p("sac")];
    const { pieces } = composerTenue([ballerines, sac, robe]);
    const r = pieces.find((x) => x.item.id === robe.id)!.case;
    expect(r.x + r.cote / 2).toBeCloseTo(50, 0);
    expect(Math.max(...pieces.map((x) => x.case.cote))).toBe(r.cote);
  });

  it("toutes les pièces d'une tenue chargée sont posées, sans chevauchement, et la hauteur est leur étendue", () => {
    const tenue = [p("manteau"), p("haut"), p("pull"), p("jean"), p("chaussures"), p("sac"), p("bijou"), p("accessoire")];
    const { pieces, hauteur } = composerTenue(tenue);
    expect(pieces).toHaveLength(tenue.length);
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) expect(seChevauchent(pieces[i].case, pieces[j].case)).toBe(false);
    expect(hauteur).toBe(Math.max(...pieces.map((x) => x.case.y + x.case.cote)));
  });
});
