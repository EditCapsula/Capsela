import { describe, expect, it } from "vitest";
import { VISITES, selecteurCible, visiteAMontrer } from "../visites";
import { vuesReunies } from "../memoireVisites";

describe("visites guidées", () => {
  it("une visite par écran, des étapes et des cibles toutes distinctes", () => {
    const ecrans = VISITES.map((v) => v.ecran);
    expect(new Set(ecrans).size).toBe(ecrans.length);
    const cibles = VISITES.flatMap((v) => v.etapes.map((e) => e.cible));
    expect(new Set(cibles).size).toBe(cibles.length);
    expect(VISITES.every((v) => v.etapes.length > 0)).toBe(true);
    expect(selecteurCible("accueil-tenue")).toBe('[data-tour="accueil-tenue"]');
  });

  it("à la première ouverture de l'écran seulement, et jamais avant que le compte soit prêt", () => {
    expect(visiteAMontrer("home", [], true)?.id).toBe("accueil");
    expect(visiteAMontrer("home", ["accueil"], true)).toBeNull();
    expect(visiteAMontrer("home", [], false)).toBeNull();
    expect(visiteAMontrer("preferences", [], true)).toBeNull();
  });

  it("relancée depuis l'Aide : rejouée même déjà vue, sur son écran seulement", () => {
    expect(visiteAMontrer("capsule", ["capsule"], true, "capsule")?.id).toBe("capsule");
    expect(visiteAMontrer("home", ["accueil"], true, "capsule")).toBeNull();
  });

  it("les visites vues : le compte et l'appareil réunis, sans doublon", () => {
    expect(vuesReunies(["accueil"], ["accueil", "dressing"])).toEqual(["accueil", "dressing"]);
    expect(vuesReunies(undefined, [])).toEqual([]);
  });
});
