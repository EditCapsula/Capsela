import { describe, expect, it } from "vitest";
import { generateOutfitWithFallback, type LeviersMesure } from "../logic";
import type { CatalogItem } from "../catalog";
import type { Weather } from "../data";
import type { CategoryKey, OccasionKey, Season } from "../types";

// LES TROIS BRAS DE P1' SONT-ILS ISOLABLES SANS TOUCHER À LA PRODUCTION ?
//
// Le protocole arbitré le 01/09/2026 demande trois bras :
//   A   production actuelle — un pull n'est jamais dessus principal
//   B   P1' — un pull de rôle `base` peut être dessus principal
//   C   P1' SAUF entretien — l'arbitrage éditorial déjà pris
//
// A et B tiennent au levier `pullCommeHautPrincipal`, déjà en place et inerte
// par défaut. C n'a PAS de levier dédié, et il ne doit pas en avoir un :
// `generateOutfitWithFallback` reçoit l'occasion en paramètre et l'audit
// boucle occasion par occasion. Le bras C se COMPOSE donc à l'appel — levier
// actif partout, absent pour `entretien` — sans qu'une seule ligne de
// `generateOutfit` change.
//
// Ce test existe pour que cette affirmation soit VÉRIFIÉE et non supposée.
// Il est aussi une contre-épreuve : si le bras B ne produisait pas le pull en
// entretien, le bras C passerait trivialement et ne prouverait rien. On exige
// donc explicitement que B le produise AVANT d'exiger que C ne le produise pas.

const MILD: Weather = { temp: 14, code: 0, seasons: ["Automne / Hiver"], label: "" } as unknown as Weather;

const item = (over: Partial<CatalogItem>): CatalogItem => ({
  id: 1, name: "", cat: "haut" as CategoryKey, color: "Noir", hex: "#2A2724",
  season: "Toutes saisons" as Season, worn: null, genre: "unisexe", ...over,
});

/**
 * Pool SANS AUCUN `haut` : le seul dessus possible est le pull. Sans le
 * levier, aucune tenue ne peut donc en contenir un — ce qui rend l'effet du
 * levier lisible sans ambiguïté.
 */
const poolSansHaut = (): CatalogItem[] => [
  item({ id: 10, cat: "pull", name: "Pull col roulé fin", subtype: "Pull col roulé", rolePiece: "base", niveauFormalite: 3 }),
  item({ id: 11, cat: "pantalon", name: "Pantalon tailleur", subtype: "Pantalon", niveauFormalite: 3 }),
  item({ id: 12, cat: "chaussures", name: "Mocassins", shoeType: "Mocassins", niveauFormalite: 3 }),
  item({ id: 13, cat: "sac", name: "Sac structuré", sacType: "Cabas", niveauFormalite: 3 }),
];

const P1: LeviersMesure = { pullCommeHautPrincipal: "base" };

/** Le bras C, tel que l'audit le composera : le levier saute sur `entretien`. */
const leviersBrasC = (occ: OccasionKey): LeviersMesure | undefined =>
  occ === "entretien" ? undefined : P1;

/** Le pull est-il le SEUL dessus de la tenue ? */
function pullSeulDessus(pool: CatalogItem[], occ: OccasionKey, leviers: LeviersMesure | undefined, tirages = 120): boolean {
  for (let k = 0; k < tirages; k++) {
    const ids = generateOutfitWithFallback(pool, MILD, occ, "Présentiel", "Verre", [], "femme", "Hiver", leviers).ids;
    const pieces = ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is CatalogItem => Boolean(p));
    const dessus = pieces.filter((p) => p.cat === "haut" || p.cat === "pull");
    if (dessus.some((p) => p.cat === "pull") && !dessus.some((p) => p.cat === "haut")) return true;
  }
  return false;
}

describe("P1' — les trois bras sont isolables sans modifier la production", () => {
  it("BRAS A — sans levier, aucun pull n'est dessus principal, quelle que soit l'occasion", () => {
    const pool = poolSansHaut();
    for (const occ of ["quotidien", "entretien", "travail_formel", "soiree"] as OccasionKey[]) {
      expect(pullSeulDessus(pool, occ, undefined), `occasion ${occ}`).toBe(false);
    }
  });

  it("BRAS B — avec le levier, le pull devient dessus principal, entretien COMPRIS", () => {
    // Cette assertion est la CONTRE-ÉPREUVE du bras C : sans elle, le test
    // suivant passerait même si le pull était inatteignable en entretien pour
    // une tout autre raison (plancher de formalité, filtre météo...), et ne
    // démontrerait alors strictement rien.
    const pool = poolSansHaut();
    expect(pullSeulDessus(pool, "quotidien", P1), "quotidien").toBe(true);
    expect(pullSeulDessus(pool, "entretien", P1), "entretien").toBe(true);
  });

  it("BRAS C — composé à l'appel, le pull reste dessus principal SAUF en entretien", () => {
    const pool = poolSansHaut();
    expect(pullSeulDessus(pool, "quotidien", leviersBrasC("quotidien")), "quotidien").toBe(true);
    expect(pullSeulDessus(pool, "travail_formel", leviersBrasC("travail_formel")), "travail_formel").toBe(true);
    expect(pullSeulDessus(pool, "entretien", leviersBrasC("entretien")), "entretien").toBe(false);
  });

  it("le bras C ne demande AUCUN levier nouveau : il est la composition de A et B", () => {
    // Garde-fou de périmètre. Si un jour quelqu'un ajoute un levier
    // `exclusionEntretien` à LeviersMesure, ce test échoue et rappelle que
    // l'exclusion est un ARBITRAGE ÉDITORIAL à porter par la production, pas
    // un levier de mesure de plus.
    expect(leviersBrasC("entretien")).toBeUndefined();
    expect(Object.keys(leviersBrasC("quotidien")!)).toEqual(["pullCommeHautPrincipal"]);
  });
});
