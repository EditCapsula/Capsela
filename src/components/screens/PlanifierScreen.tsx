"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AgendaLooks from "@/components/AgendaLooks";
import AppHeader from "@/components/AppHeader";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import GateAvisStyliste from "@/components/GateAvisStyliste";
import LoadingSpinner from "@/components/LoadingSpinner";
import { CalendrierMois, IconeTuile, LigneIcone, ProgressionLibelles, TuileIcone, TuileOccasion, type IconePlanifier } from "@/components/PlanifierUI";
import { OCCASIONS_EDITORIALES } from "@/lib/occasionEditoriale";
import { GlypheOccasion, GlypheSousChoix } from "@/components/GlyphesOccasion";
import { OutfitComposition } from "@/components/OutfitComposition";
import SegmentedControl from "@/components/SegmentedControl";
import TabBar from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { resolveItemImage } from "@/lib/catalogImages";
import { CATS, DATE_CONTEXTS, OCCASIONS, WORK_MODES, occasionShortLabel, type Weather } from "@/lib/data";
import { sansTenueCopy } from "@/lib/emptyStateCopy";
import { decisionAcces, premiumRequis } from "@/lib/autorisations";
import { titreLookDuJour } from "@/lib/logic";
import { HUMEURS, LIBELLE_HUMEUR, genererTenueHumeur, type Humeur } from "@/lib/humeur";
import { soireeHabillee } from "@/lib/occasions";
import { jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { alerteMeteoPlan, previsionAChange } from "@/lib/planDuJour";
import { ecartJoursDuPlan, useMeteoDuPlan } from "@/lib/useMeteoDuPlan";
import { HORIZON_PREVISION_JOURS, joursCouverts, previsionPour, type MomentJournee, type Prevision } from "@/lib/prevision";
import { computeDefaultCapsule, saisonCalendairePour } from "@/lib/capsule";
import EtapeLieu, { type MeteoEtapeLieu } from "@/components/EtapeLieu";
import { meteoPourLaDate } from "@/lib/meteoPlan";
import { fetchClimat, previsionGardee, type Climat, type VilleSuggeree } from "@/lib/weather";
import { deleteTenuePlanifiee, fetchTenuesPlanifiees, enregistrerHumeurPlan, upsertTenuePlanifiee, villeDuLieu, type TenuePlanifiee } from "@/lib/planifier";
import { repartirPlanifications, type ValiseGardee } from "@/lib/valises";
import { VISUEL_SEJOUR } from "@/lib/valise";
import { libelleStyles, paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { composeWardrobePool } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "@/lib/types";
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

/** Le choix « Autre » du type de lieu : une réponse de l'écran, jamais une valeur de `planned_outfits.type_lieu` (CHECK de la migration 0030). */
const TYPE_LIEU_AUTRE = "Autre";
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
 * 1. LE TYPE DE LIEU N'ENTRE PAS DANS LE MOTEUR, SAUF POUR UNE SEULE OCCASION.
 *    Vérifié : aucune règle de `logic.ts` ne lit `typeLieu`. Il décrit le
 *    rendez-vous (il s'affiche sur la fiche, il se range dans
 *    `planned_outfits.type_lieu`), il n'affine pas la sélection. Une seule
 *    exception depuis le 08/10/2026 : « Bar / Rooftop » pour une SOIRÉE la
 *    rend habillée (soireeHabillee, occasions.ts) — c'est ce qui remplace
 *    l'ancienne occasion « Sortie festive ». Ailleurs, une question sans
 *    conséquence ne se pose que là où la réponse sert à SE RELIRE plus tard.
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
 *   soiree           — les cinq. (L'ancienne « Sortie festive », qui n'en
 *                      avait que trois, a été fusionnée ici le 08/10/2026.)
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
  evenement_perso: ["Restaurant", "Lieu culturel", "Extérieur", "Chez quelqu'un"],
};

const JOURS_PROPOSES = 21;
/** Les noms sous les points du fil (maquettes du 07/10/2026) ; une tenue imposée n'a pas la dernière. */
const LIBELLES_ETAPES = ["Occasion", "Où", "Quand", "Préférence"] as const;
const ICONE_MOMENT: Record<string, IconePlanifier> = { Matin: "matin", "Après-midi": "apresmidi", Soirée: "soiree", "Toute la journée": "journee" };
const DOW = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const DOW_LONG = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function dansNJours(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
}


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
/**
 * Une carte du hub (refonte du 04/10/2026, « hub Premium + hub personnel »). Le bandeau éditorial, le titre, le texte et
 * le bouton de CRÉATION forment un seul <button> (pattern des cartes de l'accueil) ; le CTA est un <span>, pour ne pas
 * imbriquer deux éléments interactifs. Ce qui a déjà été créé (`children`) se pose SOUS ce bouton, dans la même carte, et
 * porte ses propres boutons : créer et consulter ne se mélangent pas. Le badge est sur sa propre ligne, au-dessus du
 * titre, à côté du glyphe : il ne peut ni chevaucher le titre ni le faire passer à la ligne, quelle que soit la largeur
 * (brief §16 du 25/09/2026).
 */
/**
 * LE VISUEL ÉDITORIAL DU HUB (08/10/2026) : celui du profil — femme ou homme —, et jamais « aucun ». Il disparaissait quand le genre
 * n'était pas (encore) renseigné ou pas encore chargé : le hub perdait ses deux images. Sans genre, la version « femme », celle de la maquette.
 */
function visuelHub(kind: "tenue" | "valise", genre: "femme" | "homme" | null): string {
  return `/editorial/capsela_planifier_${kind}_${genre === "homme" ? "homme" : "femme"}.webp`;
}

function CartePlanifier({
  glyphe,
  etiquette,
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
  /** La pastille de la carte (« Occasion », « Voyage ») — la même forme que les autres pastilles de l'app (t-pastille). */
  etiquette?: string;
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
          <span className="flex items-center gap-2">
            {etiquette && <span className="t-pastille rounded-full px-[10px] py-[5px] bg-warm-bg text-muted-3 uppercase">{etiquette}</span>}
            <BadgePremium />
          </span>
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

/**
 * Un tirage du moteur unique (generateOutfitWithFallback, via la préférence d'humeur) pour une planification. Même
 * composition de pool que `regen` (store.tsx) : une catégorie dont aucune pièce réelle ne déclare l'occasion se voit rendre
 * celles de la capsule qui la déclarent ; « Uniquement mon dressing » court-circuite cette complétion.
 */
function composerTenuePlan(e: {
  items: Item[];
  capsule: Item[];
  occ: OccasionKey | null;
  dressingSeul: boolean;
  meteo: Weather;
  workMode: WorkMode;
  dateContext: DateContext;
  profile: ReturnType<typeof useAuth>["profile"];
  humeur: Humeur | null;
  typeLieu: string | null;
}) {
  if (!e.occ) return null;
  const pool = e.dressingSeul
    ? e.items
    : composeWardrobePool(e.items, e.capsule, CAT_KEYS, { completerPourOccasion: e.occ, saison: e.meteo, exclureHorsOccasion: true, completerPourSaison: e.meteo });
  return genererTenueHumeur({
    pool,
    weather: e.meteo,
    occasion: e.occ,
    workMode: e.workMode,
    dateContext: e.dateContext,
    preferredHexes: paletteHexes(e.profile),
    gender: e.profile.gender,
    morphology: e.profile.morphology,
    colorimetrie: colorimetrieMoteur(e.profile.colorimetrie),
    humeur: e.humeur,
    soireeHabillee: e.occ === "soiree" && soireeHabillee({ typeLieu: e.typeLieu, humeur: e.humeur }),
  });
}

export default function PlanifierScreen() {
  const { state, weather, defaultCapsule, vestiairePool, etatPremium, actions } = useCapsela();
  const { profile, userId } = useAuth();

  // Retour de « Demander l'avis d'un proche » : le plan partagé se rouvre,
  // plutôt que de laisser sur le hub (l'état de cet écran est local).
  // « Planifier une tenue pour … » depuis Tenue (27/09/2026) : la date est
  // déjà choisie, le parcours s'ouvre sur ses étapes.
  const [vue, setVue] = useState<"intro" | "etape" | "resultat" | "alternatives" | "liste" | "detail" | "confirmation">(() =>
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
  /** Le mois affiché par le calendrier de l'étape « Quand » : celui de la date déjà choisie, sinon le mois courant. */
  const [moisAffiche, setMoisAffiche] = useState<Date>(() => {
    const d = dansNJours(jour ?? 0);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [lieu, setLieu] = useState("");
  /**
   * VILLE CHOISIE DANS LES SUGGESTIONS, avec ses coordonnées — `null` tant
   * qu'on tape librement. C'est elle qui part chercher la prévision quand
   * elle existe : un point, pas une chaîne à réinterpréter. La saisie libre
   * reste acceptée (l'autocomplétion peut être indisponible), elle est
   * simplement moins sûre.
   */
  const [ville, setVille] = useState<VilleSuggeree | null>(null);
  const [typeLieu, setTypeLieu] = useState<string | null>(null);
  /**
   * « Une dernière préférence ? » (07/10/2026) : facultative, jamais mémorisée dans le profil. Elle ne fait que départager
   * des tenues déjà compatibles (humeur.ts). Une composition imposée (photo d'un avis) n'a pas cette étape : sa tenue est faite.
   */
  const [humeur, setHumeur] = useState<Humeur | null>(null);
  /** L'écran « Capsela compose ta tenue… » : affiché entre la dernière question et le résultat, le temps de la prévision. */
  const [compose, setCompose] = useState(false);
  /** La tenue qui vient d'être gardée — pour l'écran de confirmation. */
  const [gardee, setGardee] = useState<TenuePlanifiee | null>(null);
  const [composeDelaiOk, setComposeDelaiOk] = useState(false);
  const [coche, setCoche] = useState(0);
  const [dressingSeul, setDressingSeul] = useState(false);
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
  /** Le hub n'affiche qu'une expérience à la fois (08/10/2026) : la tenue par défaut, ou la valise. */
  const [hub, setHub] = useState<"tenue" | "valise">("tenue");
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
    if (!permis) return [] as string[];
    // « Autre » ferme la liste (08/10/2026). Il n'est pas écrit en base — la colonne n'accepte que les cinq autres valeurs : il se
    // lit comme « pas de précision » à l'enregistrement (cf. TYPE_LIEU_AUTRE).
    return [...TYPES_LIEU.filter(([t]) => permis.includes(t)).map(([t]) => t), TYPE_LIEU_AUTRE];
  }, [occ]);
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
  /** La météo de la journée entière à la date choisie — pour la carte de l'étape « Quand », avant que le moment soit choisi. */
  const meteoJour = prevision && dateChoisie ? previsionPour(prevision, jourLocal(dateChoisie), "Toute la journée") : null;
  /** Le premier jour où la prévision couvrira la date choisie : la date moins l'horizon de la prévision. */
  const debutMeteo = (() => {
    if (!dateChoisie) return "";
    const d = new Date(dateChoisie);
    d.setDate(d.getDate() - HORIZON_PREVISION_JOURS);
    return `${d.getDate()} ${MOIS[d.getMonth()]}`;
  })();
  /** Dernier jour réellement couvert — sert à dire jusqu'à quand on sait. */
  const dernierJourConnu = prevision ? joursCouverts(prevision).at(-1) : undefined;
  /**
   * LA PRÉVISION, DÈS L'ÉTAPE « OÙ » quand la date est déjà connue (08/10/2026). Elle dépend du POINT (latitude, longitude) et de la
   * date — pas du type de lieu ni de la préférence, qui ne la redemandent jamais. La réponse est gardée par point (previsionGardee) :
   * changer de date, revenir sur l'étape ou la quitter ne rappelle pas la fonction pour le même lieu.
   */
  const cleLieu = `${lieu.trim()}|${ville ? `${ville.lat},${ville.lon}` : ""}`;
  useEffect(() => {
    if (etape !== 2 || !lieu.trim() || jour == null) return;
    let annule = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrevisionEtat("encours");
    previsionGardee(ville ? ville.name : lieu.trim(), ville)
      .then((p) => {
        if (!annule) setPrevision(p);
      })
      .catch(() => {
        if (!annule) setPrevision(null);
      })
      .finally(() => {
        if (!annule) setPrevisionEtat("faite");
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape, cleLieu, jour]);
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
  const saisonDeLaDate = dateChoisie ? saisonCalendairePour(dateChoisie) : null;
  /**
   * LA MÉTÉO DE LA DATE PLANIFIÉE, jamais celle d'aujourd'hui quand elle n'a rien à dire de cette date (08/10/2026, demandé : « il faut
   * absolument tenir compte de la météo de la date planifiée »). Prévision du créneau quand elle existe. Au-delà de l'horizon de la
   * prévision, aucune mesure n'existe : le moteur reçoit la TEMPÉRATURE HABITUELLE de la saison de la date (jamais affichée comme une
   * prévision) — planifier du lin pour juillet un 8 octobre ne se compose plus sur les 11° du jour. Dans l'horizon mais sans réponse
   * (lieu introuvable, quota), la météo d'aujourd'hui reste la plus proche mesure.
   */
  // AU-DELÀ de ce que la prévision couvre : l'horizon connu d'avance, ou — si la réponse a été plus courte (repli) — son dernier jour réel.
  const auDela =
    jour != null &&
    (jour > HORIZON_PREVISION_JOURS || (prevision != null && dateChoisie != null && dernierJourConnu != null && jourLocal(dateChoisie) > dernierJourConnu));
  /** Les températures HABITUELLES du lieu à cette date (moyenne des années passées), demandées seulement au-delà de la prévision. */
  const [climatBrut, setClimatBrut] = useState<{ cle: string; c: Climat | null } | null>(null);
  const cleClimat = auDela && ville && dateChoisie ? `${ville.lat},${ville.lon}|${jourLocal(dateChoisie)}` : null;
  useEffect(() => {
    if (!cleClimat || !ville || !dateChoisie) return;
    let annule = false;
    void fetchClimat({ lat: ville.lat, lon: ville.lon }, dateChoisie).then((c) => {
      if (!annule) setClimatBrut({ cle: cleClimat, c });
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleClimat]);
  const climat = cleClimat && climatBrut?.cle === cleClimat ? climatBrut.c : null;
  const meteoUtilisee = meteoPourLaDate({ date: dateChoisie, creneau: meteoMoment, aujourdhui: weather, auDela, climat });
  /**
   * LA CAPSULE DE LA DATE (08/10/2026) : celle du jour est bâtie sur la météo et la saison d'AUJOURD'HUI. Une tenue planifiée pour une autre
   * saison complétait donc ses catégories vides — les chaussures en premier — avec des pièces d'aujourd'hui (des bottines pour juillet).
   * Elle est recalculée pour la saison et la météo de la date, comme « Comment porter … ? » le fait pour une pièce.
   */
  const capsuleDeLaDate = useMemo(
    () => (saisonDeLaDate ? computeDefaultCapsule(profile, meteoUtilisee, state.suggestedExcluded, saisonDeLaDate, vestiairePool) : defaultCapsule),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile, saisonDeLaDate, meteoUtilisee.temp, meteoUtilisee.label, state.suggestedExcluded, vestiairePool, defaultCapsule]
  );
  /** Ce que l'étape « Où » dit de la météo : la prévision réelle, ou ce qui manque — jamais une température estimée. */
  const meteoEtapeLieu: MeteoEtapeLieu = !lieu.trim()
    ? { kind: "sansLieu" }
    : jour == null
      ? { kind: "sansDate" }
      : meteoJour
        ? { kind: "ok", temp: meteoJour.temp, tempMin: meteoJour.tempMin, tempMax: meteoJour.tempMax, label: meteoJour.label }
        : previsionEtat !== "faite"
          ? { kind: "encours" }
          : auDela
            ? climat
              ? { kind: "habituelle", tempMin: climat.tempMin, tempMax: climat.tempMax }
              : { kind: "loin" }
            : { kind: "indispo" };
  /**
   * La ville telle que l'utilisatrice l'a donnée — le nom de la suggestion
   * choisie, ou le premier segment de sa saisie —, jamais une précision
   * qu'elle n'a pas fournie (recette du 26/09/2026, cf. villeDuLieu).
   */
  const villeAffichee = ville?.name ?? villeDuLieu(lieu);

  /** Les entrées du moteur pour cette planification — une seule description, pour la tenue et pour ses alternatives. */
  const entreesMoteur = {
    items: state.items,
    capsule: capsuleDeLaDate,
    occ,
    dressingSeul,
    meteo: meteoUtilisee,
    workMode,
    dateContext,
    profile,
    humeur,
    typeLieu,
  };
  const tenue = useMemo(
    () => composerTenuePlan(entreesMoteur),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [occ, dressingSeul, state.items, capsuleDeLaDate, meteoUtilisee, workMode, dateContext, profile, humeur, typeLieu]
  );
  /** L'alternative choisie dans « Autres propositions » : valable tant que les paramètres qui l'ont produite ne changent pas. */
  const cleParams = `${occ}|${dressingSeul}|${humeur}|${typeLieu}|${jour}|${moment}|${workMode}|${dateContext}`;
  const [choixBrut, setChoixBrut] = useState<{ cle: string; ids: number[] } | null>(null);
  const choisie = choixBrut?.cle === cleParams ? choixBrut.ids : null;
  /** La proposition surlignée dans « Autres propositions » (index dans `propositions`), sinon celle qui est affichée. */
  const [altSel, setAltSel] = useState(0);
  const [altsBrut, setAltsBrut] = useState<{ cle: string; liste: number[][] } | null>(null);
  const alternatives = altsBrut?.cle === cleParams ? altsBrut.liste : [];
  const idsAffiches = composition ?? choisie ?? tenue?.ids ?? [];
  /** Jusqu'à trois tenues différentes de celle affichée, tirées du même moteur avec les mêmes paramètres. */
  const chercherAlternatives = () => {
    const vues = new Set<string>([[...idsAffiches].sort().join(",")]);
    const liste: number[][] = [];
    for (let i = 0; i < 30 && liste.length < 3; i++) {
      const t = composerTenuePlan(entreesMoteur);
      if (!t || t.noCompleteOutfit || !t.ids.length) continue;
      const cle = [...t.ids].sort().join(",");
      if (vues.has(cle)) continue;
      vues.add(cle);
      liste.push(t.ids);
    }
    setAltsBrut({ cle: cleParams, liste });
    setAltSel(0);
  };

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
    return idsAffiches.map((id) => source.find((i) => i.id === id)).filter((i): i is Item => !!i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composition, tenue, choisie, state.items, vestiairePool, defaultCapsule, dressingSeul]);
  /** Rien à garder : état vide du moteur — une composition imposée en a toujours une. */
  const sansTenue = !composition && (!tenue || tenue.noCompleteOutfit);
  /** Les mots de l'état sans tenue : dressing vide, pièces manquantes, ou pas de combinaison pour l'occasion (emptyStateCopy.ts). */
  const sansTenueTextes = sansTenue ? sansTenueCopy(state.items.length, dressingSeul, tenue?.reason, dressingSeul ? "ton dressing" : "ton dressing et ta capsule") : null;

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
      return climat
        ? `La prévision ne va que jusqu'au ${d.getDate()} ${MOIS[d.getMonth()]}. Au-delà, la tenue suit les températures habituelles de ${villeAffichee} à cette date : ${climat.tempMin}° à ${climat.tempMax}°.`
        : `La prévision ne va que jusqu'au ${d.getDate()} ${MOIS[d.getMonth()]}. Au-delà, la tenue suit la saison de la date et ses températures habituelles.`;
    }
    return auDela
      ? climat
        ? `Pas de prévision pour cette date. La tenue suit les températures habituelles de ${villeAffichee} à cette date : ${climat.tempMin}° à ${climat.tempMax}°.`
        : "Pas de prévision pour cette date. La tenue suit la saison de la date et ses températures habituelles."
      : `Pas de prévision disponible pour ce lieu. La tenue suit la saison de la date et la météo d'aujourd'hui — ${aujourdhui}.`;
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
          titre: "Quel type de journée ?",
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
        typeLieu: typeLieu === TYPE_LIEU_AUTRE ? null : typeLieu,
        // Une composition imposée vient du dressing réel — sauf une tenue
        // planifiée reprise, qui garde ce qu'elle était.
        dressingSeul: composition ? (depuisPlan ? depuisPlan.plan.dressingSeul : true) : dressingSeul,
        pieceIds: composition ?? choisie ?? tenue!.ids,
        temp: meteoMoment ? meteoMoment.temp : null,
        weatherLabel: meteoMoment ? meteoMoment.label : null,
      });
      // La préférence s'écrit à part (colonne mood_style, migration 0048) : tant que la migration n'est pas passée,
      // la tenue est gardée sans elle et l'échec est dit, jamais tu.
      const humeurGardee = humeur && !composition ? await enregistrerHumeurPlan(ligne.id, humeur) : true;
      setPlans((l) => [...l.filter((x) => x.id !== ligne.id), humeur && !composition && humeurGardee ? { ...ligne, humeur } : ligne]);
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
      setOnglet("up");
      // Tout s'est bien passé : l'écran de confirmation. Sinon la liste, où le message d'échec est lisible.
      if (ancienRetire && humeurGardee) {
        setGardee(ligne);
        setVue("confirmation");
        return;
      }
      setVue("liste");
      flash(
        !ancienRetire
          ? "La nouvelle date est gardée. L'ancienne n'a pas pu être retirée : supprime-la depuis ta liste."
          : !humeurGardee
            ? "Tenue enregistrée. Ta préférence n'a pas pu l'être : elle ne sera pas rappelée à l'ouverture."
            : "Tenue enregistrée. Tu la retrouveras dans ton planning le jour venu."
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
    setTypeLieu(null);
    setHumeur(null);
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
    setTypeLieu(t.typeLieu);
    setHumeur(t.humeur ?? null);
    setDressingSeul(t.dressingSeul);
    setPrevision(null);
    setPrevisionEtat("vide");
    setComposition(mode === "modifier" ? null : t.pieceIds);
    setDepuisPlan({ plan: t, remplacer: mode !== "dupliquer" });
    setPlanOuvert(null);
    setVue("etape");
    setEtape(mode === "modifier" ? 1 : 3);
  };

  /** Le message sous le bouton inactif : lié à l'état qui l'a provoqué, il disparaît dès qu'on change d'étape ou de choix. */
  const [messageBrut, setMessageBrut] = useState<{ txt: string; cle: string } | null>(null);
  const cleMessage = `${etape}|${occ}|${jour}|${moment}`;
  const message = messageBrut?.cle === cleMessage ? messageBrut.txt : null;
  /** Quatre questions, trois pour une tenue imposée (sa composition est faite, la préférence n'aurait rien à départager). */
  const derniere = composition ? 3 : 4;
  const etapeValide = etape === 1 ? !!occ : etape === 3 ? jour != null && !!moment : true;

  // Écran de composition : la prévision doit être revenue ET un temps minimal écoulé, pour que la transition se lise.
  useEffect(() => {
    if (!compose) return;
    const tDelai = setTimeout(() => setComposeDelaiOk(true), 2000);
    const tCoche = setInterval(() => setCoche((c) => c + 1), 450);
    return () => {
      clearTimeout(tDelai);
      clearInterval(tCoche);
    };
  }, [compose]);
  useEffect(() => {
    if (!compose || !composeDelaiOk || previsionEtat === "encours") return;
    // En rappel (et non en direct) : la fin de la composition est une conséquence du temps écoulé et de la prévision.
    const t = setTimeout(() => {
      setCompose(false);
      setVue("resultat");
    }, 0);
    return () => clearTimeout(t);
  }, [compose, composeDelaiOk, previsionEtat]);

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
    if (compose) return;
    if (retourExterne) {
      actions.quitterPlanifier();
      return;
    }
    if (vue === "detail") {
      setPlanOuvert(null);
      setVue(retourDetail);
    } else if (vue === "etape" && depuisPlan && etape === (composition ? 3 : 1)) {
      // Parcours ouvert depuis le détail d'un plan : le retour y ramène.
      setPlanOuvert(depuisPlan.plan);
      setDepuisPlan(null);
      setComposition(null);
      setVue("detail");
    } else if (vue === "alternatives") setVue("resultat");
    else if (vue === "liste" || vue === "confirmation") setVue("intro");
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
    1: [`Étape 1 sur ${derniere}`, "Quelle est", "l'occasion ?", "Choisis le moment à préparer, Capsela s’occupe du reste."],
    // Le lieu sert à la prévision météo (et se range avec la tenue planifiée). Le type de lieu précise l'occasion : le
    // moteur ne le lit pas (cf. TYPES_LIEU_PAR_OCCASION), la phrase ne dit donc pas qu'il « affine la tenue ».
    2: [`Étape 2 sur ${derniere}`, "Où", "seras-tu ?", "Capsela utilise le lieu pour adapter la météo et le contexte de ta tenue."],
    3: [`Étape 3 sur ${derniere}`, "Pour", "quand ?", "Capsela adapte la tenue au moment choisi et à la météo."],
    // Une préférence, pas un style : elle ne départage que des tenues déjà compatibles (humeur.ts).
    4: [`Étape 4 sur ${derniere}`, "Une dernière", "préférence ?", "Comment veux-tu te sentir dans cette tenue ?"],
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
          <ProgressionLibelles libelles={LIBELLES_ETAPES.slice(0, derniere)} courante={etape - 1} />
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
            {/* TENUE / VALISE : le même sélecteur que le Dressing, la Valise et Mon planning (SegmentedControl) — la seconde
                fonctionnalité se découvre sans défiler. Une seule carte à la fois ; elle apparaît par le fondu léger de l'app
                (capsule-apparition, 220 ms), sans animation si le téléphone demande moins de mouvement. */}
            <div className="mt-5">
              <SegmentedControl
                segments={[{ key: "tenue", label: "Tenue" }, { key: "valise", label: "Valise" }]}
                actif={hub}
                onChange={setHub}
                ariaLabel="Ce que tu veux planifier"
              />
            </div>
            <div key={hub} className="flex flex-col gap-4 mt-4 motion-safe:animate-[capsule-apparition_220ms_ease-out_both]" role="tabpanel">
              {hub === "tenue" && (
              <CartePlanifier
                glyphe={G_CINTRE}
                etiquette="Occasion"
                titre={["Planifier", "une tenue"]}
                accroche="Un moment à venir ? On s'occupe du look."
                description="Pour un dîner, un rendez-vous, une cérémonie ou toute occasion particulière."
                ligne="Occasion · date et lieu · tenue personnalisée"
                cta={tenuesAVenir.length > 0 ? "Planifier une nouvelle tenue" : "Planifier une tenue"}
                onClick={recommencer}
                visuel={visuelHub("tenue", profile.gender)}
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
              )}

              {/* Le parcours valise existe depuis le 27/09/2026 : même règle d'accès que l'accueil (PREPARER_VALISE, dans le
                  store), et le retour ramène ici. */}
              {hub === "valise" && (
              <CartePlanifier
                glyphe={G_VALISE}
                etiquette="Voyage"
                titre={["Préparer", "ma valise"]}
                accroche="Une destination en vue ? On compose tes looks."
                description="Destination, météo, activités et dressing : Capsela prépare une sélection pensée pour ton voyage."
                ligne="Destination · dates · météo · activités"
                cta={valisesAVenir.length > 0 ? "Préparer une nouvelle valise" : "Préparer ma valise"}
                onClick={() => void actions.ouvrirValise(null)}
                visuel={visuelHub("valise", profile.gender)}
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
                      {valisesAVenir.slice(0, 2).map((v) => {
                        const enCours = v.depart <= jourLocal();
                        const prochain = !enCours && valisesAVenir.find((x) => x.depart > jourLocal())?.id === v.id;
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
                              {/* Une valise « à venir » le reste jusqu'à son retour : tant qu'on est parti, ce n'est plus un départ à
                                  venir (04/10/2026, signalé : « prochain départ » pour un séjour commencé). */}
                              {enCours ? (
                                <span className="block t-label text-terracotta">Ton séjour en cours</span>
                              ) : prochain ? (
                                <span className="block t-label text-terracotta">Ton prochain départ</span>
                              ) : null}
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
              )}
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

        {vue === "etape" && compose && (
          <div className="flex flex-col items-center text-center pt-10" role="status" aria-live="polite">
            <LoadingSpinner size={56} />
            <TitreEtape a="Capsela compose" b="ta tenue…" />
            <div className="t-chapeau text-muted mt-[6px]">Je sélectionne les pièces les plus adaptées à ton moment.</div>
            <ul className="mt-8 flex flex-col gap-4 text-left w-full max-w-[300px]">
              {([
                occ ? ["Ton occasion", occLabel] : null,
                meteoMoment && villeAffichee
                  ? ["La météo", `${villeAffichee} · ${meteoMoment.temp}° · ${meteoMoment.label}`]
                  : villeAffichee || lieu.trim()
                    ? ["Le lieu", villeAffichee || lieu.trim()]
                    : null,
                humeur ? ["Ta préférence", LIBELLE_HUMEUR[humeur]] : null,
                profile.styles.length ? ["Ton style", libelleStyles(profile.styles, profile.gender)] : null,
                ["Ton dressing", state.items.length ? `${state.items.length} pièce${state.items.length > 1 ? "s" : ""} disponible${state.items.length > 1 ? "s" : ""}` : "Complété par ta capsule"],
              ] as ([string, string] | null)[])
                .filter((x): x is [string, string] => !!x)
                .map(([titre, sous], i) => (
                  <li key={titre} className="flex items-center gap-3" style={{ opacity: coche > i ? 1 : 0.45 }}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-ink">{titre}</span>
                      <span className="block text-[11px] text-muted mt-[1px] truncate">{sous}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-cream"
                      style={{ background: coche > i ? "var(--color-terracotta-deep)" : "transparent", border: coche > i ? "none" : "1.5px solid var(--color-cream-dark-soft)" }}
                    >
                      {coche > i && (
                        <svg width="11" height="11" viewBox="0 0 24 24" style={{ display: "block" }}>
                          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
        )}
        {vue === "etape" && !compose && (
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
              /* LES TUILES PHOTO (maquettes du 07/10/2026) : les huit visuels éditoriaux d'occasion de l'app, sans personne,
                 trois par rangée. La sélection se lit par le contour ET la coche. Le sous-choix (Présentiel / Télétravail,
                 contexte du rendez-vous) naît dans un panneau sous la grille, à l'écran dès qu'on touche la tuile — le
                 défaut mesuré le 23/09 (question obligatoire sous le pli) ne revient pas : le panneau suit immédiatement. */
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-4 mt-5">
                  {OCCASIONS.map(([key, label]) => (
                    <TuileOccasion
                      key={key}
                      src={key !== "all" ? OCCASIONS_EDITORIALES[key]?.visuel?.src : undefined}
                      label={label}
                      actif={occ === key}
                      onClick={() => {
                        setOcc(key);
                        /* Le type de lieu déjà choisi ne survit pas à un changement d'occasion qui ne le propose plus —
                           sinon `planned_outfits.type_lieu` recevrait un « Bar / Rooftop » sur un Voyage. */
                        const permis = TYPES_LIEU_PAR_OCCASION[key];
                        if (!permis || (typeLieu !== TYPE_LIEU_AUTRE && !permis.includes(typeLieu ?? ""))) setTypeLieu(null);
                      }}
                    />
                  ))}
                </div>
                {occ && sousChoix && (
                  <div className="mt-5 rounded-bloc bg-warm-bg px-4 py-3" style={{ border: "1px solid var(--color-warm-border)" }}>
                    <div className="text-[12px] text-ink">{sousChoix.titre}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {sousChoix.valeurs.map((v) => {
                        const on = sousChoix.courant === v;
                        return (
                          <button
                            key={v}
                            onClick={() => sousChoix.choisir(v)}
                            aria-pressed={on}
                            className={
                              "inline-flex items-center gap-[7px] rounded-full px-[14px] text-[12px] cursor-pointer border transition-colors " +
                              (on ? "bg-terracotta border-terracotta text-cream" : "bg-card border-sand-border text-muted-3")
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
              </>
            )}

            {etape === 3 && (
              <>
                {/* LE CALENDRIER MENSUEL (maquette Planifier V3, 07/10/2026), à la place de la bande de 21 jours : on peut
                    préparer une tenue pour dans trois mois, la saison et l'occasion suffisent. Aujourd'hui est cerclé mais pas
                    proposé — la tenue du jour se prépare depuis l'accueil (règle du 27/09/2026, planJour ≥ 1). */}
                <CalendrierMois
                  mois={moisAffiche}
                  onMois={setMoisAffiche}
                  aujourdhui={dansNJours(0)}
                  premier={dansNJours(1)}
                  choisi={dateChoisie}
                  onChoisir={(d) => {
                    const t0 = dansNJours(0);
                    setJour(Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()).getTime()) / 86_400_000));
                  }}
                />
                {/* LA CARTE MÉTÉO : dès qu'une date est choisie. Trois états, tous vrais — la prévision du lieu, ou la date
                    à partir de laquelle elle existera, ou l'invitation à donner un lieu. Jamais une température inventée. */}
                {jour != null && dateChoisie && (
                  <Card rayon="bloc" className="mt-4 p-4" aria-live="polite">
                    {!lieu.trim() ? (
                      <div className="flex items-center gap-3">
                        <span className="text-muted-3"><IconeTuile nom="nuage" /></span>
                        <span className="flex-1 text-[13px] text-muted-3 leading-[1.45]">Ajoute un lieu pour que je tienne compte de la météo.</span>
                        <button onClick={() => setEtape(2)} className="t-lien text-terracotta-deep cursor-pointer" style={{ minHeight: 44 }}>Ajouter</button>
                      </div>
                    ) : previsionEtat === "encours" ? (
                      <div className="text-[13px] text-muted-3">Je regarde la météo à {villeAffichee || lieu.trim()}…</div>
                    ) : meteoJour ? (
                      <div className="flex items-center gap-3">
                        <span className="text-terracotta-deep"><IconeTuile nom={/soleil|dégagé|ensoleill/i.test(meteoJour.label) ? "apresmidi" : "nuage"} taille={26} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[12px] text-muted">{dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)} · {villeAffichee || lieu.trim()}</span>
                          <span className="block t-titre-carte text-ink mt-[2px]">
                            {meteoJour.tempMin === meteoJour.tempMax ? `${meteoJour.temp}°` : `${meteoJour.tempMin}° / ${meteoJour.tempMax}°`}
                          </span>
                          <span className="block text-[12px] text-muted-3 mt-[1px]">{meteoJour.label}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <span className="text-muted-3"><IconeTuile nom="nuage" /></span>
                        <span className="flex-1 text-[13px] text-muted-3 leading-[1.45]">
                          La météo sera disponible plus près de la date, à partir du {debutMeteo} Je l’ajouterai à ta tenue.
                        </span>
                      </div>
                    )}
                  </Card>
                )}
                <div className="mt-5">
                  <Surtitre>À quel moment ?</Surtitre>
                </div>
                <div className="grid grid-cols-2 gap-[10px] mt-3">
                  {MOMENTS.map(([m, d]) => (
                    <TuileIcone key={m} icone={ICONE_MOMENT[m] ?? "journee"} label={m} sousTitre={d} actif={moment === m} onClick={() => setMoment(m)} hauteur={84} />
                  ))}
                </div>
              </>
            )}

            {etape === 2 && (
              <EtapeLieu
                lieu={lieu}
                onChoisir={(v, libelle) => {
                  setVille(v);
                  setLieu(libelle);
                  // Nouvelle destination : la prévision de l'ancienne ne vaut plus, elle est redemandée (cf. l'effet plus haut).
                  setPrevision(null);
                  setPrevisionEtat("vide");
                }}
                types={typesLieuProposes}
                typeLieu={typeLieu}
                onType={setTypeLieu}
                meteo={meteoEtapeLieu}
              />
            )}

            {etape === 4 && (
              <div className="flex flex-col gap-[7px] mt-4" role="radiogroup" aria-label="Préférence pour cet événement">
                {HUMEURS.map((h) => (
                  <LigneIcone key={h.key} icone={h.key} label={h.label} actif={humeur === h.key} onClick={() => setHumeur(humeur === h.key ? null : h.key)} />
                ))}
                <LigneIcone icone="aucune" label="Aucune préférence" actif={humeur === null} onClick={() => setHumeur(null)} />
              </div>
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
            <Surtitre>{sansTenueTextes ? "À préparer" : "Tenue planifiée"}</Surtitre>
            {sansTenueTextes ? <TitreEtape a={sansTenueTextes.titreA} b={sansTenueTextes.titreB} /> : <TitreEtape a="Ta tenue est" b="prête" />}
            <div className="text-[13px] text-ink mt-[8px]">
              {occLabel} · {dateLongue}
              {moment ? ` · ${moment}` : ""}
            </div>
            <div className="text-[12px] text-muted mt-[2px]">
              {meteoMoment && villeAffichee
                ? `${villeAffichee} · ${meteoMoment.temp}° · ${meteoMoment.label}`
                : !lieu.trim()
                  ? "Lieu non précisé · météo non prise en compte"
                  : `${villeAffichee || lieu.trim()} · météo disponible à partir du ${debutMeteo}`}
            </div>

            {sansTenueTextes ? (
              <EmptyState forme="carte" className="mt-[18px]" titre={sansTenueTextes.titre}>
                {sansTenueTextes.body}
                {sansTenueTextes.suite && <span className="block mt-2 text-muted">{sansTenueTextes.suite}</span>}
              </EmptyState>
            ) : (
              <>
                <div className="mt-[14px] rounded-hero p-4" style={{ background: "var(--color-terracotta-deep)" }}>
                  <span
                    className="inline-block text-[10px] text-cream rounded-full px-[11px] py-[5px] whitespace-nowrap"
                    style={{ background: "rgba(251,243,234,.2)" }}
                  >
                    {composition ? (depuisPlan ? "Tenue déjà planifiée" : "Tenue de ta photo") : dressingSeul || nbCapsule === 0 ? "100% ton dressing" : "Ton dressing + ta capsule"}
                  </span>
                  <div className="mt-3" style={{ aspectRatio: "100 / 92" }}>
                    <OutfitComposition items={pieces} variant="planche" />
                  </div>
                </div>

                {/* UNE TENUE A TOUJOURS SES CHAUSSURES (08/10/2026, demandé) : quand le moteur n'en a trouvé aucune pour la saison de
                    la date, la phrase le dit au lieu de présenter une tenue incomplète comme finie. */}
                {!composition && pieces.length > 0 && !pieces.some((p) => p.cat === "chaussures") && (
                  <div role="status" className="mt-3 text-[12px] leading-[1.45] text-terracotta-deep">
                    {dressingSeul
                      ? "Aucune paire de chaussures de ton dressing ne convient à cette date. Décoche « Uniquement mon dressing » pour en voir une, ou ajoute-en une."
                      : "Aucune paire de chaussures ne convient à cette date pour l'instant."}
                  </div>
                )}

                {/* LES PIÈCES, en vignettes : de quoi la tenue est faite, d'un coup d'œil. */}
                <div className="flex gap-2 mt-3" aria-label="Les pièces de la tenue" role="list">
                  {pieces.slice(0, 4).map((p) => {
                    const img = resolveItemImage(p);
                    return (
                      <span key={p.id} role="listitem" aria-label={p.name} className="flex-1 aspect-square rounded-bloc bg-card border border-border overflow-hidden flex items-center justify-center">
                        {img.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
                        ) : (
                          <span className="block w-full h-full" style={{ background: p.hex }} />
                        )}
                      </span>
                    );
                  })}
                </div>

                {/* « POURQUOI CE LOOK ? » : une liste, sans carte (non cliquable). Seuls les critères réellement utilisés par le
                    moteur y figurent — le type de lieu n'y est pas, il n'entre pas dans le calcul. */}
                <div id="pourquoi" className="mt-6">
                  <div className="t-titre-carte text-ink">Pourquoi ce look ?</div>
                  <ul className="mt-2">
                    {([
                      ["journee", "Ton occasion", `${composition ? "Prévue" : "Pensée"} pour « ${occLong} »${occ === "travail_formel" ? ` · ${workMode}` : occ === "date" && dateContext ? ` · ${dateContext}` : ""}`],
                      ...(meteoMoment ? [["nuage", "La météo", phraseMeteo] as [IconePlanifier, string, string]] : []),
                      ...(!composition && !dressingSeul && nbCapsule > 0 && profile.styles.length
                        ? [["elegant", "Ton style", `Une base de ta capsule ${libelleStyles(profile.styles, profile.gender)}.`] as [IconePlanifier, string, string]]
                        : []),
                      ...(humeur && !composition ? [["confortable", "Ton envie", `« ${LIBELLE_HUMEUR[humeur]} » a départagé des tenues proches.`] as [IconePlanifier, string, string]] : []),
                      ["cintre", composition ? "Ta tenue" : "Ton dressing", provenance],
                    ] as [IconePlanifier, string, string][]).map(([icone, titre, texte]) => (
                      <li key={titre} className="flex gap-3 items-start py-3 border-b border-border last:border-b-0">
                        <span className="flex-shrink-0 text-terracotta mt-[1px]"><IconeTuile nom={icone} taille={18} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-semibold text-ink">{titre}</span>
                          <span className="block text-[12px] text-muted-3 leading-[1.45] mt-[1px]">{texte}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

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

              </>
            )}
          </>
        )}

        {vue === "alternatives" && (() => {
          // La tenue affichée d'abord, puis les alternatives : on peut toujours revenir à celle d'avant.
          const propositions: { ids: number[]; titre: string }[] = [
            { ids: idsAffiches, titre: "Proposition actuelle" },
            ...alternatives.map((ids, i) => ({ ids, titre: `Proposition ${i + 2}` })),
          ];
          const source = dressingSeul ? state.items : [...state.items, ...defaultCapsule];
          return (
            <>
              <Surtitre>Tenue planifiée</Surtitre>
              <TitreEtape a="Autres propositions" b="pour ce moment" />
              <div className="t-chapeau text-muted mt-[6px]">Mêmes infos, nouvelles idées. Choisis celle qui te parle.</div>
              {alternatives.length === 0 && (
                <div className="text-[13px] text-muted-3 mt-4 leading-[1.5]">
                  Le moteur n’a pas trouvé d’autre tenue avec ces mêmes informations. Tu peux modifier l’événement pour élargir la recherche.
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 mt-4" role="radiogroup" aria-label="Propositions de tenue">
                {propositions.map((pr, i) => {
                  const ps = pr.ids.map((id) => source.find((x) => x.id === id) ?? poolStable.find((x) => x.id === id)).filter((x): x is Item => !!x);
                  const on = altSel === i;
                  return (
                    <button
                      key={pr.ids.join("-")}
                      role="radio"
                      aria-checked={on}
                      onClick={() => setAltSel(i)}
                      className="text-left rounded-carte bg-card p-3 cursor-pointer"
                      style={{ border: `1.5px solid ${on ? "var(--color-terracotta-deep)" : "var(--color-border)"}` }}
                    >
                      <span className="grid grid-cols-2 gap-[4px] aspect-square">
                        {ps.slice(0, 4).map((p) => {
                          const img = resolveItemImage(p);
                          return (
                            <span key={p.id} className="rounded-champ bg-warm-bg overflow-hidden flex items-center justify-center">
                              {img.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={img.url} alt="" loading="lazy" className="w-full h-full object-contain" />
                              ) : (
                                <span className="block w-full h-full" style={{ background: p.hex }} />
                              )}
                            </span>
                          );
                        })}
                      </span>
                      <span className={"block text-[12px] mt-2 font-semibold " + (on ? "text-terracotta-deep" : "text-ink")}>{pr.titre}</span>
                      <span className="block text-[11px] text-muted mt-[1px] truncate">{ps.slice(0, 2).map((p) => p.name).join(" · ")}</span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={chercherAlternatives}
                className="w-full text-[13px] text-muted cursor-pointer underline mt-3"
                style={{ minHeight: 44 }}
              >
                Voir d’autres idées
              </button>
            </>
          );
        })()}

        {vue === "confirmation" && gardee && (() => {
          const d = new Date(`${gardee.jour}T12:00:00`);
          const gardees = gardee.pieceIds.map((id) => poolStable.find((i) => i.id === id)).filter((i): i is Item => !!i);
          const villeGardee = villeDuLieu(gardee.lieu);
          return (
            <div className="flex flex-col items-center text-center pt-6">
              <span aria-hidden="true" className="w-[52px] h-[52px] rounded-full flex items-center justify-center bg-terracotta-deep text-cream">
                <svg width="24" height="24" viewBox="0 0 24 24" style={{ display: "block" }}>
                  <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <TitreEtape a="Tenue" b="enregistrée" />
              <div className="t-chapeau text-muted mt-[6px]">Tu la retrouveras dans ton planning le jour venu.</div>
              <Card className="mt-6 w-full p-4 text-left">
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className="flex gap-[4px] flex-shrink-0">
                    {gardees.slice(0, 3).map((p) => {
                      const img = resolveItemImage(p);
                      return (
                        <span key={p.id} className="w-[38px] h-[38px] rounded-champ bg-warm-bg overflow-hidden flex items-center justify-center">
                          {img.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img.url} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <span className="block w-full h-full" style={{ background: p.hex }} />
                          )}
                        </span>
                      );
                    })}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block t-titre-vignette text-ink">
                      {DOW_LONG[d.getDay()].charAt(0).toUpperCase() + DOW_LONG[d.getDay()].slice(1)} {d.getDate()} {MOIS[d.getMonth()]}
                    </span>
                    <span className="block text-[12px] text-muted mt-[2px]">
                      {occasionShortLabel(gardee.occasion)} · {gardee.moment}
                      {villeGardee ? ` · ${villeGardee}` : ""}
                      {gardee.temp != null ? ` · ${Math.round(gardee.temp)}°` : ""}
                    </span>
                  </span>
                </div>
              </Card>
            </div>
          );
        })()}

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
        {vue === "etape" && !compose && (
          <>
            {/* LE MESSAGE DU BOUTON INACTIF, dit au tap (maquette V3) : « Continuer » n'est pas un `disabled` muet. */}
            {message && (
              <div role="status" className="text-center text-[12px] text-terracotta-deep mb-2">
                {message}
              </div>
            )}
            <Button
              onClick={() => {
                if (!etapeValide) {
                  setMessageBrut({
                    txt: etape === 1 ? "Choisis une occasion pour continuer." : jour == null ? "Choisis une date pour continuer." : "Choisis le moment de ta journée.",
                    cle: cleMessage,
                  });
                  return;
                }
                /* LE LIEU EST ARRÊTÉ en quittant l'étape « Où » : c'est ici qu'on demande la prévision, pas à chaque frappe —
                   un clic, une requête. Elle sert à la carte météo de l'étape « Quand » (ordre Occasion → Où → Quand,
                   maquette V3 du 07/10/2026) et à la composition. Un lieu vide est permis : on ne demande rien, la carte
                   propose d'en ajouter un. Une prévision indisponible est une réponse, pas un échec. */
                if (etape === 2) {
                  setPrevision(null);
                  if (lieu.trim()) {
                    setPrevisionEtat("encours");
                    previsionGardee(ville ? ville.name : lieu.trim(), ville)
                      .then((p) => setPrevision(p))
                      .catch(() => setPrevision(null))
                      .finally(() => setPrevisionEtat("faite"));
                  } else {
                    setPrevisionEtat("faite");
                  }
                }
                if (etape < derniere) setEtape(etape + 1);
                else {
                  setComposeDelaiOk(false);
                  setCoche(0);
                  setCompose(true);
                }
              }}
              aria-disabled={!etapeValide}
              className={!etapeValide ? "opacity-50" : ""}
            >
              {etape === derniere ? (etape === 4 ? "Composer ma tenue" : "Voir ma tenue") : "Continuer"}
            </Button>
          </>
        )}
        {vue === "etape" && !compose && etape === 4 && (
          <button
            onClick={() => {
              setHumeur(null);
              setComposeDelaiOk(false);
              setCoche(0);
              setCompose(true);
            }}
            className="w-full text-[13px] text-muted cursor-pointer underline"
            style={{ minHeight: 44 }}
          >
            Passer cette étape
          </button>
        )}
        {/* « + PLANIFIER UN LOOK » (30/09/2026) : la barre d'action pleine
            largeur de tous les écrans, pas une pastille flottante qui
            n'existait nulle part ailleurs. */}
        {vue === "liste" && (
          <Button onClick={recommencer}>+ Planifier un look</Button>
        )}
        {vue === "alternatives" && (
          <Button
            onClick={() => {
              const propositions = [idsAffiches, ...alternatives];
              const ids = propositions[altSel] ?? idsAffiches;
              if (ids !== idsAffiches) setChoixBrut({ cle: cleParams, ids });
              setVue("resultat");
            }}
          >
            Choisir cette tenue
          </Button>
        )}
        {vue === "confirmation" && (
          <>
            <Button
              onClick={() => {
                setVue("liste");
                setOnglet("up");
              }}
            >
              Voir ma planification
            </Button>
            <button onClick={() => setVue("intro")} className="w-full text-[13px] text-muted cursor-pointer underline" style={{ minHeight: 44 }}>
              Retour à Planifier
            </button>
          </>
        )}
        {vue === "resultat" && (
          <>
            {/* « Garder cette tenue » existe désormais vraiment (lot 3). Elle
                est désactivée quand il n'y a pas de tenue à garder — un état
                vide ne se planifie pas — et pendant l'écriture, pour qu'un
                double tap ne parte pas deux fois. */}
            {sansTenueTextes ? (
              sansTenueTextes.peutAjouter && <Button onClick={actions.openAddEtRevenir}>Ajouter des pièces</Button>
            ) : (
              <Button onClick={garder} disabled={enregistrement}>
                {enregistrement ? "Un instant…" : "Garder cette tenue"}
              </Button>
            )}
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
                {sansTenueTextes ? "Modifier cet événement" : "Modifier cet évènement"}
              </button>
              {/* Une composition imposée est LA tenue de la photo : pas de
                  nouveau tirage. Sans tenue, rien à régénérer. */}
              {!composition && !sansTenueTextes && (
                <button
                  onClick={() => {
                    chercherAlternatives();
                    setVue("alternatives");
                  }}
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
