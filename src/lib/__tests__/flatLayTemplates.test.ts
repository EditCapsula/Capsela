import { describe, expect, it } from "vitest";
import { CONTEXTES, composerFlatLay, type PieceFlatLay, type PlacementFlatLay } from "../flatLay";
import { CORRECTIONS_PIECES, GABARITS_TEMPLATES, HIERARCHIE_TEMPLATES, TEMPLATES, choisirTemplate, estBlazer, type PieceTemplate, type TemplateFlatLay } from "../flatLayTemplates";
import type { CategoryKey } from "../types";

const t = (cat: string, subtype?: string, name?: string): PieceTemplate => ({ cat, subtype, name });
const blazer = t("veste", "Blazer");
const veste = t("veste", "Veste en jean");

describe("choisirTemplate — sélection déterministe", () => {
  it("robe → template robe ; combinaison → template combinaison", () => {
    expect(choisirTemplate([t("robe"), t("chaussures"), t("sac")])).toBe("robe");
    expect(choisirTemplate([t("combinaison"), t("chaussures"), t("bijou")])).toBe("combinaison");
  });
  it("une robe l'emporte même avec une veste ou un blazer autour (la pièce unique décide)", () => {
    expect(choisirTemplate([t("robe"), blazer, t("chaussures"), t("sac")])).toBe("robe");
  });
  it("blazer + haut + chaussures + sac (+ accessoires) → blazer-chic, sans bas", () => {
    expect(choisirTemplate([blazer, t("haut"), t("chaussures"), t("sac"), t("bijou"), t("accessoire")])).toBe("blazer-chic");
  });
  it("blazer + haut + BAS + chaussures + sac → blazer-chic (le bas est intégré), jamais veste-dominante", () => {
    expect(choisirTemplate([blazer, t("haut"), t("pantalon"), t("chaussures"), t("sac")])).toBe("blazer-chic");
  });
  it("blazer + haut + bas SANS sac ou SANS chaussures → veste-dominante (≠ blazer-chic)", () => {
    expect(choisirTemplate([blazer, t("haut"), t("pantalon"), t("chaussures")])).toBe("veste-dominante");
    expect(choisirTemplate([blazer, t("haut"), t("pantalon"), t("sac")])).toBe("veste-dominante");
  });
  it("manteau + haut + bas → veste-dominante", () => {
    expect(choisirTemplate([t("manteau"), t("haut"), t("jean"), t("chaussures")])).toBe("veste-dominante");
  });
  it("une veste légère avec un haut et un bas → haut-bas-veste", () => {
    expect(choisirTemplate([veste, t("haut"), t("jean"), t("chaussures"), t("sac")])).toBe("haut-bas-veste");
  });
  it("deux ou trois pièces sans pièce dominante → minimaliste", () => {
    expect(choisirTemplate([t("haut"), t("pantalon")])).toBe("minimaliste");
    expect(choisirTemplate([t("haut"), t("pantalon"), t("chaussures")])).toBe("minimaliste");
  });
  it("pas de template adapté → null (repli : le moteur actuel)", () => {
    expect(choisirTemplate([t("haut"), t("pantalon"), t("chaussures"), t("sac")])).toBeNull();
    expect(choisirTemplate([t("haut")])).toBeNull();
    expect(choisirTemplate([])).toBeNull();
  });
  it("une catégorie inconnue ne casse rien et n'est comptée nulle part", () => {
    expect(choisirTemplate([t("zzz"), t("haut"), t("pantalon")])).toBe(choisirTemplate([t("haut"), t("pantalon")]));
    expect(choisirTemplate([t("haut"), t("pantalon"), t("chaussures"), t("zzz")])).toBe("minimaliste");
    expect(choisirTemplate([t("zzz")])).toBeNull();
    expect(choisirTemplate([t("robe"), t("zzz")])).toBe("robe");
  });
  it("un blazer se reconnaît à son sous-type ou à son nom, jamais à une autre veste", () => {
    expect(estBlazer(t("veste", "Blazer"))).toBe(true);
    expect(estBlazer(t("veste", undefined, "Veste de tailleur noire"))).toBe(true);
    expect(estBlazer(veste)).toBe(false);
    expect(estBlazer(t("manteau", "Blazer"))).toBe(false);
  });
  it("la hiérarchie est configurable et couvre les six templates, chacun une fois", () => {
    expect([...HIERARCHIE_TEMPLATES].sort()).toEqual([...TEMPLATES].sort());
    // Sans blazer-chic dans la hiérarchie, la même tenue tombe sur veste-dominante : la priorité décide, pas le hasard.
    const sansChic = HIERARCHIE_TEMPLATES.filter((x) => x !== "blazer-chic");
    expect(choisirTemplate([blazer, t("haut"), t("chaussures"), t("sac")], sansChic)).not.toBe("blazer-chic");
  });
  it("est stable : mêmes pièces, même ordre ou non, même template", () => {
    const a = [blazer, t("haut"), t("pantalon"), t("chaussures"), t("sac")];
    expect(choisirTemplate([...a].reverse())).toBe(choisirTemplate(a));
  });
});

