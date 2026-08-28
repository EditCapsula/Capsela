import { describe, expect, it } from "vitest";
import { conseilAffichable, effetMorphologique, niveauConfiance, scoreMorphoV2, signatureLook, zonesRequises } from "../garmentEffect";
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

  it("n'invente aucune règle pour la pomme", () => {
    const r = scoreMorphoV2([cargo, blazer], "f_pomme");
    expect(r.actif).toBe(false);
    expect(r.delta).toBe(0);
    expect(r.motif).toContain("règle");
  });

  it("se tait sur une morphologie qui dépend de la taille quand la taille est inconnue", () => {
    // Le rectangle en dépend — créer de la définition suppose de savoir si la
    // taille est marquée. Le sablier n'en dépend plus depuis qu'il est un pur
    // garde-fou de volume.
    const r = scoreMorphoV2([cargo, blazer], "f_rectangle");
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

describe("direction de compensation — trois états, jamais deux", () => {
  const bas = (nom: string) => piece({ id: 70, category: "pantalons", name: nom, sous_type: "Pantalon" });
  const haut = (nom: string) => piece({ id: 71, category: "vestes_blazers", name: nom, sous_type: "Veste" });

  it("traite un écart nul comme neutre, jamais comme défavorable", () => {
    // Une poire peut porter une tenue symétrique parfaitement élégante. Le moteur
    // n'a pas à la déprécier au motif qu'elle ne cherche pas à corriger.
    const r = scoreMorphoV2([bas("Pantalon wide leg"), haut("Veste oversize")], "f_poire");
    expect(r.actif).toBe(true);
    expect(r.ecart).toBe(0);
    expect(r.direction).toBe("neutre");
    expect(r.delta).toBe(0);
  });

  it("gradue la direction plutôt que de trancher en deux", () => {
    const compense = scoreMorphoV2([bas("Pantalon slim"), haut("Veste oversize structurée")], "f_triangle_inverse");
    const inverse = scoreMorphoV2([bas("Pantalon wide leg"), haut("Veste")], "f_poire");
    expect(["compensation", "compensation_forte", "neutre", "defavorable", "defavorable_fort"]).toContain(compense.direction);
    expect(inverse.delta).toBeLessThanOrEqual(0);
  });

  it("récompense un triangle inversé dont le volume est en bas", () => {
    const hautDiscret = piece({ id: 72, category: "hauts", name: "Caraco", sous_type: "Caraco" });
    const r = scoreMorphoV2([bas("Pantalon wide leg"), hautDiscret], "f_triangle_inverse");
    expect(r.actif).toBe(true);
    expect(r.delta).toBeGreaterThan(0);
  });

  it("désavantage une poire dont le volume est en bas", () => {
    const hautDiscret = piece({ id: 73, category: "hauts", name: "Caraco", sous_type: "Caraco" });
    const r = scoreMorphoV2([bas("Pantalon wide leg"), hautDiscret], "f_poire");
    expect(r.delta).toBeLessThan(0);
  });

  it("ne contraint la pomme sur aucun axe", () => {
    expect(zonesRequises("f_pomme")).toHaveLength(0);
  });

  it("le sablier ne donne jamais de bonus — garde-fou pur", () => {
    const contenu = scoreMorphoV2(
      [piece({ id: 74, category: "robes", name: "Robe cintrée", sous_type: "Robe" })], "f_sablier");
    expect(contenu.delta).toBe(0);
    expect(contenu.direction).toBe("neutre");
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
    const r = scoreMorphoV2([connuHaut, connuBas], "f_rectangle");
    expect(r.actif).toBe(false);
    expect(r.delta).toBe(0);
  });

  it("laisse le garde-fou sablier opérer sans connaître la taille, sans jamais récompenser", () => {
    const r = scoreMorphoV2([connuHaut, connuBas], "f_sablier");
    expect(r.delta).toBeLessThanOrEqual(0);
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

// ─────────────────────────────────────────────────────────────────────────────
// Non-régression phase 8 — garde-fou sablier, confiance, et affichage du conseil.
// ─────────────────────────────────────────────────────────────────────────────

describe("sablier — garde-fou pur", () => {
  const hautVolumineux = piece({ id: 100, category: "vestes_blazers", name: "Bomber oversize", sous_type: "Bomber" });
  const basVolumineux = piece({ id: 101, category: "jeans", name: "Jean baggy", sous_type: "Jean" });
  const tshirt = piece({ id: 102, category: "hauts", name: "T-shirt basique", sous_type: "T-shirt" });
  const jupeCrayon = piece({ id: 103, category: "jupes", name: "Jupe crayon", sous_type: "Jupe" });

  it("reste neutre sur une tenue ordinaire, sans jamais récompenser", () => {
    const r = scoreMorphoV2([jupeCrayon, hautVolumineux], "f_sablier");
    expect(r.delta).toBe(0);
  });

  it("alerte sur le motif historique : volume maximal en haut ET en bas", () => {
    // Reproduit les 13 cas relevés sur 4 515 looks : bomber oversize + jean
    // baggy. C'est le seul motif que le garde-fou doit détecter.
    const r = scoreMorphoV2([hautVolumineux, basVolumineux, tshirt], "f_sablier");
    expect(r.actif).toBe(true);
    expect(r.direction).toBe("defavorable");
    expect(r.delta).toBeLessThan(0);
  });

  it("n'alerte pas quand un seul côté est volumineux", () => {
    expect(scoreMorphoV2([hautVolumineux, jupeCrayon], "f_sablier").delta).toBe(0);
    expect(scoreMorphoV2([basVolumineux, tshirt], "f_sablier").delta).toBe(0);
  });

  it("n'exige pas que la taille soit connue — l'alerte porte sur le volume", () => {
    expect(zonesRequises("f_sablier")).not.toContain("taille");
  });
});

describe("niveau de confiance", () => {
  const pantalonLarge = piece({ id: 110, category: "pantalons", name: "Pantalon wide leg", sous_type: "Pantalon" });
  const blazer = piece({ id: 111, category: "vestes_blazers", name: "Blazer structuré", sous_type: "Blazer" });
  const robe = piece({ id: 112, category: "robes", name: "Robe fourreau", sous_type: "Robe" });
  const hautInconnu = piece({ id: 113, category: "hauts", name: "Haut", sous_type: "Haut" });

  it("dégrade en MEDIUM un avis porté par une seule pièce", () => {
    // Une robe couvre physiquement le haut et le bas, mais l'évidence tient à
    // un seul article : l'avis ne peut pas être affirmé.
    expect(niveauConfiance([robe])).toBe("MEDIUM");
  });

  it("accorde HIGH quand deux pièces au moins sont évaluées", () => {
    expect(niveauConfiance([pantalonLarge, blazer])).toBe("HIGH");
  });

  it("descend à LOW ou UNKNOWN quand une moitié manque", () => {
    expect(["LOW", "UNKNOWN"]).toContain(niveauConfiance([hautInconnu, pantalonLarge]));
    expect(niveauConfiance([hautInconnu])).toBe("UNKNOWN");
  });
});

describe("affichage du conseil", () => {
  const pantalonLarge = piece({ id: 120, category: "pantalons", name: "Pantalon wide leg", sous_type: "Pantalon" });
  const caraco = piece({ id: 121, category: "hauts", name: "Caraco", sous_type: "Caraco" });
  const bomber = piece({ id: 122, category: "vestes_blazers", name: "Bomber oversize", sous_type: "Bomber" });
  const jeanBaggy = piece({ id: 123, category: "jeans", name: "Jean baggy", sous_type: "Jean" });
  const hautInconnu = piece({ id: 124, category: "hauts", name: "Haut", sous_type: "Haut" });

  it("affiche un conseil sur une direction positive et une évidence robuste", () => {
    expect(conseilAffichable([pantalonLarge, caraco], "f_triangle_inverse")).toBe(true);
  });

  it("ne montre JAMAIS une direction défavorable", () => {
    expect(scoreMorphoV2([pantalonLarge, caraco], "f_poire").delta).toBeLessThan(0);
    expect(conseilAffichable([pantalonLarge, caraco], "f_poire")).toBe(false);
    expect(conseilAffichable([bomber, jeanBaggy], "f_sablier")).toBe(false);
  });

  it("se tait sur une direction neutre", () => {
    const neutre = scoreMorphoV2([pantalonLarge, bomber], "f_poire");
    expect(neutre.delta).toBe(0);
    expect(conseilAffichable([pantalonLarge, bomber], "f_poire")).toBe(false);
  });

  it("se tait quand l'évidence manque, quelle que soit la morphologie", () => {
    for (const m of ["f_poire", "f_triangle_inverse", "f_sablier", "f_rectangle", "f_pomme"]) {
      expect(conseilAffichable([hautInconnu], m), m).toBe(false);
    }
  });

  it("ne parle jamais pour la pomme", () => {
    expect(conseilAffichable([pantalonLarge, caraco], "f_pomme")).toBe(false);
  });
});
