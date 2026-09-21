import { describe, expect, it } from "vitest";
import {
  computeDefaultCapsule,
  MORPHOLOGIES_AVEC_DIRECTION,
  morphologieOrienteLaSelection,
} from "../capsule";
import { EMPTY_PROFILE, MORPHOLOGIES, MORPHO_HINTS, silhouetteForme } from "../profile";
import { MILD, item } from "./fixtures";
import type { CatalogItem } from "../catalog";

/**
 * QUI PEUT SE VOIR PROMETTRE UNE SÉLECTION « PENSÉE POUR TA MORPHOLOGIE ».
 *
 * L'écran Capsule annonce depuis le 15/09/2026 ce à quoi sa sélection doit
 * quelque chose. La morphologie n'y figure que si elle change réellement le
 * résultat : `valeurDirection` est le seul endroit où elle pèse encore en
 * production, et elle ne rend un axe que pour la poire et le triangle
 * inversé. Pour rectangle, sablier et pomme, la capsule est identique avec ou
 * sans morphologie déclarée — l'annoncer promettrait une personnalisation qui
 * n'a pas lieu.
 *
 * Le dernier test est celui qui compte : il ne relit pas la liste, il compare
 * des capsules. Si le moteur cessait d'orienter la poire, ou se mettait à
 * orienter la pomme, la liste deviendrait fausse et ce test tomberait.
 */

/** Un vivier synthétique assez fourni et assez varié en coupes pour que la direction ait prise. */
const vivier = (): CatalogItem[] => {
  const cats = [
    "hauts", "pulls_gilets", "pantalons", "jeans", "jupes", "robes",
    "vestes_blazers", "manteaux_exterieurs", "chaussures", "sacs", "bijoux", "accessoires",
  ];
  const out: CatalogItem[] = [];
  let id = 1;
  for (const category of cats) {
    for (let k = 0; k < 8; k++) {
      out.push(item({
        id: id++, category, name: `${category} ${k}`,
        sous_type: k % 2 ? "Oversize" : "Ajusté",
        coupe: k % 3 === 0 ? "oversize" : k % 3 === 1 ? "ajustee" : "droite",
      }));
    }
  }
  return out;
};

const capsulePour = (morphology: string | null): string =>
  computeDefaultCapsule({ ...EMPTY_PROFILE, gender: "femme", morphology }, MILD, [], "Automne", vivier())
    .map((it) => it.id)
    .sort((a, b) => a - b)
    .join(",");

describe("morphologieOrienteLaSelection", () => {
  it("ne nomme que des morphologies qui existent", () => {
    for (const m of MORPHOLOGIES_AVEC_DIRECTION) {
      expect(MORPHOLOGIES, `${m} doit être une morphologie connue`).toContain(m);
    }
  });

  it("retient la poire et le triangle inversé, et elles seules", () => {
    expect(morphologieOrienteLaSelection("f_poire")).toBe(true);
    expect(morphologieOrienteLaSelection("f_triangle_inverse")).toBe(true);
    expect(morphologieOrienteLaSelection("f_rectangle")).toBe(false);
    expect(morphologieOrienteLaSelection("f_sablier")).toBe(false);
    expect(morphologieOrienteLaSelection("f_pomme")).toBe(false);
  });

  it("rend false sans morphologie déclarée", () => {
    expect(morphologieOrienteLaSelection(null)).toBe(false);
    expect(morphologieOrienteLaSelection(undefined)).toBe(false);
    expect(morphologieOrienteLaSelection("")).toBe(false);
  });

  it("dit vrai : la capsule ne change QUE pour les morphologies retenues", () => {
    const sansMorphologie = capsulePour(null);
    // Contre-épreuve d'abord : sans elle, une capsule identique partout ferait
    // passer ce test pour une raison qui n'a rien à voir avec la morphologie.
    expect(capsulePour("f_poire"), "le vivier doit être assez riche pour que la direction ait prise")
      .not.toBe(sansMorphologie);

    for (const m of MORPHOLOGIES) {
      const change = capsulePour(m) !== sansMorphologie;
      expect(change, `${m} : la capsule ${change ? "change" : "ne change pas"}`)
        .toBe(morphologieOrienteLaSelection(m));
    }
  });
});

describe("la forme courte affichée par l'écran Capsule", () => {
  it("couvre toutes les morphologies que l'écran est susceptible de nommer", () => {
    for (const m of MORPHOLOGIES_AVEC_DIRECTION) {
      expect(silhouetteForme(m), `${m} s'afficherait avec un libellé vide`).not.toBe("");
    }
  });

  it("ne nomme pas celles que la sélection ignore", () => {
    for (const m of MORPHOLOGIES.filter((x) => !morphologieOrienteLaSelection(x))) {
      expect(silhouetteForme(m), `${m} n'a pas à être nommée`).toBe("");
    }
  });

  it("garde le vocabulaire des indices de profil, sans nom de fruit", () => {
    expect(silhouetteForme("f_poire")).toBe("en A");
    expect(silhouetteForme("f_triangle_inverse")).toBe("en V");
    expect(MORPHO_HINTS.f_poire).toContain("forme en A");
    expect(MORPHO_HINTS.f_triangle_inverse).toContain("forme en V");
  });
});
