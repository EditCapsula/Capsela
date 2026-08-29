import { describe, expect, it } from "vitest";
import { effetMorphologique } from "../garmentEffect";
import { item } from "./fixtures";
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
