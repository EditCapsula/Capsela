import { describe, expect, it } from "vitest";
import { lireRetourNatif, REDIRECTION_NATIVE } from "../authNatif";

// LE RETOUR DE CONNEXION DANS L'APP (17/10/2026) : le lien profond app.capsela://auth/callback.
describe("lireRetourNatif", () => {
  it("ignore tout autre lien", () => {
    expect(lireRetourNatif("https://capsela.app/?code=abc")).toBeNull();
    expect(lireRetourNatif("app.capsela://autre")).toBeNull();
  });
  it("lit le code PKCE du retour Google", () => {
    expect(lireRetourNatif(`${REDIRECTION_NATIVE}?code=abc123`)).toEqual({
      code: "abc123", accessToken: null, refreshToken: null, recuperation: false, erreur: false,
    });
  });
  it("lit des jetons passés dans le fragment", () => {
    const r = lireRetourNatif(`${REDIRECTION_NATIVE}#access_token=a&refresh_token=b&type=recovery`);
    expect(r).toMatchObject({ accessToken: "a", refreshToken: "b", recuperation: true });
  });
  it("reconnaît le retour du lien « nouveau mot de passe » et une erreur", () => {
    expect(lireRetourNatif(`${REDIRECTION_NATIVE}?reinitialisation=1&code=x`)?.recuperation).toBe(true);
    expect(lireRetourNatif(`${REDIRECTION_NATIVE}?reinitialisation=1&error=access_denied&error_code=otp_expired`)).toMatchObject({ erreur: true, recuperation: true });
  });
});
