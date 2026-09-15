import { describe, expect, it } from "vitest";
import { generateOutfit, type LeviersMesure, type TraceRepli } from "../logic";
import { MILD, item } from "./fixtures";
import type { CatalogItem } from "../catalog";

/**
 * TRACE DE REPLI — 07/09/2026.
 *
 * `poolFor` descend une échelle : saison + occasion + météo, puis météo
 * relâchée, puis occasion relâchée. Cette échelle décide du contenu de chaque
 * tenue et rien ne l'observait. Un audit du 07/09 a tenté d'attribuer les
 * pièces portées hors de leur plage en RECONSTITUANT à côté ce qui aurait dû
 * être éligible ; il ne reconstituait que le filtre de température, alors que
 * l'échelle filtre d'abord par occasion, formalité et style. L'attribution
 * était fausse sans que rien ne le signale.
 *
 * D'où une trace dans la production plutôt qu'une copie dans un script :
 * fidèle par construction. Mais une trace n'est acceptable que si elle ne
 * change RIEN. Ces tests verrouillent les deux propriétés qui le garantissent :
 *
 *   1. sans `traceRepli`, la tenue produite est identique au tirage près ;
 *   2. avec `traceRepli`, elle l'est encore — la trace observe, elle ne
 *      participe pas, et sa valeur de retour est ignorée.
 *
 * Puis ils vérifient qu'elle dit vrai : barreau 0 quand rien ne se relâche,
 * barreau de repli quand la météo vide une catégorie.
 */

/** Un vestiaire complet et cohérent à 16 ° : aucune raison de relâcher quoi que ce soit. */
const poolConfortable = (): CatalogItem[] => [
  item({ id: 1, category: "hauts", name: "T-shirt", sous_type: "T-shirt", meteo_min_temp: 10, meteo_max_temp: 26 }),
  item({ id: 2, category: "pantalons", name: "Pantalon droit", sous_type: "Pantalon", meteo_min_temp: 5, meteo_max_temp: 24 }),
  item({ id: 3, category: "chaussures", name: "Mocassins", sous_type: "Mocassins", meteo_min_temp: 5, meteo_max_temp: 28 }),
  item({ id: 4, category: "sacs", name: "Cabas", sous_type: "Cabas" }),
];

/**
 * Le même vestiaire, mais le SEUL bas est SOUS SON MIN à 16 ° : `poolFor` doit
 * relâcher la météo plutôt que de rendre une tenue sans bas. C'est exactement
 * le repli que la trace existe pour rendre visible.
 *
 * Sous son min, et pas au-dessus de son max : depuis le 15/09/2026 le barreau
 * de relâchement ne lâche plus la borne haute (cf. `poolBasAuDessusDeSonMax`).
 * Un pantalon d'hiver à 16 ° ne déclencherait donc plus aucun repli — le test
 * passerait pour une mauvaise raison, en constatant une absence.
 */
const poolBasHorsMeteo = (): CatalogItem[] => [
  item({ id: 1, category: "hauts", name: "T-shirt", sous_type: "T-shirt", meteo_min_temp: 10, meteo_max_temp: 26 }),
  item({ id: 2, category: "pantalons", name: "Pantalon d'été", sous_type: "Pantalon", meteo_min_temp: 22, meteo_max_temp: 40 }),
  item({ id: 3, category: "chaussures", name: "Mocassins", sous_type: "Mocassins", meteo_min_temp: 5, meteo_max_temp: 28 }),
  item({ id: 4, category: "sacs", name: "Cabas", sous_type: "Cabas" }),
];

/** Le même, mais le seul bas est AU-DESSUS de son max à 16 ° — un pantalon d'hiver. */
const poolBasAuDessusDeSonMax = (): CatalogItem[] => [
  item({ id: 1, category: "hauts", name: "T-shirt", sous_type: "T-shirt", meteo_min_temp: 10, meteo_max_temp: 26 }),
  item({ id: 2, category: "pantalons", name: "Pantalon d'hiver", sous_type: "Pantalon", meteo_min_temp: -5, meteo_max_temp: 8 }),
  item({ id: 3, category: "chaussures", name: "Mocassins", sous_type: "Mocassins", meteo_min_temp: 5, meteo_max_temp: 28 }),
  item({ id: 4, category: "sacs", name: "Cabas", sous_type: "Cabas" }),
];