let n = 100;
const p = (cat: CategoryKey, ratio = 0.8): PieceFlatLay => ({ id: ++n, cat, ratio });
const boite = (q: PlacementFlatLay) => ({ x0: q.x - q.l / 2, x1: q.x + q.l / 2, y0: q.y - q.h / 2, y1: q.y + q.h / 2 });

const LOOKS: Record<TemplateFlatLay, () => PieceFlatLay[]> = {
  "haut-bas-veste": () => [p("veste", 0.9), p("haut", 0.9), p("jean", 0.55), p("chaussures", 1.3), p("sac", 1)],
  robe: () => [p("robe", 0.5), p("chaussures", 1.3), p("sac", 1), p("bijou", 1.2)],
  combinaison: () => [p("combinaison", 0.5), p("chaussures", 1.3), p("sac", 1)],
  "veste-dominante": () => [p("veste", 0.9), p("haut", 0.9), p("pantalon", 0.5), p("chaussures", 1.3)],
  "blazer-chic": () => [p("veste", 0.9), p("haut", 0.9), p("chaussures", 1.3), p("sac", 1), p("bijou", 1.2), p("accessoire", 1.5)],
  minimaliste: () => [p("haut", 0.9), p("pantalon", 0.5), p("chaussures", 1.3)],
};

