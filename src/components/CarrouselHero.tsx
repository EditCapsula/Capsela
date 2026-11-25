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
export function ActionRonde({ icone, libelle, onClick, actif, disabled, label, chevron = false }: { icone: React.ReactNode; libelle: string; onClick: () => void; actif?: boolean; disabled?: boolean; label?: string; /** Demi-gras et chevron gras (24/11/2026, demandé sur « Autre tenue » de la Capsule). */ chevron?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={actif}
      aria-label={label}
      className={"inline-flex items-center gap-[7px] min-h-[44px] px-1 text-[12.5px] cursor-pointer disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-[.97] " + (chevron ? "font-semibold text-ink" : "text-ink-soft")}
    >
      <span className="flex-shrink-0 text-ink">{icone}</span>
      <span>{libelle}</span>
      {chevron && (
        <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta" style={{ display: "block" }}>
          <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
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

export const IconeAvis = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h10a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 17 16h-6l-4 3.5V16a2.5 2.5 0 0 1-2.5-2.5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/**
 * LES TROIS ACTIONS SOUS « VOIR LE LOOK » (19/11/2026, option B de l'accueil, arbitrée) : Sauvegarder · Avis d'un proche · Autre tenue,
 * trois colonnes égales, l'icône au-dessus du libellé — sur une ligne, les trois libellés ne tiennent pas à 390 px.
 */
export function ActionsSousLeLook({ sauvegardee, onSauvegarder, onAvis, onAutre, autreDesactive }: { sauvegardee: boolean; onSauvegarder: () => void; onAvis: () => void; onAutre: () => void; autreDesactive?: boolean }) {
  // Calées par le haut : à 320 px, « Avis d'un proche » passe sur deux lignes ; les icônes restent alignées (mesuré le 19/11/2026).
  // Des BOUTONS (24/11/2026, demandé, comme la page Tenue) : libellé demi-gras à l'encre et chevron gras terracotta au bout du libellé.
  const cellule = "flex-auto min-w-0 flex flex-col items-center justify-start gap-[4px] min-h-[52px] pt-[6px] text-[12px] font-semibold leading-[1.25] text-center text-ink cursor-pointer disabled:opacity-50 motion-safe:transition-transform motion-safe:active:scale-[.97]";
  // Le chevron collé au DERNIER MOT (25/11/2026, signalé sur Android à 412 px : le chevron d'« Avis d'un proche » partait seul à la
  // ligne) : si le libellé doit se couper, le chevron part avec son mot, jamais seul.
  const libelle = (texte: string) => {
    const coupe = texte.lastIndexOf(" ");
    return (
      <span>
        {coupe > 0 ? texte.slice(0, coupe + 1) : ""}
        <span className="whitespace-nowrap">
          {coupe > 0 ? texte.slice(coupe + 1) : texte}
          <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true" className="inline-block align-[-0.5px] ml-[4px] text-terracotta">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </span>
    );
  };
  return (
    // data-actions-tenue : l'accueil masque le bouton flottant « + » tant qu'il recouvre cette ligne (21/11/2026).
    // Des colonnes à la largeur de leur libellé (25/11/2026) et non trois tiers égaux : « Avis d'un proche », plus long, prend la place
    // que « Sauvegarder » et « Autre tenue » laissent libre, et tient sur une ligne dès 360 px. Les deux colonnes des bords ne rétrécissent
    // pas : sous 360 px, seul le libellé du milieu passe sur deux lignes.
    <div className="flex justify-between gap-[6px]" aria-live="polite" data-actions-tenue="">
      <button type="button" onClick={onSauvegarder} aria-pressed={sauvegardee} className={cellule + " shrink-0"}>
        <span className="text-ink">
          <IconeCoeur plein={sauvegardee} />
        </span>
        {libelle(sauvegardee ? t("Sauvegardée") : t("Sauvegarder"))}
      </button>
      <button type="button" onClick={onAvis} className={cellule}>
        <span className="text-ink">
          <IconeAvis />
        </span>
        {libelle(t("Avis d'un proche"))}
      </button>
      {/* data-tour : la visite guidée de l'accueil (lib/visites.ts) met en évidence celle de la première slide, affichée à l'arrivée. */}
      <button type="button" data-tour="accueil-autre-tenue" onClick={onAutre} disabled={autreDesactive} aria-label={t("Propose-moi une autre tenue")} className={cellule + " shrink-0"}>
        <span className="text-ink">
          <IconeAutre />
        </span>
        {libelle(t("Autre tenue"))}
      </button>
    </div>
  );
}

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
  /** « Avis d'un proche » (19/11/2026, option B) : partager cette tenue pour avoir un avis. */
  onAvis: () => void;
  /** Pièces manquantes posées en silhouette (les chaussures, 14/10/2026), comme sur la page Tenue. */
  fantomes?: CategoryKey[];
  /** Le « + » d'une silhouette (13/11/2026) : la chaussure manquante invite à choisir une paire (Ma tenue du jour). */
  onFantome?: (cat: CategoryKey) => void;
  /** Une pièce conseillée posée dans la composition avec un « + » (la veste du soir, 14/10/2026). */
  ajouts?: { item: Item; onAjouter: () => void }[];
  /** Sous les actions, sur toute la largeur (alerte météo d'un look planifié). */
  pied?: React.ReactNode;
  /** Au-dessus des actions, sur toute la largeur (« Pour l'extérieur », 17/11/2026, demandé : la strate au-dessus de « Sauvegarder » et « Autre tenue »). */
  avantActions?: React.ReactNode;
  /** La tenue a été portée aujourd'hui (« Porter cette tenue ») : la carte le dit (15/10/2026, demandé). */
  portee?: boolean;
  /** Toucher une pièce (12/11/2026, RemplacementPiece) : la feuille Voir / Remplacer. Sans lui, la fiche directe, comme avant. */
  onPiece?: (it: Item) => void;
  /** Le sous-titre sous « Pourquoi cette tenue ? » (12/11/2026) : une tenue recommandée. Faux : affiché tel quel (plan, valise). */
  pourquoi?: boolean;
  /** Posée dans une carte qui la porte déjà (l'accueil, 17/11/2026 : le jour, la météo et les points du carrousel dans la même carte) : ni fond ni filet. */
  sansCadre?: boolean;
}

/**
 * UNE SLIDE DU HERO. Depuis le 19/11/2026, l'OPTION B DE L'ACCUEIL (exploration du 18/11, arbitrée : « J'ai une préférence pour le B »,
 * « Mets la strate extérieur avant le CTA voir le look », avec la salutation et le carrousel gardés) : une disposition VERTICALE — le
 * surtitre de l'occasion, le titre en grand (titre d'écran), la composition sur toute la largeur de la carte, « Pour l'extérieur », puis
 * « Voir le look » en pleine largeur et les trois actions dessous. Avant : le texte à gauche, la composition à droite (358 × 307 sur 390),
 * deux actions (docs/carrousel-accueil.md). Fond blanc cassé des cartes et leur filet (option 3h du 14/10/2026), sauf posée dans une carte.
 */
export function CarteHero({ surtitre, titre, sousTitre, pieces, graine, categoriesAttendues, onVoir, sauvegardee, onSauvegarder, onAutre, autreDesactive, onAvis, pied, fantomes, onFantome, ajouts, portee, onPiece, pourquoi = false, sansCadre = false, avantActions }: CarteHeroProps) {
  const ouvrirFiche = useOuvrirPiece();
  const ouvrirPiece = onPiece ?? ouvrirFiche;
  return (
    <div
      // flex-1 : toutes les slides prennent la hauteur de la plus haute (la piste les étire) — pas de saut de hauteur au glissé (18/10/2026).
      className="rounded-hero flex flex-col flex-1 px-4 pt-4 pb-3"
      style={sansCadre ? undefined : { background: "var(--color-card)", border: "1px solid var(--color-border)" }}
    >
      <EnTeteTenue surtitre={surtitre} titre={titre} sousTitre={sousTitre} pourquoi={pourquoi} portee={portee} />
      <div className="relative w-full mt-1 -mx-2" style={{ aspectRatio: "100 / 96", width: "calc(100% + 16px)" }}>
        {categoriesAttendues ? (
          <ZoneLookDuJour pieces={pieces} categoriesAttendues={categoriesAttendues} graine={graine} onPiece={ouvrirPiece} fantomes={fantomes} onFantome={onFantome} ajouts={ajouts} />
        ) : (
          <FlatLayCapsela items={pieces} context="hero-home" layoutSeed={graine} onPiece={ouvrirPiece} fantomes={fantomes} onFantome={onFantome} ajouts={ajouts} />
        )}
      </div>
      {/* « Pour l'extérieur » AVANT « Voir le look » (18/11/2026, demandé sur l'option B). mt-auto : le CTA de chaque slide tombe au même
          niveau, quelle que soit la hauteur de son titre. */}
      <div className="mt-auto">
        {avantActions && <div className="mt-1">{avantActions}</div>}
        <div className="mt-2">
          {/* « TENUE » POUR CE QUE CAPSELA PROPOSE, « LOOK » POUR CE QUE L'ON GARDE (20/11/2026, arbitré : « on parle de tenue et de look…
              il faudrait harmoniser ») : la carte propose une tenue — « Voir la tenue », « Sauvegardée », « Autre tenue » — ; sauvegardée,
              elle devient un look (« Retrouve-la dans tes looks »). Arbitré pour la carte de l'accueil. */}
          <Button variante="principal" onClick={onVoir} className="!normal-case !tracking-[0.02em] !text-[15px]">
            {t("Voir la tenue")}
          </Button>
        </div>
        <div className="mt-1">
          <ActionsSousLeLook sauvegardee={sauvegardee} onSauvegarder={onSauvegarder} onAvis={onAvis} onAutre={onAutre} autreDesactive={autreDesactive} />
        </div>
        {pied}
      </div>
    </div>
  );
}

/**
 * L'en-tête d'une tenue de l'accueil (19/11/2026, option B) : le surtitre de l'occasion, le titre en grand, son second temps en italique
 * terracotta sur la même ligne, le « i » de la pertinence ; le texte d'un plan ou d'une valise sous le titre ; « Portée aujourd'hui ».
 * Partagé par les slides et par la carte seule (un autre jour), pour qu'elles se lisent pareil.
 */
/**
 * L'OCCASION EN TITRE, L'ALLURE EN SURTITRE (24/11/2026, demandé : « intervertis la typo pour le travail et chic et affirmé ») : avant,
 * « POUR LE TRAVAIL » en petites capitales et « Chic *et affirmé* » en titre d'écran. Désormais l'occasion est le titre — son premier
 * mot droit, la suite en italique terracotta (« Pour *le travail* ») — et l'allure passe en surtitre, avec l'étoile. Le « i » de la
 * pertinence reste au bout du titre.
 */
function enDeuxTemps(texte: string): { a: string; b: string } {
  const i = texte.indexOf(" ");
  return i < 0 ? { a: texte, b: "" } : { a: texte.slice(0, i), b: texte.slice(i + 1) };
}

export function EnTeteTenue({ surtitre, titre, sousTitre, pourquoi, portee }: { surtitre: string; titre: { a: string; b: string }; sousTitre: string; pourquoi: boolean; portee?: boolean }) {
  const occasion = enDeuxTemps(t(surtitre));
  const allure = [titre.a, titre.b].filter(Boolean).join(" ");
  return (
    <>
      <div className="flex items-center gap-[7px]">
        <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-terracotta" style={{ display: "block" }}>
          <path d="M12 3.5l1.7 5.1 5.3 1.7-5.3 1.7L12 17.1l-1.7-5.1L5 10.3l5.3-1.7z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="t-surtitre text-ink">{allure}</span>
      </div>
      <div className="relative t-titre-ecran text-ink mt-2" style={{ textWrap: "balance" }}>
        {occasion.a}
        {occasion.b && (
          <>
            {" "}
            <span className="italic text-terracotta">{occasion.b}</span>
          </>
        )}
        {/* La pertinence derrière le « i » du titre (12/11/2026, PourquoiCetteTenue). */}
        {pourquoi && <PourquoiCetteTenue texte={sousTitre} />}
      </div>
      {!pourquoi && (
        <div className="text-[13px] text-ink-soft leading-[1.45] mt-[8px]" style={{ textWrap: "pretty" }}>
          {sousTitre}
        </div>
      )}
      {portee && <MentionPortee />}
    </>
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
  enveloppe,
  fleches,
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
  /**
   * Ce qui entoure la piste, sans les points (17/11/2026, accueil : la carte qui porte aussi le jour et la météo ; les points restent
   * dessous, hors de la carte — demandé).
   */
  enveloppe?: (piste: React.ReactNode) => React.ReactNode;
  /**
   * LES FLÈCHES SUR LA PLANCHE (24/11/2026, retour d'une testeuse : « mets des flèches dans le flat lay pour montrer que tu peux aller à
   * gauche ou à droite ») : les pastilles rondes de « Ma sélection du moment » (Capsule), posées à hauteur de la planche (`hauteur`,
   * depuis le haut de la piste). Pas de flèche gauche sur la première tenue, ni droite sur la dernière. Le glissé reste.
   */
  fleches?: { hauteur: string };
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

  const laPiste = (
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
  );
  const fleche = (sens: "precedente" | "suivante") => {
    const gauche = sens === "precedente";
    const cible = gauche ? indexActif - 1 : indexActif + 1;
    if (cible < 0 || cible > n - 1) return null;
    return (
      <button
        type="button"
        onClick={() => aller(cible)}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={gauche ? t("Tenue précédente") : t("Tenue suivante")}
        className={`absolute z-10 -translate-y-1/2 ${gauche ? "left-[10px]" : "right-[10px]"} w-[40px] h-[40px] rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-ink cursor-pointer`}
        style={{ top: fleches!.hauteur }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d={gauche ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  };
  const pisteEtFleches =
    fleches && n > 1 ? (
      <div className="relative">
        {laPiste}
        {fleche("precedente")}
        {fleche("suivante")}
      </div>
    ) : (
      laPiste
    );
  return (
    <div className={className} role="region" aria-roledescription={t("carrousel")} aria-label={t(label)}>
      {enveloppe ? enveloppe(pisteEtFleches) : pisteEtFleches}
      {n > 1 && (
        // Des points de 28 × 44 px jointifs (25/11/2026, audit d'accessibilité) au lieu de 22 × 22 espacés de 6 : même dessin, même
        // pas entre les points ; les marges négatives rendent la hauteur gagnée pour que rien ne bouge autour.
        <div className="flex items-center justify-center -mt-[1px] -mb-[11px]">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => aller(i)}
              aria-label={t("Voir {libelle}", { libelle: libelles[i].toLowerCase() })}
              aria-current={i === indexActif}
              className="flex items-center justify-center w-[28px] h-[44px] cursor-pointer"
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
