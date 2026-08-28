import { describe, expect, it } from "vitest";
import { computeDefaultCapsule } from "../capsule";
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
    // plafonnait 4 pièces en dessous du plafond de 35.
    const capsule = computeDefaultCapsule(profile(), at(16, "Printemps / Été"), [], "Printemps", catalogueSansRobes());
    expect(capsule.some((it) => it.cat === "robe")).toBe(false);
    expect(capsule.length).toBeGreaterThanOrEqual(35);
  });

  it("répartit le reliquat plutôt que de le verser à un seul groupe", () => {
    const capsule = computeDefaultCapsule(profile(), at(16, "Printemps / Été"), [], "Printemps", catalogueSansRobes());
    const hauts = capsule.filter((it) => it.cat === "haut").length;
    // Quota de base 8 pour le groupe hauts, plafond de complément quota/2.
    expect(hauts).toBeLessThanOrEqual(12);
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
    expect(capsule.length).toBeGreaterThanOrEqual(35);
  });
});
