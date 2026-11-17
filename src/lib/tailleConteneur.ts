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
 * La hauteur du visuel de la découverte des styles : `clamp(160px, f × largeur, 460px)` — f vaut 0,96 avec les looks portés à côté,
 * 1,10 sans (les valeurs d'origine, en cqw, du 15/11/2026).
 */
export function hauteurVisuelStyle(largeur: number, avecLooks: boolean): number {
  return Math.min(460, Math.max(160, largeur * (avecLooks ? 0.96 : 1.1)));
}
