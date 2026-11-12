import { describe, expect, it } from "vitest";
import { weatherForDay } from "../capsule";
import { computeLookScore, fraicheurDuSoir } from "../logic";
import type { CategoryKey, Item } from "../types";

// R-S14, la température du SOIR (01/11/2026, demandé : « si le conseil s'affiche parce que la température a été vérifiée pour le soir
// on est ok, sinon il faut vérifier la température de fin de journée »).

const p = (id: number, cat: CategoryKey, name: string): Item =>
  ({ id, name, cat, color: "Beige", hex: "#D8C3A5", season: "Toutes saisons", worn: 2, occasion: ["quotidien"] }) as Item;
const ROBE = p(1, "robe", "Robe midi");
const BOTTINES = p(2, "chaussures", "Bottines");
const VESTE = p(3, "veste", "Veste en jean");
const conseil = (temp: number, tempSoir?: number) => {
  const meteo = { ...weatherForDay(temp, "Ensoleillé", "Automne"), ...(tempSoir === undefined ? {} : { tempSoir }) };
  return computeLookScore([ROBE, BOTTINES], "quotidien", [], null, new Set(), meteo, "Présentiel", "Verre", [ROBE, BOTTINES, VESTE]).proactives.find(
    (x) => x.key === "veste_soir"
  );
};

describe("le conseil « frais ce soir » lit la soirée", () => {
  it("journée chaude, soirée fraîche : le conseil, qui parle du soir", () => {
    const c = conseil(24, 14);
    expect(c).toBeDefined();
    expect(c!.text).toContain("ce soir");
  });
  it("journée fraîche, soirée douce : pas de conseil", () => {
    expect(conseil(18, 23)).toBeUndefined();
  });
  it("sans prévision du soir : la température du jour, et le texte ne parle plus du soir", () => {
    const c = conseil(18);
    expect(c!.text).toContain("aujourd'hui");
    expect(c!.text).not.toContain("ce soir");
    expect(fraicheurDuSoir({})).toBe("il fait frais aujourd'hui");
  });
});

describe("par le froid, jamais une veste à la place du manteau (12/11/2026, signalé)", () => {
  it("soirée sous le seuil du manteau, une veste seulement : rien n'est suggéré, le texte parle d'un manteau", () => {
    const c = conseil(14, 8);
    expect(c).toBeDefined();
    expect(c!.suggestedId).toBeUndefined();
    expect(c!.text).toContain("un manteau");
  });
  it("au-dessus du seuil, la veste reste suggérée", () => {
    expect(conseil(24, 14)!.suggestedId).toBe(VESTE.id);
  });
});
