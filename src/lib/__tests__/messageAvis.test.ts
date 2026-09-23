import { describe, expect, it } from "vitest";
import { buildOpinionMessage } from "../selectors";
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
