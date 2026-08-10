"use client";

import AppHeader from "@/components/AppHeader";
import { PREMIUM_FEATURES } from "@/lib/data";
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
        <div className="font-serif text-[13px] tracking-[.3em] text-gold pl-[.3em]">✦ PREMIUM</div>
        <div className="font-serif text-[34px] leading-[1.08] text-cream mt-[14px]">
          Va plus loin avec
          <br />
          <span className="italic">ta capsule.</span>
        </div>
        <div className="text-[13.5px] text-[#A99C88] mt-3 leading-[1.55]">
          Les outils qui transforment ta capsule en garde-robe vraiment vécue.
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {PREMIUM_FEATURES.map((f) => (
          <div
            key={f.title}
            className="flex items-start gap-[13px] bg-[rgba(244,238,228,.06)] border border-[rgba(217,165,126,.22)] rounded-2xl px-4 py-[15px]"
          >
            <span className="w-9 h-9 rounded-full bg-terracotta text-cream flex items-center justify-center text-base flex-shrink-0">
              {f.icon}
            </span>
            <div className="flex-1">
              <div className="text-[14.5px] text-cream">{f.title}</div>
              <div className="text-[12px] text-[#A99C88] mt-[3px] leading-[1.45]">{f.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 bg-[rgba(217,165,126,.12)] border border-[rgba(217,165,126,.3)] rounded-[18px] p-5 text-center">
        <div className="flex items-baseline justify-center gap-[6px]">
          <span className="font-serif text-[40px] text-cream">4,99 €</span>
          <span className="text-[13px] text-[#A99C88]">/ mois</span>
        </div>
        <div className="text-[12px] text-[#A99C88] mt-1">7 jours d&apos;essai · résiliable à tout moment</div>
      </div>

      <button
        onClick={actions.subscribe}
        className="mt-[18px] bg-terracotta text-cream text-center rounded-full py-[17px] text-[13px] tracking-[.12em] uppercase cursor-pointer"
      >
        Passer en Premium
      </button>
      <button onClick={actions.premiumBack} className="text-center py-[14px] text-[13px] text-[#A99C88] cursor-pointer">
        Peut-être plus tard
      </button>
    </div>
  );
}
