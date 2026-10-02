import { describe, expect, it } from "vitest";
import {
  PALETTE_CAPSELA_MAX,
  SAISONS,
  SAISONS_CLES,
  SIGNATURE_AFFICHEE_MAX,
  colorimetrieDeSaison,
  paletteCapsela,
  rafraichirColorimetrie,
} from "../colorimetrie";
import { PAL_COULEURS } from "../palCouleurs";

/**
 * PLACEMENT DES 25 NOUVELLES COULEURS PAR SAISON (02/10/2026, tableau validé).
 * Les signatures d'origine restent en tête : le résultat de celles qui l'avaient déjà ne change pas.
 */

const hex = (nom: string) => PAL_COULEURS.find(([n]) => n === nom)![1];
const noms = (liste: string[]) => liste.map((h) => PAL_COULEURS.find(([, x]) => x === h)?.[0]);

const ORIGINE_SIGNATURE = {
  printemps: ["Corail", "Camel", "Moutarde", "Rose poudré"],
  ete: ["Rose poudré", "Bleu", "Prune", "Marine"],
  automne: ["Terracotta", "Camel", "Moutarde", "Kaki", "Bordeaux"],
  hiver: ["Rouge", "Bordeaux", "Prune", "Vert bouteille", "Marine"],
} as const;

describe("placement des couleurs ajoutées", () => {
  it("les signatures d'origine restent en tête, dans leur ordre", () => {
    for (const k of SAISONS_CLES) {
      expect(noms(SAISONS[k].signature).slice(0, ORIGINE_SIGNATURE[k].length)).toEqual([...ORIGINE_SIGNATURE[k]]);
    }
  });

  it("quelques placements du tableau", () => {
    expect(noms(SAISONS.automne.signature)).toContain("Vieux rose");
    expect(noms(SAISONS.automne.moderation)).toContain("Rose poudré");
    expect(noms(SAISONS.hiver.signature)).toContain("Rouge cerise");
    expect(noms(SAISONS.ete.signature)).toContain("Vert sauge");
    expect(noms(SAISONS.hiver.moderation)).toContain("Vieux rose");
  });

  it("une couleur n'est jamais à la fois signature, neutre et à modérer dans une saison", () => {
    for (const k of SAISONS_CLES) {
      const tout = [...SAISONS[k].signature, ...SAISONS[k].neutres, ...SAISONS[k].moderation];
      expect(new Set(tout).size).toBe(tout.length);
    }
  });

  it("la palette Capsela reste plafonnée, même avec davantage de signatures", () => {
    for (const k of SAISONS_CLES) {
      const p = paletteCapsela([], colorimetrieDeSaison(k, "questionnaire"));
      expect(p.length).toBeLessThanOrEqual(PALETTE_CAPSELA_MAX);
    }
    expect(SIGNATURE_AFFICHEE_MAX).toBe(6);
  });

  it("rafraichirColorimetrie relit les listes actuelles d'un profil enregistré avec d'anciennes listes", () => {
    const ancien = { ...colorimetrieDeSaison("automne", "questionnaire"), signature: [hex("Terracotta")], neutres: [], moderation: [] };
    const frais = rafraichirColorimetrie(ancien);
    expect(frais.signature).toEqual(SAISONS.automne.signature);
    expect(frais.neutres).toEqual(SAISONS.automne.neutres);
    expect(frais.moderation).toEqual(SAISONS.automne.moderation);
  });

  it("rafraichirColorimetrie laisse intacte une colorimétrie sans saison", () => {
    const c = { statut: "aucune" as const };
    expect(rafraichirColorimetrie(c)).toBe(c);
  });
});
