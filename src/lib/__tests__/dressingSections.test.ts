import { describe, expect, it } from "vitest";
import {
  articlePossessif,
  candidatsARedecouvrir,
  designationPiece,
  dateRelativeAjout,
  ideeLaPlusComplete,
  libelleDateRecente,
  libelleLooksPossibles,
  ligneDressing,
  looksDistincts,
  piecesRecentes,
  phrasePiste,
  pisteAssociation,
  saisonDeLaDate,
  separerParSemaine,
} from "../dressingSections";
import type { CategoryKey, Item } from "../types";

// L'écran Dressing V6 (08/10/2026) : les sections se calculent ici, l'écran ne fait que les afficher.

const piece = (id: number, cat: CategoryKey, over: Partial<Item> = {}): Item =>
  ({ id, name: `Pièce ${id}`, cat, color: "Noir", hex: "#222222", season: "Toutes saisons", worn: null, ...over }) as Item;

const MIDI = new Date(2026, 9, 8, 12).getTime();
const jours = (n: number) => new Date(2026, 9, 8 - n, 9).getTime();

describe("ligneDressing", () => {
  it("« n pièces · k catégories », accordé, sans places restantes", () => {
    expect(ligneDressing(12, 5)).toBe("12 pièces · 5 catégories");
    expect(ligneDressing(1, 1)).toBe("1 pièce · 1 catégorie");
  });
});

describe("Ajoutées récemment", () => {
  it("une pièce ajoutée aujourd'hui passe en premier ; le tri ne regarde que la date d'ajout", () => {
    const items = [piece(1, "haut", { createdAt: jours(5) }), piece(2, "jupe", { createdAt: jours(0), worn: 30 }), piece(3, "sac", { createdAt: jours(2) })];
    expect(piecesRecentes(items, 8, MIDI).map((i) => i.id)).toEqual([2, 3, 1]);
    expect(dateRelativeAjout(items[1].createdAt!, MIDI)).toBe("Ajoutée aujourd'hui");
  });
  it("30 derniers jours seulement : une pièce plus ancienne n'est pas « récente », même la dernière ajoutée", () => {
    const items = [piece(1, "haut", { createdAt: jours(29) }), piece(2, "jupe", { createdAt: jours(31) }), piece(3, "sac", { createdAt: jours(90) })];
    expect(piecesRecentes(items, 8, MIDI).map((i) => i.id)).toEqual([1]);
    expect(piecesRecentes([piece(4, "haut", { createdAt: jours(45) })], 8, MIDI)).toEqual([]);
  });
  it("une pièce sans date d'ajout n'y figure pas", () => {
    expect(piecesRecentes([piece(1, "haut")], 8, MIDI)).toEqual([]);
  });
  it("dates relatives en jours calendaires", () => {
    expect(dateRelativeAjout(new Date(2026, 9, 7, 23, 50).getTime(), new Date(2026, 9, 8, 0, 10).getTime())).toBe("Ajoutée hier");
    expect(dateRelativeAjout(jours(3), MIDI)).toBe("Ajoutée il y a 3 jours");
    expect(dateRelativeAjout(jours(65), MIDI)).toBe("Ajoutée il y a 2 mois");
  });
});

describe("À redécouvrir", () => {
  const automne = { seasons: ["Automne / Hiver", "Toutes saisons"] as never, saisons: ["Automne"] as never };
  it("en automne, aucune pièce estivale ; changer de saison recalcule", () => {
    const ete = piece(1, "robe", { season: "Printemps / Été", saisons: ["Été"] });
    const mi = piece(2, "pull", { season: "Automne / Hiver", saisons: ["Automne", "Hiver"] });
    expect(candidatsARedecouvrir([ete, mi], automne, new Map()).map((c) => c.piece.id)).toEqual([2]);
    const ete2 = { seasons: ["Printemps / Été", "Toutes saisons"] as never, saisons: ["Été"] as never };
    expect(candidatsARedecouvrir([ete, mi], ete2, new Map()).map((c) => c.piece.id)).toEqual([1]);
  });
  it("jamais, une fois ou deux fois portée : oui ; trois fois : non — les moins portées d'abord", () => {
    const items = [piece(1, "pull"), piece(2, "pull"), piece(3, "pull"), piece(4, "pull")];
    const ports = new Map([[2, 1], [3, 2], [4, 3]]);
    const r = candidatsARedecouvrir(items, automne, ports);
    expect(r.map((c) => c.piece.id)).toEqual([1, 2, 3]);
    expect(r.map((c) => c.etiquette)).toEqual(["Jamais porté", "Porté 1 fois", "Peu porté"]);
  });
  it("aucune pièce éligible : liste vide (la section est masquée)", () => {
    expect(candidatsARedecouvrir([piece(1, "pull", { worn: 3 })], automne, new Map([[1, 9]]))).toEqual([]);
  });
  it("la piste n'est dite que si une tenue du moteur associe la pièce à une autre du dressing", () => {
    const pull = piece(1, "pull");
    const pantalon = piece(2, "pantalon", { name: "Pantalon tailleur" });
    expect(pisteAssociation(pull, [[1, 2, 9]], [pull, pantalon])).toBe("Avec ton pantalon tailleur");
    expect(pisteAssociation(pull, [[1, 9]], [pull, pantalon])).toBeNull();
    expect(pisteAssociation(pull, [], [pull, pantalon])).toBeNull();
  });
});

