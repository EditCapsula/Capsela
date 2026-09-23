import { describe, expect, it } from "vitest";
import { type Article, causeDe, cleAttendue, shortHash, verifieHashNonDerive } from "../../../scripts/clePerimee.ts";

/**
 * L'AUDIT DES CLÉS PÉRIMÉES, CONFRONTÉ AUX VRAIES LIGNES DU BALAYAGE DU
 * 23/09/2026.
 *
 * Personne ne peut lancer l'audit lui-même sans identifiants Supabase — moi
 * compris. Sa règle de décision, elle, se vérifie ici, hors ligne, sur des
 * lignes réellement rendues par la base. C'est exactement ce qui manquait à la
 * requête SQL qu'il remplace : sa règle de comparaison n'avait jamais été
 * confrontée à ses propres résultats.
 *
 * Les cas sont recopiés du balayage. Ils ne tranchent pas tous dans le même
 * sens — certains montrent que le SQL criait pour rien, d'autres qu'il avait
 * raison. C'est le résultat, pas la thèse de départ.
 */
const article = (p: Partial<Article>): Article => ({
  id: 0,
  name: null,
  category: null,
  genre: "femme",
  sous_type: null,
  couleur_dominante: null,
  matiere: null,
  coupe: null,
  prompt_image_override: null,
  silhouette_mode: null,
  details_mode: null,
  visual_asset_id: 1,
  ...p,
});

describe("clé attendue — les faux positifs du balayage SQL", () => {
  /**
   * Le SQL disait « sous_type different (seau ?), couleur differente (seau ?) »
   * sur des centaines de lignes. Pour CELLES-CI, c'était bien le regroupement
   * en seaux — pas pour toutes, cf. le bloc suivant.
   */
  it("« Blouse » + « Blanc cassé » produit bien femme_haut_chemisier_ecru", () => {
    const a = article({ id: 533, name: "Blouse légère brodée", category: "haut", sous_type: "Blouse", couleur_dominante: "Blanc cassé" });
    expect(cleAttendue(a)).toBe("femme_haut_chemisier_ecru");
  });

  it("« Cardigan » homme + « Beige » produit bien homme_pull_gilet_beige", () => {
    const a = article({ id: 511, name: "Cardigan / Maille ajourée", genre: "homme", category: "pull", sous_type: "Cardigan", couleur_dominante: "Beige" });
    expect(cleAttendue(a)).toBe("homme_pull_gilet_beige");
  });

  it("« Pull col rond » + « Gris clair » se regroupent aussi", () => {
    const a = article({ id: 864, name: "Pull col rond fin", category: "pull", sous_type: "Pull col rond", couleur_dominante: "Gris clair" });
    expect(cleAttendue(a)).toBe("femme_pull_pull_gris");
  });

  it("ces trois lignes ne sont PAS périmées, leur clé stockée est exacte", () => {
    const cas: [Article, string][] = [
      [article({ category: "haut", sous_type: "Blouse", couleur_dominante: "Blanc cassé" }), "femme_haut_chemisier_ecru"],
      [article({ genre: "homme", category: "pull", sous_type: "Cardigan", couleur_dominante: "Beige" }), "homme_pull_gilet_beige"],
      [article({ category: "pull", sous_type: "Pull col rond", couleur_dominante: "Écru" }), "femme_pull_pull_ecru"],
    ];
    for (const [a, stockee] of cas) expect(cleAttendue(a), stockee).toBe(stockee);
  });
});

/**
 * CE QUE CE BLOC EXISTE POUR CORRIGER : j'ai d'abord écrit que « la grande
 * majorité » des lignes « à vérifier » du balayage étaient des artefacts de
 * seau. C'était une inférence — les seaux existent, donc ces lignes seraient
 * des seaux — jamais une mesure. Elle est fausse.
 *
 * Mesuré : « Blouse » -> chemisier et « Cardigan » -> gilet SONT des seaux,
 * mais « Robe fleurie » -> robe_fleurie n'en a AUCUN. Les lignes dont la clé
 * stockée dit `robe` là où le sous-type dit « Robe fleurie » sont donc
 * réellement périmées, et le SQL avait raison sur celles-là.
 *
 * Distinguer les deux à l'œil est impossible : il faut appeler la fonction.
 * C'est précisément ce que fait l'audit, et ce qu'aucune lecture du balayage
 * ne remplacera.
 */
