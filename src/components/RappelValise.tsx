"use client";

import { dateDuJour } from "@/lib/jourConsulte";
import { jourLocal } from "@/lib/outfitFeedback";
import { avancementValise, compteAReboursCourt, periodeCourte, prochainRappel, type RappelValise } from "@/lib/rappelsValise";
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

/**
 * La carte compacte de l'accueil (revue le 12/11/2026, demandé : « nouvelle organisation »). À gauche l'icône valise ; au centre
 * « Ton prochain départ », la destination et les dates, puis les pièces à ajouter et la barre d'avancement (avancementValise) ; à
 * droite le compte à rebours, en format court (« J-3 », « Demain ») pour laisser la place au voyage, et une flèche ; les dates aussi
 * en format court (« 15–19 nov. »). Le surtitre dit « Prochain départ », et s'efface sous 360 px. Le nom complet reste dans le libellé lu par le lecteur d'écran. Retirés : le grand titre (« Plus que 3 jours avant le départ ! »), qui redisait le compte
 * à rebours, la phrase sur les pièces manquantes, que le nombre remplace, et le lien « Voir ma valise » : toute la carte ouvre la valise.
 * Une valise dont l'état n'est pas connu n'a ni nombre ni barre.
 */
export function CarteProchainDepart({ rappel, className = "" }: { rappel: RappelValise; className?: string }) {
  const { actions } = useCapsela();
  const avancement = avancementValise(rappel.valise);
  const detail = !avancement ? null : avancement.aAjouter === 0 ? "Valise prête" : avancement.aAjouter === 1 ? "1 pièce à ajouter" : `${avancement.aAjouter} pièces à ajouter`;
  return (
    <button
      type="button"
      onClick={() => void actions.ouvrirValise(rappel.valise.id)}
      aria-label={`Ton prochain départ : ${rappel.voyage}, ${rappel.badge.toLowerCase()}${detail ? `, ${detail.toLowerCase()}` : ""}. Voir ma valise`}
      className={"w-full flex items-center gap-3 rounded-carte bg-card border border-border px-4 py-[11px] text-left cursor-pointer active:opacity-80 " + className}
    >
      <span aria-hidden="true" className="w-11 h-11 flex-shrink-0 rounded-full bg-warm-bg text-terracotta-deep flex items-center justify-center">
        <IconeValise />
      </span>
      <span className="flex-1 min-w-0">
        {/* Sous 360 px, le surtitre s'efface (12/11/2026, demandé) : l'icône et le compte à rebours disent déjà le départ. */}
        <span className="block t-surtitre text-muted max-[359px]:hidden">Prochain départ</span>
        <span className="block mt-[2px] max-[359px]:mt-0 truncate">
          <span className="t-titre-ligne text-ink">{rappel.valise.destination}</span>
          <span className="text-[12.5px] text-muted"> · {periodeCourte(rappel.valise.depart, rappel.valise.retour)}</span>
        </span>
        {avancement && detail && (
          // La même ligne dans les deux états (12/11/2026, demandé) : le libellé a une largeur fixe, la barre commence au même endroit.
          <span className="flex items-center gap-[10px] mt-[6px]">
            <span className="flex-shrink-0 min-w-[106px] text-[12px] text-muted-3 whitespace-nowrap">{detail}</span>
            <span className="flex-1 min-w-[40px] h-[5px] rounded-full bg-warm-bg overflow-hidden" aria-hidden="true">
              <span className="block h-full rounded-full bg-terracotta" style={{ width: `${avancement.pourcentage}%` }} />
            </span>
          </span>
        )}
      </span>
      <span aria-hidden="true" className="flex-shrink-0 self-center flex items-center gap-[4px]">
        <span className="rounded-full bg-warm-bg text-terracotta text-[11.5px] font-semibold px-[9px] py-[3px] whitespace-nowrap">{compteAReboursCourt(rappel.jours)}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" className="text-muted-3">
          <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}
