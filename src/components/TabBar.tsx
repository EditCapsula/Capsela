"use client";

import { useCapsela } from "@/lib/store";
import type { Screen } from "@/lib/types";

type IconName = "home" | "hanger" | "sparkle" | "capsule" | "journal";

function TabIcon({ name, color }: { name: IconName; color: string }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", stroke: color, fill: "none" as const };
  switch (name) {
    case "home":
      return (
        <svg {...common} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M4 11L12 4l8 7v7.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5V11z" />
        </svg>
      );
    case "hanger":
      return (
        <svg {...common} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.2a1.9 1.9 0 00-.6 3.7v1.1L4.6 12.9a1.4 1.4 0 00.8 2.55h13.2a1.4 1.4 0 00.8-2.55L12.6 8V6.9A1.9 1.9 0 0012 3.2z" />
          <line x1="4.8" y1="18.6" x2="19.2" y2="18.6" />
        </svg>
      );
    case "sparkle":
      return (
        <svg width={19} height={19} viewBox="0 0 24 24" fill={color}>
          <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" />
        </svg>
      );
    case "capsule":
      return (
        <svg {...common} strokeWidth={1.6} strokeLinecap="round">
          <path d="M4 9V6.5A1.5 1.5 0 015.5 5H9M15 5h3.5A1.5 1.5 0 0120 6.5V9M20 15v2.5a1.5 1.5 0 01-1.5 1.5H15M9 19H5.5A1.5 1.5 0 014 17.5V15" />
        </svg>
      );
    case "journal":
      // Livre ouvert (recette 24/08/2026, signalé : l'icône lignes suggérait
      // une liste, pas un journal) — deux pages symétriques de part et
      // d'autre d'une reliure centrale.
      return (
        <svg {...common} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 6.8c-1.9-1.4-4.3-2.1-7-2.1a.9.9 0 00-.9.9v10.6c0 .5.4.9.9.9 2.7 0 5.1.7 7 2.1" />
          <path d="M12 6.8c1.9-1.4 4.3-2.1 7-2.1a.9.9 0 01.9.9v10.6a.9.9 0 01-.9.9c-2.7 0-5.1.7-7 2.1" />
          <line x1="12" y1="6.8" x2="12" y2="19.2" />
        </svg>
      );
  }
}

const TABS: { label: string; icon: IconName; screen: Screen; go: (a: ReturnType<typeof useCapsela>["actions"]) => void }[] = [
  { label: "Accueil", icon: "home", screen: "home", go: (a) => a.goHome() },
  { label: "Dressing", icon: "hanger", screen: "wardrobe", go: (a) => a.goWardrobe() },
  { label: "Tenue", icon: "sparkle", screen: "tenues", go: (a) => a.goTenues() },
  { label: "Capsule", icon: "capsule", screen: "capsule", go: (a) => a.goCapsule() },
  { label: "Journal", icon: "journal", screen: "history", go: (a) => a.goHistory() },
];

export default function TabBar() {
  const { state, actions } = useCapsela();

  return (
    <div
      // z-20 (correctif 20/08/2026, bug scroll Tenue) : sans z-index explicite,
      // TabBar (z-index:auto) perdait face à tout élément à z-index positif du
      // contenu défilant (ex. pièces du flat-lay "La combinaison", jusqu'à
      // zIndex:5) — aucun conteneur intermédiaire ne crée de contexte
      // d'empilement propre, donc ces valeurs se comparent directement entre
      // elles, indépendamment de l'ordre dans le DOM. z-20 reste sous les
      // modales plein écran (z-50, ex. ProfileEditScreen) qui doivent
      // continuer de recouvrir la nav.
      className="absolute left-0 right-0 bottom-0 z-20 bg-cream border-t border-border flex items-center justify-around px-2 pt-[11px]"
      // pb (correctif 20/08/2026, contenu masqué par la navigation basse) :
      // étend la nav elle-même dans la safe-area (encoche/barre de gestes)
      // au lieu de laisser son padding de confort (22px) s'arrêter avant —
      // sinon la nav pourrait se retrouver partiellement sous la barre
      // système sur certains téléphones. --bottom-nav-height (globals.css)
      // reste la hauteur HORS safe-area, cohérente avec .pb-safe-nav.
      style={{ paddingBottom: "calc(22px + env(safe-area-inset-bottom))" }}
    >
      {TABS.map((tab) => {
        const active = state.screen === tab.screen;
        const color = active ? "#A66950" : "#948A79";
        const onClick = () => tab.go(actions);
        return (
          <button key={tab.screen} onClick={onClick} className="flex flex-col items-center gap-[5px] flex-1 min-w-0 cursor-pointer">
            <TabIcon name={tab.icon} color={color} />
            <span className="text-[9.5px] tracking-[.05em] uppercase whitespace-nowrap" style={{ color }}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
