"use client";

import { useCapsela } from "@/lib/store";

export default function TabBar() {
  const { state, actions, requirePremium } = useCapsela();

  const dressActive = state.screen === "wardrobe";
  const tenuesActive = state.screen === "tenues" || state.screen === "neverworn";
  const journalActive = state.screen === "history";
  const capActive = state.screen === "capsule";

  const labelColor = (active: boolean) => (active ? "text-ink" : "text-placeholder");

  return (
    <div className="absolute left-0 right-0 bottom-0 bg-cream border-t border-border flex items-center justify-around px-3 pt-[13px] pb-[22px]">
      <button
        onClick={actions.goWardrobe}
        className="flex flex-col items-center gap-[7px] flex-1 cursor-pointer"
      >
        <span
          className="w-[18px] h-[18px] rounded-[5px] border-2"
          style={{
            borderColor: dressActive ? "#B0654A" : "#B6AB99",
            background: dressActive ? "#B0654A" : "transparent",
          }}
        />
        <span className={`text-[10px] tracking-[.09em] uppercase ${labelColor(dressActive)}`}>Dressing</span>
      </button>

      <button
        onClick={actions.goTenues}
        className="flex flex-col items-center gap-[7px] flex-1 cursor-pointer"
      >
        <span className="w-[18px] h-[18px] flex items-center justify-center">
          <span
            className="w-[15px] h-[15px] rounded-[3px] border-2 rotate-45"
            style={{
              borderColor: tenuesActive ? "#B0654A" : "#B6AB99",
              background: tenuesActive ? "#B0654A" : "transparent",
            }}
          />
        </span>
        <span className={`text-[10px] tracking-[.09em] uppercase ${labelColor(tenuesActive)}`}>Tenues</span>
      </button>

      <button
        onClick={requirePremium(actions.goHistory)}
        className="flex flex-col items-center gap-[7px] flex-1 cursor-pointer relative"
      >
        <span className="w-[18px] h-[18px] flex items-center justify-center relative">
          <span
            className="w-4 h-[18px] rounded-[3px] border-2"
            style={{
              borderColor: journalActive ? "#B0654A" : "#B6AB99",
              background: journalActive ? "#B0654A" : "transparent",
            }}
          />
          {!state.isPremium && (
            <span className="absolute -top-[5px] -right-[6px] font-serif text-[10px] text-terracotta">✦</span>
          )}
        </span>
        <span className={`text-[10px] tracking-[.09em] uppercase ${labelColor(journalActive)}`}>Journal</span>
      </button>

      <button
        onClick={actions.goCapsule}
        className="flex flex-col items-center gap-[7px] flex-1 cursor-pointer"
      >
        <span
          className="w-[18px] h-[18px] rounded-full border-2"
          style={{
            borderColor: capActive ? "#B0654A" : "#B6AB99",
            background: capActive ? "#B0654A" : "transparent",
          }}
        />
        <span className={`text-[10px] tracking-[.09em] uppercase ${labelColor(capActive)}`}>Ma capsule</span>
      </button>
    </div>
  );
}
