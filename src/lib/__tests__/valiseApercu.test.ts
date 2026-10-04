import { describe, expect, it } from "vitest";
import { roleApercu, selectionApercu } from "../valiseApercu";
import type { CategoryKey, Item } from "../types";

const piece = (id: number, cat: CategoryKey): Item => ({ id, name: `P${id}`, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 1 });

describe("selectionApercu — une sélection représentative, jamais les huit premières", () => {
  it("rend les rôles : principale, chaussures, sac, petit", () => {
    expect(["haut", "robe", "chaussures", "sac", "bijou", "accessoire"].map((c) => roleApercu(c as CategoryKey))).toEqual(["principale", "principale", "chaussures", "sac", "petit", "petit"]);
  });

  it("trois pièces ou moins : tout est montré, à grande échelle", () => {
    const r = selectionApercu([piece(1, "haut"), piece(2, "pantalon"), piece(3, "chaussures")]);
    expect(r.affichees).toHaveLength(3);
    expect(r.reste).toBe(0);
    expect(r.affichees.every((a) => a.echelle === "grand")).toBe(true);
  });

  it("douze hauts et une paire de chaussures : la paire et le sac ne sont pas noyés", () => {
    const hauts = Array.from({ length: 12 }, (_, i) => piece(i + 1, "haut"));
    const r = selectionApercu([...hauts, piece(20, "chaussures"), piece(21, "sac")]);
    const ids = r.affichees.map((a) => a.item.id);
    expect(ids).toContain(20);
    expect(ids).toContain(21);
    expect(r.affichees).toHaveLength(8);
    expect(r.reste).toBe(6);
  });

  it("jamais plus que le maximum, jamais deux fois la même pièce", () => {
    const toutes = Array.from({ length: 24 }, (_, i) => piece(i + 1, (["haut", "pantalon", "chaussures", "sac", "bijou"] as CategoryKey[])[i % 5]));
    const r = selectionApercu(toutes);
    expect(r.affichees.length).toBeLessThanOrEqual(8);
    expect(new Set(r.affichees.map((a) => a.item.id)).size).toBe(r.affichees.length);
    expect(r.reste).toBe(24 - r.affichees.length);
  });

  it("une valise vide ne montre rien", () => {
    expect(selectionApercu([])).toEqual({ affichees: [], reste: 0 });
  });
});
