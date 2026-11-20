import { describe, expect, it } from "vitest";
import { avecOriginesLocales, estOrigineLook, LIBELLE_ORIGINE, phraseOrigine } from "../origineLook";
import type { SavedLook } from "../types";

/** LA PROVENANCE D'UN LOOK (20/11/2026, demandé sur Mes looks). */
const look = (p: Partial<SavedLook>): SavedLook => ({ id: "1", name: "Tenue du 20/11", pieceIds: [1, 2], createdAt: 0, source: "saved", ...p });

describe("phraseOrigine", () => {
  it("une tenue enregistrée dit d'où elle vient", () => {
    expect(phraseOrigine(look({ origine: "tenue_du_jour" }))).toBe("Depuis Ma tenue du jour");
    expect(phraseOrigine(look({ origine: "valise" }))).toBe("Depuis ta valise");
  });
  it("rien d'inventé : un look plus ancien, sans origine gardée, et un look créé n'ont pas de phrase", () => {
    expect(phraseOrigine(look({}))).toBeNull();
    expect(phraseOrigine(look({ source: "created", origine: "accueil" }))).toBeNull();
  });
  it("chaque origine a sa phrase", () => {
    for (const o of Object.keys(LIBELLE_ORIGINE)) expect(phraseOrigine(look({ origine: o as never }))).toMatch(/^Depuis /);
  });
});

describe("avecOriginesLocales : l'appareil complète la base, la base prime", () => {
  it("avant la migration, l'origine gardée sur l'appareil s'affiche", () => {
    expect(avecOriginesLocales([look({ id: "7" })], { "7": "planifier" })[0].origine).toBe("planifier");
  });
  it("une origine en base n'est pas remplacée", () => {
    expect(avecOriginesLocales([look({ id: "7", origine: "accueil" })], { "7": "planifier" })[0].origine).toBe("accueil");
  });
  it("une valeur inconnue n'est pas une origine", () => {
    expect(estOrigineLook("ailleurs")).toBe(false);
    expect(estOrigineLook("composer")).toBe(true);
  });
});
