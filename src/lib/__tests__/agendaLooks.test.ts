import { describe, expect, it } from "vitest";
import {
  PASSEES_AVEC_IMAGE,
  SUIVANTS_AVEC_IMAGE,
  composerAgenda,
  detailCapsela,
  echeanceCourte,
  looksDisponibles,
  occasionsDuVoyage,
  sousTitreAgenda,
} from "../agendaLooks";
import type { TenuePlanifiee } from "../planifier";
import type { CategoryKey, Item } from "../types";
import type { Planification, ValiseGardee } from "../valises";

// « Mes looks à venir » — l'agenda de looks de Planifier (30/09/2026).

const tenue = (jour: string, id = jour): Planification => ({
  type: "tenue",
  tenue: {
    id,
    jour,
    moment: "Soirée",
    occasion: "soiree",
    sousChoix: null,
    lieu: "Gagny, Île-de-France, France",
    typeLieu: null,
    dressingSeul: false,
    pieceIds: [],
    temp: null,
    weatherLabel: null,
  } satisfies TenuePlanifiee,
});
const valise = (id: string, over: Partial<ValiseGardee> = {}): Planification => ({
  type: "valise",
  valise: {
    version: 2,
    id,
    destination: "Rhodes",
    depart: "2026-10-01",
    retour: "2026-10-04",
    bagage: "cabine",
    sejour: null,
    occasions: [],
    meteos: [],
    situations: [],
    pieceIds: [],
    looks: [],
    situationsSansLook: [],
    ...over,
  } as ValiseGardee,
});
const item = (id: number, cat: CategoryKey, over: Partial<Item> = {}): Item =>
  ({ id, name: `${cat} ${id}`, cat, color: "Noir", hex: "#111", season: "Toutes saisons", worn: null, ...over }) as Item;

describe("composerAgenda — trois niveaux, jamais une liste de cartes identiques", () => {
  it("à venir : le premier look est le héros, les suivants la frise, le reste en lignes", () => {
    const liste = ["2026-10-04", "2026-10-11", "2026-10-15", "2026-10-20", "2026-10-25", "2026-11-02"].map((j) => tenue(j));
    const a = composerAgenda(liste, "up");
    expect(a.prochain?.jour).toBe("2026-10-04");
    expect(a.suivants.map((t) => t.jour)).toEqual(["2026-10-11", "2026-10-15", "2026-10-20"]);
    expect(a.suivants).toHaveLength(SUIVANTS_AVEC_IMAGE);
    expect(a.plusTard.map((t) => t.jour)).toEqual(["2026-10-25", "2026-11-02"]);
  });

  it("un seul look : le héros reste, la frise disparaît", () => {
    const a = composerAgenda([tenue("2026-10-04")], "up");
    expect(a.prochain?.jour).toBe("2026-10-04");
    expect(a.suivants).toEqual([]);
    expect(a.plusTard).toEqual([]);
  });

  it("les voyages vont en contexte, jamais en héros — même s'ils sont les premiers", () => {
    const a = composerAgenda([valise("v1"), tenue("2026-10-04")], "up");
    expect(a.voyages.map((v) => v.id)).toEqual(["v1"]);
    expect(a.prochain?.jour).toBe("2026-10-04");
    const seul = composerAgenda([valise("v1")], "up");
    expect(seul.prochain).toBeNull();
  });

  it("passées : pas de héros, une frise plus courte, le reste en lignes", () => {
    const liste = ["2026-09-20", "2026-09-15", "2026-09-10", "2026-09-05", "2026-09-01"].map((j) => tenue(j));
    const a = composerAgenda(liste, "past");
    expect(a.prochain).toBeNull();
    expect(a.suivants).toHaveLength(PASSEES_AVEC_IMAGE);
    expect(a.plusTard.map((t) => t.jour)).toEqual(["2026-09-01"]);
  });

  it("rien de planifié : tout est vide", () => {
    expect(composerAgenda([], "up")).toEqual({ voyages: [], prochain: null, suivants: [], plusTard: [] });
  });
});

describe("mises en mots", () => {
  it("sous-titre accordé, et rien à zéro", () => {
    expect(sousTitreAgenda(4)).toBe("4 occasions préparées");
    expect(sousTitreAgenda(1)).toBe("1 occasion préparée");
    expect(sousTitreAgenda(0)).toBeNull();
  });

  it("échéance : aujourd'hui, demain, dans n jours, puis la date parle seule", () => {
    expect(echeanceCourte("2026-09-30", "2026-09-30")).toBe("Aujourd'hui");
    expect(echeanceCourte("2026-10-01", "2026-09-30")).toBe("Demain");
    expect(echeanceCourte("2026-10-07", "2026-09-30")).toBe("Dans 7 jours");
    expect(echeanceCourte("2026-10-08", "2026-09-30")).toBeNull();
    expect(echeanceCourte("2026-09-29", "2026-09-30")).toBeNull();
  });

  it("occasions d'un voyage : sans doublon, quatre au plus", () => {
    const v = { occasions: ["quotidien", "soiree", "soiree", "sport", "festive", "date"] as ValiseGardee["occasions"] };
    expect(occasionsDuVoyage(v)).toHaveLength(4);
    expect(new Set(occasionsDuVoyage(v)).size).toBe(4);
  });

  it("looks d'un voyage : seulement ceux dont toutes les pièces sont encore là", () => {
    const v = { looks: [{ ids: [1, 2], situations: [0], elargie: false }, { ids: [1, 9], situations: [0], elargie: false }] };
    expect(looksDisponibles(v, [{ id: 1 }, { id: 2 }])).toBe(1);
  });
});

describe("detailCapsela — le conseil lu sur les pièces réelles", () => {
  it("donne une phrase pour un look de plusieurs pièces", () => {
    const pieces = [item(1, "robe"), item(2, "veste"), item(3, "chaussures")];
    const phrase = detailCapsela(pieces, "soiree");
    expect(phrase).toBeTruthy();
    expect(phrase!.length).toBeGreaterThan(10);
  });

  it("rien pour une pièce seule ou aucune : l'écran se replie sur la phrase de l'occasion", () => {
    expect(detailCapsela([item(1, "robe")], "soiree")).toBeNull();
    expect(detailCapsela([], "soiree")).toBeNull();
  });
});
