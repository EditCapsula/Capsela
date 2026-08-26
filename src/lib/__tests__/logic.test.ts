import { describe, expect, it } from "vitest";
import { evaluateBlocking, generateOutfitWithFallback, violatesOuterwearRule } from "../logic";
import type { CatalogItem } from "../catalog";
import { at, item } from "./fixtures";

const DRAWS = 200;

/** Garde-robe minimale complète — haut, bas, chaussures, sac. */
function wardrobe(extra: CatalogItem[] = []): CatalogItem[] {
  return [
    item({ id: 1, category: "hauts", name: "Top uni", sous_type: "T-shirt", couleur_dominante: "Écru", niveau_formalite: "business_casual", role_piece: "base" }),
    item({ id: 2, category: "pantalons", name: "Pantalon droit", sous_type: "Pantalon", couleur_dominante: "Noir", niveau_formalite: "business_casual", role_piece: "base" }),
    item({ id: 3, category: "chaussures", name: "Bottines", sous_type: "Bottines", couleur_dominante: "Noir", niveau_formalite: "business_casual" }),
    item({ id: 4, category: "sacs", name: "Cabas", sous_type: "Cabas", couleur_dominante: "Camel", niveau_formalite: "business_casual" }),
    ...extra,
  ];
}

/** Tire N tenues et renvoie les listes d'ids retenues. */
function draw(pool: CatalogItem[], occasion: Parameters<typeof generateOutfitWithFallback>[2], temp: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < DRAWS; i += 1) {
    const r = generateOutfitWithFallback(pool, at(temp), occasion, "Présentiel", "Verre", [], "femme");
    if (!r.noCompleteOutfit) out.push(r.ids);
  }
  return out;
}

describe("R-B9 — une veste ou un manteau exige une base en dessous", () => {
  const manteau = item({ id: 10, category: "manteaux_exterieurs", name: "Manteau", sous_type: "Manteau", role_piece: "calque" });

  it("un manteau seul ne fait pas une tenue", () => {
    expect(violatesOuterwearRule([manteau])).toBe(true);
  });

  it("un pull de rôle base suffit (correctif 26/08/2026)", () => {
    const pull = item({ id: 11, category: "pulls_gilets", name: "Pull col roulé", sous_type: "Pull col roulé", role_piece: "base" });
    expect(violatesOuterwearRule([pull, manteau])).toBe(false);
  });

  it("un pull de rôle calque ne suffit pas — c'est là que le layering est obligatoire", () => {
    const cardigan = item({ id: 12, category: "pulls_gilets", name: "Cardigan", sous_type: "Cardigan", role_piece: "calque" });
    expect(violatesOuterwearRule([cardigan, manteau])).toBe(true);
  });

  it("un haut ou une robe restent des bases valides", () => {
    const haut = item({ id: 13, category: "hauts", name: "Chemise", sous_type: "Chemise" });
    const robe = item({ id: 14, category: "robes", name: "Robe", sous_type: "Robe" });
    expect(violatesOuterwearRule([haut, manteau])).toBe(false);
    expect(violatesOuterwearRule([robe, manteau])).toBe(false);
  });

  it("est la seule règle qui bloque réellement l'enregistrement", () => {
    const dur = evaluateBlocking([manteau], "quotidien", at(4)).filter((h) => h.hard);
    expect(dur.map((h) => h.id)).toContain("R-B9");
  });
});

