import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BADGE_RECOMMANDE, BADGE_REGISTRE, outfitBadges } from "../outfitBadges";
import { computeLookScore } from "../logic";

/**
 * BADGES D'UNE TENUE — 31/08/2026.
 *
 * TenuesScreen rendait « Recommandé » et le badge de repli mutuellement
 * exclusifs : une tenue repliée ne pouvait jamais afficher « Recommandé »,
 * quel que soit son score. Les deux répondent pourtant à deux questions
 * différentes — qualité du look d'un côté, registre de formalité de l'autre.
 *
 * Ces tests verrouillent l'indépendance des deux axes. Ils portent sur une
 * fonction pure plutôt que sur le rendu React : la suite de ce dépôt tourne en
 * environnement `node` sans jsdom ni testing-library (cf. vitest.config.mts),
 * et y brancher un moteur de rendu pour quatre assertions booléennes
 * élargirait le périmètre bien au-delà de ce chantier. La décision d'affichage
 * a donc été SORTIE du composant vers `outfitBadges`, où elle est testable
 * telle quelle ; le composant se contente de rendre la liste retournée. Les
 * deux tests statiques en fin de fichier vérifient qu'il la rend bien, et
 * qu'aucun libellé n'est réintroduit en dur à côté.
 */

const ECRAN = join(__dirname, "..", "..", "components", "screens", "TenuesScreen.tsx");
const source = () => readFileSync(ECRAN, "utf8");

describe("outfitBadges — les deux axes sont indépendants", () => {
  // Cas A — bonne tenue, aucun repli.
  it("score >= 80 sans repli : « Recommandé » seul", () => {
    expect(outfitBadges({ scoreBadge: "recommande", formalityDowngraded: false, noCompleteOutfit: false })).toEqual([
      "recommande",
    ]);
  });

  // Cas B — tenue moyenne, aucun repli.
  it("score < 80 sans repli : aucun badge", () => {
    expect(outfitBadges({ scoreBadge: "neutre", formalityDowngraded: false, noCompleteOutfit: false })).toEqual([]);
    expect(outfitBadges({ scoreBadge: "ajuster", formalityDowngraded: false, noCompleteOutfit: false })).toEqual([]);
  });

  // Cas C — le cas que l'exclusivité rendait impossible, et que l'audit
  // `score-repli` a mesuré sur 36 cellules repliées sur 36.
  it("score >= 80 avec repli : « Recommandé » ET le registre, dans cet ordre", () => {
    expect(outfitBadges({ scoreBadge: "recommande", formalityDowngraded: true, noCompleteOutfit: false })).toEqual([
      "recommande",
      "registre",
    ]);
  });

  // Cas D — repli sans la qualité : le registre seul, jamais « Recommandé ».
  it("score < 80 avec repli : le registre seul", () => {
    expect(outfitBadges({ scoreBadge: "neutre", formalityDowngraded: true, noCompleteOutfit: false })).toEqual([
      "registre",
    ]);
    expect(outfitBadges({ scoreBadge: "ajuster", formalityDowngraded: true, noCompleteOutfit: false })).toEqual([
      "registre",
    ]);
  });

  it("état vide : aucun badge, il n'y a pas de tenue à qualifier", () => {
    expect(outfitBadges({ scoreBadge: "recommande", formalityDowngraded: true, noCompleteOutfit: true })).toEqual([]);
  });

  // Cas E — le repli ne peut pas déplacer le score. La garantie n'est pas
  // statistique mais STRUCTURELLE : `formalityDowngraded` n'est pas un
  // paramètre de `computeLookScore`, donc aucune valeur qu'il prend ne peut
  // atteindre le calcul. Le test le vérifie sur la signature plutôt que de
  // comparer deux appels identiques, ce qui ne prouverait rien.
  it("le repli n'entre pas dans le calcul du score", () => {
    const logique = readFileSync(join(__dirname, "..", "logic.ts"), "utf8");
    const signature = logique.slice(logique.indexOf("export function computeLookScore("));
    const corps = signature.slice(0, signature.indexOf("): LookScore {"));
    expect(corps).not.toMatch(/formality|Downgraded|resolvedFormality|requestedFormality/i);
    // Et la sortie du score ne transporte aucun champ de formalité.
    const decl = logique.slice(logique.indexOf("export interface LookScore {"));
    expect(decl.slice(0, decl.indexOf("\n}"))).not.toMatch(/formality/i);
    expect(typeof computeLookScore).toBe("function");
  });
});

describe("libellés — l'écran rend la décision partagée, sans la contourner", () => {
  // Cas F — l'ancien libellé ne doit plus exister nulle part dans l'écran.
  // Il n'apparaît plus que dans les commentaires expliquant son retrait :
  // le test ne regarde donc que le JSX effectivement rendu.
  it("« Meilleure alternative » n'est plus rendu", () => {
    const rendu = source().replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rendu).not.toContain("Meilleure alternative");
  });

  // Cas G — le nouveau wording est rendu, et il vient des constantes
  // partagées : un libellé réécrit en dur dans le JSX échapperait à ce test
  // le jour où quelqu'un le change d'un seul côté.
  it("les deux badges sont rendus depuis les constantes partagées", () => {
    const s = source();
    expect(s).toContain("{BADGE_RECOMMANDE}");
    expect(s).toContain("{BADGE_REGISTRE}");
    expect(s).toMatch(/import \{[^}]*outfitBadges[^}]*\} from "@\/lib\/outfitBadges"/);
    expect(BADGE_RECOMMANDE).toBe("Recommandé");
    expect(BADGE_REGISTRE).toBe("Plus sobre");
  });

  it("aucune exclusivité n'est réintroduite entre les deux badges", () => {
    const s = source();
    // La ternaire d'origine testait formalityDowngraded pour CHOISIR un badge.
    expect(s).not.toMatch(/formalityDowngraded \?[\s\S]{0,400}lookScore\.badge/);
    expect(s).toContain("badges.map((key)");
  });

  // Le bandeau ne doit plus faire porter un manque sur le vestiaire.
  it("le bandeau de repli ne dit plus que la capsule manque de quelque chose", () => {
    const rendu = source().replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(rendu).not.toContain("Ta capsule n&apos;a pas de tenue suffisamment habillée");
    expect(rendu).not.toContain("l&apos;alternative la");
    expect(rendu).toContain("Pour cette occasion, on te propose un registre plus sobre");
    // Volontairement NON couvert ici : l'état vide (`noCompleteOutfit`) porte
    // les mêmes tournures — « Tes pièces actuelles ne permettent pas encore de
    // composer une tenue suffisamment habillée », « Dressing insuffisant ».
    // C'est une autre branche que le repli, son wording n'a pas été arbitré,
    // et le réécrire ici dépasserait le périmètre de ce chantier. Signalé
    // comme décision produit à prendre.
  });
});
