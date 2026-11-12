"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * « POURQUOI CETTE TENUE ? » (12/11/2026, brief « affichage éditorial des cartes de recommandations », puis le même jour, demandé :
 * « supprime la phrase Pourquoi cette tenue et n'affiche que le i près du titre ; dans l'infobulle, mets le titre Pourquoi cette tenue ? »).
 *
 * Une icône « i » posée juste après le titre du look ; au toucher, une infobulle titrée « Pourquoi cette tenue ? » avec la phrase qui
 * dit la pertinence du look (editorialLook.ts). Elle est POSÉE PAR-DESSUS la carte, ancrée au bloc du titre (son parent positionné —
 * l'appelant le met en `relative`) : la carte garde sa hauteur, et l'infobulle ne déborde pas de l'écran même quand l'icône est au bout
 * d'une colonne étroite. Fondu léger de l'app, sans animation si le téléphone demande moins de mouvement. Elle se referme au second
 * toucher, par Échap ou en touchant ailleurs ; elle ne s'ouvre jamais seule. La cible tactile fait 44 px, l'icône reste petite.
 */
export default function PourquoiCetteTenue({ texte }: { texte: string }) {
  const [ouvert, setOuvert] = useState(false);
  // Vers le haut quand la place manque dessous (barre du bas, bas de l'écran) : mesuré au toucher.
  const [versLeHaut, setVersLeHaut] = useState(false);
  const id = useId();
  const zone = useRef<HTMLSpanElement>(null);
  const bulle = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (!zone.current?.contains(cible) && !bulle.current?.contains(cible)) setOuvert(false);
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
    <>
      <span ref={zone} className="inline-flex align-middle ml-[6px]">
        <button
          type="button"
          aria-expanded={ouvert}
          aria-controls={id}
          aria-label="Pourquoi cette tenue ?"
          onClick={(e) => {
            // Dans une carte cliquable, le toucher ne l'ouvre pas.
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            setVersLeHaut(window.innerHeight - r.bottom < 190);
            setOuvert((o) => !o);
          }}
          className="relative inline-flex items-center justify-center text-muted-3 cursor-pointer after:absolute after:content-[''] after:-inset-[14px]"
        >
          <span
            aria-hidden="true"
            className="w-[16px] h-[16px] rounded-full border border-current font-sans not-italic text-[10px] leading-none flex items-center justify-center font-semibold"
          >
            i
          </span>
        </button>
      </span>
      {ouvert && (
        <span
          ref={bulle}
          id={id}
          role="note"
          className={
            (versLeHaut ? "bottom-full mb-[8px] " : "top-full mt-[8px] ") +
            "absolute left-0 z-20 block bg-card border border-border rounded-champ px-3 py-[10px] font-sans not-italic text-left motion-safe:animate-[capsule-apparition_180ms_ease-out_both]"
          }
          style={{ width: "min(240px, 70vw)", boxShadow: "0 6px 18px rgba(29,26,22,.12)" }}
        >
          <span className="block t-titre-vignette text-ink">
            Pourquoi cette tenue{" "}?
          </span>
          <span className="block text-[12.5px] text-ink-soft leading-[1.45] mt-[4px]" style={{ textWrap: "pretty" }}>
            {texte}
          </span>
        </span>
      )}
    </>
  );
}
