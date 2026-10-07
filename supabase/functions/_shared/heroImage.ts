// Traitement PUR des visuels « hero » (08/10/2026) : rogner l'image sur la pièce, et dire son format dans son NOM.
//
// Le visuel standard du catalogue est un carré 800 × 800 dont la pièce n'occupe que 22 à 85 % (cf. src/lib/catalogMarges.ts) :
// la planche a besoin d'un tableau de marges pour le rogner. Un visuel hero est rogné DÈS LA GÉNÉRATION, et son format est
// inscrit dans le nom du fichier (« …-r0.83.webp », largeur / hauteur) : l'app lit le ratio dans l'URL, aucune colonne en plus
// et aucun tableau à tenir à jour.

export interface ImageRgba {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** La boîte (en pixels, bornes incluses) des pixels dont l'alpha est ≥ seuil, ou null si l'image est vide. */
export function boiteOpaque(img: ImageRgba, seuil = 20): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (img.data[(y * img.width + x) * 4 + 3] >= seuil) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
}

/** Rogne l'image sur la pièce, avec une marge de 2 % du plus grand côté (l'ombre ajoutée plus tard ne doit pas être coupée). */
export function rognerSurLaPiece(img: ImageRgba, seuil = 20): ImageRgba | null {
  const b = boiteOpaque(img, seuil);
  if (!b) return null;
  const marge = Math.round(Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.02);
  const x0 = Math.max(0, b.x0 - marge);
  const y0 = Math.max(0, b.y0 - marge);
  const x1 = Math.min(img.width - 1, b.x1 + marge);
  const y1 = Math.min(img.height - 1, b.y1 + marge);
  const width = x1 - x0 + 1;
  const height = y1 - y0 + 1;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const source = ((y0 + y) * img.width + x0) * 4;
    data.set(img.data.subarray(source, source + width * 4), y * width * 4);
  }
  return { data, width, height };
}

/** Le nom du fichier d'un visuel hero : le ratio (largeur / hauteur) y est inscrit, à deux décimales. */
export function nomFichierHero(id: number, ratio: number, horodatage: number): string {
  return `${id}-${horodatage}-r${ratio.toFixed(2)}.webp`;
}
