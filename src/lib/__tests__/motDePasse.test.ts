import { describe, expect, it } from "vitest";
import { emailPlausible, lireRetourLien, messageErreurNouveauMotDePasse, validerNouveauMotDePasse } from "../motDePasse";

describe("lireRetourLien — retour du lien de l'e-mail", () => {
  it("URL ordinaire : rien", () => {
    expect(lireRetourLien("https://capsela.app/")).toBeNull();
    expect(lireRetourLien("https://capsela.app/?code=abc")).toBeNull();
  });
  it("retour de récupération (flux PKCE, notre marqueur)", () => {
    expect(lireRetourLien("https://capsela.app/?reinitialisation=1&code=abc")).toBe("recuperation");
  });
  it("retour de récupération (flux implicite, fragment)", () => {
    expect(lireRetourLien("https://capsela.app/#access_token=x&type=recovery")).toBe("recuperation");
  });
  it("lien expiré ou invalide, dans la requête ou le fragment", () => {
    expect(lireRetourLien("https://capsela.app/?reinitialisation=1&error=access_denied&error_code=otp_expired")).toBe("lien_invalide");
    expect(lireRetourLien("https://capsela.app/?reinitialisation=1#error=access_denied&error_code=otp_expired")).toBe("lien_invalide");
  });
  it("URL illisible : rien", () => {
    expect(lireRetourLien("pas une url")).toBeNull();
  });
});

describe("validation", () => {
  it("adresse e-mail plausible", () => {
    expect(emailPlausible("lea@exemple.fr")).toBe(true);
    expect(emailPlausible("lea@exemple")).toBe(false);
    expect(emailPlausible("lea exemple.fr")).toBe(false);
  });
  it("nouveau mot de passe : longueur puis concordance", () => {
    expect(validerNouveauMotDePasse("court", "court")).toBe("trop_court");
    expect(validerNouveauMotDePasse("assez-long-1", "assez-long-2")).toBe("differents");
    expect(validerNouveauMotDePasse("assez-long-1", "assez-long-1")).toBeNull();
  });
});

describe("messageErreurNouveauMotDePasse — jamais le message brut du serveur", () => {
  it("session absente ou lien expiré", () => {
    expect(messageErreurNouveauMotDePasse("Auth session missing!")).toMatch(/expiré/);
  });
  it("identique à l'ancien", () => {
    expect(messageErreurNouveauMotDePasse("New password should be different from the old password.")).toMatch(/différent/);
  });
  it("trop faible", () => {
    expect(messageErreurNouveauMotDePasse("Password should be at least 12 characters.")).toMatch(/trop faible/);
  });
  it("réseau", () => {
    expect(messageErreurNouveauMotDePasse("Failed to fetch")).toMatch(/réseau/);
  });
});
