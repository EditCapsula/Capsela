"use client";

import { CATLABEL, isBag } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { styleDuLook, texteEditorialLook } from "@/lib/editorialLook";
import { clePieces } from "@/lib/outfitFeedback";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import type { Item, OccasionKey } from "@/lib/types";

/**
 * LES BLOCS DU DÉTAIL D'UN LOOK (20/11/2026), partagés par le détail d'un look de Mes looks (LookDetailScreen) et celui d'un look de la
 * valise (ValiseScreen, demandé : « pour cette page, reprends les mêmes éléments que la page détaillée du look »).
 *
 * CarteDuLook : la planche (FlatLayCapsela, la seule règle de composition), le texte éditorial (texteEditorialLook, celui de l'accueil)
 * et les couleurs réelles des pièces. LignePieceLook : une pièce du look, qui ouvre sa feuille ; « Suggérée » sous le nom.
 */
export function CarteDuLook({ pieces, occasion, onPiece, className = "" }: { pieces: Item[]; occasion: OccasionKey | null; onPiece: (it: Item) => void; className?: string }) {
  const { state } = useCapsela();
  const { profile } = useAuth();
  if (!pieces.length) return null;
  const texte = texteEditorialLook(pieces, occasion ?? "all", state.workMode, state.dateContext, styleDuLook(pieces, profile.styles, profile.gender));
  // Les couleurs du look : celles de ses pièces, chacune une fois (jamais une palette inventée).
  const couleurs = pieces.filter((p, i) => pieces.findIndex((q) => q.hex.toLowerCase() === p.hex.toLowerCase()) === i).slice(0, 6);
  return (
    <Card rayon="bloc" className={"overflow-hidden " + className}>
      <div className="relative bg-warm-bg" style={{ height: "clamp(260px, 78vw, 340px)" }}>
        <div className="absolute inset-y-0 left-2 right-2">
          <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(pieces.map((p) => p.id)).join(",")} onPiece={onPiece} />
        </div>
      </div>
      <div className="px-[16px] pt-[14px] pb-[16px]">
        <h2 className="font-serif text-[22px] leading-[1.15] text-ink">
          {texte.titre.a} {texte.titre.b && <em className="italic text-terracotta">{texte.titre.b}</em>}
        </h2>
        <p className="text-[13px] leading-[1.5] text-ink-soft mt-[6px]">{texte.phrase}</p>
        {couleurs.length > 1 && (
          <div className="flex items-center gap-[8px] mt-[12px]" aria-label={`Couleurs du look : ${couleurs.map((c) => c.color).join(", ")}`}>
            {couleurs.map((c) => (
              <span key={c.id} className="w-[22px] h-[22px] rounded-full" style={{ background: c.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.08)" }} aria-hidden="true" />
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function LignePieceLook({ piece, suggeree, detail, onClick }: { piece: Item; suggeree: boolean; detail?: string; onClick: () => void }) {
  const img = resolveItemImage(piece);
  const categorie = CATLABEL[isBag(piece) ? "sac" : piece.cat];
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left cursor-pointer active:opacity-80 w-full"
      aria-label={`${piece.name}, ${categorie}, ${piece.color}${suggeree ? ", suggérée" : ""}${detail ? ", " + detail : ""}`}
    >
      <Card rayon="bloc" className="flex items-center gap-[13px] p-[10px]">
        <div className="flex-shrink-0">
          <div
            className="w-[58px] h-[66px] rounded-mini overflow-hidden"
            style={{
              background: img.url ? "var(--color-photo-bg)" : piece.hex,
              boxShadow: img.url ? undefined : "inset 0 0 0 1px rgba(29,26,22,.06)",
              filter: suggeree ? "grayscale(55%) opacity(.8)" : undefined,
            }}
          >
            {img.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
            )}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="t-titre-ligne text-ink truncate">{piece.name}</div>
          <div className="text-[12px] text-muted mt-[3px] truncate">
            {categorie} · {piece.color}
          </div>
          {detail && <div className="text-[12px] text-terracotta mt-[3px] truncate">{detail}</div>}
          {/* Sous le nom, plus sur la vignette : posée dessus, la pastille débordait sur le nom (rendu du 20/11/2026). */}
          {suggeree && (
            <Badge tone="plein" taille="s" className="mt-[6px]">
              Suggérée
            </Badge>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-muted">
          <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Card>
    </button>
  );
}
