"use client";

import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

export default function HomeScreen() {
  const { actions, requirePremium } = useCapsela();
  const { profile } = useAuth();
  const firstNameOrYou = profile.displayName || "toi";

  const features = [
    {
      title: "Dressing",
      tag: "Gratuit",
      body: "Ajoute tes vêtements et accessoires par photo.",
      locked: false,
      onOpen: actions.goWardrobe,
      bg: "#EFE3D3",
      accent: "#1D1A16",
    },
    {
      title: "Capsule par défaut",
      tag: "Gratuit",
      body: "Une sélection déjà prête, pensée pour ton style.",
      locked: false,
      onOpen: actions.goCapsule,
      bg: "#E7DCCB",
      accent: "#1D1A16",
    },
    {
      title: "Journal des tenues",
      tag: "Premium",
      body: "L’historique de toutes tes tenues portées.",
      locked: true,
      onOpen: requirePremium(actions.goHistory),
      bg: "#1D1A16",
      accent: "#F3EEE5",
    },
    {
      title: "Second avis",
      tag: "Gratuit",
      body: "Partage ta tenue à un proche avant de te lancer.",
      locked: false,
      onOpen: actions.openOpinionShare,
      bg: "#E7DCCB",
      accent: "#1D1A16",
    },
  ];

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-[100px]">
      <div className="px-6">
        <AppHeader />
      </div>

      <div className="px-6 pt-4">
        <div className="text-[11px] tracking-[.18em] uppercase text-muted">Aujourd&apos;hui</div>
        <div className="font-serif text-[30px] leading-[1.12] text-ink mt-[6px]">
          Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
        </div>
      </div>

      <button
        onClick={actions.goTenues}
        className="mx-6 mt-5 bg-terracotta rounded-[22px] p-[22px] cursor-pointer relative overflow-hidden text-left block"
        style={{ width: "calc(100% - 48px)" }}
      >
        <div className="text-[10px] tracking-[.14em] uppercase text-[rgba(243,238,229,.75)]">Aujourd&apos;hui</div>
        <div className="font-serif text-[22px] text-cream mt-2 leading-[1.25]">
          Découvrir ta
          <br />
          tenue du jour
        </div>
        <div className="inline-flex items-center gap-[7px] mt-4 bg-cream text-ink rounded-full py-[10px] px-4 text-[12px] tracking-[.04em]">
          Voir la tenue →
        </div>
      </button>

      <div className="flex items-center justify-between mx-6 mt-[26px] mb-3">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Explore Capsela</span>
      </div>
      <div className="flex flex-col gap-3 px-6">
        {features.map((f) => (
          <button
            key={f.title}
            onClick={f.onOpen}
            className="w-full rounded-[18px] p-[18px] cursor-pointer flex items-center justify-between gap-[14px] text-left box-border"
            style={{ background: f.bg }}
          >
            <div className="flex-1 min-w-0">
              {f.tag === "Premium" && (
                <span
                  className="inline-block text-[11px] rounded-full py-1 px-2 mb-[9px]"
                  style={{ color: "#F3EEE5", background: "rgba(166,105,80,.35)" }}
                >
                  🔒
                </span>
              )}
              <div className="font-serif text-[17px]" style={{ color: f.accent }}>
                {f.title}
              </div>
              <div className="text-[11.5px] mt-[5px] leading-[1.4]" style={{ color: f.tag === "Premium" ? "#B3AA9B" : "#7B7366" }}>
                {f.body}
              </div>
            </div>
            <span className="text-[15px] mt-[14px]" style={{ color: f.accent }}>
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
