import { describe, expect, it } from "vitest";
import { LIMITE_DRESSING_GRATUIT, estActif, peutAjouter, placesRestantes } from "../premium";

describe("droit premium", () => {
  it("aucune ligne, pas de droit", () => {
    expect(estActif(null)).toBe(false);
  });

  it("une ligne désactivée ne donne rien, même sans échéance", () => {
    expect(estActif({ actif: false, expire_le: null })).toBe(false);
  });

  it("sans échéance, le droit ne périme pas", () => {
    expect(estActif({ actif: true, expire_le: null })).toBe(true);
  });

  it("une échéance passée ferme le droit, une échéance à venir le garde", () => {
    const maintenant = new Date("2026-09-24T12:00:00Z");
    expect(estActif({ actif: true, expire_le: "2026-09-23T12:00:00Z" }, maintenant)).toBe(false);
    expect(estActif({ actif: true, expire_le: "2026-09-25T12:00:00Z" }, maintenant)).toBe(true);
  });

  it("une échéance illisible ne vaut pas un droit ouvert", () => {
    expect(estActif({ actif: true, expire_le: "pas une date" })).toBe(false);
  });
});

describe("limite du dressing gratuit", () => {
  it("l'état inconnu n'applique AUCUNE limite — le paywall échoue en ouvrant", () => {
    // Le cas qui compte : table pas encore déployée, réseau coupé, mode démo.
    // Bloquer quelqu'un parce qu'une requête n'est pas passée coûte une
    // utilisatrice ; la laisser ajouter une pièce de trop ne coûte rien.
    expect(peutAjouter("inconnu", 999)).toBe(true);
    expect(placesRestantes("inconnu", 5)).toBeNull();
  });

  it("premium n'est jamais limité", () => {
    expect(peutAjouter("premium", 999)).toBe(true);
    expect(placesRestantes("premium", 999)).toBeNull();
  });

  it("gratuit : on peut ajouter jusqu'à la limite, pas au-delà", () => {
    expect(peutAjouter("gratuit", LIMITE_DRESSING_GRATUIT - 1)).toBe(true);
    expect(peutAjouter("gratuit", LIMITE_DRESSING_GRATUIT)).toBe(false);
  });

  it("un dressing DÉJÀ au-dessus du plafond n'est pas amputé, seulement fermé à l'ajout", () => {
    // La limite porte sur l'ajout, jamais sur l'existant : personne ne perd
    // une pièce qu'il a saisie lui-même.
    expect(peutAjouter("gratuit", LIMITE_DRESSING_GRATUIT + 12)).toBe(false);
    expect(placesRestantes("gratuit", LIMITE_DRESSING_GRATUIT + 12)).toBe(0);
  });

  it("les places restantes décomptent et ne passent pas sous zéro", () => {
    expect(placesRestantes("gratuit", 0)).toBe(LIMITE_DRESSING_GRATUIT);
    expect(placesRestantes("gratuit", 14)).toBe(LIMITE_DRESSING_GRATUIT - 14);
    expect(placesRestantes("gratuit", 999)).toBe(0);
  });
});