describe("saisons", () => {
  it("saisons de l'année", () => {
    expect([new Date(2026, 0, 5), new Date(2026, 3, 5), new Date(2026, 6, 5), new Date(2026, 9, 5)].map((d) => saisonDeLaDate(d.getTime()))).toEqual(["Hiver", "Printemps", "Été", "Automne"]);
  });
});

describe("Tes dernières pièces (écran « Voir tout »)", () => {
  it("la date : « Aujourd'hui », « Hier », « Il y a N jours » dans la semaine, « 22 sept. » au-delà", () => {
    expect(libelleDateRecente(jours(0), MIDI)).toBe("Aujourd'hui");
    expect(libelleDateRecente(jours(1), MIDI)).toBe("Hier");
    expect(libelleDateRecente(jours(2), MIDI)).toBe("Il y a 2 jours");
    expect(libelleDateRecente(jours(6), MIDI)).toBe("Il y a 6 jours");
    expect(libelleDateRecente(new Date(2026, 8, 22, 10).getTime(), MIDI)).toBe("22 sept.");
  });
  it("cette semaine / un peu plus tôt : l'ordre est gardé, une section vide reste vide", () => {
    const p = (id: number, j: number) => ({ id, createdAt: jours(j) });
    const r = separerParSemaine([p(1, 0), p(2, 3), p(3, 7), p(4, 20)], MIDI);
    expect(r.semaine.map((x) => x.id)).toEqual([1, 2]);
    expect(r.avant.map((x) => x.id)).toEqual([3, 4]);
    expect(separerParSemaine([p(1, 30)], MIDI).semaine).toEqual([]);
  });
  it("« N looks possibles » : rien quand il n'y en a aucun, singulier pour un", () => {
    expect(libelleLooksPossibles(0)).toBeNull();
    expect(libelleLooksPossibles(1)).toBe("1 look possible");
    expect(libelleLooksPossibles(4)).toBe("4 looks possibles");
  });
  it("les looks distincts : un même jeu de pièces ne compte qu'une fois, quel que soit l'ordre", () => {
    expect(looksDistincts([[[1, 2], [3, 4]], [[2, 1], [5, 6]]])).toBe(3);
    expect(looksDistincts([])).toBe(0);
  });
});

describe("ideeLaPlusComplete — le look que montre « Tes looks »", () => {
  it("la tenue la plus complète des trois premières idées, la première à égalité", () => {
    const a = { ids: [1, 2, 3] };
    const b = { ids: [1, 2, 3, 4, 5] };
    const c = { ids: [1, 2, 3, 4, 5] };
    const d = { ids: [1, 2, 3, 4, 5, 6] };
    expect(ideeLaPlusComplete([a, b, c])).toBe(b);
    // La quatrième idée n'est jamais regardée.
    expect(ideeLaPlusComplete([a, b, c, d])).toBe(b);
    expect(ideeLaPlusComplete([a])).toBe(a);
  });
  it("sans idée, rien", () => {
    expect(ideeLaPlusComplete(undefined)).toBeUndefined();
    expect(ideeLaPlusComplete([])).toBeUndefined();
  });
});

describe("articlePossessif — accord sur le nom de la pièce (09/10/2026, « Ton chemise en lin »)", () => {
  const nomme = (name: string, cat: CategoryKey) => piece(1, cat, { name });

  it("accorde avec le nom, pas avec la catégorie", () => {
    expect(designationPiece(nomme("Chemise en lin", "haut"))).toBe("ta chemise en lin");
    expect(designationPiece(nomme("Blouse fluide", "haut"))).toBe("ta blouse fluide");
    expect(designationPiece(nomme("Blazer à carreaux", "veste"))).toBe("ton blazer à carreaux");
    expect(designationPiece(nomme("Doudoune courte", "manteau"))).toBe("ta doudoune courte");
    expect(designationPiece(nomme("Gilet en maille", "pull"))).toBe("ton gilet en maille");
  });

  it("singulier et pluriel des chaussures", () => {
    expect(designationPiece(nomme("Baskets blanches", "chaussures"))).toBe("tes baskets blanches");
    expect(designationPiece(nomme("Basket blanche", "chaussures"))).toBe("ta basket blanche");
    expect(designationPiece(nomme("Escarpins nude", "chaussures"))).toBe("tes escarpins nude");
  });

  it("« ton » devant un nom féminin qui commence par une voyelle", () => {
    expect(designationPiece(nomme("Écharpe en laine", "accessoire"))).toBe("ton écharpe en laine");
  });

  it("saute un adjectif d'ouverture", () => {
    expect(designationPiece(nomme("Petite robe noire", "robe"))).toBe("ta petite robe noire");
    expect(designationPiece(nomme("Long manteau camel", "manteau"))).toBe("ton long manteau camel");
  });

  it("nom inconnu : repli sur la catégorie, ou le nom seul sans article de catégorie", () => {
    expect(articlePossessif(nomme("Zorglub", "jupe"))).toBe("ta");
    expect(phrasePiste(nomme("Zorglub", "bijou"))).toBe("Avec Zorglub");
    expect(phrasePiste(nomme("Collier doré", "bijou"))).toBe("Avec ton collier doré");
  });
});
