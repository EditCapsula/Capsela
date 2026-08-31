import { describe, expect, it } from "vitest";
import { generateOutfitWithFallback } from "../logic";
import { capsuleSeasonBucket, representativeWeatherFor, weatherSeasonBucket } from "../capsule";
import type { CatalogItem } from "../catalog";
import type { CapsuleSeason } from "../types";
import { at, item } from "./fixtures";

/**
 * RÉFÉRENTIEL SAISONNIER DE LA CAPSULE — correctif du 29/08/2026.
 *
 * Défaut démontré : `representativeWeatherFor` dérive son bucket de la
 * TEMPÉRATURE (16 °C au printemps, donc "Automne / Hiver" via
 * weatherSeasonBucket dont le seuil est 20), tandis que la capsule Printemps
 * est bâtie sur "Printemps / Été" via capsuleSeasonBucket. Le filtre
 * `seasonPool` de generateOutfit écartait donc les pièces Printemps/Été de
 * leur propre capsule — 20,4 % de la capsule de printemps, pour les dix
 * occasions, pas seulement pour le palier de formalité 4.
 *
 * La correction passe la saison de la capsule à la génération. Elle ne touche
 * ni le seuil de 20 °C, ni representativeWeatherFor, ni le filtre de
 * température, ni R-B3, ni le filtre de style : la météo continue de gouverner
 * tout ce qui est physique, la capsule gouverne le référentiel saisonnier.
 */

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const DRAWS = 40;

/**
 * Garde-robe complète dont chaque pièce tombe dans le bucket demandé.
 * `saison_capsule` est une liste de saisons CALENDAIRES séparées par virgule
 * (cf. vestiaire.ts) : c'est rowToCatalogItem qui en dérive le bucket. Écrire
 * le bucket directement donnerait "Toutes saisons" et le test serait vide de
 * sens.
 */
const SAISONS_DU_BUCKET = {
  "Printemps / Été": "Printemps, Été",
  "Automne / Hiver": "Automne, Hiver",
} as const;

function garderobe(bucket: "Printemps / Été" | "Automne / Hiver", bornes: Partial<{ min: number; max: number }> = {}, base = 0): CatalogItem[] {
  const commun = { saison_capsule: SAISONS_DU_BUCKET[bucket], meteo_min_temp: bornes.min ?? null, meteo_max_temp: bornes.max ?? null };
  return [
    item({ id: base + 1, category: "hauts", name: "Top uni", sous_type: "T-shirt", niveau_formalite: "business_casual", role_piece: "base", ...commun }),
    item({ id: base + 2, category: "pantalons", name: "Pantalon droit", sous_type: "Pantalon", niveau_formalite: "business_casual", role_piece: "base", ...commun }),
    item({ id: base + 3, category: "chaussures", name: "Bottines", sous_type: "Bottines", niveau_formalite: "business_casual", ...commun }),
    item({ id: base + 4, category: "sacs", name: "Cabas", sous_type: "Cabas", niveau_formalite: "business_casual", ...commun }),
  ];
}

/** Part des tirages produisant une tenue complète. */
function tauxTenue(pool: CatalogItem[], saison: CapsuleSeason | null, w = saison ? representativeWeatherFor(saison) : at(16)): number {
  let ok = 0;
  for (let i = 0; i < DRAWS; i += 1) {
    const r = generateOutfitWithFallback(pool, w, "quotidien", "Présentiel", "Verre", [], "femme", saison);
    if (!r.noCompleteOutfit) ok += 1;
  }
  return ok / DRAWS;
}

describe("Divergence des deux buckets — le défaut lui-même", () => {
  it("seul le printemps fait diverger bucket de capsule et bucket météo", () => {
    const divergentes = SAISONS.filter((s) => capsuleSeasonBucket(s) !== weatherSeasonBucket(representativeWeatherFor(s).temp));
    expect(divergentes).toEqual(["Printemps"]);
  });

  it("representativeWeatherFor n'est pas modifié : sa température et son bucket restent ceux d'avant", () => {
    // Verrou explicite : la correction ne fabrique aucune température et ne
    // retouche pas cette fonction (elle reste cohérente avec son propre seuil).
    const w = representativeWeatherFor("Printemps");
    expect(w.temp).toBe(16);
    expect(w.season).toBe("Automne / Hiver");
    expect(w.seasons).toContain("Automne / Hiver");
  });
});

