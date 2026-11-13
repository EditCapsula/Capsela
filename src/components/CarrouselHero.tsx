"use client";

import { aTraduire, t } from "@/lib/langue";
import PourquoiCetteTenue from "@/components/PourquoiCetteTenue";
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
  /** Le « + » d'une silhouette (13/11/2026) : la chaussure manquante invite à choisir une paire (Ma tenue du jour). */
  onFantome?: (cat: CategoryKey) => void;
  /** Une pièce conseillée posée dans la composition avec un « + » (la veste du soir, 14/10/2026). */
  ajouts?: { item: Item; onAjouter: () => void }[];
  /** Sous les actions, sur toute la largeur (alerte météo d'un look planifié). */
  pied?: React.ReactNode;
  /** La tenue a été portée aujourd'hui (« Porter cette tenue ») : la carte le dit (15/10/2026, demandé). */
  portee?: boolean;
  /** Toucher une pièce (12/11/2026, RemplacementPiece) : la feuille Voir / Remplacer. Sans lui, la fiche directe, comme avant. */
  onPiece?: (it: Item) => void;
  /** Le sous-titre sous « Pourquoi cette tenue ? » (12/11/2026) : une tenue recommandée. Faux : affiché tel quel (plan, valise). */
  pourquoi?: boolean;
}

/**
 * UNE SLIDE DU HERO (14/10/2026) : fond blanc cassé des cartes (--color-card) cerné de leur filet (--color-border) — le hero de l'accueil
 * seul, arbitré le 14/10/2026 (option 3h), puis Tenue le même jour ; les autres hero gardent --color-hero-background. Le texte réduit à gauche, la composition — point focal — à droite, deux actions
 * dessous. Même géométrie que le hero d'avant (358 × 307 sur 390), aux couleurs de la carte claire.
 */
export function CarteHero({ surtitre, titre, sousTitre, pieces, graine, categoriesAttendues, onVoir, sauvegardee, onSauvegarder, onAutre, autreDesactive, pied, fantomes, onFantome, ajouts, portee, onPiece, pourquoi = false }: CarteHeroProps) {
  const ouvrirFiche = useOuvrirPiece();
  const ouvrirPiece = onPiece ?? ouvrirFiche;
  return (
    <div
      // flex-1 : toutes les slides prennent la hauteur de la plus haute (la piste les étire) — pas de saut de hauteur au glissé (18/10/2026).
      className="rounded-hero grid gap-2 flex-1 grille-hero"
      style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", minHeight: 307 }}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-[7px]">
          <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta-deep" style={{ display: "block" }}>
            <path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="t-surtitre text-ink whitespace-nowrap">{t(surtitre)}</span>
        </div>
        {/* Un cran plus petit depuis que le titre nomme les pièces de la tenue (17/10/2026, titreDeLaTenue) : à 27 px, « La robe
            portefeuille et les baskets blanches » prenait cinq lignes. */}
        <div className="relative t-titre-section text-ink mt-3" style={{ textWrap: "balance" }}>
          {titre.a}
          {titre.b && (
            <>
              <br />
              <span className="italic text-terracotta">{titre.b}</span>
            </>
          )}
          {/* La pertinence derrière le « i » du titre (12/11/2026, PourquoiCetteTenue). */}
          {pourquoi && <PourquoiCetteTenue texte={sousTitre} />}
        </div>
        {!pourquoi && (
          <div className="text-[13px] text-ink-soft leading-[1.45] mt-[10px]" style={{ textWrap: "pretty" }}>
            {sousTitre}
          </div>
        )}
        {portee && <MentionPortee />}
        <div className="mt-auto pt-4">
          <Button variante="principal" pleine={false} onClick={onVoir} className="!px-[16px] !normal-case !tracking-[0.02em] !text-[14px] whitespace-nowrap">
            {t("Voir le look")}
          </Button>
        </div>
      </div>

      <div className="relative min-w-0 self-center" style={{ aspectRatio: "100 / 112", margin: "4px -10px 0 -6px" }}>
        {categoriesAttendues ? (
          <ZoneLookDuJour pieces={pieces} categoriesAttendues={categoriesAttendues} graine={graine} onPiece={ouvrirPiece} fantomes={fantomes} onFantome={onFantome} ajouts={ajouts} />
        ) : (
          <FlatLayCapsela items={pieces} context="hero-home" layoutSeed={graine} onPiece={ouvrirPiece} fantomes={fantomes} onFantome={onFantome} ajouts={ajouts} />
        )}
      </div>

      <div className="flex items-center" style={{ gridColumn: "1 / -1" }} aria-live="polite">
        <ActionRonde icone={<IconeCoeur plein={sauvegardee} />} libelle={sauvegardee ? t("Sauvegardée") : t("Sauvegarder")} actif={sauvegardee} onClick={onSauvegarder} />
        <span aria-hidden="true" className="w-px h-[16px] mx-3" style={{ background: "rgba(29,26,22,.2)" }} />
        {/* data-tour : la visite guidée de l'accueil (lib/visites.ts) met en évidence celle de la première slide, affichée à l'arrivée. */}
        <span data-tour="accueil-autre-tenue" className="inline-flex">
          <ActionRonde icone={<IconeAutre />} libelle={t("Autre tenue")} label={t("Propose-moi une autre tenue")} disabled={autreDesactive} onClick={onAutre} />
        </span>
      </div>
      {pied}
    </div>
  );
}

