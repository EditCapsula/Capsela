import { describe, expect, it } from "vitest";
import { CONTEXTES } from "../flatLay";
import { DESSINS_SILHOUETTE, composerSilhouette } from "../silhouetteFlatLay";
import type { CategoryKey } from "../types";

// La silhouette de chargement pose ses dessins avec le moteur du flat lay : signalé le 08/10/2026 (« haut trop grand vs bas »).
const aire = (p: { l: number; h: number }) => p.l * p.h;
const parCat = (cats: CategoryKey[]) => Object.fromEntries(composerSilhouette(cats.map((cat) => ({ cat }))).map((p) => [p.cat, p]));
const BASE: CategoryKey[] = ["haut", "pantalon", "sac", "chaussures"];

describe("silhouette de chargement — mêmes tailles relatives que le look final", () => {
  it("le haut n'écrase plus le bas : sa surface reste sous celle du pantalon, et il n'est pas plus large que lui de plus de moitié", () => {
    const p = parCat(BASE);
    expect(aire(p.haut)).toBeLessThan(aire(p.pantalon));
    expect(p.haut.l).toBeLessThan(p.pantalon.l * 1.5);
  });

  it("le sac et les chaussures restent plus petits que le haut", () => {
    const p = parCat(BASE);
    expect(aire(p.sac)).toBeLessThan(aire(p.haut));
    expect(aire(p.chaussures)).toBeLessThan(aire(p.haut));
  });

  it("le pantalon est à droite du haut, comme dans le flat lay de l'accueil", () => {
    const p = parCat(BASE);
    expect(p.pantalon.x).toBeGreaterThan(p.haut.x);
  });

  it("chaque dessin garde son format : la boîte posée a la proportion du dessin, jamais étirée", () => {
    for (const p of composerSilhouette(BASE.map((cat) => ({ cat })))) {
      expect(p.l / p.h).toBeCloseTo(DESSINS_SILHOUETTE[p.cat]!.ratio, 1);
    }
  });

  it("tout reste dans la zone de sécurité de l'accueil", () => {
    const { hauteur, marge } = CONTEXTES["hero-home"];
    for (const p of composerSilhouette(BASE.map((cat) => ({ cat })))) {
      expect(p.x - p.l / 2).toBeGreaterThanOrEqual(marge - 2);
      expect(p.x + p.l / 2).toBeLessThanOrEqual(100 - marge + 2);
      expect(p.y - p.h / 2).toBeGreaterThanOrEqual(marge - 2);
      expect(p.y + p.h / 2).toBeLessThanOrEqual(hauteur - marge + 2);
    }
  });

  it("une robe, un look à veste, un haut photographié : une silhouette, jamais vide ; bijoux et accessoires n'ont pas de dessin", () => {
    expect(composerSilhouette([{ cat: "robe" }, { cat: "sac" }, { cat: "chaussures" }]).length).toBe(3);
    expect(composerSilhouette([{ cat: "veste" }, { cat: "haut" }, { cat: "pantalon" }, { cat: "chaussures" }]).length).toBe(4);
    const photo = composerSilhouette([{ cat: "haut", photoUrl: "https://x/y.jpg" }, { cat: "pantalon" }]);
    expect(photo.find((p) => p.cat === "haut")?.photo).toBe(true);
    expect(composerSilhouette([{ cat: "bijou" }, { cat: "accessoire" }])).toEqual([]);
  });

  it("déterministe : le même ensemble de catégories donne la même silhouette", () => {
    expect(composerSilhouette(BASE.map((cat) => ({ cat })))).toEqual(composerSilhouette(BASE.map((cat) => ({ cat }))));
  });
});