describe("A · Printemps — la capsule ne perd plus ses pièces Printemps/Été", () => {
  const pool = garderobe("Printemps / Été");

  it("sans la saison de capsule, la garde-robe de printemps est écartée (comportement d'avant)", () => {
    // La garde-robe entière étant hors bucket météo, seasonPool est vide : le
    // repli `>= 4` restaure le pool complet et la tenue sort quand même. C'est
    // exactement pourquoi le défaut est resté invisible sur les petits pools —
    // et pourquoi il ne l'était pas sur une vraie capsule de 37 pièces.
    expect(tauxTenue(pool, null, representativeWeatherFor("Printemps"))).toBe(1);
  });

  it("avec la saison de capsule, les pièces Printemps/Été sont dans le référentiel", () => {
    expect(tauxTenue(pool, "Printemps")).toBe(1);
  });

  it("le repli ne masque plus le défaut dès que le pool dépasse le seuil de 4", () => {
    // Pool mixte de plus de 4 pièces hors bucket : sans la saison de capsule,
    // seasonPool retient les seules pièces Automne/Hiver et la tenue de
    // printemps se construit sur elles ; avec la saison, les pièces
    // Printemps/Été redeviennent tirables.
    const mixte = [...garderobe("Printemps / Été"), ...garderobe("Automne / Hiver", {}, 100)];
    const w = representativeWeatherFor("Printemps");
    const sansSaison = mixte.filter((i) => w.seasons.includes(i.season));
    const avecSaison = mixte.filter((i) => i.season === capsuleSeasonBucket("Printemps") || i.season === "Toutes saisons");
    expect(sansSaison).toHaveLength(4);
    expect(sansSaison.every((i) => i.season === "Automne / Hiver")).toBe(true);
    expect(avecSaison).toHaveLength(4);
    expect(avecSaison.every((i) => i.season === "Printemps / Été")).toBe(true);
    // Aucune pièce commune : les deux référentiels désignent des ensembles disjoints.
    expect(sansSaison.some((i) => avecSaison.includes(i))).toBe(false);
  });
});

describe("B · Été — aucun changement, les deux buckets concordaient déjà", () => {
  it("la garde-robe Printemps/Été produit une tenue, avec ou sans la saison", () => {
    const pool = garderobe("Printemps / Été");
    expect(tauxTenue(pool, "Été")).toBe(1);
    expect(tauxTenue(pool, null, representativeWeatherFor("Été"))).toBe(1);
  });
});

describe("C · Automne — non-régression", () => {
  it("la garde-robe Automne/Hiver produit une tenue, avec ou sans la saison", () => {
    const pool = garderobe("Automne / Hiver");
    expect(tauxTenue(pool, "Automne")).toBe(1);
    expect(tauxTenue(pool, null, representativeWeatherFor("Automne"))).toBe(1);
  });
});

describe("D · Hiver — non-régression", () => {
  it("la garde-robe Automne/Hiver produit une tenue, avec ou sans la saison", () => {
    const pool = garderobe("Automne / Hiver");
    expect(tauxTenue(pool, "Hiver")).toBe(1);
    expect(tauxTenue(pool, null, representativeWeatherFor("Hiver"))).toBe(1);
  });
});

