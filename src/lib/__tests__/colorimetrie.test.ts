import { describe, expect, it } from "vitest";
import {
  COLORIMETRIE_VIDE,
  PALETTE_CAPSELA_MAX,
  colorimetrieUtilisable,
  lireColorimetrie,
  paletteCapsela,
  type Colorimetrie,
} from "../colorimetrie";

// Hex réels de PAL_COULEURS — une couleur inventée doit être écartée.
const NOIR = "#2A2724", MARINE = "#3A4152", GRIS = "#8E8B85", ECRU = "#EDE4D6";
const CREME = "#E7DCC8", TAUPE = "#A8967C", CHOCO = "#5A4436", CAMEL = "#C08A5E";
const KAKI = "#6E7358", BORDEAUX = "#6E3B3A", TERRA = "#A66950", MOUTARDE = "#C29A3D";
const ROSE = "#D6A9A0";

const analyse: Colorimetrie = {
  statut: "faite",
  libelle: "Automne chaud",
  signature: [TERRA, CAMEL, MOUTARDE, KAKI, BORDEAUX],
  neutres: [CHOCO, CREME, TAUPE],
  moderation: [NOIR, GRIS, ROSE],
};

describe("paletteCapsela", () => {
  it("sans colorimétrie, la palette EST la liste des préférences", () => {
    // Le cas « passer l'analyse ». Il doit rendre quelque chose de juste,
    // pas un vide.
    expect(paletteCapsela([NOIR, MARINE, CAMEL])).toEqual([NOIR, MARINE, CAMEL]);
    expect(paletteCapsela([NOIR], COLORIMETRIE_VIDE)).toEqual([NOIR]);
    expect(paletteCapsela([NOIR], { statut: "erreur" })).toEqual([NOIR]);
    // Une analyse « faite » mais sans signature n'est pas exploitable.
    expect(paletteCapsela([NOIR], { statut: "faite" })).toEqual([NOIR]);
  });

  it("met en tête ce qu'elle aime ET qui la met en valeur", () => {
    const out = paletteCapsela([MARINE, CAMEL, TERRA], analyse);
    // TERRA et CAMEL sont à la fois préférences et signatures : d'abord, et
    // dans l'ordre de la signature.
    expect(out.slice(0, 2)).toEqual([TERRA, CAMEL]);
    // MARINE est une préférence sans être signature : juste après.
    expect(out[2]).toBe(MARINE);
  });

  it("n'écarte JAMAIS une préférence, même placée « avec modération »", () => {
    // NOIR est une préférence ET dans « avec modération ». Il n'apparaît pas
    // au rang 2 (les préférences hors modération), mais il n'est pas perdu
    // pour autant : le moteur lit `paletteHexes`, pas cette fonction.
    const out = paletteCapsela([NOIR, TERRA], analyse);
    expect(out[0]).toBe(TERRA);
    expect(out).not.toContain(GRIS);
    // et la fonction ne prétend pas non plus l'avoir gardé au rang 2
    expect(out.indexOf(NOIR)).not.toBe(1);
  });

  it("complète avec les autres signatures puis deux neutres au plus", () => {
    const out = paletteCapsela([TERRA], analyse);
    expect(out[0]).toBe(TERRA);
    // les autres signatures
    expect(out).toEqual(expect.arrayContaining([CAMEL, MOUTARDE, KAKI, BORDEAUX]));
    // exactement deux neutres, pas trois
    const nb = [CHOCO, CREME, TAUPE].filter((h) => out.includes(h)).length;
    expect(nb).toBe(2);
  });

  it("ne dépasse jamais huit couleurs et ne répète rien", () => {
    const out = paletteCapsela([MARINE, ECRU, TERRA, CAMEL, MOUTARDE, KAKI], analyse);
    expect(out.length).toBeLessThanOrEqual(PALETTE_CAPSELA_MAX);
    expect(new Set(out).size).toBe(out.length);
  });

  it("tronque aussi les préférences seules à huit", () => {
    const neuf = [NOIR, MARINE, GRIS, ECRU, CREME, TAUPE, CHOCO, CAMEL, KAKI];
    expect(paletteCapsela(neuf)).toHaveLength(PALETTE_CAPSELA_MAX);
  });
});

describe("lireColorimetrie", () => {
  it("écarte toute couleur absente de PAL_COULEURS", () => {
    // Une teinte inventée par un modèle ne doit pas entrer dans une palette
    // présentée comme la sienne.
    const c = lireColorimetrie({ signature: [TERRA, "#123456", "pas un hex"], neutres: ["#000000", CREME] }, "camera");
    expect(c.signature).toEqual([TERRA]);
    expect(c.neutres).toEqual([CREME]);
  });

  it("rend une erreur plutôt qu'une analyse vide", () => {
    expect(lireColorimetrie({}, "camera").statut).toBe("erreur");
    expect(lireColorimetrie({ signature: ["#123456"] }, "camera").statut).toBe("erreur");
    expect(lireColorimetrie(null, "galerie").statut).toBe("erreur");
  });

  it("laisse `moderation` ABSENT quand le service n'en rend pas", () => {
    // L'écran n'affiche le groupe « Plutôt loin du visage » que s'il existe :
    // un tableau vide afficherait un titre sans contenu.
    const c = lireColorimetrie({ signature: [TERRA] }, "camera");
    expect(c.moderation).toBeUndefined();
    const d = lireColorimetrie({ signature: [TERRA], moderation: [NOIR] }, "camera");
    expect(d.moderation).toEqual([NOIR]);
  });

  it("ne garde une confiance que si elle est un nombre entre 0 et 1", () => {
    // Le badge « Analyse fiable » dépend de sa PRÉSENCE : une valeur
    // aberrante ne doit pas le faire apparaître.
    expect(lireColorimetrie({ signature: [TERRA], confiance: 0.8 }, "camera").confiance).toBe(0.8);
    expect(lireColorimetrie({ signature: [TERRA], confiance: 1.4 }, "camera").confiance).toBeUndefined();
    expect(lireColorimetrie({ signature: [TERRA], confiance: "haute" }, "camera").confiance).toBeUndefined();
  });

  it("horodate et retient la source", () => {
    const c = lireColorimetrie({ signature: [TERRA] }, "galerie");
    expect(c.source).toBe("galerie");
    expect(Number.isFinite(Date.parse(c.analyseeLe!))).toBe(true);
  });
});

describe("colorimetrieUtilisable", () => {
  it("exige à la fois « faite » et au moins une signature", () => {
    expect(colorimetrieUtilisable(null)).toBe(false);
    expect(colorimetrieUtilisable(COLORIMETRIE_VIDE)).toBe(false);
    expect(colorimetrieUtilisable({ statut: "encours" })).toBe(false);
    expect(colorimetrieUtilisable({ statut: "faite", signature: [] })).toBe(false);
    expect(colorimetrieUtilisable({ statut: "faite", signature: [TERRA] })).toBe(true);
  });
});
