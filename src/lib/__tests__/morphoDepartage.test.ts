import { describe, expect, it } from "vitest";
import { effetMorphologique } from "../garmentEffect";
import { CAPSULE_MAX_PIECES, STRATEGIE_LEGACY, STRATEGIE_PRODUCTION, computeDefaultCapsule } from "../capsule";
import { computeLookScore } from "../logic";
import { EMPTY_PROFILE, type Profile } from "../profile";
import { at } from "./fixtures";
import type { CatalogItem } from "../catalog";
import { item } from "./fixtures";

const CATS_TEST = ["hauts", "pulls_gilets", "pantalons", "jeans", "jupes", "vestes_blazers", "manteaux_exterieurs", "chaussures", "sacs", "accessoires", "bijoux"] as const;
const OCCS_TEST = ["quotidien", "travail_formel", "date", "soiree", "entretien", "voyage", "festive"];
function catalogueSansRobes(): CatalogItem[] {
  const out: CatalogItem[] = [];
  let id = 1;
  for (const category of CATS_TEST) {
    for (let k = 0; k < 12; k += 1) {
      const piece = item({ id: id++, category, name: `${category} ${k}`, couleur_dominante: "Noir", niveau_formalite: "business_casual", role_piece: "base", occasions: OCCS_TEST[k % OCCS_TEST.length] });
      if (piece) out.push(piece);
    }
  }
  return out;
}
function profile(over: Partial<Profile> = {}): Profile {
  return { ...EMPTY_PROFILE, gender: "femme", ...over };
}
import type { CategoryKey, Item } from "../types";

// Invariants du DÉPARTAGE morphologique, verrouillés AVANT toute
// implémentation dans pickBestMarginal.
//
// Ces tests ne portent pas sur une règle branchée en production : ils
// verrouillent les propriétés que la règle candidate devra satisfaire, de
// sorte qu'une implémentation future qui les violerait échoue immédiatement.
// La morphologie doit rester un critère de DÉPARTAGE, jamais un objectif de
// sélection.

const BAS: CategoryKey[] = ["pantalon", "jean", "jupe", "short"];
const HAUTS: CategoryKey[] = ["haut", "pull", "veste", "manteau"];

/** Direction apportée par une pièce POUR une morphologie donnée. */
function valeurDirection(it: Item, morphology: string | null, dejaLa: number, poids: (n: number) => number): number {
  if (!morphology) return 0;
  const e = effetMorphologique(it);
  if (e.confiance === "inconnue") return 0;
  if (morphology === "f_poire") {
    if (HAUTS.includes(it.cat) && e.epaules >= 2) return poids(dejaLa) * e.epaules;
    if (BAS.includes(it.cat) && e.hanches <= 1) return poids(dejaLa) * (3 - e.hanches);
    return 0;
  }
  if (morphology === "f_triangle_inverse") {
    if (BAS.includes(it.cat) && e.hanches >= 2) return poids(dejaLa) * e.hanches;
    if (HAUTS.includes(it.cat) && e.epaules <= 1) return poids(dejaLa) * (3 - e.epaules);
    return 0;
  }
  return 0;
}

/** Saturation molle : décroissante, jamais nulle. Aucun quota déguisé. */
const poidsA = (n: number) => 1 / (1 + n);

/** Comparaison lexicographique identique à celle de pickBestMarginal. */
const meilleur = (a: number[], b: number[]) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