describe("E · Température — la compatibilité thermique reste souveraine", () => {
  it("une pièce hors de ses bornes n'est pas tirée, hors exemption existante du haut", () => {
    // Bornes 25-35 °C contre les 16 °C représentatifs du printemps : la saison
    // concorde désormais, la température non.
    //
    // Le HAUT est volontairement exclu de l'assertion : le moteur le conserve
    // sous son meteo_min_temp quand un calque peut compenser (cf. missingWarmth
    // / "chaud" dans missingCats). Vérifié à iso-bucket, avec et sans le
    // nouveau paramètre : le haut hors bornes sort dans les DEUX cas, ce
    // comportement est donc antérieur au correctif et hors de son périmètre.
    const horsBornes = garderobe("Printemps / Été", { min: 25, max: 35 }, 100);
    const dansBornes = garderobe("Printemps / Été");
    const idsDurs = new Set(horsBornes.filter((i) => i.cat !== "haut").map((i) => i.id));
    const w = representativeWeatherFor("Printemps");
    const vus = new Set<number>();
    for (let i = 0; i < DRAWS; i += 1) {
      generateOutfitWithFallback([...dansBornes, ...horsBornes], w, "quotidien", "Présentiel", "Verre", [], "femme", "Printemps")
        .ids.forEach((id) => vus.add(id));
    }
    expect(vus.size).toBeGreaterThan(0);
    expect([...vus].some((id) => idsDurs.has(id))).toBe(false);
  });

  it("la même garde-robe passe quand la température entre dans ses bornes", () => {
    const chaudSeulement = garderobe("Printemps / Été", { min: 20, max: 35 });
    expect(tauxTenue(chaudSeulement, "Été")).toBe(1);
  });
});

describe("F · Le repli seasonPool >= 4 garde son seuil et sa règle", () => {
  it("trois pièces hors référentiel déclenchent encore le repli sur le pool entier", () => {
    // Trois pièces Automne/Hiver dans une capsule de printemps : seasonPool
    // (référentiel capsule) est vide, donc < 4, donc le pool entier est
    // restauré et la tenue reste possible. Le seuil n'a pas bougé.
    const trois = garderobe("Automne / Hiver").slice(0, 3);
    const r = generateOutfitWithFallback(trois, representativeWeatherFor("Printemps"), "quotidien", "Présentiel", "Verre", [], "femme", "Printemps");
    expect(r.ids.length).toBeGreaterThan(0);
  });
});

describe("G · Tenue du jour sous météo réelle — comportement strictement inchangé", () => {
  it("sans saison de capsule, le filtre reste celui de la météo", () => {
    const ete = garderobe("Printemps / Été");
    const hiver = garderobe("Automne / Hiver", {}, 100);
    const mixte = [...ete, ...hiver];
    // Météo réelle froide, aucune saison de capsule : seules les pièces
    // Automne/Hiver doivent être tirées, exactement comme avant le correctif.
    const w = at(4, "Automne / Hiver");
    const vus = new Set<number>();
    for (let i = 0; i < DRAWS * 3; i += 1) {
      generateOutfitWithFallback(mixte, w, "quotidien", "Présentiel", "Verre", [], "femme").ids.forEach((id) => vus.add(id));
    }
    const idsHiver = new Set(hiver.map((i) => i.id));
    expect(vus.size).toBeGreaterThan(0);
    expect([...vus].every((id) => idsHiver.has(id))).toBe(true);
  });

  it("le paramètre est bien optionnel : l'appel à sept arguments compile et fonctionne", () => {
    const pool = garderobe("Automne / Hiver");
    const r = generateOutfitWithFallback(pool, at(4, "Automne / Hiver"), "quotidien", "Présentiel", "Verre", [], "femme");
    expect(r.noCompleteOutfit).toBe(false);
  });
});

describe("H · Formalité — R-B3 et le repli de formalité sont intouchés", () => {
  it("une occasion de palier 4 replie toujours quand aucune pièce ne l'atteint", () => {
    const pool = garderobe("Printemps / Été");
    const r = generateOutfitWithFallback(pool, representativeWeatherFor("Printemps"), "festive", "Présentiel", "Verre", [], "femme", "Printemps");
    expect(r.requestedFormality).toBe(4);
    expect(r.formalityDowngraded).toBe(true);
    expect(r.noCompleteOutfit).toBe(false);
  });

  it("le palier demandé ne dépend pas de la saison de capsule", () => {
    const pool = garderobe("Printemps / Été");
    const avec = generateOutfitWithFallback(pool, representativeWeatherFor("Printemps"), "festive", "Présentiel", "Verre", [], "femme", "Printemps");
    const sans = generateOutfitWithFallback(pool, representativeWeatherFor("Printemps"), "festive", "Présentiel", "Verre", [], "femme");
    expect(avec.requestedFormality).toBe(sans.requestedFormality);
  });
});
