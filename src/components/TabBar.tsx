"use client";

import { useCapsela } from "@/lib/store";
import type { Screen } from "@/lib/types";

type IconName = "home" | "hanger" | "sparkle" | "capsule" | "journal";

/**
 * Hauteur de la pastille de sélection — icône 19px + 5px de respiration de
 * part et d'autre. Réservée sur les CINQ onglets, pas seulement l'actif :
 * sinon l'onglet actif grandit et pousse son libellé 5px plus bas que ses
 * voisins (mesuré en rendu le 23/09/2026 sur la planche de variantes). La
 * pastille inactive est simplement transparente.
 */
const PASTILLE_H = 29;
/** Assez large pour lire comme une forme autour du glyphe, assez étroite
 *  pour que cinq pastilles tiennent à 320px (47px × 5 = 235 sur 304). */
const PASTILLE_PX = 14;

function TabIcon({ name, actif }: { name: IconName; actif: boolean }) {
  // currentColor partout : la couleur est portée par le bouton, une seule
  // fois, et la transition de couleur s'applique au glyphe comme au libellé.
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", stroke: "currentColor", fill: "none" as const };
  // « Icône légèrement plus visible que les icônes inactives » : +0,4 de
  // trait, sous le seuil où le glyphe change d'allure. Ne vaut que pour les
  // icônes au trait — sur `sparkle`, pleine, c'est la pastille et la couleur
  // qui portent seules l'état actif (un trait ajouté sur une étoile pleine
  // est resté invisible à la mesure).
  const p = actif ? 0.4 : 0;
  switch (name) {
    case "home":
      return (
        <svg {...common} strokeWidth={1.6 + p} strokeLinejoin="round">
          <path d="M4 11L12 4l8 7v7.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 18.5V11z" />
        </svg>
      );
    case "hanger":
      return (
        <svg {...common} strokeWidth={1.5 + p} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3.2a1.9 1.9 0 00-.6 3.7v1.1L4.6 12.9a1.4 1.4 0 00.8 2.55h13.2a1.4 1.4 0 00.8-2.55L12.6 8V6.9A1.9 1.9 0 0012 3.2z" />
          <line x1="4.8" y1="18.6" x2="19.2" y2="18.6" />
        </svg>
      );
    case "sparkle":
      return (
        <svg width={19} height={19} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" />
        </svg>
      );
    case "capsule":
      return (
        <svg {...common} strokeWidth={1.6 + p} strokeLinecap="round">
          <path d="M4 9V6.5A1.5 1.5 0 015.5 5H9M15 5h3.5A1.5 1.5 0 0120 6.5V9M20 15v2.5a1.5 1.5 0 01-1.5 1.5H15M9 19H5.5A1.5 1.5 0 014 17.5V15" />
        </svg>
      );
    case "journal":
      // Livre ouvert (recette 24/08/2026, signalé : l'icône lignes suggérait
      // une liste, pas un journal) — deux pages symétriques de part et
      // d'autre d'une reliure centrale.
      return (
        <svg {...common} strokeWidth={1.5 + p} strokeLinecap="round" strokeLinejoin="round">
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
      //
      // pt (23/09/2026, pastille de sélection) : 8 et non plus 11. La
      // pastille apporte elle-même 5px au-dessus du glyphe, donc l'air
      // au-dessus des icônes passe de 11 à 13 tout en ne rendant la barre
      // que 6px plus haute — « légèrement », pas « plus imposante ».
      className="absolute left-0 right-0 bottom-0 z-20 bg-cream border-t border-border flex items-center justify-around px-2 pt-[8px]"
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
        const onClick = () => tab.go(actions);
        return (
          <button
            key={tab.screen}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className="flex flex-col items-center gap-[5px] flex-1 min-w-0 cursor-pointer transition-colors duration-150"
            // Deux jetons existants, aucune couleur nouvelle :
            // --color-terracotta est documenté comme l'accent des icônes
            // actives ; --color-muted est le gris chaud du texte secondaire
            // de toute l'app. L'inactif était jusqu'ici un #948A79 en dur,
            // présent nulle part ailleurs et à 2,94:1 sur le crème — sous le
            // seuil de 3:1.
            style={{ color: active ? "var(--color-terracotta)" : "var(--color-muted)" }}
          >
            <span
              className="flex items-center justify-center rounded-full transition-colors duration-150"
              style={{
                height: PASTILLE_H,
                paddingInline: PASTILLE_PX,
                background: active ? "var(--color-warm-bg)" : "transparent",
              }}
            >
              <TabIcon name={tab.icon} actif={active} />
            </span>
            <span
              className="text-[9.5px] tracking-[.05em] uppercase whitespace-nowrap"
              style={{ fontWeight: active ? 600 : 400 }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
