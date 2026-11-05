import type { Marges } from "./catalogMarges";

/*
 * LES MARGES D'UNE PHOTO DU DRESSING, MESURÉES À L'AFFICHAGE (05/11/2026, vu en rendu réel : une robe nuisette du dressing posée à peine
 * plus grande que des collants). Le tableau des marges (catalogMarges.ts) ne connaît que les visuels du catalogue. Une photo détourée du
 * dressing garde le cadre entier de la photo d'origine, la pièce n'en occupe qu'une partie : sans boîte connue, le moteur supposait un
 * portrait courant (0,8), posait la robe dans une boîte bien trop large, bornée à la largeur d'une colonne — et la rapetissait.
 *
 * Ici, l'image chargée est lue une fois, réduite : la boîte des pixels visibles (alpha ≥ 20, comme scripts/mesurer-marges-catalogue.mjs)
 * donne ses marges, puis la planche se recompose avec la vraie forme de la pièce. Une photo opaque (non détourée) rend toute l'image : sa
 * forme est alors celle de la photo. Rien n'est enregistré : la mesure vit le temps de la session, en mémoire.
 */

/** La part de sécurité ajoutée autour de la pièce (l'ombre, l'antialiasing), en fraction du côté — 1 %, comme pour le catalogue. */
const SECURITE = 0.01;

/** La boîte des pixels visibles d'une image RGBA, en marges (fractions du côté) ; null si l'image est entièrement transparente. */
export function margesDepuisAlpha(data: Uint8ClampedArray | Uint8Array, largeur: number, hauteur: number, seuil = 20): Marges | null {
  let x0 = largeur;
  let x1 = -1;
  let y0 = hauteur;
  let y1 = -1;
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      if (data[(y * largeur + x) * 4 + 3] < seuil) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const borne = (v: number) => Math.max(0, Math.min(1, v));
  return {
    g: borne(x0 / largeur - SECURITE),
    h: borne(y0 / hauteur - SECURITE),
    d: borne(1 - (x1 + 1) / largeur - SECURITE),
    b: borne(1 - (y1 + 1) / hauteur - SECURITE),
  };
}

/** Ce que la mesure rend : les marges de la pièce dans l'image, et le format de l'image entière (largeur / hauteur). */
export interface MesureImage {
  marges: Marges;
  ratioImage: number;
}

const memoire = new Map<string, MesureImage | null>();
const enCours = new Map<string, Promise<MesureImage | null>>();

/** La mesure déjà faite d'une image (undefined : pas encore mesurée ; null : illisible). */
export function mesureConnue(url: string): MesureImage | null | undefined {
  return memoire.get(url);
}

/** Le format (largeur / hauteur) de la pièce elle-même, d'après sa mesure. */
export function ratioPiece(m: MesureImage): number {
  return ((1 - m.marges.g - m.marges.d) * m.ratioImage) / Math.max(0.01, 1 - m.marges.h - m.marges.b);
}

/**
 * Mesure une image, une seule fois par adresse. Ne jette jamais : une image illisible (réseau, lecture refusée par le
 * navigateur) rend null, et la planche garde le format supposé d'avant.
 */
export function mesurerImage(url: string): Promise<MesureImage | null> {
  if (memoire.has(url)) return Promise.resolve(memoire.get(url) ?? null);
  const deja = enCours.get(url);
  if (deja) return deja;
  const p = new Promise<MesureImage | null>((resolve) => {
    if (typeof document === "undefined") return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        // Réduite à 160 px au plus sur le grand côté : assez pour une boîte au pourcent près, sans coût à l'affichage.
        const k = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k));
        const h = Math.max(1, Math.round(img.naturalHeight * k));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, w, h);
        const marges = margesDepuisAlpha(ctx.getImageData(0, 0, w, h).data, w, h);
        resolve(marges ? { marges, ratioImage: img.naturalWidth / img.naturalHeight } : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  }).then((m) => {
    memoire.set(url, m);
    enCours.delete(url);
    return m;
  });
  enCours.set(url, p);
  return p;
}
