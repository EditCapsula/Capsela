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
 * Le même vestiaire, mais le SEUL bas est hors météo à 16 ° : `poolFor` doit
 * relâcher la météo plutôt que de rendre une tenue sans bas. C'est
 * exactement le repli que la trace existe pour rendre visible.
 */
const poolBasHorsMeteo = (): CatalogItem[] => [
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

const traces = (pool: CatalogItem[], k = 0): TraceRepli[] => {
  const vues: TraceRepli[] = [];
  tirage(pool, { traceRepli: (e) => vues.push(e) }, k);
  return vues;
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

  it("chaque trace nomme son barreau et compte tous les barreaux de son échelle", () => {
    // Garde-fou de forme : une trace dont les effectifs ne couvriraient pas
    // toute l'échelle laisserait croire à une attribution complète.
    for (const e of traces(poolBasHorsMeteo())) {
      expect(e.nom.length).toBeGreaterThan(0);
      expect(e.effectifs.length).toBeGreaterThanOrEqual(4);
      expect(e.cats.length).toBeGreaterThan(0);
      if (e.barreau >= 0) expect(e.effectifs[e.barreau]).toBeGreaterThan(0);
    }
  });
});
