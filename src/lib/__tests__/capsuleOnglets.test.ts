import { describe, expect, it } from "vitest";
import {
  accrocheSelection,
  criteresDeSelection,
  avancer,
  avancerOuChanger,
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
  selectionDepuisTenue,
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

  it("la tenue du moteur devient la sélection : « Sans » là où il n'a rien mis (13/11/2026)", () => {
    const sel = selectionDepuisTenue(groupes, [1, 4, 6]);
    expect(sel).not.toBeNull();
    expect(piecesComposees(groupes, sel!).map((e) => e.item.id)).toEqual([1, 4, 6]);
    expect(sel!.dessus).toBe(-1);
    expect(piecesComposees(groupes, selectionDepuisTenue(groupes, [5, 6])!).map((e) => e.item.id)).toEqual([5, 6]);
  });

  it("une tenue sans haut et bas ni robe ne remplace pas la sélection de départ", () => {
    expect(selectionDepuisTenue(groupes, [6, 7])).toBeNull();
    expect(selectionDepuisTenue(groupes, [])).toBeNull();
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

describe("« Une sélection pensée pour toi » : seuls les critères réellement utilisés (05/11/2026)", () => {
  const base = { styleExplore: null, saison: "Automne" as const, possedees: 3, suggestions: 31 };

  it("style, couleurs déclarées, saison et dressing, avec les chiffres réels", () => {
    const c = criteresDeSelection({ ...base, profile: profil({ styles: ["minimaliste"], paletteCouleurs: ["#2A2724"] }) });
    expect(c.map((x) => x.cle)).toEqual(["style", "couleurs", "saison", "dressing"]);
    expect(c.find((x) => x.cle === "dressing")!.valeur).toBe("3 pièces intégrées · 31 suggestions Capsela");
    expect(c.find((x) => x.cle === "couleurs")!.titre).toBe("Tes couleurs préférées");
    expect(c.find((x) => x.cle === "saison")!.valeur).toBe("Automne · Environ 12 °C");
    expect(c.find((x) => x.cle === "saison")!.texte).toContain("adaptées à l'automne");
    expect(accrocheSelection(c)).toBe("Des pièces choisies pour ton style, tes couleurs préférées et la saison.");
  });

  // 15/11/2026 : la colorimétrie oriente la capsule, juste après les couleurs préférées (capsule.ts, colorimetrieCapsule « hierarchie ») —
  // ce test disait l'inverse depuis le 05/11/2026, quand elle n'y entrait pas.
  it("la colorimétrie exploitable est un critère, distinct des couleurs préférées", () => {
    const c = criteresDeSelection({
      ...base,
      profile: profil({ styles: ["minimaliste"], colorimetrie: { statut: "faite", saison: "automne", libelle: "Automne profond", signature: ["#8B4513"] } }),
    });
    expect(c.map((x) => x.cle)).not.toContain("couleurs");
    expect(c.find((x) => x.cle === "colorimetrie")?.valeur).toBe("Automne profond");
    expect(accrocheSelection(c)).toBe("Des pièces choisies pour ton style, ta colorimétrie et la saison.");
  });
  it("sans colorimétrie exploitable, pas de critère colorimétrie", () => {
    expect(criteresDeSelection({ ...base, profile: profil({ styles: ["minimaliste"] }) }).map((x) => x.cle)).not.toContain("colorimetrie");
  });

  it("la silhouette seulement quand elle oriente la sélection ; aucun critère inventé sans profil", () => {
    expect(criteresDeSelection({ ...base, profile: profil({ morphology: "f_poire" }) }).map((x) => x.cle)).toContain("silhouette");
    expect(criteresDeSelection({ ...base, profile: profil({ morphology: "f_sablier" }) }).map((x) => x.cle)).not.toContain("silhouette");
    expect(criteresDeSelection({ ...base, possedees: 0, suggestions: 0, profile: profil() }).map((x) => x.cle)).toEqual(["saison"]);
  });

  it("un style exploré : le style exploré, et le dressing dit qu'il n'entre pas dans cette sélection", () => {
    const c = criteresDeSelection({ ...base, possedees: 0, styleExplore: "boheme", profile: profil({ styles: ["minimaliste"] }) });
    expect(c[0].titre).toBe("Le style exploré");
    expect(c.find((x) => x.cle === "dressing")!.texte).toContain("n'entrent pas");
  });
});

describe("Composer : les flèches enchaînent les catégories (05/11/2026)", () => {
  const groupes = piecesParEmplacement(entrees);
  const presents = (["haut", "bas", "robe", "dessus", "chaussures"] as const).slice();
  it("tant qu'il reste des pièces, la flèche reste dans la catégorie", () => {
    const depart = selectionDeDepart(groupes, "Automne");
    const r = avancerOuChanger(depart, "haut", presents, groupes, 1);
    expect(r.actif).toBe("haut");
    expect(r.sel.haut).toBe(1);
  });
  it("à la dernière pièce, la flèche suivante passe à la catégorie suivante et y montre la pièce d'après", () => {
    const fin = { ...selectionDeDepart(groupes, "Automne"), haut: 2 };
    const r = avancerOuChanger(fin, "haut", presents, groupes, 1);
    expect(r.actif).toBe("bas");
    expect(r.sel.haut).toBe(2);
  });
  it("en reculant depuis la première pièce, la flèche passe à la catégorie précédente ; après la dernière, la première", () => {
    const depart = selectionDeDepart(groupes, "Automne");
    expect(avancerOuChanger(depart, "haut", presents, groupes, -1).actif).toBe("chaussures");
    const finChaussures = { ...depart, chaussures: 0 };
    expect(avancerOuChanger(finChaussures, "chaussures", presents, groupes, 1).actif).toBe("haut");
  });
});


describe("Composer : un haut n'est jamais posé sans bas (19/11/2026)", () => {
  // Signalé : la tenue du moteur avait une robe ; la robe passée à « Sans » aux flèches, la planche montrait un haut sans bas.
  const prune = piece(20, { cat: "haut", color: "Prune", hex: "#5B3A4A" });
  const jupeRouge = piece(21, { cat: "jupe", color: "Rouge cerise", hex: "#A32B33" });
  const pantalonNoir = piece(22, { cat: "pantalon", color: "Noir", hex: "#2A2724" });
  const robe = piece(23, { cat: "robe" });
  const chaussures = piece(24, { cat: "chaussures" });
  const groupes = piecesParEmplacement([sugg(prune), sugg(jupeRouge), sugg(pantalonNoir), sugg(robe), sugg(chaussures)]);
  const ids = (sel: ReturnType<typeof choisir>) => piecesComposees(groupes, sel).map((e) => e.item.id);

  it("la robe de la tenue du moteur passe à « Sans » : un bas revient avec le haut", () => {
    const depart = selectionDepuisTenue(groupes, [23, 24])!;
    expect(ids(depart)).toEqual([23, 24]);
    const sansRobe = avancer(depart, "robe", groupes, -1);
    expect(ids(sansRobe)).toContain(20);
    expect(ids(sansRobe).some((id) => id === 21 || id === 22)).toBe(true);
  });

  it("le bas qui revient s'accorde au haut : le neutre d'abord", () => {
    const sansRobe = avancer(selectionDepuisTenue(groupes, [23, 24])!, "robe", groupes, -1);
    expect(ids(sansRobe)).toContain(22);
  });

  it("aucune composition sans robe ne laisse un haut seul, quel que soit le chemin des flèches", () => {
    let sel = selectionDepuisTenue(groupes, [23, 24])!;
    const presents = (["haut", "bas", "robe", "chaussures"] as const).filter((c) => groupes[c].length > 0);
    let actif: (typeof presents)[number] = "robe";
    for (let i = 0; i < 20; i++) {
      const r = avancerOuChanger(sel, actif, presents, groupes, i % 3 === 0 ? -1 : 1);
      sel = r.sel;
      actif = r.actif as typeof actif;
      const poses = ids(sel);
      if (!poses.includes(23) && poses.includes(20)) expect(poses.some((id) => id === 21 || id === 22)).toBe(true);
    }
  });
});

describe("Composer : avec les collants de la robe, le bas qui revient est une jupe (19/11/2026)", () => {
  const haut = piece(30, { cat: "haut", color: "Prune", hex: "#5B3A4A" });
  const pantalon = piece(31, { cat: "pantalon", color: "Noir", hex: "#2A2724" });
  const jupe = piece(32, { cat: "jupe", color: "Bordeaux", hex: "#6E3B3A" });
  const robe = piece(33, { cat: "robe" });
  const collants = piece(34, { cat: "accessoire", accessoireType: "Collants" } as Partial<Item>);
  const groupes = piecesParEmplacement([sugg(haut), sugg(pantalon), sugg(jupe), sugg(robe), sugg(collants)]);
  it("la robe et ses collants, puis la robe à « Sans » : la jupe, pas le pantalon", () => {
    const sel = avancer(selectionDepuisTenue(groupes, [33, 34])!, "robe", groupes, -1);
    const poses = piecesComposees(groupes, sel).map((e) => e.item.id);
    expect(poses).toContain(32);
    expect(poses).not.toContain(31);
  });
});

describe("Composer : les collants ne sont pas un bas (19/11/2026)", () => {
  const haut = piece(40, { cat: "haut" });
  const pantalon = piece(41, { cat: "pantalon", color: "Noir", hex: "#2A2724" });
  const robe = piece(42, { cat: "robe" });
  const collants = piece(43, { cat: "accessoire", accessoireType: "Collants" } as Partial<Item>);
  const groupes = piecesParEmplacement([sugg(haut), sugg(pantalon), sugg(robe), sugg(collants)]);
  it("sans jupe ni short : le pantalon revient et les collants sont retirés", () => {
    const sel = avancer(selectionDepuisTenue(groupes, [42, 43])!, "robe", groupes, -1);
    const poses = piecesComposees(groupes, sel).map((e) => e.item.id);
    expect(poses).toEqual(expect.arrayContaining([40, 41]));
    expect(poses).not.toContain(43);
  });
  it("avec la robe, les collants restent", () => {
    const poses = piecesComposees(groupes, selectionDepuisTenue(groupes, [42, 43])!).map((e) => e.item.id);
    expect(poses).toEqual(expect.arrayContaining([42, 43]));
  });
});
