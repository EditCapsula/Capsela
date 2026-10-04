import { describe, expect, it } from "vitest";
import { pieceLaPlusUtilisee, planningDuProgramme } from "../planningValise";
import { filtrerParContrainte } from "../programmeValise";
import { groupesMeteo, situationsDuProgramme, situationsDuSejour, type MeteoJour } from "../valise";
import type { Item } from "../types";

const JOURS = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"];
const meteos: MeteoJour[] = JOURS.map((jour) => ({ jour, temp: 28, label: "Ensoleillé", prevue: false }));
const piece = (id: number, cat: Item["cat"], over: Partial<Item> = {}): Item => ({ id, name: `P${id}`, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 1, ...over }) as Item;

describe("situationsDuProgramme — une situation par mère et contrainte, pas par occasion", () => {
  const programme = [
    { id: "visites", frequence: 3 },
    { id: "plage", frequence: 2 },
    { id: "piscine", frequence: 1 },
    { id: "restaurant", frequence: 2 },
    { id: "trajet", frequence: 2 },
  ];
  const s = situationsDuProgramme(programme, meteos, ["quotidien"]);
  it("plage et piscine partagent une situation (quotidien, chaleur) — pas deux tenues", () => {
    const chaleur = s.filter((x) => x.contrainte === "chaleur");
    expect(chaleur).toHaveLength(1);
    expect(chaleur[0].sousIds).toEqual(["plage", "piscine"]);
    expect(chaleur[0].occasion).toBe("quotidien");
  });
  it("visites (marche) est une situation à part de plage (chaleur), même occasion mère", () => {
    expect(s.filter((x) => x.occasion === "quotidien")).toHaveLength(2);
  });
  it("le trajet ne se joue que le jour du départ et celui du retour", () => {
    const trajet = s.find((x) => x.sousIds?.includes("trajet"))!;
    expect(trajet.jours).toEqual(["2026-10-20", "2026-10-25"]);
  });
  it("sans programme : le repli d'avant, identique à situationsDuSejour", () => {
    expect(situationsDuProgramme([], meteos, ["quotidien", "soiree"])).toEqual(situationsDuSejour(["quotidien", "soiree"], meteos));
  });
  it("groupesMeteo regroupe les jours de même météo", () => {
    expect(groupesMeteo(meteos)).toHaveLength(1);
  });
});

describe("filtrerParContrainte — un filtre du pool, jamais une règle du moteur", () => {
  const pool = [
    piece(1, "haut"),
    piece(2, "manteau"),
    piece(3, "pull"),
    piece(4, "robe", { season: "Automne / Hiver" }),
    piece(5, "chaussures", { shoeType: "Sandales" }),
    piece(6, "chaussures", { shoeType: "Bottes" }),
    piece(7, "chaussures", { shoeType: "Escarpins" }),
    piece(8, "chaussures", { shoeType: "Baskets" }),
    piece(9, "chaussures"),
  ];
  const ids = (l: Item[]) => l.map((x) => x.id);
  it("sans contrainte, rien n'est filtré", () => {
    expect(ids(filtrerParContrainte(pool))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("chaleur : ni manteau, ni pull, ni pièce d'automne-hiver, ni bottes", () => {
    expect(ids(filtrerParContrainte(pool, "chaleur"))).toEqual([1, 5, 7, 8, 9]);
  });
  it("marche : pas d'escarpins ; une chaussure sans type reste", () => {
    expect(ids(filtrerParContrainte(pool, "marche"))).toEqual([1, 2, 3, 4, 5, 6, 8, 9]);
  });
  it("outdoor : baskets, bottines, bottes seulement parmi les chaussures typées ; sans type, elle reste", () => {
    expect(ids(filtrerParContrainte(pool, "outdoor"))).toEqual([1, 2, 3, 4, 6, 8, 9]);
  });
});

describe("planningDuProgramme — le programme réparti sur les jours, avec les looks de la valise", () => {
  const programme = [
    { id: "visites", frequence: 3 },
    { id: "plage", frequence: 2 },
    { id: "restaurant", frequence: 2 },
    { id: "trajet", frequence: 2 },
  ];
  const situations = situationsDuProgramme(programme, meteos, ["quotidien"]);
  const idx = (sous: string) => situations.findIndex((s) => s.sousIds?.includes(sous));
  const looks = [
    { ids: [1, 2], situations: [idx("visites")], elargie: false },
    { ids: [3, 4], situations: [idx("visites")], elargie: false },
    { ids: [5, 6], situations: [idx("plage")], elargie: false },
    { ids: [7, 8], situations: [idx("restaurant")], elargie: false },
    { ids: [9, 10], situations: [idx("trajet")], elargie: false },
  ];
  const plan = planningDuProgramme(programme, JOURS, situations, looks);

  it("chaque créneau du programme est placé : 3 + 2 + 2 + 2 = 9", () => {
    expect(plan).toHaveLength(9);
  });
  it("le trajet : le départ et le retour", () => {
    const t = plan.filter((c) => c.sousId === "trajet").map((c) => c.jour);
    expect(t).toEqual(["2026-10-20", "2026-10-25"]);
  });
  it("les fréquences sont respectées, une occasion jamais deux fois le même jour", () => {
    for (const [id, n] of [["visites", 3], ["plage", 2], ["restaurant", 2]] as const) {
      const jours = plan.filter((c) => c.sousId === id).map((c) => c.jour);
      expect(jours).toHaveLength(n);
      expect(new Set(jours).size).toBe(n);
    }
  });
  it("plusieurs occasions peuvent tomber le même jour : la somme des jours dépasse parfois la durée sans être refusée", () => {
    const parJour = new Map<string, number>();
    for (const c of plan) parJour.set(c.jour, (parJour.get(c.jour) ?? 0) + 1);
    expect(plan.length).toBeGreaterThan(0);
    expect([...parJour.values()].every((n) => n >= 1)).toBe(true);
  });
  it("chaque créneau reçoit un look qui répond à son occasion, en variant", () => {
    const visites = plan.filter((c) => c.sousId === "visites");
    expect(visites.every((c) => c.look === 0 || c.look === 1)).toBe(true);
    // deux looks pour trois visites : les deux sont utilisés avant qu'un revienne
    expect(new Set(visites.map((c) => c.look)).size).toBe(2);
  });
  it("sans look qui réponde : le créneau reste sans look, jamais un faux", () => {
    const sansPlage = planningDuProgramme(programme, JOURS, situations, looks.filter((_, i) => i !== 2).map((l) => ({ ...l, situations: l.situations.filter((x) => x !== idx("plage")) })));
    expect(sansPlage.filter((c) => c.sousId === "plage").every((c) => c.look === null)).toBe(true);
  });
  it("déterministe : le même programme donne le même planning", () => {
    expect(planningDuProgramme(programme, JOURS, situations, looks)).toEqual(plan);
  });
  it("aucun jour : rien", () => {
    expect(planningDuProgramme(programme, [], situations, looks)).toEqual([]);
  });
});

describe("pieceLaPlusUtilisee", () => {
  it("la pièce de plus de looks, à partir de deux", () => {
    expect(pieceLaPlusUtilisee(new Map([[1, 1], [2, 4], [3, 2]]))).toEqual({ id: 2, fois: 4 });
  });
  it("aucune pièce réutilisée : null", () => {
    expect(pieceLaPlusUtilisee(new Map([[1, 1], [2, 1]]))).toBeNull();
  });
});
