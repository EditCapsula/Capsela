"use client";

import { fondPhotoPiece, resolveItemImage } from "@/lib/catalogImages";
import type { CategoryKey, Item } from "@/lib/types";

/**
 * Une pièce montrée par sa vraie photo (cadrée), ou son fond doux et l'icône de sa catégorie quand elle n'en a pas — jamais une image de stock.
 *
 * `entiere` (12/11/2026, signalé en capture : « les photos des pièces sur la fiche ne sont pas mises en valeur ») : la pièce se montre EN
 * ENTIER, posée sur le fond de tuile avec de l'air autour, au lieu d'être recadrée pour remplir la case — un pantalon y perdait ses jambes.
 * Pour les vues où la pièce est le sujet (la feuille d'une pièce du look et ses alternatives) ; les grilles gardent le cadrage d'avant.
 */
export default function PhotoPiece({ piece, ratio, rayon, className = "", entiere = false }: { piece: Item; ratio: number; rayon: number; className?: string; entiere?: boolean }) {
  const img = resolveItemImage(piece);
  if (entiere && img.url) {
    return (
      <div
        role="img"
        aria-label={piece.name}
        className={`relative w-full overflow-hidden ${className}`}
        style={{ aspectRatio: String(ratio), borderRadius: rayon, background: "var(--color-photo-bg)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.url} alt="" decoding="async" className="absolute inset-0 w-full h-full object-contain" style={{ padding: "9%" }} />
      </div>
    );
  }
  return (
    <div
      role={img.url ? "img" : undefined}
      aria-label={img.url ? piece.name : undefined}
      className={`relative w-full overflow-hidden flex items-center justify-center ${className}`}
      style={{ aspectRatio: String(ratio), borderRadius: rayon, background: "var(--color-warm-bg)", ...(img.url ? fondPhotoPiece(img.url, img.kind === "detouree") : null) }}
    >
      {!img.url && <IconeCategorie cat={piece.cat} />}
    </div>
  );
}

/** Icône linéaire (trait 1.6) de la catégorie — le repli d'une photo absente. */
function IconeCategorie({ cat }: { cat: CategoryKey }) {
  const chemin: Partial<Record<CategoryKey, string>> = {
    haut: "M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3a4 4 0 01-8 0z",
    pull: "M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3a4 4 0 01-8 0z",
    pantalon: "M7 3h10l1 18h-4l-2-9-2 9H6z",
    jean: "M7 3h10l1 18h-4l-2-9-2 9H6z",
    short: "M7 5h10l1 9h-5l-1-3-1 3H6z",
    jupe: "M9 4h6l4 16H5z",
    robe: "M9 3h6l-1 6 4 12H6l4-12z",
    combinaison: "M9 3h6l-1 6 4 12H6l4-12z",
    veste: "M8 4l-4 3v13h5V9l3 3 3-3v11h5V7l-4-3-4 4z",
    manteau: "M8 4l-4 3v14h5V9l3 3 3-3v12h5V7l-4-3-4 4z",
    chaussures: "M4 16c4 0 5-3 6-7l3 2c1 3 3 4 7 4v3H4z",
    sac: "M6 9h12l1 11H5zM9 9a3 3 0 016 0",
  };
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={chemin[cat] ?? "M12 4a2 2 0 011 3.7L12 9l8 6H4l8-6"} />
    </svg>
  );
}

