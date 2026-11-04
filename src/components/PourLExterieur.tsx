"use client";

import PhotoPiece from "@/components/PhotoPiece";
import type { Item } from "@/lib/types";

/**
 * « POUR L'EXTÉRIEUR » (04/11/2026, coucheExterieure.ts) : le manteau ajouté par le froid, montré À CÔTÉ du look, sur tous les hero
 * (Tenue, accueil, look planifié). Une ligne secondaire entre deux filets fins — jamais une seconde grande carte : une vignette plus
 * petite que la composition, le titre, la température, un chevron. `quand` complète la température : « aujourd'hui », « prévus ».
 */
export default function PourLExterieur({
  piece,
  temperature,
  quand,
  onClick,
  compact = false,
}: {
  piece: Item;
  temperature: number;
  quand: string;
  onClick: () => void;
  /** Sur l'accueil, la carte est plus étroite : vignette et texte un cran plus petits. */
  compact?: boolean;
}) {
  const t = Math.round(temperature);
  return (
    <button
      type="button"
      onClick={onClick}
      className={"w-full flex items-center text-left border-y border-border cursor-pointer " + (compact ? "gap-[10px] py-[8px]" : "gap-[12px] py-[10px]")}
    >
      <span className={"flex-shrink-0 " + (compact ? "w-[48px]" : "w-[64px]")}>
        <PhotoPiece piece={piece} ratio={1} rayon={compact ? 10 : 12} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className={"font-serif italic text-ink leading-[1.2] " + (compact ? "text-[14px]" : "text-[16px]")}>Pour l&apos;extérieur</span>
          <span className="inline-flex items-center gap-[4px] flex-shrink-0 rounded-full px-[8px] py-[3px] text-[11px] text-ink" style={{ background: "var(--color-warm-bg)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />
            </svg>
            {t}°
          </span>
        </span>
        <span className={"block text-muted-3 leading-[1.4] mt-[2px] " + (compact ? "text-[11px]" : "text-[12px]")} style={{ textWrap: "pretty" }}>
          {piece.name}, à ajouter selon la météo ({t}° {quand}).
        </span>
      </span>
      <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
    </button>
  );
}