describe("faux positif ou vraie dérive — seul l'appel à la fonction tranche", () => {
  it("« Robe fleurie » n'a pas de seau : la clé stockée en `robe` est périmée", () => {
    const a = article({ id: 544, name: "Robe longue fleurie", category: "robe", sous_type: "Robe fleurie", couleur_dominante: "Écru" });
    const attendue = cleAttendue(a)!;
    expect(attendue).toBe("femme_robe_robe_fleurie_ecru");
    expect(attendue).not.toBe("femme_robe_robe_ecru");
    expect(causeDe("femme_robe_robe_ecru", attendue).cause).toBe("attribut absent à la génération");
  });

  it("« Robe sans manches » et « Robe portefeuille » non plus", () => {
    expect(cleAttendue(article({ id: 599, category: "robe", sous_type: "Robe sans manches", couleur_dominante: "Écru" })))
      .toBe("femme_robe_robe_sans_manches_ecru");
    expect(cleAttendue(article({ id: 641, category: "robe", sous_type: "Robe portefeuille", couleur_dominante: "Terracotta" })))
      .toBe("femme_robe_robe_portefeuille_terracotta");
  });

  it("une couleur changée après coup est bien une dérive, pas un seau", () => {
    // 534 : la fiche dit « Blanc cassé » (-> ecru), la clé stockée dit
    // beige_sable. Aucun seau ne relie les deux.
    const a = article({ id: 534, name: "Chemise oversize en lin", category: "haut", sous_type: "Chemise", couleur_dominante: "Blanc cassé", coupe: "Ample" });
    const attendue = cleAttendue(a)!;
    expect(attendue).toBe("femme_haut_chemise_ecru_oversize");
    expect(causeDe("femme_haut_chemise_beige_sable_oversize", attendue).cause).toBe("attribut modifié depuis");
  });
});

describe("clé attendue — les vraies périmées", () => {
  /**
   * Les collants signalés le 23/09 : clé « femme_accessoire », bâtie sans
   * sous-type ni couleur. C'est la seule famille qui justifie une
   * régénération, et le SQL la classait au même rang que les 300 autres.
   */
  it("détecte les collants servis par un visuel d'accessoire générique", () => {
    const a = article({ id: 496, name: "Collants fins transparents 15–20 DEN", category: "accessoire", sous_type: "Collants", couleur_dominante: "Noir" });
    const attendue = cleAttendue(a)!;
    expect(attendue).not.toBe("femme_accessoire");
    const { cause } = causeDe("femme_accessoire", attendue);
    expect(cause).toBe("attribut absent à la génération");
  });

  it("nomme les segments manquants plutôt qu'un motif vague", () => {
    const attendue = cleAttendue(article({ category: "accessoire", sous_type: "Collants", couleur_dominante: "Noir" }))!;
    const { detail } = causeDe("femme_accessoire", attendue);
    expect(detail).toContain("collants");
    expect(detail).toContain("noir");
  });

  it("distingue un attribut modifié depuis d'un attribut absent", () => {
    // 1056 : genre passé de homme à unisexe, la clé est complète des deux côtés.
    const attendue = cleAttendue(
      article({ id: 1056, genre: "unisexe", category: "accessoire", sous_type: "Ceinture", couleur_dominante: "Noir", matiere: "Cuir" })
    )!;
    expect(causeDe("homme_accessoire_ceinture_noir_cuir", attendue).cause).toBe("attribut modifié depuis");
  });
});

describe("marqueur bespoke — la seconde famille de faux positifs", () => {
  /**
   * 894 portait « femme_haut_surchemise_ecru_beige~bp~x94pd4 ». Un audit qui
   * ignore le marqueur déclare périmé tout article à silhouette ou détails
   * personnalisés.
   */
  it("reproduit le suffixe ~bp~ quand silhouette_mode est renseigné", () => {
    const a = article({ id: 894, category: "haut", sous_type: "Surchemise", couleur_dominante: "Écru / beige", silhouette_mode: "test" });
    const cle = cleAttendue(a)!;
    expect(cle).toContain("~bp~");
    expect(cle).toBe(`femme_haut_surchemise_ecru_beige~bp~${shortHash("test|")}`);
  });

  it("reproduit le suffixe ~ov~ quand prompt_image_override est renseigné, et il prime", () => {
    const a = article({ category: "haut", sous_type: "Surchemise", couleur_dominante: "Écru", prompt_image_override: "x", silhouette_mode: "y" });
    expect(cleAttendue(a)).toBe(`femme_haut_surchemise_ecru~ov~${shortHash("x")}`);
  });

  it("n'ajoute aucun marqueur quand les trois champs sont vides ou blancs", () => {
    const a = article({ category: "haut", sous_type: "Chemise", couleur_dominante: "Écru", silhouette_mode: "   ", details_mode: "" });
    expect(cleAttendue(a)).toBe("femme_haut_chemise_ecru");
  });
});

describe("garde-fous de l'audit lui-même", () => {
  it("s'abstient au lieu de conclure sur une catégorie inconnue du canon", () => {
    expect(cleAttendue(article({ category: "chapeau_volant", sous_type: "X", couleur_dominante: "Noir" }))).toBeNull();
  });

  it("normalise un genre absent en unisexe, comme le générateur", () => {
    expect(cleAttendue(article({ genre: null, category: "accessoire", sous_type: "Ceinture", couleur_dominante: "Noir" })))
      .toBe("unisexe_accessoire_ceinture_noir");
  });

  it("le miroir de shortHash est encore aligné sur la fonction Edge", () => {
    expect(() => verifieHashNonDerive()).not.toThrow();
  });
});
