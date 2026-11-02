import { describe, expect, it } from "vitest";
import {
  avancer,
  categoriesPresentes,
  choisir,
  cleEntree,
  couleursPresentes,
  detailsCapsule,
  emplacementFacultatif,
  FILTRES_PAR_DEFAUT,
  filtrerExplorer,
  piecesClesParFamille,
  piecesComposees,
  piecesParEmplacement,
  raisonsComposition,
  selectionDeDepart,
  type EntreeCapsule,
} from "../capsuleOnglets";
import { EMPTY_PROFILE, type Profile } from "../profile";
import type { Item } from "../types";

// Refonte de « Ma Capsule » en quatre onglets (01/11/2026).

function piece(id: number, over: Partial<Item> = {}): Item {
  return { id, name: "Pièce " + id, cat: "haut", color: "Beige", hex: "#D8C8B0", season: "Toutes saisons", worn: null, ...over };
}
const sugg = (it: Item): EntreeCapsule => ({ item: it, possedee: false });
const a_moi = (it: Item): EntreeCapsule => ({ item: it, possedee: true });
const profil = (over: Partial<Profile> = {}): Profile => ({ ...EMPTY_PROFILE, gender: "femme", ...over });

const entrees: EntreeCapsule[] = [
  sugg(piece(1, { cat: "haut" })),
  sugg(piece(2, { cat: "haut" })),
  a_moi(piece(3, { cat: "haut" })),
  sugg(piece(4, { cat: "pantalon" })),
  sugg(piece(5, { cat: "robe" })),
  sugg(piece(6, { cat: "chaussures" })),
  sugg(piece(7, { cat: "veste" })),
];

describe("Composer", () => {
  const groupes = piecesParEmplacement(entrees);

  it("le dressing passe devant les suggestions dans son emplacement", () => {
    expect(groupes.haut.map((e) => e.item.id)).toEqual([3, 1, 2]);
  });

  it("au départ : haut, bas et chaussures ; la robe attend s'il y a un haut et un bas ; la veste hors été", () => {
    expect(piecesComposees(groupes, selectionDeDepart(groupes, "Automne")).map((e) => e.item.id)).toEqual([3, 4, 7, 6]);
    expect(piecesComposees(groupes, selectionDeDepart(groupes, "Été")).map((e) => e.item.id)).toEqual([3, 4, 6]);
  });

  it("une flèche ne change QUE son emplacement, en boucle", () => {
    const depart = selectionDeDepart(groupes, "Automne");
    const suivant = avancer(depart, "haut", groupes, 1);
    expect(piecesComposees(groupes, suivant).map((e) => e.item.id)).toEqual([1, 4, 7, 6]);
    expect(avancer(suivant, "haut", groupes, -1)).toEqual(depart);
    expect(avancer(depart, "haut", groupes, -1).haut).toBe(2);
  });

  it("un emplacement facultatif passe par « Sans »", () => {
    const depart = selectionDeDepart(groupes, "Automne");
    expect(avancer(depart, "dessus", groupes, 1).dessus).toBe(-1);
  });

  it("une robe choisie remplace le haut et le bas ; toucher au haut retire la robe", () => {
    const robe = avancer(selectionDeDepart(groupes, "Automne"), "robe", groupes, 1);
    expect(piecesComposees(groupes, robe).map((e) => e.item.id)).toEqual([5, 7, 6]);
    const haut = avancer(robe, "haut", groupes, 1);
    expect(haut.robe).toBe(-1);
    expect(piecesComposees(groupes, haut).map((e) => e.item.id)).toEqual([1, 4, 7, 6]);
  });

  it("« Composer avec cette pièce » la place sans toucher les autres emplacements", () => {
    const sel = choisir(selectionDeDepart(groupes, "Automne"), "haut", 2, groupes);
    expect(piecesComposees(groupes, sel).map((e) => e.item.id)).toEqual([2, 4, 7, 6]);
  });

  describe("le col roulé se porte seul (règle du moteur, 02/11/2026)", () => {
    const g = piecesParEmplacement([
      ...entrees,
      sugg(piece(10, { cat: "pull", name: "Pull col roulé", subtype: "Pull col roulé" })),
      sugg(piece(11, { cat: "pull", name: "Pull col rond", subtype: "Pull col rond" })),
      sugg(piece(12, { cat: "pull", name: "Cardigan", subtype: "Cardigan", rolePiece: "calque" })),
    ]);
    const ids = (sel: ReturnType<typeof selectionDeDepart>) => piecesComposees(g, sel).map((e) => e.item.id);

    it("au départ d'automne, un col roulé arrive sans haut ; en été, pas de pull donc le haut reste", () => {
      expect(ids(selectionDeDepart(g, "Automne"))).toEqual([4, 10, 7, 6]);
      expect(ids(selectionDeDepart(g, "Été"))).toEqual([3, 4, 6]);
    });

    it("poser un haut retire le col roulé ; poser un col roulé retire le haut", () => {
      const depart = selectionDeDepart(g, "Automne");
      const avecHaut = choisir(depart, "haut", 0, g);
      expect(ids(avecHaut)).toEqual([3, 4, 7, 6]);
      expect(ids(choisir(avecHaut, "maille", 0, g))).toEqual([4, 10, 7, 6]);
    });

    it("un pull col rond peut rester seul ou se poser sur un haut : le haut laissé vide reste au choix", () => {
      const colRond = avancer(selectionDeDepart(g, "Automne"), "maille", g, 1);
      expect(ids(colRond)).toEqual([4, 11, 7, 6]);
      expect(emplacementFacultatif("haut", g, colRond)).toBe(true);
      expect(ids(avancer(colRond, "haut", g, 1))).toEqual([3, 4, 11, 7, 6]);
    });

    it("jamais de haut vide sous un cardigan ni sans pull : le haut revient", () => {
      const colRond = avancer(selectionDeDepart(g, "Automne"), "maille", g, 1);
      const cardigan = avancer(colRond, "maille", g, 1);
      expect(emplacementFacultatif("haut", g, cardigan)).toBe(false);
      expect(ids(cardigan)).toEqual([3, 4, 12, 7, 6]);
      const sansPull = choisir(colRond, "maille", -1, g);
      expect(emplacementFacultatif("haut", g, sansPull)).toBe(false);
      expect(ids(sansPull)).toEqual([3, 4, 7, 6]);
    });
  });

  it("« Pourquoi cette tenue ? » ne dit que ce que les pièces rendent vrai", () => {
    expect(raisonsComposition([piece(1), piece(2, { cat: "pantalon" })], profil())).toEqual([
      "Des couleurs voisines ou complémentaires, qui s'accordent.",
    ]);
    const deux = [piece(1, { estBasiqueCapsule: true, hex: "#000000" }), piece(2, { cat: "pantalon", estBasiqueCapsule: true, hex: "#0000FF" })];
    expect(raisonsComposition(deux, profil())).toContain("Construite sur 2 indispensables, faciles à associer.");
    expect(raisonsComposition([piece(1)], profil())).toEqual([]);
  });
});

