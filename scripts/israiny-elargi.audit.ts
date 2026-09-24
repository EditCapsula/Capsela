import { describe, expect, it, vi } from "vitest";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { OCCASIONS } from "../src/lib/data";
import { paletteHexes } from "../src/lib/profile";
import type { Item, OccasionKey } from "../src/lib/types";
import type { Weather } from "../src/lib/data";
import type { StyleId } from "../src/lib/profile";
import { STYLES_FEMME, STYLES_HOMME, profilAudit } from "./harnaisAudit";
import { row } from "../src/lib/__tests__/fixtures";
import { rowToCatalogItem } from "../src/lib/vestiaire";

/**
 * IMPACT D'UN ÉLARGISSEMENT DE `isRainy`. LECTURE SEULE, AUCUNE CORRECTION.
 *
 * LE DÉFAUT MESURÉ. La fonction Edge `weather` traduit la condition
 * OpenWeather `Rain` — la pluie ordinaire — par « Pluvieux ». `isRainy` teste
 * /pluie|orage/i, et « Pluvieux » ne contient pas « pluie ». R-B16 (préférer
 * une veste resiste_pluie quand il pleut) ne se déclenche donc jamais pour la
 * pluie ordinaire, alors qu'elle se déclenche pour la bruine et l'orage.
 *
 * LA MÊME REGEX EXISTE EN DEUX EXEMPLAIRES. `estimateUvIndex` (data.ts) teste
 * /pluie|orage/i de son côté pour retrancher 3 à l'indice UV, et `isSunny` en
 * dérive. Un « Pluvieux » est donc aussi traité comme potentiellement
 * ensoleillé. Ce sont deux leviers distincts, mesurés séparément — les
 * confondre reproduirait l'erreur que la règle d'audit existe pour empêcher.
 *
 * CONFIGURATION GELÉE (point 1).
 *   · Pool : CATALOG statique, via computeDefaultCapsule. Les capsules sont
 *     calculées UNE FOIS, avec les modules non mockés, et les mêmes tableaux
 *     d'Item servent à toutes les conditions — même pool, au sens strict.
 *   · Profils : les 8 styles féminins et les 6 masculins exposés.
 *   · Saisons : les 4, à leur température représentative.
 *   · Occasions : les 10.
 *
 * LEVIERS (point 2).
 *   A — `isRainy` reconnaît « Pluvieux ».
 *   B — la branche pluie de `estimateUvIndex`, donc `isSunny`, la reconnaît.
 *   Mesurés : référence, A seul, B seul, A+B (point 3, même exécution).
 *
 * SCÉNARIOS, jamais extrapolés l'un à l'autre (point 4) : « Pluvieux » (Rain,
 * le cas du défaut), « Neigeux » (Snow, que ni l'une ni l'autre des regex ne
 * reconnaît), et « Orageux » en TÉMOIN — ce libellé satisfait déjà les deux
 * regex d'origine, donc A et B y sont des non-opérations démontrables.
 *
 * LE BRUIT D'ÉCHANTILLONNAGE EST NEUTRALISÉ, PAS ESTIMÉ. generateOutfit tire
 * au sort (huit appels à Math.random). Math.random est remplacé par un
 * générateur déterministe réamorcé à la MÊME graine avant chaque appel : deux
 * conditions voient exactement la même suite de tirages, et tout écart est
 * donc imputable au levier seul. Le témoin « Orageux » vérifie que le harnais
 * mesure bien ce qu'on croit : il doit y rendre zéro écart.
 */

const GRAINE = 20260924;
/** Graines par cellule — les mêmes pour toutes les conditions. */
const TIRAGES = 10;
const SANDALES = ["Sandales", "Sandales à talons"];

/** xorshift32 — suffisant pour rejouer une suite identique, et sans dépendance. */
function generateurDeterministe(graine: number): () => number {
  let x = graine >>> 0 || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
}

