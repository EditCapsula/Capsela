import { describe, expect, it } from "vitest";
import { generateOutfitWithFallback } from "../logic";
import { poolDePlanification } from "../selectors";
import { item } from "./fixtures";
import type { Weather } from "../data";
import type { CategoryKey, Item } from "../types";

/**
 * UNE SOIRÉE PLANIFIÉE A SES CHAUSSURES (24/11/2026, signalé : vernissage à 5° sous la pluie, « Aucune paire de chaussures ne convient »,
 * le dressing n'ayant qu'une paire de babies et des sandales). En soirée, une femme ne reçoit que des chaussures habillées (R-S25) : le
 * pool de Planifier, composé sans le genre, tenait les babies pour adaptées et ne prenait pas les escarpins de la capsule. Mesuré avant
 * (sans genre) et après (avec), dans la même exécution, sur le même pool.
 */
const T = "Automne, Hiver";
const reel = (id: number, o: Omit<Parameters<typeof item>[0], "id">) => ({ ...item({ ...o, id: id + 5000 }), id }) as Item;
const meteo = { season: "Automne / Hiver", temp: 5, label: "Pluvieux", seasons: ["Automne / Hiver", "Toutes saisons"] } as unknown as Weather;
const capsule = [
  item({ id: 1001, category: "chaussures", name: "Escarpins noirs", sous_type: "Escarpins", saison_capsule: T, occasions: "Soirée, Travail" }),
  item({ id: 1002, category: "chaussures", name: "Bottines noires", sous_type: "Bottines", saison_capsule: T }),
  item({ id: 1003, category: "manteau", name: "Manteau laine", sous_type: "Manteau", saison_capsule: T }),
] as Item[];
const items = [
  reel(1, { category: "chaussures", name: "Babies Mary Jane", sous_type: "Ballerines", occasions: "Quotidien, Travail" }),
  reel(2, { category: "chaussures", name: "Chaussures en cuir camel", sous_type: "Sandales", occasions: "Quotidien, Soirée" }),
  reel(3, { category: "robe", name: "Robe midi bordeaux", saison_capsule: T, occasions: "Soirée" }),
];
const categories = ["chaussures", "robe", "manteau"] as CategoryKey[];
const chaussuresDe = (genre: string | null) => {
  const pool = poolDePlanification({ items, capsule, occasion: "soiree", dressingSeul: false, meteo, categories, genre });
  const r = generateOutfitWithFallback(pool, meteo, "soiree", "Présentiel", "Verre", [], "femme");
  return r.ids.map((id) => pool.find((p) => p.id === id)).filter((p) => p?.cat === "chaussures").map((p) => p!.name);
};

describe("Planifier : une soirée d'une femme reçoit des chaussures habillées de la capsule", () => {
  it("avant (sans genre) : aucune paire ; après : les escarpins de la capsule", () => {
    expect(chaussuresDe(null)).toEqual([]);
    expect(chaussuresDe("femme")).toEqual(["Escarpins noirs"]);
  });
  it("« Uniquement mon dressing » : rien n'est prêté par la capsule", () => {
    const pool = poolDePlanification({ items, capsule, occasion: "soiree", dressingSeul: true, meteo, categories, genre: "femme" });
    expect(pool.some((p) => p.id >= 1001)).toBe(false);
  });
});
