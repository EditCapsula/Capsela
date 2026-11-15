import { describe, expect, it } from "vitest";
import { STRATEGIE_PRODUCTION, computeDefaultCapsule, representativeWeatherFor, styleFit } from "../capsule";
import { CATALOG } from "../catalog";
import { computeLookScore } from "../logic";
import { EMPTY_PROFILE, STYLE_ID_TO_CATALOG_LABEL, type Profile } from "../profile";
import { bonusSilhouetteRonde, compatibiliteRonde, criteresFavorises, criteresRonde, estSilhouetteRonde } from "../silhouetteRonde";
import type { CategoryKey, Item } from "../types";
import { MILD } from "./fixtures";

// LA SILHOUETTE RONDE (15/11/2026, brief « Gestion des silhouettes rondes »), cas de tests du brief, section 6.

let n = 900000;
const p = (cat: CategoryKey, name: string, extra: Partial<Item> = {}): Item =>
  ({ id: n++, name, cat, color: "Noir", hex: "#1D1A16", season: "Toutes saisons", worn: null, ...extra }) as Item;

const MORPHOS = ["f_poire", "f_triangle_inverse", "f_rectangle", "f_sablier", "f_pomme"] as const;
const robePortefeuille = p("robe", "Robe midi portefeuille");
const wideLeg = p("pantalon", "Pantalon wide leg");
const hautAjuste = p("haut", "Top ajusté en jersey", { coupe: "Ajusté" });
const jupeCrayon = p("jupe", "Jupe crayon");
const robeMoulante = p("robe", "Robe moulante");

describe("silhouette ronde : qui est concerné", () => {
  it("la morphologie « plutôt ronde » seule aujourd'hui, une silhouette ronde déclarée demain ; jamais « fine » ni « moyenne »", () => {
    expect(estSilhouetteRonde("f_pomme")).toBe(true);
    expect(estSilhouetteRonde("f_sablier")).toBe(false);
    expect(estSilhouetteRonde("f_sablier", "ronde")).toBe(true);
    expect(estSilhouetteRonde("f_sablier", "moyenne")).toBe(false);
    expect(estSilhouetteRonde(null, "fine")).toBe(false);
    expect(criteresFavorises("f_rectangle")).toEqual([]);
  });
});

describe("les 5 morphologies combinées à une silhouette ronde", () => {
  it("une robe portefeuille est valorisée pour les cinq combinaisons", () => {
    for (const m of MORPHOS) expect(compatibiliteRonde(robePortefeuille, m, "ronde"), m).toBe(1);
  });

  it("le wide leg n'est pas recommandé à toutes : oui pour V et ronde seule, non pour A ni X / 8", () => {
    expect(criteresRonde(wideLeg).has("bas_large")).toBe(true);
    expect(compatibiliteRonde(wideLeg, "f_triangle_inverse", "ronde")).toBe(1);
    expect(compatibiliteRonde(wideLeg, "f_pomme")).toBe(1);
    expect(compatibiliteRonde(wideLeg, "f_poire", "ronde")).toBe(0);
    expect(compatibiliteRonde(wideLeg, "f_sablier", "ronde")).toBe(0);
  });

  it("un vêtement ajusté peut être valorisé (taille marquée, H) ; le près du corps n'est jamais pénalisé", () => {
    expect(compatibiliteRonde(hautAjuste, "f_sablier", "ronde")).toBe(1);
    expect(compatibiliteRonde(hautAjuste, "f_rectangle", "ronde")).toBe(1);
    expect(compatibiliteRonde(jupeCrayon, "f_sablier", "ronde")).toBe(1);
    // Une robe moulante n'est pas favorisée (compression), mais rien ne la pénalise : 0, jamais moins.
    for (const m of MORPHOS) expect(compatibiliteRonde(robeMoulante, m, "ronde")).toBe(0);
    expect(bonusSilhouetteRonde([robeMoulante, p("chaussures", "Escarpins")], "f_sablier", "ronde")).toBe(0);
  });

  it("les règles morphologiques plus précises priment : pas d'épaules structurées pour V, pas de volume en bas pour A", () => {
    expect(criteresFavorises("f_triangle_inverse", "ronde")).not.toContain("blazer_structure");
    expect(criteresFavorises("f_poire", "ronde")).not.toContain("bas_large");
    expect(criteresFavorises("f_poire", "ronde")).toContain("blazer_structure");
    expect(criteresFavorises("f_sablier", "ronde")).not.toContain("trapeze");
  });
});