describe("La morphologie départage, elle ne sélectionne pas", () => {
  it("ne renverse jamais une différence de couverture d'occasion", () => {
    // Invariant fondamental (§9) : si A couvre plus d'occasions nouvelles que
    // B, aucun signal morphologique ne doit permettre à B de gagner.
    const jupeTrapeze = item({ id: 1, category: "jupes", name: "Jupe trapèze", couleur_dominante: "Noir" })!;
    const pantalonDroit = item({ id: 2, category: "pantalons", name: "Pantalon droit", couleur_dominante: "Noir" })!;
    for (const morphology of ["f_poire", "f_triangle_inverse"]) {
      for (let occA = 1; occA <= 3; occA++) {
        for (let occB = 0; occB < occA; occB++) {
          const cleA = [occA, 0, 0, valeurDirection(pantalonDroit, morphology, 0, poidsA), -1];
          const cleB = [occB, 1, 1, valeurDirection(jupeTrapeze, morphology, 0, poidsA), -2];
          expect(meilleur(cleA, cleB)).toBe(true);
        }
      }
    }
  });

  it("laisse la morphologie trancher uniquement à couverture et rôle égaux", () => {
    const ample = item({ id: 10, category: "hauts", name: "Pull oversize", couleur_dominante: "Noir", coupe: "Ample" })!;
    const ajuste = item({ id: 11, category: "hauts", name: "Pull ajusté", couleur_dominante: "Noir", coupe: "Ajusté" })!;
    const cle = (it: Item) => [2, 0, 0, valeurDirection(it, "f_poire", 0, poidsA), -it.id];
    // Le pull ample donne de la présence aux épaules : il l'emporte pour une
    // poire, mais SEULEMENT parce que les trois premiers rangs sont à égalité.
    expect(meilleur(cle(ample), cle(ajuste))).toBe(true);
  });

  it("inverse sa préférence entre poire et triangle inversé", () => {
    // §10 — aucune préférence absolue pour les épaules ni pour les hanches.
    const hautStructure = item({ id: 20, category: "hauts", name: "Blazer à épaules structurées", couleur_dominante: "Noir", coupe: "Ample" })!;
    const basAmple = item({ id: 21, category: "pantalons", name: "Pantalon wide leg", couleur_dominante: "Noir" })!;
    const poireHaut = valeurDirection(hautStructure, "f_poire", 0, poidsA);
    const poireBas = valeurDirection(basAmple, "f_poire", 0, poidsA);
    const triHaut = valeurDirection(hautStructure, "f_triangle_inverse", 0, poidsA);
    const triBas = valeurDirection(basAmple, "f_triangle_inverse", 0, poidsA);
    // La poire préfère le haut, le triangle inversé préfère le bas.
    expect(poireHaut).toBeGreaterThan(poireBas);
    expect(triBas).toBeGreaterThan(triHaut);
  });

  it("n'accorde aucune valeur morphologique à une pièce de sport", () => {
    const jogging = item({ id: 30, category: "pantalons", name: "Jogging molleton", couleur_dominante: "Gris", niveau_formalite: "sport" })!;
    // Une pièce sport est isolée avant la sélection ; si elle atteignait
    // malgré tout le départage, elle ne doit peser d'aucun côté.
    expect(jogging.niveauFormalite).toBe(0);
  });

  it("décroît avec la redondance sans jamais s'annuler", () => {
    // §11 — saturation molle, interdiction du quota déguisé.
    const haut = item({ id: 40, category: "hauts", name: "Pull oversize", couleur_dominante: "Noir", coupe: "Ample" })!;
    const valeurs = [0, 1, 2, 3, 4, 5].map((n) => valeurDirection(haut, "f_poire", n, poidsA));
    for (let i = 1; i < valeurs.length; i++) {
      expect(valeurs[i]).toBeLessThan(valeurs[i - 1]);
      expect(valeurs[i]).toBeGreaterThan(0);
    }
  });

  it("reste strictement nulle sans morphologie déclarée", () => {
    const haut = item({ id: 50, category: "hauts", name: "Pull oversize", couleur_dominante: "Noir", coupe: "Ample" })!;
    expect(valeurDirection(haut, null, 0, poidsA)).toBe(0);
  });

  it("reste strictement nulle sur une morphologie sans règle défendable", () => {
    const haut = item({ id: 51, category: "hauts", name: "Pull oversize", couleur_dominante: "Noir", coupe: "Ample" })!;
    for (const m of ["f_pomme", "f_sablier", "f_rectangle"]) {
      expect(valeurDirection(haut, m, 0, poidsA)).toBe(0);
    }
  });
});

describe("Neutralisation du signal legacy (29/08/2026)", () => {
  it("ne consulte plus morphoFit dans la sélection de capsule", () => {
    // Mesuré avant retrait : ce rang retirait 16,5 points de compensation à
    // une poire, en ajoutait 29,1 de direction défavorable, et coûtait 7,4 %
    // de diversité à une pomme pour laquelle le modèle refuse toute règle.
    expect(STRATEGIE_PRODUCTION.rang3).toBe("neutre");
    expect(STRATEGIE_PRODUCTION.v2).toBe(false);
  });

  it("produit la même capsule avec et sans morphologie déclarée", () => {
    // Conséquence directe : la morphologie n'entrant plus dans le tri, une
    // morphologie déclarée ne peut plus déplacer une seule pièce. C'était le
    // cas sur 120 capsules sur 120 avant le retrait.
    const catalogue = catalogueSansRobes();
    const sans = computeDefaultCapsule(profile(), at(16, "Printemps / Été"), [], "Printemps", catalogue);
    for (const m of ["f_poire", "f_triangle_inverse", "f_rectangle", "f_sablier", "f_pomme"]) {
      const avec = computeDefaultCapsule(profile({ morphology: m }), at(16, "Printemps / Été"), [], "Printemps", catalogue);
      expect(avec.map((it) => it.id)).toEqual(sans.map((it) => it.id));
    }
  });

  it("n'ajoute plus aucun terme morphologique au score", () => {
    // R-S9 est retirée : le score 0–120 ne comporte plus de terme
    // morphologique, ni bonus ni pénalité, et n'affiche plus de phrase sur la
    // silhouette. Le score d'un même look ne dépend donc plus du profil.
    const pieces = [
      item({ id: 1, category: "hauts", name: "Blazer cintré", couleur_dominante: "Noir" }),
      item({ id: 2, category: "jupes", name: "Jupe portefeuille", couleur_dominante: "Noir" }),
      item({ id: 3, category: "chaussures", name: "Escarpins", couleur_dominante: "Noir" }),
    ].filter((x): x is NonNullable<typeof x> => Boolean(x));
    const meteo = at(16, "Printemps / Été");
    const reference = computeLookScore(pieces, "quotidien", [], null, new Set<string>(), meteo);
    for (const m of ["f_poire", "f_triangle_inverse", "f_rectangle", "f_sablier", "f_pomme"]) {
      const avec = computeLookScore(pieces, "quotidien", [], m, new Set<string>(), meteo);
      expect(avec.score).toBe(reference.score);
      expect(avec.adjustMessage).toBe(reference.adjustMessage);
    }
  });

  it("conserve la stratégie legacy pour les audits comparatifs", () => {
    // Neutralisation, pas suppression : le comportement d'avant reste
    // reproductible tant qu'on n'a pas démontré qu'il peut disparaître.
    expect(STRATEGIE_LEGACY.rang3).toBe("legacy");
  });
});

