import { describe, expect, it } from "vitest";
import { margesDe, objectBounds } from "../catalogMarges";

const BASE = "https://tkrbzrazejrxavtfspll.supabase.co/storage/v1/object/public/catalog-images/";

describe("margesDe — marges transparentes des visuels du catalogue", () => {
  it("rend les marges d'une image mesurée, en fractions", () => {
    const m = margesDe(BASE + "femme/hauts/29.webp");
    expect(m).toEqual({ g: 0.086, h: 0.051, d: 0.08, b: 0.061 });
  });
  it("accepte une URL avec paramètre de version", () => {
    expect(margesDe(BASE + "femme/hauts/29.webp?v=2")).not.toBeNull();
  });
  it("ne rend rien pour une image inconnue, une photo du dressing ou une URL absente", () => {
    expect(margesDe(BASE + "femme/hauts/999999.webp")).toBeNull();
    expect(margesDe("https://exemple.test/dressing/photo.png")).toBeNull();
    expect(margesDe(undefined)).toBeNull();
  });
  it("le recadrage garde au moins 20 % de chaque côté : jamais une image réduite à rien", () => {
    const m = margesDe(BASE + "femme/pantalons/69.webp")!;
    expect(1 - m.g - m.d).toBeGreaterThan(0.2);
    expect(1 - m.h - m.b).toBeGreaterThan(0.2);
  });
});

describe("objectBounds — la boîte réelle de l'objet", () => {
  it("visuel standard : déduite des marges", () => {
    const b = objectBounds(BASE + "femme/hauts/29.webp")!;
    expect(b.x).toBeCloseTo(0.086);
    expect(b.y).toBeCloseTo(0.051);
    expect(b.width).toBeCloseTo(1 - 0.086 - 0.08);
    expect(b.height).toBeCloseTo(1 - 0.051 - 0.061);
  });
  it("visuel hero : déjà rogné, donc toute l'image", () => {
    expect(objectBounds(BASE + "hero/femme/hauts/448-1790000000000-r1.00.webp")).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });
  it("fichier inconnu ou absent : null", () => {
    expect(objectBounds("https://exemple.test/photo.png")).toBeNull();
    expect(objectBounds(undefined)).toBeNull();
  });
});
