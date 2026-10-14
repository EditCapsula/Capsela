"use client";

import { useLayoutEffect, useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import { GlypheSousChoix } from "@/components/GlyphesOccasion";
import { DATE_CONTEXTS, OCCASIONS, WORK_MODES } from "@/lib/data";
import { libelleDeclencheur, phraseOccasion } from "@/lib/phraseOccasion";
import { useCapsela } from "@/lib/store";
import type { DateContext, OccasionKey, TravelMode, WorkMode } from "@/lib/types";

/** Padding gauche de la ligne d'onglets : celui de la page (px-6), pour que le premier onglet s'aligne sur l'eyebrow. */
const PAD_GAUCHE = 24;
/** Largeur du fondu de droite, et padding droit de la ligne : le dernier onglet peut sortir entièrement du fondu. */
const FONDU = 36;

/**
 * SÉLECTEUR D'OCCASION DE TENUE (brief du 14/10/2026, options 2e et 2d de « Sélecteur Occasions »).
 *
 * Remplace les deux pilules du 22/09 (occasion terracotta pleine + sous-choix sable), dont la première ouvrait une feuille des huit
 * occasions. Les occasions sont maintenant des onglets texte sur UNE ligne qui défile, la sous-occasion un déclencheur compact sur la
 * ligne de la phrase éditoriale. Cette ligne a la même hauteur avec ou sans déclencheur : la carte tenue démarre au même endroit pour
 * toutes les occasions.
 *
 * Aucune taxonomie locale : OCCASIONS, WORK_MODES et DATE_CONTEXTS restent les sources, libellés tels quels. Les TROIS sous-choix
 * survivent (travail, date, voyage — arbitré le 22/09 pour le voyage : sans lui, « Longue distance » et son conseil deviennent
 * inatteignables). Les actions du store (setOccasion, setWorkMode…) recalculent la tenue, comme avant : aucune logique parallèle.
 */
export default function SelecteurOccasion({ quand }: { quand: string }) {
  const { state, actions } = useCapsela();
  const [feuilleOuverte, setFeuilleOuverte] = useState(false);
  const ligne = useRef<HTMLDivElement>(null);

  // L'onglet actif entièrement visible, hors du fondu, au montage et à chaque sélection. scrollLeft et non scrollIntoView : ce dernier
  // ferait aussi défiler l'écran verticalement.
  useLayoutEffect(() => {
    const el = ligne.current;
    const onglet = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !onglet) return;
    const gauche = onglet.offsetLeft - PAD_GAUCHE;
    const droite = onglet.offsetLeft + onglet.offsetWidth + FONDU - el.clientWidth;
    if (el.scrollLeft > gauche) el.scrollLeft = gauche;
    else if (el.scrollLeft < droite) el.scrollLeft = droite;
  }, [state.occasion]);

  const sousChoix: {
    titre: string;
    valeurs: readonly (WorkMode | DateContext | TravelMode)[];
    courant: WorkMode | DateContext | TravelMode;
    choisir: (v: string) => void;
  } | null =
    state.occasion === "travail_formel"
      ? {
          // « Où travailles-tu aujourd'hui ? » (brief) ne couvre pas « Entretien » : le titre d'avant reste (14/10/2026).
          titre: "Quel type de journée ?",
          valeurs: WORK_MODES,
          courant: state.workMode,
          choisir: (v) => actions.setWorkMode(v as WorkMode),
        }
      : state.occasion === "date"
        ? {
            titre: "Quel type de date ?",
            valeurs: DATE_CONTEXTS.map(([m]) => m),
            courant: state.dateContext,
            choisir: (v) => actions.setDateContext(v as DateContext),
          }
        : state.occasion === "voyage"
          ? {
              titre: "Quel type de trajet ?",
              valeurs: ["Court trajet", "Longue distance"] as const,
              courant: state.travelMode,
              choisir: (v) => actions.setTravelMode(v as TravelMode),
            }
          : null;

  const phrase = phraseOccasion(state.occasion, state);

  // Flèches gauche/droite entre onglets (motif tablist) : la sélection suit le focus, comme un tap.
  const auClavier = (e: React.KeyboardEvent, index: number) => {
    const pas = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!pas) return;
    e.preventDefault();
    const suivant = (index + pas + OCCASIONS.length) % OCCASIONS.length;
    actions.setOccasion(OCCASIONS[suivant][0]);
    ligne.current?.querySelectorAll<HTMLElement>('[role="tab"]')[suivant]?.focus();
  };
  const indexActif = OCCASIONS.findIndex(([k]) => k === state.occasion);

  return (
    <>
      <div className="mt-[14px] t-surtitre text-muted">Qu&apos;est-ce qui est prévu {quand} ?</div>

      {/* La ligne déborde jusqu'aux bords de l'écran (marges négatives = padding de page) ; le filet bas court sur toute sa largeur. */}
      <div className="relative -mx-6 mt-[4px] border-b border-border">
        <div
          ref={ligne}
          role="tablist"
          aria-label="Occasion"
          className="scrollarea flex overflow-x-auto whitespace-nowrap gap-[22px]"
          style={{ paddingLeft: PAD_GAUCHE, paddingRight: FONDU, overscrollBehaviorX: "contain" }}
        >
          {OCCASIONS.map(([key, label], i) => {
            const actif = state.occasion === key;
            return (
              <button
                key={key}
                role="tab"
                aria-selected={actif}
                // "all" (aucune occasion choisie) : le premier onglet reste atteignable au clavier.
                tabIndex={actif || (indexActif < 0 && i === 0) ? 0 : -1}
                onClick={() => actions.setOccasion(key as OccasionKey)}
                onKeyDown={(e) => auClavier(e, i)}
                className={
                  "relative flex-shrink-0 h-[44px] text-[13.5px] cursor-pointer " +
                  (actif ? "font-semibold text-ink" : "font-medium text-muted")
                }
              >
                {label}
                {actif && <span aria-hidden="true" className="absolute left-0 right-0 bottom-0 h-[2px] bg-terracotta-deep" />}
              </button>
            );
          })}
        </div>
        {/* Fondu discret à droite, sans flèche : il dit qu'il reste des onglets. */}
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 bottom-0 pointer-events-none"
          style={{ width: FONDU, background: "linear-gradient(to right, rgba(243,238,229,0), var(--color-cream))" }}
        />
      </div>

      {/* Phrase + déclencheur sur UNE ligne, pour toutes les occasions. Une phrase longue passe à la ligne dans sa colonne, le
          déclencheur reste à droite. 58 px et non les 52 du brief : mesuré le 14/10/2026, à 52 une phrase sur deux lignes (« Un
          rendez-vous autour d'un verre » à 390 px) poussait la carte tenue de 5 px. Deux lignes de Fraunces 19 px y tiennent. */}
      <div className="flex items-center justify-between gap-3 min-h-[58px] py-[6px]">
        <p aria-live="polite" className="min-w-0 font-serif font-medium text-[19px] leading-[1.2] text-ink" style={{ textWrap: "balance" }}>
          {phrase && (
            <>
              {phrase.debut} <span className="italic" style={{ color: "var(--color-terracotta-deep)" }}>{phrase.fin}</span>
            </>
          )}
        </p>
        {sousChoix && (
          <button
            onClick={() => setFeuilleOuverte(true)}
            aria-haspopup="dialog"
            aria-label={sousChoix.titre}
            className="flex-shrink-0 inline-flex items-center gap-[7px] h-[40px] pl-[13px] pr-[11px] rounded-full bg-card border border-border cursor-pointer"
          >
            <span className="text-terracotta">
              <GlypheSousChoix valeur={sousChoix.courant} taille={15} />
            </span>
            <span className="text-[12px] font-semibold text-ink whitespace-nowrap">{libelleDeclencheur(sousChoix.courant)}</span>
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" className="text-muted" style={{ display: "block" }}>
              <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <BottomSheet title={sousChoix?.titre ?? ""} open={feuilleOuverte && Boolean(sousChoix)} onClose={() => setFeuilleOuverte(false)}>
        <div role="radiogroup" aria-label={sousChoix?.titre} className="flex flex-col -mt-[16px]">
          {sousChoix?.valeurs.map((v) => {
            const actif = sousChoix.courant === v;
            return (
              <button
                key={v}
                role="radio"
                aria-checked={actif}
                onClick={() => {
                  sousChoix.choisir(v);
                  setFeuilleOuverte(false);
                }}
                className="flex items-center gap-3 text-left px-1 py-[10px] min-h-[52px] cursor-pointer border-b border-border"
              >
                <span style={{ color: actif ? "var(--color-terracotta-deep)" : "var(--color-ink-soft)" }}>
                  <GlypheSousChoix valeur={v} taille={20} />
                </span>
                <span
                  className={"flex-1 min-w-0 text-[14px] " + (actif ? "font-semibold" : "text-ink")}
                  style={actif ? { color: "var(--color-terracotta-deep)" } : undefined}
                >
                  {v}
                </span>
                {actif && (
                  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", color: "var(--color-terracotta-deep)" }}>
                    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </>
  );
}