/**
 * LE CARROUSEL (14/10/2026) : une piste à défilement horizontal calé sur chaque slide (scroll-snap), des repères de pagination dessous.
 * Aucune bibliothèque : la position se lit sur le défilement, les repères y reconduisent. Une seule slide domine ; la piste ne
 * déborde pas de la page (le défilement reste dans le composant).
 *
 * ENRICHI LE 01/11/2026 (« Idées de looks ») sans rien changer pour l'accueil, qui garde les valeurs par défaut :
 *   · `largeurSlide` : une slide plus étroite que la piste laisse voir le bord de la suivante — on comprend qu'il y en a d'autres sans
 *     découvrir le geste par hasard ; la position se lit alors sur les slides elles-mêmes, plus sur la largeur de la piste ;
 *   · `label` : le nom du carrousel pour un lecteur d'écran ;
 *   · `onActif` : la slide affichée, pour l'appelant (compteur, actions liées) ;
 *   · `versSlide` : demande d'aller à une slide (un filtre qui change, un raccourci) ;
 *   · `retrait` et `ecart` : la gouttière de la page reprise dans la piste, et l'espace entre les slides ;
 *   · les flèches gauche et droite du clavier, la piste ayant le focus.
 */
export function CarrouselHero({
  slides,
  libelles,
  onAvantDerniere,
  label = aTraduire("Tes tenues du jour"),
  largeurSlide = "100%",
  classeSlide = "px-4",
  onActif,
  versSlide,
  className = "mt-3",
  retrait = 0,
  ecart = 0,
}: {
  slides: React.ReactNode[];
  libelles: string[];
  /** Appelé quand l'avant-dernière slide (ou la dernière) est affichée : le carrousel tire alors la suivante (17/10/2026). */
  onAvantDerniere?: () => void;
  label?: string;
  largeurSlide?: string;
  classeSlide?: string;
  onActif?: (index: number) => void;
  /** Une demande de position : `cle` change à chaque demande, même vers la même slide. */
  versSlide?: { index: number; cle: number };
  className?: string;
  /** Marge intérieure de la piste, en px (le gouttière de la page) : chaque slide se cale à ce retrait, la suivante dépasse à droite. */
  retrait?: number;
  /** L'espace entre deux slides, en px. */
  ecart?: number;
}) {
  const piste = useRef<HTMLDivElement>(null);
  const [actif, setActif] = useState(0);
  const n = slides.length;
  const indexActif = Math.min(actif, Math.max(0, n - 1));
  const surAvantDerniere = n > 1 && indexActif >= n - 2;
  useEffect(() => {
    if (surAvantDerniere) onAvantDerniere?.();
    // Une fois par arrivée sur l'avant-dernière (ou par slide ajoutée) : pas à chaque rendu, la fonction change à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surAvantDerniere, n]);
  useEffect(() => {
    onActif?.(indexActif);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexActif]);

  /** Le décalage de la slide i dans la piste : sa position, moins celle de la première (le retrait de la piste n'en fait pas partie). */
  const decalage = (i: number) => {
    const el = piste.current;
    const enfants = el?.children;
    if (!el || !enfants?.length) return 0;
    const cible = enfants[Math.max(0, Math.min(i, enfants.length - 1))] as HTMLElement;
    return cible.offsetLeft - (enfants[0] as HTMLElement).offsetLeft;
  };

  // Une slide qui disparaît (plus de proposition) ramène à une position valide ; une piste qui rétrécit se recale.
  useEffect(() => {
    const el = piste.current;
    if (el && actif > n - 1) el.scrollTo({ left: decalage(Math.max(0, n - 1)) });
  }, [n, actif]);

  const surDefilement = () => {
    const el = piste.current;
    const premiere = el?.children[0] as HTMLElement | undefined;
    if (!el || !premiere || premiere.offsetWidth === 0) return;
    // Le pas d'une slide à la suivante : sa largeur et l'écart.
    setActif(Math.min(n - 1, Math.round(el.scrollLeft / (premiere.offsetWidth + ecart))));
  };
  const aller = (i: number) => {
    const el = piste.current;
    if (!el) return;
    const reduit = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: decalage(i), behavior: reduit ? "auto" : "smooth" });
  };
  useEffect(() => {
    if (versSlide) aller(versSlide.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versSlide?.cle]);

  const auClavier = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" && indexActif < n - 1) {
      e.preventDefault();
      aller(indexActif + 1);
    } else if (e.key === "ArrowLeft" && indexActif > 0) {
      e.preventDefault();
      aller(indexActif - 1);
    }
  };

  return (
    <div className={className} role="region" aria-roledescription={t("carrousel")} aria-label={t(label)}>
      <div
        ref={piste}
        onScroll={surDefilement}
        onKeyDown={auClavier}
        tabIndex={n > 1 ? 0 : undefined}
        className="flex overflow-x-auto snap-x snap-mandatory outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
        style={{ scrollbarWidth: "none", overscrollBehaviorX: "contain", ...(retrait ? { paddingInline: retrait, scrollPaddingInline: retrait } : null), ...(ecart ? { columnGap: ecart } : null) }}
      >
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`${retrait ? "snap-start" : "snap-center"} shrink-0 flex flex-col ${classeSlide}`}
            style={{ width: largeurSlide }}
            role="group"
            aria-roledescription="diapositive"
            aria-label={t("{libelle} ({i} sur {n})", { libelle: libelles[i], i: i + 1, n })}
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
              aria-label={t("Voir {libelle}", { libelle: libelles[i].toLowerCase() })}
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

/**
 * « Portée aujourd'hui » (15/10/2026, demandé : « si j'ai indiqué avoir porté cette tenue, cela doit être indiqué sur l'accueil ») — la
 * coche ronde terracotta de la page Tenue (« Bonne journée avec cette tenue ! »), en plus petit. Un texte, jamais la couleur seule.
 */
export function MentionPortee() {
  return (
    <div className="mt-[10px] inline-flex items-center gap-[7px] self-start" role="status">
      <span aria-hidden="true" className="w-[20px] h-[20px] rounded-full bg-terracotta-deep text-cream flex items-center justify-center text-[11px] flex-shrink-0">
        ✓
      </span>
      <span className="text-[12.5px] text-ink">{t("Portée aujourd'hui")}</span>
    </div>
  );
}
