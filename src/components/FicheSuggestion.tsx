"use client";

import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import Vignette from "@/components/VignettePiece";
import { clePieces } from "@/lib/outfitFeedback";
import type { EtatSuggestion } from "@/lib/votesSuggestions";
import type { Item } from "@/lib/types";

/*
 * LA FICHE D'UNE SUGGESTION DE LA CAPSULE (refonte du 02/11/2026, brief « Fiche de suggestion d'une pièce de capsule »).
 *
 * Avant : cinq actions empilées (Composer, Je possède déjà, Voir des tenues, Remplacer, Pas intéressée). Désormais un PARCOURS : les
 * suggestions de la capsule défilent une à une (« 3 / 10 », barre de progression), et chacune appelle un VOTE — « J'aime » ou « Pas pour
 * moi », par les boutons ou en faisant glisser la carte. « Je possède déjà cette pièce » reste visible, en dessous ; « Remplacer » et
 * « Voir des tenues » passent dans le menu ⋯. Les trois états restent distincts (votesSuggestions.ts) : aimer n'ajoute rien au dressing.
 *
 * Composants réutilisés : BottomSheet (avec ses emplacements entete / bandeau / pied, ajoutés pour elle), la vignette de pièce
 * (VignettePiece), la planche de tenue (FlatLayCapsela) pour « Comment le porter ? ». Aucune couleur nouvelle : tokens de globals.css.
 * Cette fiche ne décide rien : l'écran Capsule lui donne la pièce, la phrase, les associations, et reçoit les votes.
 */

/** Distance (px) au-delà de laquelle un glissement vaut un vote ; en deçà, la carte revient. */
const SEUIL_GLISSEMENT = 90;

export interface AssociationFiche {
  ids: number[];
  pieces: Item[];
}

