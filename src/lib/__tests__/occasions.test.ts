import { describe, expect, it } from "vitest";
import { OCCASIONS, OCC_LABELS, effectiveFormality, occasionShortLabel } from "@/lib/data";
import { generateOutfitWithFallback } from "@/lib/logic";
import { normaliserOccasion, normaliserOccasions, soireeHabillee } from "@/lib/occasions";
import { elementProgramme } from "@/lib/programmeValise";
import { weatherForDay } from "@/lib/capsule";
import type { CategoryKey, Item } from "@/lib/types";

// LA TAXONOMIE DES OCCASIONS (08/10/2026) : « Sortie festive » supprimée, « Sortie / Soirée » devient « Soirée ».

describe("la taxonomie officielle", () => {
  it("neuf occasions, dans l'ordre décidé", () => {
    expect(OCCASIONS.map(([, label]) => label)).toEqual([
      "Quotidien / Décontracté",
      "Travail / Bureau",
      "Rendez-vous important",
      "Rendez-vous amoureux",
      "Soirée",
      "Sport",
      "Cocooning / Maison",
      "Voyage / Déplacement",
      "Événement / Cérémonie",
    ]);
  });

  it("aucun libellé affiché ne dit encore « Sortie festive » ni « Sortie / Soirée »", () => {
    const affiches = [...OCCASIONS.flatMap(([, l, d]) => [l, d]), ...OCCASIONS.map(([k]) => occasionShortLabel(k)), ...Object.values(OCC_LABELS)];
    for (const t of affiches) expect(t).not.toMatch(/sortie festive|sortie \/ soir/i);
  });
});

describe("normaliserOccasion — les anciennes valeurs restent lisibles", () => {
  it("festive, sortie_festive et sortie_soiree se lisent « soiree »", () => {
    for (const v of ["festive", "sortie_festive", "sortie_soiree", "soiree", " Festive "]) expect(normaliserOccasion(v), v).toBe("soiree");
  });
  it("les autres valeurs ne bougent pas, l'inconnu n'est jamais une clé brute", () => {
    for (const [k] of OCCASIONS) expect(normaliserOccasion(k)).toBe(k);
    expect(normaliserOccasion("n'importe quoi")).toBeUndefined();
    expect(normaliserOccasion(null)).toBeUndefined();
  });
  it("une liste d'étiquettes est ramenée sans doublon (soiree + festive → soiree)", () => {
    expect(normaliserOccasions(["quotidien", "soiree", "festive", "date", "inconnue"])).toEqual(["quotidien", "soiree", "date"]);
    expect(normaliserOccasions(null)).toEqual([]);
  });
  it("une valise d'avant porte « soiree_festive » : elle se lit comme « Soirée »", () => {
    expect(elementProgramme("soiree_festive")?.mere).toBe("soiree");
  });
});

describe("la soirée habillée remplace l'ancienne occasion à part", () => {
  it("un bar, ou une préférence élégante ou audacieuse ; sinon polyvalente", () => {
    expect(soireeHabillee({ typeLieu: "Bar / Rooftop" })).toBe(true);
    expect(soireeHabillee({ humeur: "elegant" })).toBe(true);
    expect(soireeHabillee({ humeur: "audacieux" })).toBe(true);
    expect(soireeHabillee({ typeLieu: "Restaurant", humeur: "decontracte" })).toBe(false);
    expect(soireeHabillee({})).toBe(false);
    expect(soireeHabillee(undefined)).toBe(false);
  });
  it("la formalité : 3 par défaut (comme l'ancienne « Sortie / Soirée »), 4 quand elle est habillée", () => {
    expect(effectiveFormality("soiree", "Présentiel")).toBe(3);
    expect(effectiveFormality("soiree", "Présentiel", "Verre", true)).toBe(4);
    expect(effectiveFormality("quotidien", "Présentiel", "Verre", true)).toBe(1);
  });
  it("le moteur demande le palier 4 pour une soirée habillée, 3 sinon", () => {
    const pool = [] as Item[];
    const w = weatherForDay(18, "Nuageux", "Automne");
    expect(generateOutfitWithFallback(pool, w, "soiree", "Présentiel", "Verre", [], "femme").requestedFormality).toBe(3);
    expect(generateOutfitWithFallback(pool, w, "soiree", "Présentiel", "Verre", [], "femme", null, undefined, undefined, true).requestedFormality).toBe(4);
  });
  it("R-S17 : une soirée habillée écarte la chemise quand une alternative existe, une soirée polyvalente la garde", () => {
    const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
      ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
    const pool: Item[] = [
      p(1, "haut", "Chemise", { subtype: "Chemise" }),
      p(2, "haut", "Top satin", { subtype: "Top" }),
      p(3, "pantalon", "Pantalon"),
      p(4, "chaussures", "Escarpins", { shoeType: "Escarpins" }),
    ];
    const w = weatherForDay(18, "Nuageux", "Automne");
    const chemise = (habillee: boolean) => {
      let n = 0;
      for (let i = 0; i < 80; i++) if (generateOutfitWithFallback(pool, w, "soiree", "Présentiel", "Verre", [], "femme", null, undefined, undefined, habillee).ids.includes(1)) n++;
      return n;
    };
    expect(chemise(true)).toBe(0);
    expect(chemise(false)).toBeGreaterThan(0);
  });
});
