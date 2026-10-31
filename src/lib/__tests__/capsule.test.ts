import { describe, expect, it } from "vitest";
import { CAPSULE_MAX_PIECES, computeDefaultCapsule, STRATEGIE_PRODUCTION } from "../capsule";
import type { CatalogItem } from "../catalog";
import { EMPTY_PROFILE, type Profile } from "../profile";
import { at, item } from "./fixtures";

const CATS = [
  "hauts", "pulls_gilets", "pantalons", "jeans", "jupes",
  "vestes_blazers", "manteaux_exterieurs", "chaussures", "sacs", "accessoires", "bijoux",
] as const;
const OCCS = ["quotidien", "travail_formel", "date", "soiree", "entretien", "voyage", "festive"];

/** Catalogue synthétique : n pièces par catégorie, aucune robe ni combinaison. */
function catalogueSansRobes(): CatalogItem[] {
  const out: CatalogItem[] = [];
  let id = 1;
  for (const category of CATS) {
    for (let k = 0; k < 12; k += 1) {
      out.push(item({
        id: id++, category, name: `${category} ${k}`, couleur_dominante: "Noir",
        niveau_formalite: "business_casual", role_piece: "base", occasions: OCCS[k % OCCS.length],
      }));
    }
  }
  return out;
}

function profile(over: Partial<Profile> = {}): Profile {
  return { ...EMPTY_PROFILE, gender: "femme", ...over };
}

describe("Quotas de capsule", () => {
  it("ne perd pas les places d'un groupe sans candidat (correctif 26/08/2026)", () => {
    // Les 4 places "robes-combinaisons" n'étaient jamais réattribuées : une
    // capsule homme, ou tout style qui n'utilise pas cette famille,
    // plafonnait 4 pièces en dessous du bloc à quota.
    const capsule = computeDefaultCapsule(profile(), at(16, "Printemps / Été"), [], "Printemps", catalogueSansRobes());
    expect(capsule.some((it) => it.cat === "robe")).toBe(false);
    expect(capsule.length).toBeGreaterThanOrEqual(30);
  });

  it("répartit le reliquat plutôt que de le verser à un seul groupe", () => {
    const capsule = computeDefaultCapsule(profile(), at(16, "Printemps / Été"), [], "Printemps", catalogueSansRobes());
    const hauts = capsule.filter((it) => it.cat === "haut").length;
    // Quota de base 7 pour le groupe hauts, plafond de complément quota/2.
    expect(hauts).toBeLessThanOrEqual(11);
  });
});

describe("Collants — pièce fonctionnelle garantie", () => {
  const collants = [
    item({ id: 900, category: "accessoires", name: "Collants fins 15-20 DEN", sous_type: "Collants", couleur_dominante: "Noir", styles: "Classique chic, Glamour", saison_capsule: "Printemps, Automne", meteo_min_temp: 12, meteo_max_temp: 22 }),
    item({ id: 901, category: "accessoires", name: "Collants semi-opaques 30-40 DEN", sous_type: "Collants", couleur_dominante: "Noir", styles: "Minimaliste, Glamour", saison_capsule: "Automne, Hiver", meteo_min_temp: 8, meteo_max_temp: 18 }),
    item({ id: 902, category: "accessoires", name: "Collants opaques 60-80 DEN", sous_type: "Collants", couleur_dominante: "Noir", styles: "Minimaliste", saison_capsule: "Automne, Hiver", meteo_min_temp: 3, meteo_max_temp: 15 }),
  ];
  const catalogue = [...catalogueSansRobes(), ...collants];
  const hiver = at(6);
  const tights = (c: CatalogItem[]) => c.filter((it) => it.cat === "accessoire" && it.accessoireType === "Collants");

  it("est présente en Hiver quel que soit le style, même sans correspondance", () => {
    // Aucun de ces collants n'est tagué Bohème : la garantie ne doit pas
    // pour autant laisser l'utilisatrice jambes nues.
    for (const style of ["minimaliste", "glamour", "boheme", "preppy"]) {
      const capsule = computeDefaultCapsule(profile({ styles: [style] }), hiver, [], "Hiver", catalogue);
      expect(tights(capsule).length, style).toBeGreaterThan(0);
    }
  });

  it("préfère la paire du bon style, et à défaut la plus proche thermiquement", () => {
    const capsule = computeDefaultCapsule(profile({ styles: ["glamour"] }), hiver, [], "Hiver", catalogue);
    const ids = tights(capsule).map((it) => it.id);
    // Les ids catalogue sont décalés de VESTIAIRE_ID_OFFSET au mapping : on
    // compare aux pièces mappées, jamais aux ids bruts de la fabrique.
    const [fins, semiOpaques, opaques] = collants;
    // `opaques` est le seul dans sa plage à 6 °C mais n'est pas Glamour ;
    // `semiOpaques` l'est, et c'est le plus proche thermiquement des deux
    // qui le sont — `fins` (12→22 °C) serait absurde en hiver.
    expect(ids).toContain(semiOpaques.id);
    expect(ids).not.toContain(opaques.id);
    expect(ids).not.toContain(fins.id);
  });

  it("n'est jamais imposée en Été ni sur un profil homme", () => {
    const ete = computeDefaultCapsule(profile({ styles: ["glamour"] }), at(24, "Printemps / Été"), [], "Été", catalogue);
    expect(tights(ete)).toHaveLength(0);
    const homme = computeDefaultCapsule(profile({ gender: "homme", styles: ["minimaliste"] }), hiver, [], "Hiver", catalogue);
    expect(tights(homme)).toHaveLength(0);
  });
});

