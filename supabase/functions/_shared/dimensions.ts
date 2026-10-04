// Dimensions d'image — la partie PURE du redimensionnement de _shared/webp.ts, sans import distant : de quoi la tester.

/** Plus grand côté d'un visuel enregistré (cf. les raisons dans _shared/webp.ts). */
export const MAX_IMAGE_DIMENSION = 800;

/**
 * Les dimensions d'une image ramenée à `max` sur son plus grand côté, PROPORTIONS CONSERVÉES (04/10/2026). La version
 * d'origine redimensionnait toute image trop grande dans un carré `max × max` : sans effet sur les visuels du
 * catalogue, carrés, mais une photo en portrait de 900 × 1200 devenait 800 × 800, étirée d'un tiers en largeur
 * (signalé sur la première photo détourée). Une image carrée donne le même résultat qu'avant.
 */
export function dimensionsProportionnelles(largeur: number, hauteur: number, max = MAX_IMAGE_DIMENSION): { width: number; height: number } {
  const echelle = Math.min(1, max / Math.max(largeur, hauteur));
  return { width: Math.max(1, Math.round(largeur * echelle)), height: Math.max(1, Math.round(hauteur * echelle)) };
}
