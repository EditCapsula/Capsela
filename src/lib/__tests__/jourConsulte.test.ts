import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS } from "../profile";
import { JOUR_MAX, borneJour, complementTenue, dateDuJour, libelleJour, momentMessage, occasionParDefaut, quandPhrase } from "../jourConsulte";

const DIMANCHE = new Date(2026, 8, 27, 15, 30); // dimanche 27 septembre 2026

describe("jourConsulte — une date, ses mots", () => {
  it("la date consultée, à minuit, y compris au changement de mois", () => {
    expect(dateDuJour(0, DIMANCHE)).toEqual(new Date(2026, 8, 27));
    expect(dateDuJour(4, DIMANCHE)).toEqual(new Date(2026, 9, 1));
  });

  it("borné à l'horizon de la prévision", () => {
    expect(JOUR_MAX).toBe(4);
    expect(borneJour(-1)).toBe(0);
    expect(borneJour(9)).toBe(4);
  });

  it("les libellés du sélecteur", () => {
    expect(libelleJour(0, dateDuJour(0, DIMANCHE))).toBe("Aujourd'hui · dimanche 27");
    expect(libelleJour(1, dateDuJour(1, DIMANCHE))).toBe("Demain · lundi 28");
    expect(libelleJour(2, dateDuJour(2, DIMANCHE))).toBe("Mardi 29 septembre");
  });

  it("le titre, la phrase, le message", () => {
    expect(complementTenue(0, DIMANCHE)).toBe("du jour");
    expect(complementTenue(1, dateDuJour(1, DIMANCHE))).toBe("de demain");
    expect(complementTenue(2, dateDuJour(2, DIMANCHE))).toBe("du mardi 29");
    expect(quandPhrase(3, dateDuJour(3, DIMANCHE))).toBe("mercredi");
    expect(momentMessage(0, DIMANCHE)).toBeUndefined();
    expect(momentMessage(2, dateDuJour(2, DIMANCHE))).toBe("pour mardi 29");
  });
});

describe("occasionParDefaut — la règle de « Mon rythme », pour n'importe quelle date", () => {
  const prefs = { ...DEFAULT_PREFS, workDays: ["Lun", "Mar", "Mer", "Jeu", "Ven"], onVacation: false };

  it("lundi travaillé → travail ; dimanche → quotidien", () => {
    expect(occasionParDefaut(prefs, dateDuJour(1, DIMANCHE))).toBe("travail_formel");
    expect(occasionParDefaut(prefs, DIMANCHE)).toBe("quotidien");
  });

  it("en congés → cocooning, quel que soit le jour", () => {
    expect(occasionParDefaut({ ...prefs, onVacation: true }, dateDuJour(1, DIMANCHE))).toBe("cocooning");
  });
});
