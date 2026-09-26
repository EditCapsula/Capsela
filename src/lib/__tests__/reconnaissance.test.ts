import { describe, expect, it } from "vitest";
import { compositionReconnue, compositionUtilisable, corrigerReconnaissance, lireReconnaissance, piecesPourModifier, type VetementReconnu } from "../reconnaissance";
import type { CategoryKey, Item } from "../types";

const piece = (id: number, cat: CategoryKey): Item => ({ id, name: `${cat} ${id}`, cat, color: "Noir", hex: "#000", season: "Toutes saisons", worn: null });
const DRESSING = [piece(1, "manteau"), piece(2, "pantalon"), piece(3, "pantalon"), piece(4, "sac"), piece(5, "haut"), piece(6, "pantalon")];
const v = (categorie: CategoryKey, pieceId: number | null, candidats: number[] = [], libelle = ""): VetementReconnu => ({
  categorie,
  libelle,
  pieceId,
  statut: pieceId === null ? "non_reconnue" : "reconnue",
  candidats,
});

describe("lireReconnaissance — ce qui vient du serveur est vérifié, jamais complété", () => {
  it("garde les entrées bien formées, écarte le reste", () => {
    const r = lireReconnaissance([
      { categorie: "pantalon", libelle: " pantalon noir ", pieceId: 2, statut: "reconnue", candidats: [3, 3, 2, "x"] },
      { categorie: "haut", libelle: "chemise", pieceId: null, statut: "non_reconnue", candidats: [] },
      { categorie: "sac", pieceId: 4, statut: "inventé" },
      "n'importe quoi",
    ]);
    expect(r).toEqual([
      { categorie: "pantalon", libelle: "pantalon noir", pieceId: 2, statut: "reconnue", candidats: [3] },
      { categorie: "haut", libelle: "chemise", pieceId: null, statut: "non_reconnue", candidats: [] },
    ]);
    expect(lireReconnaissance(undefined)).toEqual([]);
  });

  it("« reconnue » sans pièce est lue non reconnue", () => {
    expect(lireReconnaissance([{ categorie: "haut", libelle: "", pieceId: null, statut: "reconnue", candidats: [] }])[0].statut).toBe("non_reconnue");
  });
});

describe("corrigerReconnaissance — la correction de l'utilisatrice", () => {
  const r = [v("manteau", 1), v("pantalon", 2, [3]), v("haut", null, [], "chemise")];

  it("remplacer : la pièce choisie est associée, l'ancienne rejoint les candidats", () => {
    const c = corrigerReconnaissance(r, 1, 3);
    expect(c[1]).toMatchObject({ pieceId: 3, statut: "corrigee", candidats: [2] });
    expect(r[1].pieceId).toBe(2); // pas de mutation
  });

  it("aucune de mes pièces : non reconnu, rien d'inventé", () => {
    expect(corrigerReconnaissance(r, 0, null)[0]).toMatchObject({ pieceId: null, statut: "non_reconnue", candidats: [1] });
  });

  it("associer un vêtement non reconnu", () => {
    expect(corrigerReconnaissance(r, 2, 5)[2]).toMatchObject({ pieceId: 5, statut: "corrigee" });
  });

  it("une même pièce n'est jamais associée à deux vêtements", () => {
    const c = corrigerReconnaissance([v("pantalon", 2), v("pantalon", null, [3])], 1, 2);
    expect(c.map((x) => x.pieceId)).toEqual([null, 2]);
    expect(c[0].statut).toBe("non_reconnue");
  });
});

describe("compositionReconnue — la tenue que lisent toutes les actions", () => {
  it("les pièces associées, dans l'ordre, sans les non reconnues ni les pièces supprimées", () => {
    const r = [v("manteau", 1), v("haut", null), v("pantalon", 99), v("pantalon", 2), v("sac", 4)];
    expect(compositionReconnue(r, DRESSING).map((i) => i.id)).toEqual([1, 2, 4]);
  });

  it("utilisable seulement avec un socle (haut + bas, ou robe)", () => {
    expect(compositionUtilisable([piece(1, "manteau"), piece(2, "pantalon"), piece(4, "sac")])).toBe(false);
    expect(compositionUtilisable([piece(5, "haut"), piece(2, "pantalon")])).toBe(true);
  });
});

describe("piecesPourModifier — ce que propose « Modifier »", () => {
  it("les candidats d'abord, puis la même catégorie ; jamais la pièce actuelle ni celle d'un autre vêtement", () => {
    const r = [v("pantalon", 2, [6]), v("pantalon", 3)];
    expect(piecesPourModifier(r, 0, DRESSING).map((i) => i.id)).toEqual([6]);
    expect(piecesPourModifier([v("pantalon", 2, [6])], 0, DRESSING).map((i) => i.id)).toEqual([6, 3]);
  });

  it("un candidat retiré du dressing n'est pas proposé", () => {
    expect(piecesPourModifier([v("sac", null, [77])], 0, DRESSING).map((i) => i.id)).toEqual([4]);
  });
});
