/*
 * LES TAILLES DE PLANCHE EN PIXELS, PLUS EN UNITÉS DE CONTENEUR (17/11/2026, signalé sur iPhone, TestFlight : « XP complètement
 * cassée » à l'étape Style de l'onboarding — le flat lay vide, les looks portés plus larges que hauts, hors de la carte).
 *
 * Les planches (FlatLayCapsela, OutfitComposition, ZoneLookDuJour) et la découverte des styles se dimensionnaient en `cqw` / `cqh`.
 * Ces unités n'existent dans Safari qu'à partir d'iOS 16, alors que l'app iOS accepte iOS 15 (IPHONEOS_DEPLOYMENT_TARGET) : sur un
 * moteur qui les ignore, la largeur tombe et la mise en page s'effondre. La taille du cadre est désormais MESURÉE (ResizeObserver,
 * disponible depuis iOS 13.4) et écrite en pixels ; l'expression en unités de conteneur ne sert plus qu'au tout premier rendu, avant
 * la mesure, là où elle est comprise. Le résultat est le même qu'avant là où `cqw` marchait : mêmes formules, en pixels.
 */

/** La largeur d'une planche de format 100 × `hauteur`, contenue dans un cadre `largeur` × `haut` : `min(100cqw, 100cqh × 100 / hauteur)`. */
export function largeurPlanche(largeur: number, haut: number, hauteur: number): number {
  return Math.max(0, Math.min(largeur, (haut * 100) / hauteur));
}

/** La même largeur, écrite pour le style : en pixels une fois le cadre mesuré, en unités de conteneur avant. */
export function styleLargeurPlanche(taille: { w: number; h: number } | null, hauteur: number): string {
  if (taille && taille.w > 0 && taille.h > 0) return `${Math.round(largeurPlanche(taille.w, taille.h, hauteur) * 100) / 100}px`;
  return `min(100cqw, calc(100cqh * ${100 / hauteur}))`;
}

/**
 * La largeur ET la hauteur de la planche, pour le style (17/11/2026, toujours cassé sur iPhone après le passage en pixels de la seule
 * largeur) : la hauteur ne dépend plus de `aspect-ratio`, que Safari applique mal à certains éléments flexibles. Avant la mesure,
 * l'expression d'origine et le format.
 */
export function styleTaillePlanche(taille: { w: number; h: number } | null, hauteur: number): { width: string; height?: string; aspectRatio: string } {
  const aspectRatio = `100 / ${hauteur}`;
  if (taille && taille.w > 0 && taille.h > 0) {
    const l = largeurPlanche(taille.w, taille.h, hauteur);
    return { width: `${Math.round(l * 100) / 100}px`, height: `${Math.round(((l * hauteur) / 100) * 100) / 100}px`, aspectRatio };
  }
  return { width: styleLargeurPlanche(null, hauteur), aspectRatio };
}

/**
 * Les tailles de la découverte des styles, en pixels : le visuel (3:4) et chaque look porté (4:5), largeur ET hauteur — sans
 * `aspect-ratio` (17/11/2026 : sur iPhone, les looks sortaient plus larges que hauts).
 */
export function taillesDecouverteStyle(largeur: number, avecLooks: boolean): { visuel: { w: number; h: number }; look: { w: number; h: number } } {
  const h = hauteurVisuelStyle(largeur, avecLooks);
  const lh = (h - 16) / 3;
  return { visuel: { w: Math.round((h * 3) / 4), h: Math.round(h) }, look: { w: Math.round((lh * 4) / 5), h: Math.round(lh) } };
}

/**
 * La hauteur du visuel de la découverte des styles : `clamp(160px, f × largeur, 460px)` — f vaut 0,96 avec les looks portés à côté,
 * 1,10 sans (les valeurs d'origine, en cqw, du 15/11/2026).
 */
export function hauteurVisuelStyle(largeur: number, avecLooks: boolean): number {
  return Math.min(460, Math.max(160, largeur * (avecLooks ? 0.96 : 1.1)));
}
