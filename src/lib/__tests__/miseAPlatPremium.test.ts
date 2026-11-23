import { describe, expect, it, vi } from "vitest";
import { ouvrirSiPermis } from "../miseAPlat";
import { LIMITE_MISES_A_PLAT_GRATUITES, peutMettreAPlat } from "../premium";
import { LIMITE_MISES_A_PLAT_GRATUITES as LIMITE_SERVEUR, miseAPlatGratuitePossible } from "../../../supabase/functions/_shared/premium";
import type { EtatPremium } from "../premium";

// LA MISE À PLAT : PREMIUM, OU 2 MISES À PLAT OFFERTES EN OFFRE GRATUITE (23/11/2026) — un compteur qui ne redescend jamais.
const actions = (apresVerification: EtatPremium) => ({ goPremium: vi.fn(), verifierEtatPremium: vi.fn(async () => apresVerification) });
const compteur = (n: number | null) => vi.fn(async () => n);

describe("mise à plat : 2 offertes en offre gratuite", () => {
  it("la même limite des deux côtés (test miroir)", () => {
    expect(LIMITE_MISES_A_PLAT_GRATUITES).toBe(2);
    expect(LIMITE_SERVEUR).toBe(LIMITE_MISES_A_PLAT_GRATUITES);
    for (const n of [0, 1, 2, 3]) expect(miseAPlatGratuitePossible(n)).toBe(peutMettreAPlat("gratuit", n));
  });
  it("gratuit : 0 et 1 utilisée passent ; 2 utilisées ouvrent Premium avec l'origine « mise à plat »", async () => {
    for (const n of [0, 1]) {
      const ouvrir = vi.fn();
      expect(await ouvrirSiPermis(actions("gratuit"), "gratuit", compteur(n), ouvrir)).toBe(true);
      expect(ouvrir).toHaveBeenCalled();
    }
    const a = actions("gratuit");
    const ouvrir = vi.fn();
    expect(await ouvrirSiPermis(a, "gratuit", compteur(2), ouvrir)).toBe(false);
    expect(ouvrir).not.toHaveBeenCalled();
    expect(a.goPremium).toHaveBeenCalledWith("mise_a_plat");
  });
  it("Premium : sans limite, le compteur n'est pas lu", async () => {
    const lire = compteur(40);
    expect(await ouvrirSiPermis(actions("premium"), "premium", lire, vi.fn())).toBe(true);
    expect(lire).not.toHaveBeenCalled();
  });
  it("compteur illisible (démo, avant la migration) : l'app laisse passer, le serveur décide", async () => {
    expect(await ouvrirSiPermis(actions("gratuit"), "gratuit", compteur(null), vi.fn())).toBe(true);
  });
  it("statut inconnu : vérifié d'abord", async () => {
    const a = actions("gratuit");
    expect(await ouvrirSiPermis(a, "inconnu", compteur(2), vi.fn())).toBe(false);
    expect(a.verifierEtatPremium).toHaveBeenCalled();
  });
});
