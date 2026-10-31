import { describe, expect, it } from "vitest";
import { accordCoupe, coupesDeLaPiece, tenueDeLaMatiere } from "../coupesPieces";
import { axeNeutraliseParMiseEnValeur } from "../capsule";
import type { CategoryKey } from "../types";

const piece = (name: string, cat: CategoryKey, matiereBrute?: string, coupe?: "Serré" | "Ajusté" | "Ample") => ({ name, cat, matiereBrute, coupe });

describe("coupes d'une pièce (règle validée le 31/10/2026 : le nom d'abord, puis la matière)", () => {
  it("le nom l'emporte sur la matière", () => {
    expect(tenueDeLaMatiere(piece("Blazer blanc", "veste", "Lin / viscose"))).toBe("structurees");
    expect(tenueDeLaMatiere(piece("Pantalon large fluide", "pantalon", "Crêpe épais"))).toBe("fluides");
  });
  it("sinon la matière ; une matière épaisse ne se déduit pas ; rien sinon", () => {
    expect(tenueDeLaMatiere(piece("Robe midi", "robe", "Crêpe structuré"))).toBe("structurees");
    expect(tenueDeLaMatiere(piece("Robe midi", "robe", "Viscose"))).toBe("fluides");
    expect(tenueDeLaMatiere(piece("Robe droite midi", "robe", "Crêpe épais"))).toBeNull();
    expect(tenueDeLaMatiere(piece("Chemise", "haut", "Coton"))).toBeNull();
  });
  it("ajustée / ample par la colonne coupe ; droite par le nom ; aucune coupe pour un accessoire", () => {
    expect([...coupesDeLaPiece(piece("Top", "haut", "Coton", "Ajusté"))]).toEqual(["ajustees"]);
    expect(coupesDeLaPiece(piece("Pantalon droit", "pantalon", "Laine")).has("droites")).toBe(true);
    expect(coupesDeLaPiece(piece("Foulard en soie", "accessoire", "Soie")).size).toBe(0);
  });
  it("aucune préférence, « Cela dépend » ou coupe inconnue : 0, jamais de pénalité", () => {
    const p = piece("Chemise", "haut", "Coton");
    expect(accordCoupe(p, null)).toBe(0);
    expect(accordCoupe(p, [])).toBe(0);
    expect(accordCoupe(p, ["fluides"])).toBe(0);
    expect(accordCoupe(piece("Blouse", "haut", "Soie"), ["fluides"])).toBe(1);
  });
});

describe("mise en valeur et direction morphologique", () => {
  it("seul l'axe qui minimise la zone à mettre en valeur est neutralisé", () => {
    expect(axeNeutraliseParMiseEnValeur("f_poire", ["hanches"])).toBe("bas");
    expect(axeNeutraliseParMiseEnValeur("f_poire", ["epaules"])).toBeNull();
    expect(axeNeutraliseParMiseEnValeur("f_triangle_inverse", ["epaules", "dos"])).toBe("haut");
    expect(axeNeutraliseParMiseEnValeur("f_sablier", ["hanches"])).toBeNull();
    expect(axeNeutraliseParMiseEnValeur("f_poire", [])).toBeNull();
  });
});

describe("production du lot 4 (31/10/2026)", () => {
  it("sans préférence, la capsule de production est celle d'avant le lot 4 ; avec une coupe préférée, elle peut changer", async () => {
    const { computeDefaultCapsule, representativeWeatherFor, STRATEGIE_AVANT_LOT4, STRATEGIE_PRODUCTION } = await import("../capsule");
    const { EMPTY_PROFILE } = await import("../profile");
    expect(STRATEGIE_PRODUCTION).toMatchObject({ coupesPreferees: "apres_basique", miseEnValeurPrime: true });
    const w = representativeWeatherFor("Printemps");
    const ids = (c: { id: number }[]) => c.map((x) => x.id).sort((a, b) => a - b).join();
    for (const styles of [["minimaliste"], ["boheme"], ["casual_chic"]]) {
      const p = { ...EMPTY_PROFILE, gender: "femme" as const, styles };
      expect(ids(computeDefaultCapsule(p, w, [], "Printemps", undefined, STRATEGIE_PRODUCTION))).toBe(ids(computeDefaultCapsule(p, w, [], "Printemps", undefined, STRATEGIE_AVANT_LOT4)));
      const neutre = { ...p, preferencesSilhouette: { miseEnValeur: [], coupes: [] } };
      expect(ids(computeDefaultCapsule(neutre, w, [], "Printemps"))).toBe(ids(computeDefaultCapsule(p, w, [], "Printemps", undefined, STRATEGIE_AVANT_LOT4)));
    }
  });
});
