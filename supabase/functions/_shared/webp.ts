// Compression des visuels du catalogue — partagé entre la génération
// (generate-catalog-image) et la recompression du stock hérité
// (recompress-legacy-images), pour garantir que les deux produisent des
// fichiers rigoureusement identiques.
//
// 800×800 (max, correctif 21/08/2026 — egress cache Free Plan Supabase
// dépassé) : couvre confortablement le plus grand affichage réel de l'app
// (fiche détail plein écran PieceScreen, ratio 4/5, très en dessous de 800px
// de large même en 2x retina sur mobile) ; toutes les autres cartes sont
// nettement plus petites (jusqu'à 119px, cf. TenuesScreen/CapsuleScreen).
import { MAX_IMAGE_DIMENSION, dimensionsProportionnelles } from "./dimensions.ts";
export { MAX_IMAGE_DIMENSION };

export interface EncodedImage {
  bytes: Uint8Array;
  contentType: string;
  ext: string;
}

/**
 * Redimensionnement (@jsquash/resize) + conversion WebP (@jsquash/webp),
 * best-effort. Repli automatique et silencieux sur le PNG brut (taille
 * d'origine) si une étape échoue pour une raison quelconque : ne bloque
 * jamais l'appelant.
 *
 * L'appelant peut détecter le repli en testant `ext === "png"` — c'est ce que
 * fait recompress-legacy-images, qui refuse alors de réécrire quoi que ce
 * soit plutôt que de remplacer un PNG par un PNG.
 */
export async function toWebp(pngBytes: Uint8Array): Promise<EncodedImage> {
  try {
    const { default: decode } = await import("https://esm.sh/@jsquash/png@2.1.0/decode.js");
    const { default: resize } = await import("https://esm.sh/@jsquash/resize@1.1.1");
    const { default: encode } = await import("https://esm.sh/@jsquash/webp@1.4.0/encode.js");
    let imageData = await decode(pngBytes.buffer as ArrayBuffer);
    if (imageData.width > MAX_IMAGE_DIMENSION || imageData.height > MAX_IMAGE_DIMENSION) {
      imageData = await resize(imageData, dimensionsProportionnelles(imageData.width, imageData.height));
    }
    const webpBuffer = await encode(imageData, { quality: 75 });
    return { bytes: new Uint8Array(webpBuffer), contentType: "image/webp", ext: "webp" };
  } catch (err) {
    console.error("Redimensionnement/conversion WebP indisponible, repli sur PNG brut :", err);
    return { bytes: pngBytes, contentType: "image/png", ext: "png" };
  }
}

/** Décode un PNG en pixels RGBA (@jsquash/png) — pour recadrer une image détourée sans perdre sa transparence. */
export async function decoderPng(octets: Uint8Array): Promise<ImageData> {
  const { default: decode } = await import("https://esm.sh/@jsquash/png@2.1.0/decode.js");
  return await decode(octets.buffer.slice(octets.byteOffset, octets.byteOffset + octets.byteLength) as ArrayBuffer);
}

/** Pixels RGBA vers WebP (transparence conservée), ramenés à 800 px au plus sur le grand côté, proportions gardées. Repli sur null si la conversion échoue. */
export async function imageDataVersWebp(imageData: ImageData): Promise<EncodedImage | null> {
  try {
    const { default: resize } = await import("https://esm.sh/@jsquash/resize@1.1.1");
    const { default: encode } = await import("https://esm.sh/@jsquash/webp@1.4.0/encode.js");
    let image = imageData;
    if (image.width > MAX_IMAGE_DIMENSION || image.height > MAX_IMAGE_DIMENSION) {
      image = await resize(image, dimensionsProportionnelles(image.width, image.height));
    }
    const webp = await encode(image, { quality: 75 });
    return { bytes: new Uint8Array(webp), contentType: "image/webp", ext: "webp" };
  } catch (err) {
    console.error("Encodage WebP indisponible :", err);
    return null;
  }
}
