import { describe, expect, it } from "vitest";
import { formalityOf } from "../attributes";
import { generateOutfitWithFallback } from "../logic";
import { at, item } from "./fixtures";

/** LE NIVEAU 2 « CASUAL CHIC / SMART CASUAL » (11/11/2026, décision D1). */
describe("niveau 2 de formalité", () => {
  it("se lit depuis la base, sous ses deux écritures", () => {
    expect(formalityOf(item({ id: 1, category: "vestes_blazers", name: "Blazer déstructuré", niveau_formalite: "casual_chic" }))).toBe(2);
    expect(formalityOf(item({ id: 2, category: "robes", name: "Robe midi portefeuille", niveau_formalite: "casual chic" }))).toBe(2);
    expect(formalityOf(item({ id: 3, category: "hauts", name: "T-shirt", niveau_formalite: "decontracte" }))).toBe(1);
  });

  it("le levier « plancher » est inerte par défaut ; demandé à 2, le palier visé est 2", () => {
    const T = "Printemps, Été, Automne, Hiver";
    const pool = [
      item({ id: 10, category: "hauts", name: "T-shirt blanc", couleur_dominante: "Blanc", niveau_formalite: "decontracte", saison_capsule: T, manches: "courtes" }),
      item({ id: 11, category: "pantalons", name: "Pantalon large fluide", couleur_dominante: "Noir", niveau_formalite: "casual_chic", saison_capsule: T }),
      item({ id: 12, category: "vestes_blazers", name: "Blazer déstructuré", sous_type: "Blazer", couleur_dominante: "Beige", niveau_formalite: "casual_chic", saison_capsule: T }),
      item({ id: 13, category: "chaussures", name: "Mocassins", sous_type: "Mocassins", couleur_dominante: "Camel", niveau_formalite: "casual_chic", saison_capsule: T }),
    ];
    const w = at(18, "Printemps / Été");
    const sans = generateOutfitWithFallback(pool, w, "travail_formel", "Présentiel");
    expect(sans.requestedFormality).toBe(3);
    const avec = generateOutfitWithFallback(pool, w, "travail_formel", "Présentiel", "Verre", [], "femme", null, { plancher: 2 });
    expect(avec.requestedFormality).toBe(2);
    expect(avec.ids.length).toBeGreaterThan(0);
  });
});
