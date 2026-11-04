"use client";

import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import PourLExterieur from "@/components/PourLExterieur";
import { separerCoucheExterieure } from "@/lib/coucheExterieure";
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
  pieces: piecesRecues,
  vide,
  info,
  actions,
  temperature,
  quand,
  candidatsExterieur,
  indicateurs,
  badge,
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
  /**
   * La température RÉELLE du jour du look (prévision, ou celle enregistrée à la planification) : sous le seuil du moteur, le manteau
   * se montre à part, dans « Pour l'extérieur » (04/11/2026, coucheExterieure.ts). Absente : rien n'est séparé.
   */
  temperature?: number | null;
  /** Complète la température : « prévus », « ce jour-là »… */
  quand?: string;
  /** Les manteaux que le moteur admet ici : par le froid, une tenue sans manteau en reçoit un, à part (separerCoucheExterieure). */
  candidatsExterieur?: Item[];
  /** La ligne d'indicateurs sous le visuel (IndicateursTenue), quand l'écran en a. */
  indicateurs?: React.ReactNode;
  /** Une pastille à droite du surtitre (« Ton dressing + ta capsule »…). */
  badge?: React.ReactNode;
}) {
  const ouvrirPiece = useOuvrirPiece();
  const { principal, exterieur } = separerCoucheExterieure(piecesRecues, temperature, candidatsExterieur);
  const pieces = principal;
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
        {badge}
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
        {indicateurs}
      </div>

      {exterieur && temperature != null && (
        <div className="mt-[6px] flex-shrink-0">
          <PourLExterieur piece={exterieur} temperature={temperature} quand={quand ?? "prévus"} onClick={() => ouvrirPiece(exterieur)} />
        </div>
      )}

      {info && (
        <div className="mt-[8px] flex-shrink-0 flex items-center justify-center rounded-full text-[13px] text-ink text-center px-4" style={{ minHeight: 56, border: "1px dashed rgba(29,26,22,.3)" }}>
          {info}
        </div>
      )}

      {actions.length > 0 && (
      <div className={"flex-shrink-0 grid gap-[9px] mt-[8px] " + (actions.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
        {actions.map((a) => (
          <BoutonDiscret key={a.cle} style={{ minHeight: 48 }} onClick={a.onClick}>
            <span aria-hidden="true">{a.glyphe}</span> {a.libelle}
          </BoutonDiscret>
        ))}
      </div>
      )}
    </div>
  );
}

/**
 * LES INDICATEURS DE LA TENUE (04/11/2026, maquette « Look planifié ») : de petites pastilles sous le visuel — style, occasion, météo,
 * palette. Chacune n'apparaît que si l'écran a la donnée ET qu'elle est vraie (l'appelant décide ; rien n'est déduit ici).
 */
export function IndicateursTenue({ items }: { items: { cle: string; icone: React.ReactNode; texte: string; coche?: boolean }[] }) {
  if (!items.length) return null;
  return (
    <div className="flex-shrink-0 flex flex-wrap gap-[6px] mt-[8px] px-[2px]" role="list" aria-label="Ce qui caractérise cette tenue">
      {items.map((i) => (
        <span key={i.cle} role="listitem" className="inline-flex items-center gap-[6px] rounded-full bg-card border border-border px-[10px] py-[5px] text-[11.5px] leading-[1.2] text-ink">
          <span aria-hidden="true" className="text-terracotta flex-shrink-0 flex">{i.icone}</span>
          {i.texte}
          {i.coche && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0" style={{ color: "var(--color-terracotta-deep)" }}>
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </span>
      ))}
    </div>
  );
}

/** Les icônes fines des indicateurs, au trait comme le reste de l'app. */
export const ICONES_INDICATEUR = {
  style: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6a2 2 0 1 1 2 2c-1 0-2 .6-2 1.6V10L3 17.5a1.2 1.2 0 0 0 .8 2.1h16.4a1.2 1.2 0 0 0 .8-2.1L12 10" /></svg>
  ),
  occasion: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
  ),
  meteo: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z" /></svg>
  ),
  palette: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.7 0-.9.7-1.6 1.7-1.6H17a3.5 3.5 0 0 0 3.5-3.5c0-4.2-3.8-7.5-8.5-7.5Z" /><circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7.5" r="1" /><circle cx="14.5" cy="7.5" r="1" /></svg>
  ),
};

/**
 * LA COMPOSITION DE LA TENUE (04/11/2026, maquette « Look planifié ») : le nombre de pièces, une vignette par pièce réelle (son image,
 * jamais une image refaite), et « Voir les détails », qui ouvre le rail des pièces dans une feuille. Compacte : une rangée.
 */
export function CompositionTenue({ pieces, onDetails }: { pieces: Item[]; onDetails: () => void }) {
  if (!pieces.length) return null;
  const visibles = pieces.slice(0, 5);
  return (
    <div className="mt-[14px] bg-card border border-border rounded-carte px-[14px] py-[12px]">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[14px] font-semibold text-ink">Composition de ta tenue</div>
        <div className="text-[12px] text-muted-3">{pieces.length} {pieces.length > 1 ? "pièces" : "pièce"}</div>
      </div>
      <div className="flex items-center gap-[8px] mt-[10px]">
        <div className="flex gap-[6px] min-w-0 flex-1">
          {visibles.map((p) => {
            const img = resolveItemImage(p);
            return (
              <span key={p.id} aria-label={p.name} role="img" className="flex-1 min-w-0 max-w-[56px] aspect-square rounded-bloc border border-border overflow-hidden flex items-center justify-center" style={{ background: "var(--color-warm-bg)" }}>
                {img.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
                ) : (
                  <span className="block w-full h-full" style={{ background: p.hex }} />
                )}
              </span>
            );
          })}
        </div>
        <button type="button" onClick={onDetails} className="flex-shrink-0 text-[12.5px] text-terracotta-deep underline underline-offset-[3px] cursor-pointer min-h-[44px] pl-1">
          Voir les détails →
        </button>
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
