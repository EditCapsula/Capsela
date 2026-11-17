import { describe, expect, it } from "vitest";
import { candidatsDeRemplacement, exterieurTropChaud, generateOutfit, SEUIL_SANS_EXTERIEUR } from "../logic";
import { at, item } from "./fixtures";
import type { CatalogItem } from "../catalog";

/**
 * LES TEMPÉRATURES MAXIMALES DES VÊTEMENTS D'EXTÉRIEUR (17/11/2026, brief arbitré par la propriétaire) : une pièce n'est jamais proposée
 * au-dessus de son meteo_max_temp, et aucun manteau ne l'est à partir de SEUIL_SANS_EXTERIEUR (22 °C), même sans borne déclarée.
 * Les seuils du brief (shearling long 7°, manteau déstructuré 14°, trench 20°) sont posés ici sur des pièces de test : ce sont les
 * valeurs à écrire dans le catalogue, la règle du moteur est la même pour toutes.
 */

const shearling = item({ id: 1, category: "manteau", name: "Manteau long façon shearling", sous_type: "Manteau", meteo_max_temp: 7 });
const destructure = item({ id: 2, category: "manteau", name: "Manteau droit déstructuré", sous_type: "Manteau", meteo_max_temp: 14 });
const trench = item({ id: 3, category: "manteau", name: "Trench-coat", sous_type: "Trench", meteo_max_temp: 20 });
const sansBorne = item({ id: 4, category: "manteau", name: "Manteau du dressing", sous_type: "Manteau" });
const MANTEAUX = [shearling, destructure, trench, sansBorne];
const BASE: CatalogItem[] = [
  item({ id: 10, category: "hauts", name: "Chemise blanche", sous_type: "Chemise" }),
  item({ id: 11, category: "pantalon", name: "Pantalon droit", sous_type: "Pantalon" }),
  item({ id: 12, category: "chaussures", name: "Bottines", sous_type: "Bottines" }),
];

/** Les manteaux que le moteur admet à cette température (même appel que « Pour l'extérieur »). */
const admis = (temp: number): number[] => {
  const tenue = generateOutfit(BASE, at(temp), "quotidien").ids;
  const pieces = [...BASE, ...MANTEAUX].filter((p) => tenue.includes(p.id)) as never[];
  const ids = candidatsDeRemplacement(pieces, MANTEAUX as never[], -1, "manteau", "quotidien", "Présentiel", "Verre", at(temp)).map((m) => m.id);
  // Les numéros 1 à 4 de ce fichier (les id du catalogue sont décalés, VESTIAIRE_ID_OFFSET).
  return MANTEAUX.map((m, i) => (ids.includes(m.id) ? i + 1 : 0)).filter(Boolean);
};

describe("plafond des vêtements d'extérieur", () => {
  it("les neuf températures du brief", () => {
    const attendu: Record<number, number[]> = {
      [-2]: [1, 2, 3, 4], 5: [1, 2, 3, 4], 8: [2, 3, 4], 10: [2, 3, 4], 12: [2, 3, 4], 14: [2, 3, 4], 18: [3, 4], 20: [3, 4], 22: [],
    };
    for (const [t, ids] of Object.entries(attendu)) expect(admis(Number(t)), `${t}°`).toEqual(ids);
  });
  it("un shearling long n'est plus proposé au-delà de 7°", () => {
    expect(admis(7)).toContain(1);
    expect(admis(8)).not.toContain(1);
  });
  it("un manteau déstructuré reste éligible jusqu'à 14°", () => {
    expect(admis(14)).toContain(2);
    expect(admis(15)).not.toContain(2);
  });
  it("un trench reste éligible jusqu'à 20°", () => {
    expect(admis(20)).toContain(3);
    expect(admis(21)).not.toContain(3);
  });
  it("aucun vêtement d'extérieur à partir de 22°, même sans borne déclarée", () => {
    expect(admis(SEUIL_SANS_EXTERIEUR)).toEqual([]);
    expect(admis(SEUIL_SANS_EXTERIEUR - 1)).toContain(4);
    expect(exterieurTropChaud({ cat: "veste" }, 30)).toBe(false);
  });
  it("le tirage non plus ne met aucun manteau dans la tenue à 22°, levier de mesure compris", () => {
    for (let k = 0; k < 30; k++) {
      const ids = generateOutfit([...BASE, sansBorne], at(SEUIL_SANS_EXTERIEUR), "quotidien").ids;
      expect(ids).not.toContain(sansBorne.id);
    }
  });
});
