import { describe, expect, it } from "vitest";
import { ECRANS_RESTAURABLES, ecranARestaurer, memoriserEcran } from "../ecranRestaure";

const faux = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("ecranRestaure — retrouver l'écran après un rechargement", () => {
  it("retient un écran de premier niveau et le rend", () => {
    const s = faux();
    memoriserEcran("history", s);
    expect(ecranARestaurer(s)).toBe("history");
    memoriserEcran("planifier", s);
    expect(ecranARestaurer(s)).toBe("planifier");
  });

  it("ne retient jamais un détail, un parcours ou un écran d'avant-connexion", () => {
    const s = faux();
    memoriserEcran("capsule", s);
    for (const e of ["piece", "add", "premium", "lookDetail", "avisStyliste", "welcome", "auth", "onboarding", "profile"] as const) {
      memoriserEcran(e, s);
      expect(ecranARestaurer(s)).toBe("capsule");
    }
  });

  it("rien de retenu, valeur inconnue ou stockage indisponible : null (donc l'accueil)", () => {
    expect(ecranARestaurer(faux())).toBeNull();
    const s = faux();
    s.setItem("capsela.dernierEcran", "n'importe quoi");
    expect(ecranARestaurer(s)).toBeNull();
    expect(ecranARestaurer(null)).toBeNull();
    expect(() => memoriserEcran("home", null)).not.toThrow();
  });

  it("un stockage qui lève une erreur ne casse rien", () => {
    const casse = { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } };
    expect(() => memoriserEcran("home", casse)).not.toThrow();
    expect(ecranARestaurer(casse)).toBeNull();
  });

  it("les écrans restaurables sont les sept de premier niveau", () => {
    expect([...ECRANS_RESTAURABLES].sort()).toEqual(["calendrier", "capsule", "history", "home", "planifier", "tenues", "wardrobe"]);
  });
});
