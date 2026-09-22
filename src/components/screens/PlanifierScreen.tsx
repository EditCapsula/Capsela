"use client";

import { useCapsela } from "@/lib/store";

/**
 * Planifier une tenue — destination Premium, brief Accueil du 22/09/2026.
 *
 * ÉCRAN D'ATTENTE ASSUMÉ, et nommé comme tel. Le brief demandait de brancher
 * la carte Premium vers une route « placeholder » sans implémenter la
 * fonctionnalité ; arbitré le 22/09 : une vraie destination avec un état vide
 * honnête plutôt qu'un lien mort. Une entrée qui ne mène nulle part coûte
 * plus en confiance qu'elle ne rapporte en promesse.
 *
 * Aucune donnée n'est lue, aucun appel n'est fait : il n'y a rien à charger
 * tant que la fonctionnalité n'existe pas, et simuler un chargement serait
 * mentir sur son état.
 */
export default function PlanifierScreen() {
  const { actions } = useCapsela();

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.goHome}
          aria-label="Revenir à l'accueil"
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[25px] text-ink">Planifier une tenue</div>
      </div>

      <div className="mt-5 bg-warm-bg border border-sand-border rounded-[20px] px-5 py-[26px] text-center">
        <span
          className="inline-flex items-center gap-[5px] rounded-full bg-card px-[10px] py-[4px] text-[9.5px] tracking-[.1em] uppercase text-terracotta"
        >
          <span aria-hidden="true">✦</span> Premium
        </span>
        <div className="font-serif text-[18px] text-ink leading-[1.3] mt-[14px]">Bientôt : ta tenue pour un jour précis</div>
        <div className="text-[13px] text-[#3F3B34] leading-[1.5] mt-[8px]">
          Choisir une date, une occasion, et laisser Capsela préparer la tenue à l&apos;avance — avec la météo prévue
          ce jour-là plutôt que celle d&apos;aujourd&apos;hui.
        </div>
        <div className="text-[12px] text-muted leading-[1.5] mt-[12px]">
          Cet écran n&apos;est pas encore actif. Il existe pour que l&apos;entrée ne mène pas dans le vide.
        </div>
        <button
          onClick={actions.goTenues}
          className="mt-[16px] inline-block text-[12.5px] text-terracotta cursor-pointer"
        >
          Voir ma tenue du jour →
        </button>
      </div>
    </div>
  );
}
