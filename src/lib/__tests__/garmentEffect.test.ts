import { describe, expect, it } from "vitest";
import { CONTRAINTES, ecartBorne, effetMorphologique, scoreMorphoV2, signatureLook, zonesRequises } from "../garmentEffect";
import { row } from "./fixtures";
import { rowToCatalogItem } from "../vestiaire";
import type { CatalogItem } from "../catalog";

function piece(over: Parameters<typeof row>[0]): CatalogItem {
  const it = rowToCatalogItem(row(over));
  if (!it) throw new Error("conversion impossible");
  return it;
}

const effet = (over: Parameters<typeof row>[0], sousType?: string | null) =>
  effetMorphologique(piece(over), sousType ?? (over as { sous_type?: string }).sous_type ?? null);

describe("zone d'impact selon la famille", () => {
  it("place le volume en bas pour un pantalon, en haut pour un pull", () => {
    expect(effet({ id: 1, category: "pantalons", name: "Pantalon", sous_type: "Pantalon large" }))
      .toMatchObject({ hanches: 3, epaules: 0 });
    expect(effet({ id: 2, category: "pulls_gilets", name: "Pull", sous_type: "Pull oversize" }))
      .toMatchObject({ epaules: 3, hanches: 0 });
  });

  it("répartit le volume d'une robe sur les trois zones plutôt que de le concentrer", () => {
    const robe = effet({ id: 3, category: "robes", name: "Robe", sous_type: "Robe large" });
    expect(robe.epaules).toBeLessThan(3);
    expect(robe.hanches).toBeLessThan(3);
  });

  it("écarte les pièces qui ne structurent pas la silhouette", () => {
    for (const [category, sous_type] of [
      ["accessoires", "Bonnet"], ["sacs", "Cabas"], ["bijoux", "Collier"], ["chaussures", "Bottines"],
    ] as const) {
      expect(effet({ id: 4, category, name: "x", sous_type }).pertinent, `${category}`).toBe(false);
    }
  });
});

describe("types univoques", () => {
  it("donne un effet, pas une coupe, et le justifie", () => {
    const e = effet({ id: 10, category: "pantalons", name: "Pantalon wide leg", sous_type: "Pantalon" });
    expect(e).toMatchObject({ hanches: 3, confiance: "haute" });
    expect(e.motif).toContain("type");
  });

  it("distingue un évasement parti de la taille d'un évasement parti du genou", () => {
    // Même racine stylistique, effets opposés sur la hanche : seule la famille
    // permet de trancher. C'est la raison d'être du modèle.
    const jupe = effet({ id: 11, category: "jupes", name: "Jupe trapèze", sous_type: "Jupe" });
    const pantalon = effet({ id: 12, category: "pantalons", name: "Pantalon flare", sous_type: "Pantalon" });
    expect(jupe.hanches).toBeGreaterThan(pantalon.hanches);
  });

  it("ignore un terme de type hors des familles où il a un sens", () => {
    expect(effet({ id: 13, category: "sacs", name: "Sac cargo", sous_type: "Sac" }).pertinent).toBe(false);
    const haut = effet({ id: 14, category: "hauts", name: "Haut cargo", sous_type: "Haut" });
    expect(haut.confiance).toBe("inconnue");
  });

  it("ne déduit rien des types seulement indicatifs", () => {
    for (const [category, name] of [
      ["hauts", "Polo"], ["hauts", "Chemise"], ["hauts", "Blouse"],
      ["pulls_gilets", "Pull"], ["pulls_gilets", "Cardigan"],
      ["pantalons", "Chino"], ["shorts", "Bermuda"],
    ] as const) {
      expect(effet({ id: 15, category, name, sous_type: name }).confiance, name).toBe("inconnue");
    }
  });

  it("laisse la colonne coupe primer sur le type", () => {
    const e = effet({ id: 16, category: "pantalons", name: "Pantalon wide leg", sous_type: "Pantalon", coupe: "Serré" });
    expect(e.hanches).toBe(0);
    expect(e.motif).toContain("coupe");
  });
});

