"use client";

import { useRef, useState, type ReactNode } from "react";

/*
 * LE PARCOURS DE VOTE, PARTAGÉ (14/11/2026, brief « Refonte UX/UI – Onboarding Choix des styles ») : la carte qui glisse sous le doigt,
 * les boutons ronds et les flèches précédente / suivante, sortis de la fiche de suggestion d'une pièce (FicheSuggestion, refonte du
 * 02/11/2026) pour servir aussi au choix des styles de l'onboarding (DecouverteStyles). Un seul geste, un seul dessin : rien n'est recréé,
 * la fiche pièce garde exactement son comportement.
 */

/** Distance (px) au-delà de laquelle un glissement vaut un vote ; en deçà, la carte revient. */
export const SEUIL_GLISSEMENT = 90;

/**
 * La carte qui glisse : seulement à l'horizontale (un geste d'abord vertical reste un défilement). Au-delà du seuil, droite = J'aime,
 * gauche = Pas pour moi ; la carte s'en va dans le sens du vote. Le parent la remonte (`key`) à chaque nouvel élément : elle repart au
 * centre.
 */
export function CarteGlissante({
  occupe = false,
  onAimer,
  onRejeter,
  children,
}: {
  /** Un vote est en cours de transition : le geste ne vote pas (pas de double vote). */
  occupe?: boolean;
  onAimer: () => void;
  onRejeter: () => void;
  children: ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [lache, setLache] = useState(true);
  const geste = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const finirGeste = () => {
    const d = dx;
    geste.current = null;
    setLache(true);
    if (occupe) return setDx(0);
    if (d > SEUIL_GLISSEMENT) {
      setDx(420);
      onAimer();
    } else if (d < -SEUIL_GLISSEMENT) {
      setDx(-420);
      onRejeter();
    } else setDx(0);
  };
  return (
    <div
      className="relative select-none"
      style={{
        transform: dx ? `translateX(${dx}px) rotate(${dx / 30}deg)` : undefined,
        transition: lache ? "transform 220ms ease-out" : "none",
        touchAction: "pan-y",
      }}
      onPointerDown={(e) => {
        if (occupe) return;
        geste.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
      }}
      onPointerMove={(e) => {
        const g = geste.current;
        if (!g || g.id !== e.pointerId) return;
        const ddx = e.clientX - g.x;
        const ddy = e.clientY - g.y;
        if (g.horizontal === null && Math.hypot(ddx, ddy) > 8) {
          g.horizontal = Math.abs(ddx) > Math.abs(ddy);
          if (g.horizontal) {
            e.currentTarget.setPointerCapture(e.pointerId);
            setLache(false);
          } else geste.current = null;
        }
        if (g.horizontal) setDx(ddx);
      }}
      onPointerUp={() => geste.current?.horizontal && finirGeste()}
      onPointerCancel={() => {
        geste.current = null;
        setLache(true);
        setDx(0);
      }}
    >
      {/* Ce que le glissement va faire : le cœur à droite, la croix à gauche — une forme, pas seulement une couleur. */}
      <span
        aria-hidden="true"
        className="absolute left-[8px] top-[8px] z-10 rounded-full bg-terracotta-deep text-cream text-[12px] font-semibold px-[10px] py-[5px]"
        style={{ opacity: Math.max(0, Math.min(1, dx / SEUIL_GLISSEMENT)) }}
      >
        ♥ J&apos;aime
      </span>
      <span
        aria-hidden="true"
        className="absolute right-[8px] top-[8px] z-10 rounded-full bg-card border border-border text-ink text-[12px] font-semibold px-[10px] py-[5px]"
        style={{ opacity: Math.max(0, Math.min(1, -dx / SEUIL_GLISSEMENT)) }}
      >
        ✕ Pas pour moi
      </span>
      {children}
    </div>
  );
}

/**
 * Un geste du parcours : un rond de 56 px (64 pour l'action principale), son libellé dessous ; la cible fait toute la colonne.
 * `principal` : fond terracotta (J'aime de la fiche pièce ; J'aime d'un style déjà choisi). `actif` l'annonce aux lecteurs d'écran.
 */
export function BoutonRond({
  libelle,
  aria,
  onClick,
  disabled,
  principal,
  actif,
  children,
}: {
  libelle: string;
  aria: string;
  onClick?: () => void;
  disabled?: boolean;
  principal?: boolean;
  /** Bouton à bascule (J'aime d'un style) : son état, pour aria-pressed ; absent, un simple bouton. */
  actif?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={aria} aria-pressed={actif} className="flex flex-col items-center gap-[6px] px-1 cursor-pointer disabled:opacity-60">
      <span
        className={`rounded-full flex items-center justify-center motion-safe:transition-colors motion-safe:duration-200 ${principal ? "w-[64px] h-[64px] bg-terracotta-deep text-on-terracotta shadow-[0_6px_16px_rgba(140,70,45,.25)]" : "w-[56px] h-[56px] mt-[4px] bg-card border border-border text-ink"}`}
      >
        {children}
      </span>
      <span className="text-[12px] leading-[1.25] text-ink text-center">{libelle}</span>
    </button>
  );
}

/** Précédent / suivant, posés sur les côtés de la carte, à mi-hauteur du visuel ; sans `onClick`, invisible (bout de liste). */
export function FlecheParcours({ sens, onClick, libelle }: { sens: "precedente" | "suivante"; onClick?: () => void; libelle?: string }) {
  const gauche = sens === "precedente";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={libelle ?? (gauche ? "Suggestion précédente" : "Suggestion suivante")}
      className={`absolute top-1/2 -translate-y-1/2 ${gauche ? "left-0" : "right-0"} w-[44px] h-[44px] rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-ink cursor-pointer disabled:opacity-0 disabled:pointer-events-none`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
        <path d={gauche ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/** Le cœur des votes : plein (J'aime de la fiche, style choisi) ou au trait (style pas encore choisi). */
export function IconeCoeur({ plein = true, taille = 24 }: { plein?: boolean; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"
        fill={plein ? "currentColor" : "none"}
        stroke={plein ? "none" : "currentColor"}
        strokeWidth={plein ? undefined : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** La croix de « Pas pour moi ». */
export function IconeCroix() {
  return (
    <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M2.5 2.5l9 9M11.5 2.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
