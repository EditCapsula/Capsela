import { describe, expect, it } from "vitest";
import { basculerOccasion, convientAussiA, occasionPrincipale, occasionsSecondaires, tirerPolyvalente } from "../tenuePolyvalente";
import type { CategoryKey, Item } from "../types";

const piece = (id: number, cat: CategoryKey, extra: Partial<Item> = {}): Item =>
  ({ id, name: `p${id}`, cat, color: "Noir", hex: "#1d1a16", season: "Toutes saisons", worn: null, ...extra }) as Item;

describe("plusieurs occasions pour un moment", () => {
  it("cocher, décocher, dans l'ordre du choix ; sport et cocooning seuls", () => {
    expect(basculerOccasion([], "quotidien")).toEqual(["quotidien"]);
    expect(basculerOccasion(["quotidien"], "soiree")).toEqual(["quotidien", "soiree"]);
    expect(basculerOccasion(["quotidien", "soiree"], "quotidien")).toEqual(["soiree"]);
    expect(basculerOccasion(["quotidien", "soiree"], "sport")).toEqual(["sport"]);
    expect(basculerOccasion(["cocooning"], "soiree")).toEqual(["soiree"]);
  });

  it("l'occasion principale est la plus habillée, la première cochée à égalité", () => {
    expect(occasionPrincipale(["quotidien", "travail_formel"])).toBe("travail_formel");
    expect(occasionPrincipale(["travail_formel", "soiree"])).toBe("travail_formel");
    expect(occasionPrincipale(["soiree", "travail_formel"])).toBe("soiree");
    expect(occasionPrincipale([])).toBeNull();
    expect(occasionsSecondaires(["quotidien", "travail_formel"])).toEqual(["quotidien"]);
  });

  it("une tenue convient aux autres occasions si chaque pièce y reste adaptée", () => {
    const babies = piece(1, "chaussures", { shoeType: "Ballerines" });
    const escarpins = piece(2, "chaussures", { shoeType: "Escarpins" });
    // En soirée, une femme porte des chaussures habillées (R-S25) : des baskets ne passent pas.
    const baskets = piece(3, "chaussures", { shoeType: "Baskets" });
    expect(convientAussiA([escarpins], ["soiree"], "femme")).toBe(true);
    expect(convientAussiA([baskets], ["soiree"], "femme")).toBe(false);
    expect(convientAussiA([babies], [], "femme")).toBe(true);
  });

  it("retient le premier tirage qui convient à toutes, sinon le premier tirage", () => {
    const pool = [piece(1, "chaussures", { shoeType: "Baskets" }), piece(2, "chaussures", { shoeType: "Escarpins" })];
    const resoudre = (ids: number[]) => pool.filter((p) => ids.includes(p.id));
    const suite = [{ ids: [1] }, { ids: [2] }];
    let i = 0;
    const r = tirerPolyvalente(() => suite[i++ % 2], resoudre, ["soiree"], "femme");
    expect(r).toEqual({ tenue: { ids: [2] }, polyvalente: true });
    const jamais = tirerPolyvalente(() => ({ ids: [1] }), resoudre, ["soiree"], "femme", 3);
    expect(jamais).toEqual({ tenue: { ids: [1] }, polyvalente: false });
    expect(tirerPolyvalente(() => ({ ids: [1] }), resoudre, [], "femme").polyvalente).toBe(true);
  });
});
