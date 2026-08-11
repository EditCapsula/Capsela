"use client";

import AppHeader from "@/components/AppHeader";
import { useCapsela } from "@/lib/store";

export default function PremiumScreen() {
  const { actions } = useCapsela();

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto bg-ink flex flex-col px-7 pt-2 pb-8">
      <AppHeader dark />
      <button
        onClick={actions.premiumBack}
        className="w-[38px] h-[38px] rounded-full bg-[rgba(244,238,228,.12)] flex items-center justify-center text-[17px] text-cream cursor-pointer"
      >
        ←
      </button>

      <div className="mt-[22px]">
        <div className="text-[12px] tracking-[.2em] uppercase text-terracotta">Fonctionnalité premium</div>
        <div className="font-serif text-[30px] leading-[1.15] text-cream mt-[14px]">
          Débloque tout <span className="italic text-gold">L&apos;édit Capsela.</span>
        </div>
        <div className="text-[13px] text-[#B3AA9B] mt-3 leading-[1.55]">Corrige une tenue marquée par erreur, et plus à venir.</div>
      </div>

      <div className="flex-1" />

      <div className="bg-[rgba(166,105,80,.14)] border border-[rgba(166,105,80,.35)] rounded-[18px] p-5 text-center">
        <div className="flex items-baseline justify-center gap-[6px]">
          <span className="font-serif text-[36px] text-cream">3,99 €</span>
          <span className="text-[12px] text-[#B3AA9B]">/ mois</span>
        </div>
        <div className="text-[11.5px] text-[#B3AA9B] mt-1">Résiliable à tout moment</div>
      </div>

      <button
        onClick={actions.subscribe}
        className="mt-4 bg-terracotta text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
      >
        S&apos;abonner
      </button>
    </div>
  );
}
