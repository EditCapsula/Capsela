"use client";

import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { BoutonDiscret } from "@/components/Button";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { CATLABEL, isBag } from "@/lib/data";
import { clePieces } from "@/lib/outfitFeedback";
import { useCapsela } from "@/lib/store";
import { useOuvrirPiece } from "@/components/useOuvrirPiece";
import type { Item } from "@/lib/types";

/**
 * LE HERO DE LA PAGE TENUE, repris pour le détail d'un look planifié (14/10/2026, demandé : « reprends le hero de la page Tenues »).
 * Mêmes mesures et même construction que la carte de TenuesScreen : fond de la carte du look, hauteur de 564 px minimum, ligne de
 * statut, phrase manuscrite par-dessus le haut de la zone, composition `look-detail`, provenance des pièces sous la composition,
 * une zone d'information à la place de « Porter cette tenue », deux actions discrètes côte à côte.
 *
 * Un composant à part, et non un morceau de TenuesScreen extrait : la carte de Tenue est liée à l'état de la tenue du jour (score, badges, quota,
 * plan appliqué, validation). Ici rien de tout cela — la tenue est celle qui a été gardée. Si la carte de Tenue change de mesures, celle-ci les suit à la main.
 */
export function HeroTenue({
  statut,
  phrase,
  pieces,
  vide,
  info,
  actions,
}: {
  statut: string;
  /** La phrase d'ambiance, manuscrite, posée par-dessus le haut de la zone. */
  phrase?: string;
  pieces: Item[];
  /** Dit pourquoi la composition est vide (pièces retirées du dressing). */
  vide?: string;
  /** Remplace le bouton principal : un constat, jamais une action qui n'existe pas. */
  info?: string;
  actions: { cle: string; glyphe: string; libelle: string; onClick: () => void }[];
}) {
  const ouvrirPiece = useOuvrirPiece();
  const total = pieces.length;
  const capsule = pieces.filter((p) => isCatalogId(p.id)).length;
  const dressing = total - capsule;
  const n = (k: number) => `${k} ${k <= 1 ? "pièce" : "pièces"}`;
  const provenance: { cle: string; glyphe: string; texte: string }[] = [];
  if (dressing > 0) provenance.push({ cle: "dressing", glyphe: "◔", texte: `${n(dressing)} de ton dressing` });
  if (capsule > 0) provenance.push({ cle: "capsule", glyphe: "⬚", texte: `${n(capsule)} de ta capsule` });
  if (provenance.length === 1) provenance[0] = { ...provenance[0], texte: `Une sélection de ${provenance[0].texte}` };

  return (
    <div className="-mx-2 mt-[18px] rounded-hero flex flex-col text-ink" style={{ background: "var(--color-hero-background)", padding: 16, containerType: "inline-size", minHeight: 564 }}>
      <div className="flex-shrink-0 flex items-center justify-between gap-3 h-[32px]">
        <span className="t-label" aria-live="polite">
          <span aria-hidden="true">✦ </span>
          {statut}
        </span>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <div className="relative flex-1 min-h-0" style={{ minHeight: 350 }}>
          {phrase && (
            <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
              <span className="font-hand text-[17px] leading-[1.15]" style={{ color: "var(--color-sand-text)" }}>
                {phrase}
              </span>
            </div>
          )}
          {total > 0 ? (
            <div className="absolute inset-y-0 left-2 right-2">
              <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(pieces.map((p) => p.id)).join(",")} onPiece={ouvrirPiece} />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-center px-6 text-[13px] leading-[1.5] text-ink-soft">{vide}</div>
          )}
        </div>
        {provenance.length > 0 && (
          <div className="flex-shrink-0 flex flex-wrap gap-[5px] mt-[5px] px-[6px]">
            {provenance.map((p) => (
              <span key={p.cle} className="inline-flex items-center gap-[7px] rounded-full pl-[6px] pr-[11px] py-[4px] text-[11px] leading-[1.25]" style={{ background: "rgba(29,26,22,.07)", color: "var(--color-ink)" }}>
                <span aria-hidden="true" className="w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] flex-shrink-0" style={{ background: "rgba(29,26,22,.1)" }}>
                  {p.glyphe}
                </span>
                {p.texte}
              </span>
            ))}
          </div>
        )}
      </div>

      {info && (
        <div className="mt-[8px] flex-shrink-0 flex items-center justify-center rounded-full text-[13px] text-ink text-center px-4" style={{ minHeight: 56, border: "1px dashed rgba(29,26,22,.3)" }}>
          {info}
        </div>
      )}

      <div className="flex-shrink-0 grid grid-cols-2 gap-[9px] mt-[8px]">
        {actions.map((a) => (
          <BoutonDiscret key={a.cle} style={{ minHeight: 48 }} onClick={a.onClick}>
            <span aria-hidden="true">{a.glyphe}</span> {a.libelle}
          </BoutonDiscret>
        ))}
      </div>
    </div>
  );
}

/**
 * LE RAIL DES PIÈCES de la page Tenue (« Les pièces de ta tenue · N »), sans l'échange ⇄ : une tenue planifiée est gardée telle quelle.
 * Le tap ouvre la même fiche qu'ailleurs (la pièce du dressing, ou « comment porter » pour une suggestion).
 */
export function RailPiecesTenue({ pieces }: { pieces: Item[] }) {
  const { actions } = useCapsela();
  if (!pieces.length) return null;
  return (
    <>
      <div className="t-surtitre text-muted mt-[26px] mb-[10px]">Les pièces de ta tenue · {pieces.length}</div>
      <div className="scrollarea flex gap-[10px] overflow-x-auto pb-[4px]" style={{ scrollSnapType: "x mandatory" }}>
        {pieces.map((it) => {
          const suggested = isCatalogId(it.id);
          const img = resolveItemImage(it);
          return (
            <div key={it.id} className="flex-none w-[112px]" style={{ scrollSnapAlign: "start" }}>
              <button
                onClick={() => actions.openItem(it.id, suggested)}
                aria-label={`${it.name} — ${CATLABEL[isBag(it) ? "sac" : it.cat]}. Voir le détail`}
                className="relative block w-[112px] h-[112px] rounded-bloc overflow-hidden cursor-pointer"
                style={{ background: img.url ? "var(--color-photo-bg)" : it.hex }}
              >
                {img.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{ width: "100%", height: "100%", objectFit: img.kind === "photo" ? "cover" : "contain", padding: img.kind === "photo" ? 0 : 9, boxSizing: "border-box" }}
                  />
                ) : (
                  <span className="absolute left-[7px] bottom-[6px] text-[9px] tracking-[.05em]" style={{ color: "rgba(243,238,229,.9)", textShadow: "0 1px 2px rgba(0,0,0,.35)" }}>
                    {CATLABEL[it.cat].toUpperCase()}
                  </span>
                )}
              </button>
              <div className="text-[11px] text-ink leading-[1.25] mt-[8px]">{it.name}</div>
              <div className="text-[10px] text-muted mt-[2px]">{CATLABEL[isBag(it) ? "sac" : it.cat]}</div>
              <div className="text-[10px] mt-[1px]" style={{ color: suggested ? "var(--color-sand-text)" : "var(--color-muted)" }}>
                {suggested ? "Capsule" : "Ton dressing"}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
