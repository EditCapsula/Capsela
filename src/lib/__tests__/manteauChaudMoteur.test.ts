import { describe, expect, it } from "vitest";
import { generateOutfit } from "../logic";
import { manteauTropLeger, plafondDuSousType, plancherManteau, sousTypeManteau } from "../plafondManteau";
import { at, item } from "./fixtures";
import type { Item } from "../types";

/**
 * LE MANTEAU PAR LE FROID, LE PLUS CHAUD (21/11/2026, arbitré par la propriétaire : la règle de « Pour l'extérieur » s'applique au
 * moteur) et LE COUPE-VENT (plafond 20°, plancher 12°). Mesuré avant / après dans la même exécution (levier manteauSansChaleur), même pool.
 */
const T = "Automne, Hiver";
const trench = item({ id: 1, category: "manteau", name: "Trench camel", sous_type: "Trench", meteo_max_temp: 20, saison_capsule: T });
const laine = item({ id: 2, category: "manteau", name: "Manteau laine long", sous_type: "Manteau", meteo_max_temp: 12, saison_capsule: T });
const base = [
  item({ id: 3, category: "hauts", name: "Pull col rond gris", sous_type: "Pull", saison_capsule: T }),
  item({ id: 4, category: "pantalon", name: "Pantalon droit noir", sous_type: "Pantalon", saison_capsule: T }),
  item({ id: 5, category: "chaussures", name: "Bottines noires", sous_type: "Bottines", saison_capsule: T }),
];
const pool = [trench, laine, ...base] as Item[];
const tirages = (temp: number, leviers?: { manteauSansChaleur?: boolean }, p: Item[] = pool, soir?: number) =>
  Array.from({ length: 200 }, () => generateOutfit(p, { ...at(temp), tempSoir: soir }, "quotidien", "Présentiel", "Verre", [], "femme", undefined, undefined, null, leviers as never).ids);
const part = (r: number[][], id: number) => r.filter((ids) => ids.includes(id)).length / r.length;

describe("le moteur : le manteau le plus chaud par le froid", () => {
  it("par 3°, avant : le trench sort ; après : jamais quand le manteau de laine est admis", () => {
    const avant = tirages(3, { manteauSansChaleur: true });
    const apres = tirages(3);
    expect(part(avant, trench.id)).toBeGreaterThan(0);
    expect(part(apres, trench.id)).toBe(0);
    expect(part(apres, laine.id)).toBe(1);
  });
  it("11° le jour, 4° le soir : le classement se fait au soir, la laine", () => {
    const r = tirages(11, undefined, pool, 4);
    expect(part(r, trench.id)).toBe(0);
    expect(part(r, laine.id)).toBe(1);
  });
  it("seul le trench : il reste proposé (faute d'autre), rien n'est retiré", () => {
    const r = tirages(3, undefined, [trench, ...base] as Item[]);
    expect(part(r, trench.id)).toBe(1);
  });
});

describe("le coupe-vent : plafond 20°, plancher 12°", () => {
  it("par son sous-type, ou par son nom faute de sous-type", () => {
    expect(plafondDuSousType("manteau", "Coupe-vent")).toBe(20);
    expect(plafondDuSousType("manteau", null, "Coupe-vent marine")).toBe(20);
    expect(plafondDuSousType("manteau", null, "K-way jaune")).toBe(20);
    expect(plafondDuSousType("manteau", null, "Manteau gris")).toBeUndefined();
    expect(plafondDuSousType("veste", null, "Coupe-vent")).toBeUndefined();
    expect(sousTypeManteau("Parka", "Coupe-vent")).toBe("Parka");
    const cv = { cat: "manteau" as const, subtype: undefined, meteoMinTemp: undefined, name: "Coupe-vent léger" };
    expect(plancherManteau(cv)).toBe(12);
    expect(manteauTropLeger(cv, 11)).toBe(true);
    expect(manteauTropLeger(cv, 12)).toBe(false);
  });
});
