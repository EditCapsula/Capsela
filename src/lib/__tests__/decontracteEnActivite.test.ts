import { describe, expect, it } from "vitest";
import { formalityOf } from "../attributes";
import { weatherForDay } from "../capsule";
import { generateOutfitWithFallback } from "../logic";
import type { CategoryKey, DateContext, Item, ShoeType } from "../types";

// R-S28 (04/11/2026, demandé : « pour une activité lors d'un date il faut privilégier une tenue décontractée », puis « pour Cinéma et
// balade la tenue doit être décontractée également »). Mesuré dans la MÊME
// exécution, sur le même dressing : AVANT = levier `sansDecontracteEnActivite`, APRÈS = production. Le dressing a de quoi faire les deux :
// une robe moulante et des escarpins, un jean, un t-shirt et des baskets. Mesuré le 04/11/2026 : 30 % de tenues décontractées avant,
// 100 % après (la robe habillée n'est plus le socle quand un haut et un bas décontractés existent).

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, occasion: ["date"], ...over }) as Item;
const DRESSING = [
  p(1, "robe", "Robe moulante", { niveauFormalite: 3 }),
  p(2, "chaussures", "Escarpins", { shoeType: "Escarpins" as ShoeType }),
  p(3, "jean", "Jean droit", { niveauFormalite: 1 }),
  p(4, "haut", "T-shirt basique", { niveauFormalite: 1 }),
  p(5, "chaussures", "Baskets blanches", { shoeType: "Baskets" as ShoeType }),
  p(6, "sac", "Sac bandoulière", { sacType: "Bandoulière" }),
];
const meteo = weatherForDay(18, "Nuageux", "Automne");
const PRINCIPALES: CategoryKey[] = ["robe", "combinaison", "haut", "jean", "pantalon", "jupe", "short", "chaussures"];

/** La part des tenues dont toutes les pièces principales sont décontractées (formalité ≤ 1), sur 200 tirages. */
const partDecontractee = (contexte: DateContext, avant: boolean) => {
  let n = 0;
  for (let i = 0; i < 200; i++) {
    const r = generateOutfitWithFallback(DRESSING, meteo, "date", "Présentiel", contexte, [], "femme", null, avant ? { sansDecontracteEnActivite: true } : undefined);
    const pieces = r.ids.map((id) => DRESSING.find((x) => x.id === id)!).filter((x) => x && PRINCIPALES.includes(x.cat));
    if (pieces.length && pieces.every((x) => formalityOf(x) <= 1)) n++;
  }
  return n / 200;
};

describe("R-S28 : une activité en rendez-vous, une tenue décontractée", () => {
  it("Activité : la tenue décontractée passe devant la robe moulante et les escarpins", () => {
    const avant = partDecontractee("Activité", true);
    const apres = partDecontractee("Activité", false);
    expect(apres).toBe(1);
    expect(avant).toBeLessThan(0.9);
  });

  it("Cinéma / balade : décontractée aussi (demandé le même jour)", () => {
    expect(partDecontractee("Cinéma / balade", false)).toBe(1);
    expect(partDecontractee("Cinéma / balade", true)).toBeLessThan(0.9);
  });

  it("Verre : non concerné, la règle ne s'étend pas sans examen (AGENTS.md, point 7)", () => {
    // Les deux bras ont le même comportement : le levier ne touche que l'Activité.
    const r = generateOutfitWithFallback(DRESSING, meteo, "date", "Présentiel", "Verre", [], "femme", null, undefined);
    expect(r.ids.length).toBeGreaterThan(0);
    expect(partDecontractee("Verre", false)).toBeLessThan(0.9);
  });
});
