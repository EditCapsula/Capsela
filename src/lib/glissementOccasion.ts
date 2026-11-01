/*
 * CHANGER D'OCCASION D'UN GLISSEMENT (01/11/2026, demandé : « dans la page tenues, quand je swipe je passe à une autre occasion »).
 *
 * Fonctions pures, testées ; le geste lui-même est écouté par l'écran Tenues. Un glissement compte s'il est franchement HORIZONTAL
 * (sinon c'est un défilement de la page), assez long (sinon c'est un toucher) et assez court dans le temps (sinon c'est une
 * lecture du doigt). Vers la gauche : occasion suivante ; vers la droite : précédente — le sens des pages qu'on tourne, et celui
 * des flèches du clavier sur les onglets (SelecteurOccasion). L'ordre est celui des onglets ; on boucle aux extrémités, comme au
 * clavier.
 */

export const GLISSEMENT_MIN_PX = 60;
export const GLISSEMENT_MAX_MS = 700;
/** Le déplacement horizontal doit valoir au moins ce multiple du vertical. */
export const GLISSEMENT_RAPPORT = 1.6;

/** -1 : vers la droite (précédente) ; 1 : vers la gauche (suivante) ; 0 : pas un glissement d'occasion. */
export function sensDuGlissement(dx: number, dy: number, dureeMs: number): -1 | 0 | 1 {
  if (dureeMs > GLISSEMENT_MAX_MS) return 0;
  if (Math.abs(dx) < GLISSEMENT_MIN_PX) return 0;
  if (Math.abs(dx) < GLISSEMENT_RAPPORT * Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** L'occasion d'après (ou d'avant), en bouclant. Sans occasion courante reconnue (« all »), la première ou la dernière. */
export function occasionVoisine<K extends string>(ordre: readonly K[], courante: string | null | undefined, sens: -1 | 1): K {
  const i = ordre.indexOf(courante as K);
  if (i < 0) return sens === 1 ? ordre[0] : ordre[ordre.length - 1];
  return ordre[(i + sens + ordre.length) % ordre.length];
}
