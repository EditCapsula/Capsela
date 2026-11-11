import { describe, expect, it } from "vitest";
import { composerValiseVariee, plafondPrincipale, plancherDesEntrees, situationsDuProgramme, situationsDuSejour, type Generateur, type MeteoJour } from "../valise";
import type { CategoryKey, Item } from "../types";
import { planningDuProgramme } from "../planningValise";

// La composition variée (11/11/2026) : les leviers A (variété sur tout le séjour) et B (adaptation), inertes en production.

const piece = (id: number, cat: CategoryKey): Item => ({ id, name: `P${id}`, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 1 });
const meteo = (jour: string): MeteoJour => ({ jour, temp: 22, label: "Ensoleillé", prevue: true });
const quatreJours = situationsDuSejour(["quotidien"], ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10"].map(meteo));

/** Un générateur qui rend, tour à tour, les tenues possibles dans le pool ; `relachees` : les tenues que le moteur a dû relâcher. */
const generateur = (tenues: number[][], relachees: number[][] = []): Generateur => {
  let n = 0;
  return (pool) => {
    const possibles = [...tenues, ...relachees].filter((ids) => ids.every((id) => pool.some((p) => p.id === id)));
    if (!possibles.length) return null;
    const t = possibles[n++ % possibles.length];
    return { ids: t, elargie: relachees.includes(t) };
  };
};

// 1-4 hauts · 10 combinaison · 11-13 bas · 20-21 chaussures · 30 sac
const DRESSING = [piece(1, "haut"), piece(2, "haut"), piece(3, "haut"), piece(4, "haut"), piece(10, "combinaison"), piece(11, "pantalon"), piece(12, "jupe"), piece(13, "jean"), piece(20, "chaussures"), piece(21, "chaussures"), piece(30, "sac")];
const TENUES = [[10, 20, 30], [10, 21, 30], [1, 11, 20, 30], [2, 12, 21, 30], [3, 13, 20, 30]];

describe("composerValiseVariee — A : la variété sur tout le séjour", () => {
  it("sans A, une seule pièce polyvalente porte tout le séjour ; avec A, les pièces principales tournent", () => {
    const sans = composerValiseVariee(DRESSING, [], quatreJours, 40, generateur(TENUES), {});
    const avec = composerValiseVariee(DRESSING, [], quatreJours, 40, generateur(TENUES), { variete: true });
    const principales = (looks: { ids: number[] }[]) => new Set(looks.flatMap((l) => l.ids).filter((id) => [10, 11, 12, 13].includes(id))).size;
    expect(principales(sans.looks)).toBe(1);
    expect(principales(avec.looks)).toBeGreaterThanOrEqual(3);
  });

  it("chaque situation reçoit son look avant que la variété n'occupe la place", () => {
    const jours = ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10"].map(meteo);
    const deux = [...situationsDuSejour(["quotidien"], jours), ...situationsDuSejour(["soiree"], [jours[0]])];
    const quotidien = generateur(TENUES);
    const soiree = generateur([[12, 21, 30]]);
    const gen: Generateur = (pool, s) => (s.occasion === "soiree" ? soiree : quotidien)(pool, s);
    const r = composerValiseVariee(DRESSING, [], deux, 9, gen, { variete: true });
    expect(r.situationsSansLook).toEqual([]);
  });

  it("une petite valise limite la variété, une grande la permet", () => {
    const petite = composerValiseVariee(DRESSING, [], quatreJours, 6, generateur(TENUES), { variete: true });
    const grande = composerValiseVariee(DRESSING, [], quatreJours, 40, generateur(TENUES), { variete: true });
    expect(grande.looks.length).toBeGreaterThan(petite.looks.length);
  });
});

describe("composerValiseVariee — B : le dressing ne passe avant que s'il convient", () => {
  // Le dressing n'a qu'une tenue relâchée par le moteur ; la capsule (100-102) en offre une adaptée.
  const dressing = [piece(1, "haut"), piece(11, "pantalon"), piece(20, "chaussures"), piece(30, "sac")];
  const capsule = [piece(100, "robe"), piece(101, "chaussures"), piece(102, "sac")];
  const gen = () => generateur([[100, 101, 102]], [[1, 11, 20, 30]]);

  it("sans B, la tenue relâchée du dressing est retenue", () => {
    const r = composerValiseVariee(dressing, capsule, quatreJours, 40, gen(), {});
    expect(r.suggestionIds).toEqual([]);
    expect(r.looks.every((l) => l.elargie)).toBe(true);
  });

  it("avec B, la tenue adaptée de la capsule la remplace, ses pièces dites suggestions", () => {
    const r = composerValiseVariee(dressing, capsule, quatreJours, 40, gen(), { adaptation: true });
    expect(r.looks.some((l) => !l.elargie && l.ids.includes(100))).toBe(true);
    expect(r.suggestionIds.sort()).toEqual([100, 101, 102]);
  });

  it("à adaptation égale, le dressing passe devant la capsule", () => {
    const r = composerValiseVariee(dressing, capsule, quatreJours, 40, generateur([[1, 11, 20, 30], [100, 101, 102]]), { adaptation: true });
    expect(r.looks[0].ids).toEqual([1, 11, 20, 30]);
  });
});

describe("les niveaux de formalité d'un séjour (PLANCHERS_VACANCES, 11/11/2026)", () => {
  const jours = ["2026-12-07", "2026-12-08", "2026-12-09"].map(meteo);
  const programme = [{ id: "trajet", frequence: 2 }, { id: "restaurant", frequence: 2 }, { id: "ceremonie", frequence: 1 }, { id: "visites", frequence: 2 }];

  it("trajet 1, restaurant 2, cérémonie 4 ; sans niveau fixé, rien ne change", () => {
    expect(plancherDesEntrees(["trajet"])).toBe(1);
    expect(plancherDesEntrees(["restaurant", "diner", "sortie_vacances"])).toBe(2);
    expect(plancherDesEntrees(["ceremonie"])).toBe(4);
    expect(plancherDesEntrees(["visites"])).toBeUndefined();
  });

  it("le levier porte le niveau sur la situation ; sans lui, les situations sont celles d'avant", () => {
    const avec = situationsDuProgramme(programme, jours, ["quotidien"], { planchersVacances: true });
    const sans = situationsDuProgramme(programme, jours, ["quotidien"]);
    expect(avec.find((s) => s.sousIds?.includes("restaurant"))?.plancher).toBe(2);
    expect(avec.find((s) => s.sousIds?.includes("trajet"))?.plancher).toBe(1);
    expect(avec.find((s) => s.sousIds?.includes("visites"))?.plancher).toBeUndefined();
    expect(sans.every((s) => s.plancher === undefined)).toBe(true);
  });
});

describe("le plafond d'une pièce principale", () => {
  it("un créneau sur quatre, deux au moins", () => {
    expect(plafondPrincipale(4)).toBe(2);
    expect(plafondPrincipale(12)).toBe(3);
    expect(plafondPrincipale(16)).toBe(4);
  });

  it("une même combinaison ne dépasse pas le plafond tant qu'une autre tenue tient", () => {
    const huit = situationsDuSejour(["quotidien"], ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13", "2026-12-14"].map(meteo));
    const r = composerValiseVariee(DRESSING, [], huit, 40, generateur(TENUES), { variete: true, plafond: true });
    expect(r.looks.length).toBeGreaterThanOrEqual(3);
  });
});

describe("la répartition par pièces (planningDuProgramme, poidsPiece)", () => {
  const jours = ["2026-12-07", "2026-12-08", "2026-12-09"];
  const situations = situationsDuProgramme([{ id: "visites", frequence: 3 }], jours.map(meteo), ["quotidien"]);
  // Deux looks partagent la combinaison 10 ; le troisième est fait d'autres pièces.
  const looks = [
    { ids: [10, 20, 30], situations: [0], elargie: false },
    { ids: [10, 21, 30], situations: [0], elargie: false },
    { ids: [1, 11, 20, 30], situations: [0], elargie: false },
  ];
  const poids = (id: number) => (id === 10 || id === 11 ? 3 : id === 1 ? 1.5 : 0);

  it("sans poids, les deux looks à la combinaison passent pour variés ; avec, la combinaison ne revient qu'à défaut", () => {
    const sans = planningDuProgramme([{ id: "visites", frequence: 3 }], jours, situations, looks);
    const avec = planningDuProgramme([{ id: "visites", frequence: 3 }], jours, situations, looks, [], {}, undefined, poids);
    const combinaison = (p: typeof sans) => p.filter((c) => c.look != null && looks[c.look].ids.includes(10)).length;
    expect(combinaison(sans)).toBe(2);
    expect(combinaison(avec)).toBeLessThanOrEqual(2);
    expect(avec.slice(0, 2).map((c) => c.look)).toContain(2);
  });
});

describe("la cible de volume (cibleDeVolume)", () => {
  it("sous sa cible, la valise reçoit de nouvelles tenues ; sans cible, elle s'arrête aux créneaux", () => {
    const deuxJours = situationsDuSejour(["quotidien"], ["2026-12-07", "2026-12-08"].map(meteo));
    const sans = composerValiseVariee(DRESSING, [], deuxJours, 40, generateur(TENUES), { variete: true });
    const avec = composerValiseVariee(DRESSING, [], deuxJours, 40, generateur(TENUES), { variete: true }, undefined, 14);
    expect(avec.looks.length).toBeGreaterThan(sans.looks.length);
  });
});
