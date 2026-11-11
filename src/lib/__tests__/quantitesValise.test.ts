import { describe, expect, it } from "vitest";
import { ajusterQuantite, nombreDePieces, quantiteDe, quantitesValides, QUANTITE_MAX, volumeAvecQuantites } from "../quantitesValise";
import { unitesDe } from "../valise";

/** LES QUANTITÉS DE LA VALISE (07/11/2026). */
describe("quantités de la valise", () => {
  it("1 par défaut ; bornées ; une valeur abîmée se lit 1", () => {
    expect(quantiteDe(undefined, 5)).toBe(1);
    expect(quantiteDe({ "5": 3 }, 5)).toBe(3);
    expect(quantiteDe({ "5": 40 }, 5)).toBe(QUANTITE_MAX);
    expect(quantiteDe({ "5": 2.5 }, 5)).toBe(1);
  });

  it("+ et − ; un retour à 1 efface l'entrée ; jamais sous 1 ni au-delà du plafond", () => {
    const deux = ajusterQuantite(undefined, 5, 1);
    expect(deux).toEqual({ "5": 2 });
    expect(ajusterQuantite(deux, 5, -1)).toBeUndefined();
    expect(ajusterQuantite(undefined, 5, -1)).toBeUndefined();
    expect(ajusterQuantite({ "5": QUANTITE_MAX }, 5, 1)).toEqual({ "5": QUANTITE_MAX });
    expect(ajusterQuantite({ "5": 2, a: 3 }, "a", -2)).toEqual({ "5": 2 });
  });

  it("une pièce retirée de la valise ne garde pas sa quantité", () => {
    expect(quantitesValides({ "5": 2, "6": 3 }, [6])).toEqual({ "6": 3 });
    expect(quantitesValides({ "5": 2 }, [6])).toBeUndefined();
  });

  it("le volume et le nombre de pièces comptent les quantités", () => {
    const pieces = [{ id: 1, cat: "haut" as const }, { id: 2, cat: "chaussures" as const }];
    expect(volumeAvecQuantites(pieces, undefined)).toBe(unitesDe("haut") + unitesDe("chaussures"));
    expect(volumeAvecQuantites(pieces, { "1": 3 })).toBe(3 * unitesDe("haut") + unitesDe("chaussures"));
    expect(nombreDePieces(pieces, { "1": 3 })).toBe(4);
  });
});
