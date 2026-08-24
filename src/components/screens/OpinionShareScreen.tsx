"use client";

import { useCapsela } from "@/lib/store";

export default function OpinionShareScreen() {
  const { state, actions } = useCapsela();

  const viaText =
    state.opinionVia === "whatsapp" ? "par WhatsApp" : state.opinionVia === "social" ? "sur les réseaux" : "par SMS";

  if (state.opinionStatus === "sent") {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
        <div className="flex items-center gap-[14px]">
          <button
            onClick={actions.closeOpinionShare}
            className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
          >
            ←
          </button>
          <div className="font-serif text-[22px] text-ink">Demander un avis</div>
        </div>

        <div className="mt-[30px] flex flex-col items-center text-center px-[10px] py-5">
          <span className="w-[52px] h-[52px] rounded-full bg-[#F0E5D6] text-terracotta flex items-center justify-center text-[22px] mb-4">
            ✎
          </span>
          <div className="font-serif text-[19px] text-ink">Partagée {viaText}</div>
          <div className="text-[13px] text-muted mt-2 leading-[1.5] max-w-[260px]">
            Ta tenue a été envoyée hors de l’application. La réponse de ton proche arrivera directement là où tu
            l’as partagée — pas de retour ici pour l’instant.
          </div>
        </div>
        <button
          onClick={actions.closeOpinionShare}
          className="mt-[22px] w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
        >
          Retour à ma tenue
        </button>
      </div>
    );
  }

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.closeOpinionShare}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[22px] text-ink">Demander un avis</div>
      </div>

      <div className="text-[13px] text-muted mt-4 leading-[1.5]">
        Envoie ta tenue du jour à quelqu&apos;un de confiance avant de te lancer. Tu choisis la personne dans
        l&apos;application de partage.
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-3">Partager via</div>
      <div className="flex flex-col gap-[9px]">
        <button
          onClick={() => actions.sendOpinionRequest("whatsapp")}
          className="flex items-center gap-3 bg-card border border-border rounded-[14px] px-4 py-[14px] text-[13.5px] text-ink cursor-pointer"
        >
          <span className="text-terracotta">✆</span> WhatsApp
        </button>
        <button
          onClick={() => actions.sendOpinionRequest("social")}
          className="flex items-center gap-3 bg-card border border-border rounded-[14px] px-4 py-[14px] text-[13.5px] text-ink cursor-pointer"
        >
          <span className="text-terracotta">✦</span> Réseaux sociaux
        </button>
        <button
          onClick={() => actions.sendOpinionRequest("message")}
          className="flex items-center gap-3 bg-card border border-border rounded-[14px] px-4 py-[14px] text-[13.5px] text-ink cursor-pointer"
        >
          <span className="text-terracotta">✎</span> SMS
        </button>
      </div>
    </div>
  );
}
