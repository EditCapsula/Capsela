import { describe, expect, it } from "vitest";
import { analyserPixels, placementDansCadre } from "../cadrageImage";

/** Image w×h, fond donné, avec un rectangle plein [x0,x1[×[y0,y1[ de la couleur `piece`. */
function image(w: number, h: number, fond: number[], piece: number[], r: [number, number, number, number]): number[] {
  const px: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dedans = x >= r[0] && x < r[1] && y >= r[2] && y < r[3];
      px.push(...(dedans ? piece : fond));
    }
  }
  return px;
}
const TRANSPARENT = [0, 0, 0, 0];
const BLANC = [252, 252, 250, 255];
const MARINE = [40, 50, 80, 255];

describe("analyserPixels — le rectangle réellement occupé par la pièce", () => {
  it("fond transparent : lu sur l'alpha", () => {
    const a = analyserPixels(image(64, 64, TRANSPARENT, MARINE, [16, 48, 8, 56]), 64, 64);
    expect(a).toEqual({ boite: { x0: 0.25, y0: 0.125, x1: 0.75, y1: 0.875 }, fond: null });
  });

  it("fond uni opaque : lu sur la couleur des coins, et restitué pour prolonger le cadre", () => {
    const a = analyserPixels(image(64, 64, BLANC, MARINE, [20, 44, 20, 44]), 64, 64);
    expect(a?.boite).toEqual({ x0: 20 / 64, y0: 20 / 64, x1: 44 / 64, y1: 44 / 64 });
    expect(a?.fond).toBe("rgb(252, 252, 250)");
  });

  it("une ombre très douce, proche du fond, n'élargit pas la boîte", () => {
    const px = image(64, 64, BLANC, MARINE, [20, 44, 20, 44]);
    // Ombre sous la pièce : 12 lignes à peine plus sombres que le fond (écart 24).
    for (let y = 44; y < 56; y++) for (let x = 16; x < 48; x++) px.splice((y * 64 + x) * 4, 3, 244, 244, 242);
    expect(analyserPixels(px, 64, 64)?.boite.y1).toBe(44 / 64);
  });

  it("un grain isolé ne compte pas", () => {
    const px = image(64, 64, TRANSPARENT, MARINE, [20, 44, 20, 44]);
    px.splice((2 * 64 + 60) * 4, 4, ...MARINE);
    expect(analyserPixels(px, 64, 64)?.boite).toEqual({ x0: 20 / 64, y0: 20 / 64, x1: 44 / 64, y1: 44 / 64 });
  });

  it("fond non uni (une photo prise chez soi) : pas de mesure, on ne suppose rien", () => {
    const px = image(64, 64, BLANC, MARINE, [20, 44, 20, 44]);
    px.splice((63 * 64 + 63) * 4, 4, 120, 90, 60, 255);
    expect(analyserPixels(px, 64, 64)).toBeNull();
  });

  it("une pièce pâle sur fond gris clair est retrouvée par le passage fin", () => {
    const GRIS = [228, 228, 226, 255];
    const ECRU = [247, 242, 230, 255]; // écart au fond : 36, sous la tolérance normale
    expect(analyserPixels(image(64, 64, GRIS, ECRU, [18, 46, 16, 44]), 64, 64)?.boite).toEqual({ x0: 18 / 64, y0: 16 / 64, x1: 46 / 64, y1: 44 / 64 });
  });

  it("un bijou minuscule (moins de 2 % de l'image) est mesuré, pas rejeté", () => {
    const a = analyserPixels(image(64, 64, TRANSPARENT, MARINE, [29, 36, 29, 36]), 64, 64);
    expect(a?.boite).toEqual({ x0: 29 / 64, y0: 29 / 64, x1: 36 / 64, y1: 36 / 64 });
  });

  it("rien de détecté : null", () => {
    expect(analyserPixels(image(64, 64, TRANSPARENT, TRANSPARENT, [0, 0, 0, 0]), 64, 64)).toBeNull();
  });
});

describe("placementDansCadre — même présence pour chaque pièce, sans déformation", () => {
  it("une pièce qui occupe la moitié de l'image remplit la zone utile du cadre", () => {
    const p = placementDansCadre({ x0: 0.25, y0: 0.25, x1: 0.75, y1: 0.75 }, 1, 1, 0.1);
    expect(p.largeur).toBeCloseTo(160);
    expect(p.hauteur).toBeCloseTo(160);
    expect(p.gauche).toBeCloseTo(-30);
    expect(p.haut).toBeCloseTo(-30);
  });

  it("le ratio de l'image est toujours conservé", () => {
    const p = placementDansCadre({ x0: 0.3, y0: 0.1, x1: 0.7, y1: 0.9 }, 1, 0.8, 0.1);
    // largeur (en % du cadre) × largeur du cadre / (hauteur × hauteur du cadre) = ratio de l'image.
    expect((p.largeur * 0.8) / p.hauteur).toBeCloseTo(1);
  });

  it("une pièce haute et étroite est bornée par la hauteur, et centrée", () => {
    const p = placementDansCadre({ x0: 0.4, y0: 0.1, x1: 0.6, y1: 0.9 }, 1, 0.8, 0.1);
    // Hauteur de la pièce à l'écran = 0.8 × hauteur de l'image = 80 % du cadre.
    expect((0.8 * p.hauteur) / 100).toBeCloseTo(0.8);
    expect(p.gauche + 0.5 * p.largeur).toBeCloseTo(50);
  });

  it("une image sans marge retombe sur l'affichage contenu, rétréci de la marge", () => {
    const p = placementDansCadre({ x0: 0, y0: 0, x1: 1, y1: 1 }, 1, 0.8, 0.1);
    expect(p.largeur).toBeCloseTo(80);
  });

  it("un bijou minuscule n'est pas agrandi au-delà du zoom maximal", () => {
    const p = placementDansCadre({ x0: 0.45, y0: 0.45, x1: 0.55, y1: 0.55 }, 1, 1, 0.1, 4);
    expect(p.largeur).toBeCloseTo(400);
  });
});