describe("Explorer", () => {
  const avecCouleurs = [
    sugg(piece(1, { color: "Noir", hex: "#000000" })),
    sugg(piece(2, { cat: "pantalon", color: "noir", hex: "#000000", name: "Alpha" })),
    a_moi(piece(3, { cat: "pantalon", color: "Beige" })),
    sugg(piece(4, { cat: "jupe", color: "" })),
  ];

  it("catégories et couleurs viennent des pièces affichées, jamais vides", () => {
    expect(categoriesPresentes(avecCouleurs).map((c) => [c.cat, c.n])).toEqual([["haut", 1], ["pantalon", 2], ["jupe", 1]]);
    expect(couleursPresentes(avecCouleurs).map((c) => [c.nom, c.n])).toEqual([["Noir", 2], ["Beige", 1]]);
  });

  it("filtre par catégorie, couleur et favoris ; trie", () => {
    const ids = (f: Partial<typeof FILTRES_PAR_DEFAUT>, fav: string[] = []) =>
      filtrerExplorer(avecCouleurs, { ...FILTRES_PAR_DEFAUT, ...f }, new Set(fav)).map((e) => e.item.id);
    expect(ids({ categorie: "pantalon" })).toEqual([2, 3]);
    expect(ids({ couleur: "NOIR" })).toEqual([1, 2]);
    expect(ids({ categorie: "favoris" }, [cleEntree(avecCouleurs[2])])).toEqual([3]);
    expect(ids({ tri: "dressing" })[0]).toBe(3);
    expect(ids({ tri: "nom" })[0]).toBe(2);
  });

  it("la clé d'un favori distingue le dressing du catalogue", () => {
    expect(cleEntree(sugg(piece(9)))).toBe("c9");
    expect(cleEntree(a_moi(piece(9)))).toBe("d9");
  });
});

describe("Pièces clés", () => {
  it("seulement des indispensables et des pièces signature, une par catégorie d'abord", () => {
    const capsule = [
      piece(1, { estBasiqueCapsule: true }),
      piece(2, { estBasiqueCapsule: true }),
      piece(3, { cat: "pantalon", estBasiqueCapsule: true }),
      piece(4, { cat: "veste", statement: true }),
      piece(5, { cat: "jupe" }),
    ];
    const cles = piecesClesParFamille(capsule, [], profil());
    expect(cles.map((c) => [c.item.id, c.famille])).toEqual([
      [1, "indispensable"],
      [3, "indispensable"],
      [4, "signature"],
      [2, "indispensable"],
    ]);
    expect(cles[0].explication.startsWith("Une base facile à associer.")).toBe(true);
  });

  it("rien de qualifié : rien d'inventé", () => {
    expect(piecesClesParFamille([piece(1, { statement: false })], [], profil())).toEqual([]);
  });
});

describe("Détails", () => {
  it("des chiffres comptés sur les pièces affichées", () => {
    const d = detailsCapsule([
      a_moi(piece(1)),
      sugg(piece(2, { cat: "pantalon", color: "Noir", estBasiqueCapsule: true, statement: false })),
      sugg(piece(3, { cat: "veste", statement: true })),
    ]);
    expect(d).toMatchObject({ pieces: 3, couleurs: 2, categories: 3, dansLeDressing: 1, suggestions: 2, indispensables: 1, signatures: 1 });
  });
});
