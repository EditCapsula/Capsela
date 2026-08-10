"use client";

import { useCapsela } from "@/lib/store";
import type { Screen } from "@/lib/types";

const TABS: { label: string; screen: Screen; go: (a: ReturnType<typeof useCapsela>["actions"]) => void; premium?: boolean }[] = [
  { label: "Accueil", screen: "home", go: (a) => a.goHome() },
  { label: "Dressing", screen: "wardrobe", go: (a) => a.goWardrobe() },
  { label: "Tenue", screen: "tenues", go: (a) => a.goTenues() },
  { label: "Capsule", screen: "capsule", go: (a) => a.goCapsule() },
  { label: "Journal", screen: "history", go: (a) => a.goHistory(), premium: true },
];

export default function TabBar() {
  const { state, actions, requirePremium } = useCapsela();

  return (
    <div className="absolute left-0 right-0 bottom-0 bg-cream border-t border-border flex items-center justify-around px-2 pt-[13px] pb-[22px]">
      {TABS.map((tab) => {
        const active = state.screen === tab.screen;
        const onClick = tab.premium ? requirePremium(() => tab.go(actions)) : () => tab.go(actions);
        return (
          <button key={tab.screen} onClick={onClick} className="flex flex-col items-center gap-[6px] flex-1 min-w-0 cursor-pointer">
            <span
              className="text-[9.5px] tracking-[.05em] uppercase whitespace-nowrap"
              style={{ color: active ? "#1D1A16" : "#B3AA9B" }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
