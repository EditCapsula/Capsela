"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AgendaLooks from "@/components/AgendaLooks";
import AppHeader from "@/components/AppHeader";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import GateAvisStyliste from "@/components/GateAvisStyliste";
import LoadingSpinner from "@/components/LoadingSpinner";
import FilEtapes from "@/components/FilEtapes";
import { GlypheOccasion, GlypheSousChoix } from "@/components/GlyphesOccasion";
import { OutfitComposition } from "@/components/OutfitComposition";
import SegmentedControl from "@/components/SegmentedControl";
import TabBar from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { resolveItemImage } from "@/lib/catalogImages";
import { CATS, DATE_CONTEXTS, OCCASIONS, occasionShortLabel } from "@/lib/data";
import { emptyStateCopy } from "@/lib/emptyStateCopy";
import { decisionAcces, premiumRequis } from "@/lib/autorisations";
import { generateOutfitWithFallback, titreLookDuJour } from "@/lib/logic";
import { jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { alerteMeteoPlan, previsionAChange } from "@/lib/planDuJour";
import { ecartJoursDuPlan, useMeteoDuPlan } from "@/lib/useMeteoDuPlan";
import { HORIZON_PREVISION_JOURS, joursCouverts, previsionPour, type MomentJournee, type Prevision } from "@/lib/prevision";
import { CHALEUR_HORS_SAISON, saisonCalendairePour, weatherForDay } from "@/lib/capsule";
import { fetchPrevisionByCity, fetchVilles, libelleVille, type VilleSuggeree } from "@/lib/weather";
import { deleteTenuePlanifiee, fetchTenuesPlanifiees, upsertTenuePlanifiee, villeDuLieu, type TenuePlanifiee } from "@/lib/planifier";
import { repartirPlanifications, type ValiseGardee } from "@/lib/valises";
import { VISUEL_SEJOUR } from "@/lib/valise";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { composeWardrobePool } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "@/lib/types";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";

/**
 * Planifier une tenue — maquette du 23/09/2026, LOT 1.
 *
 * REMPLACE L'ÉCRAN D'ATTENTE du 22/09. Celui-ci assumait de ne rien faire ;
 * celui-là fait le parcours en entier (intro, 4 étapes, résultat) sur le vrai
 * moteur et la vraie taxonomie.
 *
 * CE QUE LE LOT 1 NE FAISAIT PAS, ET POURQUOI C'ÉTAIT ÉCRIT À L'ÉCRAN PLUTÔT
 * QUE SIMULÉ. Historique : les points 1 et 2 sont levés depuis — prévision
 * du lieu jusqu'à HORIZON_PREVISION_JOURS (fonction Edge `weather`,
 * mode=forecast) et persistance dans `planned_outfits` (migration 0030),
 * dans le store depuis le 27/09/2026 pour que l'Accueil et Tenue rappellent
 * les tenues du jour consulté.
 *
 * 1. Pas de météo de prévision. `weather.ts` et la fonction Edge `weather`
 *    n'appellent que /data/2.5/weather — la météo ACTUELLE. La tenue est donc
 *    composée sur la météo d'aujourd'hui, et la carte le dit mot pour mot. La
 *    maquette promettait « la météo prévue ce jour-là » : l'écrire sans la
 *    donnée aurait été le seul vrai mensonge possible ici, puisque c'est
 *    exactement l'argument de la fonctionnalité.
 * 2. Pas de persistance. Aucune table ne stocke une tenue planifiée, donc pas
 *    de « Garder cette tenue » ni de liste « Mes tenues planifiées » — un
 *    bouton qui ne garde rien coûte plus qu'il ne promet.
 * 3. Pas d'étape « Plus habillée / Plus détendue ». Le palier de formalité
 *    n'est manipulable que par `formalityOverride`, interne à
 *    `attemptCoreOutfit` qui n'est pas exporté : l'implémenter exigerait de
 *    toucher le moteur. Trois lignes qui ne changeraient rien à la tenue
 *    seraient une fausse commande. L'étape 4 ne garde donc que le réglage qui
 *    agit réellement, « Uniquement mon dressing ».
 *
 * LE MOTEUR N'EST PAS TOUCHÉ. `generateOutfitWithFallback` est une fonction
 * pure : cet écran l'appelle avec le pool et la météo, exactement comme
 * `regen` (store.tsx) le fait pour la tenue du jour. Le seul levier propre à
 * l'écran est le POOL — composé avec la capsule, ou le dressing seul.
 *
 * Le moment de la journée et le type de lieu sont DESCRIPTIFS : ils décrivent
 * le rendez-vous, pas la tenue. Aucun des deux n'entre dans le moteur, et
 * « Pourquoi ce look ? » ne les cite donc jamais.
 */

const CAT_KEYS = CATS.map(([k]) => k) as CategoryKey[];

/**
 * Glyphes propres à cet écran — même grammaire que GlyphesOccasion.tsx
 * (viewBox 24, trait 1,5, `currentColor`, jamais remplis), mais ils ne
 * décrivent pas des occasions : leur place n'est donc pas dans cette table.
 *
 * Dessinés plutôt que posés en caractères Unicode (☁ ✓) pour la raison déjà
 * arbitrée le 23/09 sur les chips : un caractère système impose sa couleur et
 * son dessin, et jure à côté d'un glyphe au trait. Le premier rendu de cet
 * écran portait un ☁ noir au milieu d'une carte sable — exactement le défaut
 * que les glyphes existent pour empêcher.
 */
const T = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function Glyphe({ taille = 19, children }: { taille?: number; children: React.ReactNode }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
      {children}
    </svg>
  );
}

/** Même dessin que le glyphe valise de l'accueil (« Et si on préparait la suite ? »). */
const G_VALISE = (
  <>
    <rect x="3" y="7.5" width="18" height="13" rx="2.5" {...T} />
    <path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M9.5 11.5v5M14.5 11.5v5" {...T} />
  </>
);

const G_CINTRE = (
  <>
    <path d="M12 6a2 2 0 1 1 2 2v1.4" {...T} />
    <path d="M14 9.4 3.9 16.2a1 1 0 0 0 .6 1.8h15a1 1 0 0 0 .6-1.8L14 9.4z" {...T} />
  </>
);
const G_EPINGLE = (
  <>
    <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21z" {...T} />
    <circle cx="12" cy="10.4" r="2.3" {...T} />
  </>
);
const G_LOUPE = (
  <>
    <circle cx="11" cy="11" r="6.2" {...T} />
    <line x1="15.6" y1="15.6" x2="20" y2="20" {...T} />
  </>
);
const G_COCHE = <path d="M5 12.5l4.5 4.5L19 7.5" {...T} strokeWidth={1.8} />;
/** Le dessin de l'onglet Planifier (TabBar) : la date d'une tenue planifiée porte l'icône de l'écran. */
const G_CALENDRIER = (
  <>
    <rect x="4" y="6" width="16" height="14" rx="2" {...T} />
    <path d="M4 10h16M8.5 3.5V7M15.5 3.5V7" {...T} />
  </>
);
const G_HORLOGE = (
  <>
    <circle cx="12" cy="12" r="8" {...T} />
    <path d="M12 7.5V12l3 2" {...T} />
  </>
);
/** Le glyphe météo de la valise (ValiseScreen, « Météo prévue »). */
const G_METEO = (
  <>
    <path d="M7 18.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.4 1.6A3.2 3.2 0 0 0 7 18.5z" {...T} />
    <path d="M15.5 4.5v1.3M19.8 6.3l-.9.9M21.5 10.5h-1.3" {...T} />
  </>
);
const G_CHEVRON = <path d="M9.5 6l6 6-6 6" {...T} strokeWidth={1.7} />;
const G_COCHE_PETITE = <path d="M5 12.5l4.5 4.5L19 7.5" {...T} strokeWidth={2.2} />;
const G_CRAYON = (
  <>
    <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" {...T} />
    <path d="M14.5 7.5l3 3" {...T} />
  </>
);
const G_COEUR = <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" {...T} />;

const MOMENTS: [MomentJournee, string][] = [
  ["Matin", "Avant midi"],
  ["Après-midi", "De 12 h à 18 h"],
  ["Soirée", "À partir de 18 h"],
  ["Toute la journée", "Du matin au soir"],
];

const TYPES_LIEU: [string, string][] = [
  ["Restaurant", ""],
  ["Bar / Rooftop", ""],
  ["Lieu culturel", "Musée, théâtre, expo"],
  ["Extérieur", "Parc, balade, plein air"],
  ["Chez quelqu'un", "Dîner, famille"],
];

/**
 * QUELLES OCCASIONS MÉRITENT UN TYPE DE LIEU — arbitré le 24/09/2026,
 * occasion par occasion, jamais par extension d'un cas à l'autre.
 *
 * Deux contraintes cadrent la question avant tout goût :
 *
 * 1. LE TYPE DE LIEU N'ENTRE PAS DANS LE MOTEUR. Vérifié : la tenue vient de
 *    `generateOutfitWithFallback(pool, météo, occasion, workMode, dateContext,
 *    couleurs, genre)` — `typeLieu` n'y figure pas, et aucune règle de
 *    `logic.ts` ne le lit. Il décrit le rendez-vous (il s'affiche sur la
 *    fiche, il se range dans `planned_outfits.type_lieu`), il n'affine pas la
 *    sélection. Une question sans conséquence ne se pose donc que là où la
 *    réponse sert à SE RELIRE plus tard.
 * 2. LES VALEURS SONT FIGÉES PAR LA BASE. `planned_outfits.type_lieu` porte
 *    un CHECK sur exactement ces cinq chaînes (migration 0030). On peut donc
 *    en montrer un sous-ensemble, jamais en inventer une sixième : pas de
 *    « Bureau / coworking », qui exigerait un ALTER TABLE.
 *
 * D'où, pour chacune des dix occasions du référentiel :
 *
 *   quotidien        — masqué. « Courses, école, journée libre » ne se range
 *                      dans aucun des cinq sans le déformer.
 *   travail_formel   — masqué. Aucune des cinq valeurs ne nomme un lieu de
 *                      travail, et le sous-choix Présentiel / Télétravail dit
 *                      déjà ce qu'il y a à dire — lui, le moteur le lit.
 *   entretien        — masqué, même raison.
 *   date             — les cinq. C'est l'occasion où le lieu fait le plus
 *                      varier ce qu'on porte, et celle où on se relit.
 *   soiree           — les cinq.
 *   festive          — trois. « Club, anniversaire, bal » : un musée et un
 *                      parc n'y répondent pas.
 *   sport            — masqué. Seul « Extérieur » aurait du sens, et une
 *                      liste à une entrée n'est pas un choix.
 *   cocooning        — masqué. C'est chez soi, par définition.
 *   voyage           — masqué. Le programme du voyage est le contexte, pas
 *                      un lieu unique à désigner à l'avance.
 *   evenement_perso  — quatre. Un bar ne tient pas lieu de cérémonie.
 *
 * ARBITRAGE ÉDITORIAL, instruit au niveau de chaque occasion prise une à une.
 * Il ne s'étend pas à une occasion ajoutée plus tard sans le même examen.
 */
const TYPES_LIEU_PAR_OCCASION: Partial<Record<OccasionKey, readonly string[]>> = {
  date: ["Restaurant", "Bar / Rooftop", "Lieu culturel", "Extérieur", "Chez quelqu'un"],
  soiree: ["Restaurant", "Bar / Rooftop", "Lieu culturel", "Extérieur", "Chez quelqu'un"],
  festive: ["Restaurant", "Bar / Rooftop", "Chez quelqu'un"],
  evenement_perso: ["Restaurant", "Lieu culturel", "Extérieur", "Chez quelqu'un"],
};

const JOURS_PROPOSES = 21;
const DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DOW_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function dansNJours(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}

const WORK_MODES: WorkMode[] = ["Présentiel", "Télétravail"];

/**
 * Étiquette de section. 11 px / .16em : la forme MAJORITAIRE de l'app,
 * relevée à 39 occurrences contre 3 pour le 10,5 px qui traînait ici — ces
 * trois-là étaient les miennes, écrites d'après la maquette sans compter ce
 * que l'app utilisait déjà.
 */
function Surtitre({ children }: { children: React.ReactNode }) {
  return <div className="t-surtitre text-muted">{children}</div>;
}

/** Titre éditorial en deux temps — la seconde moitié en italique terracotta. */
function TitreEtape({ a, b }: { a: string; b: string }) {
  return (
    <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
      {a} <span className="italic text-terracotta">{b}</span>
    </div>
  );
}

/** Une ligne de « Autres options » (détail d'une tenue planifiée) : libellé, chevron, 52 px. */
function LigneOption({
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  label: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "w-full flex items-center justify-between gap-3 text-left text-[13px] border-b border-divider last:border-b-0 cursor-pointer disabled:cursor-default " +
        (danger ? "text-terracotta" : "text-ink")
      }
      style={{ minHeight: 52 }}
    >
      <span className="min-w-0">{label}</span>
      {!disabled && (
        <span className="flex-shrink-0 text-muted">
          <Glyphe taille={15}>{G_CHEVRON}</Glyphe>
        </span>
      )}
    </button>
  );
}

/**
 * Ligne à choix unique. Le rond de sélection n'est pas décoratif : avec la
 * seule couleur de fond, l'état choisi reposerait sur un écart de teinte de
 * 1,1:1 entre `card` et `warm-bg` — le même défaut que la barre d'onglets
 * avant le 23/09.
 */
