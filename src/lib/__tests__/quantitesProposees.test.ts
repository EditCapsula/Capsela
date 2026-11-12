import { describe, expect, it } from "vitest";
import { ajusterALaCapacite, avecReglagesManuels, bagageQuiConvient, quantiteLinge, quantiteProposee, quantitesDeLaValise, type UsagePiece } from "../quantitesProposees";
import { reglerQuantite } from "../quantitesValise";
import { capaciteDe, type SituationValise } from "../valise";
import type { CreneauPlanning } from "../planningValise";
import type { CategoryKey, Item } from "../types";

// Les quantités proposées d'une valise (12/11/2026, étape 3 du brief Vacances, arbitrages de la propriétaire).

const piece = (id: number, cat: CategoryKey, name: string, subtype?: string): Item => ({ id, name, cat, color: "Blanc", hex: "#fff", season: "Toutes saisons", worn: 0, ...(subtype ? { subtype } : {}) });
const jours = (n: number, debut = 1) => new Set(Array.from({ length: n }, (_, k) => `2026-12-${String(debut + k).padStart(2, "0")}`));
const usage = (p: Partial<Record<keyof UsagePiece, Set<string>>>): UsagePiece => ({ jours: new Set(), chauds: new Set(), sport: new Set(), baignade: new Set(), plage: new Set(), ...p });

const tshirt = piece(1, "haut", "T-shirt coton col rond");

describe("t-shirts et débardeurs", () => {
  it("un pour deux jours d'utilisation, au plus 3", () => {
    expect(quantiteProposee(tshirt, usage({ jours: jours(2) }), null)).toBe(1);
    expect(quantiteProposee(tshirt, usage({ jours: jours(4) }), null)).toBe(2);
    expect(quantiteProposee(tshirt, usage({ jours: jours(10) }), null)).toBe(3);
  });
  it("un par jour chaud ou sportif", () => {
    expect(quantiteProposee(tshirt, usage({ jours: jours(3), chauds: jours(3) }), null)).toBe(3);
    expect(quantiteProposee(tshirt, usage({ jours: jours(2), sport: jours(1) }), null)).toBe(2);
  });
  it("avec lavage, sur un cycle de quatre jours ; sans lavage, sur toute la durée, sans plafond", () => {
    expect(quantiteProposee(tshirt, usage({ jours: jours(10), chauds: jours(10) }), true)).toBe(3);
    expect(quantiteProposee(tshirt, usage({ jours: jours(10), chauds: jours(10) }), false)).toBe(10);
    expect(quantiteProposee(tshirt, usage({ jours: jours(10) }), false)).toBe(5);
  });
});

describe("pièces de bain, robe de plage, short léger", () => {
  it("1, puis 2 au-delà de 5 jours — de baignade, de plage, d'utilisation", () => {
    const maillot = piece(2, "haut", "Maillot", "Maillot de bain");
    expect(quantiteProposee(maillot, usage({ jours: jours(5), baignade: jours(5) }), null)).toBe(1);
    expect(quantiteProposee(maillot, usage({ jours: jours(6), baignade: jours(6) }), null)).toBe(2);
    const robe = piece(3, "robe", "Robe de plage", "Robe de plage");
    expect(quantiteProposee(robe, usage({ jours: jours(6), plage: jours(6) }), null)).toBe(2);
    const short = piece(4, "short", "Short en lin");
    expect(quantiteProposee(short, usage({ jours: jours(6) }), null)).toBe(2);
    expect(quantiteProposee(short, usage({ jours: jours(6) }), true)).toBe(1);
  });
  it("les jours de baignade ne s'additionnent pas entre plage, piscine et spa", () => {
    const maillot = piece(2, "haut", "Maillot", "Maillot de bain");
    // Plage et piscine le même jour : ce jour compte une fois (usageDesPieces le range dans un Set).
    expect(quantiteProposee(maillot, usage({ jours: jours(5), baignade: jours(5) }), null)).toBe(1);
  });
  it("toute autre pièce : 1", () => {
    expect(quantiteProposee(piece(5, "pantalon", "Pantalon"), usage({ jours: jours(7) }), false)).toBe(1);
    expect(quantiteProposee(piece(6, "chaussures", "Chaussures de randonnée"), usage({ jours: jours(7) }), false)).toBe(1);
  });
});

describe("le linge (sous-vêtements, chaussettes)", () => {
  it("un par jour ; avec lavage, un cycle ; sans lavage, toute la durée, au-delà de sept jours", () => {
    expect(quantiteLinge(5, null)).toBe(5);
    expect(quantiteLinge(12, null)).toBe(7);
    expect(quantiteLinge(12, true)).toBe(4);
    expect(quantiteLinge(12, false)).toBe(12);
  });
});

describe("réglages manuels et capacité", () => {
  it("un réglage à la main passe devant la proposition", () => {
    expect(avecReglagesManuels({ "1": 3 }, { "1": 1 })).toEqual({ "1": 1 });
  });
  it("le bagage déborde : les exemplaires en plus sont retirés, jamais sous 1 ni ceux réglés à la main", () => {
    const pieces = [{ id: 1, cat: "haut" as const }, { id: 2, cat: "haut" as const }];
    const r = ajusterALaCapacite(pieces, { "1": 3, "2": 3 }, 4, () => 1, { "2": 3 });
    expect(r.quantites).toEqual({ "2": 3 });
    expect(r.retires).toBe(2);
  });
});

describe("la valise affichée (branchement du 12/11/2026, option 3)", () => {
  const situation = { occasion: "sortie_vacances", sousIds: ["visite"], jours: ["2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04"], meteo: { temp: 20 } } as unknown as SituationValise;
  const planning = situation.jours.map((jour) => ({ jour, sousId: "visite", look: 0 })) as unknown as CreneauPlanning[];
  const pantalon = piece(7, "pantalon", "Pantalon");
  const base = { pieces: [tshirt, pantalon], planning, looks: [{ ids: [1, 7] }], situations: [situation], lavage: null, manuelles: undefined, capacite: 22, volumeLinge: 0 };
  it("propose d'après le planning ; un réglage à la main, 1 compris, passe devant", () => {
    expect(quantitesDeLaValise(base).quantites).toEqual({ "1": 2 });
    expect(quantitesDeLaValise({ ...base, manuelles: reglerQuantite(undefined, 1, 1) }).quantites).toEqual({});
  });
  it("le linge fait déborder : les exemplaires proposés en plus sont retirés, jamais une pièce", () => {
    expect(quantitesDeLaValise({ ...base, volumeLinge: 21 }).quantites).toEqual({});
  });
  it("la taille qui conviendrait : la plus petite plus grande où tout tient, sinon aucune", () => {
    expect(bagageQuiConvient(capaciteDe("M") + 1, "M")).toBe("L");
    expect(bagageQuiConvient(capaciteDe("M") + 1, "S")).toBe("L");
    expect(bagageQuiConvient(capaciteDe("XL") + 1, "M")).toBeNull();
  });
});
