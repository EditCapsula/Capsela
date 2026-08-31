import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { missingSuggestionText } from "../outfitCopy";

/**
 * VOCABULAIRE DU MANQUE — 31/08/2026.
 *
 * Trois textes disaient « Il te manque … », à la deuxième personne, sur des
 * tenues COMPLÈTES ET VALIDES : la suggestion de complément (outfitMissingCats),
 * R-S12 (layering) et R-S13 (touche de couleur). Les deux dernières ne
 * décrivent même pas une pièce absente, mais un parti pris de style.
 *
 * L'information est conservée — mêmes catégories, même ordre. Seule la
 * personne grammaticale change : la phrase décrit ce qu'un ajout apporterait
 * au lieu de constater ce que l'utilisatrice n'a pas.
 */

const SRC = join(__dirname, "..", "..");

/** Tous les .ts/.tsx de src, hors tests — pour le garde-fou global. */
function fichiersSource(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== "__tests__" && e.name !== "node_modules") fichiersSource(p, acc);
    } else if (/\.tsx?$/.test(e.name)) acc.push(p);
  }
  return acc;
}

describe("missingSuggestionText — décrire l'apport, jamais le manque", () => {
  it("une seule catégorie, au singulier", () => {
    expect(missingSuggestionText(["haut"])).toBe("Un haut compléterait cette tenue.");
    expect(missingSuggestionText(["sac"])).toBe("Un sac compléterait cette tenue.");
    expect(missingSuggestionText(["chaud"])).toBe("Une pièce plus chaude compléterait cette tenue.");
  });

  // « des chaussures » est déjà pluriel à lui seul : le verbe doit s'accorder
  // même quand il n'y a qu'une catégorie. C'est précisément ce qu'un test
  // statique sur la source ne saurait vérifier.
  it("une seule catégorie déjà au pluriel, le verbe s'accorde", () => {
    expect(missingSuggestionText(["chaussures"])).toBe("Des chaussures compléteraient cette tenue.");
  });

  it("plusieurs catégories, énumération et pluriel", () => {
    expect(missingSuggestionText(["haut", "chaussures"])).toBe(
      "Un haut et des chaussures compléteraient cette tenue."
    );
    expect(missingSuggestionText(["haut", "sac", "bijou"])).toBe(
      "Un haut, un sac et un bijou compléteraient cette tenue."
    );
  });

  it("rien à suggérer : chaîne vide, aucune carte affichée", () => {
    expect(missingSuggestionText([])).toBe("");
    expect(missingSuggestionText(["categorie_inconnue"])).toBe("");
  });

  // Comportement d'origine conservé : un repli de formalité n'est pas une
  // catégorie absente, il a sa propre bannière.
  it("« moins_habille » reste exclu et ne déclenche rien à lui seul", () => {
    expect(missingSuggestionText(["moins_habille"])).toBe("");
    expect(missingSuggestionText(["moins_habille", "sac"])).toBe("Un sac compléterait cette tenue.");
  });

  it("les doublons ne sont énumérés qu'une fois", () => {
    expect(missingSuggestionText(["sac", "sac"])).toBe("Un sac compléterait cette tenue.");
  });
});

/**
 * Retire les commentaires pour ne vérifier que le code réellement rendu : les
 * modules corrigés CITENT l'ancienne tournure pour expliquer son retrait, et
 * cette citation ne doit pas déclencher le garde-fou.
 */
function codeSansCommentaires(chemin: string): string {
  return readFileSync(chemin, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith("//") && !t.startsWith("*");
    })
    .join("\n");
}

describe("garde-fou — le vocabulaire du manque ne revient pas", () => {
  // Les trois occurrences vivaient dans deux fichiers différents (un écran et
  // le moteur de score). Un garde-fou fichier par fichier laisserait passer la
  // quatrième, écrite ailleurs : la vérification porte sur tout src.
  it("« Il te manque » n'existe plus nulle part dans src", () => {
    const coupables = fichiersSource(SRC).filter((f) => codeSansCommentaires(f).includes("Il te manque"));
    expect(coupables.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it("les deux suggestions proactives décrivent un apport", () => {
    const logique = readFileSync(join(SRC, "lib", "logic.ts"), "utf8");
    expect(logique).toContain('text: "Un débardeur ou un t-shirt dessous compléterait cette tenue."');
    expect(logique).toContain('text: "Une touche de couleur réveillerait ce total look noir."');
  });
});

describe("bandeau de repli — la source nommée est celle que l'écran a calculée", () => {
  // Le bandeau disait « les pièces de ta capsule » en dur. C'est faux pour une
  // utilisatrice qui a un dressing réel : l'écran calcule déjà sourceLabel
  // (« ton dressing » / « cette capsule ») et l'utilise pour les états vides.
  it("le bandeau interpole sourceLabel au lieu d'écrire « ta capsule »", () => {
    const ecran = readFileSync(join(SRC, "components", "screens", "TenuesScreen.tsx"), "utf8");
    const jsx = ecran.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(jsx).toContain("composé avec les pièces de {sourceLabel}.");
    expect(jsx).not.toContain("composé avec les pièces de ta capsule");
  });
});