function LigneChoix({
  actif,
  titre,
  sousTitre,
  glyphe,
  onClick,
}: {
  actif: boolean;
  titre: string;
  sousTitre?: string;
  glyphe?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      className={
        "flex items-center gap-3 w-full text-left rounded-bloc px-[14px] py-2 cursor-pointer border transition-colors " +
        (actif ? "bg-warm-bg border-sand-border" : "bg-card border-border")
      }
      style={{ minHeight: 52 }}
    >
      {glyphe && <span className={"flex-shrink-0 " + (actif ? "text-terracotta-deep" : "text-muted-3")}>{glyphe}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-ink">{titre}</span>
        {sousTitre && <span className="block text-[11px] text-muted mt-[2px]">{sousTitre}</span>}
      </span>
      <span
        aria-hidden="true"
        className="w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center"
        style={{
          border: "1.5px solid " + (actif ? "var(--color-terracotta-deep)" : "var(--color-cream-dark-soft)"),
          background: actif ? "var(--color-terracotta-deep)" : "transparent",
        }}
      >
        <span
          className="w-[7px] h-[7px] rounded-full"
          style={{ background: actif ? "var(--color-card)" : "transparent" }}
        />
      </span>
    </button>
  );
}

/**
 * Une carte du hub (refonte du 04/10/2026, « hub Premium + hub personnel »). Le bandeau éditorial, le titre, le texte et
 * le bouton de CRÉATION forment un seul <button> (pattern des cartes de l'accueil) ; le CTA est un <span>, pour ne pas
 * imbriquer deux éléments interactifs. Ce qui a déjà été créé (`children`) se pose SOUS ce bouton, dans la même carte, et
 * porte ses propres boutons : créer et consulter ne se mélangent pas. Le badge est sur sa propre ligne, au-dessus du
 * titre, à côté du glyphe : il ne peut ni chevaucher le titre ni le faire passer à la ligne, quelle que soit la largeur
 * (brief §16 du 25/09/2026).
 */
function CartePlanifier({
  glyphe,
  titre,
  accroche,
  description,
  ligne,
  cta,
  onClick,
  visuel,
  cadrage = "center 38%",
  children,
}: {
  /** Bandeau éditorial en tête de carte — absent tant que le visuel n'existe pas. */
  visuel?: string;
  /** `object-position` du bandeau : chaque visuel a son sujet à une hauteur différente. */
  cadrage?: string;
  glyphe: React.ReactNode;
  titre: [string, string];
  accroche: string;
  description: string;
  /** Les étapes du parcours, sur une seule ligne. */
  ligne: string;
  cta: string;
  onClick: () => void;
  /** Ce qui existe déjà (tenues, valises), sous le bouton de création. */
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-hero overflow-hidden">
      <button
        onClick={onClick}
        className="block w-full text-left px-[18px] pt-[16px] pb-[18px] cursor-pointer transition-opacity active:opacity-80"
      >
        {visuel && (
          // Bandeau à fond perdu : les marges négatives annulent le padding du bouton, `overflow-hidden` de la carte
          // arrondit ses coins hauts. 3:2, cadré sur le sujet (la tenue, la valise ouverte).
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={visuel}
            alt=""
            width={900}
            height={600}
            decoding="async"
            className="block -mx-[18px] -mt-[16px] mb-[14px] max-w-none object-cover"
            style={{ width: "calc(100% + 36px)", aspectRatio: "3/2", objectPosition: cadrage }}
          />
        )}
        <span className="flex items-center justify-between gap-3">
          <span className="w-10 h-10 flex-shrink-0 rounded-full bg-warm-bg flex items-center justify-center text-terracotta-deep">
            <Glyphe>{glyphe}</Glyphe>
          </span>
          <BadgePremium />
        </span>
        <span className="block t-titre-section text-ink mt-[12px]">
          {titre[0]} <span className="italic text-terracotta">{titre[1]}</span>
        </span>
        <span className="block t-label text-terracotta mt-[6px]">{accroche}</span>
        <span className="block text-[13px] text-ink-soft leading-[1.5] mt-[10px]" style={{ textWrap: "pretty" }}>
          {description}
        </span>
        <span className="block text-[12px] text-muted leading-[1.45] mt-[8px]">{ligne}</span>
        <span className="mt-[16px] flex items-center justify-center min-h-[52px] rounded-full bg-terracotta-deep text-cream t-bouton">{cta} →</span>
      </button>
      {children && <div className="border-t border-divider px-[18px] pt-[12px] pb-[8px]">{children}</div>}
    </div>
  );
}

/** L'en-tête de ce qui existe déjà dans une carte : « Tes tenues planifiées · 3 », et « Voir tout → » à droite. */
function EnteteExistant({ titre, nombre, onVoirTout }: { titre: string; nombre: number; onVoirTout: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="t-surtitre text-muted">
        {titre} <span className="text-terracotta">· {nombre}</span>
      </span>
      <button onClick={onVoirTout} className="text-[12px] text-terracotta cursor-pointer min-h-[44px] flex items-center flex-shrink-0">
        Voir tout →
      </button>
    </div>
  );
}

/** La miniature d'une valise : le visuel du type de séjour, sinon la mosaïque de ses vraies pièces — rien n'est inventé. */
function MiniatureValise({ v, dressing, taille }: { v: ValiseGardee; dressing: Item[]; taille: number }) {
  const visuel = v.sejour ? VISUEL_SEJOUR[v.sejour] : undefined;
  const apercu = v.pieceIds
    .map((id) => dressing.find((i) => i.id === id))
    .filter((i): i is Item => !!i)
    .slice(0, 4);
  return visuel ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={visuel} alt="" loading="lazy" className="flex-shrink-0 rounded-bloc object-cover bg-warm-bg" style={{ width: taille, height: taille }} />
  ) : (
    <span className="flex-shrink-0 rounded-bloc bg-warm-bg grid grid-cols-2 gap-[2px] p-[4px] overflow-hidden" style={{ width: taille, height: taille }}>
      {apercu.map((p) => {
        const img = resolveItemImage(p);
        return img.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={p.id} src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
        ) : (
          <span key={p.id} className="block w-full h-full rounded-[4px]" style={{ background: p.hex }} />
        );
      })}
    </span>
  );
}

/**
 * UNE VALISE DANS « MES PLANIFICATIONS » (27/09/2026) — même carte que les
 * tenues planifiées ; la destination, les dates et le nombre de looks, comptés.
 *
 * L'image est le visuel éditorial du TYPE DE SÉJOUR choisi (28/09/2026,
 * demandé : « un visuel édito illustrant le type de vacances choisi ») — le
 * même que la question « Quel type de séjour ? » de l'écran Valise. Il
 * remplace l'ancienne mosaïque de pièces, qui montrait souvent une seule
 * photo (un sac) perdue dans sa tuile. Sans type de séjour, ou pour « Autre »
 * qui n'a pas de visuel, la mosaïque des vraies pièces reste : rien n'est
 * inventé.
 */
function LigneValise({ v, dressing, passee, onClick }: { v: ValiseGardee; dressing: Item[]; passee: boolean; onClick: () => void }) {
  const visuel = v.sejour ? VISUEL_SEJOUR[v.sejour] : undefined;
  const apercu = v.pieceIds
    .map((id) => dressing.find((i) => i.id === id))
    .filter((i): i is Item => !!i)
    .slice(0, 4);
  const a = new Date(`${v.depart}T12:00:00`);
  const b = new Date(`${v.retour}T12:00:00`);
  const nbLooks = v.looks.filter((l) => l.ids.every((id) => dressing.some((i) => i.id === id))).length;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 bg-card border border-border rounded-carte p-[10px] text-left cursor-pointer"
      style={{ opacity: passee ? 0.78 : 1 }}
    >
      {visuel ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={visuel} alt="" loading="lazy" className="w-[64px] h-[64px] flex-shrink-0 rounded-bloc object-cover bg-warm-bg" />
      ) : (
        <span className="w-[64px] h-[64px] flex-shrink-0 rounded-bloc bg-warm-bg grid grid-cols-2 gap-[2px] p-[4px] overflow-hidden">
          {apercu.map((p) => {
            const img = resolveItemImage(p);
            return img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
            ) : (
              <span key={p.id} className="block w-full h-full rounded-[4px]" style={{ background: p.hex }} />
            );
          })}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block t-label text-terracotta">Valise</span>
        <span className="block t-titre-vignette text-ink mt-[2px] truncate">{v.destination}</span>
        <span className="block text-[12px] text-muted mt-[3px] truncate">
          {DOW[a.getDay()]}. {a.getDate()} {MOIS[a.getMonth()]}
          {v.depart !== v.retour ? ` → ${DOW[b.getDay()]}. ${b.getDate()} ${MOIS[b.getMonth()]}` : ""}
          {nbLooks ? ` · ${nbLooks} ${nbLooks > 1 ? "looks" : "look"}` : ""}
        </span>
      </span>
      <span aria-hidden="true" className="text-muted text-[15px] flex-shrink-0 pr-1">
        ›
      </span>
    </button>
  );
}

