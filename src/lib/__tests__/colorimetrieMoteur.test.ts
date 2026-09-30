import { afterEach, describe, expect, it } from "vitest";
import { colorimetrieDeSaison, SAISONS } from "../colorimetrie";
import {
  TEINTE_DU_DRESSING,
  accordVisage,
  candidatsCouleur,
  colorimetrieMoteur,
  colorimetriePourPivot,
  estPresDuVisage,
  teinteDe,
} from "../colorimetrieMoteur";
import { FALLBACK_HEX, PALETTE, type Weather } from "../data";
import { computeLookScore, generateOutfitWithFallback } from "../logic";
import { PAL_COULEURS } from "../palCouleurs";
import type { CategoryKey, Item } from "../types";

// La colorimétrie dans le moteur de tenues (30/09/2026).

const pal = (nom: string) => PAL_COULEURS.find(([n]) => n === nom)![1];
const dressing = (nom: string) => PALETTE.find(([n]) => n === nom)?.[1] ?? "#999999";
let id = 0;
const piece = (cat: CategoryKey, couleur: string, over: Partial<Item> = {}): Item =>
  ({ id: ++id, name: `${cat} ${couleur}`, cat, color: couleur, hex: dressing(couleur), season: "Toutes saisons", worn: null, ...over }) as Item;

const AUTOMNE = colorimetrieMoteur(colorimetrieDeSaison("automne", "questionnaire"))!;
const HIVER = colorimetrieMoteur(colorimetrieDeSaison("hiver", "questionnaire"))!;
const PRINTEMPS = colorimetrieMoteur(colorimetrieDeSaison("printemps", "questionnaire"))!;

/** La règle de pick() d'avant le 30/09/2026, recopiée : le bras « avant ». */
const regleOrigine = (base: Item[], prefs: string[]) => {
  const p = prefs.length ? base.filter((i) => prefs.includes(i.hex) || i.hex === FALLBACK_HEX) : [];
  return p.length ? p : base;
};

describe("teinteDe — les couleurs du dressing lues dans la palette des saisons", () => {
  it("chaque teinte du dressing a une correspondance écrite, et une seule reste sans équivalent", () => {
    for (const [nom] of PALETTE) expect(nom in TEINTE_DU_DRESSING).toBe(true);
    const sans = PALETTE.filter(([nom]) => TEINTE_DU_DRESSING[nom] === null).map(([n]) => n);
    expect(sans).toEqual(["Vert sauge"]);
    for (const cible of Object.values(TEINTE_DU_DRESSING)) if (cible) expect(PAL_COULEURS.some(([n]) => n === cible)).toBe(true);
  });

  it("corrige les écarts de hex entre les deux palettes (Terracotta, Chocolat, Corail…)", () => {
    expect(teinteDe({ hex: dressing("Terracotta"), color: "Terracotta" })).toBe(pal("Terracotta"));
    expect(teinteDe({ hex: dressing("Chocolat"), color: "Chocolat" })).toBe(pal("Chocolat"));
    expect(teinteDe({ hex: dressing("Corail"), color: "Corail" })).toBe(pal("Corail"));
    expect(teinteDe({ hex: dressing("Denim"), color: "Denim" })).toBe(pal("Bleu"));
    expect(teinteDe({ hex: pal("Rouge"), color: "Rouge" })).toBe(pal("Rouge"));
  });

  it("une couleur inconnue ne correspond à rien : repli, hex hors palette sans nom connu", () => {
    expect(teinteDe({ hex: FALLBACK_HEX, color: "Sable" })).toBeNull();
    expect(teinteDe({ hex: "#123456", color: "Fuchsia" })).toBeNull();
    // Un hex hors table mais un nom connu : le nom décide.
    expect(teinteDe({ hex: "#123456", color: "Bordeaux" })).toBe(pal("Bordeaux"));
  });
});

describe("colorimetrieMoteur", () => {
  it("rien sans colorimétrie exploitable", () => {
    expect(colorimetrieMoteur(null)).toBeNull();
    expect(colorimetrieMoteur({ statut: "aucune" })).toBeNull();
  });

  it("harmonie = signature + neutres, modération à part, métal selon la saison", () => {
    expect([...AUTOMNE.harmonie].sort()).toEqual([...SAISONS.automne.signature, ...SAISONS.automne.neutres].sort());
    expect([...AUTOMNE.loinDuVisage].sort()).toEqual([...SAISONS.automne.moderation].sort());
    expect(AUTOMNE.metal).toBe("or");
    expect(HIVER.metal).toBe("argent");
  });
});