describe("R-B19 — compensation d'une pièce courte par un collant", () => {
  const miniJupe = item({
    id: 20, category: "jupes", name: "Mini-jupe", sous_type: "Mini-jupe", couleur_dominante: "Noir",
    niveau_formalite: "business_casual", role_piece: "base", meteo_min_temp: 16, saison_capsule: "Automne, Hiver",
  });
  const collants = item({
    id: 21, category: "accessoires", name: "Collants semi-opaques", sous_type: "Collants", couleur_dominante: "Noir",
    role_piece: "calque", meteo_min_temp: 8, meteo_max_temp: 18, saison_capsule: "Automne, Hiver",
  });
  const ceinture = item({ id: 22, category: "accessoires", name: "Ceinture", sous_type: "Ceinture", couleur_dominante: "Camel" });

  it("la jupe survit sous son propre seuil au lieu d'être écartée", () => {
    const tenues = draw(wardrobe([miniJupe, collants]), "quotidien", 4);
    expect(tenues.some((ids) => ids.includes(miniJupe.id))).toBe(true);
  });

  it("et sort toujours accompagnée d'un collant", () => {
    const tenues = draw(wardrobe([miniJupe, collants]), "quotidien", 4);
    const avecJupe = tenues.filter((ids) => ids.includes(miniJupe.id));
    expect(avecJupe.length).toBeGreaterThan(0);
    expect(avecJupe.every((ids) => ids.includes(collants.id))).toBe(true);
  });

  it("y compris quand un autre accessoire est présent (correctif 26/08/2026)", () => {
    // L'échelle de replis des accessoires retenait le premier barreau
    // contenant AU MOINS UN accessoire : une ceinture, insensible à la
    // température, emportait les collants avec elle sous leur seuil.
    const tenues = draw(wardrobe([miniJupe, collants, ceinture]), "quotidien", 4);
    const avecJupe = tenues.filter((ids) => ids.includes(miniJupe.id));
    expect(avecJupe.length).toBeGreaterThan(0);
    expect(avecJupe.every((ids) => ids.includes(collants.id))).toBe(true);
  });

  it("le collant n'est plus imposé quand la jupe est dans sa plage", () => {
    // Au-dessus du seuil, R-B19 ne se déclenche pas : le collant peut encore
    // être tiré comme accessoire ordinaire, mais il n'accompagne plus
    // systématiquement la jupe. C'est ce contraste avec le 100 % mesuré
    // sous le seuil qui prouve que la compensation est bien conditionnelle.
    const tenues = draw(wardrobe([miniJupe, collants]), "quotidien", 18);
    const avecJupe = tenues.filter((ids) => ids.includes(miniJupe.id));
    expect(avecJupe.length).toBeGreaterThan(0);
    expect(avecJupe.some((ids) => !ids.includes(collants.id))).toBe(true);
  });
});

describe("R-B3 — plancher de formalité et occasion déclarée", () => {
  it("écarte une pièce trop décontractée d'une occasion habillée", () => {
    const jogging = item({
      id: 30, category: "pantalons", name: "Pantalon de jogging", sous_type: "Jogging",
      couleur_dominante: "Gris", niveau_formalite: "sport", role_piece: "base",
    });
    const tenues = draw(wardrobe([jogging]), "travail_formel", 16);
    expect(tenues.length).toBeGreaterThan(0);
    expect(tenues.every((ids) => !ids.includes(jogging.id))).toBe(true);
  });

  it("mais une occasion déclarée sur la pièce prime sur la déduction (correctif 26/08/2026)", () => {
    const topDeclare = item({
      id: 31, category: "hauts", name: "Top drapé", sous_type: "Top", couleur_dominante: "Bordeaux",
      niveau_formalite: "business_casual", role_piece: "base", occasions: "soiree",
    });
    const tenues = draw(wardrobe([topDeclare]), "soiree", 16);
    expect(tenues.some((ids) => ids.includes(topDeclare.id))).toBe(true);
  });
});

describe("Filtre de température", () => {
  it("le plafond haute température reste appliqué", () => {
    const pullEpais = item({
      id: 40, category: "pulls_gilets", name: "Pull grosse maille", sous_type: "Pull col roulé",
      couleur_dominante: "Écru", role_piece: "base", meteo_max_temp: 12,
    });
    const tenues = draw(wardrobe([pullEpais]), "quotidien", 26);
    expect(tenues.length).toBeGreaterThan(0);
    expect(tenues.every((ids) => !ids.includes(pullEpais.id))).toBe(true);
  });
});