describe("Doublons visuels", () => {
  /**
   * Catalogue où toutes les pièces d'une catégorie partagent la même image —
   * situation réelle du catalogue Capsela, qui mutualise volontairement les
   * visuels par clé visuelle (quatre robes écrues, une seule photo).
   */
  function catalogueAImagePartagee(): CatalogItem[] {
    const out: CatalogItem[] = [];
    let id = 1;
    for (const category of CATS) {
      for (let k = 0; k < 12; k += 1) {
        out.push(item({
          id: id++, category, name: `${category} ${k}`, couleur_dominante: "Noir",
          niveau_formalite: "business_casual", role_piece: "base", occasions: OCCS[k % OCCS.length],
          url_image: `https://exemple.test/${category}.webp`, image_status: "ready",
        }));
      }
    }
    return out;
  }

  it("ne retient jamais deux pièces affichant la même image", () => {
    const capsule = computeDefaultCapsule(profile(), at(16, "Printemps / Été"), [], "Printemps", catalogueAImagePartagee());
    const images = capsule.map((it) => it.imageUrl).filter(Boolean);
    expect(new Set(images).size).toBe(images.length);
  });

  it("ne déduplique pas les pièces sans visuel prêt", () => {
    // Sinon une capsule entière se réduirait à une pièce par groupe tant que
    // le catalogue n'a pas ses images générées.
    const capsule = computeDefaultCapsule(profile(), at(16, "Printemps / Été"), [], "Printemps", catalogueSansRobes());
    expect(capsule.length).toBeGreaterThanOrEqual(30);
  });
});

