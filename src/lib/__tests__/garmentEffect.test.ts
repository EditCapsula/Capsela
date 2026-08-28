import { describe, expect, it } from "vitest";
import { effetMorphologique, scoreMorphoV2, signatureLook } from "../garmentEffect";
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

  it("n'invente pas de cible pour la pomme", () => {
    const r = scoreMorphoV2([cargo, blazer], "f_pomme");
    expect(r.actif).toBe(false);
    expect(r.motif).toContain("cible");
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
