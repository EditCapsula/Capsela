import { describe, expect, it } from "vitest";
import { candidatsDeRemplacement, estRobePull, generateOutfitWithFallback } from "../logic";
import type { Weather } from "../data";
import type { Item } from "../types";

// R-B26 — pas de pull ni de gilet sur une robe pull (16/11/2026).

const p = (id: number, cat: Item["cat"], name: string, extra: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 5, occasion: ["quotidien"], ...extra }) as Item;
const FRAIS: Weather = { season: "Automne / Hiver", temp: 9, label: "Nuageux" } as Weather;

describe("estRobePull", () => {
  it("lit la robe en maille sur le nom ou le sous-type", () => {
    expect(estRobePull(p(1, "robe", "Robe pull midi cintrée"))).toBe(true);
    expect(estRobePull(p(2, "robe", "Robe midi en maille"))).toBe(true);
    expect(estRobePull(p(3, "robe", "Robe", { subtype: "Robe pull" }))).toBe(true);
    expect(estRobePull(p(4, "robe", "Robe chemise ceinturée"))).toBe(false);
    expect(estRobePull(p(5, "pull", "Pull col rond"))).toBe(false);
  });
});

describe("le moteur ne pose aucun pull ni gilet sur une robe pull", () => {
  const robe = p(10, "robe", "Robe pull midi cintrée", { meteoMinTemp: 12 });
  const gilet = p(11, "pull", "Cardigan long", { subtype: "Cardigan", rolePiece: "calque" } as Partial<Item>);
  const pull = p(12, "pull", "Gilet en maille", { subtype: "Gilet", rolePiece: "calque" } as Partial<Item>);
  const manteau = p(13, "manteau", "Manteau droit en laine");
  const bottines = p(14, "chaussures", "Bottines", { shoeType: "Bottines" });
  const sac = p(15, "sac", "Cabas");
  const pool = [robe, gilet, pull, manteau, bottines, sac];
  it("sur cent tirages, jamais de pull avec la robe pull — télétravail compris", () => {
    for (let k = 0; k < 100; k++) {
      for (const [occ, mode] of [["quotidien", "Présentiel"], ["travail_formel", "Télétravail"]] as const) {
        const r = generateOutfitWithFallback(pool, FRAIS, occ, mode, "Verre", [], "femme");
        if (r.ids.includes(robe.id)) expect(r.ids.some((id) => id === gilet.id || id === pull.id)).toBe(false);
      }
    }
  });
  it("au remplacement : aucun gilet proposé sur une robe pull", () => {
    const tenue = [robe, manteau, bottines, sac];
    const c = candidatsDeRemplacement(tenue, pool, manteau.id, "pull", "quotidien");
    expect(c.some((i) => i.cat === "pull")).toBe(false);
  });
});