type Condition = "reference" | "A" | "B" | "A+B";
const CONDITIONS: Condition[] = ["reference", "A", "B", "A+B"];
const SCENARIOS = ["Pluvieux", "Neigeux", "Orageux"] as const;
const OCC: OccasionKey[] = OCCASIONS.map(([k]) => k);

/** Ce que l'élargissement ferait reconnaître en plus, et rien d'autre. */
const ELARGI = /pluvieux|averse|bruine|neige|neigeux/i;

async function chargerMoteur(condition: Condition) {
  vi.resetModules();
  vi.doMock("../src/lib/data", async () => {
    const reel = await vi.importActual<typeof import("../src/lib/data")>("../src/lib/data");
    const a = condition === "A" || condition === "A+B";
    const b = condition === "B" || condition === "A+B";
    return {
      ...reel,
      isRainy: (w: { label: string }) => (a && ELARGI.test(w.label) ? true : reel.isRainy(w)),
      // `isSunny` n'est pas réécrit : on rappelle le VRAI avec un libellé qui
      // emprunte la branche pluie de estimateUvIndex. Réimplémenter le calcul
      // d'UV en ferait une seconde définition, exactement le défaut mesuré.
      isSunny: (w: Weather) => (b && ELARGI.test(w.label) ? reel.isSunny({ ...w, label: "Pluie" }) : reel.isSunny(w)),
    };
  });
  return await import("../src/lib/logic");
}

interface Cellule {
  cle: string;
  pool: Item[];
  meteo: Weather;
  occasion: OccasionKey;
  hexes: string[];
  gender: "femme" | "homme";
}

/**
 * TÉMOIN POSITIF — le levier atteint-il réellement le moteur ?
 *
 * Nécessaire, et il a servi : la première version de la grille rendait zéro
 * partout, et le témoin négatif (« Orageux ») ne pouvait pas distinguer « le
 * levier ne change rien » de « le mock n'arrive pas jusqu'au moteur ».
 *
 * Pool minimal où R-B21 (pas de sandales sous la pluie) est le seul facteur
 * discriminant. Il démontre le défaut en trois lignes : la sandale tombe sous
 * « Pluie », reste sous « Pluvieux », et retombe dès que le levier est posé.
 */
const POOL_TEMOIN: Item[] = [
  rowToCatalogItem(row({ id: 1, category: "haut", name: "T-shirt écru" })),
  rowToCatalogItem(row({ id: 2, category: "pantalon", name: "Pantalon droit" })),
  rowToCatalogItem(row({ id: 3, category: "chaussures", name: "Sandales", sous_type: "Sandales" })),
] as unknown as Item[];

const meteoTemoin = (label: string): Weather => ({
  season: "Printemps / Été",
  temp: 22,
  label,
  seasons: ["Printemps / Été", "Toutes saisons"],
});

describe("témoin positif — le levier atteint le moteur", () => {
  it("la sandale tombe sous « Pluie », reste sous « Pluvieux », retombe avec le levier", async () => {
    const nu = await chargerMoteur("reference");
    const refPluie = nu.generateOutfitWithFallback(POOL_TEMOIN, meteoTemoin("Pluie"), "quotidien");
    const refPluvieux = nu.generateOutfitWithFallback(POOL_TEMOIN, meteoTemoin("Pluvieux"), "quotidien");
    const large = await chargerMoteur("A");
    const aPluvieux = large.generateOutfitWithFallback(POOL_TEMOIN, meteoTemoin("Pluvieux"), "quotidien");

    console.log("\nTémoin positif");
    console.log("  référence · Pluie    :", refPluie.ids);
    console.log("  référence · Pluvieux :", refPluvieux.ids, "<- le défaut");
    console.log("  levier A  · Pluvieux :", aPluvieux.ids);

    expect(refPluie.ids).not.toContain(100003);
    expect(refPluvieux.ids).toContain(100003);
    expect(aPluvieux.ids).not.toContain(100003);
  });
});

