import { describe, expect, it } from "vitest";
import { contexteDepuisProfil, estAvis, etapesAnalyse, personnalisationAvis, reactionErreur, repartirPiecesAvis } from "../avisStylisteClient";
import { EMPTY_PROFILE, type Profile } from "../profile";

const profil = (over: Partial<Profile> = {}): Profile => ({ ...EMPTY_PROFILE, gender: "femme", displayName: "Angela", ...over });

describe("contexteDepuisProfil — ce que le modèle reçoit (point 13)", () => {
  it("profil vide : aucun contexte, et jamais le nom", () => {
    expect(contexteDepuisProfil(profil())).toEqual({});
  });

  it("style, morphologie déclarée, palette et colorimétrie, en libellés lisibles", () => {
    const c = contexteDepuisProfil(
      profil({
        styles: ["romantique"],
        morphology: "f_sablier",
        paletteCouleurs: ["#2A2724", "#3A4152"],
        colorimetrie: { statut: "faite", libelle: "Automne chaud", signature: ["#3A4152"], neutres: ["#2A2724"], moderation: ["#8E8B85"] },
      })
    );
    expect(c).toEqual({
      style: ["Romantique"],
      morphologie: "Taille bien marquée",
      palette: ["Noir", "Marine"],
      colorimetrie: { saison: "Automne chaud", signature: ["Marine"], neutres: ["Noir"], loinDuVisage: ["Gris"] },
    });
    expect(JSON.stringify(c)).not.toContain("Angela");
  });

  it("colorimétrie non faite : non transmise", () => {
    expect(contexteDepuisProfil(profil({ colorimetrie: { statut: "encours" } })).colorimetrie).toBeUndefined();
  });
});

describe("reactionErreur — messages de la section 15, jamais techniques", () => {
  it("refus d'abonnement (401, 403) → Premium Gate", () => {
    expect(reactionErreur("non_premium")).toEqual({ action: "gate" });
    expect(reactionErreur("non_authentifie")).toEqual({ action: "gate" });
  });

  it("statut Premium invérifiable → message + Réessayer, jamais le Gate (arbitré)", () => {
    expect(reactionErreur("statut_indisponible")).toEqual({
      action: "reessayer",
      message: "Impossible d'analyser ta tenue pour le moment.",
      sousTexte: "Réessaie dans quelques instants.",
    });
  });

  it("photo floue ou sombre → message décidé + Changer de photo", () => {
    const r = reactionErreur("photo_inexploitable", "blurry");
    expect(r).toEqual({ action: "changer_photo", message: "Je n'arrive pas à lire suffisamment ta tenue. Essaie avec une photo plus nette et plus lumineuse." });
    expect(reactionErreur("photo_inexploitable", "too_dark")).toEqual(r);
  });

  it("délai, erreur de l'API, réponse invalide → même message décidé + Réessayer", () => {
    for (const code of ["delai_depasse", "erreur_modele", "reponse_invalide"] as const) {
      expect(reactionErreur(code)).toMatchObject({ action: "reessayer", message: "Impossible d'analyser ta tenue pour le moment." });
    }
  });

  it("réseau coupé → Réessayer", () => {
    expect(reactionErreur("reseau").action).toBe("reessayer");
  });
});

describe("estAvis — garde-fou d'affichage", () => {
  it("rejette une réponse sans conseil ou sans point fort", () => {
    expect(estAvis({ overallAssessment: "a", strengths: [], mainAdvice: "b", suggestions: ["c"] })).toBe(false);
    expect(estAvis({ overallAssessment: "a", strengths: ["x"], suggestions: ["c"] })).toBe(false);
    expect(estAvis({ overallAssessment: "a", strengths: ["x"], mainAdvice: "b", suggestions: ["c"] })).toBe(true);
  });
});

describe("piecesSuggerees — identifiants reçus du serveur", () => {
  it("ne garde que des entrées bien formées, 3 au plus", async () => {
    const { piecesSuggerees } = await import("../avisStylisteClient");
    expect(
      piecesSuggerees([{ id: 1, lien: "mainAdvice" }, { id: "2", lien: "x" }, { id: 3 }, { id: 4, lien: "suggestion:1" }, { id: 5, lien: "a" }, { id: 6, lien: "b" }])
    ).toEqual([{ id: 1, lien: "mainAdvice" }, { id: 4, lien: "suggestion:1" }, { id: 5, lien: "a" }]);
    expect(piecesSuggerees(undefined)).toEqual([]);
  });
});

describe("présentation du résultat — uniquement des données réelles", () => {
  const dressing = [{ id: 1 }, { id: 2 }, { id: 3 }];
  it("range chaque pièce sous le conseil ou sa suggestion, écarte celles qui ne sont plus au dressing", () => {
    const r = repartirPiecesAvis(
      [
        { id: 1, lien: "mainAdvice" },
        { id: 2, lien: "suggestion:2" },
        { id: 9, lien: "suggestion:1" },
        { id: 3, lien: "suggestion:7" },
      ],
      dressing,
      3
    );
    expect(r.conseil.map((p) => p.id)).toEqual([1]);
    expect(r.parSuggestion.map((l) => l.map((p) => p.id))).toEqual([[], [2], []]);
    expect(r.autres.map((p) => p.id)).toEqual([3]);
  });

  it("personnalisation : seulement ce qui a été envoyé", () => {
    expect(personnalisationAvis({})).toEqual([]);
    expect(personnalisationAvis({ style: ["Minimaliste"], palette: ["Camel"] })).toEqual(["ton style Minimaliste", "tes couleurs"]);
    expect(personnalisationAvis({ morphologie: "Taille bien marquée" })).toEqual(["ta silhouette"]);
  });

  it("étapes d'analyse : la comparaison au profil n'est annoncée que si elle a lieu", () => {
    expect(etapesAnalyse({})).not.toContainEqual(expect.stringMatching(/compare/));
    expect(etapesAnalyse({ style: ["Bohème"] })).toContain("Je compare avec ton style");
    expect(etapesAnalyse({ style: ["Bohème"], morphologie: "x" })).toContain("Je compare avec ton style et ta morphologie");
  });
});
