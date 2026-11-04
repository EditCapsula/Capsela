import { describe, expect, it } from "vitest";
import { autresManteaux, separerCoucheExterieure, temperatureReelle } from "../coucheExterieure";
import { SEUIL_MANTEAU } from "../logic";
import type { CategoryKey, Item } from "../types";

const piece = (id: number, cat: CategoryKey, name: string): Item =>
  ({ id, name, cat, color: "Noir", hex: "#1D1A16", season: "Toutes saisons", worn: null }) as Item;

const robe = piece(1, "robe", "Robe noire");
const blazer = piece(2, "veste", "Blazer camel");
const ballerines = piece(3, "chaussures", "Ballerines");
const sac = piece(4, "sac", "Cabas cognac");
const manteau = piece(5, "manteau", "Manteau camel");
const trench = piece(6, "manteau", "Trench beige");
const haut = piece(7, "haut", "Chemise blanche");
const pantalon = piece(8, "pantalon", "Pantalon droit");

describe("la tenue et sa couche extérieure", () => {
  it("1. robe + blazer + chaussures + sac, manteau par le froid : le manteau à part, 4 pièces", () => {
    const { principal, exterieur } = separerCoucheExterieure([robe, blazer, ballerines, sac, manteau], 8);
    expect(exterieur).toBe(manteau);
    expect(principal.map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });

  it("2. sans blazer, manteau par le froid : le manteau à part", () => {
    const { principal, exterieur } = separerCoucheExterieure([haut, pantalon, ballerines, manteau], 4);
    expect(exterieur).toBe(manteau);
    expect(principal).toHaveLength(3);
  });

  it("3. temps chaud : aucun bloc extérieur", () => {
    expect(separerCoucheExterieure([haut, pantalon, ballerines], 26).exterieur).toBeNull();
  });

  it("4. grand froid : le manteau proposé", () => {
    expect(separerCoucheExterieure([haut, pantalon, ballerines, manteau], -3).exterieur).toBe(manteau);
  });

  it("5. aucun manteau dans la tenue : aucun bloc", () => {
    const t = [haut, pantalon, ballerines];
    expect(separerCoucheExterieure(t, 5)).toEqual({ principal: t, exterieur: null });
  });

  it("8. une veste légère reste dans le look, même par le froid", () => {
    const { principal, exterieur } = separerCoucheExterieure([haut, pantalon, ballerines, blazer], 9);
    expect(exterieur).toBeNull();
    expect(principal).toContain(blazer);
  });

  it("9. un trench porté comme pièce de style (au-dessus du seuil) reste dans le look", () => {
    const { principal, exterieur } = separerCoucheExterieure([robe, ballerines, trench], SEUIL_MANTEAU);
    expect(exterieur).toBeNull();
    expect(principal).toContain(trench);
  });

  it("météo inconnue : rien n'est séparé, aucune recommandation « selon la météo »", () => {
    expect(separerCoucheExterieure([robe, manteau], null).exterieur).toBeNull();
    expect(separerCoucheExterieure([robe, manteau], undefined).exterieur).toBeNull();
    expect(separerCoucheExterieure([robe, manteau], Number.NaN).exterieur).toBeNull();
  });

  it("10. le nombre de pièces affiché est celui du look, manteau exclu", () => {
    expect(separerCoucheExterieure([robe, blazer, ballerines, sac, manteau], 10).principal).toHaveLength(4);
  });
});

describe("autres manteaux proposables", () => {
  it("6. seulement des manteaux, sans doublon avec la tenue ni avec celui proposé", () => {
    const candidats = [manteau, trench, trench, blazer, piece(9, "manteau", "Caban marine")];
    expect(autresManteaux(candidats, [robe, ballerines], manteau).map((p) => p.id)).toEqual([6, 9]);
  });
});


describe("la température qui peut parler de météo", () => {
  it("aujourd'hui : jamais les valeurs par défaut ; un autre jour : sa prévision seulement", () => {
    expect(temperatureReelle({ decalage: 0, sourceMeteo: "ville", tempDuJour: 8, prevue: null })).toBe(8);
    expect(temperatureReelle({ decalage: 0, sourceMeteo: "defaut", tempDuJour: 8, prevue: null })).toBeNull();
    expect(temperatureReelle({ decalage: 2, sourceMeteo: "ville", tempDuJour: 8, prevue: 4 })).toBe(4);
    expect(temperatureReelle({ decalage: 2, sourceMeteo: "ville", tempDuJour: 8, prevue: null })).toBeNull();
  });
});
