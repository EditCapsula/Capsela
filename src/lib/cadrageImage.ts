/*
 * NORMALISATION DE LA PRÉSENCE DES PIÈCES À L'ÉCRAN (polish Capsule, 25/09/2026).
 *
 * POURQUOI `object-fit: contain` NE SUFFIT PAS. Il cadre l'IMAGE, pas le
 * vêtement. Or le prompt de génération du catalogue (imagePrompt.ts) demande
 * une « marge vide généreuse sur les quatre côtés » et, pour les pièces
 * longues, de les réduire « plus que d'habitude » : d'une image à l'autre, le
 * vêtement occupe une part très différente du cadre. Côte à côte, un manteau
 * paraît minuscule à côté d'un t-shirt.
 *
 * LA CORRECTION. On mesure, sur une copie réduite de l'image (64 px), le
 * rectangle réellement occupé par la pièce — fond transparent (alpha) ou fond
 * uni (couleur des coins) — puis on agrandit et recentre l'image pour que ce
 * rectangle remplisse la même zone utile dans chaque vignette. Ni
 * déformation (le ratio de l'image est conservé), ni recadrage de la pièce :
 * seul le vide autour d'elle est réduit.
 *
 * Quand la mesure n'est pas possible — fond non uni (photo prise chez soi),
 * image servie sans CORS, rien de détecté —, on retombe sur l'affichage
 * d'avant : l'image entière, contenue. Jamais une supposition.
 */

/** Rectangle occupé par la pièce, en fractions (0-1) de la largeur et de la hauteur de l'image. */
export interface Boite {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Analyse {
  boite: Boite;
  /** Couleur du fond si l'image en a un (opaque), pour que le cadre le prolonge sans liseré ; null si transparent. */
  fond: string | null;
}

/** Tolérance de couleur (somme des écarts R+G+B) sous laquelle un pixel est tenu pour du fond — assez large pour l'ombre très douce que demande le prompt. */
const TOLERANCE_FOND = 40;
/** Tolérance du second passage, pour les pièces pâles sur fond gris clair. */
const TOLERANCE_FINE = 14;
/** Écart maximal entre les coins pour considérer le fond comme uni. */
const TOLERANCE_COINS = 30;

/**
 * Rectangle occupé par la pièce dans des pixels RGBA (`data` de getImageData).
 *
 * Une ligne ou une colonne ne compte que si au moins 2 pixels (3 % au-delà
 * de 64 px) ne sont pas du fond : un grain isolé ne doit pas élargir la
 * boîte. La tolérance de fond (40) écarte l'ombre douce ; une pièce pâle sur
 * gris clair, plus proche du fond que cela, est reprise par un second passage
 * à tolérance fine (cf. analyserPixels). Rend null si le fond n'est ni transparent ni uni, ou si la pièce
 * détectée est invraisemblable (moins de 0,4 % de l'image).
 */
export function analyserPixels(px: ArrayLike<number>, w: number, h: number): Analyse | null {
  // Second passage, plus fin, seulement sur fond uni opaque et seulement si le
  // premier n'a rien trouvé : c'est le cas des pièces pâles, que le prompt pose
  // sur un gris clair dont elles ne diffèrent que de quelques niveaux. La
  // tolérance fine attrape aussi l'ombre douce — une boîte un peu large vaut
  // mieux qu'une pièce restée minuscule.
  return analyserAvecTolerance(px, w, h, TOLERANCE_FOND) ?? analyserAvecTolerance(px, w, h, TOLERANCE_FINE);
}

function analyserAvecTolerance(px: ArrayLike<number>, w: number, h: number, tolerance: number): Analyse | null {
  if (w < 4 || h < 4) return null;
  const idx = (x: number, y: number) => (y * w + x) * 4;
  const coins = [idx(0, 0), idx(w - 1, 0), idx(0, h - 1), idx(w - 1, h - 1)];

  let estFond: (i: number) => boolean;
  let fond: string | null = null;
  if (coins.every((i) => px[i + 3] < 16)) {
    // L'alpha ne dépend pas de la tolérance : un seul passage suffit.
    if (tolerance !== TOLERANCE_FOND) return null;
    estFond = (i) => px[i + 3] < 24;
  } else if (coins.every((i) => px[i + 3] > 250)) {
    const ref = [0, 1, 2].map((c) => Math.round(coins.reduce((s, i) => s + px[i + c], 0) / coins.length));
    const ecart = (i: number) => Math.abs(px[i] - ref[0]) + Math.abs(px[i + 1] - ref[1]) + Math.abs(px[i + 2] - ref[2]);
    if (coins.some((i) => ecart(i) > TOLERANCE_COINS)) return null;
    estFond = (i) => px[i + 3] < 24 || ecart(i) <= tolerance;
    fond = `rgb(${ref[0]}, ${ref[1]}, ${ref[2]})`;
  } else {
    return null;
  }

  const parLigne = new Array<number>(h).fill(0);
  const parColonne = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!estFond(idx(x, y))) {
        parLigne[y] += 1;
        parColonne[x] += 1;
      }
    }
  }
  const seuilLigne = Math.max(2, Math.round(w * 0.03));
  const seuilColonne = Math.max(2, Math.round(h * 0.03));
  const y0 = parLigne.findIndex((n) => n >= seuilLigne);
  const x0 = parColonne.findIndex((n) => n >= seuilColonne);
  if (y0 < 0 || x0 < 0) return null;
  const y1 = h - [...parLigne].reverse().findIndex((n) => n >= seuilLigne);
  const x1 = w - [...parColonne].reverse().findIndex((n) => n >= seuilColonne);

  const boite = { x0: x0 / w, y0: y0 / h, x1: x1 / w, y1: y1 / h };
  // Garde-fou de vraisemblance, bas : une bague occupe 1,3 % d'une image du
  // catalogue (mesuré sur le banc du 25/09/2026). Le bruit, lui, est déjà
  // écarté par le seuil de 2 pixels par ligne et par colonne.
  if ((boite.x1 - boite.x0) * (boite.y1 - boite.y0) < 0.004) return null;
  return { boite, fond };
}

