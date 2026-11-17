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

  it("5. aucun manteau dans la tenue ni de candidat : aucun bloc", () => {
    const t = [haut, pantalon, ballerines];
    expect(separerCoucheExterieure(t, 5)).toEqual({ principal: t, exterieur: null, suggere: false, remplace: null, conseilManteauPlusLong: false });
  });

  it("2 bis. tenue sans manteau, manteau disponible par le froid : il est proposé, hors du look", () => {
    const t = [robe, ballerines, sac];
    const r = separerCoucheExterieure(t, 10, [blazer, manteau, trench]);
    expect(r.exterieur).toBe(manteau);
    expect(r.suggere).toBe(true);
    expect(r.principal).toEqual(t);
    // 17/11/2026 : sous 22 °C, plus seulement par le froid. Le choix suit les candidats que le moteur admet (leurs bornes) : à 18°, le trench, rien sans candidat.
    expect(separerCoucheExterieure(t, 18, [trench]).exterieur).toBe(trench);
    expect(separerCoucheExterieure(t, 18, []).exterieur).toBeNull();
  });

  it("2 ter. aucun manteau adapté dans le dressing : un manteau de la capsule, dans la strate extérieure (12/11/2026)", () => {
    const t = [robe, ballerines, sac];
    const r = separerCoucheExterieure(t, 10, [], [trench]);
    expect(r.exterieur).toBe(trench);
    expect(r.suggere).toBe(true);
    // Le dressing passe d'abord.
    expect(separerCoucheExterieure(t, 10, [manteau], [trench]).exterieur).toBe(manteau);
  });

  it("8. une veste légère reste dans le look, même par le froid", () => {
    const { principal, exterieur } = separerCoucheExterieure([haut, pantalon, ballerines, blazer], 9);
    expect(exterieur).toBeNull();
    expect(principal).toContain(blazer);
  });

  it("9. tout manteau à part sous 22 °C (17/11/2026, arbitré : avant, un trench au-dessus de 12° restait dans le look)", () => {
    for (const t of [SEUIL_MANTEAU, 16, 20]) {
      const { principal, exterieur } = separerCoucheExterieure([robe, ballerines, trench], t);
      expect(exterieur).toBe(trench);
      expect(principal).not.toContain(trench);
    }
  });

  it("9 ter. à partir de 22 °C, aucune strate extérieure, ni manteau séparé ni manteau proposé (17/11/2026)", () => {
    expect(separerCoucheExterieure([robe, ballerines, trench], 21).exterieur).toBe(trench);
    const r = separerCoucheExterieure([robe, ballerines, trench], 22, [manteau], [manteau]);
    expect(r.exterieur).toBeNull();
    expect(r.conseilManteauPlusLong).toBe(false);
    expect(separerCoucheExterieure([robe, ballerines], 25, [trench]).exterieur).toBeNull();
  });

  it("9 bis. à la maison (Cocooning, Télétravail) : rien n'est séparé ni proposé", () => {
    const r = separerCoucheExterieure([robe, ballerines, trench], 8, [manteau], [manteau], true);
    expect(r.exterieur).toBeNull();
    expect(r.principal).toContain(trench);
    expect(separerCoucheExterieure([robe, ballerines], 8, [manteau], [], true).exterieur).toBeNull();
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

  it("la minimale du jour décide quand la prévision la donne (16/11/2026) : stable, quelle que soit l'heure", () => {
    // 11° à 13° dans la journée, 13° à l'instant : la minimale, 11°, passe sous le seuil — la strate s'affiche toute la journée.
    expect(temperatureReelle({ decalage: 0, sourceMeteo: "position", tempDuJour: 13, prevue: null, minDuJour: 11 })).toBe(11);
    expect(temperatureReelle({ decalage: 0, sourceMeteo: "position", tempDuJour: 11, prevue: null, minDuJour: 11 })).toBe(11);
    expect(temperatureReelle({ decalage: 3, sourceMeteo: "ville", tempDuJour: 8, prevue: 14, minDuJour: 9 })).toBe(9);
    // Sans prévision, la règle d'avant ; sans vraie météo aujourd'hui, rien.
    expect(temperatureReelle({ decalage: 0, sourceMeteo: "ville", tempDuJour: 13, prevue: null, minDuJour: null })).toBe(13);
    expect(temperatureReelle({ decalage: 0, sourceMeteo: "defaut", tempDuJour: 13, prevue: null, minDuJour: 5 })).toBeNull();
  });
});
