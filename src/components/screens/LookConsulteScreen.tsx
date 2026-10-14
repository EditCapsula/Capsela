"use client";

import { useEffect, useMemo, useRef } from "react";
import AppHeader from "@/components/AppHeader";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import { resolveItemImage } from "@/lib/catalogImages";
import { CATLABEL } from "@/lib/data";
import { clePieces } from "@/lib/outfitFeedback";
import { sourcePiece } from "@/lib/ideesLooks";
import { useCapsela } from "@/lib/store";
import type { Item } from "@/lib/types";

/**
 * LA TENUE D'UNE SLIDE DU CARROUSEL (14/10/2026) — ouverte par « Voir le look » de l'accueil, en LECTURE SEULE : elle ne lit que
 * `state.tenueConsultee`, jamais `state.outfit`. Voir la tenue d'une autre occasion ne change donc ni la tenue du jour, ni son
 * occasion, ni son avis, ni le quota ; seule une action explicite (« Porter cette tenue ») remplace la tenue du jour, comme dans
 * le détail d'une idée de look.
 *
 * Même construction que IdeeLookScreen : la composition sur fond #EEDED8, puis les pièces EXACTES de la tenue (celles du flat lay,
 * dans le même ordre), une ligne par pièce. Une pièce qui n'existe plus dans le dressing ni dans le catalogue n'est pas inventée :
 * elle est omise, et la page le dit.
 */
export default function LookConsulteScreen() {
  const { state, vestiairePool, actions } = useCapsela();
  const tenue = state.tenueConsultee;
  const haut = useRef<HTMLDivElement>(null);
  const resolution = useMemo(() => [...state.items, ...vestiairePool], [state.items, vestiairePool]);
  const cle = tenue ? clePieces(tenue.ids).join(",") : "";
  useEffect(() => {
    haut.current?.scrollTo({ top: 0 });
  }, [cle]);

  if (!tenue) return null;
  const pieces = tenue.ids.map((id) => resolution.find((p) => p.id === id)).filter((p): p is Item => Boolean(p));
  const manquantes = tenue.ids.length - pieces.length;
  const enregistre = state.savedLooks.some((l) => clePieces(l.pieceIds).join(",") === cle);

  return (
    <div ref={haut} className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader onBack={actions.fermerTenueConsultee} backLabel="Revenir à l'accueil" />

      <div className="t-surtitre text-terracotta mt-[14px]">{tenue.surtitre}</div>
      <h1 className="t-titre-section text-ink mt-[6px]">{tenue.titre}</h1>
      {tenue.description && <p className="text-[13px] text-ink-soft leading-[1.5] mt-[6px]">{tenue.description}</p>}

      <div
        className="relative rounded-feuille overflow-hidden mt-[14px]"
        style={{ aspectRatio: "100 / 118", background: "#EEDED8" }}
        role="img"
        aria-label={"Composition de la tenue : " + pieces.map((p) => p.name).join(", ")}
      >
        {pieces.length > 0 && <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={cle} />}
      </div>

      <div className="t-surtitre text-muted mt-[24px] mb-[10px]">Les pièces de cette tenue</div>
      {pieces.length === 0 ? (
        <p className="text-[13px] text-ink-soft leading-[1.5]">Les pièces de cette tenue ne sont plus disponibles. Reviens à l&apos;accueil pour en découvrir une autre.</p>
      ) : (
        <div className="flex flex-col gap-[8px]">
          {pieces.map((it) => {
            const img = resolveItemImage(it);
            const possedee = sourcePiece(it.id, state.items) === "owned";
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => actions.openItem(it.id, !possedee)}
                className="w-full text-left flex items-center gap-[12px] bg-card border border-border rounded-bloc p-[10px] cursor-pointer"
              >
                <div
                  className="w-[52px] h-[62px] rounded-champ overflow-hidden flex-shrink-0"
                  style={
                    img.url
                      ? { background: "var(--color-photo-bg)", padding: img.kind === "photo" ? 0 : 4 }
                      : { background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                  }
                >
                  {img.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img loading="lazy" src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: img.kind === "photo" ? "cover" : "contain" }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-ink leading-[1.3] overflow-hidden text-ellipsis whitespace-nowrap">{it.name}</div>
                  <div className="text-[11px] text-muted mt-[3px]">
                    {CATLABEL[it.cat] ?? it.cat}
                    {it.color ? " · " + it.color : ""}
                  </div>
                  <Badge tone={possedee ? "possede" : "plein"} taille="s" className="mt-[6px]">
                    {possedee ? "Dressing" : "Suggestion"}
                  </Badge>
                </div>
                <span className="text-muted text-[16px] flex-shrink-0" aria-hidden="true">
                  ›
                </span>
              </button>
            );
          })}
        </div>
      )}
      {manquantes > 0 && pieces.length > 0 && (
        <p className="text-[12px] text-muted mt-[10px]">
          {manquantes === 1 ? "Une pièce de cette tenue n'est plus disponible." : `${manquantes} pièces de cette tenue ne sont plus disponibles.`}
        </p>
      )}

      {pieces.length > 0 && (
        <>
          <Button variante="principal" className="mt-[20px]" onClick={() => actions.viewItemOutfit(tenue.ids, tenue.occasion)}>
            Porter cette tenue
          </Button>
          <Button
            variante="secondaire"
            className="mt-[10px]"
            onClick={() => !enregistre && actions.enregistrerIdeeLook(tenue.ids, tenue.occasion)}
            disabled={enregistre}
            aria-pressed={enregistre}
          >
            {enregistre ? "✓ Enregistrée dans mes looks" : "Sauvegarder"}
          </Button>
          <Button variante="secondaire" className="mt-[10px]" onClick={() => actions.planifierComposition(tenue.ids, false)}>
            Planifier
          </Button>
          {tenue.plan && (
            <Button variante="secondaire" className="mt-[10px]" onClick={() => actions.ouvrirPlan(tenue.plan!, "home")}>
              Voir le plan
            </Button>
          )}
        </>
      )}
      <div className="h-[24px]" />
    </div>
  );
}
