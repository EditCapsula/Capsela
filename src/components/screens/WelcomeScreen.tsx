"use client";

import { useCapsela } from "@/lib/store";

export default function WelcomeScreen() {
  const { actions } = useCapsela();

  return (
    <div className="absolute inset-0 flex flex-col bg-ink">
      <div className="flex-1 flex flex-col justify-center items-center text-center px-[34px]">
        {/* Logo horizontal complet, inversé en blanc pour le fond sombre
            (recette 20/08/2026, sync design) — remplace l'ancien duo icône +
            "CAPSELA" composé à la main. brightness(0) invert(1) : le SVG
            source utilise des tons terracotta/brun décoratifs, jamais du
            noir/blanc pur, donc un simple invert() ne suffit pas à obtenir
            un blanc net. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-full.svg" alt="L'édit Capsela" className="w-[220px] h-auto" style={{ filter: "brightness(0) invert(1)" }} />
        <div className="font-serif italic text-[21px] text-cream-dark-soft mt-5 leading-[1.35]">
          Ton styliste personnel,
          <br />
          chaque matin.
        </div>
        <div className="text-[13px] text-cream-dark-muted mt-4 leading-[1.55] max-w-[280px]">
          Des tenues pensées pour ta silhouette, tes goûts, la météo et tes sorties — à partir de ton
          propre dressing.
        </div>
      </div>
      <div className="px-7 pb-10 flex flex-col gap-3">
        <button
          onClick={actions.startOnb}
          className="bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.12em] uppercase cursor-pointer"
        >
          Commencer
        </button>
        <button onClick={actions.goLogin} className="text-center py-2 text-[13px] text-cream-dark-muted cursor-pointer">
          J&apos;ai déjà un compte · <span className="text-gold">Se connecter</span>
        </button>
      </div>
    </div>
  );
}