export default function FicheSuggestion({
  piece,
  position,
  total,
  etat,
  phrase,
  synthese,
  associations,
  occupe,
  onFermer,
  onAimer,
  onRejeter,
  onPossede,
  onRemplacer,
  onVoirTenues,
  onComposer,
  onOuvrirAssociation,
  onClicAffilie,
}: {
  piece: Item;
  /** Position dans le parcours, à partir de 1. */
  position: number;
  total: number;
  /** Le vote déjà posé sur cette pièce, s'il y en a un (revenir sur une suggestion déjà votée). */
  etat: EtatSuggestion | undefined;
  phrase: string | null;
  synthese: string;
  associations: AssociationFiche[];
  /** Un vote est en cours de transition : les actions sont bloquées (pas de double vote). */
  occupe: boolean;
  onFermer: () => void;
  onAimer: () => void;
  onRejeter: () => void;
  onPossede: () => void;
  onRemplacer: () => void;
  onVoirTenues: () => void;
  /** « Composer avec cette pièce » (onglet Composer) — absent quand la pièce n'a pas d'emplacement dans la composition. */
  onComposer?: () => void;
  onOuvrirAssociation: (index: number) => void;
  /** « Découvrir la pièce » : seulement quand un lien marchand est configuré (affLink) ; mesuré, jamais compté comme un achat. */
  onClicAffilie: () => void;
}) {
  const [menu, setMenu] = useState(false);
  // Une nouvelle pièce repart d'une carte au centre, menu fermé : le décalage d'un vote par glissement (±420) ne la suit pas.
  const [pieceVue, setPieceVue] = useState(piece.id);
  // LE GLISSEMENT : seulement horizontal (un geste d'abord vertical reste un défilement), seulement sur la carte de la pièce.
  const [dx, setDx] = useState(0);
  const [lache, setLache] = useState(true);
  const geste = useRef<{
    x: number;
    y: number;
    id: number;
    horizontal: boolean | null;
  } | null>(null);
  const finirGeste = () => {
    const d = dx;
    geste.current = null;
    setLache(true);
    if (occupe) return setDx(0);
    if (d > SEUIL_GLISSEMENT) {
      setDx(420);
      onAimer();
    } else if (d < -SEUIL_GLISSEMENT) {
      setDx(-420);
      onRejeter();
    } else setDx(0);
  };
  if (pieceVue !== piece.id) {
    setPieceVue(piece.id);
    setDx(0);
    setMenu(false);
  }
  const progression = total > 0 ? Math.min(1, position / total) : 0;

  return (
    <BottomSheet
      title="✦ Suggestion Capsela"
      surtitre
      open
      onClose={onFermer}
      entete={
        <>
          <span
            className="text-[12px] text-muted tabular-nums flex-shrink-0"
            aria-label={`Suggestion ${position} sur ${total}`}
          >
            {position} / {total}
          </span>
          <button
            type="button"
            onClick={() => setMenu((m) => !m)}
            aria-expanded={menu}
            aria-label="Plus d'actions"
            className="w-[40px] h-[44px] flex-shrink-0 flex items-center justify-center text-ink cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="5" cy="12" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>
        </>
      }
      bandeau={
        <div
          className="h-[3px] flex-shrink-0"
          style={{ background: "var(--color-chip-soft-bg)" }}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={position}
          aria-label="Progression dans les suggestions"
        >
          <div
            className="h-full bg-terracotta motion-safe:transition-[width] motion-safe:duration-300"
            style={{ width: `${progression * 100}%` }}
          />
        </div>
      }
      pied={
        <>
          <div className="text-center font-serif text-[17px] text-ink">
            Alors, cette pièce te plaît ?
          </div>
          <div className="grid grid-cols-2 gap-[10px] mt-[10px]">
            <button
              type="button"
              disabled={occupe}
              onClick={onRejeter}
              className="min-h-[64px] rounded-tuile border border-border bg-card text-ink flex flex-col items-center justify-center gap-[2px] px-2 py-[10px] cursor-pointer disabled:opacity-60"
            >
              <span className="flex items-center gap-[6px] text-[14px] font-semibold">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 14 14"
                  aria-hidden="true"
                >
                  <path
                    d="M2 2l10 10M12 2L2 12"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
                Pas pour moi
              </span>
              <span className="text-[11px] text-muted">
                Passer à la suivante
              </span>
            </button>
            <button
              type="button"
              disabled={occupe}
              onClick={onAimer}
              aria-pressed={etat === "aimee"}
              className="min-h-[64px] rounded-tuile bg-terracotta-deep text-cream flex flex-col items-center justify-center gap-[2px] px-2 py-[10px] cursor-pointer disabled:opacity-60"
            >
              <span className="flex items-center gap-[6px] text-[14px] font-semibold">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill={etat === "aimee" ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
                </svg>
                {etat === "aimee" ? "Tu l'aimes" : "J'aime"}
              </span>
              <span className="text-[11px] opacity-85">
                Découvrir les associations
              </span>
            </button>
          </div>
          <button
            type="button"
            disabled={occupe}
            onClick={onPossede}
            className="mt-[6px] w-full text-center text-[13px] text-terracotta py-[10px] cursor-pointer disabled:opacity-60"
          >
            Je possède déjà cette pièce
          </button>
        </>
      }
    >
      {menu && (
        <div
          className="mb-[12px] rounded-bloc border border-border bg-card overflow-hidden"
          role="menu"
        >
          {onComposer && (
            <button
              type="button"
              role="menuitem"
              onClick={() => (setMenu(false), onComposer())}
              className="w-full text-left px-4 py-[13px] text-[13px] text-ink border-b border-border cursor-pointer"
            >
              Composer avec cette pièce
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => (setMenu(false), onVoirTenues())}
            className="w-full text-left px-4 py-[13px] text-[13px] text-ink border-b border-border cursor-pointer"
          >
            Voir des tenues avec cette pièce
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => (setMenu(false), onRemplacer())}
            className="w-full text-left px-4 py-[13px] text-[13px] text-ink cursor-pointer"
          >
            Remplacer cette pièce
          </button>
        </div>
      )}

      {/* LA CARTE : elle glisse avec le doigt, et entre en fondu à chaque nouvelle suggestion (la clé change avec la pièce). */}
      {/* L'apparition sur l'enveloppe, le déplacement sur la carte : l'animation (fill-mode both) écraserait sinon le transform du doigt. */}
      <div
        key={piece.id}
        className="motion-safe:animate-[capsule-apparition_240ms_ease-out_both]"
      >
        <div
          className="relative select-none"
          style={{
            transform: dx
              ? `translateX(${dx}px) rotate(${dx / 30}deg)`
              : undefined,
            transition: lache ? "transform 220ms ease-out" : "none",
            touchAction: "pan-y",
          }}
          onPointerDown={(e) => {
            if (occupe) return;
            geste.current = {
              x: e.clientX,
              y: e.clientY,
              id: e.pointerId,
              horizontal: null,
            };
          }}
          onPointerMove={(e) => {
            const g = geste.current;
            if (!g || g.id !== e.pointerId) return;
            const ddx = e.clientX - g.x;
            const ddy = e.clientY - g.y;
            if (g.horizontal === null && Math.hypot(ddx, ddy) > 8) {
              g.horizontal = Math.abs(ddx) > Math.abs(ddy);
              if (g.horizontal) {
                e.currentTarget.setPointerCapture(e.pointerId);
                setLache(false);
              } else geste.current = null;
            }
            if (g.horizontal) setDx(ddx);
          }}
          onPointerUp={() => geste.current?.horizontal && finirGeste()}
          onPointerCancel={() => {
            geste.current = null;
            setLache(true);
            setDx(0);
          }}
        >
          {/* Ce que le glissement va faire : le cœur à droite, la croix à gauche — une forme, pas seulement une couleur. */}
          <span
            aria-hidden="true"
            className="absolute left-[8px] top-[8px] z-10 rounded-full bg-terracotta-deep text-cream text-[12px] font-semibold px-[10px] py-[5px]"
            style={{ opacity: Math.max(0, Math.min(1, dx / SEUIL_GLISSEMENT)) }}
          >
            ♥ J&apos;aime
          </span>
          <span
            aria-hidden="true"
            className="absolute right-[8px] top-[8px] z-10 rounded-full bg-card border border-border text-ink text-[12px] font-semibold px-[10px] py-[5px]"
            style={{
              opacity: Math.max(0, Math.min(1, -dx / SEUIL_GLISSEMENT)),
            }}
          >
            ✕ Pas pour moi
          </span>

          <div
            className="w-[56%] max-w-[230px] mx-auto"
            onDragStart={(e) => e.preventDefault()}
          >
            <Vignette item={piece} arrondi={18} marge={0.08} />
          </div>
          <div className="text-center mt-[14px]">
            <div className="t-titre-section text-ink">{piece.name}</div>
            {synthese && (
              <div className="text-[12px] text-muted mt-[5px]">{synthese}</div>
            )}
            {etat === "aimee" && (
              <div className="text-[11px] text-terracotta mt-[6px]">
                ♥ Dans tes favoris
              </div>
            )}
            {phrase && (
              <p className="font-serif italic text-[15px] text-ink leading-[1.4] mt-[12px] px-2">
                {phrase}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Le lien marchand, quand il existe (aucun au 02/11/2026) : discret, la recommandation passe avant la vente. */}
      {piece.affLink && (
        <div className="text-center mt-[14px]">
          <a
            href={piece.affLink}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={onClicAffilie}
            className="inline-block text-[13px] text-terracotta underline underline-offset-4 py-[6px]"
          >
            Découvrir la pièce
          </a>
          <div className="text-[11px] text-muted">
            Lien partenaire : Capsela peut percevoir une commission, sans
            surcoût pour toi.
          </div>
        </div>
      )}

      {/* COMMENT LE PORTER ? Des idées du moteur de la pièce (calculerIdeesTenues), jamais un second moteur ; aucune : pas de section. */}
      {associations.length > 0 && (
        <div className="mt-[22px]">
          <div className="t-surtitre text-muted">Comment le porter ?</div>
          <div className="scrollarea -mx-6 px-6 flex gap-[10px] overflow-x-auto snap-x snap-mandatory mt-[10px] pb-[4px]">
            {associations.map((a, i) => (
              <button
                key={clePieces(a.ids).join(",")}
                type="button"
                onClick={() => onOuvrirAssociation(i)}
                aria-label={`Tenue ${i + 1} : ${a.pieces.map((p) => p.name).join(", ")}`}
                className="flex-none w-[46%] snap-start rounded-bloc overflow-hidden relative cursor-pointer"
                style={{
                  aspectRatio: "100 / 112",
                  background: "var(--color-hero-background)",
                }}
              >
                <FlatLayCapsela
                  items={a.pieces}
                  context="look-detail"
                  layoutSeed={clePieces(a.ids).join(",")}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
