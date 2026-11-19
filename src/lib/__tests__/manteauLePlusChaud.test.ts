import { describe, expect, it } from "vitest";
import { manteauxParChaleur, manteauxPourLaCouche, separerCoucheExterieure } from "../coucheExterieure";
import { plafondDuSousType } from "../plafondManteau";
import { rowToItem } from "../dressing";
import { at, item } from "./fixtures";
import type { Item } from "../types";

/**
 * LE MANTEAU LE PLUS ADAPTÉ À LA MINIMALE (19/11/2026, arbitré ; signalé : « le trench coat est trop léger pour des températures min de
 * 2 degrés »). Les manteaux sont admis à la minimale du jour, le plus chaud (plafond le plus bas) passe devant ; un manteau de la tenue
 * plus léger qu'un candidat admis est remplacé dans « Pour l'extérieur ». Un manteau du dressing reçoit le plafond de son sous-type.
 */

const shearling = item({ id: 1, category: "manteau", name: "Manteau long façon shearling", sous_type: "Manteau", meteo_max_temp: 7 }) as unknown as Item;
const laine = item({ id: 2, category: "manteau", name: "Manteau droit en laine", sous_type: "Manteau", meteo_max_temp: 12 }) as unknown as Item;
const trench = item({ id: 3, category: "manteau", name: "Trench-coat", sous_type: "Trench", meteo_max_temp: 20 }) as unknown as Item;
const sansBorne = item({ id: 4, category: "manteau", name: "Manteau du dressing", sous_type: "Manteau" }) as unknown as Item;
const chemise = item({ id: 10, category: "hauts", name: "Chemise", sous_type: "Chemise" }) as unknown as Item;
const pantalon = item({ id: 11, category: "pantalon", name: "Pantalon droit", sous_type: "Pantalon" }) as unknown as Item;
const ids = (l: Item[]) => l.map((m) => m.id);

describe("manteauxParChaleur", () => {
  it("par 2° : le shearling, puis la laine, puis le trench ; sans plafond connu en dernier", () => {
    expect(ids(manteauxParChaleur([trench, sansBorne, laine, shearling], 2))).toEqual(ids([shearling, laine, trench, sansBorne]));
  });
  it("par 15° : seuls les manteaux dont le plafond admet 15° restent, le trench devant", () => {
    expect(ids(manteauxParChaleur([sansBorne, laine, trench, shearling], 15))).toEqual(ids([trench, sansBorne]));
  });
});

describe("manteauxPourLaCouche : admis à la minimale, pas à la température du moment", () => {
  it("à 10° maintenant et 2° au plus froid, le shearling (plafond 7°) est admis et passe devant", () => {
    const tenue = [chemise, pantalon];
    const aLaMinimale = ids(manteauxPourLaCouche(tenue, [trench, laine, shearling], -1, "quotidien", "Présentiel", "Verre", at(10), 2));
    expect(aLaMinimale[0]).toBe(shearling.id);
    // Avant, dans la même exécution : la température du moment (10°) écartait le shearling.
    const aLHeure = ids(manteauxPourLaCouche(tenue, [trench, laine, shearling], -1, "quotidien", "Présentiel", "Verre", at(10), 10));
    expect(aLHeure).not.toContain(shearling.id);
  });
});

describe("separerCoucheExterieure : un manteau de la tenue trop léger pour la minimale", () => {
  const tenue = [chemise, pantalon, trench];
  it("par 2°, le trench de la tenue est remplacé par le manteau admis le plus chaud", () => {
    const r = separerCoucheExterieure(tenue, 2, manteauxParChaleur([trench, laine, shearling], 2));
    expect(r.exterieur?.id).toBe(shearling.id);
    expect(r.remplace?.id).toBe(trench.id);
    expect(r.suggere).toBe(true);
    expect(ids(r.principal)).toEqual(ids([chemise, pantalon]));
  });
  it("par 16°, aucun manteau plus chaud n'est admis : le trench reste", () => {
    const r = separerCoucheExterieure(tenue, 16, manteauxParChaleur([trench, laine, shearling], 16));
    expect(r.exterieur?.id).toBe(trench.id);
    expect(r.remplace).toBeNull();
  });
  it("un manteau de la tenue sans plafond connu n'est jamais déclaré léger", () => {
    const r = separerCoucheExterieure([chemise, pantalon, sansBorne], 2, manteauxParChaleur([laine, shearling], 2));
    expect(r.exterieur?.id).toBe(sansBorne.id);
    expect(r.remplace).toBeNull();
  });
  it("une tenue sans manteau reçoit le plus chaud des admis", () => {
    const r = separerCoucheExterieure([chemise, pantalon], 2, manteauxParChaleur([trench, laine, shearling], 2));
    expect(r.exterieur?.id).toBe(shearling.id);
  });
});

describe("le plafond d'un manteau du dressing, par son sous-type", () => {
  it("les sous-types du formulaire ont chacun un plafond ; les autres catégories, aucun", () => {
    expect(plafondDuSousType("manteau", "Trench")).toBe(20);
    expect(plafondDuSousType("manteau", "Manteau")).toBe(12);
    expect(plafondDuSousType("manteau", "Doudoune")).toBe(5);
    expect(plafondDuSousType("manteau", null)).toBeUndefined();
    expect(plafondDuSousType("manteau", "Autre chose")).toBeUndefined();
    expect(plafondDuSousType("veste", "Trench")).toBeUndefined();
  });
  it("un trench ajouté au dressing est relu avec le plafond du trench du catalogue", () => {
    const ligne = { id: 99, user_id: "u", name: "Mon trench", brand: null, cat: "manteau", color: "Beige", hex: "#CDBBA2", size: null, season: "Toutes saisons", saisons: null, manches: null, motif: null, longueur: null, couche: null, occasion: null, shoe_type: null, matiere: null, coupe: null, sac_type: null, bijou_type: null, accessoire_type: null, subtype: "Trench", photo_url: null, worn: null, worn_prev: null, created_at: "2026-11-19T00:00:00Z" };
    expect(rowToItem(ligne as never).meteoMaxTemp).toBe(20);
    expect(rowToItem({ ...ligne, subtype: null } as never).meteoMaxTemp).toBeUndefined();
  });
});