describe("longueur", () => {
  it("lit la longueur du vêtement", () => {
    expect(effet({ id: 20, category: "jupes", name: "Jupe midi", sous_type: "Jupe" }).longueur).toBe("longue");
    expect(effet({ id: 21, category: "hauts", name: "Top crop", sous_type: "Top" }).longueur).toBe("courte");
  });

  it("ne confond pas longueur de manche et longueur de vêtement", () => {
    expect(effet({ id: 22, category: "hauts", name: "Chemise manches longues", sous_type: "Chemise" }).longueur).toBeNull();
    expect(effet({ id: 23, category: "hauts", name: "T-shirt manches courtes", sous_type: "T-shirt" }).longueur).toBeNull();
  });

  it("ne rend pas une pièce évaluable en volume sur la seule longueur", () => {
    const e = effet({ id: 24, category: "jupes", name: "Jupe midi", sous_type: "Jupe" });
    expect(e.confiance).toBe("faible");
    expect(e.hanches).toBe(0);
  });
});

describe("neutralité de l'inconnu", () => {
  it("renvoie une pièce non reconnue strictement neutre", () => {
    const e = effet({ id: 30, category: "hauts", name: "Haut", sous_type: "Haut" });
    expect(e).toMatchObject({ epaules: 0, taille: 0, hanches: 0, longueur: null, confiance: "inconnue", pertinent: true });
  });
});

describe("signature de look", () => {
  const pantalonLarge = piece({ id: 40, category: "pantalons", name: "Pantalon large", sous_type: "Pantalon" });
  const pullOversize = piece({ id: 41, category: "pulls_gilets", name: "Pull oversize", sous_type: "Pull" });
  const hautInconnu = piece({ id: 42, category: "hauts", name: "Haut", sous_type: "Haut" });
  const ceinture = piece({ id: 43, category: "accessoires", name: "Ceinture", sous_type: "Ceinture" });

  it("classe READY seulement quand les deux moitiés sont connues", () => {
    expect(signatureLook([pantalonLarge, pullOversize]).classe).toBe("MORPHOLOGY_READY");
    expect(signatureLook([pantalonLarge, hautInconnu]).classe).toBe("MORPHOLOGY_PARTIAL");
    expect(signatureLook([hautInconnu]).classe).toBe("MORPHOLOGY_UNKNOWN");
  });

  it("ne compte la ceinture qu'au niveau du look", () => {
    expect(effetMorphologique(ceinture).pertinent).toBe(false);
    expect(signatureLook([pantalonLarge, pullOversize]).taille).toBe(0);
    expect(signatureLook([pantalonLarge, pullOversize, ceinture]).taille).toBeGreaterThan(0);
  });

  it("ne déduit pas d'une absence de ceinture une taille indéfinie", () => {
    const robeCintree = piece({ id: 44, category: "robes", name: "Robe cintrée", sous_type: "Robe" });
    expect(signatureLook([robeCintree]).tailleConnue).toBe(true);
  });
});

describe("compensation entre pièces", () => {
  it("émerge de la signature, sans règle par paire", () => {
    const cargo = piece({ id: 50, category: "pantalons", name: "Pantalon cargo", sous_type: "Pantalon" });
    const blazer = piece({ id: 51, category: "vestes_blazers", name: "Blazer structuré", sous_type: "Blazer" });
    const hautSimple = piece({ id: 52, category: "hauts", name: "Débardeur ajusté", sous_type: "Débardeur" });

    const seul = signatureLook([cargo, hautSimple]);
    const compense = signatureLook([cargo, blazer, hautSimple]);
    expect(compense.hanches - compense.epaules).toBeLessThan(seul.hanches - seul.epaules);
  });
});

