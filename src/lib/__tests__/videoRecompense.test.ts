import { afterEach, describe, expect, it } from "vitest";
import {
  enregistrerFournisseurVideo,
  fournisseurVideo,
  peutProposerVideo,
  type FournisseurVideo,
} from "../videoRecompense";

const faux = (pret: boolean): FournisseurVideo => ({
  nom: "test",
  pret: () => pret,
  montrer: async () => "vue",
});

afterEach(() => enregistrerFournisseurVideo(null));

describe("fournisseurVideo", () => {
  it("n'en a AUCUN par défaut — état voulu tant que le SDK n'est pas arbitré", () => {
    expect(fournisseurVideo()).toBeNull();
  });

  it("s'enregistre et se retire", () => {
    const f = faux(true);
    enregistrerFournisseurVideo(f);
    expect(fournisseurVideo()).toBe(f);
    enregistrerFournisseurVideo(null);
    expect(fournisseurVideo()).toBeNull();
  });
});

describe("peutProposerVideo", () => {
  it("ne propose rien sans fournisseur — donc jamais aujourd'hui", () => {
    expect(peutProposerVideo(null, false)).toBe(false);
  });

  it("ne propose rien si le bonus du jour est déjà pris", () => {
    expect(peutProposerVideo(faux(true), true)).toBe(false);
  });

  it("ne propose rien si la vidéo n'est pas chargée", () => {
    // Une vidéo qu'on doit attendre ne se propose pas : l'attente se lit
    // comme une panne.
    expect(peutProposerVideo(faux(false), false)).toBe(false);
  });

  it("propose quand un fournisseur est prêt et le bonus disponible", () => {
    expect(peutProposerVideo(faux(true), false)).toBe(true);
  });
});
