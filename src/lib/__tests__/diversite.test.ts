import { afterEach, describe, expect, it, vi } from "vitest";
import { weatherForDay } from "../capsule";
import type { Weather } from "../data";
import {
  CANDIDATS_DIVERSITE,
  MARGE_PERTINENCE,
  POIDS_PIECE,
  choisirParDiversite,
  facteurMeteo,
  genererTenueDiversifiee,
  jourMoins,
  niveauPiece,
  penaliteDiversite,
  piecesPrincipales,
  recentsDuJour,
  type LookRecent,
  type RecommandationJour,
} from "../diversite";
import { isCompleteOutfit } from "../logic";
import { elaguer } from "../recommandationsRecentes";
import type { CategoryKey, HistoryEntry, Item, ShoeType } from "../types";
import type { TenuePlanifiee } from "../planifier";

// DIVERSIFICATION SUR CINQ JOURS, ET MÉTÉO (01/10/2026). La météo, l'occasion et
// les règles filtrent d'abord ; la diversité ne départage que des tenues déjà
// compatibles. Les tirages du moteur sont rendus déterministes par une graine,
// pour que ces tests ne dépendent jamais du hasard.

afterEach(() => vi.restoreAllMocks());

function graine(a: number) {
  vi.spyOn(Math, "random").mockImplementation(() => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

const p = (id: number, cat: CategoryKey, name: string, over: Partial<Item> = {}): Item =>
  ({ id, name, cat, color: "Noir", hex: "#2A2724", season: "Toutes saisons", worn: null, ...over }) as Item;
const AH = { season: "Automne / Hiver" } as Partial<Item>;
const PE = { season: "Printemps / Été" } as Partial<Item>;
const souliers = (t: string): Partial<Item> => ({ shoeType: t as ShoeType });

// Un dressing complet, aux pièces de saisons et de bornes de température variées.
const CHEMISE = p(1, "haut", "Chemise blanche", { subtype: "Chemise", color: "Blanc", hex: "#F4F1EA" });
const TSHIRT = p(2, "haut", "T-shirt", { ...PE, color: "Blanc", hex: "#F4F1EA" });
const PULL = p(3, "pull", "Pull chaud", { ...AH, color: "Camel", hex: "#B58A5A" });
const JEAN = p(4, "jean", "Jean brut", { color: "Marine", hex: "#2B3A55" });
const LIN = p(5, "pantalon", "Pantalon lin", { ...PE, meteoMinTemp: 16, color: "Beige", hex: "#D9C7A7" });
const LAINE = p(6, "pantalon", "Pantalon laine", { ...AH, meteoMaxTemp: 20 });
const SANDALES = p(7, "chaussures", "Sandales", { ...PE, ...souliers("Sandales"), meteoMinTemp: 18 });
const BASKETS = p(8, "chaussures", "Baskets", { ...souliers("Baskets"), color: "Blanc", hex: "#F4F1EA" });
const BOTTINES = p(9, "chaussures", "Bottines", { ...AH, ...souliers("Bottines") });
const ESPADRILLES = p(10, "chaussures", "Espadrilles", souliers("Espadrilles"));
const BLAZER = p(11, "veste", "Blazer", { subtype: "Blazer" });
const TRENCH = p(12, "manteau", "Trench", { ...AH, meteoMaxTemp: 22, color: "Beige", hex: "#CBB38E" });
const CABAS = p(13, "sac", "Cabas", { sacType: "Cabas" as never });
const BLOUSE = p(14, "haut", "Blouse écrue", { subtype: "Blouse", color: "Crème", hex: "#E7DCC8" });
const RAYE = p(15, "haut", "Top rayé", { color: "Marine", hex: "#2B3A55" });
const BEIGE = p(16, "pantalon", "Pantalon beige", { color: "Beige", hex: "#D9C7A7" });
const DRESSING = [CHEMISE, TSHIRT, PULL, JEAN, LIN, LAINE, SANDALES, BASKETS, BOTTINES, ESPADRILLES, BLAZER, TRENCH, CABAS, BLOUSE, RAYE, BEIGE];

const jourN = (n: number) => jourMoins("2026-10-30", 29 - n); // 2026-10-01 … : n = 1, 2, 3…
type Meteo = { temp: number; label: string; calendaire?: "Automne" | "Été" };

/** Simule des journées successives : chacune lit ce que les précédentes ont proposé. */
function semaine(pool: Item[], jours: Meteo[], diversifier: boolean, occasion: "quotidien" | "travail_formel" = "quotidien") {
  const recommandees: Record<string, RecommandationJour> = {};
  const rendu: { ids: number[]; weather: Weather }[] = [];
  jours.forEach((m, i) => {
    const jour = jourN(i + 1);
    const weather = weatherForDay(m.temp, m.label, m.calendaire ?? "Automne");
    const recents = diversifier ? recentsDuJour({ jour, portees: [], planifiees: [], recommandees }) : [];
    const r = genererTenueDiversifiee({
      pool, weather, occasion, workMode: "Présentiel", dateContext: "Verre", preferredHexes: [], gender: "femme", morphology: null, recents,
    });
    rendu.push({ ids: r.ids, weather });
    recommandees[jour] = { ids: r.ids, temp: m.temp, label: m.label };
  });
  return rendu;
}
const signature = (ids: number[]) => piecesPrincipales(ids, DRESSING).join("-");
const noms = (ids: number[]) => ids.map((id) => DRESSING.find((x) => x.id === id)?.name).join(" + ");

const reco = (ecart: number, ids: number[], temp: number | null = 18, label: string | null = "Nuageux"): LookRecent => ({ ecart, ids, temp, label });
const METEO_18 = { temp: 18, label: "Nuageux" };

// ── La pénalité ─────────────────────────────────────────────────────────────

describe("niveaux de pièces", () => {
  it("structurantes lourdes, accessoires moyens, chaussures et vestes légères", () => {
    for (const c of ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison"] as CategoryKey[]) expect(niveauPiece(c), c).toBe(1);
    for (const c of ["sac", "bijou", "accessoire"] as CategoryKey[]) expect(niveauPiece(c), c).toBe(2);
    for (const c of ["chaussures", "veste", "manteau"] as CategoryKey[]) expect(niveauPiece(c), c).toBe(3);
  });
  it("la pénalité baisse avec l'ancienneté et pèse moins sur les chaussures que sur un haut", () => {
    for (const n of [1, 2, 3] as const) for (let e = 1; e < 5; e++) expect(POIDS_PIECE[n][e]).toBeGreaterThanOrEqual(POIDS_PIECE[n][e + 1]);
    for (let e = 0; e <= 5; e++) expect(POIDS_PIECE[3][e]).toBeLessThan(POIDS_PIECE[1][e] || 1);
  });
});

describe("pénalité de répétition", () => {
  const A = [CHEMISE.id, JEAN.id, BLAZER.id, BASKETS.id];

  it("1 · doublon exact : très fortement pénalisé", () => {
    expect(penaliteDiversite(A, [reco(1, A)], DRESSING, METEO_18).total).toBeGreaterThanOrEqual(60);
  });

  it("2 · mêmes pièces principales, veste et chaussures changées : fortement pénalisé", () => {
    const J2 = [CHEMISE.id, JEAN.id, TRENCH.id, BOTTINES.id];
    expect(penaliteDiversite(J2, [reco(1, A)], DRESSING, METEO_18).total).toBeGreaterThanOrEqual(40);
  });

  it("3 · veste réutilisée, pièces principales changées : quasi aucune pénalité", () => {
    const J2 = [PULL.id, LAINE.id, BLAZER.id, BOTTINES.id];
    expect(penaliteDiversite(J2, [reco(1, A)], DRESSING, METEO_18).total).toBeLessThanOrEqual(POIDS_PIECE[3][1]);
  });

  it("3 bis · la tenue à veste réutilisée l'emporte sur celle qui répète les pièces principales", () => {
    const candidats = [
      { ids: [CHEMISE.id, JEAN.id, TRENCH.id, BOTTINES.id], score: 85 },
      { ids: [PULL.id, LAINE.id, BLAZER.id, BASKETS.id], score: 82 },
    ];
    expect(choisirParDiversite(candidats, [reco(1, A)], DRESSING, METEO_18).index).toBe(1);
  });

  it("4 · chaussures réutilisées : aucune pénalité forte", () => {
    const J2 = [PULL.id, LAINE.id, BASKETS.id];
    expect(penaliteDiversite(J2, [reco(1, A)], DRESSING, METEO_18).total).toBeLessThanOrEqual(POIDS_PIECE[3][1]);
  });

  it("4 bis · manteau noir et baskets blanches plusieurs fois dans la semaine : pas un problème", () => {
    const sortie = (extra: number[]) => [...extra, TRENCH.id, BASKETS.id];
    const recents = [reco(1, sortie([CHEMISE.id, JEAN.id])), reco(2, sortie([PULL.id, LAINE.id])), reco(3, sortie([TSHIRT.id, LIN.id]))];
    // Pièces principales nouvelles ; seuls le trench et les baskets reviennent, trois fois.
    const pen = penaliteDiversite(sortie([BLOUSE.id, BEIGE.id]), recents, DRESSING, METEO_18);
    expect(pen.total).toBeLessThan(POIDS_PIECE[1][1]);
  });

  it("5 · robe : la même robe avec d'autres accessoires reste fortement pénalisée", () => {
    const robe = p(30, "robe", "Robe noire");
    const pool = [...DRESSING, robe];
    expect(penaliteDiversite([30, BASKETS.id, CABAS.id], [reco(1, [30, BOTTINES.id])], pool, METEO_18).total).toBeGreaterThanOrEqual(40);
    // Une autre robe avec la même veste : suffisamment différent.
    const autre = p(31, "robe", "Robe fleurie");
    expect(penaliteDiversite([31, BLAZER.id], [reco(1, [30, BLAZER.id])], [...pool, autre], METEO_18).total).toBeLessThanOrEqual(POIDS_PIECE[3][1]);
  });

  it("une seule des deux pièces principales répétée : pénalité intermédiaire", () => {
    const seule = penaliteDiversite([CHEMISE.id, LAINE.id], [reco(1, [CHEMISE.id, JEAN.id])], DRESSING, METEO_18).total;
    const toutes = penaliteDiversite([CHEMISE.id, JEAN.id], [reco(1, [CHEMISE.id, JEAN.id])], DRESSING, METEO_18).total;
    const aucune = penaliteDiversite([PULL.id, LAINE.id], [reco(1, [CHEMISE.id, JEAN.id])], DRESSING, METEO_18).total;
    expect(aucune).toBeLessThan(seule);
    expect(seule).toBeLessThan(toutes);
  });

  it("plus c'est récent, plus c'est pénalisé — et la pénalité reste bornée", () => {
    // Une seule pièce principale répétée : la pénalité reste sous le plafond et se lit à chaque écart.
    const parEcart = [1, 2, 3, 4, 5].map((e) => penaliteDiversite([CHEMISE.id, LAINE.id], [reco(e, [CHEMISE.id, JEAN.id])], DRESSING, METEO_18).total);
    for (let i = 0; i < 4; i++) expect(parEcart[i]).toBeGreaterThan(parEcart[i + 1]);
    const ids = [CHEMISE.id, JEAN.id];
    const tous = [1, 2, 3, 4, 5].map((e) => reco(e, ids));
    expect(penaliteDiversite(ids, tous, DRESSING, METEO_18).total).toBeLessThanOrEqual(100);
  });
});

describe("7 · une tenue nouvelle mais plus faible n'est jamais retenue pour sa nouveauté", () => {
  it("hors de la marge de pertinence, la nouveauté ne compte pas", () => {
    const A = [CHEMISE.id, JEAN.id];
    const candidats = [
      { ids: A, score: 90 },
      { ids: [PULL.id, LAINE.id], score: 90 - MARGE_PERTINENCE - 1 },
    ];
    expect(choisirParDiversite(candidats, [reco(1, A)], DRESSING, METEO_18).index).toBe(0);
  });
  it("dans la marge, la nouveauté départage", () => {
    const A = [CHEMISE.id, JEAN.id];
    const candidats = [
      { ids: A, score: 90 },
      { ids: [PULL.id, LAINE.id], score: 90 - MARGE_PERTINENCE + 2 },
    ];
    expect(choisirParDiversite(candidats, [reco(1, A)], DRESSING, METEO_18).index).toBe(1);
  });
  it("sans historique : le premier tirage, inchangé", () => {
    const candidats = [{ ids: [CHEMISE.id, JEAN.id], score: 60 }, { ids: [PULL.id, LAINE.id], score: 95 }];
    expect(choisirParDiversite(candidats, [], DRESSING, METEO_18).index).toBe(0);
  });
});

// ── La météo dans la pénalité ───────────────────────────────────────────────

describe("diversité méteo-aware", () => {
  it("même météo : la répétition compte en entier ; météo inconnue : aussi", () => {
    expect(facteurMeteo({ temp: 18, label: "Nuageux" }, { temp: 19, label: "Ensoleillé" })).toBe(1);
    expect(facteurMeteo({ temp: 18, label: "Nuageux" }, { temp: null, label: null })).toBe(1);
  });
  it("une météo très différente (chaud/froid, pluie/sec) n'est pas une redite", () => {
    expect(facteurMeteo({ temp: 11, label: "Pluvieux" }, { temp: 25, label: "Ensoleillé" })).toBeLessThanOrEqual(0.25);
    expect(facteurMeteo({ temp: 11, label: "Nuageux" }, { temp: 25, label: "Ensoleillé" })).toBeLessThanOrEqual(0.1);
    expect(facteurMeteo({ temp: 18, label: "Nuageux" }, { temp: 18, label: "Pluie légère" })).toBeLessThan(1);
  });
  it("18° sec puis 19° sec, mêmes pièces : forte pénalité ; 25° puis 11° : réduite d'un facteur cinq au moins", () => {
    const ids = [CHEMISE.id, JEAN.id];
    const memeMeteo = penaliteDiversite(ids, [reco(1, ids, 19, "Ensoleillé")], DRESSING, { temp: 18, label: "Nuageux" }).total;
    const autreMeteo = penaliteDiversite(ids, [reco(1, ids, 25, "Ensoleillé")], DRESSING, { temp: 11, label: "Nuageux" }).total;
    expect(memeMeteo).toBeGreaterThanOrEqual(60);
    expect(autreMeteo).toBeLessThanOrEqual(memeMeteo / 5);
  });
});

// ── Le moteur : météo d'abord, diversité ensuite ────────────────────────────

describe("A · météo différente : chaque journée est adaptée à la sienne", () => {
  it("25° au soleil puis 10° : la tenue du second jour ne puise jamais dans l'été", () => {
    graine(7);
    const jours: Meteo[] = [
      { temp: 25, label: "Ensoleillé", calendaire: "Été" },
      { temp: 10, label: "Nuageux" },
      { temp: 25, label: "Ensoleillé", calendaire: "Été" },
      { temp: 10, label: "Nuageux" },
    ];
    const rendu = semaine(DRESSING, jours, true);
    rendu.forEach(({ ids, weather }) => {
      const pieces = ids.map((id) => DRESSING.find((x) => x.id === id)!);
      expect(isCompleteOutfit(pieces)).toBe(true);
      for (const it of pieces) {
        if (it.meteoMinTemp != null && !["haut", "pull", "robe", "combinaison", "jupe", "short"].includes(it.cat)) expect(weather.temp, it.name).toBeGreaterThanOrEqual(it.meteoMinTemp);
        if (it.meteoMaxTemp != null) expect(weather.temp, it.name).toBeLessThanOrEqual(it.meteoMaxTemp);
      }
    });
    // 10° : ni sandales, ni pantalon de lin. 25° : ni trench, ni pantalon de laine.
    for (const i of [1, 3]) for (const interdit of [SANDALES.id, LIN.id]) expect(rendu[i].ids, `10° n°${i}`).not.toContain(interdit);
    for (const i of [0, 2]) for (const interdit of [TRENCH.id, LAINE.id]) expect(rendu[i].ids, `25° n°${i}`).not.toContain(interdit);
  });
});

describe("B · même météo plusieurs jours : les pièces principales tournent", () => {
  const JOURS: Meteo[] = [{ temp: 18, label: "Nuageux" }, { temp: 19, label: "Nuageux" }, { temp: 18, label: "Nuageux" }];

  it("trois jours à 18° : trois combinaisons principales différentes", () => {
    graine(11);
    const rendu = semaine(DRESSING, JOURS, true);
    expect(new Set(rendu.map((r) => signature(r.ids))).size).toBe(3);
  });

  it("sur dix graines, la couche réduit nettement les répétitions de combinaison", () => {
    let sans = 0;
    let avec = 0;
    for (let g = 1; g <= 10; g++) {
      for (const [diversifier, cumul] of [[false, 0], [true, 1]] as const) {
        graine(g * 101);
        const rendu = semaine(DRESSING, [...JOURS, { temp: 19, label: "Nuageux" }, { temp: 18, label: "Nuageux" }], diversifier);
        const repetitions = rendu.length - new Set(rendu.map((r) => signature(r.ids))).size;
        if (cumul) avec += repetitions; else sans += repetitions;
        vi.restoreAllMocks();
      }
    }
    expect(avec).toBeLessThan(sans);
  });
});

describe("C · pluie : les règles météo existantes restent entières", () => {
  it("cinq jours de pluie : jamais de chaussures ouvertes, quelle que soit la diversité", () => {
    graine(5);
    const rendu = semaine(DRESSING, Array.from({ length: 5 }, (_, i) => ({ temp: 12 + (i % 2), label: "Pluvieux" })), true);
    for (const { ids } of rendu) {
      expect(ids).not.toContain(ESPADRILLES.id);
      expect(ids).not.toContain(SANDALES.id);
      expect(isCompleteOutfit(ids.map((id) => DRESSING.find((x) => x.id === id)!))).toBe(true);
    }
  });
});

describe("D · une seule combinaison adaptée : la répétition est permise", () => {
  it("un haut, un bas, des chaussures : la même tenue deux jours de suite, sans incohérence", () => {
    graine(3);
    const pool = [CHEMISE, JEAN, BASKETS, CABAS];
    const rendu = semaine(pool, [{ temp: 18, label: "Nuageux" }, { temp: 18, label: "Nuageux" }, { temp: 17, label: "Nuageux" }], true);
    for (const { ids } of rendu) expect(isCompleteOutfit(ids.map((id) => pool.find((x) => x.id === id)!))).toBe(true);
    expect(signature(rendu[1].ids)).toBe(signature(rendu[0].ids));
  });
});

describe("6 · manque de variété : deux hauts, deux bas", () => {
  it("les meilleures combinaisons possibles, toutes cohérentes, sans tourner en rond", () => {
    graine(21);
    const pool = [CHEMISE, PULL, JEAN, LAINE, BASKETS, CABAS];
    const jours: Meteo[] = Array.from({ length: 4 }, () => ({ temp: 15, label: "Nuageux" }));
    const rendu = semaine(pool, jours, true);
    for (const { ids } of rendu) expect(isCompleteOutfit(ids.map((id) => pool.find((x) => x.id === id)!))).toBe(true);
    const combos = new Set(rendu.map((r) => piecesPrincipales(r.ids, pool).join("-")));
    expect(combos.size).toBeGreaterThanOrEqual(3);
  });
});

describe("E · vestes et chaussures peuvent revenir sans empêcher la rotation", () => {
  it("un seul blazer et une seule paire de baskets : réutilisés, pendant que les pièces principales tournent", () => {
    graine(9);
    const pool = [CHEMISE, BLOUSE, RAYE, PULL, JEAN, LAINE, BASKETS, BLAZER, CABAS];
    const rendu = semaine(pool, Array.from({ length: 4 }, (_, i) => ({ temp: 18 + (i % 2), label: "Nuageux" })), true);
    expect(new Set(rendu.map((r) => piecesPrincipales(r.ids, pool).join("-"))).size).toBeGreaterThanOrEqual(3);
    for (const { ids } of rendu) expect(ids).toContain(BASKETS.id);
    expect(rendu.filter((r) => r.ids.includes(BLAZER.id)).length).toBeGreaterThanOrEqual(2);
  });
});

describe("F · changer la date recalcule le contexte, pas une graine", () => {
  const recommandees: Record<string, RecommandationJour> = {
    "2026-10-01": { ids: [1, 4], temp: 18, label: "Nuageux" },
    "2026-10-02": { ids: [3, 6], temp: 12, label: "Pluvieux" },
    "2026-10-03": { ids: [2, 5], temp: 25, label: "Ensoleillé" },
  };
  const portees = [{ id: "h", ts: new Date(2026, 9, 3, 9).getTime(), pieceIds: [1, 5], occasion: "quotidien", temp: 22, weatherLabel: "Ensoleillé" }] as HistoryEntry[];
  const planifiees = [{ id: "pl", jour: "2026-10-02", moment: "journee", occasion: "quotidien", sousChoix: null, lieu: "", typeLieu: null, dressingSeul: false, pieceIds: [4, 6], temp: 11, weatherLabel: "Pluie" }] as unknown as TenuePlanifiee[];

  it("la fenêtre glisse avec la date : J-1 à J-5 de CE jour", () => {
    const le4 = recentsDuJour({ jour: "2026-10-04", portees: [], planifiees: [], recommandees });
    expect(le4.map((r) => [r.ecart, r.ids.join(",")])).toEqual([[1, "2,5"], [2, "3,6"], [3, "1,4"]]);
    const le10 = recentsDuJour({ jour: "2026-10-10", portees: [], planifiees: [], recommandees });
    expect(le10).toEqual([]);
    const le6 = recentsDuJour({ jour: "2026-10-06", portees: [], planifiees: [], recommandees });
    expect(le6.map((r) => r.ecart)).toEqual([3, 4, 5]);
  });

  it("l'historique réel prime : porté, planifié et recommandé se cumulent par jour, sans doublon", () => {
    const le4 = recentsDuJour({ jour: "2026-10-04", portees, planifiees, recommandees });
    expect(le4.filter((r) => r.ecart === 1).map((r) => r.ids.join(","))).toEqual(["1,5", "2,5"]);
    expect(le4.filter((r) => r.ecart === 2).map((r) => r.ids.join(","))).toEqual(["4,6", "3,6"]);
  });

  it("la tenue actuellement affichée entre à l'écart 0 (« Autre tenue »)", () => {
    const r = recentsDuJour({ jour: "2026-10-04", portees: [], planifiees: [], recommandees: {}, actuelle: { ids: [1, 4], temp: 18, label: "Nuageux" } });
    expect(r).toEqual([{ ecart: 0, ids: [1, 4], temp: 18, label: "Nuageux" }]);
  });

  it("jourMoins traverse les mois et les années", () => {
    expect(jourMoins("2026-10-03", 5)).toBe("2026-09-28");
    expect(jourMoins("2026-01-02", 3)).toBe("2025-12-30");
  });

  it("la météo du jour consulté pilote l'éligibilité : deux dates, deux météos, deux tenues différentes", () => {
    graine(13);
    const [chaud, froid] = semaine(DRESSING, [{ temp: 25, label: "Ensoleillé", calendaire: "Été" }, { temp: 10, label: "Pluvieux" }], true);
    expect(chaud.ids).not.toContain(TRENCH.id);
    expect(froid.ids).not.toContain(SANDALES.id);
    expect(signature(chaud.ids)).not.toBe(signature(froid.ids));
  });
});

describe("l'historique gardé sur l'appareil", () => {
  it("élague ce qui dépasse la fenêtre et ce qui est illisible", () => {
    const t = elaguer(
      {
        "2026-10-01": { ids: [1, 2], temp: 18, label: "Nuageux" },
        "2026-08-01": { ids: [3], temp: 20, label: "Soleil" },
        "n'importe quoi": { ids: [4], temp: 1, label: "x" },
        "2026-09-30": { ids: ["a" as never], temp: 1, label: "x" },
      },
      "2026-10-02"
    );
    expect(Object.keys(t)).toEqual(["2026-10-01"]);
  });
});

describe("sans historique, le moteur d'origine", () => {
  it("un seul tirage, aucune couche appliquée", () => {
    graine(2);
    const r = genererTenueDiversifiee({ pool: DRESSING, weather: weatherForDay(18, "Nuageux", "Automne"), occasion: "quotidien", workMode: "Présentiel", dateContext: "Verre", preferredHexes: [], gender: "femme", morphology: null, recents: [] });
    expect(r.diversite).toEqual({ applique: false, candidats: 1, eligibles: 1, penalite: 0 });
    expect(r.ids.length).toBeGreaterThan(0);
  });
  it("avec historique, plusieurs candidats sont comparés", () => {
    graine(2);
    const r = genererTenueDiversifiee({ pool: DRESSING, weather: weatherForDay(18, "Nuageux", "Automne"), occasion: "quotidien", workMode: "Présentiel", dateContext: "Verre", preferredHexes: [], gender: "femme", morphology: null, recents: [reco(1, [CHEMISE.id, JEAN.id])] });
    expect(r.diversite.applique).toBe(true);
    expect(r.diversite.candidats).toBeGreaterThan(1);
    expect(r.diversite.candidats).toBeLessThanOrEqual(CANDIDATS_DIVERSITE);
  });
});

// pour que l'exemple du rapport reste vérifiable
export { noms };
