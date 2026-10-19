import { describe, expect, it } from "vitest";
import { articlesChecklist, filtrerChecklist, progressionChecklist, sectionsChecklist } from "../checklistValise";
import type { AffaireVoyage } from "../affairesVoyage";
import type { Item } from "../types";

/** LA CHECKLIST DE DÉPART (19/10/2026) : articles, sections, progression et filtres, lus par la Checklist et l'Aperçu. */

const piece = (id: number, cat: Item["cat"]): Item => ({ id, cat, name: `Pièce ${id}`, hex: "#000000" }) as Item;
const pieces = [piece(1, "haut"), piece(2, "pantalon"), piece(3, "chaussures"), piece(4, "sac")];
const affaires: AffaireVoyage[] = [
  { id: "papiers", libelle: "Papiers d'identité", groupe: "documents" },
  { id: "brosse", libelle: "Brosse à dents", groupe: "toilette" },
];

describe("checklist de départ", () => {
  it("chaque pièce est UN article, même présente deux fois ; les affaires suivent", () => {
    const a = articlesChecklist([...pieces, pieces[0]], [], affaires, []);
    expect(a.map((x) => x.cle)).toEqual(["p-1", "p-2", "p-3", "p-4", "a-papiers", "a-brosse"]);
  });

  it("la progression compte les articles préparés, pas les pièces sélectionnées", () => {
    const a = articlesChecklist(pieces, [1, 3, 99], affaires, ["brosse", "inconnue"]);
    expect(progressionChecklist(a)).toEqual({ preparees: 3, total: 6, restantes: 3, pourcentage: 50 });
    expect(progressionChecklist([])).toEqual({ preparees: 0, total: 0, restantes: 0, pourcentage: 0 });
  });

  it("filtres : tout, à préparer, préparés — sans perdre l'état", () => {
    const a = articlesChecklist(pieces, [1], affaires, ["papiers"]);
    expect(filtrerChecklist(a, "tout")).toHaveLength(6);
    expect(filtrerChecklist(a, "preparees").map((x) => x.cle)).toEqual(["p-1", "a-papiers"]);
    expect(filtrerChecklist(a, "a_preparer").map((x) => x.cle)).toEqual(["p-2", "p-3", "p-4", "a-brosse"]);
  });

  it("sections dans l'ordre, chacune avec sa progression sur tous ses articles, quel que soit le filtre", () => {
    const a = articlesChecklist(pieces, [1], affaires, []);
    const s = sectionsChecklist(a, "preparees");
    expect(s.map((x) => x.id)).toEqual(["vetements", "chaussures", "accessoires", "documents", "toilette"]);
    const vetements = s.find((x) => x.id === "vetements")!;
    expect(vetements.progression).toMatchObject({ preparees: 1, total: 2 });
    expect(vetements.articles.map((x) => x.cle)).toEqual(["p-1"]);
    expect(s.find((x) => x.id === "chaussures")!.articles).toEqual([]);
  });
});
