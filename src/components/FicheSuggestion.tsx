"use client";

import { lienAffiliationValide } from "@/lib/remplacementPiece";
import { useRef, useState, type ReactNode } from "react";
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
  onNePlusProposer,
  onPrecedente,
  onSuivante,
  dejaPossedee = false,
  onVoirDressing,
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
  /** « Remplacer cette pièce » : dans la Capsule seulement (elle recompose la capsule d'une saison) ; absent, l'entrée du menu aussi. */
  onRemplacer?: () => void;
  onVoirTenues: () => void;
  /** « Composer avec cette pièce » (onglet Composer) — absent quand la pièce n'a pas d'emplacement dans la composition. */
  onComposer?: () => void;
  onOuvrirAssociation: (index: number) => void;
  /** « Découvrir la pièce » : seulement quand un lien marchand est configuré (affLink) ; mesuré, jamais compté comme un achat. */
  onClicAffilie: () => void;
  /** « Ne plus me proposer cette pièce » (13/11/2026) : la préférence durable, dans le menu ⋯ ; « Pas pour moi » ne vaut que la saison. */
  onNePlusProposer: () => void;
  /** Le parcours de la Capsule : la suggestion précédente et la suivante (absentes hors parcours, ou en bout de liste). */
  onPrecedente?: () => void;
  onSuivante?: () => void;
  /** Une pièce du dressing vient déjà de cette suggestion (vote « possedee ») : pas de second ajout, on le dit (13/11/2026, doublons). */
  dejaPossedee?: boolean;
  onVoirDressing?: () => void;
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
  const enParcours = total > 1;

  return (
    <BottomSheet
      title="✦ Suggestion Capsela"
      surtitre
      open
      onClose={onFermer}
      entete={
        <>
          {/* Le parcours (barre, flèches) dans la Capsule seulement : ouverte d'ailleurs, la fiche montre une pièce (13/11/2026). */}
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
        total > 1 && (
        <>
        {/* SANS COMPTEUR (13/11/2026, demandé : « enlever le compteur 2/40 ») : la barre seule dit où l'on en est ; la position reste
            annoncée aux lecteurs d'écran par la barre (aria-valuenow). Les flèches passent sur les côtés de la carte (planche, écran E). */}
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
        </>
        )
      }
      pied={
        etat === "aimee" ? (
          // L'ÉTAT APRÈS UN VOTE (13/11/2026, planche) : la fiche le dit elle-même, et propose la suite — jamais de navigation imposée.
          <>
            <div className="flex items-center justify-center gap-[8px] rounded-full bg-chip-soft-bg text-terracotta-deep text-[13px] font-semibold min-h-[40px]" role="status">
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="currentColor" /></svg>
              Ajoutée à ta sélection !
            </div>
            <button type="button" onClick={onVoirTenues} className="mt-[10px] w-full min-h-[48px] rounded-full bg-terracotta-deep text-on-terracotta t-bouton cursor-pointer">
              Voir comment la porter
            </button>
            <div className="grid grid-cols-2 gap-[8px] mt-[8px]">
              <button type="button" disabled={occupe} onClick={onAimer} className="min-h-[44px] rounded-full border border-border text-ink text-[12.5px] cursor-pointer disabled:opacity-60">
                Retirer de ma sélection
              </button>
              <button type="button" disabled={occupe} onClick={onRejeter} className="min-h-[44px] rounded-full border border-border text-ink text-[12.5px] cursor-pointer disabled:opacity-60">
                Retirer de la capsule
              </button>
            </div>
          </>
        ) : (
        <>
          {/* LES TROIS GESTES (planche du 13/11/2026). Dans le parcours de la Capsule (écran E) : trois boutons ronds, J'aime au centre et
              plus grand, le glissement les double sans les remplacer. Ouverte d'ailleurs (écran C, « identique partout ») : J'aime et
              Pas pour moi côte à côte, « Je possède déjà cette pièce » dessous. Mêmes gestes, mêmes libellés dans les deux cas. */}
          {enParcours ? (
            <div className="grid grid-cols-3 items-start">
              <BoutonRond libelle="Pas pour moi" aria="Pas pour moi, retire la pièce de la capsule pour cette saison" onClick={onRejeter} disabled={occupe}>
                <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </BoutonRond>
              <BoutonRond libelle="J'aime" aria="J'aime, ajoute la pièce à ta sélection" onClick={onAimer} disabled={occupe} principal>
                <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="currentColor" /></svg>
              </BoutonRond>
              {dejaPossedee ? (
                <BoutonRond libelle="Dans ton dressing" aria="Elle est déjà dans ton dressing : voir mon dressing" onClick={onVoirDressing}>
                  <IconeCintre />
                </BoutonRond>
              ) : (
                <BoutonRond libelle="Je possède déjà cette pièce" aria="Je possède déjà cette pièce" onClick={onPossede} disabled={occupe}>
                  <IconeCintre />
                </BoutonRond>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-[10px]">
                <button type="button" disabled={occupe} onClick={onAimer} aria-label="J'aime, ajoute la pièce à ta sélection" className="min-h-[48px] rounded-full bg-terracotta-deep text-on-terracotta flex items-center justify-center gap-[8px] text-[14px] font-semibold cursor-pointer disabled:opacity-60">
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" fill="currentColor" /></svg>
                  J&apos;aime
                </button>
                <button type="button" disabled={occupe} onClick={onRejeter} aria-label="Pas pour moi, retire la pièce de la capsule pour cette saison" className="min-h-[48px] rounded-full border border-border bg-card text-ink flex items-center justify-center gap-[8px] text-[14px] font-semibold cursor-pointer disabled:opacity-60">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" /></svg>
                  Pas pour moi
                </button>
              </div>
              {dejaPossedee ? (
                <button type="button" onClick={onVoirDressing} className="mt-[8px] w-full min-h-[44px] rounded-full border border-border text-[13px] text-muted-3 cursor-pointer">
                  Elle est déjà dans ton dressing · <span className="text-terracotta">Voir mon dressing</span>
                </button>
              ) : (
                <button type="button" disabled={occupe} onClick={onPossede} className="mt-[8px] w-full min-h-[44px] rounded-full border border-border text-ink text-[13px] flex items-center justify-center gap-[8px] cursor-pointer disabled:opacity-60">
                  <IconeCintre />
                  Je possède déjà cette pièce
                </button>
              )}
            </>
          )}
        </>
        )
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
            onClick={() => (setMenu(false), onNePlusProposer())}
            className="w-full text-left px-4 py-[13px] text-[13px] text-ink border-b border-border cursor-pointer"
          >
            Ne plus me proposer cette pièce
          </button>
          {onRemplacer && (
            <button
              type="button"
              role="menuitem"
              onClick={() => (setMenu(false), onRemplacer())}
              className="w-full text-left px-4 py-[13px] text-[13px] text-ink cursor-pointer"
            >
              Remplacer cette pièce
            </button>
          )}
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
            className="relative"
          >
            <div
              className="w-[56%] max-w-[230px] mx-auto"
              onDragStart={(e) => e.preventDefault()}
            >
              <Vignette item={piece} arrondi={18} marge={0.08} />
            </div>
            {/* Précédente et suivante SUR LES CÔTÉS DE LA CARTE (planche, écran E), à mi-hauteur de la photo ; absentes hors parcours. */}
            {enParcours && (
              <>
                <FlecheParcours sens="precedente" onClick={onPrecedente} />
                <FlecheParcours sens="suivante" onClick={onSuivante} />
              </>
            )}
          </div>
          <div className="text-center mt-[14px]">
            {piece.brand && <div className="t-surtitre text-muted-3 mb-[4px]">{piece.brand}</div>}
            <div className="t-titre-section text-ink">{piece.name}</div>
            {synthese && (
              <div className="text-[12px] text-muted mt-[5px]">{synthese}</div>
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
      {lienAffiliationValide(piece.affLink) && (
        <div className="text-center mt-[14px]">
          <a
            href={lienAffiliationValide(piece.affLink)!}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={onClicAffilie}
            className="inline-block text-[13px] text-terracotta underline underline-offset-4 py-[6px]"
          >
            Acheter cette pièce
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
          <div className="t-surtitre text-muted">Comment la porter</div>
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
      {/* « Voir comment la porter » : la page des idées de tenues avec la pièce, à la demande (13/11/2026) — plus après « J'aime ». */}
      {/* Après « J'aime », ce bouton passe en bas de la fiche, en action principale : pas deux fois le même. */}
      {etat !== "aimee" && (
        <button
          type="button"
          onClick={onVoirTenues}
          className="mt-[14px] w-full min-h-[44px] rounded-full border border-border text-terracotta t-bouton cursor-pointer"
        >
          Voir comment la porter
        </button>
      )}
    </BottomSheet>
  );
}

/** Un des trois gestes du parcours : un rond de 56 px (64 pour J'aime), son libellé dessous ; la cible fait toute la colonne. */
function BoutonRond({ libelle, aria, onClick, disabled, principal, children }: { libelle: string; aria: string; onClick?: () => void; disabled?: boolean; principal?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={aria} className="flex flex-col items-center gap-[6px] px-1 cursor-pointer disabled:opacity-60">
      <span
        className={`rounded-full flex items-center justify-center ${principal ? "w-[64px] h-[64px] bg-terracotta-deep text-on-terracotta shadow-[0_6px_16px_rgba(140,70,45,.25)]" : "w-[56px] h-[56px] mt-[4px] bg-card border border-border text-ink"}`}
      >
        {children}
      </span>
      <span className="text-[12px] leading-[1.25] text-ink text-center">{libelle}</span>
    </button>
  );
}

function IconeCintre() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8a2 2 0 1 1 2-2M12 8v2l8 6a1 1 0 0 1-.6 1.8H4.6A1 1 0 0 1 4 16l8-6" />
    </svg>
  );
}

function FlecheParcours({ sens, onClick }: { sens: "precedente" | "suivante"; onClick?: () => void }) {
  const gauche = sens === "precedente";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={gauche ? "Suggestion précédente" : "Suggestion suivante"}
      className={`absolute top-1/2 -translate-y-1/2 ${gauche ? "left-0" : "right-0"} w-[44px] h-[44px] rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-ink cursor-pointer disabled:opacity-0 disabled:pointer-events-none`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path d={gauche ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}
