import { describe, expect, it } from "vitest";
import { representativeWeatherFor } from "../capsule";
import { categoriesManquantes, computeLookScore, isCompleteOutfit } from "../logic";
import { statutTenue, surtitreSuggestion } from "../statutTenue";
import type { CategoryKey, Item } from "../types";

describe("statutTenue — trois états lus sur le moteur", () => {
  it("deux pièces complètes ne sont pas « à compléter »", () => {
    expect(statutTenue({ nbPieces: 2, complete: true, ajoutsConseilles: 0 })).toEqual({ cle: "complete", libelle: "Tenue complète · 2 pièces" });
  });

  it("un manque réel du moteur passe avant tout", () => {
    expect(statutTenue({ nbPieces: 2, complete: false, ajoutsConseilles: 1 }).cle).toBe("a_completer");
  });

  it("une pièce conseillée : un ajout, pas un manque", () => {
    expect(statutTenue({ nbPieces: 3, complete: true, ajoutsConseilles: 1 })).toEqual({
      cle: "ajout_conseille",
      libelle: "3 pièces · 1 ajout conseillé",
    });
    expect(statutTenue({ nbPieces: 3, complete: true, ajoutsConseilles: 2 }).libelle).toBe("3 pièces · 2 ajouts conseillés");
  });

  it("juste après un ajout : « Tenue complétée »", () => {
    expect(statutTenue({ nbPieces: 4, complete: true, ajoutsConseilles: 0, vientDEtreCompletee: true }).libelle).toBe("Tenue complétée · 4 pièces");
  });

  it("le surtitre dit pourquoi", () => {
    expect(surtitreSuggestion("veste_soir")).toBe("À prévoir");
    expect(surtitreSuggestion("inconnue")).toBe("Conseil Capsela");
  });
});

let n = 0;
const piece = (cat: CategoryKey, name: string, id?: number, extra: Partial<Item> = {}): Item => ({
  id: id ?? ++n,
  name,
  cat,
  color: "Bordeaux",
  hex: "#6B2233",
  season: "Toutes saisons",
  worn: 2,
  occasion: ["quotidien"],
  ...extra,
});

describe("computeLookScore — la veste d'une soirée fraîche vient d'abord du dressing", () => {
  const robe = piece("robe", "Robe midi bordeaux");
  const chaussures = piece("chaussures", "Bottines", undefined, { shoeType: "Bottines", color: "Noir", hex: "#222" });
  const vesteDuDressing = piece("veste", "Blazer bleu marine", undefined, { color: "Marine", hex: "#1F2A44" });
  const vesteDuCatalogue = piece("veste", "Kimono long fluide", 100500, { color: "Beige", hex: "#D8C3A5" });
  const meteo = representativeWeatherFor("Automne");

  it("avec une veste au dressing : c'est elle qui est proposée", () => {
    const { proactives } = computeLookScore([robe, chaussures], "quotidien", [], null, new Set(), meteo, "Présentiel", "Verre", [vesteDuCatalogue, vesteDuDressing, robe, chaussures]);
    expect(proactives.find((p) => p.key === "veste_soir")?.suggestedId).toBe(vesteDuDressing.id);
  });

  it("sans veste au dressing : celle du catalogue, comme avant", () => {
    const { proactives } = computeLookScore([robe, chaussures], "quotidien", [], null, new Set(), meteo, "Présentiel", "Verre", [vesteDuCatalogue, robe, chaussures]);
    expect(proactives.find((p) => p.key === "veste_soir")?.suggestedId).toBe(vesteDuCatalogue.id);
  });
});

describe("categoriesManquantes — la règle d'isCompleteOutfit, pièce par pièce", () => {
  it("robe + sac : il manque des chaussures", () => {
    const tenue = [piece("robe", "Robe"), piece("sac", "Sac")];
    expect(isCompleteOutfit(tenue)).toBe(false);
    expect(categoriesManquantes(tenue)).toEqual(["chaussures"]);
  });
  it("haut seul : un bas et des chaussures", () => {
    expect(categoriesManquantes([piece("haut", "Chemise")])).toEqual(["bas", "chaussures"]);
  });
  it("tenue complète : rien", () => {
    const tenue = [piece("haut", "Chemise"), piece("jean", "Jean"), piece("chaussures", "Baskets")];
    expect(isCompleteOutfit(tenue)).toBe(true);
    expect(categoriesManquantes(tenue)).toEqual([]);
  });
});