describe("score morphologique v2", () => {
  const cargo = piece({ id: 60, category: "pantalons", name: "Pantalon cargo", sous_type: "Pantalon" });
  const blazer = piece({ id: 61, category: "vestes_blazers", name: "Blazer structuré", sous_type: "Blazer" });
  const hautInconnu = piece({ id: 62, category: "hauts", name: "Haut", sous_type: "Haut" });

  it("reste strictement neutre quand le look n'est pas READY", () => {
    expect(scoreMorphoV2([cargo, hautInconnu], "f_poire")).toMatchObject({ actif: false, delta: 0 });
  });

  it("reste neutre sans morphologie déclarée", () => {
    expect(scoreMorphoV2([cargo, blazer], null)).toMatchObject({ actif: false, delta: 0 });
  });

  it("n'invente pas de contrainte pour la pomme", () => {
    const r = scoreMorphoV2([cargo, blazer], "f_pomme");
    expect(r.actif).toBe(false);
    expect(r.motif).toContain("contrainte");
  });

  it("se tait sur une morphologie qui dépend de la taille quand la taille est inconnue", () => {
    const r = scoreMorphoV2([cargo, blazer], "f_sablier");
    expect(r.actif).toBe(false);
    expect(r.motif).toContain("taille");
  });

  it("récompense un triangle inversé dont le volume est en bas", () => {
    const r = scoreMorphoV2([cargo, blazer], "f_triangle_inverse");
    expect(r.actif).toBe(true);
    expect(r.delta).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Batterie d'arbitrage (phase 5, 28/08/2026) — valide les hypothèses de modèle
// plutôt que le comportement d'une fonction isolée.
// ─────────────────────────────────────────────────────────────────────────────

describe("contraintes par intervalle — asymétrie plancher / plafond", () => {
  it("ne pénalise pas le dépassement d'un plancher", () => {
    // f_poire demande épaules ≥ 1. Deux épaules ou trois valent autant qu'une :
    // c'est exactement ce qu'une distance à une cible-point ne savait pas dire.
    expect(ecartBorne(1, { min: 1 })).toBe(0);
    expect(ecartBorne(3, { min: 1 })).toBe(0);
    expect(ecartBorne(0, { min: 1 })).toBe(1);
  });

  it("ne pénalise pas d'être sous un plafond", () => {
    expect(ecartBorne(0, { max: 1 })).toBe(0);
    expect(ecartBorne(1, { max: 1 })).toBe(0);
    expect(ecartBorne(3, { max: 1 })).toBe(2);
  });

  it("distingue enfin sablier et rectangle", () => {
    // Les cibles-point valaient 1/2/1 pour les deux : le score ne pouvait
    // mathématiquement pas les différencier. Une taille peu marquée dans une
    // tenue sans volume satisfait le sablier et pas le rectangle.
    expect(zonesRequises("f_sablier")).not.toEqual(zonesRequises("f_rectangle"));
    const sablier = ecartBorne(1, CONTRAINTES.f_sablier.taille!);
    const rectangle = ecartBorne(1, CONTRAINTES.f_rectangle.taille!);
    expect(sablier).toBe(0);
    expect(rectangle).toBeGreaterThan(0);
  });

  it("ne contraint la pomme sur aucun axe", () => {
    expect(zonesRequises("f_pomme")).toHaveLength(0);
  });
});

describe("cibles — sous, dans, au-dessus de la zone attendue", () => {
  const bas = (nom: string) => piece({ id: 70, category: "pantalons", name: nom, sous_type: "Pantalon" });
  const haut = (nom: string) => piece({ id: 71, category: "vestes_blazers", name: nom, sous_type: "Veste" });

  it("récompense un triangle inversé dont le volume est en bas, pas en haut", () => {
    // Le haut doit être ÉVALUÉ, sinon le look n'est pas READY et le score reste
    // neutre — ce qui est le comportement voulu, pas un échec.
    const hautDiscret = piece({ id: 72, category: "hauts", name: "Caraco", sous_type: "Caraco" });
    const bon = scoreMorphoV2([bas("Pantalon wide leg"), hautDiscret], "f_triangle_inverse");
    expect(bon.actif).toBe(true);
    expect(bon.delta).toBeGreaterThan(0);
  });

  it("ne récompense pas une poire dont le volume est en bas", () => {
    const mauvais = scoreMorphoV2([bas("Pantalon wide leg"), haut("Veste structurée")], "f_poire");
    expect(mauvais.actif).toBe(true);
    expect(mauvais.delta).toBeLessThan(10);
  });

  it("laisse passer un excès au-dessus d'un plancher sans le pénaliser", () => {
    const modere = scoreMorphoV2([bas("Pantalon slim"), haut("Veste structurée")], "f_poire");
    const fort = scoreMorphoV2([bas("Pantalon slim"), haut("Veste oversize structurée")], "f_poire");
    expect(modere.delta).toBe(10);
    expect(fort.delta).toBe(10);
  });
});

describe("superposition", () => {
  const tshirt = piece({ id: 80, category: "hauts", name: "T-shirt oversize", sous_type: "T-shirt" });
  const blazer = piece({ id: 81, category: "vestes_blazers", name: "Blazer structuré", sous_type: "Blazer" });
  const manteau = piece({ id: 82, category: "manteaux_exterieurs", name: "Manteau oversize", sous_type: "Manteau" });
  const pantalon = piece({ id: 83, category: "pantalons", name: "Pantalon slim", sous_type: "Pantalon" });

  it("documente la limite : les effets s'additionnent sans savoir ce qui est visible", () => {
    // Comportement ACTUEL, volontairement figé par ce test. Le modèle ne dispose
    // d'aucune donnée ouvert/fermé ; empiler des couches accroît donc l'effet
    // épaules même si le dessous n'est pas visible. Si une pondération est un
    // jour introduite, ce test doit échouer et être révisé sciemment.
    const seul = signatureLook([tshirt, pantalon]);
    const avecVeste = signatureLook([tshirt, blazer, pantalon]);
    const troisCouches = signatureLook([tshirt, blazer, manteau, pantalon]);
    expect(avecVeste.epaules).toBeGreaterThanOrEqual(seul.epaules);
    expect(troisCouches.epaules).toBeGreaterThanOrEqual(avecVeste.epaules);
  });

  it("borne l'empilement, ce qui limite mécaniquement la dérive", () => {
    // La signature est bornée à 3 : trois couches volumineuses ne produisent pas
    // un 9. C'est ce plafond qui rend l'absence de pondération supportable.
    expect(signatureLook([tshirt, blazer, manteau, pantalon]).epaules).toBeLessThanOrEqual(3);
  });
});

describe("l'ignorance ne produit jamais de pénalité", () => {
  const inconnuHaut = piece({ id: 90, category: "hauts", name: "Haut", sous_type: "Haut" });
  const inconnuBas = piece({ id: 91, category: "pantalons", name: "Pantalon", sous_type: "Pantalon" });
  const connuBas = piece({ id: 92, category: "pantalons", name: "Pantalon wide leg", sous_type: "Pantalon" });
  const connuHaut = piece({ id: 93, category: "vestes_blazers", name: "Veste structurée", sous_type: "Veste" });

  it("reste neutre quand le haut est inconnu", () => {
    for (const m of ["f_poire", "f_sablier", "f_rectangle", "f_triangle_inverse", "f_pomme"]) {
      expect(scoreMorphoV2([inconnuHaut, connuBas], m).delta, m).toBe(0);
    }
  });

  it("reste neutre quand le bas est inconnu", () => {
    for (const m of ["f_poire", "f_sablier", "f_rectangle", "f_triangle_inverse", "f_pomme"]) {
      expect(scoreMorphoV2([connuHaut, inconnuBas], m).delta, m).toBe(0);
    }
  });

  it("reste neutre quand la taille est inconnue, pour les morphologies qui en dépendent", () => {
    for (const m of ["f_sablier", "f_rectangle"]) {
      const r = scoreMorphoV2([connuHaut, connuBas], m);
      expect(r.actif, m).toBe(false);
      expect(r.delta, m).toBe(0);
    }
  });

  it("ne pénalise jamais une longueur inconnue", () => {
    const sansLongueur = piece({ id: 94, category: "pantalons", name: "Pantalon wide leg", sous_type: "Pantalon" });
    expect(effetMorphologique(sansLongueur).longueur).toBeNull();
    expect(scoreMorphoV2([connuHaut, sansLongueur], "f_triangle_inverse").delta).toBeGreaterThanOrEqual(0);
  });

  it("ne pénalise jamais un look entièrement inconnu", () => {
    for (const m of ["f_poire", "f_sablier", "f_rectangle", "f_triangle_inverse", "f_pomme"]) {
      expect(scoreMorphoV2([inconnuHaut, inconnuBas], m).delta, m).toBe(0);
    }
  });
});
