import { describe, expect, it } from "vitest";
import { GLYPHES_OCCASION, GLYPHES_SOUS_CHOIX } from "../../components/GlyphesOccasion";
import { OCCASIONS } from "../data";
import { explainRecommendation, outfitMoodPhrase } from "../logic";
import { DATE_CONTEXTS } from "../data";
import type { OccasionKey } from "../types";

/**
 * Deux règles issues du 23/09/2026, qu'aucun type ne protège.
 *
 * La seconde garde les tables de glyphes : le Record typé empêche d'oublier
 * une clé, mais pas d'en laisser une qui n'est plus proposée.
 *
 * La première est la plus importante : outfitMoodPhrase et
 * explainRecommendation se ressemblent assez pour qu'on soit tenté de les
 * fusionner un jour. Elles ne disent PAS la même chose — l'une tait la
 * température parce que l'écran Tenue l'affiche juste au-dessus, l'autre la
 * porte parce que sur l'accueil elle est le seul endroit qui la donne. Les
 * confondre effacerait la météo de l'accueil sans erreur de compilation.
 */
const TEMPS = [-5, 0, 8, 12, 19, 20, 26, 27, 35];

describe("phrase d'ambiance", () => {
  it("ne mentionne jamais la température sur l'écran Tenue", () => {
    for (const t of TEMPS) {
      const phrase = outfitMoodPhrase("travail_formel", "Présentiel", "Verre", t);
      expect(phrase, `à ${t}°`).not.toMatch(/\d/);
      expect(phrase, `à ${t}°`).not.toContain("°");
    }
  });

  it("la conserve sur l'accueil, où elle est la seule source", () => {
    for (const t of TEMPS) {
      expect(explainRecommendation("travail_formel", "Présentiel", "Verre", t)).toContain("°");
    }
  });

  it("retombe sur une phrase d'occasion quand la météo est inconnue", () => {
    for (const temp of [null, undefined, NaN]) {
      const phrase = outfitMoodPhrase("soiree", "Présentiel", "Verre", temp);
      expect(phrase).toMatch(/^Pensée pour .+\.$/);
    }
  });
});

describe("glyphes d'occasion", () => {
  it("couvre chaque occasion réellement proposée", () => {
    for (const [cle, libelle] of OCCASIONS) {
      expect(GLYPHES_OCCASION[cle as Exclude<OccasionKey, "all">], libelle).toBeTruthy();
    }
  });

  it("ne contient pas d'occasion inconnue de la table OCCASIONS", () => {
    const proposees = new Set(OCCASIONS.map(([k]) => k));
    for (const cle of Object.keys(GLYPHES_OCCASION)) {
      expect(proposees.has(cle as OccasionKey), `${cle} dessinée mais jamais proposée`).toBe(true);
    }
  });

  it("couvre chaque sous-choix des trois familles", () => {
    const valeurs = [
      "Présentiel", "Télétravail",
      ...DATE_CONTEXTS.map(([v]) => v),
      "Court trajet", "Longue distance",
    ] as const;
    for (const v of valeurs) {
      expect(GLYPHES_SOUS_CHOIX[v], v).toBeTruthy();
    }
    // Aucun sous-choix dessiné qui n'existerait plus dans les types.
    expect(Object.keys(GLYPHES_SOUS_CHOIX).sort()).toEqual([...valeurs].sort());
  });
});