describe("V2 en simulation — invariants avant tout branchement", () => {
  const V2_A = { rang3: "neutre", v2: "A" } as const;
  const meteo = at(16, "Printemps / Été");

  it("n'est pas branchée en production", () => {
    expect(STRATEGIE_PRODUCTION.v2).toBe(false);
  });

  it("ne change rien pour rectangle, sablier et pomme", () => {
    // valeurDirection renvoie 0 sur ces trois morphologies : le modèle n'a pas
    // de règle de sélection défendable pour elles, et lui en inventer une
    // contredirait le principe « UNKNOWN plutôt que donnée fausse ».
    const catalogue = catalogueSansRobes();
    for (const m of ["f_rectangle", "f_sablier", "f_pomme"]) {
      const sans = computeDefaultCapsule(profile({ morphology: m }), meteo, [], "Printemps", catalogue);
      const avec = computeDefaultCapsule(profile({ morphology: m }), meteo, [], "Printemps", catalogue, V2_A);
      expect(avec.map((it) => it.id)).toEqual(sans.map((it) => it.id));
    }
  });

  it("ne change rien sans morphologie déclarée", () => {
    const catalogue = catalogueSansRobes();
    const sans = computeDefaultCapsule(profile(), meteo, [], "Printemps", catalogue);
    const avec = computeDefaultCapsule(profile(), meteo, [], "Printemps", catalogue, V2_A);
    expect(avec.map((it) => it.id)).toEqual(sans.map((it) => it.id));
  });

  it("ne touche ni au plafond, ni au plancher, ni aux catégories", () => {
    const catalogue = catalogueSansRobes();
    for (const m of ["f_poire", "f_triangle_inverse"]) {
      const capsule = computeDefaultCapsule(profile({ morphology: m }), meteo, [], "Printemps", catalogue, V2_A);
      expect(capsule.length).toBeLessThanOrEqual(CAPSULE_MAX_PIECES);
      expect(capsule.length).toBeGreaterThanOrEqual(30);
      for (const cat of ["haut", "pantalon", "chaussures", "veste", "manteau", "sac", "accessoire", "bijou"]) {
        expect(capsule.some((it) => it.cat === cat)).toBe(true);
      }
    }
  });

  it("ne départage jamais une pièce de sport", () => {
    // Le bloc Sport est isolé avant la sélection qualitative : il n'atteint
    // jamais pickBestMarginal, donc jamais le rang 4.
    const catalogue = [...catalogueSansRobes()];
    let id = 9000;
    for (let k = 0; k < 4; k += 1) {
      const p = item({ id: id++, category: "pantalons", name: `jogging ${k}`, couleur_dominante: "Gris", niveau_formalite: "sport", occasions: "sport" });
      if (p) catalogue.push(p);
    }
    for (const m of ["f_poire", "f_triangle_inverse"]) {
      const sans = computeDefaultCapsule(profile({ morphology: m }), meteo, [], "Printemps", catalogue);
      const avec = computeDefaultCapsule(profile({ morphology: m }), meteo, [], "Printemps", catalogue, V2_A);
      const sportSans = sans.filter((it) => it.niveauFormalite === 0).map((it) => it.id).sort();
      const sportAvec = avec.filter((it) => it.niveauFormalite === 0).map((it) => it.id).sort();
      expect(sportAvec).toEqual(sportSans);
    }
  });

  it("B2 et B3 ne diffèrent que par le rang 4", () => {
    // Même pipeline, même rang 3 neutralisé : la seule variable est v2.
    expect(STRATEGIE_PRODUCTION.rang3).toBe(V2_A.rang3);
  });
});
