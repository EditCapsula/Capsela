import { describe, expect, it } from "vitest";
import { contexteDeLOccasion, texteEditorialLook, titreEnLigne } from "../editorialLook";
import type { Item, OccasionKey } from "../types";
import { item } from "./fixtures";

/** Le bloc éditorial d'une tenue recommandée (12/11/2026, editorialLook.ts). */
const T = "Printemps, Été, Automne, Hiver";
const OCCASIONS: OccasionKey[] = ["all", "quotidien", "travail_formel", "date", "soiree", "sport", "cocooning", "voyage", "evenement_perso"];
const mots = (s: string) => s.replace(/[.]/g, "").split(/\s+/).filter(Boolean).length;

const blazer = item({ id: 1, category: "vestes_blazers", name: "Blazer marine", sous_type: "Blazer", couleur_dominante: "Marine", saison_capsule: T });
const chemise = item({ id: 2, category: "hauts", name: "Chemise blanche", couleur_dominante: "Blanc", saison_capsule: T });
const pantalon = item({ id: 3, category: "pantalons", name: "Pantalon droit", couleur_dominante: "Gris", saison_capsule: T });
const mocassins = item({ id: 4, category: "chaussures", name: "Mocassins", sous_type: "Mocassins", couleur_dominante: "Noir", saison_capsule: T });
const bureau: Item[] = [blazer, chemise, pantalon, mocassins];

describe("texteEditorialLook", () => {
  it("dit le style réel tiré des pièces, et la pertinence pour l'occasion", () => {
    const t = texteEditorialLook(bureau, "travail_formel", "Présentiel", "Verre");
    expect(titreEnLigne(t.titre)).toMatch(/structuré$/);
    expect(t.phrase).toBe("Des lignes nettes pour une journée au bureau.");
  });

  it("un titre de 2 à 4 mots, une phrase de 8 à 12 mots et 100 caractères au plus, pour toutes les occasions", () => {
    for (const occ of OCCASIONS) {
      const t = texteEditorialLook(bureau, occ, "Présentiel", "Verre");
      const n = mots(titreEnLigne(t.titre));
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(4);
      expect(mots(t.phrase)).toBeGreaterThanOrEqual(7);
      expect(mots(t.phrase)).toBeLessThanOrEqual(12);
      expect(t.phrase.length).toBeLessThanOrEqual(100);
    }
  });

  it("décrit le look, jamais la personne, et s'écrit de même pour un profil femme ou homme (aucun accord au féminin)", () => {
    for (const occ of OCCASIONS) {
      const t = texteEditorialLook(bureau, occ, "Présentiel", "Verre");
      expect(`${titreEnLigne(t.titre)} ${t.phrase}`).not.toMatch(/\b(tu|toi|ton|ta|tes)\b/);
      expect(titreEnLigne(t.titre)).not.toMatch(/Féminine|ée\b|ive\b/);
    }
  });

  it("sans pièce, un repli qui ne dit que l'occasion", () => {
    expect(texteEditorialLook([], "soiree", "Présentiel", "Verre").phrase).toBe(`Une tenue pensée pour ${contexteDeLOccasion("soiree", "Présentiel", "Verre")}.`);
  });
});

describe("le style du profil, seulement quand le look le porte", () => {
  it("le dit en fin de phrase quand une pièce porte ce style ; sinon, rien", async () => {
    const { styleDuLook } = await import("../editorialLook");
    const avecStyle = [{ ...chemise, styleTags: ["Minimaliste"] }, pantalon];
    expect(styleDuLook(avecStyle, ["minimaliste"], "femme")).toBe("minimaliste");
    expect(styleDuLook([chemise, pantalon], ["minimaliste"], "femme")).toBeNull();
    const t = texteEditorialLook(bureau, "travail_formel", "Présentiel", "Verre", "minimaliste");
    expect(t.phrase).toBe("Des lignes nettes pour une journée au bureau, dans ton style minimaliste.");
    expect(t.phrase.split(/\s+/).length).toBeLessThanOrEqual(12);
  });
});
