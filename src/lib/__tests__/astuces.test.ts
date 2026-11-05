import { describe, expect, it } from "vitest";
import { ASTUCES, choisirAstuce } from "../astuces";

describe("astuces de l'écran de chargement", () => {
  it("une astuce existante, quel que soit le tirage", () => {
    for (const h of [0, 0.25, 0.5, 0.999999]) {
      const i = choisirAstuce(null, h);
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(ASTUCES.length);
    }
  });

  it("jamais deux fois la même de suite", () => {
    for (let precedente = 0; precedente < ASTUCES.length; precedente++) {
      for (const h of [0, 0.3, 0.6, 0.999999]) expect(choisirAstuce(precedente, h)).not.toBe(precedente);
    }
  });

  it("toutes les autres astuces peuvent sortir", () => {
    const vues = new Set<number>();
    for (let k = 0; k < 200; k++) vues.add(choisirAstuce(2, k / 200, 5));
    expect([...vues].sort()).toEqual([0, 1, 3, 4]);
  });

  it("une précédente inconnue est ignorée ; une seule astuce reste possible", () => {
    expect(choisirAstuce(99, 0.5, 4)).toBeLessThan(4);
    expect(choisirAstuce(0, 0.5, 1)).toBe(0);
  });
});
