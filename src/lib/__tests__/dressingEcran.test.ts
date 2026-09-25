import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATS } from "../data";
import {
  GROUPES_VESTIAIRE,
  associationsNouvelles,
  categoriesManquantes,
  choisirADecouvrir,
  groupesDuVestiaire,
  syntheseDressing,
  visuelGroupe,
} from "../dressingEcran";
import type { CategoryKey, Item } from "../types";

function piece(id: number, cat: CategoryKey): Item {
  return { id, name: "Pièce " + id, cat, color: "Beige", hex: "#D8C8B0", season: "Toutes saisons", worn: null };
}

describe("groupes du vestiaire — configuration", () => {
  it("chaque catégorie de CATS appartient à exactement un groupe : aucune pièce ne peut disparaître", () => {
    for (const [cat] of CATS) {
      expect(GROUPES_VESTIAIRE.filter((g) => g.cats.includes(cat)).map((g) => g.id)).toHaveLength(1);
    }
  });

  it("chaque visuel annoncé existe dans public/, pour les deux profils", () => {
    for (const g of GROUPES_VESTIAIRE) {
      for (const genre of ["femme", "homme"] as const) {
        expect(existsSync(join(process.cwd(), "public", visuelGroupe(g, genre)))).toBe(true);
      }
    }
  });
});

describe("groupesDuVestiaire", () => {
  const dressing = [piece(1, "robe"), piece(2, "jean"), piece(3, "pantalon"), piece(4, "bijou")];

  it("seulement les groupes où il y a des pièces, dans l'ordre de la configuration, pièces cumulées", () => {
    expect(groupesDuVestiaire(dressing, "femme").map((g) => [g.id, g.nbPieces])).toEqual([
      ["robes-combinaisons", 1],
      ["pantalons-jeans-shorts", 2],
      ["bijoux-accessoires", 1],
    ]);
  });

  it("libellé et visuel suivent le profil ; repli sur le visuel femme quand le profil homme n'en a pas", () => {
    const homme = groupesDuVestiaire(dressing, "homme");
    expect(homme.find((g) => g.id === "bijoux-accessoires")).toMatchObject({ libelle: "Accessoires", visuel: "/images/categories/homme_bijoux-accessoires.webp" });
    expect(homme.find((g) => g.id === "robes-combinaisons")?.visuel).toBe("/images/categories/femme_robes-combinaisons.webp");
    expect(groupesDuVestiaire(dressing, null).find((g) => g.id === "bijoux-accessoires")?.libelle).toBe("Accessoires & bijoux");
  });

  it("dressing vide : aucun groupe", () => {
    expect(groupesDuVestiaire([], "femme")).toEqual([]);
  });
});

describe("syntheseDressing — les quatre états de la limite gratuite", () => {
  it.each([
    [0, 0, "0 / 20 pièces", false],
    [5, 3, "5 / 20 pièces · 3 catégories", false],
    [19, 5, "19 / 20 pièces · 5 catégories", false],
    [20, 5, "20 / 20 pièces · 5 catégories", true],
  ])("gratuit, %i pièces", (n, c, texte, complet) => {
    expect(syntheseDressing("gratuit", n, c)).toEqual({ texte, complet });
  });

  it("au-delà de 20 (pièces antérieures à la limite) : pas de « 23 / 20 », mais complet", () => {
    expect(syntheseDressing("gratuit", 23, 6)).toEqual({ texte: "23 pièces · 6 catégories", complet: true });
  });

  it("Premium ou droit non vérifié : aucune limite annoncée", () => {
    expect(syntheseDressing("premium", 20, 5)).toEqual({ texte: "20 pièces · 5 catégories", complet: false });
    expect(syntheseDressing("inconnu", 1, 1)).toEqual({ texte: "1 pièce · 1 catégorie", complet: false });
  });
});

describe("associationsNouvelles", () => {
  it("écarte un look enregistré, une tenue portée, un doublon et une tenue d'une seule pièce", () => {
    const tenues = [{ ids: [1, 2, 3] }, { ids: [3, 2, 1] }, { ids: [4, 5] }, { ids: [6] }, { ids: [7, 8] }];
    expect(associationsNouvelles(tenues, [[5, 4]]).map((t) => t.ids)).toEqual([[1, 2, 3], [7, 8]]);
  });
});

describe("categoriesManquantes", () => {
  it("catégories de la capsule absentes du dressing, sans doublon", () => {
    expect(categoriesManquantes([piece(10, "robe"), piece(11, "sac"), piece(12, "sac")], [piece(1, "robe")])).toEqual(["sac"]);
  });
});

describe("choisirADecouvrir", () => {
  const base = { etat: "gratuit" as const, nbPieces: 8, nbAssociations: 0, nbManques: 0 };

  it("associations nouvelles d'abord, puis un manque de la capsule, sinon rien", () => {
    expect(choisirADecouvrir({ ...base, nbAssociations: 3, nbManques: 2 })).toEqual({ cas: "associations", nombre: 3 });
    expect(choisirADecouvrir({ ...base, nbManques: 2 })).toEqual({ cas: "manque" });
    expect(choisirADecouvrir(base)).toBeNull();
  });

  it("proche de la limite gratuite : jamais d'incitation à ajouter, même s'il manque une catégorie", () => {
    expect(choisirADecouvrir({ ...base, nbPieces: 18, nbManques: 4 })).toEqual({ cas: "proche_limite", nbPieces: 18 });
    expect(choisirADecouvrir({ ...base, etat: "premium", nbPieces: 18, nbManques: 4 })).toEqual({ cas: "manque" });
  });

  it("dressing vide : pas de section", () => {
    expect(choisirADecouvrir({ ...base, nbPieces: 0, nbManques: 5 })).toBeNull();
  });
});
