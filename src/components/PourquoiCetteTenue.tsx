"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * « POURQUOI CETTE TENUE ? » (12/11/2026, brief « affichage éditorial des cartes de recommandations »). Par défaut, la carte ne montre
 * que le titre du look ; la phrase qui dit sa pertinence (editorialLook.ts) attend sous cette affordance discrète. Au toucher, un petit
 * panneau POSÉ PAR-DESSUS la carte (jamais dans son flux : la carte garde sa hauteur), avec le fondu léger de l'app — sans animation si
 * le téléphone demande moins de mouvement. Il se referme au second toucher, par Échap ou en touchant ailleurs ; il ne s'ouvre jamais
 * seul. La cible tactile dépasse le texte (44 px de haut) sans agrandir la ligne.
 */
export default function PourquoiCetteTenue({ texte, className = "" }: { texte: string; className?: string }) {
  const [ouvert, setOuvert] = useState(false);
  // Vers le haut quand la place manque dessous (barre du bas, bas de la carte) : mesuré au toucher, une fois.
  const [versLeHaut, setVersLeHaut] = useState(false);
  const id = useId();
  const zone = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOuvert(false);
    };
    const echap = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false);
    };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", echap);
    };
  }, [ouvert]);
  if (!texte) return null;
  return (
    <span ref={zone} className={"relative inline-flex " + className}>
      <button
        type="button"
        aria-expanded={ouvert}
        aria-controls={id}
        onClick={(e) => {
          // Dans une carte cliquable, le toucher ne l'ouvre pas.
          e.stopPropagation();
          const r = e.currentTarget.getBoundingClientRect();
          setVersLeHaut(window.innerHeight - r.bottom < 190);
          setOuvert((o) => !o);
        }}
        className="relative inline-flex items-start gap-[6px] text-left text-[12px] leading-[1.35] text-muted-3 cursor-pointer after:absolute after:content-[''] after:-inset-y-[13px] after:-inset-x-[6px]"
      >
        <span aria-hidden="true" className="mt-[1px] flex-shrink-0 w-[14px] h-[14px] rounded-full border border-current text-[9px] leading-none flex items-center justify-center font-semibold">
          i
        </span>
        {/* « tenue ? » ne se sépare pas : dans une colonne étroite (320 px), le libellé passe sur deux lignes sans laisser le « ? » seul. */}
        <span>Pourquoi cette tenue{"\u00a0"}?</span>
      </button>
      {ouvert && (
        <span
          id={id}
          role="note"
          className={(versLeHaut ? "bottom-full mb-[8px] " : "top-full mt-[8px] ") + "absolute left-0 z-20 block bg-card border border-border rounded-champ px-3 py-[10px] text-[12.5px] text-ink-soft leading-[1.45] motion-safe:animate-[capsule-apparition_180ms_ease-out_both]"}
          style={{ width: "min(240px, 70vw)", boxShadow: "0 6px 18px rgba(29,26,22,.12)", textWrap: "pretty" }}
        >
          {texte}
        </span>
      )}
    </span>
  );
}
