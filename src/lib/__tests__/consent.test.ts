import { describe, expect, it } from "vitest";
import { VALIDITE_CHOIX_MS, etatDepuisStockage } from "../consent";

// Le choix de mesure d'audience expire après six mois (CNIL ; docs/legal/README.md, écart 7).

const MAINTENANT = Date.parse("2026-10-01T12:00:00Z");
const choix = (etat: string, le: number) => JSON.stringify({ etat, le });

describe("etatDepuisStockage", () => {
  it("un choix récent est conservé", () => {
    expect(etatDepuisStockage(choix("granted", MAINTENANT - 24 * 3600 * 1000), MAINTENANT)).toBe("granted");
    expect(etatDepuisStockage(choix("denied", MAINTENANT), MAINTENANT)).toBe("denied");
  });

  it("passé six mois, il redevient « pas encore demandé » — accord comme refus", () => {
    expect(etatDepuisStockage(choix("granted", MAINTENANT - VALIDITE_CHOIX_MS - 1), MAINTENANT)).toBe("unknown");
    expect(etatDepuisStockage(choix("denied", MAINTENANT - VALIDITE_CHOIX_MS - 1), MAINTENANT)).toBe("unknown");
  });

  it("pile à l'échéance, il a expiré ; un jour avant, non", () => {
    expect(etatDepuisStockage(choix("granted", MAINTENANT - VALIDITE_CHOIX_MS), MAINTENANT)).toBe("unknown");
    expect(etatDepuisStockage(choix("granted", MAINTENANT - VALIDITE_CHOIX_MS + 24 * 3600 * 1000), MAINTENANT)).toBe("granted");
  });

  it("l'échéance est d'environ six mois", () => {
    expect(VALIDITE_CHOIX_MS / (24 * 3600 * 1000)).toBe(183);
  });

  it("un choix d'avant la règle, sans date, est redemandé une fois", () => {
    expect(etatDepuisStockage("granted", MAINTENANT)).toBe("unknown");
    expect(etatDepuisStockage("denied", MAINTENANT)).toBe("unknown");
  });

  it("rien, ou une valeur illisible : « pas encore demandé »", () => {
    for (const brut of [null, "", "n'importe quoi", "{}", choix("peut-être", MAINTENANT), JSON.stringify({ etat: "granted" })]) {
      expect(etatDepuisStockage(brut, MAINTENANT), String(brut)).toBe("unknown");
    }
  });
});