describe("composerFlatLay avec template — mêmes garanties que le moteur", () => {
  for (const tpl of TEMPLATES) {
    for (const contexte of ["look-detail", "hero-home"] as const) {
      it(`${tpl} (${contexte}) : aucune pièce ajoutée, ratio conservé, dans la zone, déterministe`, () => {
        const pieces = LOOKS[tpl]();
        const a = composerFlatLay(pieces, "g-" + tpl, { contexte, template: tpl });
        const b = composerFlatLay(pieces, "g-" + tpl, { contexte, template: tpl });
        expect(a).toEqual(b);
        const ids = new Set(pieces.map((x) => x.id));
        for (const q of a.pieces) {
          expect(ids.has(q.id)).toBe(true);
          const src = pieces.find((x) => x.id === q.id)!;
          expect(q.l / q.h).toBeCloseTo(src.ratio, 5);
          const { x0, x1, y0, y1 } = boite(q);
          expect(x0).toBeGreaterThanOrEqual(-0.01);
          expect(x1).toBeLessThanOrEqual(100.01);
          expect(y0).toBeGreaterThanOrEqual(-0.01);
          expect(y1).toBeLessThanOrEqual(CONTEXTES[contexte].hauteur + 0.01);
        }
        expect(new Set(a.pieces.map((q) => q.id)).size).toBe(a.pieces.length);
      });
    }
  }

  it("blazer-chic et veste-dominante donnent deux compositions différentes pour les mêmes pièces de base", () => {
    const pieces = [p("veste", 0.9), p("haut", 0.9), p("pantalon", 0.5), p("chaussures", 1.3), p("sac", 1)];
    const x = (tpl: TemplateFlatLay) => composerFlatLay(pieces, "meme-graine", { contexte: "look-detail", template: tpl }).pieces.map((q) => [q.id, Math.round(q.x), Math.round(q.y)]);
    expect(x("blazer-chic")).not.toEqual(x("veste-dominante"));
  });

  it("blazer-chic avec un bas : le bas est intégré à la composition", () => {
    const pieces = [p("veste", 0.9), p("haut", 0.9), p("pantalon", 0.5), p("chaussures", 1.3), p("sac", 1)];
    const r = composerFlatLay(pieces, "chic", { contexte: "look-detail", template: "blazer-chic" });
    expect(r.pieces.some((q) => q.cat === "pantalon")).toBe(true);
  });

  it("le blazer est derrière (profondeur la plus faible) et le haut devant lui", () => {
    const r = composerFlatLay(LOOKS["blazer-chic"](), "z", { contexte: "look-detail", template: "blazer-chic" });
    const par = Object.fromEntries(r.pieces.map((q) => [q.cat, q]));
    expect(par.veste.z).toBeLessThan(par.haut.z);
  });

  it("minimaliste : jamais agrandi au-delà de sa taille de référence", () => {
    const base = composerFlatLay(LOOKS.minimaliste(), "m", { contexte: "look-detail", template: "minimaliste" });
    const plein = composerFlatLay(LOOKS.minimaliste(), "m", { contexte: "look-detail" });
    const largeur = (r: typeof base) => Math.max(...r.pieces.map(boite).map((b) => b.x1)) - Math.min(...r.pieces.map(boite).map((b) => b.x0));
    expect(largeur(base)).toBeLessThanOrEqual(largeur(plein) + 0.01);
  });

  it("les corrections ponctuelles s'appliquent avec un template, jamais sans", () => {
    const pieces = LOOKS.robe();
    const id = pieces[0].id;
    const avant = composerFlatLay(pieces, "c", { contexte: "look-detail", template: "robe" }).pieces.find((q) => q.id === id)!;
    CORRECTIONS_PIECES[id] = { echelle: 0.8 };
    try {
      const apres = composerFlatLay(pieces, "c", { contexte: "look-detail", template: "robe" }).pieces.find((q) => q.id === id)!;
      expect(apres.l).toBeLessThan(avant.l);
      const sans1 = composerFlatLay(pieces, "c", { contexte: "look-detail" });
      delete CORRECTIONS_PIECES[id];
      const sans2 = composerFlatLay(pieces, "c", { contexte: "look-detail" });
      expect(sans1).toEqual(sans2);
    } finally {
      delete CORRECTIONS_PIECES[id];
    }
  });
});

describe("non-régression — sans template, le moteur est exactement celui d'avant", () => {
  const look = () => [p("veste", 0.9), p("haut", 0.9), p("pantalon", 0.5), p("chaussures", 1.3), p("sac", 1), p("bijou", 1.2)];
  it("template absent, null ou sur un contexte sans gabarit : même résultat", () => {
    for (const contexte of ["hero-home", "look-detail", "capsule", "dressing", "packing"] as const) {
      const pieces = look();
      const base = composerFlatLay(pieces, "nr", { contexte });
      expect(composerFlatLay(pieces, "nr", { contexte, template: null })).toEqual(base);
      if (contexte !== "hero-home" && contexte !== "look-detail") expect(composerFlatLay(pieces, "nr", { contexte, template: "blazer-chic" })).toEqual(base);
    }
  });
  it("chaque template a un gabarit pour chaque rôle qu'il pose (hero au moins)", () => {
    for (const tpl of TEMPLATES) expect(GABARITS_TEMPLATES[tpl].hero).toBeDefined();
  });
});
