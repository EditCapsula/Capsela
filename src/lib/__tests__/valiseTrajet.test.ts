import { describe, expect, it } from "vitest";
import { composerValiseVariee, unitesDe, volumePorteAuTrajet, type Generateur, type SituationValise } from "../valise";
import type { CategoryKey, Item } from "../types";

// LA TENUE DU TRAJET HORS DE LA CAPACITÉ (16/11/2026, arbitré : elle est portée pendant le voyage, pas dans le bagage).

const piece = (id: number, cat: CategoryKey): Item => ({ id, name: `P${id}`, cat, color: "Noir", hex: "#222", season: "Toutes saisons", worn: 1 });
const meteo = { season: "Printemps / Été", temp: 20, label: "Ensoleillé" } as SituationValise["meteo"];
const trajet: SituationValise = { occasion: "voyage", meteo, jours: ["2026-12-07"], sousIds: ["trajet"] };
const visites: SituationValise = { occasion: "quotidien", meteo, jours: ["2026-12-07", "2026-12-08"], sousIds: ["visites"] };

// 1-2 hauts · 11 pantalon · 12 jupe · 20-21 chaussures · 30 sac
const DRESSING = [piece(1, "haut"), piece(2, "haut"), piece(11, "pantalon"), piece(12, "jupe"), piece(20, "chaussures"), piece(21, "chaussures"), piece(30, "sac")];
const unites = (id: number) => unitesDe(DRESSING.find((p) => p.id === id)!.cat);

describe("volumePorteAuTrajet", () => {
  it("sans trajet au programme : rien n'est retiré", () => {
    expect(volumePorteAuTrajet([{ ids: [1, 11, 20], situations: [0] }], [visites], unites)).toBe(0);
  });
  it("un look de trajet : toutes ses pièces, une fois chacune", () => {
    // haut 1 + pantalon 2 + chaussures 3 + sac 2
    expect(volumePorteAuTrajet([{ ids: [1, 11, 20, 30, 30], situations: [0] }], [trajet, visites], unites)).toBe(8);
  });
  it("deux looks de trajet (aller, retour) : seul le plus léger, l'autre est dans le bagage", () => {
    const looks = [
      { ids: [1, 11, 20, 30], situations: [0] },
      { ids: [2, 12, 21], situations: [0] },
    ];
    expect(volumePorteAuTrajet(looks, [trajet, visites], unites)).toBe(5);
  });
  it("un look qui ne sert pas le trajet ne compte pas", () => {
    expect(volumePorteAuTrajet([{ ids: [1, 11, 20, 30], situations: [1] }], [trajet, visites], unites)).toBe(0);
  });
});

describe("composerValiseVariee — trajetHorsCapacite", () => {
  // Le trajet reçoit [1, 11, 20, 30] (8 unités) ; les visites, [2, 12, 21, 30] (5 unités de plus, le sac est partagé).
  const generer: Generateur = (pool, s) => {
    const ids = s.sousIds?.includes("trajet") ? [1, 11, 20, 30] : [2, 12, 21, 30];
    return ids.every((id) => pool.some((p) => p.id === id)) ? { ids, elargie: false } : null;
  };

  it("avant : la tenue du trajet occupe le bagage, les visites n'y tiennent plus ; après : elles tiennent", () => {
    const avant = composerValiseVariee(DRESSING, [], [trajet, visites], 10, generer, { variete: true });
    const apres = composerValiseVariee(DRESSING, [], [trajet, visites], 10, generer, { variete: true, trajetHorsCapacite: true });
    expect(avant.pieceIds.sort((a, b) => a - b)).toEqual([1, 11, 20, 30]);
    expect(apres.pieceIds.sort((a, b) => a - b)).toEqual([1, 2, 11, 12, 20, 21, 30]);
    // Dans le bagage : 13 unités moins les 8 portées au trajet.
    const dansLeBagage = apres.pieceIds.reduce((t, id) => t + unites(id), 0) - volumePorteAuTrajet(apres.looks, [trajet, visites], unites);
    expect(dansLeBagage).toBeLessThanOrEqual(10);
  });

  it("le bagage ne déborde jamais : ce qui n'y tient pas, même trajet porté, reste dehors", () => {
    const r = composerValiseVariee(DRESSING, [], [trajet, visites], 4, generer, { variete: true, trajetHorsCapacite: true });
    const dansLeBagage = r.pieceIds.reduce((t, id) => t + unites(id), 0) - volumePorteAuTrajet(r.looks, [trajet, visites], unites);
    expect(dansLeBagage).toBeLessThanOrEqual(4);
  });
});
