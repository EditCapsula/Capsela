import type { LookScore } from "./logic";

/**
 * BADGES D'UNE TENUE — deux axes indépendants, jamais un seul verdict.
 *
 * Défaut corrigé le 31/08/2026. TenuesScreen rendait les deux badges
 * MUTUELLEMENT EXCLUSIFS :
 *
 *   formalityDowngraded ? « Meilleure alternative » : (score >= 80 && « Recommandé »)
 *
 * Une tenue issue d'un repli de formalité ne pouvait donc JAMAIS afficher
 * « Recommandé », quel que soit son score — alors que les deux informations
 * répondent à deux questions différentes :
 *
 *   score              -> la tenue est-elle réussie ?
 *   formalityDowngraded -> vient-elle d'un repli de formalité ?
 *
 * Mesure qui a établi le défaut (audit `scripts/score-repli.audit.ts`,
 * 9 600 tirages, 4 saisons × 8 styles × 10 occasions × 30, catalogue 623
 * pièces, les deux populations dans la même exécution sur les mêmes
 * capsules) : les 1 080 tirages repliés atteignent le seuil du badge aussi
 * souvent que les 8 520 non repliés, et 36 cellules repliées sur 36
 * afficheraient « Recommandé » sans cette exclusivité. Le repli supprimait
 * donc un badge mérité systématiquement, jamais dans une minorité de cas.
 *
 * Limite du protocole, énoncée pour que le chiffre ne soit pas transporté
 * hors de son périmètre : le pool d'audit est catalogue, donc `worn` vaut
 * null et R-S15 (anti-répétition, jusqu'à −30) ne se déclenche jamais ; le
 * profil d'audit n'a pas de palette, donc R-S10 (+10) non plus. Le « 100 % »
 * est un plafond de protocole. Il frappe les deux populations à l'identique :
 * la COMPARAISON tient, le niveau absolu ne s'extrapole pas à l'usage réel.
 *
 * Ce module ne contient que de la PRÉSENTATION. Ni le score 0-120, ni les
 * règles R-S, ni le seuil 80, ni `computeLookScore`, ni la chaîne de repli
 * 4 → 3 → 1 ne sont touchés — et `formalityDowngraded` n'entre nulle part
 * dans le calcul du score : il n'est pas un paramètre de `computeLookScore`.
 */

/** Badge de qualité — le score, et lui seul, le décide. */
export const BADGE_RECOMMANDE = "Recommandé";

/**
 * Badge de registre — le repli de formalité, et lui seul, le décide.
 *
 * « Meilleure alternative » a été retiré : « meilleure » est un superlatif
 * jamais démontré (meilleure parmi quoi ? l'utilisatrice n'a aucun ensemble
 * de comparaison), et le mot occupait la place du badge de qualité, donc se
 * lisait comme un verdict de qualité de remplacement.
 *
 * « Alternative » seul a été écarté après examen : le mot nomme une RELATION
 * (alternative à quoi ?) sans nommer la DIMENSION. Placé à côté de
 * « Recommandé », il se lit spontanément « l'autre option, donc la moins
 * bonne » — exactement l'interprétation que ce correctif existe pour
 * empêcher. « Plus sobre » nomme l'axe réel (le registre d'habillement),
 * vaut pour les trois transitions mesurées (4→3, 4→1, 3→1) là où « plus
 * décontracté » serait faux pour 4→3, et « sobre » est un compliment dans le
 * vocabulaire de la mode, jamais un manque.
 */
export const BADGE_REGISTRE = "Plus sobre";

/** Badges à afficher, du plus structurant au plus secondaire. */
export type OutfitBadgeKey = "recommande" | "registre";

/**
 * Les deux axes sont indépendants : une tenue peut être une très bonne tenue
 * ET provenir d'un repli de formalité. Aucune exclusivité ne doit être
 * réintroduite entre les deux clés.
 */
export function outfitBadges(opts: {
  scoreBadge: LookScore["badge"];
  formalityDowngraded: boolean;
  /** Aucun badge sur un état vide : il n'y a pas de tenue à qualifier. */
  noCompleteOutfit: boolean;
}): OutfitBadgeKey[] {
  if (opts.noCompleteOutfit) return [];
  const badges: OutfitBadgeKey[] = [];
  if (opts.scoreBadge === "recommande") badges.push("recommande");
  if (opts.formalityDowngraded) badges.push("registre");
  return badges;
}
