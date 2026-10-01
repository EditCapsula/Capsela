import { afterEach, describe, expect, it, vi } from "vitest";
import { clesLocalesDuCompte, effacerDonneesLocales } from "../donneesLocales";

// Suppression du compte : ce que l'appareil garde au nom du compte part avec
// lui (docs/legal/README.md, écart 6, 01/10/2026).

afterEach(() => {
  vi.unstubAllGlobals();
});

function stockageFactice(initial: Record<string, string>) {
  const donnees = new Map(Object.entries(initial));
  vi.stubGlobal("window", { localStorage: { removeItem: (k: string) => void donnees.delete(k) } });
  return donnees;
}

describe("clesLocalesDuCompte", () => {
  it("valises (les deux clés), dernière ville et intention d'inscription", () => {
    expect(clesLocalesDuCompte("u1")).toEqual([
      "capsela.lastKnownCity",
      "capsela.authIntent",
      "capsela.valises.u1",
      "capsela.valise.u1",
      "capsela.recommandees.u1",
    ]);
  });
  it("le mode démo range ses valises sous « demo »", () => {
    expect(clesLocalesDuCompte(null)).toContain("capsela.valises.demo");
  });
});

describe("effacerDonneesLocales", () => {
  it("efface les clés du compte et rien d'autre — le choix de mesure d'audience reste, il tient à l'appareil", () => {
    const donnees = stockageFactice({
      "capsela.lastKnownCity": "{}",
      "capsela.valises.u1": "[]",
      "capsela.valise.u1": "{}",
      "capsela.valises.u2": "[]",
      "capsela.analyticsConsent": "granted",
    });
    effacerDonneesLocales("u1");
    expect([...donnees.keys()].sort()).toEqual(["capsela.analyticsConsent", "capsela.valises.u2"]);
  });

  it("ne jette jamais, même si le stockage refuse", () => {
    vi.stubGlobal("window", { localStorage: { removeItem: () => { throw new Error("refusé"); } } });
    expect(() => effacerDonneesLocales("u1")).not.toThrow();
  });

  it("sans fenêtre (rendu serveur), ne fait rien", () => {
    vi.stubGlobal("window", undefined);
    expect(() => effacerDonneesLocales("u1")).not.toThrow();
  });
});
