import { describe, expect, it } from "vitest";
import { ajouterPasPourMoi, cleSaison, nettoyer, piecesPasPourMoi, retirerPasPourMoi } from "../pasPourMoi";

// « PAS POUR MOI » POUR LA SAISON EN COURS (13/11/2026) : réversible, et oublié la saison suivante.
describe("pasPourMoi", () => {
  it("une saison se repère par son année de début (l'hiver chevauche deux années)", () => {
    expect(cleSaison(new Date(2026, 10, 13))).toBe("2026-Automne");
    expect(cleSaison(new Date(2026, 11, 20))).toBe("2026-Hiver");
    expect(cleSaison(new Date(2027, 1, 10))).toBe("2026-Hiver");
    expect(cleSaison(new Date(2027, 2, 1))).toBe("2027-Printemps");
  });
  it("écartée pour la saison en cours, de retour la saison suivante", () => {
    const t = ajouterPasPourMoi({}, 42, new Date(2026, 10, 13));
    expect(piecesPasPourMoi(t, new Date(2026, 10, 30))).toEqual([42]);
    expect(piecesPasPourMoi(t, new Date(2026, 11, 1))).toEqual([]);
  });
  it("annuler la remet ; les saisons passées sont nettoyées", () => {
    const t = ajouterPasPourMoi({ "7": "2026-Été" }, 42, new Date(2026, 10, 13));
    expect(t).toEqual({ "42": "2026-Automne" });
    expect(retirerPasPourMoi(t, 42)).toEqual({});
    expect(nettoyer({ "1": "2026-Automne", "2": "2025-Hiver", x: "2026-Automne" }, new Date(2026, 10, 13))).toEqual({ "1": "2026-Automne" });
  });
});
