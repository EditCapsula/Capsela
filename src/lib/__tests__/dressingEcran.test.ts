import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATS } from "../data";
import {
  DRESSING_GROUPS,
  associationsNouvelles,
  categoriesManquantes,
  choisirADecouvrir,
  groupesDuVestiaire,
  syntheseDressing,
} from "../dressingEcran";
import type { CategoryKey, Item } from "../types";

function piece(id: number, cat: CategoryKey): Item {
  return { id, name: "Pièce " + id, cat, color: "Beige", hex: "#D8C8B0", season: "Toutes saisons", worn: null };
}

describe("groupes du vestiaire — configuration", () => {
  it("femme : chaque catégorie de CATS dans exactement une carte", () => {
    for (const [cat] of CATS) {
      expect(DRESSING_GROUPS.femme.filter((g) => g.categories.includes(cat))).toHaveLength(1);
    }
  });

  it("homme : la configuration demandée, sans robes, combinaisons ni jupes", () => {
    expect(DRESSING_GROUPS.homme.map((g) => g.label)).toEqual([
      "Hauts & mailles",
      "Pantalons, jeans & shorts",
      "Vestes & manteaux",
      "Chaussures",
      "Sacs",
      "Bijoux & accessoires",
    ]);
    const couvertes = DRESSING_GROUPS.homme.flatMap((g) => g.categories);
    expect(new Set(couvertes).size).toBe(couvertes.length);
    expect(couvertes).not.toContain("robe");
    expect(couvertes).not.toContain("jupe");
  });

  it("catégories techniques inchangées : chaque clé existe dans CATS", () => {
    const cles = new Set(CATS.map(([c]) => c));
    for (const g of DRESSING_GROUPS.femme) for (const c of g.categories) expect(cles.has(c)).toBe(true);
  });

  it("chaque visuel d'une carte existe dans public/", () => {
    const tout = CATS.map(([c], i) => piece(i + 1, c));
    for (const genre of ["femme", "homme"] as const) {
      for (const g of groupesDuVestiaire(tout, genre)) {
        expect(existsSync(join(process.cwd(), "public", g.visuel))).toBe(true);
      }
    }
  });
});

describe("groupesDuVestiaire", () => {
  const dressing = [piece(1, "robe"), piece(2, "jean"), piece(3, "pantalon"), piece(4, "bijou"), piece(5, "pull"), piece(6, "haut")];

  it("seulement les cartes où il y a des pièces, dans l'ordre, compteur = somme des catégories techniques", () => {
    expect(groupesDuVestiaire(dressing, "femme").map((g) => [g.libelle, g.nbPieces, g.categories])).toEqual([
      ["Robes & combinaisons", 1, ["robe", "combinaison"]],
      ["Hauts & mailles", 2, ["haut", "pull"]],
      ["Pantalons, jeans & shorts", 2, ["pantalon", "jean", "short"]],
      ["Bijoux & accessoires", 1, ["bijou", "accessoire"]],
    ]);
  });

  it("homme : visuels homme ; une robe saisie garde sa carte (visuel femme), en fin de liste", () => {
    const homme = groupesDuVestiaire(dressing, "homme");
    expect(homme.map((g) => g.id)).toEqual(["hauts", "pantalons-jeans-shorts", "bijoux-accessoires", "robes-combinaisons"]);
    expect(homme[0].visuel).toBe("/images/categories/homme_hauts.webp");
    expect(homme[3].visuel).toBe("/images/categories/femme_robes-combinaisons.webp");
  });

  it("toute pièce appartient à une carte, quel que soit le profil", () => {
    const tout = CATS.map(([c], i) => piece(i + 1, c));
    for (const genre of ["femme", "homme", null] as const) {
      expect(groupesDuVestiaire(tout, genre).reduce((n, g) => n + g.nbPieces, 0)).toBe(tout.length);
    }
  });

  it("dressing vide : aucune carte", () => {
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
