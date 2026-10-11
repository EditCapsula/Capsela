import { describe, expect, it } from "vitest";
import { etatAjout, type EntreeEtatAjout } from "../etatAjout";

const base: EntreeEtatAjout = { creation: true, photo: false, envoi: false, analyse: false, analysee: false, analyseDisponible: true, saisieManuelle: false, nomRempli: false };

describe("etatAjout", () => {
  it("aucune photo : seul le choix de la photo", () => {
    expect(etatAjout(base)).toBe("initial");
  });
  it("envoi puis analyse : chargement, champs masqués", () => {
    expect(etatAjout({ ...base, photo: true, envoi: true })).toBe("chargement");
    expect(etatAjout({ ...base, photo: true, analyse: true })).toBe("chargement");
  });
  it("analyse terminée : le formulaire", () => {
    expect(etatAjout({ ...base, photo: true, analysee: true })).toBe("pret");
  });
  it("analyse sans rien lu : échec, pas de formulaire prérempli", () => {
    expect(etatAjout({ ...base, photo: true })).toBe("echec");
  });
  it("sans service d'analyse (démo) : le formulaire s'ouvre avec la photo", () => {
    expect(etatAjout({ ...base, photo: true, analyseDisponible: false })).toBe("pret");
  });
  it("la saisie à la main ouvre le formulaire, avant comme après un échec", () => {
    expect(etatAjout({ ...base, saisieManuelle: true })).toBe("pret");
    expect(etatAjout({ ...base, photo: true, saisieManuelle: true })).toBe("pret");
  });
  it("retirer la photo ramène à l'état initial", () => {
    expect(etatAjout({ ...base, photo: false })).toBe("initial");
  });
  it("modifier une pièce : toujours le formulaire", () => {
    expect(etatAjout({ ...base, creation: false })).toBe("pret");
  });
  it("un nom déjà présent sans photo (remplacer une suggestion) : le formulaire", () => {
    expect(etatAjout({ ...base, nomRempli: true })).toBe("pret");
  });
});
