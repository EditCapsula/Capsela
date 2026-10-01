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
