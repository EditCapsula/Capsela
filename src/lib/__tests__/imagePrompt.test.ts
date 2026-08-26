import { describe, expect, it } from "vitest";
import { buildImagePrompt } from "../imagePrompt";
import { item } from "./fixtures";

/** Segment produit du prompt : la première ligne, hors préfixe fixe. */
function subject(over: Parameters<typeof item>[0]): string {
  return buildImagePrompt(item(over)).prompt.split("\n")[0].toLowerCase();
}

describe("buildImagePrompt — vocabulaire", () => {
  it("ne laisse aucun libellé couleur français dans un prompt anglais", () => {
    // Correctif 26/08/2026 : 35 des 71 libellés de la base n'avaient aucune
    // traduction et repartaient tels quels via le repli color.toLowerCase().
    const libelles = [
      "Écru", "Ivoire", "Gris chiné", "Vieux rose", "Vert forêt", "Vert olive",
      "Bleu Marine", "Bleu clair", "Marron foncé", "Blanc nacré", "Écaille",
      "Argent vieilli", "Doré vieilli", "Denim bleu", "Denim brut", "Denim clair",
      "Écru / marine", "Noir / écru", "Terre / bois", "Kaki clair",
    ];
    for (const couleur of libelles) {
      const s = subject({ id: 1, category: "hauts", name: "Top", sous_type: "T-shirt", couleur_dominante: couleur });
      expect(s, `${couleur} → ${s}`).not.toMatch(/[éèêàçôûîï]/);
    }
  });

  it("traduit le denim par la nuance seule, sans bégayer sur la matière", () => {
    const s = subject({ id: 2, category: "jeans", name: "Jean", sous_type: "Jean", couleur_dominante: "Denim bleu", matiere: "Denim" });
    expect(s).toContain("blue denim");
    expect(s).not.toContain("denim denim");
  });

  it("reconnaît le body comme sujet et lit ses détails de sous-type", () => {
    const built = buildImagePrompt(item({
      id: 3, category: "hauts", name: "Body", sous_type: "Body col carré manches longues", couleur_dominante: "Noir",
    }));
    expect(built.noun).toBe("bodysuit");
    expect(built.ok).toBe(true);
    expect(built.prompt.toLowerCase()).toContain("square neck");
    expect(built.prompt.toLowerCase()).toContain("long-sleeved");
  });
});

describe("buildImagePrompt — garde-fous structurels", () => {
  it("interdit toujours toute présence humaine", () => {
    const p = buildImagePrompt(item({ id: 4, category: "robes", name: "Robe", sous_type: "Robe" })).prompt;
    for (const interdit of ["No person.", "No model.", "No mannequin.", "No visible body."]) {
      expect(p).toContain(interdit);
    }
  });

  it("ne déduit jamais le sujet depuis le nom (règle du 18/08/2026)", () => {
    // Un nom trompeur ne doit pas changer le produit : seul sous_type compte.
    const built = buildImagePrompt(item({ id: 5, category: "pantalons", name: "Pantalon façon blazer", sous_type: "Pantalon" }));
    expect(built.noun).not.toContain("blazer");
    expect(built.ok).toBe(true);
  });

  it("signale une incohérence entre catégorie et sous-type plutôt que de générer", () => {
    const built = buildImagePrompt(item({ id: 6, category: "chaussures", name: "Erreur de saisie", sous_type: "Blazer" }));
    expect(built.ok).toBe(false);
  });
});