const tirage = (pool: CatalogItem[], leviers?: LeviersMesure, k = 0): number[] => {
  const vrai = Math.random;
  // Graine fixe : deux tirages comparés doivent l'être à aléa identique,
  // sinon « identique » ne voudrait rien dire.
  let n = k;
  Math.random = () => { n = (n * 9301 + 49297) % 233280; return n / 233280; };
  try {
    return generateOutfit(pool, MILD, "quotidien", "Présentiel", "Verre", [], "femme", undefined, undefined, null, leviers).ids;
  } finally { Math.random = vrai; }
};

/** Les traces du DERNIER tirage seulement — cf. TraceRepli, type "début". */
const traces = (pool: CatalogItem[], k = 0): TraceRepli[] => {
  const vues: TraceRepli[] = [];
  tirage(pool, { traceRepli: (e) => vues.push(e) }, k);
  const dernierDebut = vues.map((e) => e.type).lastIndexOf("début");
  return vues.slice(dernierDebut + 1);
};

describe("trace de repli — elle observe et ne participe pas", () => {
  it("la tenue est identique avec et sans trace, sur trente tirages", () => {
    // La propriété centrale. Si elle tombe, la trace a changé la production
    // et tout ce qu'on mesurerait avec serait à jeter.
    for (const pool of [poolConfortable(), poolBasHorsMeteo()]) {
      for (let k = 0; k < 30; k++) {
        const sans = tirage(pool, undefined, k);
        const avec = tirage(pool, { traceRepli: () => {} }, k);
        expect(avec, `tirage ${k}`).toEqual(sans);
      }
    }
  });

  it("une trace qui renvoie une valeur ne change rien non plus", () => {
    // `poolFor` ignore la valeur de retour ; on le vérifie plutôt que de le
    // supposer, parce qu'un jour quelqu'un pourrait vouloir s'en servir.
    const pool = poolConfortable();
    for (let k = 0; k < 20; k++) {
      const sans = tirage(pool, undefined, k);
      const avec = tirage(pool, { traceRepli: () => "valeur ignorée" as unknown as void }, k);
      expect(avec, `tirage ${k}`).toEqual(sans);
    }
  });

  it("sans trace, aucun appel n'est fait", () => {
    let appels = 0;
    tirage(poolConfortable(), { pullCommeHautPrincipal: undefined });
    expect(appels).toBe(0);
    // Contre-épreuve : avec la trace, il y a bien des appels — sans quoi le
    // test précédent passerait pour une mauvaise raison.
    tirage(poolConfortable(), { traceRepli: () => { appels += 1; } });
    expect(appels).toBeGreaterThan(0);
  });
});

describe("trace de repli — elle dit vrai", () => {
  it("quand rien ne se relâche, le barreau retenu est le premier", () => {
    const vues = traces(poolConfortable());
    expect(vues.length).toBeGreaterThan(0);
    // Toutes les catégories du vestiaire confortable passent le premier
    // barreau : aucun repli n'a lieu d'être.
    expect(vues.filter((e) => e.barreau > 0)).toEqual([]);
  });

  it("quand la météo vide le bas, le repli est tracé et le premier barreau est vide", () => {
    const vues = traces(poolBasHorsMeteo());
    const bas = vues.filter((e) => e.cats.includes("pantalon"));
    expect(bas.length, "le bas doit être tiré").toBeGreaterThan(0);
    for (const e of bas) {
      expect(e.barreau, "un repli doit être tracé").toBeGreaterThan(0);
      expect(e.nom).toBe("météo relâchée");
      // Ce que le moteur avait sous la main : rien au premier barreau, le
      // pantalon au second. C'est précisément ce qu'un audit ne pouvait pas
      // reconstituer de l'extérieur.
      expect(e.effectifs[0], "premier barreau vide").toBe(0);
      expect(e.effectifs[1], "second barreau non vide").toBeGreaterThan(0);
    }
  });

  it("un marqueur de début ouvre chaque tirage, pour séparer les tentatives", () => {
    // Sans lui, les traces des tentatives abandonnées de la chaîne de
    // formalité se mélangeraient à celles de la tenue rendue.
    const toutes: TraceRepli[] = [];
    tirage(poolBasHorsMeteo(), { traceRepli: (e) => toutes.push(e) });
    expect(toutes.filter((e) => e.type === "début").length).toBeGreaterThan(0);
    expect(toutes[0].type).toBe("début");
    // Aucun repli n'est rapporté avant le premier marqueur.
    expect(toutes.findIndex((e) => e.type === "repli")).toBeGreaterThan(0);
  });

  it("chaque trace nomme son barreau et compte tous les barreaux de son échelle", () => {
    // Garde-fou de forme : une trace dont les effectifs ne couvriraient pas
    // toute l'échelle laisserait croire à une attribution complète.
    for (const e of traces(poolBasHorsMeteo())) {
      expect(e.type).toBe("repli");
      expect(e.nom.length).toBeGreaterThan(0);
      expect(e.effectifs.length).toBeGreaterThanOrEqual(4);
      expect(e.cats.length).toBeGreaterThan(0);
      if (e.barreau >= 0) expect(e.effectifs[e.barreau]).toBeGreaterThan(0);
    }
  });
});

