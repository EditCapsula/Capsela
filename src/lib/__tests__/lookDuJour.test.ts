import { describe, expect, it } from "vitest";
import { qualificatifLook, titreLookDuJour } from "../logic";

// Card « Look du jour » de l'accueil (28/09/2026) : ses deux lignes de texte.

describe("titreLookDuJour — contexte réel, jamais « bureau » en dur", () => {
  it("suit l'occasion et ses sous-choix", () => {
    expect(titreLookDuJour("travail_formel", "Présentiel", "Verre")).toBe("Une silhouette pensée pour ta journée au bureau.");
    expect(titreLookDuJour("travail_formel", "Télétravail", "Verre")).toBe("Une silhouette pensée pour ta journée en télétravail.");
    expect(titreLookDuJour("date", "Présentiel", "Restaurant / date romantique")).toBe("Une silhouette pensée pour ton dîner.");
    expect(titreLookDuJour("soiree", "Présentiel", "Verre")).toBe("Une silhouette pensée pour ta sortie.");
    expect(titreLookDuJour("quotidien", "Présentiel", "Verre")).toBe("Une silhouette pensée pour ta journée.");
  });
});

describe("qualificatifLook — une pièce du look n'est jamais présentée comme une option", () => {
  it("avec une veste entre 12° et 19° : « Confortable et structurée. »", () => {
    expect(qualificatifLook(17, [{ cat: "veste" }, { cat: "haut" }])).toBe("Confortable et structurée.");
    expect(qualificatifLook(12, [{ cat: "manteau" }])).toBe("Confortable et structurée.");
  });

  it("sans couche de dessus, le conseil météo reste", () => {
    expect(qualificatifLook(17, [{ cat: "haut" }, { cat: "pantalon" }])).toBe("Confortable · Prévois une couche légère.");
  });

  it("hors de 12–19°, le qualificatif météo d'origine, en phrase", () => {
    expect(qualificatifLook(24, [{ cat: "veste" }])).toBe("Légère et confortable.");
    expect(qualificatifLook(5, [{ cat: "manteau" }])).toBe("Chaude et enveloppante.");
  });

  it("sans température connue : rien", () => {
    expect(qualificatifLook(null, [{ cat: "veste" }])).toBeNull();
  });
});
