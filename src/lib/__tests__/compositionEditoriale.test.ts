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
    expect(Math.abs(r.x + r.cote / 2 - 50)).toBeLessThan(3);
    expect(Math.max(...pieces.map((x) => x.case.cote))).toBe(r.cote);
  });

  it("toutes les pièces d'une tenue chargée sont posées, sans chevauchement, et la hauteur est leur étendue", () => {
    const tenue = [p("manteau"), p("haut"), p("pull"), p("jean"), p("chaussures"), p("sac"), p("bijou"), p("accessoire")];
    const { pieces, hauteur } = composerTenue(tenue);
    expect(pieces).toHaveLength(tenue.length);
    for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) expect(seChevauchent(pieces[i].case, pieces[j].case)).toBe(false);
    expect(hauteur).toBeCloseTo(Math.max(...pieces.map((x) => x.case.y + x.case.cote)), 6);
  });

  it("recadrée : centrée, sans marge d'un seul côté, agrandie au plus de 15 %", () => {
    const tenue = [p("robe"), p("chaussures"), p("sac")];
    const { pieces } = composerTenue(tenue);
    const gauche = Math.min(...pieces.map((x) => x.case.x));
    const droite = 100 - Math.max(...pieces.map((x) => x.case.x + x.case.cote));
    expect(gauche).toBeCloseTo(droite, 5);
    expect(Math.min(...pieces.map((x) => x.case.y))).toBe(0);
    const robe = pieces.find((x) => x.item.cat === "robe")!.case;
    expect(robe.cote).toBeLessThanOrEqual(CONFIGURATIONS_EDITORIALES[1].principales[0].cote * 1.15 + 1e-9);
  });

  it("chaque image se cale vers le centre : le manteau de gauche à droite de sa case, la robe de droite à gauche", () => {
    const [manteau, robe] = [p("manteau"), p("robe")];
    const { pieces } = composerTenue([manteau, robe, p("chaussures"), p("sac")]);
    expect(pieces.find((x) => x.item.id === manteau.id)!.aligne.x).toBe("fin");
    expect(pieces.find((x) => x.item.id === robe.id)!.aligne.x).toBe("debut");
  });
});