describe("élargir isRainy — impact mesuré", () => {
  it("mesure référence, A, B et A+B sur le même pool, dans la même exécution", async () => {
    // --- pools, calculés une seule fois, modules réels ---------------------
    const profils: { gender: "femme" | "homme"; style: StyleId }[] = [
      ...STYLES_FEMME.map((style) => ({ gender: "femme" as const, style })),
      ...STYLES_HOMME.map((style) => ({ gender: "homme" as const, style })),
    ];
    const capsules = new Map<string, { pool: Item[]; hexes: string[] }>();
    for (const { gender, style } of profils) {
      const profile = profilAudit({ gender, styles: [style] });
      for (const saison of CAPSULE_SEASONS) {
        const meteo = representativeWeatherFor(saison);
        const pool = computeDefaultCapsule(profile, meteo, [], saison) as unknown as Item[];
        capsules.set(`${gender}|${style}|${saison}`, { pool, hexes: paletteHexes(profile) });
      }
    }

    // --- grille de cellules, identique pour toutes les conditions ----------
    const cellules: Record<string, Cellule[]> = {};
    for (const label of SCENARIOS) {
      const liste: Cellule[] = [];
      for (const { gender, style } of profils) {
        for (const saison of CAPSULE_SEASONS) {
          const base = capsules.get(`${gender}|${style}|${saison}`)!;
          const ref = representativeWeatherFor(saison);
          const meteo: Weather = { ...ref, label };
          for (const occasion of OCC) {
            liste.push({ cle: `${gender}|${style}|${saison}|${occasion}`, pool: base.pool, meteo, occasion, hexes: base.hexes, gender });
          }
        }
      }
      cellules[label] = liste;
    }

    // --- POUVOIR DE LA MESURE : combien de cellules peuvent seulement
    //     changer ? Sans ce décompte, un zéro se lit comme « la règle ne sert
    //     à rien » alors qu'il peut vouloir dire « le pool ne permet pas de
    //     le savoir ». C'est la distinction que la phase 15 a manquée.
    const OUTER = ["veste", "manteau"];
    let avecSandale = 0, avecResistePluie = 0, avecOuterwear = 0;
    const vus = new Set<string>();
    for (const c of cellules.Pluvieux) {
      const cle = c.cle.split("|").slice(0, 3).join("|");
      if (vus.has(cle)) continue;
      vus.add(cle);
      const p = c.pool as (Item & { shoeType?: string; resistePluie?: boolean; cat?: string })[];
      if (p.some((i) => i.shoeType && SANDALES.includes(i.shoeType))) avecSandale++;
      if (p.some((i) => i.resistePluie)) avecResistePluie++;
      if (p.some((i) => i.cat && OUTER.includes(i.cat))) avecOuterwear++;
    }
    console.log(`\nPools distincts : ${vus.size}`);
    console.log(`  contenant au moins une sandale        : ${avecSandale}  (R-B21, filtre dur)`);
    console.log(`  contenant une veste/manteau           : ${avecOuterwear}`);
    console.log(`  contenant une pièce resiste_pluie     : ${avecResistePluie}  (R-B16, préférence molle)`);

    const original = Math.random;
    const resultats: Record<string, Record<Condition, string[]>> = {};
    for (const label of SCENARIOS) resultats[label] = { reference: [], A: [], B: [], "A+B": [] };

    // TIRAGES MULTIPLES. Un seul tirage par cellule couvrait trop peu : le
    // moteur choisit parmi plusieurs candidats, et si la sandale n'est pas
    // tirée, le levier n'a rien à retirer. Dix graines par cellule, LES MÊMES
    // d'une condition à l'autre, élargissent la couverture sans réintroduire
    // de bruit — chaque paire comparée voit la même suite de tirages.
    const sandalesPar: Record<Condition, number> = { reference: 0, A: 0, B: 0, "A+B": 0 };
    for (const condition of CONDITIONS) {
      const { generateOutfitWithFallback } = await chargerMoteur(condition);
      for (const label of SCENARIOS) {
        for (const c of cellules[label]) {
          for (let k = 0; k < TIRAGES; k++) {
            Math.random = generateurDeterministe(GRAINE + k);
            const r = generateOutfitWithFallback(c.pool, c.meteo, c.occasion, "Présentiel", "Verre", c.hexes, c.gender);
            resultats[label][condition].push(r.ids.join(","));
            if (label === "Pluvieux") {
              const p = c.pool as (Item & { shoeType?: string })[];
              const ids = new Set(r.ids);
              if (p.some((i) => ids.has(i.id) && i.shoeType && SANDALES.includes(i.shoeType))) sandalesPar[condition]++;
            }
          }
        }
      }
    }
    Math.random = original;

    // LE CHIFFRE QUI DÉCIDE, et le seul qui ne soit pas un artefact.
    //
    // Le nombre de tirages « changés » SURESTIME l'effet réel : retirer un
    // candidat du pool décale la consommation de la suite pseudo-aléatoire, si
    // bien que des tenues sans sandale sortent différentes sans que la règle
    // ait rien à y voir. Ce décalage est du bruit de méthode, pas un effet.
    //
    // Ce qui n'en est pas un : combien de tenues de pluie chaussent une
    // sandale. C'est très exactement ce que R-B21 existe pour empêcher.
    const nTirages = cellules.Pluvieux.length * TIRAGES;
    console.log("\nSandales portées sous « Pluvieux » — le défaut lui-même");
    for (const cond of CONDITIONS) {
      console.log(`  ${cond.padEnd(10)} ${String(sandalesPar[cond]).padStart(5)} / ${nTirages}   ${((100 * sandalesPar[cond]) / nTirages).toFixed(1)} %`);
    }

    // --- lecture -----------------------------------------------------------
    const total = cellules.Pluvieux.length * TIRAGES;
    const ecart = (label: string, cond: Condition) =>
      resultats[label].reference.reduce((n, ref, i) => n + (ref === resultats[label][cond][i] ? 0 : 1), 0);

    console.log(`\nTirages par scénario : ${total} (${profils.length} profils × ${CAPSULE_SEASONS.length} saisons × ${OCC.length} occasions × ${TIRAGES} graines)\n`);
    console.log("scénario   condition   tirages changés   %");
    for (const label of SCENARIOS) {
      for (const cond of CONDITIONS.slice(1)) {
        const n = ecart(label, cond);
        console.log(
          `${label.padEnd(10)} ${cond.padEnd(11)} ${String(n).padStart(6)}            ${((100 * n) / total).toFixed(1)}`
        );
      }
      console.log("");
    }

    // Détail par occasion pour la condition la plus large, scénario Pluvieux.
    console.log("Pluvieux · A+B — répartition par occasion");
    for (const occ of OCC) {
      let n = 0, t = 0;
      cellules.Pluvieux.forEach((c, ci) => {
        if (c.occasion !== occ) return;
        for (let k = 0; k < TIRAGES; k++) {
          const i = ci * TIRAGES + k;
          t++;
          if (resultats.Pluvieux.reference[i] !== resultats.Pluvieux["A+B"][i]) n++;
        }
      });
      console.log(`  ${occ.padEnd(18)} ${String(n).padStart(4)} / ${t}   ${((100 * n) / t).toFixed(1)} %`);
    }

    // TÉMOIN. « Orageux » satisfait déjà les deux regex d'origine : A et B y
    // sont des non-opérations. Un écart non nul signifierait que le harnais
    // mesure autre chose que le levier — l'assertion refuse de le supposer.
    for (const cond of CONDITIONS.slice(1)) {
      expect(ecart("Orageux", cond), `témoin Orageux, condition ${cond}`).toBe(0);
    }
  });
});
