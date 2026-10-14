import { describe, expect, it } from "vitest";
import { representativeWeatherFor } from "../capsule";
import { categoriesManquantes, computeLookScore, isCompleteOutfit } from "../logic";
import { manquesActuels, piecesStructurellesManquantes, statutTenue, surtitreSuggestion } from "../statutTenue";
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

  it("le ratio de pièces, seulement quand une pièce de structure manque", () => {
    expect(statutTenue({ nbPieces: 4, complete: false, ajoutsConseilles: 0, piecesManquantes: 1 }).libelle).toBe("À compléter · 4/5 pièces");
    expect(statutTenue({ nbPieces: 2, complete: false, ajoutsConseilles: 0, piecesManquantes: 0 }).libelle).toBe("À compléter");
    expect(statutTenue({ nbPieces: 2, complete: false, ajoutsConseilles: 0 }).libelle).toBe("À compléter");
  });

  it("un manque signalé par le tirage tombe dès que la pièce est ajoutée", () => {
    expect(manquesActuels(["chaussures"], ["chaussures"], 4)).toEqual(["chaussures"]);
    expect(manquesActuels(["chaussures"], [], 5)).toEqual([]);
    // « chaud » n'est pas une pièce de structure : il reste celui du tirage.
    expect(manquesActuels(["chaussures", "chaud"], [], 5)).toEqual(["chaud"]);
    // Sans signalement : la structure des pièces affichées ; rien pour une tenue vide.
    expect(manquesActuels([], ["chaussures"], 3)).toEqual(["chaussures"]);
    expect(manquesActuels(undefined, ["haut", "bas", "chaussures"], 0)).toEqual([]);
    expect(piecesStructurellesManquantes(["chaussures", "chaud"])).toBe(1);
    expect(piecesStructurellesManquantes(["haut", "bas"])).toBe(2);
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

  it("chez soi (cocooning, télétravail) : aucun « à prévoir » avec une veste", () => {
    const pool = [vesteDuCatalogue, vesteDuDressing, robe, chaussures];
    const cle = (occ: "cocooning" | "travail_formel", mode: "Présentiel" | "Télétravail") =>
      computeLookScore([robe, chaussures], occ, [], null, new Set(), meteo, mode, "Verre", pool).proactives.some((p) => p.key === "veste_soir");
    expect(cle("cocooning", "Présentiel")).toBe(false);
    expect(cle("travail_formel", "Télétravail")).toBe(false);
    expect(cle("travail_formel", "Présentiel")).toBe(true);
  });

  it("une maille portée par-dessus (sweat à capuche, gilet, zippé) tient lieu de veste ; un pull simple, non (14/10/2026)", () => {
    const pool = [vesteDuCatalogue, vesteDuDressing, robe, chaussures];
    const conseille = (couche: Item, occ: "sport" | "quotidien" = "quotidien") =>
      computeLookScore([robe, chaussures, couche], occ, [], null, new Set(), meteo, "Présentiel", "Verre", pool).proactives.some((p) => p.key === "veste_soir");
    expect(conseille(piece("pull", "Sweat à capuche (Hoodie) / Sweat zippé", undefined, { subtype: "Sweat à capuche" }), "sport")).toBe(false);
    expect(conseille(piece("pull", "Hoodie oversize", undefined, { subtype: "Hoodie" }))).toBe(false);
    expect(conseille(piece("pull", "Cardigan en laine", undefined, { subtype: "Cardigan" }))).toBe(false);
    expect(conseille(piece("pull", "Pull col rond", undefined, { subtype: "Pull" }))).toBe(true);
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
