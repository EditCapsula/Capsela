import { describe, expect, it } from "vitest";
import { MARQUE_CAPSELA, buildOpinionMessage, buildOpinionMessageParts, formatOpinionMessage } from "../selectors";

import type { Item } from "../types";

const piece = (id: number, name: string): Item =>
  ({ id, name, cat: "haut", color: "Écru", hex: "#EEE", season: "Toutes saisons", worn: null }) as Item;

const TENUE = [piece(11, "Blouse fluide à col lavallière"), piece(12, "Jupe midi en cuir"), piece(13, "Ballerines")];
const BASE = { pieces: TENUE, occasion: "travail_formel" as const, temp: 23.4, conditionMeteo: "Ensoleillé", prenom: "Angela" };

describe("message envoyé à un proche — autonome, hors de Capsela", () => {
  it("signé L’édit Capsela au début et à la fin", () => {
    const lignes = buildOpinionMessage(BASE).split("\n");
    expect(lignes[0]).toBe(MARQUE_CAPSELA);
    expect(lignes[lignes.length - 1]).toBe(`Tenue imaginée avec ${MARQUE_CAPSELA}.`);
  });

  it("dit qui demande, avec le prénom du profil (premier mot seulement)", () => {
    expect(buildOpinionMessage({ ...BASE, prenom: "  Angela Tav " })).toContain("Angela te demande ton avis sur sa tenue.");
  });

  it("sans prénom : une formule naturelle, jamais un vide ni un gabarit", () => {
    for (const prenom of [null, undefined, "", "   "]) {
      const m = buildOpinionMessage({ ...BASE, prenom });
      expect(m).toContain("On te demande ton avis sur cette tenue.");
      expect(m).toContain("Capsela propose cette tenue");
      expect(m).toContain("réponds directement ici");
      expect(m).not.toMatch(/\{\{|undefined|null|^ te demande/m);
    }
  });

  it("nomme chaque pièce de la tenue, et rien d'autre", () => {
    const m = buildOpinionMessage(BASE);
    for (const p of TENUE) expect(m).toContain(p.name);
    expect(m.split("\n").filter((l) => l.startsWith("• "))).toHaveLength(3);
  });

  it("porte l'occasion et la météo quand elles existent", () => {
    const m = buildOpinionMessage(BASE);
    expect(m).toContain("Capsela lui propose cette tenue pour l’occasion « Travail / Bureau » :");
    expect(m).toContain("Météo : 23 °C · Ensoleillé");
  });

  /**
   * Ce texte part chez quelqu'un d'autre : une météo ou une occasion inventée
   * y serait pire qu'absente.
   */
  it("omet la météo inconnue au lieu de l'inventer — la ligne disparaît", () => {
    for (const temp of [null, undefined, NaN]) {
      const m = buildOpinionMessage({ ...BASE, temp, conditionMeteo: "Nuageux" });
      expect(m).not.toMatch(/°|Météo/);
      expect(m).not.toMatch(/NaN|undefined|null/);
    }
    expect(buildOpinionMessage({ ...BASE, conditionMeteo: null })).toContain("Météo : 23 °C\n");
  });

  it("sans occasion : la phrase reste juste, sans « pour l’occasion »", () => {
    const m = buildOpinionMessage({ ...BASE, occasion: "all" });
    expect(m).toContain("Capsela lui propose cette tenue :");
    expect(m).not.toContain("occasion");
    expect(m).not.toContain("Toutes");
  });

  it("ne demande jamais d'ouvrir Capsela : ni lien, ni bouton, ni réponse dans l'application", () => {
    const m = buildOpinionMessage(BASE).toLowerCase();
    for (const mot of ["http", "ouvrir", "application", "donner mon avis", "→", "voter", "note"]) expect(m).not.toContain(mot);
    expect(m).toContain("réponds-lui directement ici");
  });

  it("ne révèle jamais ce qui vient du dressing ou de la capsule", () => {
    const m = buildOpinionMessage(BASE).toLowerCase();
    for (const mot of ["dressing", "capsule", "suggestion", "suggérée"]) expect(m).not.toContain(mot);
  });

  it("sans emoji : l'aperçu est affiché tel quel dans l'interface", () => {
    expect(buildOpinionMessage(BASE)).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("pose une question — c'est un avis qui est demandé", () => {
    expect(buildOpinionMessage(BASE)).toContain("Tu en penses quoi ?");
  });

  it("tenue planifiée : le jour J dans la demande", () => {
    expect(buildOpinionMessage({ ...BASE, moment: "pour samedi 4 octobre" })).toContain(
      "Angela te demande ton avis sur sa tenue pour samedi 4 octobre."
    );
    expect(buildOpinionMessage({ ...BASE, prenom: null, moment: "pour samedi 4 octobre" })).toContain(
      "On te demande ton avis sur cette tenue pour samedi 4 octobre."
    );
  });
});

/**
 * L'ÉCRAN AFFICHE-T-IL CE QU'IL ENVOIE ? L'aperçu lit les parties, le partage
 * et la copie envoient la chaîne. Ces tests figent le seul garde-fou qui rende
 * une divergence impossible : la chaîne est BÂTIE à partir des parties, et
 * chaque partie s'y relit telle quelle, à sa place.
 */
describe("parties du message et chaîne envoyée", () => {
  it("chaque partie se relit telle quelle, dans l'ordre de l'aperçu", () => {
    const p = buildOpinionMessageParts(BASE);
    const lignes = buildOpinionMessage(BASE).split("\n");
    const ordre = [p.marque, p.demande, p.contexte, ...p.pieces.map((n) => `• ${n}`), p.meteo!, p.question, p.relance, p.signature];
    expect(lignes.filter((l) => l !== "")).toEqual(ordre);
  });

  it("les pièces sont rendues SANS puce — la puce appartient à l'affichage — et dans l'ordre de la tenue", () => {
    const p = buildOpinionMessageParts(BASE);
    expect(p.pieces).toEqual(TENUE.map((t) => t.name));
  });

  it("le formateur n'invente rien — sur des parties minimales, il rend ces parties", () => {
    expect(
      formatOpinionMessage({ marque: "M", demande: "D", contexte: "C :", pieces: ["A"], meteo: null, question: "Q ?", relance: "R", signature: "S" })
    ).toBe("M\n\nD\n\nC :\n• A\n\nQ ?\nR\n\nS");
  });

  it("une tenue vide donne des parties vides, pas une puce orpheline", () => {
    const vide = { ...BASE, pieces: [] };
    expect(buildOpinionMessageParts(vide).pieces).toEqual([]);
    expect(buildOpinionMessage(vide)).not.toContain("•");
  });
});
