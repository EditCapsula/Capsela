import { describe, expect, it } from "vitest";
import {
  candidatsARedecouvrir,
  dateRelativeAjout,
  ligneDressing,
  looksRecents,
  piecesRecentes,
  pisteAssociation,
  saisonDeLaDate,
  titreTenue,
} from "../dressingSections";
import type { CategoryKey, HistoryEntry, Item, SavedLook } from "../types";

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
    expect(piecesRecentes(items).map((i) => i.id)).toEqual([2, 3, 1]);
    expect(dateRelativeAjout(items[1].createdAt!, MIDI)).toBe("Ajoutée aujourd'hui");
  });
  it("une pièce sans date d'ajout n'y figure pas", () => {
    expect(piecesRecentes([piece(1, "haut")])).toEqual([]);
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

describe("Tes looks", () => {
  const pool = [piece(1, "haut"), piece(2, "pantalon"), piece(3, "chaussures"), piece(4, "sac")];
  const h = (id: string, ts: number, ids: number[]): HistoryEntry => ({ id, ts, pieceIds: ids, occasion: "quotidien" });
  it("les deux tenues les plus récentes, une par jeu de pièces, avec « Tenue du JJ/MM » et « occasion · saison »", () => {
    const r = looksRecents([h("a", jours(5), [1, 2]), h("b", jours(1), [2, 3]), h("c", jours(3), [2, 1])], [], pool);
    expect(r.map((l) => l.cle)).toEqual(["2,3", "1,2"]);
    expect(r[0].titre).toBe(titreTenue(jours(1)));
    expect(r[0].titre).toBe("Tenue du 07/10");
    expect(r[0].meta).toBe("Quotidien · Automne");
    expect(r.every((l) => l.enregistre === null)).toBe(true);
  });
  it("un look enregistré avec les mêmes pièces marque la carte « enregistrée » ; une tenue d'une seule pièce retrouvée n'est pas un look", () => {
    const look: SavedLook = { id: "l1", name: "Tenue du 07/10", pieceIds: [3, 2], createdAt: jours(1), source: "saved" };
    const r = looksRecents([h("b", jours(1), [2, 3]), h("x", jours(0), [1, 99])], [look], pool);
    expect(r).toHaveLength(1);
    expect(r[0].enregistre?.id).toBe("l1");
  });
  it("rien à montrer : liste vide", () => {
    expect(looksRecents([], [], pool)).toEqual([]);
  });
  it("saisons de l'année", () => {
    expect([new Date(2026, 0, 5), new Date(2026, 3, 5), new Date(2026, 6, 5), new Date(2026, 9, 5)].map((d) => saisonDeLaDate(d.getTime()))).toEqual(["Hiver", "Printemps", "Été", "Automne"]);
  });
});
