"use client";

import { useCapsela } from "@/lib/store";

export default function WelcomeScreen() {
  const { actions } = useCapsela();

  return (
    <div className="absolute inset-0 flex flex-col bg-ink">
      <div className="flex-1 flex flex-col justify-center items-center text-center px-[34px]">
        <div className="font-serif text-[15px] tracking-[.4em] text-gold pl-[.4em]">✦</div>
        <div className="font-serif text-[40px] tracking-[.30em] text-cream mt-[18px] pl-[.30em]">CAPSELA</div>
        <div className="font-serif italic text-[21px] text-[#C7B9A2] mt-5 leading-[1.35]">
          Ta capsule, à partir de
          <br />
          ce que tu possèdes déjà.
        </div>
        <div className="text-[13px] text-[#A99C88] mt-4 leading-[1.55] max-w-[272px]">
          Réunis ton dressing, choisis tes 30-40 essentiels, et porte enfin tout ce que tu as. Aucun achat pour
          commencer.
        </div>
      </div>
      <div className="px-7 pb-10 flex flex-col gap-3">
        <button
          onClick={actions.startOnb}
          className="bg-terracotta text-cream text-center rounded-full py-4 text-[13px] tracking-[.12em] uppercase cursor-pointer"
        >
          Commencer
        </button>
        <button onClick={actions.goAuth} className="text-center py-2 text-[13px] text-[#C7B9A2] cursor-pointer">
          J&apos;ai déjà un compte · <span className="text-gold">Se connecter</span>
        </button>
      </div>
    </div>
  );
}
