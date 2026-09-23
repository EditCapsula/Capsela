import { describe, expect, it } from "vitest";
import { caseDeLaPiece, grillePour } from "../outfitImage";

/**
 * La grille de la planche partagée.
 *
 * Seule partie de outfitImage.ts qui ne dépend ni du DOM ni du réseau — et la
 * seule qui puisse être fausse SANS lever : une case mal calculée produit une
 * image bancale, débordante ou vide, sans la moindre erreur. Le reste
 * (chargement, canvas, toBlob) se vérifie en navigateur.
 */
describe("grille de la planche", () => {
  it("reste aussi carrée que possible", () => {
    expect(grillePour(1)).toEqual({ colonnes: 1, lignes: 1 });
    expect(grillePour(2)).toEqual({ colonnes: 2, lignes: 1 });
    expect(grillePour(4)).toEqual({ colonnes: 2, lignes: 2 });
    expect(grillePour(5)).toEqual({ colonnes: 3, lignes: 2 });
    expect(grillePour(6)).toEqual({ colonnes: 3, lignes: 2 });
    expect(grillePour(9)).toEqual({ colonnes: 3, lignes: 3 });
  });

  it("ne rend rien pour une tenue vide", () => {
    expect(grillePour(0)).toEqual({ colonnes: 0, lignes: 0 });
  });
});

describe("placement des pièces", () => {
  const COTE = 1080;

  /** Le cas qui casserait l'image sans prévenir : une case qui sort du canvas. */
  it("garde chaque case entièrement dans le canvas, de 1 à 8 pièces", () => {
    for (let n = 1; n <= 8; n++) {
      for (let i = 0; i < n; i++) {
        const { x, y, taille } = caseDeLaPiece(i, n, COTE);
        expect(x, `n=${n} i=${i} x`).toBeGreaterThanOrEqual(0);
        expect(y, `n=${n} i=${i} y`).toBeGreaterThanOrEqual(0);
        expect(x + taille, `n=${n} i=${i} droite`).toBeLessThanOrEqual(COTE + 0.001);
        expect(y + taille, `n=${n} i=${i} bas`).toBeLessThanOrEqual(COTE + 0.001);
        expect(taille, `n=${n} taille`).toBeGreaterThan(0);
      }
    }
  });

  it("ne fait jamais se chevaucher deux cases", () => {
    for (let n = 2; n <= 8; n++) {
      const cases = Array.from({ length: n }, (_, i) => caseDeLaPiece(i, n, COTE));
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
          const A = cases[a];
          const B = cases[b];
          const disjoints =
            A.x + A.taille <= B.x + 0.001 ||
            B.x + B.taille <= A.x + 0.001 ||
            A.y + A.taille <= B.y + 0.001 ||
            B.y + B.taille <= A.y + 0.001;
          expect(disjoints, `n=${n} : ${a} et ${b} se chevauchent`).toBe(true);
        }
      }
    }
  });

  it("centre une dernière rangée incomplète plutôt que de la coller à gauche", () => {
    // 5 pièces : 3 colonnes, la seconde rangée n'en porte que 2.
    const rangee2 = [caseDeLaPiece(3, 5, COTE), caseDeLaPiece(4, 5, COTE)];
    const centreRangee = (rangee2[0].x + rangee2[1].x + rangee2[1].taille) / 2;
    expect(Math.abs(centreRangee - COTE / 2)).toBeLessThan(1);
  });

  it("donne la même taille à toutes les pièces d'une même tenue", () => {
    for (const n of [3, 5, 7]) {
      const tailles = new Set(Array.from({ length: n }, (_, i) => caseDeLaPiece(i, n, COTE).taille));
      expect(tailles.size, `n=${n}`).toBe(1);
    }
  });
});
