"use client";

import { setConsent } from "@/lib/consent";

/**
 * Bandeau de consentement aux mesures d'audience — affiché tant que le choix
 * n'a pas été fait, jamais ensuite (cf. lib/consent.ts).
 *
 * Refuser est aussi accessible qu'accepter, au même niveau visuel : la CNIL
 * exige que le refus soit aussi simple que l'acceptation, ce qui exclut un
 * lien discret face à un bouton plein. Non bloquant : l'app reste utilisable
 * derrière, seul le chargement de la mesure attend une réponse.
 */
export default function CookieBanner() {
  const choose = (state: "granted" | "denied") => setConsent(state);

  return (
    <div className="absolute left-0 right-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+14px)] pt-4 bg-card border-t border-border">
      <div className="text-[12.5px] text-ink leading-[1.45]">Mesure d&apos;audience</div>
      <div className="text-[11.5px] text-muted leading-[1.45] mt-[3px]">
        Nous aimerions mesurer l&apos;usage de l&apos;application pour l&apos;améliorer. Ces statistiques sont établies par
        Google Analytics. Tu peux refuser : l&apos;application fonctionne exactement pareil.
      </div>
      <div className="flex items-center gap-[9px] mt-[13px]">
        <button
          onClick={() => choose("denied")}
          className="flex-1 h-[42px] rounded-full border border-border bg-cream text-[12.5px] text-ink cursor-pointer"
        >
          Refuser
        </button>
        <button
          onClick={() => choose("granted")}
          className="flex-1 h-[42px] rounded-full bg-terracotta text-[12.5px] text-cream cursor-pointer"
        >
          Accepter
        </button>
      </div>
    </div>
  );
}
