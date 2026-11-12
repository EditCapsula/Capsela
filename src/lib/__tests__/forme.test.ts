import { describe, expect, it } from "vitest";
import { aUneCouche, aUneLongueur, CATEGORIES_A_LONGUEUR, COUCHES, coucheDepuis, estCoucheFluide, LONGUEURS, longueurDepuis } from "../forme";
import { CATEGORIES_A_LONGUEUR as CATS_EDGE, COUCHES as COUCHES_EDGE, LONGUEURS as LONGUEURS_EDGE } from "../../../supabase/functions/_shared/enumsPiece.ts";

// LA LONGUEUR ET LA COUCHE D'UNE PIÈCE (12/11/2026, migration 0062).

describe("longueur et couche", () => {
  it("les listes de l'app et des fonctions Edge sont identiques", () => {
    expect(LONGUEURS.map((l) => l.valeur)).toEqual([...LONGUEURS_EDGE]);
    expect(COUCHES.map((c) => c.valeur)).toEqual([...COUCHES_EDGE]);
    expect([...CATEGORIES_A_LONGUEUR]).toEqual([...CATS_EDGE]);
  });
  it("seules une robe, une jupe, un manteau ont une longueur ; seule une veste a une couche", () => {
    expect(["robe", "jupe", "manteau"].every((c) => aUneLongueur(c as never))).toBe(true);
    expect(aUneLongueur("pantalon")).toBe(false);
    expect(aUneCouche("veste")).toBe(true);
    expect(aUneCouche("manteau")).toBe(false);
  });
  it("une valeur hors liste se lit inconnue ; jamais déduite d'un nom", () => {
    expect(longueurDepuis("midi")).toBe("midi");
    expect(longueurDepuis("maxi")).toBeUndefined();
    expect(coucheDepuis("fluide")).toBe("fluide");
    expect(coucheDepuis(null)).toBeUndefined();
    expect(estCoucheFluide({ cat: "veste" })).toBe(false);
    expect(estCoucheFluide({ cat: "veste", couche: "fluide" })).toBe(true);
  });
});
