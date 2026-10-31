import { describe, expect, it } from "vitest";
import {
  lirePreferencesSilhouette,
  memesPreferencesSilhouette,
  PREFERENCES_SILHOUETTE_VIDES,
  preferencesSilhouetteVersLigne,
} from "../preferencesSilhouette";
import { EMPTY_PROFILE } from "../profile";

describe("préférences de silhouette — lecture", () => {
  it("un profil antérieur (colonne absente ou null) n'a jamais répondu : null par champ, pas une liste vide", () => {
    expect(lirePreferencesSilhouette(undefined)).toEqual({ miseEnValeur: null, coupes: null });
    expect(lirePreferencesSilhouette(null)).toEqual({ miseEnValeur: null, coupes: null });
    expect(EMPTY_PROFILE.preferencesSilhouette).toEqual(PREFERENCES_SILHOUETTE_VIDES);
  });

  it("« aucune préférence » ([]) reste distincte de « jamais posé » (null)", () => {
    expect(lirePreferencesSilhouette({ miseEnValeur: [], coupes: null })).toEqual({ miseEnValeur: [], coupes: null });
  });

  it("une valeur inconnue est écartée, un doublon fusionné, rien n'est inventé", () => {
    const p = lirePreferencesSilhouette({ miseEnValeur: ["taille", "inconnue", "taille"], coupes: ["fluides", 3] });
    expect(p).toEqual({ miseEnValeur: ["taille"], coupes: ["fluides"] });
  });

  it("aller-retour base → profil → base sans perte", () => {
    const p = { miseEnValeur: ["dos" as const, "bras" as const], coupes: [] };
    expect(lirePreferencesSilhouette(preferencesSilhouetteVersLigne(p))).toEqual(p);
  });
});

describe("préférences de silhouette — changement", () => {
  it("l'ordre ne compte pas ; null et [] diffèrent", () => {
    expect(memesPreferencesSilhouette({ miseEnValeur: ["dos", "bras"], coupes: null }, { miseEnValeur: ["bras", "dos"], coupes: null })).toBe(true);
    expect(memesPreferencesSilhouette({ miseEnValeur: [], coupes: null }, PREFERENCES_SILHOUETTE_VIDES)).toBe(false);
  });
});

describe("préférences de silhouette — affichage et choix", () => {
  it("homme : cinq options, sans décolleté, courbes ni hanches ; aucun visuel femme", async () => {
    const m = await import("../preferencesSilhouette");
    expect(m.misesEnValeurProposees("homme")).toEqual(["taille", "jambes", "epaules", "bras", "dos"]);
    expect(m.misesEnValeurProposees("femme")).toHaveLength(8);
    expect(m.visuelMiseEnValeur("taille", "homme")).toBeNull();
    expect(m.visuelCoupe("fluides", "homme")).toBeNull();
    expect(m.visuelCoupe("fluides", "femme")).toBe("/onboarding/coupes/fluides.webp");
  });

  it("retirer la dernière option ramène à « pas répondu », jamais à « aucune préférence »", async () => {
    const { basculerOption } = await import("../preferencesSilhouette");
    expect(basculerOption(null, "dos")).toEqual(["dos"]);
    expect(basculerOption([], "dos")).toEqual(["dos"]);
    expect(basculerOption(["dos"], "dos")).toBeNull();
  });

  it("libellés : neutre explicite, null si jamais posé", async () => {
    const { libelleCoupes, libelleMiseEnValeur } = await import("../preferencesSilhouette");
    expect(libelleCoupes([])).toBe("Cela dépend du vêtement");
    expect(libelleCoupes(null)).toBeNull();
    expect(libelleMiseEnValeur(["taille", "dos"], "femme")).toBe("Ma taille, Mon dos");
    expect(libelleMiseEnValeur(["decollete"], "homme")).toBeNull();
  });
});
