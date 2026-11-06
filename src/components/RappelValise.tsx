"use client";

import { dateDuJour } from "@/lib/jourConsulte";
import { jourLocal } from "@/lib/outfitFeedback";
import { prochainRappel, type RappelValise } from "@/lib/rappelsValise";
import { useCapsela } from "@/lib/store";

/*
 * LES RAPPELS DE VALISE À L'ÉCRAN (06/11/2026, lib/rappelsValise.ts pour les règles). Trois pièces, partagées par l'accueil, l'en-tête,
 * la barre du bas et le planning : le point terracotta (un seul dessin pour l'icône du calendrier et l'onglet Planifier), le
 * pictogramme valise, et la carte « Ton prochain départ ».
 */

/** Le rappel du jour, ou null : le même état pour la carte, le point de l'en-tête et celui de l'onglet Planifier. */
export function useRappelValise(): RappelValise | null {
  const { state } = useCapsela();
  return prochainRappel(state.valises, jourLocal(dateDuJour(0)));
}

/** Le point terracotta, posé en haut à droite d'une icône (le parent est `relative`). Sans chiffre ni libellé. */
export function PointRappel() {
  return (
    <span
      aria-hidden="true"
      className="absolute top-[-1px] right-[-2px] w-[8px] h-[8px] rounded-full bg-terracotta pointer-events-none"
      style={{ boxShadow: "0 0 0 2px var(--color-cream)" }}
    />
  );
}

/** Une valise au trait, dans le style des icônes de l'app. */
export function IconeValise({ taille = 20 }: { taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="7" width="16" height="12.5" rx="2.5" />
      <path d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7M9 7v12.5M15 7v12.5" />
    </svg>
  );
}

/** La carte compacte de l'accueil : icône à gauche, le voyage à droite, toute la carte ouvre la valise. */
export function CarteProchainDepart({ rappel, className = "" }: { rappel: RappelValise; className?: string }) {
  const { actions } = useCapsela();
  return (
    <button
      type="button"
      onClick={() => void actions.ouvrirValise(rappel.valise.id)}
      aria-label={`Ton prochain départ : ${rappel.voyage}, ${rappel.badge.toLowerCase()}. Voir ma valise`}
      className={"w-full flex items-start gap-3 rounded-carte bg-card border border-border px-4 py-[14px] text-left cursor-pointer active:opacity-80 " + className}
    >
      <span className="w-11 h-11 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">
        <IconeValise />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center justify-between gap-2">
          <span className="t-surtitre text-muted">Ton prochain départ</span>
          <span className="flex-shrink-0 rounded-full bg-warm-bg text-terracotta text-[11.5px] font-semibold px-[9px] py-[3px]">{rappel.badge}</span>
        </span>
        <span className="block t-titre-ligne text-ink mt-[4px]">{rappel.message}</span>
        <span className="block text-[12.5px] text-muted mt-[2px] truncate">{rappel.voyage}</span>
        {rappel.etat && <span className="block text-[12px] text-muted-3 mt-[2px]">{rappel.etat}</span>}
        <span className="block t-lien text-terracotta-deep mt-[6px]">Voir ma valise →</span>
      </span>
    </button>
  );
}
