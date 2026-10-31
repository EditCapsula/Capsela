import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE, completudeProfil, prochaineActionProfil, type Profile } from "../profile";

const complet: Profile = {
  ...EMPTY_PROFILE,
  gender: "femme",
  styles: ["minimaliste"],
  morphology: "f_sablier",
  paletteCouleurs: ["#1D1A16"],
  tailleHaut: "M",
  tailleBas: "40",
  pointure: "39",
  preferencesSilhouette: { miseEnValeur: ["taille"], coupes: [] },
};

describe("complétude du profil style", () => {
  it("profil féminin complet : 7 sur 7, rien ne manque", () => {
    const c = completudeProfil(complet);
    expect(c).toMatchObject({ total: 7, renseignes: 7, pourcentage: 100 });
    expect(c.manquants).toEqual([]);
  });

  it("profil vide : la morphologie n'est pas comptée tant que le genre est inconnu", () => {
    const c = completudeProfil(EMPTY_PROFILE);
    expect(c.total).toBe(6);
    expect(c.manquants.map((m) => m.cle)).toEqual(["genre", "style", "mise_en_valeur", "coupes", "palette", "tailles"]);
    expect(c.pourcentage).toBe(0);
  });

  it("côté Homme, la morphologie n'existe pas : elle n'est ni comptée ni manquante", () => {
    const c = completudeProfil({ ...complet, gender: "homme", styles: ["minimaliste"], morphology: null });
    expect(c.total).toBe(6);
    expect(c.manquants).toEqual([]);
  });

  it("des tailles partielles ne comptent pas comme renseignées", () => {
    const c = completudeProfil({ ...complet, pointure: null });
    expect(c.manquants.map((m) => m.cle)).toEqual(["tailles"]);
    expect(c.pourcentage).toBe(86);
  });

  it("une morphologie hors des valeurs du genre compte comme manquante", () => {
    const c = completudeProfil({ ...complet, morphology: "valeur_inconnue" });
    expect(c.manquants.map((m) => m.cle)).toEqual(["morphologie"]);
  });

  it("mise en valeur et coupes (31/10/2026) : jamais posées = manquantes ; la réponse neutre vaut réponse", () => {
    const jamais = completudeProfil({ ...complet, preferencesSilhouette: { miseEnValeur: null, coupes: null } });
    expect(jamais.manquants.map((m) => m.cle)).toEqual(["mise_en_valeur", "coupes"]);
    expect(jamais.pourcentage).toBe(71);
    const neutres = completudeProfil({ ...complet, preferencesSilhouette: { miseEnValeur: [], coupes: [] } });
    expect(neutres.pourcentage).toBe(100);
  });

  it("homme : une mise en valeur réservée à un autre genre (décolleté) ne compte pas comme réponse", () => {
    const c = completudeProfil({ ...complet, gender: "homme", morphology: null, preferencesSilhouette: { miseEnValeur: ["decollete"], coupes: [] } });
    expect(c.manquants.map((m) => m.cle)).toEqual(["mise_en_valeur"]);
  });

  it("un style non proposé pour le genre ne compte pas", () => {
    const c = completudeProfil({ ...complet, styles: ["id_inexistant"] });
    expect(c.manquants.map((m) => m.cle)).toEqual(["style"]);
  });
});

describe("prochaine action du profil — dérivée des champs réellement manquants", () => {
  it("profil complet : aucune action", () => {
    expect(prochaineActionProfil(complet)).toBeNull();
  });
  it("pointure seule manquante : le message et le bouton parlent de la pointure, vers l'étape des tailles", () => {
    const a = prochaineActionProfil({ ...complet, pointure: "" });
    expect(a).toMatchObject({ cle: "tailles", cta: "Renseigner ma pointure" });
    expect(a!.message).toContain("pointure");
  });
  it("morphologie manquante : l'action est la morphologie, sans message négatif", () => {
    const a = prochaineActionProfil({ ...complet, morphology: null });
    expect(a).toMatchObject({ cle: "morphologie", cta: "Compléter ma morphologie" });
    expect(a!.message).not.toMatch(/cacher|corriger|défaut|grossir|amincir/i);
  });
  it("priorité = ordre du questionnaire : le genre avant le style, avant les tailles", () => {
    expect(prochaineActionProfil(EMPTY_PROFILE)?.cle).toBe("genre");
    expect(prochaineActionProfil({ ...EMPTY_PROFILE, gender: "femme" })?.cle).toBe("style");
    expect(prochaineActionProfil({ ...complet, tailleHaut: "", pointure: "" })?.cta).toBe("Renseigner ma taille de haut");
  });
  it("mise en valeur manquante : action honnête, sans promesse sur les recommandations", () => {
    const a = prochaineActionProfil({ ...complet, preferencesSilhouette: { miseEnValeur: null, coupes: [] } });
    expect(a?.cle).toBe("mise_en_valeur");
    expect(a!.message).not.toMatch(/recommand|adapte/i);
  });
  it("homme : la morphologie n'est jamais proposée", () => {
    const a = prochaineActionProfil({ ...complet, gender: "homme", morphology: null, pointure: "" });
    expect(a?.cle).toBe("tailles");
  });
  it("cohérent avec le pourcentage : une action existe exactement quand le profil n'est pas à 100 %", () => {
    for (const p of [complet, { ...complet, palette: undefined, paletteCouleurs: [] }, EMPTY_PROFILE] as Profile[]) {
      expect(prochaineActionProfil(p) === null).toBe(completudeProfil(p).pourcentage === 100);
    }
  });
});