describe("candidatsCouleur", () => {
  it("sans colorimétrie : la règle d'origine, à l'identique", () => {
    const base = [piece("haut", "Noir"), piece("haut", "Camel"), piece("haut", "Marine"), { ...piece("haut", "Sable"), hex: FALLBACK_HEX }];
    for (const prefs of [[], [pal("Camel")], [pal("Rouge")], [pal("Noir"), pal("Marine")]]) {
      expect(candidatsCouleur(base, prefs, null)).toEqual(regleOrigine(base, prefs));
    }
  });

  it("loin du visage (bas, chaussures, sac) : la règle d'origine, même avec colorimétrie", () => {
    const bas = [piece("pantalon", "Noir"), piece("jean", "Denim"), piece("pantalon", "Camel")];
    expect(candidatsCouleur(bas, [pal("Noir")], AUTOMNE)).toEqual(regleOrigine(bas, [pal("Noir")]));
    expect(candidatsCouleur(bas, [], AUTOMNE)).toEqual(bas);
  });

  it("près du visage : la couleur « avec modération » est évitée quand une autre convient", () => {
    const noir = piece("haut", "Noir");
    const bleu = piece("haut", "Denim");
    expect(candidatsCouleur([noir, bleu], [], AUTOMNE)).toEqual([bleu]);
  });

  it("… mais jamais retirée quand elle est seule : le tirage ne se vide pas", () => {
    const noir = piece("haut", "Noir");
    expect(candidatsCouleur([noir], [], AUTOMNE)).toEqual([noir]);
    expect(candidatsCouleur([noir], [pal("Noir")], AUTOMNE)).toEqual([noir]);
  });

  it("près du visage : ses couleurs préférées OU sa saison, sinon tout ce qui reste", () => {
    const camel = piece("haut", "Camel"); // préférée, automne
    const marine = piece("haut", "Marine"); // préférée, hors automne
    const kaki = piece("haut", "Kaki"); // automne, non préférée
    const bleu = piece("haut", "Denim"); // ni l'un ni l'autre
    const prefs = [pal("Camel"), pal("Marine")];
    expect(candidatsCouleur([camel, marine, kaki, bleu], prefs, AUTOMNE)).toEqual([camel, marine, kaki]);
    expect(candidatsCouleur([kaki, bleu], prefs, AUTOMNE)).toEqual([kaki]);
    expect(candidatsCouleur([marine, bleu], prefs, AUTOMNE)).toEqual([marine]);
    expect(candidatsCouleur([bleu], prefs, AUTOMNE)).toEqual([bleu]);
    expect(candidatsCouleur([kaki, bleu], [], AUTOMNE)).toEqual([kaki]);
  });

  it("levier de mesure « paliers » : la première version, préférée ET de la saison d'abord", () => {
    const camel = piece("haut", "Camel");
    const marine = piece("haut", "Marine");
    const kaki = piece("haut", "Kaki");
    const prefs = [pal("Camel"), pal("Marine")];
    const paliers = { ...AUTOMNE, strategie: "paliers" as const };
    expect(candidatsCouleur([camel, marine, kaki], prefs, paliers)).toEqual([camel]);
    expect(candidatsCouleur([marine, kaki], prefs, paliers)).toEqual([marine]);
  });

  it("une pièce sans couleur renseignée reste tirable, sans l'emporter seule sur les autres", () => {
    const inconnue = { ...piece("haut", "Sable"), hex: FALLBACK_HEX };
    const bleu = piece("haut", "Denim");
    const kaki = piece("haut", "Kaki");
    expect(candidatsCouleur([inconnue, bleu], [], AUTOMNE)).toEqual([inconnue, bleu]);
    expect(candidatsCouleur([inconnue, kaki, bleu], [], AUTOMNE)).toEqual([inconnue, kaki]);
  });

  it("bijoux : le métal de la saison, jamais sans alternative", () => {
    const dore = piece("bijou", "Doré", { name: "Collier doré", hex: "#C9A24B", metalDominant: "or" });
    const argente = piece("bijou", "Argenté", { name: "Collier argenté", hex: "#B9BEC4", metalDominant: "argent" });
    expect(candidatsCouleur([dore, argente], [], AUTOMNE)).toEqual([dore]);
    expect(candidatsCouleur([dore, argente], [], HIVER)).toEqual([argente]);
    expect(candidatsCouleur([argente], [], AUTOMNE)).toEqual([argente]);
  });

  it("foulard et écharpe sont près du visage, pas la ceinture", () => {
    expect(estPresDuVisage(piece("accessoire", "Noir", { accessoireType: "Foulard" }))).toBe(true);
    expect(estPresDuVisage(piece("accessoire", "Noir", { accessoireType: "Ceinture" }))).toBe(false);
  });
});

