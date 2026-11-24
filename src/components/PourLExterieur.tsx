"use client";

import PhotoPiece from "@/components/PhotoPiece";
import type { Item } from "@/lib/types";
import { degres } from "@/lib/unites";

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
  forme = "ligne",
  note = null,
  minimale = false,
}: {
  piece: Item;
  temperature: number;
  quand: string;
  onClick: () => void;
  /** Sur l'accueil, la carte est plus étroite : vignette et texte un cran plus petits. */
  compact?: boolean;
  /**
   * La présentation (18/11/2026, exploration « Ma tenue du jour », écran d'essai seulement) : « ligne », celle de partout ; « carte », une
   * carte indépendante à grande vignette ; « bandeau », une seule ligne sur fond chaud. Mêmes textes, même action.
   */
  forme?: "ligne" | "carte" | "bandeau";
  /** Une phrase de plus sous le texte (19/11/2026, phraseManteauTropLeger : les manteaux du dressing sont trop légers). */
  note?: string | null;
  /** La température est la minimale du jour (temperatureEstMinimale, 24/11/2026) : l'écran le dit, pour ne pas la confondre avec celle d'en haut. */
  minimale?: boolean;
}) {
  const t = Math.round(temperature);
  const pastille = minimale ? `min ${degres(t)}` : degres(t);
  const phrase = minimale
    ? `${piece.name}, à ajouter selon la météo (minimale ${quand === "aujourd'hui" ? "d'aujourd'hui" : "prévue"} : ${degres(t)}).`
    : `${piece.name}, à ajouter selon la météo (${degres(t)} ${quand}).`;
  if (forme === "bandeau") {
    return (
      <button type="button" onClick={onClick} className="w-full flex items-center gap-[10px] text-left rounded-bloc px-[10px] py-[6px] cursor-pointer" style={{ background: "var(--color-warm-bg)" }}>
        <span className="flex-shrink-0 w-[36px]">
          <PhotoPiece piece={piece} ratio={1} rayon={8} />
        </span>
        <span className="flex-1 min-w-0 truncate text-[12.5px] text-ink">
          <span className="font-semibold">Pour l&apos;extérieur</span>
          <span className="text-muted-3"> · {pastille} · {piece.name}</span>
        </span>
        <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
      </button>
    );
  }
  if (forme === "carte") {
    return (
      <button type="button" onClick={onClick} className="w-full flex items-stretch text-left bg-card border border-border rounded-carte overflow-hidden cursor-pointer">
        <span className="flex-shrink-0 w-[108px]" style={{ background: "var(--color-photo-bg)" }}>
          <PhotoPiece piece={piece} ratio={1} rayon={0} />
        </span>
        <span className="flex-1 min-w-0 px-4 py-[12px] flex flex-col justify-center">
          <span className="flex items-center justify-between gap-2">
            <span className="t-titre-carte text-ink">Pour l&apos;extérieur</span>
            <span className="inline-flex items-center gap-[4px] flex-shrink-0 rounded-full px-[8px] py-[3px] text-[11px] text-ink" style={{ background: "var(--color-warm-bg)" }}>
              {pastille}
            </span>
          </span>
          <span className="block text-[12px] text-muted-3 leading-[1.4] mt-[4px]" style={{ textWrap: "pretty" }}>
            {phrase}
          </span>
          {note && (
            <span className="block text-[12px] text-ink-soft leading-[1.4] mt-[4px]" style={{ textWrap: "pretty" }}>
              {note}
            </span>
          )}
        </span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={"w-full flex items-center text-left border-y border-border cursor-pointer " + (compact ? "gap-[10px] py-[8px]" : "gap-[12px] py-[10px]")}
    >
      {/* LE MANTEAU EN ENTIER (24/11/2026, retour : « on ne voit pas suffisamment le manteau ») : un manteau long, dans une vignette
          carrée de 48 px, ne se lisait pas. Vignette en portrait (3:4), un peu plus large, la pièce entière dedans. */}
      <span className={"flex-shrink-0 " + (compact ? "w-[60px]" : "w-[72px]")}>
        <PhotoPiece piece={piece} ratio={3 / 4} rayon={compact ? 10 : 12} entiere />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className={"text-ink " + (compact ? "t-titre-vignette" : "t-titre-carte")}>Pour l&apos;extérieur</span>
          <span className="inline-flex items-center gap-[4px] flex-shrink-0 rounded-full px-[8px] py-[3px] text-[11px] text-ink" style={{ background: "var(--color-warm-bg)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" />
            </svg>
            {pastille}
          </span>
        </span>
        <span className={"block text-muted-3 leading-[1.4] mt-[2px] " + (compact ? "text-[11px]" : "text-[12px]")} style={{ textWrap: "pretty" }}>
          {phrase}
        </span>
        {note && (
          <span className={"block text-ink-soft leading-[1.4] mt-[4px] " + (compact ? "text-[11px]" : "text-[12px]")} style={{ textWrap: "pretty" }}>
            {note}
          </span>
        )}
      </span>
      <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">›</span>
    </button>
  );
}

/**
 * « POUR FINALISER TA TENUE » (12/11/2026, arbitré par la propriétaire ; coucheExterieure.ts, conseilManteauPlusLong) : à la place de
 * « Pour l'extérieur », par le froid seulement, quand le manteau de la tenue est plus court que la veste qu'il couvre (R-B25) et que ni le
 * dressing ni la capsule n'en ont un assez long. La même ligne secondaire entre deux filets ; rien à toucher, un conseil.
 */
export function ConseilManteauPlusLong({ compact = false }: { compact?: boolean }) {
  return (
    <div role="note" className={"w-full border-y border-border " + (compact ? "py-[8px]" : "py-[10px]")}>
      <span className={"block t-titre-ligne text-ink " + (compact ? "text-[13px]" : "")}>Pour finaliser ta tenue</span>
      <span className={"block text-muted-3 leading-[1.4] mt-[2px] " + (compact ? "text-[11px]" : "text-[12px]")} style={{ textWrap: "pretty" }}>
        Tu devrais porter un manteau plus long pour rester au chaud tout en conservant l&apos;harmonie de ta silhouette.
      </span>
    </div>
  );
}
