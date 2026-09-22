"use client";

import { useCapsela } from "@/lib/store";

/**
 * Préparer une valise — destination Premium, brief Accueil du 22/09/2026.
 * Même statut que PlanifierScreen : écran d'attente assumé, aucune donnée
 * lue, aucun appel. Cf. son commentaire pour l'arbitrage.
 */
export default function ValiseScreen() {
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
        <div className="font-serif text-[25px] text-ink">Préparer une valise</div>
      </div>

      <div className="mt-5 bg-warm-bg border border-sand-border rounded-[20px] px-5 py-[26px] text-center">
        <span className="inline-flex items-center gap-[5px] rounded-full bg-card px-[10px] py-[4px] text-[9.5px] tracking-[.1em] uppercase text-terracotta">
          <span aria-hidden="true">✦</span> Premium
        </span>
        <div className="font-serif text-[18px] text-ink leading-[1.3] mt-[14px]">Bientôt : ta valise pour un séjour</div>
        <div className="text-[13px] text-[#3F3B34] leading-[1.5] mt-[8px]">
          Une destination, des dates, et la liste des pièces à emporter — assez pour couvrir chaque jour sans
          emporter le dressing entier.
        </div>
        <div className="text-[12px] text-muted leading-[1.5] mt-[12px]">
          Cet écran n&apos;est pas encore actif. Il existe pour que l&apos;entrée ne mène pas dans le vide.
        </div>
        <button onClick={actions.goCapsule} className="mt-[16px] inline-block text-[12.5px] text-terracotta cursor-pointer">
          Voir ma capsule →
        </button>
      </div>
    </div>
  );
}