describe("le bonus de tenue (R-S20)", () => {
  const encolure = p("haut", "Pull col V");
  const bas = p("pantalon", "Pantalon droit");
  it("un bonus seulement, et sans couleur : une tenue monochrome n'est pas obligatoire", () => {
    const camaieu = bonusSilhouetteRonde([encolure, bas], "f_pomme");
    const contraste = bonusSilhouetteRonde([{ ...encolure, color: "Rouge", hex: "#A4161A" }, { ...bas, color: "Camel", hex: "#C19A6B" }], "f_pomme");
    expect(camaieu).toBe(6);
    expect(contraste).toBe(camaieu);
  });
  it("deux vêtements amples retirent le bonus, sans jamais pénaliser", () => {
    expect(bonusSilhouetteRonde([p("haut", "Chemise oversize col V"), p("pantalon", "Pantalon large ample")], "f_pomme")).toBe(0);
  });
  it("computeLookScore : seuils inchangés, la règle n'ajoute que des points, et seulement pour une silhouette ronde", () => {
    const look = [encolure, bas, p("chaussures", "Mocassins")];
    const score = (morpho: string | null, actif: boolean) =>
      computeLookScore(look, "quotidien", [], morpho, new Set(), MILD, "Présentiel", "Verre", [], null, { silhouetteRonde: actif }).score;
    expect(score("f_pomme", true)).toBeGreaterThanOrEqual(score("f_pomme", false));
    expect(score("f_sablier", true)).toBe(score("f_sablier", false));
    expect(score(null, true)).toBe(score(null, false));
  });
});

describe("la capsule (levier silhouetteRonde)", () => {
  const profil = (over: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles: ["minimaliste"], ...over });
  const avec = { ...STRATEGIE_PRODUCTION, silhouetteRonde: "rang" as const };
  const w = representativeWeatherFor("Automne");
  it("rien ne change sans silhouette ronde", () => {
    for (const m of ["f_sablier", "f_poire", null]) {
      const pr = profil({ morphology: m });
      expect(computeDefaultCapsule(pr, w, [], "Automne", CATALOG, avec).map((i) => i.id)).toEqual(computeDefaultCapsule(pr, w, [], "Automne", CATALOG).map((i) => i.id));
    }
  });
  it("pour une silhouette ronde : même taille, au moins autant de pièces compatibles, le style respecté", () => {
    const pr = profil({ morphology: "f_pomme" });
    const avant = computeDefaultCapsule(pr, w, [], "Automne", CATALOG);
    const apres = computeDefaultCapsule(pr, w, [], "Automne", CATALOG, avec);
    expect(apres.length).toBe(avant.length);
    const compat = (c: Item[]) => c.filter((i) => compatibiliteRonde(i, "f_pomme") === 1).length;
    expect(compat(apres)).toBeGreaterThanOrEqual(compat(avant));
    const style = (c: Item[]) => c.filter((i) => styleFit(i, STYLE_ID_TO_CATALOG_LABEL.minimaliste)).length;
    expect(style(apres)).toBeGreaterThanOrEqual(style(avant) - 1);
  });
});

describe("Planifier, valise, tenue du jour : le meilleur tirage pour une silhouette ronde (meilleurTirageMorphologique)", () => {
  const encolure = p("haut", "Pull col V");
  const bas = p("pantalon", "Pantalon droit");
  const neutre1 = p("haut", "T-shirt basique");
  const neutre2 = p("pantalon", "Jogging");
  const pool = [encolure, bas, neutre1, neutre2];
  const sequence = (tenues: number[][]) => {
    let i = 0;
    let appels = 0;
    return { tirer: () => ({ ids: tenues[Math.min(i++, tenues.length - 1)], noCompleteOutfit: false, appels: ++appels }), nb: () => appels };
  };
  it("règle éteinte ou silhouette non ronde : un seul tirage, comme avant", async () => {
    const { meilleurTirageMorphologique } = await import("../silhouetteRonde");
    const a = sequence([[neutre1.id, neutre2.id], [encolure.id, bas.id]]);
    expect(meilleurTirageMorphologique(a.tirer, pool, "f_pomme", null, false).ids).toEqual([neutre1.id, neutre2.id]);
    expect(a.nb()).toBe(1);
    const b = sequence([[neutre1.id, neutre2.id], [encolure.id, bas.id]]);
    expect(meilleurTirageMorphologique(b.tirer, pool, "f_sablier", null, true).ids).toEqual([neutre1.id, neutre2.id]);
    expect(b.nb()).toBe(1);
  });
  it("silhouette ronde, règle active : la tenue qui sert le mieux la règle, parmi des tirages du même moteur", async () => {
    const { meilleurTirageMorphologique } = await import("../silhouetteRonde");
    const c = sequence([[neutre1.id, neutre2.id], [encolure.id, neutre2.id], [encolure.id, bas.id]]);
    expect(meilleurTirageMorphologique(c.tirer, pool, "f_pomme", null, true).ids).toEqual([encolure.id, bas.id]);
  });
  it("à égalité, le premier tirage est gardé", async () => {
    const { meilleurTirageMorphologique } = await import("../silhouetteRonde");
    const d = sequence([[neutre1.id, neutre2.id], [neutre2.id, neutre1.id]]);
    expect(meilleurTirageMorphologique(d.tirer, pool, "f_pomme", null, true).ids).toEqual([neutre1.id, neutre2.id]);
  });
});
