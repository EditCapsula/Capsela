import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FALLBACK_HEX, PALETTE } from "../data";
import { NOMS_AJOUTES_AU_DRESSING, PAL_COULEURS } from "../palCouleurs";
import { teinteDe } from "../colorimetrieMoteur";

/**
 * LES PALETTES ENRICHIES (02/10/2026, demandé : « enrichir la palette de couleurs à choisir »).
 * Les anciennes teintes gardent leur code : les profils et les pièces déjà enregistrés ne changent pas.
 */

const PAL_D_ORIGINE: [string, string][] = [
  ["Noir", "#2A2724"], ["Marine", "#3A4152"], ["Gris", "#8E8B85"], ["Blanc / écru", "#EDE4D6"], ["Blanc", "#F7F4EE"],
  ["Crème", "#E7DCC8"], ["Sable", "#DCCFBC"], ["Beige", "#CDBBA2"], ["Taupe", "#A8967C"], ["Chocolat", "#5A4436"],
  ["Camel", "#C08A5E"], ["Kaki", "#6E7358"], ["Vert bouteille", "#3C5347"], ["Bordeaux", "#6E3B3A"], ["Prune", "#5B3A4A"],
  ["Rouge", "#933B33"], ["Terracotta", "#A66950"], ["Rose poudré", "#D6A9A0"], ["Corail", "#CF7358"], ["Moutarde", "#C29A3D"],
  ["Bleu", "#4A6280"],
];
const DRESSING_D_ORIGINE: [string, string][] = [
  ["Blanc", "#F7F4EE"], ["Blanc cassé", "#EDE4D6"], ["Crème", "#E7DCC8"], ["Sable", "#D9C9B2"], ["Camel", "#C08A5E"],
  ["Caramel", "#B4835A"], ["Terracotta", "#B4735A"], ["Rouille", "#A9613F"], ["Brique", "#9E5A3C"], ["Chocolat", "#7C5436"],
  ["Moutarde", "#C39A50"], ["Kaki", "#8A8560"], ["Vert sauge", "#9AA389"], ["Vert bouteille", "#3F5342"], ["Taupe", "#A8967C"],
  ["Beige rosé", "#D8C3B4"], ["Rose poudré", "#D3AE9F"], ["Corail", "#C9846A"], ["Gris clair", "#C7C2B9"], ["Gris", "#9B968F"],
  ["Gris anthracite", "#4B4A47"], ["Bleu ciel", "#A9BFCB"], ["Denim", "#5E6E7C"], ["Marine", "#3A4152"], ["Prune", "#5B3A4A"],
  ["Bordeaux", "#6E3B3A"], ["Noir", "#2A2724"],
];

describe("palette personnelle enrichie", () => {
  it("garde les 21 teintes d'origine, au même code", () => {
    for (const [nom, hex] of PAL_D_ORIGINE) expect(PAL_COULEURS.find(([n]) => n === nom)?.[1], nom).toBe(hex);
  });
  it("est enrichie : 46 teintes, sans doublon de nom ni de code", () => {
    expect(PAL_COULEURS).toHaveLength(46);
    expect(new Set(PAL_COULEURS.map(([n]) => n)).size).toBe(PAL_COULEURS.length);
    expect(new Set(PAL_COULEURS.map(([, h]) => h.toUpperCase())).size).toBe(PAL_COULEURS.length);
  });
  it("contient Rouge cerise, Fuchsia, Vieux rose et Vert forêt", () => {
    for (const nom of ["Rouge cerise", "Fuchsia", "Vieux rose", "Vert forêt"]) expect(PAL_COULEURS.some(([n]) => n === nom), nom).toBe(true);
  });
});

describe("palette du dressing enrichie", () => {
  it("garde les 27 teintes d'origine, au même code", () => {
    for (const [nom, hex] of DRESSING_D_ORIGINE) expect(PALETTE.find(([n]) => n === nom)?.[1], nom).toBe(hex);
  });
  it("est enrichie : 51 teintes, sans doublon de nom ni de code", () => {
    expect(PALETTE).toHaveLength(51);
    expect(new Set(PALETTE.map(([n]) => n)).size).toBe(PALETTE.length);
    expect(new Set(PALETTE.map(([, h]) => h.toUpperCase())).size).toBe(PALETTE.length);
  });
  it("chaque teinte ajoutée a le MÊME code que dans la palette personnelle — une couleur choisie se retrouve sur une pièce", () => {
    for (const nom of NOMS_AJOUTES_AU_DRESSING) {
      expect(PALETTE.find(([n]) => n === nom)?.[1], nom).toBe(PAL_COULEURS.find(([n]) => n === nom)?.[1]);
    }
  });
  it("aucune teinte ajoutée ne prend le code du repli « couleur inconnue »", () => {
    for (const nom of NOMS_AJOUTES_AU_DRESSING) expect(PALETTE.find(([n]) => n === nom)?.[1].toUpperCase()).not.toBe(FALLBACK_HEX.toUpperCase());
  });
  it("la colorimétrie lit chaque teinte ajoutée sous son propre nom (placée par saison le 02/10/2026)", () => {
    for (const nom of NOMS_AJOUTES_AU_DRESSING) {
      const [, hex] = PALETTE.find(([n]) => n === nom)!;
      expect(teinteDe({ hex, color: nom }), nom).toBe(PAL_COULEURS.find(([n]) => n === nom)![1]);
    }
  });

});

describe("copie de la palette dans la fonction Edge analyze-dressing-photo", () => {
  it("est identique à PALETTE (même noms, mêmes codes, même ordre)", () => {
    const source = readFileSync("supabase/functions/analyze-dressing-photo/index.ts", "utf8");
    const debut = source.indexOf("const PALETTE: [string, string][] = [");
    const fin = source.indexOf("const PALETTE_BIJOU");
    const copie = [...source.slice(debut, fin).matchAll(/\["([^"]+)",\s*"(#[0-9A-Fa-f]{6})"\]/g)].map((m) => [m[1], m[2]]);
    expect(copie).toEqual(PALETTE);
  });
});
