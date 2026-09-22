import { CATS, OCCASIONS } from "./data";
import type { Weather } from "./data";
import { generateOutfitWithFallback } from "./logic";
import { composeWardrobePool } from "./selectors";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "./types";

/**
 * COMBIEN DE LOOKS UNE CAPSULE PERMET-ELLE ?
 *
 * Trois réponses, parce que la question en cache trois. Elles vivent ici
 * plutôt que dans l'écran pour que l'audit mesure le code qui tourne, et non
 * une copie — la leçon du 07/09, où un audit qui recopiait l'échelle de repli mesurait
 * sa propre lecture du code plutôt que le code.
 *
 * `looks.ts` et pas `capsule.ts` : ces fonctions ont besoin du moteur de
 * génération, et logic.ts importe déjà capsule.ts.
 */

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const CAT_KEYS = CATS.map(([k]) => k) as CategoryKey[];

/**
 * Le pool que le moteur reçoit pour UNE occasion, composé exactement comme
 * `regen` (store.tsx) le compose : une catégorie dont aucune pièce réelle ne
 * déclare l'occasion du jour se voit rendre celles de la capsule qui la
 * déclarent. Sans ce passage, un décompte reproduirait l'état d'AVANT le
 * correctif du 10/09 et compterait des occasions perdues qui ne le sont plus.
 *
 * Idempotent sur un dressing vide : `pool` vaut alors la capsule, et il n'y a
 * rien à compléter.
 */
function poolPourOccasion(pool: Item[], capsule: Item[], occasion: OccasionKey): Item[] {
  return composeWardrobePool(pool, capsule, CAT_KEYS, { completerPourOccasion: occasion });
}

/**
 * CE QUE L'ÉCRAN A AFFICHÉ JUSQU'AU 22/09/2026 — extrait tel quel de
 * CapsuleScreen le 15/09/2026, sans changer un caractère, pour pouvoir le
 * mesurer ; retiré de l'écran une fois mesuré, parce que l'écart avec le
 * nombre de tenues réellement produites va de ×0,5 à ×1,7. Conservé ici et
 * non supprimé : `compteur-looks.audit.ts` en a besoin comme point de
 * comparaison, et le supprimer priverait la prochaine mesure de sa baseline.
 *
 * `(hauts × bas + robes) × chaussures`. C'est un produit combinatoire brut :
 * il ignore la formalité par occasion (R-B3), les occasions déclarées, la
 * palette, les bornes météo, R-B9, la règle de superposition et les mailles
 * fermées. Il compte donc des assemblages que le moteur ne produira jamais.
 */
export function looksCombinatoires(capsule: Item[]): number {
  const n = (cat: string) => capsule.filter((i) => i.cat === cat).length;
  const hauts = n("haut");
  const bas = n("pantalon") + n("jean") + n("jupe") + n("short");
  const robes = n("robe") + n("combinaison");
  const chaussures = Math.max(1, n("chaussures"));
  return (hauts * bas + robes) * chaussures;
}

/**
 * Générateur pseudo-aléatoire déterministe, semé par le contenu de la
 * capsule. Sans lui, un décompte par tirages changerait à chaque rendu : le
 * même écran afficherait 12 puis 14 puis 11 looks sans que rien n'ait bougé.
 */
function graine(capsule: Item[]): number {
  let h = 2166136261;
  for (const it of capsule) { h ^= it.id; h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Exécute `fn` avec un Math.random déterministe, puis le rend intact. */
function avecTirageDeterministe<T>(seed: number, fn: () => T): T {
  const vrai = Math.random;
  Math.random = mulberry32(seed);
  try { return fn(); } finally { Math.random = vrai; }
}

/**
 * LE NOMBRE DE TENUES DISTINCTES QUE LE MOTEUR PRODUIT RÉELLEMENT.
 *
 * `budget` tirages par occasion, sur les dix occasions ; on compte les
 * ensembles de pièces distincts. Chaque tirage passe exactement les filtres
 * de production — c'est le moteur, pas une formule.
 *
 * DEUX LIMITES À ÉNONCER PLUTÔT QU'À TAIRE. C'est un MINORANT : le moteur
 * tire, il n'énumère pas, donc un budget plus grand peut découvrir des
 * tenues de plus. Et la valeur dépend donc de `budget`, qui est un choix, pas
 * une vérité. Ce qu'elle garantit en revanche : chacune de ces tenues a
 * réellement été produite, ce que la formule combinatoire ne garantit pour
 * aucune des siennes.
 */
export function tenuesDistinctes(
  pool: Item[],
  capsule: Item[],
  weather: Weather,
  gender: "femme" | "homme" | null,
  saison: CapsuleSeason | null,
  budget = 40
): number {
  const vues = new Set<string>();
  avecTirageDeterministe(graine(pool), () => {
    for (const occ of OCCS) {
      const p = poolPourOccasion(pool, capsule, occ);
      for (let k = 0; k < budget; k++) {
        const { ids } = generateOutfitWithFallback(p, weather, occ, "Présentiel", "Verre", [], gender, saison);
        if (ids.length) vues.add([...ids].sort((a, b) => a - b).join(","));
      }
    }
  });
  return vues.size;
}

/**
 * LE NOMBRE D'OCCASIONS QUE LA CAPSULE COUVRE.
 *
 * Exact et sans budget : une occasion est couverte si le moteur en tire une
 * tenue complète. Dix générations, rien de plus. Répond à une autre question
 * que « combien de looks », mais y répond sans approximation.
 */
export function occasionsCouvertes(
  pool: Item[],
  capsule: Item[],
  weather: Weather,
  gender: "femme" | "homme" | null,
  saison: CapsuleSeason | null
): number {
  return avecTirageDeterministe(graine(pool), () =>
    OCCS.filter((occ) =>
      generateOutfitWithFallback(poolPourOccasion(pool, capsule, occ), weather, occ, "Présentiel", "Verre", [], gender, saison)
        .ids.length > 0
    ).length
  );
}

/** Le total d'occasions, pour afficher « n / TOTAL ». */
export const NB_OCCASIONS = OCCS.length;
