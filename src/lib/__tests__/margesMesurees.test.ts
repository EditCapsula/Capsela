import { describe, expect, it } from "vitest";
import { margesDepuisAlpha, ratioPiece } from "../margesMesurees";

// Une image 10 × 20 transparente, avec une pièce opaque de x = 3 à 6 et de y = 2 à 17 : une robe étroite dans une photo en portrait.
const image = () => {
  const w = 10;
  const h = 20;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 2; y <= 17; y++) for (let x = 3; x <= 6; x++) data[(y * w + x) * 4 + 3] = 255;
  return { data, w, h };
};

describe("la forme réelle d'une photo du dressing (05/11/2026)", () => {
  it("la boîte des pixels visibles donne les marges, avec 1 % de sécurité", () => {
    const { data, w, h } = image();
    const m = margesDepuisAlpha(data, w, h)!;
    expect(m.g).toBeCloseTo(0.3 - 0.01, 5);
    expect(m.d).toBeCloseTo(1 - 0.7 - 0.01, 5);
    expect(m.h).toBeCloseTo(0.1 - 0.01, 5);
    expect(m.b).toBeCloseTo(1 - 0.9 - 0.01, 5);
  });
  it("le format de la pièce tient compte du format de l'image : 4 px sur 16, soit 0,25, et non le portrait supposé de 0,8", () => {
    const { data, w, h } = image();
    const r = ratioPiece({ marges: margesDepuisAlpha(data, w, h)!, ratioImage: w / h });
    expect(r).toBeGreaterThan(0.24);
    expect(r).toBeLessThan(0.29);
  });
  it("une image entièrement transparente ne donne rien ; une photo opaque donne toute l'image", () => {
    expect(margesDepuisAlpha(new Uint8ClampedArray(4 * 4 * 4), 4, 4)).toBeNull();
    const opaque = new Uint8ClampedArray(4 * 4 * 4).fill(255);
    expect(margesDepuisAlpha(opaque, 4, 4)).toEqual({ g: 0, h: 0, d: 0, b: 0 });
  });
});
