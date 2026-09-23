import { describe, expect, it } from "vitest";
import { OCCASIONS, OCCASION_ICONS, SOUS_CHOIX_ICONS } from "../data";
import { explainRecommendation, outfitMoodPhrase } from "../logic";
import { DATE_CONTEXTS } from "../data";
import type { OccasionKey } from "../types";

/**
 * Deux règles issues du 23/09/2026, qu'aucun type ne protège.
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

describe("icônes d'occasion", () => {
  it("couvre chaque occasion réellement proposée", () => {
    for (const [cle, libelle] of OCCASIONS) {
      const icone = OCCASION_ICONS[cle as Exclude<OccasionKey, "all">];
      expect(icone, libelle).toBeTruthy();
      // Le carré que ces icônes remplacent : jamais réintroduit par recopie.
      expect(icone, libelle).not.toBe("❑");
    }
  });

  it("n'attribue pas deux fois la même icône à deux occasions", () => {
    const vues = OCCASIONS.map(([k]) => OCCASION_ICONS[k as Exclude<OccasionKey, "all">]);
    expect(new Set(vues).size, vues.join(" ")).toBe(vues.length);
  });

  it("couvre chaque sous-choix des trois familles", () => {
    const valeurs = [
      "Présentiel", "Télétravail",
      ...DATE_CONTEXTS.map(([v]) => v),
      "Court trajet", "Longue distance",
    ] as const;
    for (const v of valeurs) {
      expect(SOUS_CHOIX_ICONS[v], v).toBeTruthy();
      expect(SOUS_CHOIX_ICONS[v], v).not.toBe("❑");
    }
  });
});
