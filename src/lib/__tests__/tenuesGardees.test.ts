import { describe, expect, it } from "vitest";
import { cleContexte, lireGardeesDepuis, tenueRestituable, type Gardees } from "../tenuesGardees";

const t = { ids: [1, 2, 3], missingCats: [], formalityDowngraded: false, occasionRelachee: false, noCompleteOutfit: false, failureReason: null };

describe("tenues du jour gardées (16/11/2026)", () => {
  it("rend la journée gardée, et rien pour un autre jour", () => {
    const g: Gardees = { jour: "2026-11-16", tenues: { [cleContexte({ occasion: "travail_formel", workMode: "Présentiel", dateContext: "Verre" })]: t }, carrousel: { cle: "2026-11-16|travail", propositions: { quotidien: [4, 5] }, tentees: ["quotidien"] } };
    const brut = JSON.stringify(g);
    expect(lireGardeesDepuis(brut, "2026-11-16")).toEqual(g);
    expect(lireGardeesDepuis(brut, "2026-11-17")).toEqual({ jour: "2026-11-17", tenues: {}, carrousel: null });
  });
  it("écarte un contenu illisible ou mal formé sans échouer", () => {
    expect(lireGardeesDepuis("{pas du json", "2026-11-16").tenues).toEqual({});
    const g = lireGardeesDepuis(JSON.stringify({ jour: "2026-11-16", tenues: { a: { ids: ["x"] }, b: t }, carrousel: { cle: 3 } }), "2026-11-16");
    expect(Object.keys(g.tenues)).toEqual(["b"]);
    expect(g.carrousel).toBeNull();
  });
  it("le contexte distingue l'occasion et ses sous-choix", () => {
    expect(cleContexte({ occasion: "date", workMode: "Présentiel", dateContext: "Verre" })).not.toBe(cleContexte({ occasion: "date", workMode: "Présentiel", dateContext: "Restaurant / date romantique" }));
  });
  it("une tenue n'est rendue que si toutes ses pièces se retrouvent", () => {
    expect(tenueRestituable(t, (id) => [1, 2, 3].includes(id))).toBe(true);
    expect(tenueRestituable(t, (id) => [1, 2].includes(id))).toBe(false);
    expect(tenueRestituable(undefined, () => true)).toBe(false);
    expect(tenueRestituable({ ...t, ids: [] }, () => true)).toBe(false);
  });
});
