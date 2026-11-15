import { describe, expect, it } from "vitest";
import { CAPSULE_SEASONS, STRATEGIE_AVANT_COULEURS_HIERARCHISEES, STRATEGIE_PRODUCTION, computeDefaultCapsule, representativeWeatherFor } from "../capsule";
import { CATALOG } from "../catalog";
import { colorimetrieDeSaison, SAISONS_CLES } from "../colorimetrie";
import { EMPTY_PROFILE, type Profile } from "../profile";

// LES COULEURS DE LA CAPSULE (15/11/2026, arbitrage de la propriétaire) : couleur préférée d'abord, couleur de la saison colorimétrique
// ensuite. Verrou sur le catalogue de repli : la règle de production ne fait jamais reculer ni l'une ni l'autre, et ne change pas la
// taille des capsules. La mesure sur le vrai catalogue est scripts/colorimetrie-capsule.audit.ts.

const profil = (over: Partial<Profile>): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles: ["minimaliste"], ...over });
const part = (ids: { hex: string }[], hex: Set<string>) => ids.filter((p) => hex.has(p.hex)).length;

describe("couleurs de la capsule : préférées puis colorimétrie", () => {
  it("la production est la hiérarchie", () => {
    expect(STRATEGIE_PRODUCTION.colorimetrieCapsule).toBe("hierarchie");
    expect(STRATEGIE_AVANT_COULEURS_HIERARCHISEES.colorimetrieCapsule).toBeUndefined();
  });

  it("ne fait reculer ni les couleurs préférées ni la saison, à taille égale", () => {
    let prefAvant = 0, prefApres = 0, saisonAvant = 0, saisonApres = 0;
    for (const sc of SAISONS_CLES)
      for (const saison of CAPSULE_SEASONS) {
        const colorimetrie = colorimetrieDeSaison(sc, "questionnaire");
        const hexSaison = new Set([...(colorimetrie.signature ?? []), ...(colorimetrie.neutres ?? [])]);
        const preferees = CATALOG.slice(0, 3).map((it) => it.hex);
        const p = profil({ colorimetrie, paletteCouleurs: preferees });
        const w = representativeWeatherFor(saison);
        const avant = computeDefaultCapsule(p, w, [], saison, CATALOG, STRATEGIE_AVANT_COULEURS_HIERARCHISEES);
        const apres = computeDefaultCapsule(p, w, [], saison, CATALOG, STRATEGIE_PRODUCTION);
        expect(apres.length).toBe(avant.length);
        prefAvant += part(avant, new Set(preferees));
        prefApres += part(apres, new Set(preferees));
        saisonAvant += part(avant, hexSaison);
        saisonApres += part(apres, hexSaison);
      }
    expect(prefApres).toBeGreaterThanOrEqual(prefAvant);
    expect(saisonApres).toBeGreaterThanOrEqual(saisonAvant);
  });

  it("sans colorimétrie ni couleur préférée, rien ne change", () => {
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      const ids = (s: typeof STRATEGIE_PRODUCTION) => computeDefaultCapsule(profil({}), w, [], saison, CATALOG, s).map((it) => it.id);
      expect(ids(STRATEGIE_PRODUCTION)).toEqual(ids(STRATEGIE_AVANT_COULEURS_HIERARCHISEES));
    }
  });
});
