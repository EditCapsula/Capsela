import { describe, expect, it } from "vitest";
import { declaredOccasionOk, generateOutfitWithFallback } from "../logic";
import { occasionElargieText } from "../outfitCopy";
import { item, MILD } from "./fixtures";
import type { CatalogItem } from "../catalog";

/**
 * SIGNALÉ LE 22/09/2026 : une robe déclarée pour une occasion HABILLÉE était
 * proposée en Cocooning.
 *
 * Le filtre d'occasion n'était pas en cause — `declaredOccasionOk` écartait
 * bien la robe. La cause était l'ORDRE DES DÉCISIONS : la silhouette
 * (robe, ou haut + bas) était tirée AVANT l'échelle de `poolFor`, puis
 * l'échelle descendait jusqu'au barreau « occasion relâchée » pour honorer ce
 * tirage. Le moteur abandonnait donc une règle posée par l'utilisatrice pour
 * tenir un choix qu'il pouvait faire autrement : mesuré sur 400 tirages du
 * même pool, 227 produisaient déjà une tenue complète sans rien relâcher.
 *
 * Deux correctifs, testés séparément parce qu'ils répondent à deux questions
 * différentes : ne plus relâcher quand ce n'est pas nécessaire, et le DIRE
 * quand ça l'est.
 */

const TIRAGES = 200;

// Sa robe : déclarée pour des occasions habillées, jamais Cocooning.
const robeHabillee = item({
  id: 5001, category: "robes", name: "Robe midi bordeaux",
  occasions: "soiree,evenement_perso", couleur_dominante: "Bordeaux",
});
const haut = item({ id: 5002, category: "hauts", name: "T-shirt" });
const bas = item({ id: 5003, category: "pantalons", name: "Pantalon droit" });
const chaussures = item({ id: 5004, category: "chaussures", name: "Ballerines", sous_type: "Ballerines" });

/**
 * ALÉA FIXÉ — CI rouge du 24/09/2026, `incompletes` à 1 au lieu de 0.
 *
 * Ces 200 tirages utilisaient le vrai `Math.random`. Le test échouait donc
 * parfois, sans rapport avec le diff poussé : mesuré sur 200 000 tirages du
 * pool [robe, chaussures], le moteur rend une tenue incomplète 5 fois, soit
 * 0,0025 %. Sur 200 tirages, la probabilité qu'au moins un tombe est de
 * 0,50 % — une exécution sur deux cents. Localement 25 exécutions d'affilée
 * étaient passées ; c'est exactement ce qu'un taux pareil produit, et c'est
 * pourquoi le « ça passe chez moi » ne prouvait rien.
 *
 * Le générateur congruentiel de `traceRepli.test.ts` est repris tel quel :
 * l'assertion reste identique et aussi stricte, mais elle porte désormais sur
 * un échantillon REPRODUCTIBLE. Ce n'est pas un test mis en quarantaine — rien
 * n'est ignoré, c'est la variable non contrôlée qui est gelée, conformément au
 * point 1 de la règle d'audit.
 *
 * CE QUE LA MESURE LAISSE OUVERT, et qui n'est pas corrigé ici : sur ce pool,
 * la garantie « toujours une tenue » ne tient pas à 100 % mais à 99,9975 %.
 * C'est un constat sur le moteur, pas sur ce test, et personne n'a demandé de
 * le corriger. Il est écrit ici pour ne pas se perdre.
 */
const tirer = (pool: CatalogItem[], leviers?: { robeMemeSiOccasionRelachee?: boolean }) => {
  let avecRobe = 0, signalee = 0, incompletes = 0;
  const vrai = Math.random;
  let n = 1;
  Math.random = () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
  try {
  for (let k = 0; k < TIRAGES; k++) {
    const r = generateOutfitWithFallback(pool, MILD, "cocooning", "Présentiel", "Verre", [], "femme", null, leviers);
    if (r.ids.includes(robeHabillee.id)) avecRobe++;
    if (r.occasionRelachee) signalee++;
    if (r.noCompleteOutfit) incompletes++;
  }
  } finally {
    Math.random = vrai;
  }
  return { avecRobe, signalee, incompletes };
};

describe("une silhouette ne justifie pas d'abandonner une occasion déclarée", () => {
  it("la déclaration de l'utilisatrice exclut bien, en amont de tout", () => {
    expect(declaredOccasionOk(robeHabillee, "cocooning")).toBe(false);
    expect(declaredOccasionOk(robeHabillee, "soiree")).toBe(true);
  });

  it("n'est plus proposée en Cocooning quand haut + bas s'en passe", () => {
    const { avecRobe, signalee, incompletes } = tirer([robeHabillee, haut, bas, chaussures]);
    expect(avecRobe).toBe(0);
    expect(signalee).toBe(0);
    // Le correctif ne doit RIEN coûter : aucune tenue ne devient incomplète.
    expect(incompletes).toBe(0);
  });

  it("l'était avant — le levier de baseline le remontre dans la même exécution", () => {
    // Sans ce bras, le test précédent ne démontrerait rien : un zéro peut
    // venir d'un pool mal construit autant que du correctif.
    const { avecRobe, signalee } = tirer([robeHabillee, haut, bas, chaussures], { robeMemeSiOccasionRelachee: true });
    expect(avecRobe).toBeGreaterThan(0);
    expect(signalee).toBeGreaterThan(0);
  });

  it("reste proposée quand elle est la seule issue, ET c'est signalé", () => {
    // LA CONTRE-ÉPREUVE DE LA BANNIÈRE. Un drapeau qui ne se lève jamais ne
    // démontre rien : ici aucun haut ni bas n'existe, la garantie « toujours
    // une tenue » prime, l'occasion est bien élargie — et dite.
    const { avecRobe, signalee, incompletes } = tirer([robeHabillee, chaussures]);
    expect(avecRobe).toBeGreaterThan(0);
    expect(signalee).toBe(avecRobe);
    expect(incompletes).toBe(0);
  });

  it("reste pleinement proposée pour les occasions qu'elle déclare", () => {
    const pool = [robeHabillee, haut, bas, chaussures];
    let avecRobe = 0, signalee = 0;
    for (let k = 0; k < TIRAGES; k++) {
      const r = generateOutfitWithFallback(pool, MILD, "soiree", "Présentiel", "Verre", [], "femme", null);
      if (r.ids.includes(robeHabillee.id)) avecRobe++;
      if (r.occasionRelachee) signalee++;
    }
    expect(avecRobe).toBeGreaterThan(0);
    expect(signalee).toBe(0);
  });
});

describe("ce que l'écran en dit", () => {
  it("décrit ce que la composition a fait, jamais ce que le vestiaire n'aurait pas", () => {
    const texte = occasionElargieText("cocooning / maison");
    expect(texte).toBe("Pour cocooning / maison, cette tenue élargit au-delà des occasions déclarées sur tes pièces.");
    // Mêmes interdits que missingSuggestionText (31/08) : aucune tournure qui
    // attribue un manque à l'utilisatrice.
    for (const interdit of ["il te manque", "n'a pas", "tu n'as", "insuffisant", "aucune de tes"]) {
      expect(texte.toLowerCase()).not.toContain(interdit);
    }
  });
});
