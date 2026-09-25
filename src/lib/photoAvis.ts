import { PHOTO_COTE_MAX, PHOTO_QUALITE } from "./dressing";

/*
 * PRÉPARATION DE LA PHOTO — Avis de styliste (docs/avis-de-styliste.md
 * section 11 ; arbitrages du 25/09/2026, point 14).
 *
 * - Formats : toute image que le navigateur sait lire. Rien n'est refusé sur
 *   son type déclaré (un HEIC arrive parfois sans type) : on tente de la
 *   décoder, et c'est l'échec du décodage qui la rend invalide.
 * - Taille source : 15 Mo au plus, contrôlée avant tout décodage.
 * - Compression : les réglages des photos du dressing (PHOTO_COTE_MAX,
 *   PHOTO_QUALITE : 1200 px, JPEG 0,8), réutilisés plutôt que redéfinis.
 * - Métadonnées : le ré-encodage par canvas n'en conserve aucune — EXIF, et
 *   donc position GPS, comprises. L'orientation est appliquée avant
 *   (`imageOrientation: "from-image"`), sinon la photo sortirait couchée.
 *
 * DIFFÉRENCE ASSUMÉE AVEC compressDressingPhoto. Celle-ci rend le fichier
 * d'origine au moindre échec, pour ne jamais bloquer un ajout au dressing.
 * Ici ce repli enverrait la photo brute, EXIF compris : la préparation est
 * donc stricte — une photo qu'on ne peut pas ré-encoder est refusée, jamais
 * transmise telle quelle. Et le JPEG produit est toujours utilisé, même s'il
 * pèse plus que l'original.
 */

/** Poids maximal du fichier choisi, avant préparation (arbitré : 15 Mo). */
export const TAILLE_SOURCE_MAX = 15 * 1024 * 1024;

export type PhotoPreparee =
  | { ok: true; fichier: File; largeur: number; hauteur: number }
  | { ok: false; raison: "trop_lourde" | "illisible" };

export async function preparerPhotoAvis(file: File): Promise<PhotoPreparee> {
  if (file.size > TAILLE_SOURCE_MAX) return { ok: false, raison: "trop_lourde" };
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return { ok: false, raison: "illisible" };
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    if (!bitmap.width || !bitmap.height) return { ok: false, raison: "illisible" };
    const echelle = Math.min(1, PHOTO_COTE_MAX / Math.max(bitmap.width, bitmap.height));
    const largeur = Math.max(1, Math.round(bitmap.width * echelle));
    const hauteur = Math.max(1, Math.round(bitmap.height * echelle));
    const canvas = document.createElement("canvas");
    canvas.width = largeur;
    canvas.height = hauteur;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { ok: false, raison: "illisible" };
    // Fond blanc : le JPEG ignore la transparence et rendrait noir un PNG détouré.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largeur, hauteur);
    ctx.drawImage(bitmap, 0, 0, largeur, hauteur);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITE));
    if (!blob) return { ok: false, raison: "illisible" };
    // Nom neutre : le nom d'origine peut contenir une date, un lieu, un prénom.
    return { ok: true, fichier: new File([blob], "tenue.jpg", { type: "image/jpeg" }), largeur, hauteur };
  } catch {
    return { ok: false, raison: "illisible" };
  } finally {
    bitmap?.close();
  }
}
