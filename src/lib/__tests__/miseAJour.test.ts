import { describe, expect, it } from "vitest";
import { miseAJourDisponible, urlStore, URL_GOOGLE_PLAY } from "../miseAJour";
import { notifMiseAJour } from "../centreNotifications";

describe("la mise à jour de l'app (17/11/2026)", () => {
  it("seulement quand le store a un numéro de build plus grand", () => {
    expect(miseAJourDisponible(72, { numero: 75 })).toBe(true);
    expect(miseAJourDisponible(72, { numero: 72 })).toBe(false);
    expect(miseAJourDisponible(72, { numero: 70 })).toBe(false);
  });
  it("rien sans donnée : web, développement, table absente", () => {
    expect(miseAJourDisponible(null, { numero: 75 })).toBe(false);
    expect(miseAJourDisponible(72, null)).toBe(false);
    expect(miseAJourDisponible(0, { numero: 75 })).toBe(false);
  });
  it("la fiche du store : celle de la table, sinon Google Play ; pour iOS sans adresse, aucune", () => {
    expect(urlStore("android", null)).toBe(URL_GOOGLE_PLAY);
    expect(urlStore("ios", null)).toBeNull();
    expect(urlStore("ios", "https://apps.apple.com/app/id123")).toBe("https://apps.apple.com/app/id123");
  });
  it("une notification par BUILD publié, qui ouvre le store (26/11/2026)", () => {
    const n = notifMiseAJour("android", "2.7", URL_GOOGLE_PLAY, 103);
    expect(n.cle).toBe("mise_a_jour:android:103");
    // Deux builds de la même version ne partagent plus leur clé : le second est annoncé lui aussi.
    expect(notifMiseAJour("android", "2.7", URL_GOOGLE_PLAY, 104).cle).not.toBe(n.cle);
    expect(n.cible).toBe(`store:${URL_GOOGLE_PLAY}`);
    expect(n.message).toContain("Google Play");
  });
});
