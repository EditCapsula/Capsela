import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CATS } from "../data";
import {
  DRESSING_GROUPS,
  MIN_PIECES_DRESSING_ASSOCIATION,
  assezDuDressing,
  associationsNouvelles,
  categoriesManquantes,
  choisirADecouvrir,
  groupesDuVestiaire,
  piecesPourVisuelCategorie,
  enteteDressing,
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

describe("assezDuDressing — une association complétée par la capsule reste « avec tes pièces »", () => {
  const dressing = [{ id: 1 }, { id: 2 }, { id: 3 }] as never[];
  it("le seuil est de deux pièces du dressing", () => {
    expect(MIN_PIECES_DRESSING_ASSOCIATION).toBe(2);
  });
  it("accepte une tenue dont deux pièces sont au dressing, le reste étant des suggestions", () => {
    expect(assezDuDressing([1, 2, 100901], dressing)).toBe(true);
  });
  it("refuse une tenue qui n'a qu'une pièce du dressing ou aucune", () => {
    expect(assezDuDressing([1, 100901, 100902], dressing)).toBe(false);
    expect(assezDuDressing([100901, 100902], dressing)).toBe(false);
  });
  it("accepte une tenue entièrement du dressing", () => {
    expect(assezDuDressing([1, 2, 3], dressing)).toBe(true);
  });
});

describe("enteteDressing — le total en ligne forte, comme la Capsule", () => {
  it("gratuit : le total, les catégories et les places restantes", () => {
    expect(enteteDressing("gratuit", 7, 3)).toEqual({ titre: "7 pièces dans ton dressing", detail: "3 catégories · 13 places restantes" });
    expect(enteteDressing("gratuit", 19, 5).detail).toBe("5 catégories · 1 place restante");
    expect(enteteDressing("gratuit", 20, 5).detail).toBe("5 catégories · dressing complet");
    expect(enteteDressing("gratuit", 23, 6).detail).toBe("6 catégories · dressing complet");
  });
  it("Premium ou droit non vérifié : aucune limite annoncée", () => {
    expect(enteteDressing("premium", 7, 3)).toEqual({ titre: "7 pièces dans ton dressing", detail: "3 catégories" });
    expect(enteteDressing("inconnu", 1, 1)).toEqual({ titre: "1 pièce dans ton dressing", detail: "1 catégorie" });
  });
});

describe("piecesPourVisuelCategorie", () => {
  const propre = (id: number, cat: CategoryKey, photoUrl = `https://x/${id}.detouree.webp`): Item => ({ ...piece(id, cat), photoUrl });

  it("pièces détourées de la catégorie, les plus récentes d'abord, 3 au plus", () => {
    const r = piecesPourVisuelCategorie([propre(1, "haut"), propre(2, "pull"), propre(3, "haut"), propre(4, "haut"), propre(5, "jupe")], ["haut", "pull"]);
    expect(r.map((p) => p.id)).toEqual([4, 3, 2]);
  });

  it("une photo brute ou une pièce sans image n'illustre pas", () => {
    const brute = { ...piece(1, "sac"), photoUrl: "https://x/1.jpg" };
    expect(piecesPourVisuelCategorie([brute, piece(2, "sac")], ["sac"])).toEqual([]);
  });

  it("cases au-dessus de la pastille de libellé", () => {
    for (const n of [1, 2, 3]) {
      const items = Array.from({ length: n }, (_, k) => propre(k + 1, "sac"));
      for (const c of piecesPourVisuelCategorie(items, ["sac"])) expect(c.t + c.h).toBeLessThanOrEqual(76);
    }
  });

  it("groupesDuVestiaire joint ces pièces à la carte, vide sinon", () => {
    const g = groupesDuVestiaire([propre(1, "sac"), piece(2, "bijou")], "femme");
    expect(g.find((x) => x.id === "sacs")?.propres).toHaveLength(1);
    expect(g.find((x) => x.id === "bijoux-accessoires")?.propres).toEqual([]);
  });
});
