"use client";

import { useEffect, useRef, useState } from "react";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { ZoneLookDuJour } from "@/components/ZoneLookDuJour";
import { useOuvrirPiece } from "@/components/useOuvrirPiece";
import Button from "@/components/Button";
import type { CategoryKey, Item } from "@/lib/types";

/**
 * Une action discrète sous le look : une icône et un libellé (« Sauvegarder », « Autre idée »). Un seul bouton, cible tactile de 44 px.
 * Le CTA « Voir le look » reste l'action dominante de la carte.
 */
export function ActionRonde({ icone, libelle, onClick, actif, disabled, label }: { icone: React.ReactNode; libelle: string; onClick: () => void; actif?: boolean; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={actif}
      aria-label={label}
      className="inline-flex items-center gap-[7px] min-h-[44px] px-1 text-[12.5px] text-ink-soft cursor-pointer disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-[.97]"
    >
      <span className="flex-shrink-0 text-ink">{icone}</span>
      <span>{libelle}</span>
    </button>
  );
}

export const IconeCoeur = ({ plein }: { plein: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill={plein ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const IconeAutre = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export interface CarteHeroProps {
  surtitre: string;
  titre: { a: string; b: string };
  sousTitre: string;
  pieces: Item[];
  graine: string;
  /** Silhouette attendue pendant le chargement de la tenue du jour (ZoneLookDuJour) ; sans elle, la planche seule. */
  categoriesAttendues?: CategoryKey[];
  onVoir: () => void;
  sauvegardee: boolean;
  onSauvegarder: () => void;
  onAutre: () => void;
  autreDesactive?: boolean;
  /** Pièces manquantes posées en silhouette (les chaussures, 14/10/2026), comme sur la page Tenue. */
  fantomes?: CategoryKey[];
  /** Sous les actions, sur toute la largeur (alerte météo d'un look planifié). */
  pied?: React.ReactNode;
}

/**
 * UNE SLIDE DU HERO (14/10/2026) : fond #EEDED8, le texte réduit à gauche, la composition — point focal — à droite, deux actions
 * dessous. Même géométrie que le hero d'avant (358 × 307 sur 390), aux couleurs de la carte claire.
 */
export function CarteHero({ surtitre, titre, sousTitre, pieces, graine, categoriesAttendues, onVoir, sauvegardee, onSauvegarder, onAutre, autreDesactive, pied, fantomes }: CarteHeroProps) {
  const ouvrirPiece = useOuvrirPiece();
  return (
    <div
      className="rounded-hero grid gap-2"
      style={{ background: "var(--color-look-bg)", gridTemplateColumns: "minmax(0,1fr) clamp(140px, 55.5%, 181px)", padding: "20px 14px 10px 18px", minHeight: 307 }}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-[7px]">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta-deep" style={{ display: "block" }}>
            <path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="t-surtitre text-ink whitespace-nowrap">{surtitre}</span>
        </div>
        <div className="font-serif text-ink mt-3" style={{ fontSize: "clamp(22px, 6.4vw, 27px)", lineHeight: 1.08 }}>
          {titre.a}
          {titre.b && (
            <>
              <br />
              <span className="italic text-terracotta">{titre.b}</span>
            </>
          )}
        </div>
        <div className="text-[13px] text-ink-soft leading-[1.45] mt-[10px]" style={{ textWrap: "pretty" }}>
          {sousTitre}
        </div>
        <div className="mt-auto pt-4">
          <Button variante="principal" pleine={false} onClick={onVoir} className="!px-[16px] !normal-case !tracking-[0.02em] !text-[14px] whitespace-nowrap">
            Voir le look
          </Button>
        </div>
      </div>

      <div className="relative min-w-0 self-center" style={{ aspectRatio: "100 / 112", margin: "4px -10px 0 -6px" }}>
        {categoriesAttendues ? (
          <ZoneLookDuJour pieces={pieces} categoriesAttendues={categoriesAttendues} graine={graine} onPiece={ouvrirPiece} fantomes={fantomes} />
        ) : (
          <FlatLayCapsela items={pieces} context="hero-home" layoutSeed={graine} onPiece={ouvrirPiece} fantomes={fantomes} />
        )}
      </div>

      <div className="flex items-center" style={{ gridColumn: "1 / -1" }} aria-live="polite">
        <ActionRonde icone={<IconeCoeur plein={sauvegardee} />} libelle={sauvegardee ? "Sauvegardée" : "Sauvegarder"} actif={sauvegardee} onClick={onSauvegarder} />
        <span aria-hidden="true" className="w-px h-[16px] mx-3" style={{ background: "rgba(29,26,22,.2)" }} />
        <ActionRonde icone={<IconeAutre />} libelle="Autre tenue" label="Propose-moi une autre tenue" disabled={autreDesactive} onClick={onAutre} />
      </div>
      {pied}
    </div>
  );
}

/**
 * LE CARROUSEL (14/10/2026) : une piste à défilement horizontal calé sur chaque slide (scroll-snap), des repères de pagination dessous.
 * Aucune bibliothèque : la position se lit sur le défilement, les repères y reconduisent. Une seule slide domine ; la piste ne
 * déborde pas de la page (le défilement reste dans le composant).
 */
export function CarrouselHero({ slides, libelles }: { slides: React.ReactNode[]; libelles: string[] }) {
  const piste = useRef<HTMLDivElement>(null);
  const [actif, setActif] = useState(0);
  const n = slides.length;
  const indexActif = Math.min(actif, Math.max(0, n - 1));

  // Une slide qui disparaît (plus de proposition) ramène à une position valide ; une piste qui rétrécit se recale.
  useEffect(() => {
    const el = piste.current;
    if (el && actif > n - 1) el.scrollTo({ left: Math.max(0, n - 1) * el.clientWidth });
  }, [n, actif]);

  const surDefilement = () => {
    const el = piste.current;
    if (!el || el.clientWidth === 0) return;
    setActif(Math.round(el.scrollLeft / el.clientWidth));
  };
  const aller = (i: number) => {
    const el = piste.current;
    if (!el) return;
    const reduit = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduit ? "auto" : "smooth" });
  };

  return (
    <div className="mt-3" role="region" aria-roledescription="carrousel" aria-label="Tes tenues du jour">
      <div
        ref={piste}
        onScroll={surDefilement}
        className="flex overflow-x-auto snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", overscrollBehaviorX: "contain" }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className="snap-center shrink-0 w-full px-4"
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${libelles[i]} (${i + 1} sur ${n})`}
          >
            {slide}
          </div>
        ))}
      </div>
      {n > 1 && (
        <div className="flex items-center justify-center gap-[6px] mt-[10px]">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => aller(i)}
              aria-label={`Voir ${libelles[i].toLowerCase()}`}
              aria-current={i === indexActif}
              className="flex items-center justify-center w-[22px] h-[22px] cursor-pointer"
            >
              <span className="block rounded-full motion-safe:transition-all" style={{ width: i === indexActif ? 18 : 6, height: 6, background: i === indexActif ? "var(--color-terracotta-deep)" : "rgba(29,26,22,.22)" }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
