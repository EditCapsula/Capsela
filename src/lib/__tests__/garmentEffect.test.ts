import { describe, expect, it } from "vitest";
import { effetMorphologique, signatureLook } from "../garmentEffect";
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
    const pantalon = effet({ id: 1, category: "pantalons", name: "Pantalon", sous_type: "Pantalon large" });
    expect(pantalon).toMatchObject({ hanches: 3, epaules: 0 });

    const pull = effet({ id: 2, category: "pulls_gilets", name: "Pull", sous_type: "Pull oversize" });
    expect(pull).toMatchObject({ epaules: 3, hanches: 0 });
  });

  it("répartit le volume d'une robe sur les trois zones plutôt que de le concentrer", () => {
    const robe = effet({ id: 3, category: "robes", name: "Robe", sous_type: "Robe large" });
    expect(robe.epaules).toBeLessThan(3);
    expect(robe.hanches).toBeLessThan(3);
  });

  it("écarte les pièces qui ne modifient pas la silhouette", () => {
    for (const [category, sous_type] of [
      ["accessoires", "Bonnet"], ["sacs", "Cabas"], ["bijoux", "Collier"], ["chaussures", "Bottines"],
    ] as const) {
      const e = effet({ id: 4, category, name: "x", sous_type });
      expect(e.pertinent, `${category}`).toBe(false);
    }
  });
});

describe("intensité", () => {
  it("préfère la colonne coupe au vocabulaire du sous-type", () => {
    const e = effet({ id: 5, category: "pantalons", name: "Pantalon", sous_type: "Pantalon cigarette", coupe: "Ample" });
    expect(e).toMatchObject({ hanches: 3, confiance: "haute" });
  });

  it("gradue le volume du plus ample au plus près du corps", () => {
    const large = effet({ id: 6, category: "pantalons", name: "P", sous_type: "Pantalon palazzo" }).hanches;
    const cargo = effet({ id: 7, category: "pantalons", name: "P", sous_type: "Pantalon cargo" }).hanches;
    const droit = effet({ id: 8, category: "pantalons", name: "P", sous_type: "Pantalon droit" }).hanches;
    const cigarette = effet({ id: 9, category: "pantalons", name: "P", sous_type: "Pantalon cigarette" }).hanches;
    expect(large).toBeGreaterThan(cargo);
    expect(cargo).toBeGreaterThan(droit);
    expect(droit).toBeGreaterThan(cigarette);
  });

  it("renforce les épaules sur une pièce structurée", () => {
    const simple = effet({ id: 10, category: "vestes_blazers", name: "Blazer", sous_type: "Blazer droit" });
    const structure = effet({ id: 11, category: "vestes_blazers", name: "Blazer", sous_type: "Blazer structuré droit" });
    expect(structure.epaules).toBeGreaterThan(simple.epaules);
  });
});

describe("donnée inconnue", () => {
  it("reste strictement neutre, jamais négative", () => {
    const e = effet({ id: 12, category: "hauts", name: "Top", sous_type: "Top" });
    expect(e).toMatchObject({ pertinent: true, epaules: 0, taille: 0, hanches: 0, confiance: "inconnue" });
  });

  it("ne compte pas une pièce inconnue comme évaluée dans la signature", () => {
    const sig = signatureLook([
      { item: piece({ id: 13, category: "hauts", name: "Top", sous_type: "Top" }), sousType: "Top" },
    ]);
    expect(sig.piecesEvaluees).toBe(0);
    expect(sig).toMatchObject({ epaules: 0, taille: 0, hanches: 0 });
  });
});

describe("taille", () => {
  it("détecte la définition portée par le vêtement lui-même", () => {
    const e = effet({ id: 14, category: "robes", name: "Robe", sous_type: "Robe portefeuille" });
    expect(e.taille).toBe(3);
  });

  it("ajoute la ceinture au niveau du look, jamais à l'article", () => {
    const jean = { item: piece({ id: 15, category: "jeans", name: "Jean", sous_type: "Jean droit" }), sousType: "Jean droit" };
    const ceinture = { item: piece({ id: 16, category: "accessoires", name: "Ceinture", sous_type: "Ceinture" }), sousType: "Ceinture" };
    expect(signatureLook([jean]).taille).toBe(0);
    expect(signatureLook([jean, ceinture]).taille).toBe(2);
    // La ceinture reste sans effet morphologique propre.
    expect(effetMorphologique(ceinture.item, "Ceinture").pertinent).toBe(false);
  });
});

describe("compensation entre pièces", () => {
  it("rééquilibre un bas volumineux par un haut structurant", () => {
    const cargo = { item: piece({ id: 17, category: "pantalons", name: "Cargo", sous_type: "Pantalon cargo" }), sousType: "Pantalon cargo" };
    const blazer = { item: piece({ id: 18, category: "vestes_blazers", name: "Blazer", sous_type: "Blazer structuré" }), sousType: "Blazer structuré" };

    const seul = signatureLook([cargo]);
    const avecBlazer = signatureLook([cargo, blazer]);

    // Le cargo seul creuse l'écart bas/haut ; le blazer le referme, sans
    // qu'aucune règle "cargo + blazer" n'existe.
    expect(seul.hanches - seul.epaules).toBeGreaterThan(0);
    expect(avecBlazer.hanches - avecBlazer.epaules).toBeLessThan(seul.hanches - seul.epaules);
  });
});