/**
 * LA BORNE HAUTE NE SE RELÂCHE JAMAIS — arbitré le 15/09/2026.
 *
 * Signalé la veille, capture à l'appui : 28° et l'application proposait un
 * blazer de laine sous un trench. Le barreau « météo relâchée » abandonnait la
 * température des DEUX côtés, et ressortait des pièces au-dessus de leur max.
 *
 * Les deux bornes n'ont pas la même nature. Sous son min, une pièce reste
 * portable — une couche compense. Au-dessus de son max, rien ne compense. Le
 * prix accepté est visible ici : quand le SEUL bas est hors de son max, la
 * tenue sort sans bas plutôt qu'avec un pantalon d'hiver en pleine chaleur.
 * Mesuré sur le vrai catalogue (dix journées, 1600 tenues par bras) : aucune
 * occasion perdue.
 */
describe("la borne haute ne se relâche jamais", () => {
  // Les ids sont décalés de VESTIAIRE_ID_OFFSET par `item()` : on lit celui du
  // pantalon dans le pool plutôt que d'écrire un littéral qui serait faux.
  const idDuBas = (pool: CatalogItem[]) => pool.find((it) => it.cat === "pantalon")!.id;

  it("un bas au-dessus de son max n'est pas réintroduit par le repli météo", () => {
    const pool = poolBasAuDessusDeSonMax();
    expect(tirage(pool), "le pantalon d'hiver ne doit pas être porté à 16 °").not.toContain(idDuBas(pool));
  });

  it("un bas SOUS son min l'est toujours — le min reste relâchable", () => {
    const pool = poolBasHorsMeteo();
    expect(tirage(pool), "le pantalon d'été reste portable à 16 °, une couche compense").toContain(idDuBas(pool));
  });

  it("le levier d'audit rétablit l'ancien comportement, et lui seul", () => {
    const pool = poolBasAuDessusDeSonMax();
    expect(tirage(pool, { replMeteoRelacheMax: true }), "l'ancien barreau relâchait bien la borne haute")
      .toContain(idDuBas(pool));
    // Contre-épreuve : sur un pool sans pièce hors max, le levier ne change rien.
    for (let k = 0; k < 20; k++) {
      expect(tirage(poolConfortable(), { replMeteoRelacheMax: true }, k), `tirage ${k}`)
        .toEqual(tirage(poolConfortable(), undefined, k));
    }
  });

  it("la trace le dit : plus aucun barreau non vide pour ce bas", () => {
    const bas = traces(poolBasAuDessusDeSonMax()).filter((e) => e.cats.includes("pantalon"));
    expect(bas.length, "le bas doit être tiré").toBeGreaterThan(0);
    for (const e of bas) {
      expect(e.barreau, "aucun barreau ne doit rendre ce pantalon").toBe(-1);
      expect(e.effectifs.every((n) => n === 0), `effectifs ${e.effectifs.join("/")}`).toBe(true);
    }
  });
});