describe("R-S18 et pièce imposée", () => {
  it("accordVisage : une pièce du visage dans la saison, aucune « avec modération »", () => {
    expect(accordVisage([piece("haut", "Camel"), piece("pantalon", "Noir")], AUTOMNE)).toBe(true);
    expect(accordVisage([piece("haut", "Camel"), piece("veste", "Noir")], AUTOMNE)).toBe(false);
    expect(accordVisage([piece("haut", "Denim"), piece("pantalon", "Camel")], AUTOMNE)).toBe(false);
    expect(accordVisage([piece("haut", "Camel")], null)).toBe(false);
  });

  it("le score gagne 10 points avec l'accord, n'en perd jamais sans", () => {
    const w: Weather = { temp: 18, label: "Nuageux", icon: "", city: "", uv: 2, humidity: 50, wind: 10 } as unknown as Weather;
    const tenue = [piece("haut", "Camel"), piece("pantalon", "Noir"), piece("chaussures", "Noir", { shoeType: "Mocassins" })];
    const sans = computeLookScore(tenue, "quotidien", [], null, new Set(), w).score;
    const avec = computeLookScore(tenue, "quotidien", [], null, new Set(), w, undefined, undefined, [], AUTOMNE).score;
    expect(avec - sans).toBe(Math.min(10, 120 - sans));
    const horsSaison = [piece("haut", "Noir"), piece("pantalon", "Noir"), piece("chaussures", "Noir", { shoeType: "Mocassins" })];
    expect(computeLookScore(horsSaison, "quotidien", [], null, new Set(), w, undefined, undefined, [], AUTOMNE).score).toBe(
      computeLookScore(horsSaison, "quotidien", [], null, new Set(), w).score
    );
  });

  it("la teinte de la pièce imposée est tenue pour accordée le temps de ses idées", () => {
    const noir = piece("haut", "Noir");
    const c = colorimetriePourPivot(PRINTEMPS, noir)!;
    expect(c.loinDuVisage.has(pal("Noir"))).toBe(false);
    expect(c.harmonie.has(pal("Noir"))).toBe(true);
    expect(PRINTEMPS.loinDuVisage.has(pal("Noir"))).toBe(true); // l'original n'est pas modifié
    const bas = piece("pantalon", "Noir");
    expect(colorimetriePourPivot(PRINTEMPS, bas)).toBe(PRINTEMPS);
  });
});

describe("generateOutfitWithFallback — effet mesuré sur un pool, même graine pour les deux bras", () => {
  const vrai = Math.random;
  afterEach(() => {
    Math.random = vrai;
  });
  const mulberry32 = (a: number) => () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool: Item[] = [
    piece("haut", "Noir"),
    piece("haut", "Blanc"),
    piece("haut", "Camel"),
    piece("haut", "Gris"),
    piece("pantalon", "Noir"),
    piece("jean", "Denim"),
    piece("chaussures", "Noir", { shoeType: "Mocassins" }),
    piece("chaussures", "Camel", { shoeType: "Bottines" }),
  ];
  const w = { temp: 16, label: "Nuageux", icon: "", city: "", uv: 2, humidity: 50, wind: 10 } as unknown as Weather;

  it("automne : plus aucun haut noir ou gris quand le camel est là ; le noir reste en bas", () => {
    const N = 300;
    let noirGrisAvant = 0;
    let noirGrisApres = 0;
    let noirEnBasApres = 0;
    let videsAvant = 0;
    let videsApres = 0;
    for (let k = 0; k < N; k++) {
      Math.random = mulberry32(k + 1);
      const a = generateOutfitWithFallback(pool, w, "quotidien");
      Math.random = mulberry32(k + 1);
      const b = generateOutfitWithFallback(pool, w, "quotidien", undefined, undefined, [], null, undefined, undefined, AUTOMNE);
      const haut = (ids: number[]) => pool.find((p) => ids.includes(p.id) && p.cat === "haut");
      if (["Noir", "Gris"].includes(haut(a.ids)?.color ?? "")) noirGrisAvant++;
      if (["Noir", "Gris"].includes(haut(b.ids)?.color ?? "")) noirGrisApres++;
      if (b.ids.some((i) => pool.find((p) => p.id === i && p.cat === "pantalon" && p.color === "Noir"))) noirEnBasApres++;
      if (a.noCompleteOutfit) videsAvant++;
      if (b.noCompleteOutfit) videsApres++;
    }
    expect(noirGrisAvant).toBeGreaterThan(N / 4);
    expect(noirGrisApres).toBe(0);
    expect(noirEnBasApres).toBeGreaterThan(0);
    expect(videsApres).toBe(videsAvant);
  });
});
