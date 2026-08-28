import { describe, expect, it } from "vitest";
import { isMetallicFinish, isNeutralColor, isStatement } from "../attributes";
import { item } from "./fixtures";

describe("isNeutralColor", () => {
  it("reconnaît les neutres ajoutés le 26/08/2026", () => {
    // Ces libellés existent en base et manquaient à NEUTRAL_COLORS : la
    // fonction échouait ouvert, ce qui a produit trois bugs successifs
    // (lunettes de soleil écaille comptées comme touche de couleur...).
    for (const c of ["Écru", "Ivoire", "Beige", "Champagne", "Nude", "Écaille", "Cognac", "Brun", "Naturel"]) {
      expect(isNeutralColor(c), c).toBe(true);
    }
  });

  it("ne classe pas une vraie couleur accent comme neutre", () => {
    for (const c of ["Bordeaux", "Terracotta", "Rose poudré", "Vert sauge", "Rouge cerise"]) {
      expect(isNeutralColor(c), c).toBe(false);
    }
  });

  it("compare par sous-chaîne, jamais par égalité stricte", () => {
    expect(isNeutralColor("Gris anthracite")).toBe(true);
    expect(isNeutralColor("Écru / marine")).toBe(true);
  });
});

describe("isMetallicFinish", () => {
  it("reconnaît les finitions patinées présentes en base", () => {
    for (const c of ["Doré", "Doré vieilli", "Argenté", "Argent vieilli", "Doré / pierre", "Cuivré", "Bronze"]) {
      expect(isMetallicFinish(c), c).toBe(true);
    }
  });

  it("ne confond pas une couleur avec une finition", () => {
    for (const c of ["Bordeaux", "Noir", "Champagne", null, ""]) {
      expect(isMetallicFinish(c), String(c)).toBe(false);
    }
  });
});

describe("isStatement", () => {
  it("un bijou doré n'est pas statement par sa seule finition (R-S5, 26/08/2026)", () => {
    expect(isStatement(item({ id: 1, category: "bijoux", name: "Collier chaîne fine", couleur_dominante: "Doré" }))).toBe(false);
    expect(isStatement(item({ id: 2, category: "bijoux", name: "Petites créoles", couleur_dominante: "Doré vieilli" }))).toBe(false);
  });

  it("mais le reste devient statement par le volume ou le design", () => {
    expect(isStatement(item({ id: 3, category: "bijoux", name: "Manchette imposante", couleur_dominante: "Doré" }))).toBe(true);
    expect(isStatement(item({ id: 4, category: "bijoux", name: "Créoles chunky", couleur_dominante: "Argenté" }))).toBe(true);
  });

  it("une couleur accent réelle reste statement", () => {
    expect(isStatement(item({ id: 5, category: "hauts", name: "Top", couleur_dominante: "Bordeaux" }))).toBe(true);
  });

  it("un imprimé reste statement quelle que soit la couleur", () => {
    expect(isStatement(item({ id: 6, category: "hauts", name: "Chemise imprimée", couleur_dominante: "Noir" }))).toBe(true);
  });

  it("une pièce neutre unie ne l'est pas", () => {
    expect(isStatement(item({ id: 7, category: "hauts", name: "T-shirt", couleur_dominante: "Écru" }))).toBe(false);
  });

  it("le champ statement déclaré prime sur toute déduction", () => {
    expect(isStatement(item({ id: 8, category: "hauts", name: "T-shirt", couleur_dominante: "Écru", statement: true }))).toBe(true);
    expect(isStatement(item({ id: 9, category: "hauts", name: "Chemise imprimée", couleur_dominante: "Bordeaux", statement: false }))).toBe(false);
  });
});