/** Position de l'image dans son cadre, en pourcentages du cadre. */
export interface Placement {
  largeur: number;
  hauteur: number;
  gauche: number;
  haut: number;
}

/**
 * Où poser l'image pour que la pièce (`boite`) remplisse la zone utile du
 * cadre, centrée, sans déformation.
 *
 * - `ratioImage`, `ratioCadre` : largeur / hauteur ;
 * - `marge` : vide conservé de chaque côté, en fraction du cadre ;
 * - `zoomMax` : agrandissement maximal par rapport à l'image simplement
 *   contenue (×4 : une zone de 15 % d'une image de 1024 px garde encore
 *   environ 150 px de source pour une vignette de 100 px), pour ne pas
 *   pixelliser un bijou minuscule.
 *
 * Une image sans marge (boîte pleine) retombe exactement sur l'affichage
 * contenu, rétréci de la marge.
 */
export function placementDansCadre(boite: Boite, ratioImage: number, ratioCadre: number, marge = 0.1, zoomMax = 4): Placement {
  const bw = Math.max(0.01, boite.x1 - boite.x0);
  const bh = Math.max(0.01, boite.y1 - boite.y0);
  const utile = 1 - 2 * marge;
  const contenue = Math.min(1, ratioImage / ratioCadre);
  const largeurFrac = Math.min(utile / bw, (utile * ratioImage) / (ratioCadre * bh), contenue * zoomMax);
  const hauteurFrac = (largeurFrac * ratioCadre) / ratioImage;
  const cx = (boite.x0 + boite.x1) / 2;
  const cy = (boite.y0 + boite.y1) / 2;
  return {
    largeur: largeurFrac * 100,
    hauteur: hauteurFrac * 100,
    gauche: (0.5 - cx * largeurFrac) * 100,
    haut: (0.5 - cy * hauteurFrac) * 100,
  };
}

/**
 * Mesure une image déjà chargée. Exige qu'elle ait été chargée avec
 * `crossOrigin="anonymous"` depuis une origine qui l'autorise, sans quoi le
 * canvas est « teinté » et la lecture lève une exception — rattrapée : null.
 */
export function analyserImage(img: HTMLImageElement): (Analyse & { ratio: number }) | null {
  try {
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const ratio = img.naturalWidth / img.naturalHeight;
    const cote = 64;
    const w = ratio >= 1 ? cote : Math.max(8, Math.round(cote * ratio));
    const h = ratio >= 1 ? Math.max(8, Math.round(cote / ratio)) : cote;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const analyse = analyserPixels(ctx.getImageData(0, 0, w, h).data, w, h);
    return analyse ? { ...analyse, ratio } : null;
  } catch {
    return null;
  }
}
