import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyStateCopy } from "../emptyStateCopy";
import type { OutfitFailureReason } from "../types";

/**
 * ÉTATS VIDES — 31/08/2026.
 *
 * Les trois états vides disaient que le vestiaire était insuffisant, ce que la
 * règle éditoriale de Capsela interdit. Ces tests verrouillent le nouveau
 * wording et, surtout, le fait que les CONDITIONS de déclenchement n'ont pas
 * bougé : seul le texte a changé.
 *
 * Même architecture que outfitBadges : fonction pure testée directement, plus
 * des tests statiques sur la source du composant. Ni jsdom ni testing-library
 * (cf. vitest.config.mts, environnement node).
 */

const ECRAN = join(__dirname, "..", "..", "components", "screens", "TenuesScreen.tsx");
const source = () => readFileSync(ECRAN, "utf8");
/** Le JSX effectivement rendu, commentaires d'explication retirés. */
const rendu = () => source().replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");

const RAISONS: OutfitFailureReason[] = ["formality_gap", "missing_required_category", "no_match"];
const INTERDITS = [
  "Dressing insuffisant",
  "Capsule insuffisante",
  "insuffisant",
  "insuffisante",
  "suffisamment habillée",
  "Meilleure alternative",
];

describe("emptyStateCopy — aucun jugement sur le vestiaire", () => {
  it("aucun des trois états n'emploie un vocabulaire interdit", () => {
    for (const raison of RAISONS) {
      for (const label of ["ton dressing", "cette capsule"]) {
        const { title, body } = emptyStateCopy(raison, label);
        for (const interdit of INTERDITS) {
          expect(`${title} ${body}`).not.toContain(interdit);
        }
        // Jamais un manque attribué à l'utilisatrice.
        expect(`${title} ${body}`).not.toMatch(/tu n'as pas|il te manque|pas assez de/i);
      }
    }
  });

  it("les trois états nomment la source telle que l'écran la calcule", () => {
    for (const raison of RAISONS) {
      expect(emptyStateCopy(raison, "ton dressing").body).toContain("ton dressing");
      expect(emptyStateCopy(raison, "cette capsule").body).toContain("cette capsule");
    }
  });

  it("formality_gap : l'indisponibilité est bornée à l'occasion", () => {
    const c = emptyStateCopy("formality_gap", "cette capsule");
    expect(c.title).toBe("Une tenue plus habillée n'est pas disponible");
    expect(c.body).toBe(
      "Pour cette occasion, aucune tenue ne correspond au niveau de formalité demandé avec les pièces de cette capsule."
    );
    expect(c.ctaLabel).toBe("Ajouter une pièce plus habillée →");
  });

  // Le moteur teste `(haut && bas) || une-pièce` sur le pool BRUT : plusieurs
  // catégories peuvent manquer à la fois, et aucun filtre d'occasion n'entre
  // dans ce calcul. Le texte ne doit donc ni dire « une catégorie », ni
  // laisser croire qu'un changement d'occasion débloquerait l'état.
  it("missing_required_category : ni « une catégorie », ni une portée limitée à l'occasion", () => {
    const c = emptyStateCopy("missing_required_category", "ton dressing");
    expect(c.title).toBe("Une pièce nécessaire n'est pas disponible");
    expect(c.body).toBe(
      "Une pièce nécessaire n'est pas disponible dans ton dressing pour composer une tenue, quelle que soit l'occasion."
    );
    expect(c.body).not.toContain("une catégorie");
    expect(c.body).not.toMatch(/^Pour cette occasion/);
    expect(c.body).toContain("quelle que soit l'occasion");
  });

  it("no_match : décrit la génération, avec un titre valable pour les deux sources", () => {
    const c = emptyStateCopy("no_match", "cette capsule");
    expect(c.title).toBe("Aucune tenue ne correspond à cette occasion");
    expect(c.body).toBe(
      "On ne trouve pas encore de combinaison adaptée à cette occasion avec les pièces de cette capsule."
    );
    // Seul état sans action proposée — inchangé.
    expect(c.ctaLabel).toBeNull();
    expect(emptyStateCopy("no_match", "ton dressing").title).toBe(c.title);
  });
});

describe("états vides — l'écran consomme le wording partagé sans le contourner", () => {
  it("les anciens libellés ne sont plus rendus", () => {
    const jsx = rendu();
    for (const interdit of ["Dressing insuffisant", "Capsule insuffisante", "suffisamment habillée"]) {
      expect(jsx).not.toContain(interdit);
    }
    expect(jsx).not.toContain("Il manque au moins un haut et un bas");
  });

  it("le composant délègue les textes à emptyStateCopy", () => {
    const s = source();
    expect(s).toMatch(/import \{ emptyStateCopy \} from "@\/lib\/emptyStateCopy"/);
    expect(s).toContain("emptyStateCopy(state.outfitFailureReason ?? \"no_match\", sourceLabel)");
  });

  // NON-RÉGRESSION — la condition de déclenchement reste `noCompleteOutfit`,
  // et la raison vient du moteur, jamais recalculée dans l'écran.
  it("les conditions d'affichage des états vides n'ont pas changé", () => {
    const s = source();
    expect(s).toContain("const emptyStateBase = !noCompleteOutfit");
    expect(s).toContain("state.outfitFailureReason");
    // Aucune règle par occasion n'a été introduite dans cette branche.
    const bloc = s.slice(s.indexOf("const emptyStateBase"), s.indexOf("const recommendationText"));
    expect(bloc).not.toMatch(/state\.occasion/);
  });

  it("aucun libellé de badge concurrent n'est réintroduit", () => {
    expect(rendu()).not.toMatch(/>\s*Alternative\s*</);
  });
});
