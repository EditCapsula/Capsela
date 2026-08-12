"use client";

import AppHeader from "@/components/AppHeader";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";

const GRADIENT_TO = ["#EFE3D3", "#E8DCC9", "#E1D3BC", "#D9C9AF"];

function HangerIcon() {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="#F8F3EA" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6.2a2.1 2.1 0 1 1 2.1-2.1" />
      <path d="M12 6.2v2.1" />
      <path d="M12 8.3 3.6 14.6a1.2 1.2 0 0 0 .72 2.17h15.36a1.2 1.2 0 0 0 .72-2.17Z" />
    </svg>
  );
}

function JournalIcon() {
  return (
    <svg viewBox="0 0 24 24" width={19} height={19} fill="none" stroke="#F8F3EA" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 3.5h11.2a1.8 1.8 0 0 1 1.8 1.8v13.4a1.8 1.8 0 0 1-1.8 1.8H5.5Z" />
      <path d="M5.5 3.5a1.6 1.6 0 0 0 0 3.2" />
      <path d="M9 8.6h6" />
      <path d="M9 12h6" />
      <path d="M9 15.4h3.6" />
    </svg>
  );
}

export default function HomeScreen() {
  const { actions } = useCapsela();
  const { profile } = useAuth();
  const firstNameOrYou = profile.displayName || "toi";

  const features = [
    {
      title: "Dressing",
      body: "Ajoute tes vêtements et accessoires par photo.",
      onOpen: actions.goWardrobe,
      bg: "#F6F0E6",
      accent: "#1D1A16",
      glyph: "❑" as const,
      ghost: "01",
    },
    {
      title: "Capsule par défaut",
      body: "Une sélection déjà prête, pensée pour ton style.",
      onOpen: actions.goCapsule,
      bg: "#F0E7D9",
      accent: "#1D1A16",
      glyph: "hanger" as const,
      ghost: "02",
    },
    {
      title: "Second avis",
      body: "Partage ta tenue à un proche avant de te lancer.",
      onOpen: actions.openOpinionShare,
      bg: "#E9DECC",
      accent: "#1D1A16",
      glyph: "❞" as const,
      ghost: "03",
    },
    {
      title: "Journal des tenues",
      body: "L’historique de toutes tes tenues portées.",
      onOpen: actions.goHistory,
      bg: "#E2D5C0",
      accent: "#1D1A16",
      glyph: "journal" as const,
      ghost: "04",
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
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Explore L&apos;édit Capsela</span>
      </div>
      <div className="flex flex-col gap-3 px-6">
        {features.map((f, i) => (
          <button
            key={f.title}
            onClick={f.onOpen}
            className="relative overflow-hidden w-full rounded-[18px] cursor-pointer flex items-center justify-between gap-[13px] text-left box-border"
            style={{
              background: "linear-gradient(135deg, " + f.bg + " 0%, " + GRADIENT_TO[i] + " 100%)",
              padding: "16px 18px",
            }}
          >
            <span
              className="absolute pointer-events-none font-serif italic"
              style={{ right: "-16px", bottom: "-34px", fontSize: "76px", lineHeight: 1, color: "rgba(166,105,80,.12)" }}
            >
              {f.ghost}
            </span>
            <div
              className="relative flex-shrink-0 w-[38px] h-[38px] rounded-full flex items-center justify-center text-[16px]"
              style={{ background: "#A66950", color: "#F8F3EA" }}
            >
              {f.glyph === "hanger" ? <HangerIcon /> : f.glyph === "journal" ? <JournalIcon /> : <span>{f.glyph}</span>}
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="font-serif text-[17px]" style={{ color: f.accent }}>
                {f.title}
              </div>
              <div className="text-[11.5px] mt-1 leading-[1.4]" style={{ color: "#7B7366" }}>
                {f.body}
              </div>
            </div>
            <span className="relative flex-shrink-0 text-[15px]" style={{ color: f.accent }}>
              →
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