describe("Plafond de 40 pièces, Sport compris", () => {
  /** Le catalogue ci-dessus, augmenté d'un bloc Sport fourni — celui qui débordait. */
  function catalogueAvecSport(): CatalogItem[] {
    const out = catalogueSansRobes();
    let id = 9000;
    for (const category of ["hauts", "pantalons", "chaussures", "accessoires", "sacs"] as const) {
      for (let k = 0; k < 4; k += 1) {
        out.push(item({
          id: id++, category, name: `sport ${category} ${k}`, couleur_dominante: "Noir",
          niveau_formalite: "sport", role_piece: "base", occasions: "sport",
        }));
      }
    }
    return out;
  }

  it("ne dépasse jamais 40 pièces, y compris avec un bloc Sport fourni", () => {
    // Règle produit du 28/08/2026. Avant la mise en budget, aucune borne
    // n'existait sur la taille totale : les quotas sommaient à 35 hors Sport
    // et cinq mécanismes ajoutaient par-dessus (formalité, ensure×8,
    // chaussures d'intérieur, collants, Sport entier).
    for (const saison of ["Printemps", "Été", "Automne", "Hiver"] as const) {
      const temp = saison === "Été" ? 26 : saison === "Hiver" ? 5 : 16;
      const bucket = saison === "Automne" || saison === "Hiver" ? "Automne / Hiver" : "Printemps / Été";
      const capsule = computeDefaultCapsule(profile(), at(temp, bucket), [], saison, catalogueAvecSport());
      expect(capsule.length).toBeLessThanOrEqual(CAPSULE_MAX_PIECES);
    }
  });

  it("compte les pièces Sport dans le budget plutôt que par-dessus", () => {
    const capsule = computeDefaultCapsule(profile(), at(16, "Printemps / Été"), [], "Printemps", catalogueAvecSport());
    const sport = capsule.filter((it) => it.niveauFormalite === 0);
    expect(sport.length).toBeGreaterThan(0);
    expect(capsule.length).toBeLessThanOrEqual(CAPSULE_MAX_PIECES);
  });

  it("paie le budget sur le bloc à quota, jamais sur les garanties", () => {
    // Une pièce retirée ne doit coûter ni une catégorie entière, ni un palier
    // de formalité de cette catégorie : couper « les cinq dernières » aurait
    // fait sauter aussi bien un manteau qu'une occasion unique.
    const capsule = computeDefaultCapsule(profile(), at(5, "Automne / Hiver"), [], "Hiver", catalogueAvecSport());
    for (const cat of ["haut", "pantalon", "chaussures", "veste", "manteau", "sac", "accessoire", "bijou"]) {
      expect(capsule.some((it) => it.cat === cat)).toBe(true);
    }
  });
});

describe("Sport par étiquette de style (option C2, 31/10/2026)", () => {
  const TOUS = "Minimaliste, Casual chic, Classique chic, Romantique, Bohème, Streetwear, Preppy, Glamour, Créatif";
  const saisons = "Printemps, Été, Automne, Hiver";
  const sport = [
    item({ id: 950, category: "pantalons", name: "Legging de sport", niveau_formalite: "sport", styles: TOUS, saison_capsule: saisons }),
    item({ id: 951, category: "pantalons", name: "Legging imprimé", niveau_formalite: "sport", styles: "Créatif", saison_capsule: saisons }),
    item({ id: 952, category: "hauts", name: "Débardeur de sport", niveau_formalite: "sport", saison_capsule: saisons }),
    item({ id: 953, category: "pulls_gilets", name: "Sweat de sport", niveau_formalite: "sport", styles: "Streetwear", saison_capsule: saisons }),
  ];
  const catalogue = [...catalogueSansRobes(), ...sport];
  const ids = (c: CatalogItem[]) => new Set(c.filter((it) => it.niveauFormalite === 0).map((it) => it.name));
  const capsule = (styles: string[], strategy = STRATEGIE_PRODUCTION) =>
    ids(computeDefaultCapsule(profile({ styles }), at(16, "Printemps / Été"), [], "Printemps", catalogue, strategy));

  it("une pièce de sport propre à un style n'entre que dans ce style", () => {
    expect(capsule(["minimaliste"]).has("Legging imprimé")).toBe(false);
    expect(capsule(["creatif"]).has("Legging imprimé")).toBe(true);
    expect(capsule(["minimaliste"]).has("Sweat de sport")).toBe(false);
  });

  it("le sport commun (tous les styles) et le sport sans étiquette (catalogue de démo) entrent partout", () => {
    for (const st of ["minimaliste", "creatif", "glamour"]) {
      expect(capsule([st]).has("Legging de sport")).toBe(true);
      expect(capsule([st]).has("Débardeur de sport")).toBe(true);
    }
  });

  it("la règle d'avant (« commun ») reste disponible pour les audits : tout le sport, quel que soit le style", () => {
    const avant = capsule(["minimaliste"], { ...STRATEGIE_PRODUCTION, sportParStyle: "commun" });
    expect([...avant].sort()).toEqual(["Débardeur de sport", "Legging de sport", "Legging imprimé", "Sweat de sport"]);
  });
});
