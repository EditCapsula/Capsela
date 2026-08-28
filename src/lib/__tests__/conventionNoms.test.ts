import { describe, expect, it } from "vitest";
import { composerNom, decouper, estLongueur, matierePrincipale } from "../conventionNoms";

describe("découpage de sous_type", () => {
  it("isole la longueur quand elle figure dans sous_type", () => {
    expect(decouper("Robe longue")).toMatchObject({ type: "Robe", longueur: "longue", detail: "" });
    expect(decouper("Jupe midi plissée")).toMatchObject({ type: "Jupe", longueur: "midi", detail: "plissée" });
    expect(decouper("Jupe courte droite")).toMatchObject({ type: "Jupe", longueur: "courte", detail: "droite" });
  });

  it("ne devine aucune longueur quand sous_type n'en porte pas", () => {
    expect(decouper("Pantalon à pinces")).toMatchObject({ type: "Pantalon", longueur: null, detail: "à pinces" });
    expect(decouper("Pull col rond")).toMatchObject({ type: "Pull", longueur: null, detail: "col rond" });
  });

  it("signale une longueur déplacée plutôt que de réordonner en silence", () => {
    // "Manteau croisé long" → la convention veut Manteau + long + croisé :
    // l'ordre des mots change, ce n'est pas anodin, donc c'est remonté.
    expect(decouper("Manteau croisé long")).toMatchObject({ longueur: "long", longueurDeplacee: true });
    expect(decouper("Robe longue fluide").longueurDeplacee).toBe(false);
  });

  it("signale plusieurs longueurs au lieu d'en choisir une", () => {
    expect(decouper("Robe courte longue").longueursMultiples).toEqual(["courte", "longue"]);
  });

  it("reconnaît les longueurs quel que soit le genre ou le nombre", () => {
    for (const mot of ["courte", "court", "longue", "long", "midi", "mini", "maxi"]) {
      expect(estLongueur(mot), mot).toBe(true);
    }
    for (const mot of ["plissée", "pinces", "rond", "droite", "lin"]) {
      expect(estLongueur(mot), mot).toBe(false);
    }
  });
});

describe("composition du nom", () => {
  it("place la coupe entre la longueur et le détail", () => {
    expect(composerNom("Pantalon à pinces", "Ample").nom).toBe("Pantalon large à pinces");
    expect(composerNom("Robe longue", "Fluide").nom).toBe("Robe longue fluide");
    expect(composerNom("Chemise", "Oversize").nom).toBe("Chemise oversize");
  });

  it("n'ajoute aucune coupe quand la colonne est vide", () => {
    expect(composerNom("Pantalon à pinces", null).nom).toBe("Pantalon à pinces");
    expect(composerNom("Pantalon à pinces", "").nom).toBe("Pantalon à pinces");
  });

  it("ne duplique pas une coupe déjà portée par sous_type", () => {
    const r = composerNom("Jupe courte droite", "Droit");
    expect(r.nom).toBe("Jupe courte droite");
    expect(r.coupeDejaPresente).toBe(true);
  });

  it("conserve et signale une coupe hors mapping plutôt que de la traduire", () => {
    const r = composerNom("Veste", "Cintré");
    expect(r.coupeInconnue).toBe(true);
    expect(r.nom).toBe("Veste cintré");
  });
});

describe("matière", () => {
  it("retient la matière principale d'une valeur composée", () => {
    expect(matierePrincipale("Lin / coton")).toBe("lin");
    expect(matierePrincipale("Lin / viscose")).toBe("lin");
    expect(matierePrincipale("Laine")).toBe("laine");
    expect(matierePrincipale(null)).toBeNull();
  });
});
