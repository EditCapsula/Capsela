import { describe, expect, it } from "vitest";
import { filtresLooksDisponibles, looksAffiches } from "../looksFiltre";
import type { SavedLook } from "../types";

const L = (id: string, o: Partial<SavedLook>): SavedLook => ({ id, name: id, pieceIds: [1, 2], createdAt: 0, source: "saved", ...o });

describe("onglet Mes looks — filtres adaptés aux données", () => {
  it("n'expose que les occasions réellement portées par des looks, avec leur nombre", () => {
    const f = filtresLooksDisponibles([L("a", { occasion: "travail_formel" }), L("b", { occasion: "travail_formel" }), L("c", { occasion: "soiree" }), L("d", {})]);
    expect(f.map((x) => `${x.libelle}:${x.n}`)).toEqual(["Tous:4", "Travail:2", "Soirée:1"]);
  });
  it("Créés / Enregistrés seulement si les deux sources existent", () => {
    expect(filtresLooksDisponibles([L("a", { source: "created" })]).some((x) => x.cle === "created")).toBe(false);
    const f = filtresLooksDisponibles([L("a", { source: "created" }), L("b", { source: "saved" })]);
    expect(f.map((x) => x.cle)).toEqual(["tous", "created", "saved"]);
  });
  it("aucun look : seulement « Tous · 0 », jamais de puce vide", () => {
    expect(filtresLooksDisponibles([])).toEqual([{ cle: "tous", libelle: "Tous", n: 0 }]);
  });
  it("recherche sur le nom et l'occasion, tri récents / anciens / A→Z", () => {
    const looks = [L("Brunch", { createdAt: 2, occasion: "quotidien" }), L("Bureau lundi", { createdAt: 3, occasion: "travail_formel" }), L("Apéro", { createdAt: 1 })];
    expect(looksAffiches(looks, { recherche: "travail", filtre: "tous", tri: "recent" }).map((l) => l.id)).toEqual(["Bureau lundi"]);
    expect(looksAffiches(looks, { recherche: "", filtre: "tous", tri: "recent" }).map((l) => l.id)).toEqual(["Bureau lundi", "Brunch", "Apéro"]);
    expect(looksAffiches(looks, { recherche: "", filtre: "tous", tri: "ancien" }).map((l) => l.id)).toEqual(["Apéro", "Brunch", "Bureau lundi"]);
    expect(looksAffiches(looks, { recherche: "", filtre: "tous", tri: "az" }).map((l) => l.id)).toEqual(["Apéro", "Brunch", "Bureau lundi"]);
    expect(looksAffiches(looks, { recherche: "", filtre: "occ:quotidien", tri: "recent" }).map((l) => l.id)).toEqual(["Brunch"]);
  });
});