export default function PlanifierScreen() {
  const { state, weather, defaultCapsule, vestiairePool, etatPremium, actions } = useCapsela();
  const { profile, userId } = useAuth();

  // Retour de « Demander l'avis d'un proche » : le plan partagé se rouvre,
  // plutôt que de laisser sur le hub (l'état de cet écran est local).
  // « Planifier une tenue pour … » depuis Tenue (27/09/2026) : la date est
  // déjà choisie, le parcours s'ouvre sur ses étapes.
  const [vue, setVue] = useState<"intro" | "etape" | "resultat" | "liste" | "detail">(() =>
    state.planARouvrir ? "detail" : state.planComposition || state.planJour != null ? "etape" : "intro"
  );
  /**
   * COMPOSITION IMPOSÉE (Avis de styliste V2, 26/09/2026) : les pièces
   * reconnues sur la photo d'un avis. Le parcours reste le même — occasion,
   * date, lieu —, mais la tenue n'est pas recomposée par le moteur : c'est
   * celle de la photo qui est gardée. « Planifier une tenue » depuis le hub
   * repart sans elle (recommencer).
   */
  const [composition, setComposition] = useState<number[] | null>(() => state.planComposition?.pieceIds ?? null);
  /** Tenue planifiée ouverte en détail, ou dont le menu « … » est déplié. */
  const [planOuvert, setPlanOuvert] = useState<TenuePlanifiee | null>(() => state.planARouvrir);
  /** La météo du LIEU et du MOMENT du plan ouvert, aujourd'hui (useMeteoDuPlan) — null hors horizon ou sans réponse. */
  const meteoPlanVive = useMeteoDuPlan(planOuvert);
  const ecartJoursPlan = planOuvert ? ecartJoursDuPlan(planOuvert.jour) : null;
  /** D'où le détail a été ouvert — le hub ou la liste complète — pour que le retour y ramène. */
  const [retourDetail, setRetourDetail] = useState<"intro" | "liste">(() => (state.planARouvrir ? "intro" : "liste"));
  useEffect(() => {
    if (state.planARouvrir) actions.oublierPlanARouvrir();
    if (state.planComposition) actions.oublierPlanComposition();
    if (state.planJour != null) actions.oublierPlanJour();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [menuPlan, setMenuPlan] = useState<TenuePlanifiee | null>(null);
  /**
   * LE PARCOURS REPART D'UNE TENUE PLANIFIÉE (refonte du détail, 30/09/2026) :
   * « Modifier cette tenue », « Changer la date ou le moment », « Dupliquer ».
   * `remplacer` dit si la nouvelle planification prend la place de
   * l'ancienne. Sans lui, « Modifier » vers une autre date gardait les deux :
   * l'upsert se fait sur (jour, moment), une autre date est une autre ligne.
   */
  const [depuisPlan, setDepuisPlan] = useState<{ plan: TenuePlanifiee; remplacer: boolean } | null>(null);
  const [aSupprimer, setASupprimer] = useState<TenuePlanifiee | null>(null);
  /** « Enregistrer dans mes looks » demandé pour ce plan — le temps que l'insertion revienne. */
  const [lookDemande, setLookDemande] = useState<string | null>(null);
  /**
   * AVIS DE STYLISTE depuis le détail d'une tenue planifiée (30/09/2026) — la
   * fonctionnalité existante, sa décision d'accès et son Gate, repris tels
   * quels de l'accueil : aucun second parcours, aucune règle de plus.
   */
  const [gateAvisStyliste, setGateAvisStyliste] = useState(false);
  const [verificationAvis, setVerificationAvis] = useState(false);
  const ouvrirAvisStyliste = async () => {
    if (verificationAvis) return;
    const decision = decisionAcces("AVIS_DE_STYLISTE", etatPremium, false);
    if (decision === "acces") return actions.goAvisStyliste();
    if (decision === "gate") return setGateAvisStyliste(true);
    setVerificationAvis(true);
    const etat = await actions.verifierEtatPremium();
    setVerificationAvis(false);
    if (decisionAcces("AVIS_DE_STYLISTE", etat, true) === "acces") actions.goAvisStyliste();
    else setGateAvisStyliste(true);
  };
  const [etape, setEtape] = useState(1);
  const [occ, setOcc] = useState<OccasionKey | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>("Présentiel");
  /**
   * PREMIER SOUS-CHOIX DE LA LISTE, ET NON UNE VALEUR ÉCRITE À LA MAIN.
   *
   * « Verre » était codé ici en dur. Ce n'était pas un affichage à recaler :
   * `effectiveFormality("date", …, "Verre")` rend 1 quand
   * « Restaurant / date romantique » rend 4 (DATE_CONTEXTS, data.ts). La
   * tenue proposée par défaut pour une Date était donc réellement composée
   * au palier le plus bas du référentiel, pas seulement étiquetée ainsi.
   *
   * `DATE_CONTEXTS[0][0]` plutôt que la chaîne : le jour où l'ordre de la
   * liste change, le défaut suit, au lieu de désigner silencieusement une
   * ligne qui n'est plus la première.
   */
  const [dateContext, setDateContext] = useState<DateContext>(DATE_CONTEXTS[0][0]);
  // « Planifier pour demain » depuis un avis : la date est déjà connue.
  // Depuis Tenue, le jour consulté (planJour, toujours ≥ 1 : Planifier ne propose pas aujourd'hui).
  const [jour, setJour] = useState<number | null>(() => (state.planComposition?.demain ? 1 : state.planJour));
  const [moment, setMoment] = useState<MomentJournee | null>(null);
  const [lieu, setLieu] = useState("");
  /**
   * VILLE CHOISIE DANS LES SUGGESTIONS, avec ses coordonnées — `null` tant
   * qu'on tape librement. C'est elle qui part chercher la prévision quand
   * elle existe : un point, pas une chaîne à réinterpréter. La saisie libre
   * reste acceptée (l'autocomplétion peut être indisponible), elle est
   * simplement moins sûre.
   */
  const [ville, setVille] = useState<VilleSuggeree | null>(null);
  const [suggestions, setSuggestions] = useState<VilleSuggeree[] | null>(null);
  const [typeLieu, setTypeLieu] = useState<string | null>(null);
  const [dressingSeul, setDressingSeul] = useState(false);
  // Incrémenté par « Autre proposition » — seule entrée du useMemo qui change
  // alors, donc seul moyen de redemander un tirage sans toucher aux réponses.
  const [tirage, setTirage] = useState(0);
  /**
   * Prévision du LIEU. Demandée en quittant l'étape 3, c'est-à-dire au moment
   * où le lieu est arrêté — pas à chaque frappe dans le champ. Le temps que
   * l'étape 4 soit remplie, la réponse est presque toujours revenue ; « Voir
   * ma tenue » attend explicitement si ce n'est pas le cas, plutôt que
   * d'afficher une tenue composée sur la météo du jour puis de la changer
   * sous les yeux.
   *
   * `null` avec l'état "faite" est une réponse, pas une absence : lieu
   * introuvable, quota, ou fonction Edge pas encore redéployée (elle renvoie
   * alors la météo actuelle, sans `slots`). Les trois se disent de la même
   * façon à l'écran.
   */
  /**
   * TENUES PLANIFIÉES (table planned_outfits, migration 0030).
   *
   * Dans le store depuis le 27/09/2026 : elles ont trouvé leur second
   * lecteur — l'Accueil et Tenue rappellent celles du jour consulté. Cet
   * écran les lit et les écrit là, pour que les trois voient la même liste.
   */
  const plans = state.tenuesPlanifiees;
  const setPlans = actions.setTenuesPlanifiees;
  const [enregistrement, setEnregistrement] = useState(false);
  const [onglet, setOnglet] = useState<"up" | "past">("up");
  const [toast, setToast] = useState<string | null>(null);

  const [prevision, setPrevision] = useState<Prevision | null>(null);
  const [previsionEtat, setPrevisionEtat] = useState<"vide" | "encours" | "faite">("vide");

  const occLongDe = (k: OccasionKey) => OCCASIONS.find(([x]) => x === k)?.[1] ?? occasionShortLabel(k);
  const occLabel = occ && occ !== "all" ? occasionShortLabel(occ) : "";
  const occLong = occ ? (OCCASIONS.find(([k]) => k === occ)?.[1] ?? "") : "";

  /**
   * Types de lieu proposés pour l'occasion en cours — vide quand la question
   * ne se pose pas. Le choix déjà fait est effacé si l'occasion change et ne
   * le propose plus : sinon `planned_outfits.type_lieu` recevrait un « Bar /
   * Rooftop » sur un Voyage, choisi puis devenu invisible.
   */
  const typesLieuProposes = useMemo(() => {
    const permis = occ ? TYPES_LIEU_PAR_OCCASION[occ] : undefined;
    if (!permis) return [] as [string, string][];
    return TYPES_LIEU.filter(([t]) => permis.includes(t));
  }, [occ]);
  /**
   * AUTOCOMPLÉTION DE VILLE — /geo/1.0/direct, via la fonction Edge `weather`
   * en `mode=geo`. Même clé, même fournisseur que la météo : aucun service
   * supplémentaire, ce que l'audit demandait de vérifier avant d'en ajouter un.
   *
   * 280 ms d'attente après la dernière frappe, et la réponse d'une recherche
   * périmée est jetée (`annule`) : sans ça, « Par » revenant après « Paris »
   * remplacerait la bonne liste par l'ancienne.
   *
   * `suggestions === null` veut dire « pas d'autocomplétion ici » — mode démo,
   * réseau, ou fonction Edge pas encore redéployée. Rien ne s'affiche alors,
   * et la saisie libre continue de fonctionner exactement comme avant.
   */
  const villeChoisieAffichee = ville != null && libelleVille(ville) === lieu;
  /**
   * Ce qui s'affiche réellement sous le champ. DÉRIVÉ, jamais posé dans un
   * état : une saisie trop courte ou une ville déjà choisie n'a pas à
   * déclencher un rendu supplémentaire pour vider une liste — elle n'en a
   * simplement aucune à montrer. `suggestions` ne change donc que quand une
   * réponse arrive, ce qui est le seul évènement extérieur ici.
   */
  const suggestionsVisibles =
    lieu.trim().length < 2 || villeChoisieAffichee ? [] : (suggestions ?? []);

  useEffect(() => {
    if (etape !== 3) return;
    const q = lieu.trim();
    if (q.length < 2 || villeChoisieAffichee) return;
    let annule = false;
    const t = setTimeout(() => {
      fetchVilles(q)
        .then((v) => {
          if (!annule) setSuggestions(v);
        })
        .catch(() => {
          if (!annule) setSuggestions(null);
        });
    }, 280);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [lieu, etape, villeChoisieAffichee]);

  const dateChoisie = jour != null ? dansNJours(jour) : null;
  const dateLongue = dateChoisie
    ? `${DOW_LONG[dateChoisie.getDay()]} ${dateChoisie.getDate()} ${MOIS[dateChoisie.getMonth()]}`
    : "";

  /**
   * Météo du créneau demandé, ou null si la prévision ne va pas jusque-là.
   * `previsionPour` ne comble jamais un trou avec un autre moment : au-delà
   * de l'horizon, c'est null, et l'écran le dit.
   */
  const meteoMoment =
    prevision && dateChoisie && moment ? previsionPour(prevision, jourLocal(dateChoisie), moment) : null;
  /** Dernier jour réellement couvert — sert à dire jusqu'à quand on sait. */
  const dernierJourConnu = prevision ? joursCouverts(prevision).at(-1) : undefined;
  /**
   * Ce que le moteur reçoit. La saison vient de la DATE PLANIFIÉE et non du
   * jour courant : une tenue préparée pour le 1er septembre depuis le 29 août
   * relève de l'automne.
   *
   * Sans prévision pour le créneau (au-delà de l'horizon, ou lieu sans
   * réponse), la température reste celle d'aujourd'hui — la seule mesurée —
   * mais la saison reste celle de la date (recette du 26/09/2026) : jusque-là
   * le moteur recevait la saison du jour, et « La date fixe la saison de la
   * tenue » était faux au-delà de l'horizon.
   */
  const meteoUtilisee =
    meteoMoment && dateChoisie
      ? weatherForDay(meteoMoment.temp, meteoMoment.label, saisonCalendairePour(dateChoisie), CHALEUR_HORS_SAISON)
      : dateChoisie
        ? weatherForDay(weather.temp, weather.label, saisonCalendairePour(dateChoisie), CHALEUR_HORS_SAISON)
        : weather;
  /**
   * La ville telle que l'utilisatrice l'a donnée — le nom de la suggestion
   * choisie, ou le premier segment de sa saisie —, jamais une précision
   * qu'elle n'a pas fournie (recette du 26/09/2026, cf. villeDuLieu).
   */
  const villeAffichee = ville?.name ?? villeDuLieu(lieu);

  const tenue = useMemo(() => {
    if (!occ) return null;
    // Même composition que `regen` (store.tsx) : une catégorie dont aucune
    // pièce réelle ne déclare l'occasion se voit rendre celles de la capsule
    // qui la déclarent. « Uniquement mon dressing » court-circuite cette
    // complétion — c'est tout ce que ce réglage fait, et c'est suffisant.
    const pool = dressingSeul
      ? state.items
      : composeWardrobePool(state.items, defaultCapsule, CAT_KEYS, {
          completerPourOccasion: occ,
          saison: meteoUtilisee,
          exclureHorsOccasion: true,
        });
    return generateOutfitWithFallback(
      pool,
      meteoUtilisee,
      occ,
      workMode,
      dateContext,
      paletteHexes(profile),
      profile.gender,
      undefined,
      undefined,
      colorimetrieMoteur(profile.colorimetrie)
    );
    // `tirage` est une dépendance délibérée : c'est le bouton « Autre
    // proposition ». Sans elle, redemander une tenue rendrait la même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occ, dressingSeul, state.items, defaultCapsule, meteoUtilisee, workMode, dateContext, profile, tirage]);

  const pieces: Item[] = useMemo(() => {
    // Pool stable et non le seul dressing : une tenue planifiée reprise telle
    // quelle (« Changer la date », « Dupliquer ») peut contenir des pièces de
    // la capsule. Pour la tenue d'une photo, ne change rien — ses pièces sont
    // toutes au dressing.
    if (composition) {
      const source = [...state.items, ...vestiairePool];
      return composition.map((id) => source.find((i) => i.id === id)).filter((i): i is Item => !!i);
    }
    if (!tenue) return [];
    const source = dressingSeul ? state.items : [...state.items, ...defaultCapsule];
    return tenue.ids.map((id) => source.find((i) => i.id === id)).filter((i): i is Item => !!i);
  }, [composition, tenue, state.items, vestiairePool, defaultCapsule, dressingSeul]);
  /** Rien à garder : état vide du moteur — une composition imposée en a toujours une. */
  const sansTenue = !composition && (!tenue || tenue.noCompleteOutfit);

  /**
   * POOL DE RÉSOLUTION STABLE pour les tenues DÉJÀ PLANIFIÉES — le même que
   * LookDetailScreen et HistoryScreen, et pour la même raison : `wardrobePool`
   * ne contient que les suggestions de la capsule du style COURANT, alors
   * qu'une tenue gardée il y a trois semaines peut référencer des pièces
   * d'une autre capsule. `state.items + vestiairePool` couvre l'intégralité
   * du possible, quel que soit le style du moment.
   *
   * CE QUI LEVAIT MA RÉSERVE DU LOT 3. J'avais écarté les vignettes en
   * disant qu'une pièce résolue sur le pool courant pouvait montrer autre
   * chose que la tenue gardée. Avec ce pool-ci, les pièces du catalogue se
   * résolvent TOUJOURS — seule une pièce du dressing supprimée depuis
   * manque, et elle manque en silence plutôt que d'être remplacée.
   */
  const poolStable = useMemo(() => [...state.items, ...vestiairePool], [state.items, vestiairePool]);
  const piecesDuPlan = (t: TenuePlanifiee): Item[] =>
    t.pieceIds.map((id) => poolStable.find((i) => i.id === id)).filter((i): i is Item => !!i);

  const idsDressing = useMemo(() => new Set(state.items.map((i) => i.id)), [state.items]);
  const nbDressing = pieces.filter((p) => idsDressing.has(p.id)).length;
  const nbCapsule = pieces.length - nbDressing;

  /**
   * Provenance des pièces, en ne nommant QUE ce qui est réellement là.
   * « 0 pièce de ton dressing + 4 de ta capsule » — le premier rendu — répète
   * le défaut relevé le 23/09 sur la bande Capsule de l'accueil : un compteur
   * à zéro énoncé comme un résultat. Un dressing vide n'est pas une quantité
   * nulle à annoncer, c'est un terme qui n'a pas lieu d'être dans la phrase.
   */
  const pluriel = (n: number) => `${n} pièce${n > 1 ? "s" : ""}`;
  const provenance = composition
    ? depuisPlan
      ? "La tenue que tu avais planifiée, reprise telle quelle"
      : "La tenue de ta photo, reconnue dans ton dressing"
    : dressingSeul
    ? `${pluriel(pieces.length)} de ton dressing, sans complément`
    : nbDressing === 0
      ? `${pluriel(nbCapsule)} de ta capsule`
      : nbCapsule === 0
        ? `${pluriel(nbDressing)} de ton dressing`
        : `${pluriel(nbDressing)} de ton dressing + ${nbCapsule} de ta capsule`;



  /**
   * LA PHRASE MÉTÉO, EN UN SEUL ENDROIT. Quatre états, tous vrais :
   *   1. lieu pas encore connu — une promesse qu'on peut tenir ;
   *   2. prévision obtenue pour ce créneau — l'amplitude, qui est
   *      l'information à lire, et non la seule moyenne que le moteur reçoit ;
   *   3. jour au-delà de l'horizon — on dit jusqu'où on sait ;
   *   4. pas de prévision du tout — lieu introuvable, quota, ou fonction Edge
   *      pas encore redéployée : indistinguables pour l'utilisatrice, et elle
   *      n'a aucune raison d'avoir à les distinguer.
   */
  const phraseMeteo = (() => {
    const aujourdhui = `${weather.temp}°, ${weather.label.toLowerCase()}`;
    // Avant l'appel, rien à dire : la phrase n'est plus affichée pendant les
    // étapes (recette du 26/09/2026 — une question par étape, la météo n'en
    // est pas une), seulement dans « Pourquoi ce look ? », après l'appel.
    if (previsionEtat !== "faite") return "";
    if (meteoMoment) {
      const amplitude =
        meteoMoment.tempMin === meteoMoment.tempMax
          ? `${meteoMoment.temp}°`
          : `de ${meteoMoment.tempMin}° à ${meteoMoment.tempMax}°`;
      return `Prévision à ${villeAffichee} pour ce moment : ${amplitude}, ${meteoMoment.label.toLowerCase()}. La tenue en tient compte.`;
    }
    if (prevision && dernierJourConnu && dateChoisie && jourLocal(dateChoisie) > dernierJourConnu) {
      const d = new Date(`${dernierJourConnu}T12:00:00`);
      return `La prévision ne va que jusqu'au ${d.getDate()} ${MOIS[d.getMonth()]}. Au-delà, la tenue suit la saison de la date et la météo d'aujourd'hui — ${aujourdhui}.`;
    }
    return `Pas de prévision disponible pour ce lieu. La tenue suit la saison de la date et la météo d'aujourd'hui — ${aujourdhui}.`;
  })();

  /**
   * Sous-choix, même construction que l'écran Tenue : un second chip qui
   * n'existe que pour les occasions qui en ont un. Seuls `travail_formel` et
   * `date` figurent ici — ce sont les deux que le moteur lit
   * (`effectiveFormality`). `voyage` a bien un TravelMode sur Tenue, mais il
   * n'y sert qu'à afficher une carte de conseil : le poser ici donnerait une
   * commande sans effet sur la tenue.
   *
   * Il a TOUJOURS une valeur, comme dans le store de Tenue, donc il ne bloque
   * plus l'étape. Cela retire du même coup le correctif du 23/09 qui remontait
   * le bloc dans le champ de vision : il n'y a plus de question obligatoire
   * née sous le pli, puisqu'il n'y a plus dix lignes à faire défiler.
   */
  const sousChoix: {
    titre: string;
    valeurs: readonly (WorkMode | DateContext)[];
    courant: WorkMode | DateContext;
    choisir: (v: WorkMode | DateContext) => void;
  } | null =
    occ === "travail_formel"
      ? {
          titre: "Où travailleras-tu ce jour-là ?",
          valeurs: WORK_MODES,
          courant: workMode,
          choisir: (v) => setWorkMode(v as WorkMode),
        }
      : occ === "date"
        ? {
            titre: "Quel type de date ?",
            valeurs: DATE_CONTEXTS.map(([m]) => m),
            courant: dateContext,
            choisir: (v) => setDateContext(v as DateContext),
          }
        : null;
  /**
   * L'étape 4 attend la prévision plutôt que de composer sur la météo du jour
   * puis de changer la tenue sous les yeux : la requête est partie en
   * quittant l'étape 3, elle est presque toujours revenue quand on arrive
   * ici. Les étapes 1 à 3 ne sont jamais bloquées par elle.
   */
  /* Rechargement à l'ouverture de l'écran (le store les charge déjà avec le
     dressing) : une tenue planifiée depuis un autre appareil apparaît ici.
     `fetchTenuesPlanifiees` rend [] en mode démo comme en cas d'échec — en
     démo, on ne touche donc pas à la liste. */
  useEffect(() => {
    if (!userId || !isSupabaseConfigured) return;
    let annule = false;
    fetchTenuesPlanifiees(userId).then((r) => {
      if (!annule) setPlans(() => r);
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  /*
   * MES PLANIFICATIONS : les tenues planifiées ET les valises (27/09/2026).
   * Une valise est à venir jusqu'à son retour, puis passée
   * (repartirPlanifications, testé).
   */
  const { aVenir, passees } = repartirPlanifications(plans, state.valises);
  /** Ce que les cartes du hub rappellent : les tenues et les valises à venir, dans l'ordre des dates. */
  const tenuesAVenir = aVenir.flatMap((p) => (p.type === "tenue" ? [p.tenue] : []));
  const valisesAVenir = aVenir.flatMap((p) => (p.type === "valise" ? [p.valise] : []));
  const nbPlanifications = plans.length + state.valises.length;
  /**
   * Onglets À venir / Passées — un seul rendu, partagé par le hub et la liste
   * complète. Depuis le 30/09/2026, le composant d'onglets de l'app
   * (SegmentedControl, celui du Dressing, de la Valise et de Mes looks) : les
   * onglets de Planifier étaient les seuls à avoir leur propre dessin.
   */
  const ongletsPlans = (
    <SegmentedControl
      ariaLabel="Looks à venir ou passés"
      segments={[
        { key: "up", label: `À venir${aVenir.length ? ` (${aVenir.length})` : ""}` },
        { key: "past", label: "Passées" },
      ]}
      actif={onglet}
      onChange={setOnglet}
    />
  );

  /**
   * Une ligne d'une liste de planifications — valise ou tenue —, la même pour les « looks passés » du hub et pour tout
   * endroit qui les rappelle. L'image EST la tenue planifiée : ses pièces enregistrées, jamais un visuel générique.
   */
  const ligneDePlan = (pl: (typeof aVenir)[number], passee: boolean) => {
    if (pl.type === "valise")
      return <LigneValise key={"valise-" + pl.valise.id} v={pl.valise} dressing={state.items} passee={passee} onClick={() => void actions.ouvrirValise(pl.valise.id)} />;
    const t = pl.tenue;
    const d = new Date(`${t.jour}T12:00:00`);
    const apercu = piecesDuPlan(t).slice(0, 4);
    return (
      <button
        key={t.id}
        onClick={() => {
          setPlanOuvert(t);
          setRetourDetail("intro");
          setVue("detail");
        }}
        className="w-full flex items-center gap-3 bg-card border border-border rounded-carte p-[10px] text-left cursor-pointer"
        style={{ opacity: passee ? 0.78 : 1 }}
      >
        <span className="w-[64px] h-[64px] flex-shrink-0 rounded-bloc bg-warm-bg grid grid-cols-2 gap-[2px] p-[4px] overflow-hidden">
          {apercu.map((p) => {
            const img = resolveItemImage(p);
            return img.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.id} src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
            ) : (
              <span key={p.id} className="block w-full h-full rounded-[4px]" style={{ background: p.hex }} />
            );
          })}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block t-label text-terracotta">Look planifié</span>
          <span className="block t-titre-vignette text-ink mt-[2px]">{occasionShortLabel(t.occasion)}</span>
          <span className="block text-[12px] text-muted mt-[3px] truncate">
            {DOW[d.getDay()]}. {d.getDate()} {MOIS[d.getMonth()]}
            {villeDuLieu(t.lieu) ? ` · ${villeDuLieu(t.lieu)}` : ` · ${t.moment}`}
          </span>
        </span>
        <span aria-hidden="true" className="text-muted text-[15px] flex-shrink-0 pr-1">›</span>
      </button>
    );
  };

  /**
   * « Garder cette tenue ». L'écriture précède l'affichage : la liste n'est
   * mise à jour qu'une fois la ligne confirmée par la base, jamais avant
   * (même précaution que saveItem). En cas d'échec on le dit — une tenue qu'on
   * croit gardée et qui a disparu au rechargement coûte plus qu'un message.
   */
  const garder = async () => {
    if (!userId || !occ || jour == null || !moment || sansTenue) return;
    setEnregistrement(true);
    try {
      const ligne = await upsertTenuePlanifiee(userId, {
        jour: jourLocal(dansNJours(jour)),
        moment,
        occasion: occ,
        sousChoix: sousChoix ? String(sousChoix.courant) : null,
        lieu: lieu.trim(),
        typeLieu,
        // Une composition imposée vient du dressing réel — sauf une tenue
        // planifiée reprise, qui garde ce qu'elle était.
        dressingSeul: composition ? (depuisPlan ? depuisPlan.plan.dressingSeul : true) : dressingSeul,
        pieceIds: composition ?? tenue!.ids,
        temp: meteoMoment ? meteoMoment.temp : null,
        weatherLabel: meteoMoment ? meteoMoment.label : null,
      });
      setPlans((l) => [...l.filter((x) => x.id !== ligne.id), ligne]);
      // Remplacement : l'ancienne ligne n'est retirée qu'une fois la nouvelle
      // confirmée par la base. Même créneau : l'upsert l'a déjà écrasée.
      const ancien = depuisPlan?.remplacer && depuisPlan.plan.id !== ligne.id ? depuisPlan.plan : null;
      let ancienRetire = true;
      if (ancien) {
        try {
          await deleteTenuePlanifiee(ancien.id);
          setPlans((l) => l.filter((x) => x.id !== ancien.id));
        } catch {
          ancienRetire = false;
        }
      }
      setDepuisPlan(null);
      setVue("liste");
      setOnglet("up");
      flash(
        !ancienRetire
          ? "La nouvelle date est gardée. L'ancienne n'a pas pu être retirée : supprime-la depuis ta liste."
          : "C'est noté. Ton look t'attendra jusqu'au jour J."
      );
    } catch {
      flash("L'enregistrement a échoué. Réessaie.");
    } finally {
      setEnregistrement(false);
    }
  };

  const retirer = async (id: string) => {
    const avant = plans;
    setPlans((l) => l.filter((x) => x.id !== id));
    try {
      await deleteTenuePlanifiee(id);
      flash("Look retiré");
    } catch {
      // Remise en place : la ligne est toujours en base, la masquer mentirait.
      setPlans(() => avant);
      flash("La suppression a échoué. Réessaie.");
    }
  };

  const recommencer = () => {
    setComposition(null);
    setDepuisPlan(null);
    setVue("etape");
    setEtape(1);
    setOcc(null);
    setJour(null);
    setMoment(null);
    setLieu("");
    setVille(null);
    setSuggestions(null);
    setTypeLieu(null);
    setDressingSeul(false);
    setPrevision(null);
    setPrevisionEtat("vide");
  };

  /**
   * ROUVRIR LE PARCOURS SUR UNE TENUE PLANIFIÉE, PRÉ-REMPLI (30/09/2026) : ce
   * qui avait été choisi, date comprise quand elle est encore proposée
   * (demain à J+21). Repartir de zéro obligerait à ressaisir ce qu'on vient
   * de lire à l'écran.
   *   · « modifier » — le moteur recompose, la nouvelle tenue remplace l'ancienne ;
   *   · « deplacer » — la même tenue, à une autre date ou un autre moment ;
   *   · « dupliquer » — la même tenue, planifiée une seconde fois.
   * Les deux derniers reprennent le mécanisme de la composition imposée
   * (tenue d'un avis de styliste) : pas de nouveau tirage, la tenue est gardée.
   */
  const repartirDuPlan = (t: TenuePlanifiee, mode: "modifier" | "deplacer" | "dupliquer") => {
    setOcc(t.occasion);
    if (t.occasion === "travail_formel" && WORK_MODES.includes(t.sousChoix as WorkMode)) setWorkMode(t.sousChoix as WorkMode);
    if (t.occasion === "date" && DATE_CONTEXTS.some(([c]) => c === t.sousChoix)) setDateContext(t.sousChoix as DateContext);
    const aujourdhui = new Date();
    aujourdhui.setHours(12, 0, 0, 0);
    const ecart = Math.round((new Date(`${t.jour}T12:00:00`).getTime() - aujourdhui.getTime()) / 86400000);
    // Déplacer ou dupliquer : c'est justement la date qui va changer, on la laisse à choisir.
    setJour(mode === "modifier" && ecart >= 1 && ecart <= JOURS_PROPOSES ? ecart : null);
    setMoment(mode === "modifier" ? t.moment : null);
    setLieu(t.lieu);
    setVille(null);
    setSuggestions(null);
    setTypeLieu(t.typeLieu);
    setDressingSeul(t.dressingSeul);
    setPrevision(null);
    setPrevisionEtat("vide");
    setComposition(mode === "modifier" ? null : t.pieceIds);
    setDepuisPlan({ plan: t, remplacer: mode !== "dupliquer" });
    setPlanOuvert(null);
    setVue("etape");
    setEtape(mode === "modifier" ? 1 : 2);
  };

  const attend = previsionEtat === "encours";
  const etapeValide = etape === 1 ? !!occ : etape === 2 ? jour != null && !!moment : !!lieu.trim();

  /**
   * REMONTER EN HAUT À CHAQUE CHANGEMENT D'ÉTAPE (recette 24/09/2026).
   *
   * `window.scrollTo` ne ferait rien ici : la page ne défile pas. C'est le
   * conteneur `.scrollarea` qui porte le défilement — l'écran est en
   * `absolute inset-0` avec un en-tête et une barre d'action fixes. On remet
   * donc à zéro CE conteneur, pas la fenêtre.
   *
   * La vue est dans les dépendances autant que l'étape : passer au résultat
   * puis revenir aux étapes doit aussi repartir du haut, sinon on retrouve le
   * parcours à la position où on l'avait laissé, fil d'étapes hors champ.
   *
   * `auto` et non `smooth` : un défilement animé sur un contenu qui vient
   * d'être remplacé montre le nouvel écran en train de glisser, ce qui se lit
   * comme un bug plutôt que comme une transition.
   */
  const zoneScroll = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    zoneScroll.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [etape, vue]);

  /*
   * OUVERT DEPUIS L'ACCUEIL OU TENUE (27/09/2026) sur un plan ou sur une date :
   * revenir de cette entrée ramène à l'écran d'origine, pas au hub qu'on n'a
   * jamais vu. Dès que le hub s'affiche, on est « dans » Planifier et ce
   * retour ne vaut plus.
   */
  useEffect(() => {
    if (vue === "intro" && state.planRetour) actions.oublierPlanRetour();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vue]);

  const retourExterne =
    state.planRetour != null &&
    ((vue === "detail" && retourDetail === "intro") || vue === "liste" || (vue === "etape" && etape === 1));

  const revenir = () => {
    if (retourExterne) {
      actions.quitterPlanifier();
      return;
    }
    if (vue === "detail") {
      setPlanOuvert(null);
      setVue(retourDetail);
    } else if (vue === "etape" && depuisPlan && etape === (composition ? 2 : 1)) {
      // Parcours ouvert depuis le détail d'un plan : le retour y ramène.
      setPlanOuvert(depuisPlan.plan);
      setDepuisPlan(null);
      setComposition(null);
      setVue("detail");
    } else if (vue === "liste") setVue("intro");
    else if (vue === "resultat") setVue("etape");
    else if (vue === "etape" && etape > 1) setEtape(etape - 1);
    else if (vue === "etape") setVue("intro");
    else actions.goHome();
  };

  /**
   * TROIS ÉTAPES, PLUS QUATRE — mesuré, pas ressenti.
   *
   * L'étape 4 posait une seule question, « Uniquement mon dressing ». Ce
   * n'était pas un écran maigre à étoffer : c'est tout ce que le moteur
   * accepte ici. `generateOutfitWithFallback(pool, météo, occasion, workMode,
   * dateContext, couleurs, genre)` — les couleurs viennent du profil, le
   * genre du profil, la météo du lieu et de la date, l'occasion et son
   * sous-choix de l'étape 1. Le palier de formalité, lui, n'est manipulable
   * que par `formalityOverride`, interne à `attemptCoreOutfit` qui n'est pas
   * exporté. Il ne restait donc qu'un levier : le POOL.
   *
   * Et un levier qui agit instantanément sur une tenue déjà affichée n'est
   * pas une question à poser avant : c'est un réglage à offrir après. Il est
   * descendu sur l'écran résultat, où il change la proposition sous les yeux
   * au lieu de se choisir à l'aveugle.
   *
   * Les descriptions des étapes 2 et 3 disaient « elle n'entre pas encore
   * dans la composition » et « le lieu n'affine pas encore la tenue ». C'était
   * vrai au lot 1. Depuis le lot 2, la date fixe la saison de composition
   * (`saisonCalendairePour`) et le lieu fixe la prévision : les deux phrases
   * étaient devenues fausses, ce qui est pire qu'inutile.
   */
  const ETAPES: Record<number, [string, string, string, string]> = {
    1: ["Étape 1 sur 3", "Quelle est", "l'occasion ?", "Choisis ce qui est prévu ce jour-là."],
    2: ["Étape 2 sur 3", "Pour", "quand ?", "La date fixe la saison de la tenue."],
    // Le type de lieu n'entre PAS dans le moteur (cf. TYPES_LIEU_PAR_OCCASION) :
    // écrire « le lieu affine la tenue » serait faux. Il précise l'occasion.
    3: [
      "Étape 3 sur 3",
      "Où",
      "seras-tu ?",
      typesLieuProposes.length > 0
        ? "La ville nous aide pour la météo. Le type de lieu précise ton occasion."
        : "La ville nous aide pour la météo.",
    ],
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 px-6 pt-[6px]">
        {/* LE BANDEAU COMMUN, AVATAR COMPRIS (brief du 25/09, point 8). Le hub
            est une page de premier niveau, ouverte depuis la barre de
            navigation : pas de retour, comme Dressing ou Journal. Les vues
            suivantes gardent le chevron, qui remonte le parcours. */}
        <AppHeader
          onBack={vue === "intro" ? undefined : revenir}
          backLabel={
            retourExterne
              ? state.planRetour === "tenues"
                ? "Revenir à ta tenue"
                : "Revenir à l'accueil"
              : vue === "liste" || (vue === "detail" && retourDetail === "intro")
                ? "Revenir à Planifier"
                : "Revenir à l'étape précédente"
          }
        />
      </div>

      {/* Le fil de l'onboarding, repris tel quel (24/09/2026, demandé). Il
          portait ici quatre barres pleine largeur, écrites sans regarder
          l'existant. Centré et non aligné à gauche : dans l'onboarding il
          l'est entre le retour et sa gouttière miroir, et le bandeau de cet
          écran centre déjà le logo juste au-dessus. */}
      {vue === "etape" && (
        <div className="flex-shrink-0 flex justify-center px-6 pb-[2px]">
          <FilEtapes total={3} courante={etape - 1} />
        </div>
      )}

      <div ref={zoneScroll} className={"scrollarea flex-1 min-h-0 overflow-y-auto px-6 pt-4 " + (vue === "intro" || vue === "detail" ? "pb-safe-nav" : "pb-5")}>
        {/* LE HUB « PLANIFIER » — brief « Page Planifier, design + UX »
            (transmis le 25/09/2026, source de vérité). Trois questions dans
            l'ordre du brief : que puis-je planifier, comment commencer,
            qu'ai-je déjà planifié. La promesse d'abord, puis les deux
            parcours, puis les planifications. */}
        {vue === "intro" && (
          <>
            <Surtitre>Planifier</Surtitre>
            <TitreEtape a="Anticipe tes moments." b="Capsela s'occupe du look" />
            <div className="t-chapeau text-muted-3 mt-[10px]" style={{ textWrap: "pretty" }}>
              Des tenues pensées pour tes occasions et tes voyages, selon ton style, la météo et ton dressing.
            </div>

            {/* LES DEUX VISUELS ÉDITORIAUX sont ceux d'avant (recette du 26/09/2026, fournis par la propriétaire) : une tenue
                pour « Planifier une tenue », la valise ouverte pour « Préparer ma valise » — les deux pour un profil femme,
                la valise et la tenue pour un profil homme. Sans genre renseigné, pas de visuel choisi au hasard : la
                carte garde sa forme d'avant, glyphe seul. Ils inspirent et expliquent ; les pièces réelles de la personne
                n'apparaissent que dans ce qu'elle a déjà créé, sous le bouton de création. */}
            <div className="flex flex-col gap-4 mt-5">
              <CartePlanifier
                glyphe={G_CINTRE}
                titre={["Planifier", "une tenue"]}
                accroche="Le bon look, au bon moment."
                description="Pour un dîner, un rendez-vous, une cérémonie ou toute occasion particulière."
                ligne="Occasion · date et lieu · tenue personnalisée"
                cta={tenuesAVenir.length > 0 ? "Planifier une nouvelle tenue" : "Planifier une tenue"}
                onClick={recommencer}
                visuel={
                  profile.gender === "femme"
                    ? "/editorial/capsela_planifier_tenue_femme.webp"
                    : profile.gender === "homme"
                      ? "/editorial/capsela_planifier_tenue_homme.webp"
                      : undefined
                }
              >
                {/* Ce qui existe déjà : trois au plus, « Voir tout » ouvre la liste complète. Le premier est le prochain. */}
                {tenuesAVenir.length > 0 && (
                  <>
                    <EnteteExistant
                      titre="Tes tenues planifiées"
                      nombre={tenuesAVenir.length}
                      onVoirTout={() => {
                        setOnglet("up");
                        setVue("liste");
                      }}
                    />
                    <div className="flex flex-col">
                      {tenuesAVenir.slice(0, 3).map((t, i) => {
                        const d = new Date(`${t.jour}T12:00:00`);
                        return (
                          <button
                            key={t.id}
                            onClick={() => {
                              setPlanOuvert(t);
                              setRetourDetail("intro");
                              setVue("detail");
                            }}
                            className="flex items-center gap-3 py-[8px] text-left cursor-pointer min-h-[56px] transition-opacity active:opacity-70"
                          >
                            <span className="w-[44px] h-[44px] flex-shrink-0 rounded-champ bg-warm-bg grid grid-cols-2 gap-[2px] p-[3px] overflow-hidden">
                              {piecesDuPlan(t)
                                .slice(0, 4)
                                .map((p) => {
                                  const img = resolveItemImage(p);
                                  return img.url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={p.id} src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
                                  ) : (
                                    <span key={p.id} className="block w-full h-full rounded-[3px]" style={{ background: p.hex }} />
                                  );
                                })}
                            </span>
                            <span className="flex-1 min-w-0">
                              {i === 0 && <span className="block t-label text-terracotta">Ton prochain look</span>}
                              <span className="block t-titre-vignette text-ink">{occasionShortLabel(t.occasion)}</span>
                              <span className="block text-[12px] text-muted mt-[2px] truncate">
                                {DOW[d.getDay()]}. {d.getDate()} {MOIS[d.getMonth()]}
                                {villeDuLieu(t.lieu) ? ` · ${villeDuLieu(t.lieu)}` : ""}
                              </span>
                            </span>
                            <span aria-hidden="true" className="text-muted text-[15px] flex-shrink-0">›</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CartePlanifier>

              {/* Le parcours valise existe depuis le 27/09/2026 : même règle d'accès que l'accueil (PREPARER_VALISE, dans le
                  store), et le retour ramène ici. */}
              <CartePlanifier
                glyphe={G_VALISE}
                titre={["Préparer", "ma valise"]}
                accroche="Tous tes looks pour ton séjour."
                description="Destination, météo, activités et dressing : Capsela prépare une sélection pensée pour ton voyage."
                ligne="Destination · dates · météo · activités"
                cta={valisesAVenir.length > 0 ? "Préparer une nouvelle valise" : "Préparer ma valise"}
                onClick={() => void actions.ouvrirValise(null)}
                visuel={
                  profile.gender === "femme"
                    ? "/editorial/capsela_planifier_valise_femme.webp"
                    : profile.gender === "homme"
                      ? "/editorial/capsela_planifier_valise_homme.webp"
                      : undefined
                }
                cadrage="center 60%"
              >
                {valisesAVenir.length > 0 && (
                  <>
                    <EnteteExistant
                      titre="Tes valises"
                      nombre={valisesAVenir.length}
                      onVoirTout={() => {
                        setOnglet("up");
                        setVue("liste");
                      }}
                    />
                    <div className="flex flex-col">
                      {valisesAVenir.slice(0, 2).map((v, i) => {
                        const a = new Date(`${v.depart}T12:00:00`);
                        const b = new Date(`${v.retour}T12:00:00`);
                        const nbLooks = v.looks.filter((l) => l.ids.every((id) => state.items.some((it) => it.id === id))).length;
                        const nbPieces = v.pieceIds.filter((id) => state.items.some((it) => it.id === id)).length;
                        return (
                          <button
                            key={v.id}
                            onClick={() => void actions.ouvrirValise(v.id)}
                            className="flex items-center gap-3 py-[8px] text-left cursor-pointer min-h-[56px] transition-opacity active:opacity-70"
                          >
                            <MiniatureValise v={v} dressing={state.items} taille={44} />
                            <span className="flex-1 min-w-0">
                              {i === 0 && <span className="block t-label text-terracotta">Ton prochain départ</span>}
                              <span className="block t-titre-vignette text-ink truncate">{v.destination}</span>
                              <span className="block text-[12px] text-muted mt-[2px] truncate">
                                {v.depart === v.retour
                                  ? `${a.getDate()} ${MOIS[a.getMonth()]}`
                                  : a.getMonth() === b.getMonth()
                                    ? `${a.getDate()} → ${b.getDate()} ${MOIS[b.getMonth()]}`
                                    : `${a.getDate()} ${MOIS[a.getMonth()]} → ${b.getDate()} ${MOIS[b.getMonth()]}`}
                                {nbPieces ? ` · ${nbPieces} ${nbPieces > 1 ? "pièces" : "pièce"}` : ""}
                                {nbLooks ? ` · ${nbLooks} ${nbLooks > 1 ? "looks" : "look"}` : ""}
                              </span>
                            </span>
                            <span aria-hidden="true" className="text-muted text-[15px] flex-shrink-0">›</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </CartePlanifier>
            </div>

            {/* TES PROCHAINS LOOKS : les prochains sont déjà dans les cartes ci-dessus — ne pas les répéter. Ici, sans
                rien de créé, une phrase ; sinon, ce qui est passé (priorité 4), deux au plus. */}
            {nbPlanifications === 0 ? (
              <div className="mt-[30px]">
                <Surtitre>Tes prochains looks</Surtitre>
                <div className="text-[13px] text-muted leading-[1.5] mt-2">Tes prochains looks apparaîtront ici.</div>
              </div>
            ) : (
              passees.length > 0 && (
                <div className="mt-[30px]">
                  <div className="flex items-center justify-between gap-3">
                    <Surtitre>Tes looks passés</Surtitre>
                    <button
                      onClick={() => {
                        setOnglet("past");
                        setVue("liste");
                      }}
                      className="text-[12px] text-terracotta cursor-pointer min-h-[44px] -my-[12px] flex items-center"
                    >
                      Voir tout →
                    </button>
                  </div>
                  <div className="flex flex-col gap-[10px] mt-3">{passees.slice(0, 2).map((pl) => ligneDePlan(pl, true))}</div>
                </div>
              )
            )}
          </>
        )}

        {vue === "etape" && (
          <>
            <Surtitre>{ETAPES[etape][0]}</Surtitre>
            <TitreEtape a={ETAPES[etape][1]} b={ETAPES[etape][2]} />
            <div className="t-chapeau text-muted mt-[6px]" style={{ textWrap: "pretty" }}>
              {ETAPES[etape][3]}
            </div>
            {/* Venue d'un avis de styliste : la tenue est déjà faite, il ne
                reste qu'à dire pour quoi, quand et où. */}
            {composition && pieces.length > 0 && (
              <div className="mt-[12px] inline-flex items-center gap-[8px] bg-warm-bg border border-warm-border rounded-full px-[12px] py-[6px] text-[12px] text-ink">
                <span aria-hidden="true" className="text-terracotta">
                  ✓
                </span>
                {depuisPlan ? "Ta tenue planifiée est gardée" : "La tenue de ta photo est gardée"} · {pieces.length} pièce
                {pieces.length > 1 ? "s" : ""}
              </div>
            )}

            {etape === 1 && (
              /* LA MAQUETTE DU 24/09. Elle reprend les LIGNES de la feuille
                 d'occasion de l'écran Tenue — glyphe, libellé, description,
                 marque de sélection, filets de séparation — mais posées à
                 plat sur la page au lieu d'être dans une feuille.
                 C'est le sens de « plus en lien avec la page Tenues » : ce
                 sont ses lignes, ses glyphes, son vocabulaire.

                 Ce que ce motif règle, et que ni la liste d'hier ni les chips
                 de ce matin ne réglaient : LE SOUS-CHOIX EST DANS LA LIGNE
                 SÉLECTIONNÉE. Il naît donc là où l'on vient de toucher,
                 forcément à l'écran — le défaut mesuré le 23/09 (question
                 obligatoire née 218 px sous le pli) ne peut plus se produire,
                 sans mise en vue ni artifice. */
              <div className="mt-5">
                {OCCASIONS.map(([key, label, desc]) => {
                  const actif = occ === key;
                  const avecSousChoix = actif && !!sousChoix;
                  return (
                    <div
                      key={key}
                      /* La ligne active devient un panneau teinté qui ENGLOBE
                         son sous-choix : c'est ce qui dit que les deux vont
                         ensemble. Les autres restent des lignes nues séparées
                         par un filet, comme dans la feuille de Tenue. */
                      /* SANS EXPANSION (brief du 25/09, point 4). La teinte
                         déborde dans la gouttière (-mx-3 px-3) au lieu de
                         repousser le contenu, et la ligne garde son filet
                         (transparent) : même hauteur, même alignement que les
                         autres. Seul le sous-choix, quand il existe, ajoute
                         de la hauteur — c'est du contenu, pas du rembourrage. */
                      className={
                        "border-b last:border-b-0 " +
                        (actif ? "rounded-bloc bg-warm-bg -mx-3 px-3 border-transparent" : "border-divider")
                      }
                    >
                      <button
                        onClick={() => {
                          setOcc(key);
                          /* Le type de lieu déjà choisi ne survit pas à un
                             changement d'occasion qui ne le propose plus —
                             sinon `planned_outfits.type_lieu` recevrait un
                             « Bar / Rooftop » sur un Voyage, choisi puis
                             devenu invisible. Remis à zéro ici, à l'endroit
                             où la décision se prend, plutôt que rattrapé
                             après coup dans un effet. */
                          const permis = TYPES_LIEU_PAR_OCCASION[key];
                          if (!permis || !permis.includes(typeLieu ?? "")) setTypeLieu(null);
                        }}
                        aria-pressed={actif}
                        className="flex items-center gap-3 w-full text-left px-1 py-[10px] cursor-pointer"
                        style={{ minHeight: 52 }}
                      >
                        <span className={"flex-shrink-0 " + (actif ? "text-terracotta" : "text-muted")}>
                          <GlypheOccasion occasion={key} taille={19} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className={"block text-[13px] " + (actif ? "text-terracotta" : "text-ink")}>{label}</span>
                          <span className="block text-[11px] text-muted mt-[2px]">{desc}</span>
                        </span>
                        {/* Pastille pleine à la sélection plutôt que la coche
                            nue de la feuille : hors feuille, une coche seule
                            se lit mal au milieu d'une liste longue. */}
                        <span
                          aria-hidden="true"
                          className="w-[22px] h-[22px] flex-shrink-0 rounded-full flex items-center justify-center"
                          style={{
                            border: actif ? "none" : "1.5px solid var(--color-cream-dark-soft)",
                            background: actif ? "var(--color-terracotta)" : "transparent",
                            color: "var(--color-cream)",
                          }}
                        >
                          {actif && (
                            <svg width="12" height="12" viewBox="0 0 24 24" style={{ display: "block" }}>
                              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                      </button>

                      {avecSousChoix && (
                        <div className="pb-3 pt-1" style={{ borderTop: "1px solid var(--color-warm-border)" }}>
                          <div className="text-[12px] text-ink mt-2 px-1">{sousChoix.titre}</div>
                          <div className="flex flex-wrap gap-2 mt-2 px-1">
                            {sousChoix.valeurs.map((v) => {
                              const on = sousChoix.courant === v;
                              return (
                                <button
                                  key={v}
                                  onClick={() => sousChoix.choisir(v)}
                                  aria-pressed={on}
                                  className={
                                    "inline-flex items-center gap-[7px] rounded-full px-[14px] text-[12px] cursor-pointer border transition-colors " +
                                    (on
                                      ? "bg-terracotta border-terracotta text-cream"
                                      : "bg-card border-sand-border text-muted-3")
                                  }
                                  style={{ minHeight: 44 }}
                                >
                                  <GlypheSousChoix valeur={v} taille={16} />
                                  <span className="whitespace-nowrap">{v}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {etape === 2 && (
              <>
                {/* LES 21 JOURS RESTENT PROPOSÉS, MAIS LA BANDE DIT OÙ S'ARRÊTE
                    LA PRÉVISION. Les retirer serait une autre erreur : on peut
                    parfaitement préparer une tenue pour dans trois semaines, la
                    saison et l'occasion suffisent. Ce qu'il ne faut pas, c'est
                    laisser croire que la météo du jour J est connue. D'où le
                    filet après le dernier jour couvert, la teinte plus discrète
                    au-delà, le nom accessible qui le dit, et la légende. */}
                {/* DEUX GROUPES NOMMÉS (brief du 25/09, point 3) : « Météo
                    prévue » au-dessus des jours que la prévision couvre,
                    « Saison uniquement » au-dessus des autres. Le filet et la
                    teinte ne suffisaient pas à dire lesquels ; le nom le dit. */}
                <div className="scrollarea flex gap-[7px] overflow-x-auto mt-4 -mx-6 px-6 items-end">
                  {([
                    ["Météo prévue", 1, HORIZON_PREVISION_JOURS],
                    // « Sans prévision » : au-delà de l'horizon, pas de météo
                    // du jour J — le moteur reçoit la saison de la date et la
                    // température d'aujourd'hui (meteoUtilisee).
                    ["Sans prévision", HORIZON_PREVISION_JOURS + 1, JOURS_PROPOSES],
                  ] as const).map(([titreGroupe, de, a], g) => (
                    <div key={titreGroupe} className="flex-shrink-0 flex gap-[7px]">
                      {g > 0 && (
                        <span
                          aria-hidden="true"
                          className="flex-shrink-0 self-stretch"
                          style={{ width: 1, background: "var(--color-sand-border)" }}
                        />
                      )}
                      <div className="flex-shrink-0">
                        <div
                          className={
                            "t-pastille mb-[6px] whitespace-nowrap " + (g === 0 ? "text-terracotta" : "text-muted")
                          }
                        >
                          {titreGroupe}
                        </div>
                        <div className="flex gap-[7px]">
                          {Array.from({ length: a - de + 1 }, (_, i) => de + i).map((n) => {
                          const d = dansNJours(n);
                          const on = jour === n;
                          const couvert = n <= HORIZON_PREVISION_JOURS;
                          const bouton = (
                            <button
                              key={n}
                              onClick={() => setJour(n)}
                              aria-pressed={on}
                              aria-label={
                                `${DOW_LONG[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}` +
                                (couvert ? "" : " — au-delà de la prévision météo")
                              }
                              className={
                                "flex-shrink-0 w-[54px] rounded-tuile py-[7px] cursor-pointer border transition-colors " +
                                (on ? "bg-terracotta-deep border-terracotta-deep" : "bg-card border-border")
                              }
                              style={{ minHeight: 66 }}
                            >
                              <span className={"block t-pastille " + (on ? "text-cream" : "text-muted")}>
                                {DOW[d.getDay()]}
                              </span>
                              <span
                                className={
                                  "block font-serif text-[18px] mt-[2px] " +
                                  (on ? "text-cream" : couvert ? "text-ink" : "text-muted-3")
                                }
                              >
                                {d.getDate()}
                              </span>
                              <span className={"block text-[9px] " + (on ? "text-cream" : "text-muted")}>
                                {MOIS[d.getMonth()]}
                              </span>
                            </button>
                          );
                            return bouton;
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-muted leading-[1.45] mt-[9px]" style={{ textWrap: "pretty" }}>
                  {jour != null && jour > HORIZON_PREVISION_JOURS
                    ? `Pas de prévision météo si loin : elle couvre ${HORIZON_PREVISION_JOURS} jours. La tenue suivra la saison de cette date, sans la météo du jour J.`
                    : `La prévision météo couvre les ${HORIZON_PREVISION_JOURS} prochains jours. Au-delà, la tenue suit la saison de la date, sans météo du jour J.`}
                </div>
                <div className="mt-5">
                  <Surtitre>À quel moment ?</Surtitre>
                </div>
                <div className="flex flex-col gap-[7px] mt-3">
                  {MOMENTS.map(([m, d]) => (
                    <LigneChoix key={m} actif={moment === m} titre={m} sousTitre={d} onClick={() => setMoment(m)} />
                  ))}
                </div>
              </>
            )}

            {etape === 3 && (
              <>
                <Card rayon="bloc" className="flex items-center gap-[10px] mt-4 px-[14px]" style={{ minHeight: 48 }}>
                  <span aria-hidden="true" className="flex-shrink-0 text-placeholder">
                    <Glyphe taille={17}>{G_LOUPE}</Glyphe>
                  </span>
                  <input
                    className="capin flex-1 min-w-0 bg-transparent border-none text-[13px] font-medium text-ink"
                    value={lieu}
                    onChange={(e) => {
                      setLieu(e.target.value);
                      // Retaper invalide le point choisi : sans ça, corriger
                      // « Paris » en « Parme » enverrait toujours Paris.
                      setVille(null);
                    }}
                    placeholder="Rechercher une ville"
                    aria-label="Ville du rendez-vous"
                    autoComplete="off"
                    autoCapitalize="words"
                  />
                </Card>
                {/* Les suggestions ne s'affichent QUE si l'autocomplétion a
                    répondu quelque chose. `null` (mode démo, réseau, fonction
                    Edge pas encore redéployée) ne montre rien du tout : la
                    saisie libre reste entièrement valable, elle est seulement
                    moins précise. Rien n'est jamais bloqué par l'absence de
                    suggestion. */}
                {suggestionsVisibles.length > 0 && (
                  <Card rayon="bloc" className="flex flex-col mt-2 overflow-hidden">
                    {suggestionsVisibles.map((v) => (
                      <button
                        key={`${v.lat},${v.lon}`}
                        onClick={() => {
                          setVille(v);
                          setLieu(libelleVille(v));
                          setSuggestions([]);
                        }}
                        className="flex items-center gap-[10px] text-left px-[14px] cursor-pointer border-b border-divider last:border-b-0"
                        style={{ minHeight: 46 }}
                      >
                        <span aria-hidden="true" className="flex-shrink-0 text-muted">
                          <Glyphe taille={15}>{G_EPINGLE}</Glyphe>
                        </span>
                        <span className="flex-1 min-w-0 text-[13px] text-ink truncate">{libelleVille(v)}</span>
                      </button>
                    ))}
                  </Card>
                )}
                {ville && (
                  <div className="text-[11px] text-muted mt-2">
                    Ville choisie : {ville.name}
                  </div>
                )}
                {/* Le type de lieu ne s'affiche que pour les occasions où il
                    veut dire quelque chose (cf. TYPES_LIEU_PAR_OCCASION).
                    Pour les autres, l'étape se réduit à la ville — ce qui est
                    exactement ce qu'elle a à demander. */}
                {typesLieuProposes.length > 0 && (
                  <>
                    {/* UNE PRÉCISION DE L'OCCASION, PAS UNE NOUVELLE QUESTION
                        (brief du 25/09, point 2) : la ligne sous le surtitre
                        rattache le choix à l'occasion déjà donnée. */}
                    <div className="mt-6">
                      <Surtitre>Type de lieu · facultatif</Surtitre>
                      <div className="text-[12px] text-muted leading-[1.45] mt-[4px]">
                        Pour ton occasion « {occLabel} », si tu veux la préciser.
                      </div>
                    </div>
                    <div className="flex flex-col gap-[7px] mt-3">
                      {typesLieuProposes.map(([t, d]) => (
                        <LigneChoix
                          key={t}
                          actif={typeLieu === t}
                          titre={t}
                          sousTitre={d || undefined}
                          onClick={() => setTypeLieu(typeLieu === t ? null : t)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            )}

            {/* L'encart météo commun aux trois étapes est retiré (recette du
                26/09/2026) : il affichait « Indique la ville… » dès l'étape
                Occasion et redoublait la légende des dates et le sous-titre du
                lieu. Chaque étape pose une question ; la météo n'en est pas
                une. Elle est dite une fois par étape où elle compte (légende
                des dates, sous-titre du lieu), puis dans « Pourquoi ce look ? ». */}
          </>
        )}

        {vue === "resultat" && tenue && (
          <>
            {/* 9,5 px / .1em : la forme des deux autres pastilles terracotta de
                l'app (accueil, Valise). Le 10 px d'ici était un troisième
                réglage pour le même objet. */}
            <Badge>
              {occLong}
            </Badge>
            <TitreEtape a={occLabel} b={villeAffichee ? `· ${villeAffichee}` : ""} />
            <div className="text-[12px] text-muted mt-[6px]">
              {dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)}
              {moment ? ` · ${moment}` : ""}
              {typeLieu ? ` · ${typeLieu}` : ""}
            </div>

            {sansTenue ? (
              <EmptyState
                forme="carte"
                className="mt-[14px]"
                titre={emptyStateCopy(tenue?.reason ?? "no_match", dressingSeul ? "ton dressing" : "ton dressing et ta capsule").title}
              >
                {emptyStateCopy(tenue?.reason ?? "no_match", dressingSeul ? "ton dressing" : "ton dressing et ta capsule").body}
              </EmptyState>
            ) : (
              <>
                <div className="mt-[14px] rounded-hero p-4" style={{ background: "var(--color-terracotta-deep)" }}>
                  <div className="flex items-center justify-between gap-[10px]">
                    <span className="t-label text-cream">Tenue préparée</span>
                    <span
                      className="text-[10px] text-cream rounded-full px-[11px] py-[5px] whitespace-nowrap"
                      style={{ background: "rgba(251,243,234,.2)" }}
                    >
                      {jour === 1 ? "Demain" : `Dans ${jour} jours`}
                    </span>
                  </div>
                  <div className="mt-3">
                    <OutfitComposition items={pieces} variant="hero" />
                  </div>
                </div>

                <Card className="mt-[14px] p-[15px]">
                  <div className="t-titre-carte text-ink">Pourquoi ce look ?</div>
                  <div className="flex flex-col gap-2 mt-[10px]">
                    {[
                      `${composition ? "Prévue" : "Pensée"} pour « ${occLong} »${occ === "travail_formel" ? ` · ${workMode}` : occ === "date" && dateContext ? ` · ${dateContext}` : ""}`,
                      phraseMeteo,
                      provenance,
                    ].map((r) => (
                      <div key={r} className="flex gap-[9px] items-start">
                        <span className="flex-shrink-0 text-terracotta-deep mt-[1px]">
                          <Glyphe taille={16}>{G_COCHE}</Glyphe>
                        </span>
                        <span className="text-[12px] text-muted-3 leading-[1.45]">{r}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* L'ANCIENNE ÉTAPE 4, DEVENUE UN RÉGLAGE. Ici il a un effet
                    immédiat et visible : le pool change, `tenue` se recalcule,
                    la composition au-dessus se refait. Posé avant la
                    génération, il demandait de deviner ce qu'on préférerait
                    sans avoir rien vu. */}
                {!composition && (
                <button
                  onClick={() => setDressingSeul(!dressingSeul)}
                  aria-pressed={dressingSeul}
                  className="w-full flex gap-3 items-center mt-[14px] bg-card border border-border rounded-carte p-[14px] cursor-pointer text-left"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-medium text-ink">Uniquement mon dressing</span>
                    <span className="block text-[11px] text-muted leading-[1.45] mt-[3px]">
                      Sans compléter avec des pièces de ta capsule.
                    </span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="w-11 h-[26px] flex-shrink-0 rounded-full p-[3px] flex transition-colors"
                    style={{
                      background: dressingSeul ? "var(--color-terracotta-deep)" : "var(--color-cream-dark-soft)",
                      justifyContent: dressingSeul ? "flex-end" : "flex-start",
                    }}
                  >
                    <span className="w-5 h-5 rounded-full bg-card" />
                  </span>
                </button>
                )}

                <div className="text-[12px] text-muted leading-[1.5] mt-[14px] text-center" style={{ textWrap: "pretty" }}>
                  {/* Avant l'enregistrement : une invitation, pas un constat —
                      « C'est noté » ne se dit qu'une fois la ligne écrite
                      (toast de garder()). Pas d'emoji : la DA n'en a pas. */}
                  Garde-la, elle t&apos;attendra dans ton planning jusqu&apos;au jour J.
                </div>
              </>
            )}
          </>
        )}

        {/* ══ DÉTAIL D'UNE TENUE PLANIFIÉE — refonte du 30/09/2026 ═════════
            LE DÉTAIL MONTRE LA TENUE GARDÉE, PAS UNE TENUE RECALCULÉE.
            Réutiliser la vue « resultat » aurait été plus court, mais elle
            rejoue le moteur : on aurait affiché une autre tenue que celle
            qu'elle a enregistrée, sous le titre de celle-ci.

            Chaque bloc a une fonction, et une information n'est dite qu'une
            fois : l'en-tête situe (occasion, ville, date, moment), le hero
            montre la tenue, le contexte explique pourquoi elle, l'avis de
            styliste propose un regard expert, les actions disent quoi faire
            maintenant. */}
        {vue === "detail" && planOuvert && (() => {
          const t = planOuvert;
          const d = new Date(`${t.jour}T12:00:00`);
          const pieces = piecesDuPlan(t);
          const manquantes = t.pieceIds.length - pieces.length;
          const villePlan = villeDuLieu(t.lieu);
          const passee = t.jour < jourLocal(new Date());
          const jourLong = `${DOW_LONG[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
          const dansMesLooks = state.savedLooks.some((l) => memeTenue(l.pieceIds, t.pieceIds));
          // Le texte éditorial du hero : la même phrase que la carte « Look du
          // jour » de l'accueil (titreLookDuJour), nourrie du sous-choix
          // enregistré — « ta journée en télétravail », « ton dîner »…
          // occasionPhrase ne fait que comparer : un sous-choix d'une autre
          // occasion (ou absent) retombe sur la phrase générale de l'occasion.
          const phrase = titreLookDuJour(t.occasion, (t.sousChoix ?? "") as WorkMode, (t.sousChoix ?? "") as DateContext);
          // Occasion, précision, type de lieu, température : seulement ce qui
          // a été enregistré. La ville est dans le titre, la date au-dessus.
          const tempAffichee = meteoPlanVive && planOuvert?.id === t.id ? meteoPlanVive.temp : t.temp;
          return (
            <>
              {/* INTRODUCTION — type d'écran, occasion et ville, puis date et
                  moment sur une ligne légère, avec leurs icônes. */}
              <Surtitre>Look planifié</Surtitre>
              <TitreEtape a={occasionShortLabel(t.occasion)} b={villePlan ? `· ${villePlan}` : ""} />
              <div className="flex items-center flex-wrap gap-x-[10px] gap-y-[4px] text-[12px] text-muted-3 mt-[9px]">
                <span className="inline-flex items-center gap-[6px]">
                  <span className="text-terracotta">
                    <Glyphe taille={15}>{G_CALENDRIER}</Glyphe>
                  </span>
                  {jourLong.charAt(0).toUpperCase() + jourLong.slice(1)}
                </span>
                <span aria-hidden="true" className="w-px h-[12px] bg-border" />
                <span className="inline-flex items-center gap-[6px]">
                  <span className="text-terracotta">
                    <Glyphe taille={15}>{G_HORLOGE}</Glyphe>
                  </span>
                  {t.moment}
                </span>
              </div>

              {/* LE HERO. Même famille que la carte « Look du jour » de
                  l'accueil : terracotta, titre serif crème, pièces en planche
                  (OutfitComposition "planche", 30/09/2026 — la même silhouette
                  que l'accueil et l'écran Tenue) dans une zone de hauteur FIXE (même
                  mesure que l'accueil et l'écran Tenue). Une robe longue ou
                  des chaussures horizontales s'adaptent à la zone ; la zone ne
                  s'adapte pas à elles, et rien ne bouge en dessous. */}
              <div className="mt-[18px] bg-terracotta rounded-hero text-left" style={{ padding: "20px 18px 20px" }}>
                <div className="font-serif text-[23px] min-[380px]:text-[26px] text-cream leading-[1.16]">
                  {passee ? "Ton look était planifié" : "Ton look est prêt."}
                </div>
                <div className="font-serif italic text-[15px] leading-[1.4] mt-[8px]" style={{ color: "rgba(243,238,229,.86)" }}>
                  {phrase}
                </div>
                {/* Même zone que la carte de l'accueil : 82 % de la largeur. */}
                <div className="mt-[12px]" style={{ aspectRatio: "100 / 82" }}>
                  {pieces.length > 0 ? (
                    <OutfitComposition items={pieces} variant="planche" />
                  ) : (
                    <div
                      className="h-full rounded-tuile flex items-center justify-center text-center px-6 text-[13px] leading-[1.5]"
                      style={{ background: "rgba(243,238,229,.10)", color: "rgba(243,238,229,.86)" }}
                    >
                      Les pièces de ce look ne sont plus dans ton dressing.
                    </div>
                  )}
                </div>
                {/* Confirmation discrète (maquette du 04/10/2026) : « Dans tes looks » dit que le look est enregistré ; sinon,
                    l'occasion, comme avant. */}
                <div className="pt-[16px]">
                  <span
                    className="inline-flex items-center gap-[6px] whitespace-nowrap"
                    style={{ fontSize: 11, background: "rgba(243,238,229,.22)", color: "var(--color-on-terracotta)", borderRadius: 100, padding: "8px 14px" }}
                  >
                    {dansMesLooks ? (
                      <>
                        <Glyphe taille={13}>{G_COCHE_PETITE}</Glyphe>
                        Dans tes looks
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-[6px] uppercase" style={{ fontSize: 9.5, letterSpacing: ".08em" }}>
                        <GlypheOccasion occasion={t.occasion} taille={13} />
                        {occLongDe(t.occasion)}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* On dit ce qui manque plutôt que de compléter avec autre
                  chose : une pièce retirée du dressing depuis la
                  planification ne doit pas être remplacée en silence. */}
              {manquantes > 0 && pieces.length > 0 && (
                <div className="text-[12px] text-muted mt-3 leading-[1.45]">
                  {manquantes === 1 ? "Une pièce de ce look n'est plus" : `${manquantes} pièces de ce look ne sont plus`} dans
                  ton dressing.
                </div>
              )}

              {/* LE CONTEXTE, compact : la météo d'abord quand elle est connue (celle d'aujourd'hui du lieu du plan, sinon
                  celle enregistrée à la planification, dite comme telle), puis le type de lieu et le moment. */}
              <Card className="mt-[14px] p-[15px] flex items-start gap-[12px]">
                <span className="flex-shrink-0 text-terracotta mt-[1px]">
                  <Glyphe taille={22}>{tempAffichee != null ? G_METEO : G_EPINGLE}</Glyphe>
                </span>
                <div className="min-w-0">
                  <div className="t-label text-muted">Le contexte</div>
                  <div className="text-[14px] text-ink font-medium leading-[1.35] mt-[5px]">
                    {tempAffichee != null
                      ? `${tempAffichee}°${(meteoPlanVive ? meteoPlanVive.label : t.weatherLabel) ? ` · ${meteoPlanVive ? meteoPlanVive.label : t.weatherLabel}` : ""}`
                      : occLongDe(t.occasion)}
                  </div>
                  <div className="text-[12px] text-muted leading-[1.45] mt-[3px]">{[t.sousChoix, t.typeLieu, t.moment].filter(Boolean).join(" · ")}</div>
                  {meteoPlanVive ? (
                    <>
                      {previsionAChange(t, meteoPlanVive) && (
                        <div className="text-[12px] text-terracotta leading-[1.45] mt-[3px]">
                          La prévision a changé depuis la planification{t.temp != null ? ` (${t.temp}°${t.weatherLabel ? `, ${t.weatherLabel.toLowerCase()}` : ""})` : ""}.
                        </div>
                      )}
                      {alerteMeteoPlan(pieces, meteoPlanVive) && (
                        <div className="text-[12px] text-terracotta leading-[1.45] mt-[3px]">{alerteMeteoPlan(pieces, meteoPlanVive)}</div>
                      )}
                      <div className="text-[11px] text-placeholder leading-[1.45] mt-[3px]">
                        Prévision {ecartJoursPlan === 0 ? "d'aujourd'hui" : ecartJoursPlan === 1 ? "de demain" : "à jour"} à {villePlan || "ce lieu"}
                      </div>
                    </>
                  ) : null}
                </div>
              </Card>

              {/* L'AVIS DE STYLISTE, mis en avant (maquette du 04/10/2026) — la fonctionnalité Premium existante (son
                  écran, sa décision d'accès, son Gate), avec son propre CTA. Pas sur une tenue passée : « avant le jour J »
                  n'y a plus de sens. */}
              {!passee && (
                <div className="mt-[14px] bg-warm-bg border border-warm-border rounded-carte px-[16px] py-[16px]">
                  {premiumRequis("AVIS_DE_STYLISTE") && <BadgePremium />}
                  <div className="font-serif text-[19px] text-ink leading-[1.2] mt-[2px]" style={{ textWrap: "balance" }}>
                    Ton regard de styliste, avant le jour J.
                  </div>
                  <div className="text-[12px] text-muted-3 leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
                    Obtiens un regard expert sur ce look avant le jour J.
                  </div>
                  <Button variante="principal" className="mt-[14px]" onClick={ouvrirAvisStyliste} aria-busy={verificationAvis}>
                    {verificationAvis ? <LoadingSpinner size={18} /> : <>Obtenir mon avis de styliste <span aria-hidden="true">→</span></>}
                  </Button>
                </div>
              )}

              {/* LES ACTIONS. Principale : modifier — rouvrir le parcours pré-rempli (repartirDuPlan). Secondaire : l'avis
                  d'un proche (même écran de partage que la tenue du jour, qui décrit ici la tenue planifiée : ses pièces,
                  son occasion, la prévision enregistrée). */}
              <div className="mt-[18px] flex flex-col gap-[10px]">
                <Card rayon="carte" className="" style={{ borderColor: "var(--color-terracotta)" }}>
                  <button onClick={() => repartirDuPlan(t, "modifier")} className="w-full flex items-center gap-[14px] px-[16px] py-[14px] text-left cursor-pointer transition-opacity active:opacity-80" style={{ minHeight: 64 }}>
                    <span aria-hidden="true" className="text-terracotta flex-shrink-0"><Glyphe taille={22}>{G_CRAYON}</Glyphe></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] text-ink font-medium">Modifier ce look</span>
                      <span className="block text-[12px] text-muted mt-[2px]">Reprendre ce look pour l&apos;ajuster</span>
                    </span>
                    <span aria-hidden="true" className="text-muted flex-shrink-0"><Glyphe taille={15}>{G_CHEVRON}</Glyphe></span>
                  </button>
                </Card>
                {pieces.length > 0 && (
                  <Card rayon="carte">
                    <button
                      onClick={() =>
                        actions.openOpinionShare({
                          pieceIds: t.pieceIds,
                          occasion: t.occasion,
                          temp: t.temp,
                          label: t.weatherLabel,
                          moment: `pour ${DOW_LONG[d.getDay()].toLowerCase()} ${d.getDate()} ${MOIS[d.getMonth()]}`,
                          plan: t,
                        })
                      }
                      className="w-full flex items-center gap-[14px] px-[16px] py-[14px] text-left cursor-pointer transition-opacity active:opacity-80"
                      style={{ minHeight: 64 }}
                    >
                      <span aria-hidden="true" className="text-terracotta flex-shrink-0"><Glyphe taille={22}>{G_COEUR}</Glyphe></span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[14px] text-ink font-medium">Demander l&apos;avis d&apos;un proche</span>
                        <span className="block text-[12px] text-muted mt-[2px]">Partage ce look et demande leur avis</span>
                      </span>
                      <span aria-hidden="true" className="text-muted flex-shrink-0"><Glyphe taille={15}>{G_CHEVRON}</Glyphe></span>
                    </button>
                  </Card>
                )}
              </div>

              {/* AUTRES OPTIONS, repliées (maquette du 04/10/2026) — uniquement des actions qui existent :
                  « Enregistrer dans mes looks » (enregistrerIdeeLook, la même écriture que « J'adore » et les idées de
                  looks) tant que le look n'y est pas ; une fois dedans, le badge du hero le dit. Déplacer et dupliquer
                  reprennent la composition imposée ; la suppression garde sa confirmation. */}
              <Card as="details" className="group mt-[14px]">
                <summary className="flex items-center justify-between gap-3 px-[15px] cursor-pointer list-none text-[13px] text-ink [&::-webkit-details-marker]:hidden" style={{ minHeight: 52 }}>
                  <span className="flex items-center gap-[12px]">
                    <span aria-hidden="true" className="text-muted tracking-[.2em]">•••</span>
                    Autres options
                  </span>
                  <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">
                    <Glyphe taille={15}>{G_CHEVRON}</Glyphe>
                  </span>
                </summary>
                <div className="px-[15px] border-t border-divider">
                  {pieces.length > 0 && <LigneOption label="Changer la date ou le moment" onClick={() => repartirDuPlan(t, "deplacer")} />}
                  {pieces.length >= 2 && !dansMesLooks && (
                    <LigneOption
                      label={lookDemande === t.id ? "Enregistrement…" : "Enregistrer dans mes looks"}
                      disabled={lookDemande === t.id}
                      onClick={() => {
                        setLookDemande(t.id);
                        actions.enregistrerIdeeLook(t.pieceIds, t.occasion);
                      }}
                    />
                  )}
                  {pieces.length > 0 && <LigneOption label="Dupliquer ce look" onClick={() => repartirDuPlan(t, "dupliquer")} />}
                  <LigneOption label="Supprimer ce look" danger onClick={() => setASupprimer(t)} />
                </div>
              </Card>
            </>
          );
        })()}

        {/* « MES LOOKS À VENIR » (30/09/2026, brief « Refonte premium de la
            page Mes planifications ») : l'agenda de looks — le prochain en
            grand, les suivants en frise, les voyages en contexte. Mêmes
            données et mêmes actions que la liste d'avant (AgendaLooks). */}
        {vue === "liste" && (
          <AgendaLooks
            onglet={onglet}
            onglets={ongletsPlans}
            aVenir={aVenir}
            passees={passees}
            piecesDuPlan={piecesDuPlan}
            dressing={state.items}
            onOuvrir={(t) => {
              setPlanOuvert(t);
              setRetourDetail("liste");
              setVue("detail");
            }}
            onMenu={setMenuPlan}
            onOuvrirValise={(v) => void actions.ouvrirValise(v.id)}
          />
        )}
      </div>

      {/* Le hub n'a pas de barre d'action : ses deux cartes portent chacune
          leur CTA, et la barre de navigation reprend sa place en pied. */}
      {vue !== "intro" && vue !== "detail" && (
      <div className="relative flex-shrink-0 px-6 pt-[10px] pb-[18px] flex flex-col gap-2 border-t border-border">
        {/* Ancré à la barre d'action elle-même (bottom: 100%) et non à une
            hauteur devinée : la barre change de hauteur selon la vue — un
            bouton, ou un bouton plus deux secondaires — et un toast posé à
            une distance fixe finirait collé à l'un des deux cas. */}
        {toast && (
          <div
            className="absolute inset-x-6 z-30 pointer-events-none rounded-bloc px-4 py-[13px] text-[12px]"
            style={{ bottom: "100%", marginBottom: 12, background: "var(--color-ink)", color: "var(--color-cream)" }}
            aria-live="polite"
          >
            {toast}
          </div>
        )}
        {vue === "etape" && (
          <Button
            onClick={() => {
              if (!etapeValide || attend) return;
              if (etape < 3) {
                setEtape(etape + 1);
                return;
              }
              /* DERNIÈRE ÉTAPE. Le lieu est arrêté : c'est ici qu'on demande
                 la prévision, et pas à chaque frappe dans le champ — un clic,
                 une requête. L'étape 4 servait jusqu'ici de salle d'attente
                 pendant l'appel ; sans elle, c'est le bouton qui attend, et
                 il le dit (« Un instant… »). La tenue n'est affichée qu'une
                 fois la réponse revenue, jamais composée sur la météo du jour
                 puis changée sous les yeux.

                 Les deux branches mènent au résultat : une prévision
                 indisponible est une réponse, pas un échec — l'écran compose
                 alors sur la météo actuelle et l'annonce. */
              setPrevisionEtat("encours");
              fetchPrevisionByCity(ville ? ville.name : lieu.trim(), ville)
                .then((p) => setPrevision(p))
                .catch(() => setPrevision(null))
                .finally(() => {
                  setPrevisionEtat("faite");
                  setVue("resultat");
                });
            }}
            disabled={!etapeValide || attend}
          >
            {attend ? "Un instant…" : etape === 3 ? "Voir ma tenue" : "Suivant"}
          </Button>
        )}
        {/* « + PLANIFIER UN LOOK » (30/09/2026) : la barre d'action pleine
            largeur de tous les écrans, pas une pastille flottante qui
            n'existait nulle part ailleurs. */}
        {vue === "liste" && (
          <Button onClick={recommencer}>+ Planifier un look</Button>
        )}
        {vue === "resultat" && (
          <>
            {/* « Garder cette tenue » existe désormais vraiment (lot 3). Elle
                est désactivée quand il n'y a pas de tenue à garder — un état
                vide ne se planifie pas — et pendant l'écriture, pour qu'un
                double tap ne parte pas deux fois. */}
            <Button
              onClick={garder}
              disabled={enregistrement || sansTenue}
            >
              {enregistrement ? "Un instant…" : "Garder cette tenue"}
            </Button>
            {/* MODIFIER À GAUCHE, PRINCIPAL À DROITE (recette 24/09/2026).
                « Modifier » seul laissait croire qu'on retouchait la tenue ;
                on retouche les réponses qui l'ont produite, d'où « cet
                évènement ». Les deux gardent le contexte : l'une rouvre les
                étapes déjà remplies, l'autre retire au même endroit. Aucune
                des deux ne repart de zéro — ça, c'est le bouton de la liste.

                Le principal de l'écran reste « Garder cette tenue » au-dessus :
                c'est la seule des trois actions qui laisse une trace. */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setVue("etape");
                  setEtape(1);
                }}
                className="flex-1 rounded-full bg-card border border-border text-[12px] text-muted-3 cursor-pointer"
                style={{ minHeight: 44 }}
              >
                Modifier cet évènement
              </button>
              {/* Une composition imposée est LA tenue de la photo : pas de
                  nouveau tirage. */}
              {!composition && (
                <button
                  onClick={() => setTirage(tirage + 1)}
                  className="flex-1 rounded-full bg-card border border-terracotta text-[12px] font-medium text-terracotta cursor-pointer"
                  style={{ minHeight: 44 }}
                >
                  Une autre tenue
                </button>
              )}
            </div>
          </>
        )}
      </div>
      )}

      {/* LA BARRE DE NAVIGATION SUR LE HUB (brief du 25/09, points 7-8, et
          brief Planifier §12). Planifier est un onglet : on y arrive par la
          barre, elle doit y rester, avec son onglet actif. Le MÊME composant
          que partout — pas une seconde navigation. Elle s'efface pendant le
          parcours, dont le bouton principal occupe le pied d'écran (cf.
          FLOW_SCREENS, App.tsx) : c'est la seule vue sans barre d'action. */}
      {(vue === "intro" || vue === "detail") && <TabBar />}

      {/* LE MENU « … » — BottomSheet, le seul composant modal de l'app. Il
          n'existe pas de popover, et en créer un pour trois lignes ajouterait
          un motif à maintenir. La corbeille quitte la carte : une action
          destructive ne doit pas être la plus visible des secondaires. */}
      <BottomSheet title="Ce look" open={!!menuPlan} onClose={() => setMenuPlan(null)}>
        <div className="flex flex-col">
          <button
            onClick={() => {
              const t = menuPlan;
              setMenuPlan(null);
              if (t) { setPlanOuvert(t); setVue("detail"); }
            }}
            className="text-left px-1 py-[14px] text-[13px] text-ink cursor-pointer border-b border-divider"
            style={{ minHeight: 52 }}
          >
            Voir le look
          </button>
          <button
            onClick={() => {
              const t = menuPlan;
              setMenuPlan(null);
              // Même geste que « Modifier cette tenue » du détail (repartirDuPlan).
              if (t) repartirDuPlan(t, "modifier");
            }}
            className="text-left px-1 py-[14px] text-[13px] text-ink cursor-pointer border-b border-divider"
            style={{ minHeight: 52 }}
          >
            Modifier ce look
          </button>
          <button
            onClick={() => { const t = menuPlan; setMenuPlan(null); setASupprimer(t); }}
            className="text-left px-1 py-[14px] text-[13px] text-terracotta cursor-pointer"
            style={{ minHeight: 52 }}
          >
            Supprimer
          </button>
        </div>
      </BottomSheet>

      <GateAvisStyliste
        open={gateAvisStyliste}
        onClose={() => setGateAvisStyliste(false)}
        onDecouvrirPremium={() => {
          setGateAvisStyliste(false);
          actions.goPremium();
        }}
      />

      {/* CONFIRMATION — la suppression retire une ligne de la base et n'a
          aucune annulation après coup. Elle se demande. */}
      <BottomSheet title="Supprimer ce look ?" open={!!aSupprimer} onClose={() => setASupprimer(null)}>
        <div className="flex flex-col">
          <div className="text-[13px] text-muted-3 leading-[1.5]">
            Ce look sera retiré de ton agenda. Tes pièces, elles, restent dans ton dressing.
          </div>
          <Button variante="principal" className="mt-4"
            onClick={() => {
              const t = aSupprimer;
              setASupprimer(null);
              if (!t) return;
              if (planOuvert?.id === t.id) { setPlanOuvert(null); setVue("liste"); }
              retirer(t.id);
            }}
          >
            Supprimer
          </Button>
          <button
            onClick={() => setASupprimer(null)}
            className="w-full text-[12px] text-muted-3 cursor-pointer mt-1"
            style={{ minHeight: 44 }}
          >
            Annuler
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
