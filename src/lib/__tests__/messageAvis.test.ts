import { describe, expect, it } from "vitest";
import { buildOpinionMessage, buildOpinionMessageParts, formatOpinionMessage } from "../selectors";

import type { Item } from "../types";

const piece = (id: number, name: string): Item =>
  ({ id, name, cat: "haut", color: "Écru", hex: "#EEE", season: "Toutes saisons", worn: null }) as Item;

const TENUE = [piece(11, "Blouse fluide à col lavallière"), piece(12, "Jupe midi en cuir"), piece(13, "Ballerines")];

describe("message envoyé à un proche", () => {
  it("nomme chaque pièce de la tenue, et rien d'autre", () => {
    const m = buildOpinionMessage({ pieces: TENUE, occasion: "travail_formel", temp: 23, conditionMeteo: "Ensoleillé" });
    for (const p of TENUE) expect(m).toContain(p.name);
    expect(m.split("\n").filter((l) => l.startsWith("• "))).toHaveLength(3);
  });

  it("porte l'occasion et la météo quand elles existent", () => {
    const m = buildOpinionMessage({ pieces: TENUE, occasion: "travail_formel", temp: 23.4, conditionMeteo: "Ensoleillé" });
    expect(m).toContain("Travail / Bureau");
    expect(m).toContain("23° · Ensoleillé");
  });

  /**
   * Le point qui compte : ce texte part chez quelqu'un d'autre. Une météo ou
   * une occasion inventée y serait pire qu'absente — c'est la règle « UNKNOWN
   * plutôt que renseigné mais faux », appliquée à un message sortant.
   */
  it("omet la météo inconnue au lieu de l'inventer", () => {
    for (const temp of [null, undefined, NaN]) {
      const m = buildOpinionMessage({ pieces: TENUE, occasion: "soiree", temp, conditionMeteo: null });
      expect(m).not.toMatch(/\d+°/);
      expect(m).not.toMatch(/NaN|undefined|null/);
      expect(m).toContain("Sortie / Soirée");
    }
  });

  it("omet l'occasion quand aucune n'est choisie", () => {
    const m = buildOpinionMessage({ pieces: TENUE, occasion: "all", temp: null, conditionMeteo: null });
    expect(m.split("\n")[0]).toBe("Ma tenue du jour");
    expect(m).not.toContain("Toutes");
  });

  it("ne révèle jamais ce qui vient du dressing ou de la capsule", () => {
    const m = buildOpinionMessage({ pieces: TENUE, occasion: "date", temp: 12, conditionMeteo: "Nuageux" });
    for (const mot of ["dressing", "capsule", "suggestion", "suggérée"]) {
      expect(m.toLowerCase()).not.toContain(mot);
    }
  });

  it("pose une question — c'est un avis qui est demandé", () => {
    expect(buildOpinionMessage({ pieces: TENUE, occasion: "all", temp: null, conditionMeteo: null })).toContain("?");
  });
});

/**
 * L'ÉCRAN AFFICHE-T-IL CE QU'IL ENVOIE ?
 *
 * Depuis la maquette du 23/09/2026, le message est rendu en LECTURE sous forme
 * composée — titre en gras, pièces à puces, question en serif italique — et
 * ce rendu lit `buildOpinionMessageParts`, quand le partage envoie la chaîne.
 * Deux lectures d'une même chose, donc deux occasions de diverger sans que
 * rien ne plante : l'écran montrerait une tenue, le proche en recevrait une
 * autre. C'est le défaut exact que cette fonctionnalité doit éviter.
 *
 * Ces tests figent le seul garde-fou qui le rende impossible : la chaîne est
 * BÂTIE à partir des parties.
 */
describe("parties du message et chaîne envoyée", () => {
  const args = { pieces: TENUE, occasion: "travail_formel" as const, temp: 23, conditionMeteo: "Ensoleillé" };

  /**
   * Écrit à L'ENVERS — on relît les parties DEPUIS la chaîne — et c'est
   * délibéré. Comparer `buildOpinionMessage(x)` à
   * `formatOpinionMessage(buildOpinionMessageParts(x))` aurait été la
   * DÉFINITION de la première : un test vrai par construction, vert quoi que
   * fasse le formatage. Celui-ci mord — vérifié en faisant tronquer un nom
   * de pièce au formateur : il passe au rouge.
   */
  it("les parties sont relisibles telles quelles dans la chaîne envoyée", () => {
    const parts = buildOpinionMessageParts(args);
    const lignes = buildOpinionMessage(args).split("\n");
    expect(lignes[0]).toBe(parts.titre);
    expect(lignes[lignes.length - 1]).toBe(parts.question);
    expect(lignes.filter((l) => l.startsWith("• ")).map((l) => l.slice(2))).toEqual(parts.pieces);
  });

  it("chaque partie se retrouve mot pour mot dans la chaîne", () => {
    const parts = buildOpinionMessageParts(args);
    const m = buildOpinionMessage(args);
    expect(m).toContain(parts.titre);
    expect(m).toContain(parts.question);
    for (const nom of parts.pieces) expect(m).toContain(nom);
  });

  it("les pièces sont rendues SANS puce — la puce appartient à l'affichage", () => {
    const parts = buildOpinionMessageParts(args);
    for (const nom of parts.pieces) expect(nom.startsWith("•")).toBe(false);
    expect(parts.pieces).toEqual(TENUE.map((p) => p.name));
  });

  it("garde l'ordre des pièces de la tenue, celui que l'écran affiche", () => {
    expect(buildOpinionMessageParts(args).pieces).toEqual([
      "Blouse fluide à col lavallière",
      "Jupe midi en cuir",
      "Ballerines",
    ]);
  });

  it("omet le contexte absent dans les parties comme dans la chaîne", () => {
    const sans = { pieces: TENUE, occasion: "all" as const, temp: null, conditionMeteo: null };
    expect(buildOpinionMessageParts(sans).titre).toBe("Ma tenue du jour");
    expect(buildOpinionMessage(sans).split("\n")[0]).toBe("Ma tenue du jour");
  });

  /** Le formateur, appelé directement : il ne doit rien ajouter que les parties ne portent. */
  it("le formateur n'invente rien — sur des parties minimales, il rend ces parties", () => {
    expect(formatOpinionMessage({ titre: "T", pieces: ["A", "B"], question: "Q ?" })).toBe("T\n\n\u2022 A\n\u2022 B\n\nQ ?");
  });

  it("une tenue vide donne des parties vides, pas une puce orpheline", () => {
    const vide = { pieces: [], occasion: "all" as const, temp: null, conditionMeteo: null };
    expect(buildOpinionMessageParts(vide).pieces).toEqual([]);
    expect(buildOpinionMessage(vide)).not.toContain("•");
  });
});

describe("tenue planifiée — l'intitulé dit le jour J, pas « du jour »", () => {
  it("remplace « Ma tenue du jour » et garde le contexte", () => {
    const parts = buildOpinionMessageParts({
      pieces: [],
      occasion: "all",
      temp: 18,
      conditionMeteo: "Nuageux",
      intitule: "Ma tenue pour samedi 4 oct.",
    });
    expect(parts.titre).toBe("Ma tenue pour samedi 4 oct. — 18° · Nuageux");
  });
  it("sans intitulé : inchangé", () => {
    expect(buildOpinionMessageParts({ pieces: [], occasion: "all", temp: null, conditionMeteo: null }).titre).toBe("Ma tenue du jour");
  });
});
