import { describe, expect, it, vi } from "vitest";
import { ouvrirSiPermis } from "../miseAPlat";
import { LIMITE_MISES_A_PLAT_GRATUITES, peutMettreAPlat } from "../premium";
import { LIMITE_MISES_A_PLAT_GRATUITES as LIMITE_SERVEUR, miseAPlatGratuitePossible } from "../../../supabase/functions/_shared/premium";
import type { EtatPremium } from "../premium";

// LA MISE À PLAT : PREMIUM, OU 2 PIÈCES GARDÉES EN OFFRE GRATUITE (23/11/2026), prête pour sa réactivation.
const actions = (apresVerification: EtatPremium) => ({ goPremium: vi.fn(), verifierEtatPremium: vi.fn(async () => apresVerification) });

describe("mise à plat : 2 pièces en offre gratuite", () => {
  it("la même limite des deux côtés (test miroir)", () => {
    expect(LIMITE_MISES_A_PLAT_GRATUITES).toBe(2);
    expect(LIMITE_SERVEUR).toBe(LIMITE_MISES_A_PLAT_GRATUITES);
    for (const n of [0, 1, 2, 3]) expect(miseAPlatGratuitePossible(n)).toBe(peutMettreAPlat("gratuit", n));
  });
  it("gratuit : 0 et 1 pièce passent, 2 ouvrent Premium avec l'origine « mise à plat »", async () => {
    for (const n of [0, 1]) {
      const a = actions("gratuit");
      const ouvrir = vi.fn();
      expect(await ouvrirSiPermis(a, "gratuit", n, ouvrir)).toBe(true);
      expect(ouvrir).toHaveBeenCalled();
    }
    const a = actions("gratuit");
    const ouvrir = vi.fn();
    expect(await ouvrirSiPermis(a, "gratuit", 2, ouvrir)).toBe(false);
    expect(ouvrir).not.toHaveBeenCalled();
    expect(a.goPremium).toHaveBeenCalledWith("mise_a_plat");
  });
  it("Premium : sans limite", async () => {
    expect(await ouvrirSiPermis(actions("premium"), "premium", 40, vi.fn())).toBe(true);
  });
  it("statut inconnu : vérifié d'abord ; vérifié gratuit au-delà de 2, Premium", async () => {
    const a = actions("gratuit");
    expect(await ouvrirSiPermis(a, "inconnu", 2, vi.fn())).toBe(false);
    expect(a.verifierEtatPremium).toHaveBeenCalled();
    expect(await ouvrirSiPermis(actions("premium"), "inconnu", 2, vi.fn())).toBe(true);
  });
});
