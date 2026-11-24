import { describe, expect, it } from "vitest";
import { AGE_MINIMUM, ageEn, doitDemanderNaissance, messageAge, verifierAge } from "../ageMinimum";

const AUJOURDHUI = new Date("2026-10-01T10:00:00Z");

describe("ageEn", () => {
  it("années pleines, l'anniversaire compté le jour même", () => {
    expect(ageEn("2011-10-01", AUJOURDHUI)).toBe(15);
    expect(ageEn("2011-10-02", AUJOURDHUI)).toBe(14);
    expect(ageEn("1990-01-15", AUJOURDHUI)).toBe(36);
  });
  it("une date illisible, inexistante ou future n'a pas d'âge", () => {
    for (const d of ["", "01/10/2011", "2011-13-01", "2011-02-30", "2027-01-01", "n'importe quoi"]) expect(ageEn(d, AUJOURDHUI), d).toBeNull();
  });
});

describe("verifierAge", () => {
  it("le seuil est de 15 ans", () => {
    expect(AGE_MINIMUM).toBe(15);
  });
  it("accepte à partir de 15 ans pleins", () => {
    expect(verifierAge("2011-10-01", AUJOURDHUI)).toEqual({ ok: true });
    expect(verifierAge("1985-06-20", AUJOURDHUI)).toEqual({ ok: true });
  });
  it("refuse la veille des 15 ans", () => {
    expect(verifierAge("2011-10-02", AUJOURDHUI)).toEqual({ ok: false, raison: "trop_jeune" });
    expect(verifierAge("2020-01-01", AUJOURDHUI)).toEqual({ ok: false, raison: "trop_jeune" });
  });
  it("exige une date, et une date valide", () => {
    expect(verifierAge("", AUJOURDHUI)).toEqual({ ok: false, raison: "manquante" });
    expect(verifierAge("2011-02-30", AUJOURDHUI)).toEqual({ ok: false, raison: "invalide" });
  });
  it("chaque raison a un message en clair", () => {
    expect(messageAge("trop_jeune")).toContain("15 ans");
    expect(messageAge("manquante")).toContain("date de naissance");
    expect(messageAge("invalide")).toContain("pas valide");
  });
});

describe("doitDemanderNaissance — après la connexion Google", () => {
  const base = { signedIn: true, profileLoaded: true, birthdate: null, completed: false };
  it("un compte connecté, sans date et au profil inachevé : on la demande", () => {
    expect(doitDemanderNaissance(base)).toBe(true);
  });
  it("jamais avant que le profil soit chargé — il vaut alors EMPTY_PROFILE", () => {
    expect(doitDemanderNaissance({ ...base, profileLoaded: false })).toBe(false);
  });
  it("jamais hors connexion", () => {
    expect(doitDemanderNaissance({ ...base, signedIn: false })).toBe(false);
  });
  it("jamais à un compte qui a déjà une date, ou dont le profil est terminé", () => {
    expect(doitDemanderNaissance({ ...base, birthdate: "1990-01-01" })).toBe(false);
    expect(doitDemanderNaissance({ ...base, completed: true })).toBe(false);
  });
});

describe("les tranches d'âge (24/11/2026)", () => {
  it("huit tranches, les coupures aux seuils légaux puis par dix ans", async () => {
    const { TRANCHES_AGE, libelleTranche } = await import("../ageMinimum");
    expect(TRANCHES_AGE).toEqual(["moins_15", "15_17", "18_24", "25_34", "35_44", "45_54", "55_64", "65_plus"]);
    expect(libelleTranche("15_17")).toBe("15 à 17 ans");
    expect(libelleTranche("65_plus")).toBe("65 ans et plus");
  });
  it("la tranche d'une date de naissance (comptes d'avant), aux bornes", async () => {
    const { trancheDepuisNaissance } = await import("../ageMinimum");
    expect(trancheDepuisNaissance("2011-10-02", AUJOURDHUI)).toBe("moins_15");
    expect(trancheDepuisNaissance("2011-10-01", AUJOURDHUI)).toBe("15_17");
    expect(trancheDepuisNaissance("2008-10-01", AUJOURDHUI)).toBe("18_24");
    expect(trancheDepuisNaissance("2008-10-02", AUJOURDHUI)).toBe("15_17");
    expect(trancheDepuisNaissance("1991-10-01", AUJOURDHUI)).toBe("35_44");
    expect(trancheDepuisNaissance("1961-10-01", AUJOURDHUI)).toBe("65_plus");
    expect(trancheDepuisNaissance(null, AUJOURDHUI)).toBeNull();
    expect(trancheDepuisNaissance("2011-02-30", AUJOURDHUI)).toBeNull();
  });
  it("la tranche déclarée passe avant celle de la date", async () => {
    const { trancheDuProfil } = await import("../ageMinimum");
    expect(trancheDuProfil({ trancheAge: "25_34", birthdate: "2010-01-01" }, AUJOURDHUI)).toBe("25_34");
    expect(trancheDuProfil({ trancheAge: null, birthdate: "1990-01-15" }, AUJOURDHUI)).toBe("35_44");
    expect(trancheDuProfil({ trancheAge: null, birthdate: null }, AUJOURDHUI)).toBeNull();
  });
  it("refus sous 15 ans, tranche obligatoire ; seuls les 15-17 ans sont mineurs pour la publicité", async () => {
    const { verifierTranche, messageTranche, estMineur } = await import("../ageMinimum");
    expect(verifierTranche("moins_15")).toEqual({ ok: false, raison: "trop_jeune" });
    expect(verifierTranche(null)).toEqual({ ok: false, raison: "manquante" });
    expect(verifierTranche("18_24")).toEqual({ ok: true });
    expect(messageTranche("manquante")).toContain("tranche d'âge");
    expect(messageTranche("trop_jeune")).toContain("15 ans");
    expect(estMineur("15_17")).toBe(true);
    expect(estMineur("18_24")).toBe(false);
    expect(estMineur(null)).toBe(false);
  });
  it("la tranche est demandée au compte qui n'a ni tranche ni date, au profil non terminé", async () => {
    const { doitDemanderTranche } = await import("../ageMinimum");
    const base = { signedIn: true, profileLoaded: true, trancheAge: null, birthdate: null, completed: false };
    expect(doitDemanderTranche(base)).toBe(true);
    expect(doitDemanderTranche({ ...base, trancheAge: "25_34" })).toBe(false);
    expect(doitDemanderTranche({ ...base, birthdate: "1990-01-01" })).toBe(false);
    expect(doitDemanderTranche({ ...base, completed: true })).toBe(false);
    expect(doitDemanderTranche({ ...base, profileLoaded: false })).toBe(false);
  });
});
