"use client";

import TitrePage from "@/components/TitrePage";
import { useContexteLook, useRemplacementPiece } from "@/components/RemplacementPiece";
import { remplacerDansIds } from "@/lib/remplacementPiece";
import { masquerMenuActions } from "@/lib/menuActions";
import { autresIdees } from "@/lib/alternativesTenue";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useContexteRepris, useGarderContexte } from "@/lib/memoireEcrans";
import { sansBarre } from "@/lib/phraseOccasion";
import AgendaLooks, { type EtatAgenda } from "@/components/AgendaLooks";
import AppHeader from "@/components/AppHeader";
import BadgePremium from "@/components/BadgePremium";
import BottomSheet from "@/components/BottomSheet";
import GateAvisStyliste from "@/components/GateAvisStyliste";
import LoadingSpinner from "@/components/LoadingSpinner";
import { CalendrierMois, IconeTuile, LigneIcone, ProgressionLibelles, TuileIcone, TuileOccasion, type IconePlanifier } from "@/components/PlanifierUI";
import { OCCASIONS_EDITORIALES } from "@/lib/occasionEditoriale";
import { GlypheSousChoix } from "@/components/GlyphesOccasion";
import { HeroTenue, ICONES_INDICATEUR, IndicateursTenue, RailPiecesTenue } from "@/components/HeroTenue";
import { separerCoucheExterieure } from "@/lib/coucheExterieure";
import { basculerOccasion, occasionPrincipale, occasionsSecondaires, OCCASIONS_SEULES, tirerPolyvalente } from "@/lib/tenuePolyvalente";
import { BarreDuPlan } from "@/components/BarreDuJour";
import SegmentedControl from "@/components/SegmentedControl";
import TabBar from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { resolveItemImage } from "@/lib/catalogImages";
import { CATS, DATE_CONTEXTS, OCCASIONS, WORK_MODES, occasionShortLabel, type Weather } from "@/lib/data";
import { sansTenueCopy } from "@/lib/emptyStateCopy";
import { decisionAcces, premiumRequis } from "@/lib/autorisations";
import { candidatsDeRemplacement, SEUIL_MANTEAU } from "@/lib/logic";
import { humeursProposees, libelleHumeur, genererTenueHumeur, type Humeur } from "@/lib/humeur";
import { soireeHabillee } from "@/lib/occasions";
import { clePieces, jourLocal } from "@/lib/outfitFeedback";
import { alerteMeteoPlan, previsionAChange } from "@/lib/planDuJour";
import { ecartJoursDuPlan, useMeteoDuPlan } from "@/lib/useMeteoDuPlan";
import { useCalculAdaptation } from "@/components/PlansDuJour";
import { HORIZON_PREVISION_JOURS, joursCouverts, momentPossible, previsionPour, type MomentJournee, type Prevision } from "@/lib/prevision";
import { CHALEUR_HORS_SAISON, computeDefaultCapsule, saisonCalendairePour, saisonCapsuleDuJour, weatherForDay } from "@/lib/capsule";
import EtapeLieu, { type MeteoEtapeLieu } from "@/components/EtapeLieu";
import { meteoPourLaDate } from "@/lib/meteoPlan";
import { fetchClimat, previsionGardee, type Climat, type VilleSuggeree } from "@/lib/weather";
import { notifPieceRemplaceePlan } from "@/lib/centreNotifications";
import { noterNotifications } from "@/lib/notificationsStore";
import { deleteTenuePlanifiee, fetchTenuesPlanifiees, enregistrerConfirmationPlan, enregistrerHumeurPlan, enregistrerOccasionsSecondaires, upsertTenuePlanifiee, villeDuLieu, type TenuePlanifiee } from "@/lib/planifier";
import { repartirPlanifications, type ValiseGardee } from "@/lib/valises";
import { VISUEL_SEJOUR } from "@/lib/valise";
import { libelleStyles, paletteHexes } from "@/lib/profile";
import { accordVisage, colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { isCatalogId } from "@/lib/catalog";
import { poolDePlanification } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase";
import type { CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "@/lib/types";
import Button from "@/components/Button";
import LigneInterrupteur from "@/components/LigneInterrupteur";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import { degres } from "@/lib/unites";

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
const LIBELLES_ETAPES = ["Occasion", "Où et quand", "Préférences"] as const;
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
  premium = false,
  children,
}: {
  /** Le badge Premium : la valise seulement (17/10/2026, décidé : la planification de tenues n'est pas Premium). */
  premium?: boolean;
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
            {premium && <BadgePremium />}
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
        <span className="mt-[16px] flex items-center justify-center min-h-[52px] rounded-full bg-terracotta-deep text-cream t-bouton">{cta}</span>
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
  /** Les autres occasions cochées (tenue polyvalente, tenuePolyvalente.ts) : `occ` est l'occasion principale. */
  secondaires: OccasionKey[];
}) {
  if (!e.occ) return null;
  const occ = e.occ;
  const pool = poolDePlanification({ items: e.items, capsule: e.capsule, occasion: occ, dressingSeul: e.dressingSeul, meteo: e.meteo, categories: CAT_KEYS });
  const tirer = () =>
    genererTenueHumeur({
      pool,
      weather: e.meteo,
      occasion: occ,
      workMode: e.workMode,
      dateContext: e.dateContext,
      preferredHexes: paletteHexes(e.profile),
      gender: e.profile.gender,
      morphology: e.profile.morphology,
      colorimetrie: colorimetrieMoteur(e.profile.colorimetrie),
      humeur: e.humeur,
      soireeHabillee: occ === "soiree" && soireeHabillee({ typeLieu: e.typeLieu, humeur: e.humeur }),
    });
  // Plusieurs occasions : le moteur compose pour la principale, puis on retient le tirage qui convient aussi aux autres (04/11/2026).
  const { tenue, polyvalente } = tirerPolyvalente(
    tirer,
    (ids) => ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => !!p),
    e.secondaires,
    e.profile.gender
  );
  return tenue ? { ...tenue, polyvalente } : null;
}

/**
 * LE RÉSULTAT GARDÉ (04/11/2026) : la tenue proposée et les critères qui l'ont produite. « Avis d'un proche » et la fiche d'une pièce
 * quittent Planifier ; au retour, la même tenue se retrouve, sans refaire le parcours ni retirer le moteur. Un onglet de la barre du
 * bas l'oublie, comme le reste du contexte (memoireEcrans.ts).
 */
interface ResultatGarde {
  choisies: OccasionKey[];
  workMode: WorkMode;
  dateContext: DateContext;
  jour: number | null;
  moment: MomentJournee | null;
  lieu: string;
  ville: VilleSuggeree | null;
  typeLieu: string | null;
  humeur: Humeur | null;
  dressingSeul: boolean;
  ids: number[];
  prevision: Prevision | null;
  climatBrut: { cle: string; c: Climat | null } | null;
}

interface ContextePlanifier {
  vue: "intro" | "liste";
  hub: "tenue" | "valise";
  onglet: "up" | "past";
  etatAgenda: EtatAgenda;
  resultat?: ResultatGarde;
}

/** La clé des critères d'une tenue : une alternative choisie ne vaut que pour eux. */
const cleDesCriteres = (c: Pick<ResultatGarde, "choisies" | "dressingSeul" | "humeur" | "typeLieu" | "jour" | "moment" | "workMode" | "dateContext">) =>
  `${c.choisies.join(",")}|${c.dressingSeul}|${c.humeur}|${c.typeLieu}|${c.jour}|${c.moment}|${c.workMode}|${c.dateContext}`;

export default function PlanifierScreen() {
  const { state, weather, defaultCapsule, vestiairePool, wardrobePool, etatPremium, actions } = useCapsela();
  const { profile, userId } = useAuth();
  // « Adapter mon look » (12/10/2026) : le parcours s'ouvre sur la composition adaptée à la météo prévue, au pas « quand » du plan, avec ses
  // pièces et son lieu déjà posés (même mécanisme que « Modifier ce look » / « Tenue déjà planifiée » : la composition est imposée, le plan
  // est remplacé à l'enregistrement). Lu UNE fois, à l'ouverture ; l'état global est vidé par l'effet plus bas.
  const [adaptation] = useState(() => state.planAAdapter);
  const [notesAdaptation] = useState<string[]>(() => state.planAAdapter?.notes ?? []);

  // Retour de « Demander l'avis d'un proche » : le plan partagé se rouvre,
  // plutôt que de laisser sur le hub (l'état de cet écran est local).
  // « Planifier une tenue pour … » depuis Tenue (27/09/2026) : la date est
  // déjà choisie, le parcours s'ouvre sur ses étapes.
  /** Un parcours demandé par un autre écran (un plan à rouvrir, une tenue à planifier pour un jour…) prime sur le contexte gardé. */
  const entreeDemandee = !!(state.planARouvrir || state.planComposition || state.planJour != null || state.planAAdapter || state.planDirect);
  // AU RETOUR (22/10/2026, memoireEcrans.ts) : une valise ouverte depuis le hub ou la liste ramène au même onglet (Tenue ou Valise),
  // à la même vue (hub ou « Mes planifications ») et au même agenda. Les étapes d'un parcours ne sont pas gardées.
  const repris = useContexteRepris<ContextePlanifier>("planifier", entreeDemandee);
  const instant = repris?.resultat ?? null;
  const [vue, setVue] = useState<"intro" | "etape" | "resultat" | "liste" | "detail" | "confirmation">(() =>
    state.planARouvrir ? "detail" : entreeDemandee ? "etape" : instant ? "resultat" : (repris?.vue ?? "intro")
  );
  /**
   * COMPOSITION IMPOSÉE (Avis de styliste V2, 26/09/2026) : les pièces
   * reconnues sur la photo d'un avis. Le parcours reste le même — occasion,
   * date, lieu —, mais la tenue n'est pas recomposée par le moteur : c'est
   * celle de la photo qui est gardée. « Planifier une tenue » depuis le hub
   * repart sans elle (recommencer).
   */
  const [composition, setComposition] = useState<number[] | null>(() => state.planComposition?.pieceIds ?? state.planAAdapter?.ids ?? null);
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
    if (state.planAAdapter) actions.oublierPlanAAdapter();
    if (state.planJour != null) actions.oublierPlanJour();
    if (state.planDirect) actions.oublierPlanDirect();
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
  const [depuisPlan, setDepuisPlan] = useState<{ plan: TenuePlanifiee; remplacer: boolean } | null>(() => (state.planAAdapter ? { plan: state.planAAdapter.plan, remplacer: true } : null));
  const [aSupprimer, setASupprimer] = useState<TenuePlanifiee | null>(null);
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
  const [etape, setEtape] = useState(() => (instant ? 3 : state.planAAdapter ? 2 : 1));
  /**
   * LES OCCASIONS DU MOMENT (04/11/2026, « une ou plusieurs ») dans l'ordre du choix. `occ` est l'occasion PRINCIPALE, celle pour laquelle
   * le moteur compose (tenuePolyvalente.ts) ; `setOcc` choisit une seule occasion (reprise d'un plan, retour d'un avis).
   */
  const [choisies, setChoisies] = useState<OccasionKey[]>(() => {
    if (instant) return instant.choisies;
    const p = state.planAAdapter?.plan;
    return p ? [p.occasion, ...(p.occasionsSecondaires ?? [])] : [];
  });
  const occ = occasionPrincipale(choisies);
  const secondaires = occasionsSecondaires(choisies);
  const setOcc = (o: OccasionKey | null) => setChoisies(o ? [o] : []);
  const [workMode, setWorkMode] = useState<WorkMode>(() => {
    if (instant) return instant.workMode;
    const p = state.planAAdapter?.plan;
    return p?.occasion === "travail_formel" && WORK_MODES.includes(p.sousChoix as WorkMode) ? (p.sousChoix as WorkMode) : "Présentiel";
  });
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
  const [dateContext, setDateContext] = useState<DateContext>(() => {
    if (instant) return instant.dateContext;
    const p = state.planAAdapter?.plan;
    return p?.occasion === "date" && DATE_CONTEXTS.some(([c]) => c === p.sousChoix) ? (p.sousChoix as DateContext) : DATE_CONTEXTS[0][0];
  });
  // « Planifier pour demain » depuis un avis : la date est déjà connue.
  // Depuis Tenue, le jour consulté (planJour, ≥ 1 : depuis Tenue et le Calendrier, aujourd'hui reste la tenue du jour ; Planifier le propose lui-même depuis le 04/11/2026).
  const [jour, setJour] = useState<number | null>(() => {
    if (instant) return instant.jour;
    const p = state.planAAdapter?.plan;
    if (p) {
      const midi = new Date();
      midi.setHours(12, 0, 0, 0);
      const ecart = Math.round((new Date(`${p.jour}T12:00:00`).getTime() - midi.getTime()) / 86400000);
      return ecart >= 0 && ecart <= JOURS_PROPOSES ? ecart : null;
    }
    return state.planComposition?.demain ? 1 : state.planJour;
  });
  const [moment, setMoment] = useState<MomentJournee | null>(() => (instant ? instant.moment : (state.planAAdapter?.plan.moment ?? null)));
  /** Le mois affiché par le calendrier de l'étape « Quand » : celui de la date déjà choisie, sinon le mois courant. */
  const [moisAffiche, setMoisAffiche] = useState<Date>(() => {
    const d = dansNJours(jour ?? 0);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [lieu, setLieu] = useState(() => (instant ? instant.lieu : (state.planAAdapter?.plan.lieu ?? "")));
  /**
   * VILLE CHOISIE DANS LES SUGGESTIONS, avec ses coordonnées — `null` tant
   * qu'on tape librement. C'est elle qui part chercher la prévision quand
   * elle existe : un point, pas une chaîne à réinterpréter. La saisie libre
   * reste acceptée (l'autocomplétion peut être indisponible), elle est
   * simplement moins sûre.
   */
  const [ville, setVille] = useState<VilleSuggeree | null>(() => instant?.ville ?? null);
  const [typeLieu, setTypeLieu] = useState<string | null>(() => (instant ? instant.typeLieu : (state.planAAdapter?.plan.typeLieu ?? null)));
  /**
   * « Une dernière préférence ? » (07/10/2026) : facultative, jamais mémorisée dans le profil. Elle ne fait que départager
   * des tenues déjà compatibles (humeur.ts). Une composition imposée (photo d'un avis) n'a pas cette étape : sa tenue est faite.
   */
  const [humeur, setHumeur] = useState<Humeur | null>(() => (instant ? instant.humeur : (state.planAAdapter?.plan.humeur ?? null)));
  /** L'écran « Capsela compose ta tenue… » : affiché entre la dernière question et le résultat, le temps de la prévision. */
  const [compose, setCompose] = useState(false);
  /** La tenue qui vient d'être gardée — pour l'écran de confirmation. */
  const [gardee, setGardee] = useState<TenuePlanifiee | null>(null);
  const [composeDelaiOk, setComposeDelaiOk] = useState(false);
  const [coche, setCoche] = useState(0);
  const [dressingSeul, setDressingSeul] = useState(() => (instant ? instant.dressingSeul : (state.planAAdapter?.plan.dressingSeul ?? false)));
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
  const [onglet, setOnglet] = useState<"up" | "past">(repris?.onglet ?? "up");
  // L'AGENDA DE « MES LOOKS À VENIR » (17/10/2026) : vue Agenda, Jour ou Liste, le jour choisi et le mois affiché. Porté ici pour
  // survivre à l'ouverture du détail d'un look : le retour ramène au même jour, au même mois.
  const [etatAgenda, setEtatAgenda] = useState<EtatAgenda>(() => repris?.etatAgenda ?? { mode: "agenda", jour: jourLocal(), mois: jourLocal() });
  /** Le hub n'affiche qu'une expérience à la fois (08/10/2026) : la tenue par défaut, ou la valise. */
  const [hub, setHub] = useState<"tenue" | "valise">(repris?.hub ?? "tenue");

  const [toast, setToast] = useState<string | null>(null);

  const [prevision, setPrevision] = useState<Prevision | null>(() => instant?.prevision ?? null);
  const [previsionEtat, setPrevisionEtat] = useState<"vide" | "encours" | "faite">(() => (instant ? "faite" : "vide"));

  const occLabel = occ && occ !== "all" ? occasionShortLabel(occ) : "";
  const occLong = occ ? (OCCASIONS.find(([k]) => k === occ)?.[1] ?? "") : "";

  /**
   * Types de lieu proposés pour l'occasion en cours — vide quand la question
   * ne se pose pas. Le choix déjà fait est effacé si l'occasion change et ne
   * le propose plus : sinon `planned_outfits.type_lieu` recevrait un « Bar /
   * Rooftop » sur un Voyage, choisi puis devenu invisible.
   */
  const typesLieuProposes = (() => {
    const permis = occ ? TYPES_LIEU_PAR_OCCASION[occ] : undefined;
    if (!permis) return [] as string[];
    // « Autre » ferme la liste (08/10/2026). Il n'est pas écrit en base — la colonne n'accepte que les cinq autres valeurs : il se
    // lit comme « pas de précision » à l'enregistrement (cf. TYPE_LIEU_AUTRE).
    return [...TYPES_LIEU.filter(([t]) => permis.includes(t)).map(([t]) => t), TYPE_LIEU_AUTRE];
  })();
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
  const [climatBrut, setClimatBrut] = useState<{ cle: string; c: Climat | null } | null>(() => instant?.climatBrut ?? null);
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
  // LA CHALEUR DE LA DATE (22/10/2026, demandé : « pioche dans les bonnes capsules ») : la saison de la capsule suit la météo de la date,
  // bornée par son calendrier sous la vraie chaleur — la règle de la tenue du jour (saisonCapsuleDuJour). Avant : la saison calendaire
  // seule, et un 28° d'octobre se composait dans la capsule d'automne.
  const capsuleDeLaDate = useMemo(
    () =>
      saisonDeLaDate
        ? computeDefaultCapsule(profile, meteoUtilisee, state.suggestedExcluded, saisonCapsuleDuJour(meteoUtilisee.temp, saisonDeLaDate), vestiairePool)
        : defaultCapsule,
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
    secondaires,
  };
  const cleOccasions = choisies.join(",");
  const tenue = useMemo(
    () => composerTenuePlan(entreesMoteur),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cleOccasions, dressingSeul, state.items, capsuleDeLaDate, meteoUtilisee, workMode, dateContext, profile, humeur, typeLieu]
  );
  /** La tenue choisie par « Autre tenue » : valable tant que les critères qui l'ont produite ne changent pas. */
  const cleParams = cleDesCriteres({ choisies, dressingSeul, humeur, typeLieu, jour, moment, workMode, dateContext });
  // Au retour d'un résultat gardé, la tenue qui était affichée, et non un nouveau tirage.
  const [choixBrut, setChoixBrut] = useState<{ cle: string; ids: number[] } | null>(() => (instant ? { cle: cleDesCriteres(instant), ids: instant.ids } : null));
  const choisie = choixBrut?.cle === cleParams ? choixBrut.ids : null;
  /** Toutes les tenues déjà montrées pour ces critères, et si le dressing n'en a plus d'assez différente (autresIdees, 20/10/2026). */
  const [altsBrut, setAltsBrut] = useState<{ cle: string; vues: number[][]; epuise: boolean } | null>(null);
  const alternativesEpuisees = altsBrut?.cle === cleParams && altsBrut.epuise;
  const idsAffiches = composition ?? choisie ?? tenue?.ids ?? [];
  /*
   * LE FLAT LAY INTERACTIF (12/11/2026, RemplacementPiece). La tenue PROPOSÉE : le remplacement change la tenue affichée (la composition
   * imposée, ou le choix gardé pour ces critères), rien n'est écrit avant « Garder cette tenue ». Une tenue DÉJÀ PLANIFIÉE : le
   * remplacement est enregistré dans la tenue planifiée (arbitré le 12/11/2026), par la même écriture que la planification ; un échec est dit.
   */
  const remplacement = useRemplacementPiece();
  const contexteResultat = useContexteLook({ occasion: occ ?? "all", weather: meteoUtilisee, workMode, dateContext });
  const remplacerDansResultat = (a: number, n: number) => {
    const ids = remplacerDansIds(idsAffiches, a, n);
    if (composition) setComposition(ids);
    else setChoixBrut({ cle: cleParams, ids });
    return true;
  };
  const remplacerDansPlan = async (plan: TenuePlanifiee, a: number, n: number) => {
    if (!userId) return false;
    const { id: _id, ...sansId } = plan;
    void _id;
    try {
      const ligne = await upsertTenuePlanifiee(userId, { ...sansId, pieceIds: remplacerDansIds(plan.pieceIds, a, n) });
      // La ligne relue garde ce que l'upsert n'écrit pas (humeur, autres occasions) : repris du plan.
      const majPlan: TenuePlanifiee = { ...plan, ...ligne, humeur: plan.humeur, occasionsSecondaires: plan.occasionsSecondaires };
      setPlans((l) => l.map((x) => (x.id === plan.id ? majPlan : x)));
      setPlanOuvert((o) => (o && o.id === plan.id ? majPlan : o));
      // Une tenue ENREGISTRÉE a changé (centre de notifications, 12/11/2026) : utile à retrouver le jour venu.
      const nom = (id: number) => [...state.items, ...vestiairePool].find((p) => p.id === id)?.name;
      const ancien = nom(a);
      const nouvel = nom(n);
      if (ancien && nouvel) noterNotifications(notifPieceRemplaceePlan(String(plan.id), ancien, nouvel));
      return true;
    } catch {
      return false;
    }
  };
  /**
   * « AUTRE TENUE » (04/11/2026, brief « Évolution du parcours de planification ») : une nouvelle proposition, à la place de celle-ci, avec
   * les mêmes critères — le même moteur, les mêmes paramètres — et jamais une tenue déjà montrée pour eux (autresIdees : un autre socle, ou
   * deux pièces principales changées). Plus d'idée assez différente : on le dit, au lieu de reproposer la même.
   */
  const autreTenue = () => {
    const dejaVues = altsBrut?.cle === cleParams ? altsBrut.vues : [idsAffiches];
    const poolJuge = [...state.items, ...capsuleDeLaDate, ...vestiairePool];
    const tirer = () => {
      const t = composerTenuePlan(entreesMoteur);
      return t && !t.noCompleteOutfit && t.ids.length ? t.ids : null;
    };
    const { idees } = autresIdees(tirer, dejaVues, poolJuge, 1, 40);
    if (!idees.length) {
      setAltsBrut({ cle: cleParams, vues: dejaVues, epuise: true });
      return;
    }
    setAltsBrut({ cle: cleParams, vues: [...dejaVues, idees[0]], epuise: false });
    setChoixBrut({ cle: cleParams, ids: idees[0] });
  };
  const autreIndisponible = alternativesEpuisees;
  /** La tenue affichée est-elle déjà dans « Mes looks » ? Même comparaison que le cœur des idées de look (mêmes pièces). */
  const lookEnregistre = idsAffiches.length > 0 && state.savedLooks.some((l) => clePieces(l.pieceIds).join(",") === clePieces(idsAffiches).join(","));

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
    const source = dressingSeul ? state.items : [...state.items, ...capsuleDeLaDate];
    return idsAffiches.map((id) => source.find((i) => i.id === id)).filter((i): i is Item => !!i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composition, tenue, choisie, state.items, vestiairePool, capsuleDeLaDate, dressingSeul]);
  /*
   * LA TENUE PROPOSÉE ET SA COUCHE EXTÉRIEURE (04/11/2026, coucheExterieure.ts) : pour une tenue que le moteur vient de composer, le
   * manteau ajouté par le froid se montre à part, avec la PRÉVISION de l'événement (meteoMoment) — sans prévision, rien n'est séparé.
   * Une composition reprise (photo d'un avis, plan déjà fait) reste telle qu'elle a été composée. Le plan enregistre toutes les pièces.
   */
  // Par le froid, les manteaux que le moteur admet pour cette date (le même pool que la composition) : une tenue sans manteau en reçoit un.
  const candidatsResultat =
    !composition && meteoMoment && meteoMoment.temp < SEUIL_MANTEAU && pieces.length
      ? candidatsDeRemplacement(pieces, dressingSeul ? state.items : [...state.items, ...capsuleDeLaDate], -1, "manteau", occ ?? "all", workMode, dateContext, meteoUtilisee)
      : [];
  const tempResultat = composition ? null : (meteoMoment?.temp ?? null);
  const coloResultat = colorimetrieMoteur(profile.colorimetrie);
  const { principal: piecesDuLook } = separerCoucheExterieure(pieces, tempResultat, candidatsResultat);
  /** Rien à garder : état vide du moteur — une composition imposée en a toujours une. */
  const sansTenue = !composition && (!tenue || tenue.noCompleteOutfit);
  /** Les mots de l'état sans tenue : dressing vide, pièces manquantes, ou pas de combinaison pour l'occasion (emptyStateCopy.ts). */
  const sansTenueTextes = sansTenue ? sansTenueCopy(state.items.length, dressingSeul, tenue?.reason, dressingSeul ? "ton dressing" : "ton dressing et ta capsule") : null;
  // Le contexte gardé au démontage (useGarderContexte) : le hub, l'agenda, et le résultat affiché (ResultatGarde).
  useGarderContexte(
    "planifier",
    (): ContextePlanifier => ({
      vue: vue === "liste" ? "liste" : "intro",
      hub,
      onglet,
      etatAgenda,
      ...(vue === "resultat" && !composition && !depuisPlan && !sansTenue && idsAffiches.length
        ? { resultat: { choisies, workMode, dateContext, jour, moment, lieu, ville, typeLieu, humeur, dressingSeul, ids: idsAffiches, prevision, climatBrut } }
        : {}),
    })
  );
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
  // Le décompte porte sur le look affiché, sans le manteau montré à part (04/11/2026).
  const nbDressing = piecesDuLook.filter((p) => idsDressing.has(p.id)).length;
  const nbCapsule = piecesDuLook.length - nbDressing;
  // Les indicateurs du résultat (04/11/2026), mêmes règles que le Look planifié : rien sans la donnée, rien qui ne soit vrai.
  const indicateursResultat = [
    ...(!dressingSeul && nbCapsule > 0 && profile.styles.length
      ? [{ cle: "style", icone: ICONES_INDICATEUR.style, texte: libelleStyles(profile.styles, profile.gender) }]
      : []),
    ...(occ && occ !== "all" ? [{ cle: "occasion", icone: ICONES_INDICATEUR.occasion, texte: [occ, ...secondaires].map((o) => occasionShortLabel(o)).join(" · ") }] : []),
    ...(meteoMoment && !composition && !alerteMeteoPlan(piecesDuLook, meteoMoment)
      ? [{ cle: "meteo", icone: ICONES_INDICATEUR.meteo, texte: `Adaptée à ${degres(meteoMoment.temp)}` }]
      : []),
    ...(coloResultat && accordVisage(piecesDuLook, coloResultat) ? [{ cle: "palette", icone: ICONES_INDICATEUR.palette, texte: "Ta palette", coche: true }] : []),
  ];

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
    ? `${pluriel(piecesDuLook.length)} de ton dressing, sans complément`
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
    const aujourdhui = `${degres(weather.temp)}, ${weather.label.toLowerCase()}`;
    // Avant l'appel, rien à dire : la phrase n'est plus affichée pendant les
    // étapes (recette du 26/09/2026 — une question par étape, la météo n'en
    // est pas une), seulement dans « Pourquoi ce look ? », après l'appel.
    if (previsionEtat !== "faite") return "";
    if (meteoMoment) {
      const amplitude =
        meteoMoment.tempMin === meteoMoment.tempMax
          ? `${degres(meteoMoment.temp)}`
          : `de ${degres(meteoMoment.tempMin)} à ${degres(meteoMoment.tempMax)}`;
      // « La tenue en tient compte » retiré le 18/10/2026 (demandé) : le bloc « Pourquoi ce look ? » le dit déjà par sa place.
      return `Prévision à ${villeAffichee} pour ce moment : ${amplitude}, ${meteoMoment.label.toLowerCase()}.`;
    }
    if (prevision && dernierJourConnu && dateChoisie && jourLocal(dateChoisie) > dernierJourConnu) {
      const d = new Date(`${dernierJourConnu}T12:00:00`);
      return climat
        ? `La prévision ne va que jusqu'au ${d.getDate()} ${MOIS[d.getMonth()]}. Au-delà, la tenue suit les températures habituelles de ${villeAffichee} à cette date : ${degres(climat.tempMin)} à ${degres(climat.tempMax)}.`
        : `La prévision ne va que jusqu'au ${d.getDate()} ${MOIS[d.getMonth()]}. Au-delà, la tenue suit la saison de la date et ses températures habituelles.`;
    }
    return auDela
      ? climat
        ? `Pas de prévision pour cette date. La tenue suit les températures habituelles de ${villeAffichee} à cette date : ${degres(climat.tempMin)} à ${degres(climat.tempMax)}.`
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
  const enregistrementEnCours = useRef(false);
  const garder = async () => {
    if (!userId || !occ || jour == null || !moment || sansTenue) return;
    // Un double clic ne lance pas deux enregistrements (l'état `enregistrement` n'est à jour qu'au rendu suivant).
    if (enregistrementEnCours.current) return;
    enregistrementEnCours.current = true;
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
      // « PORTER CETTE TENUE » (04/11/2026) : la tenue est associée à sa date, « Planifiée » — pas « Confirmée » (arbitré le même jour par la
      // propriétaire : la confirmation reste « Je porterai cette tenue », sur la page Look planifié). Les autres occasions d'une tenue
      // polyvalente s'écrivent à part (migration 0058) : avant la migration, la tenue est gardée sans elles et l'échec est dit.
      const secondairesGardees = secondaires.length ? await enregistrerOccasionsSecondaires(ligne.id, secondaires) : true;
      const gardeeComplete: TenuePlanifiee = {
        ...ligne,
        ...(humeur && !composition && humeurGardee ? { humeur } : null),
        ...(secondaires.length && secondairesGardees ? { occasionsSecondaires: secondaires } : null),
      };
      setPlans((l) => [...l.filter((x) => x.id !== ligne.id), gardeeComplete]);
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
      if (ancienRetire && humeurGardee && secondairesGardees) {
        setGardee(gardeeComplete);
        setVue("confirmation");
        return;
      }
      setVue("liste");
      flash(
        !ancienRetire
          ? "La nouvelle date est gardée. L'ancienne n'a pas pu être retirée : supprime-la depuis ta liste."
          : !humeurGardee
            ? "Tenue enregistrée. Ta préférence n'a pas pu l'être : elle ne sera pas rappelée à l'ouverture."
            : !secondairesGardees
              ? `Tenue enregistrée pour ${occasionShortLabel(occ)}. Les autres occasions n'ont pas pu l'être : elles ne seront pas rappelées.`
              : "Tenue enregistrée. Tu la retrouveras dans ton planning le jour venu."
      );
    } catch {
      flash("L'enregistrement a échoué. Réessaie.");
    } finally {
      enregistrementEnCours.current = false;
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

  /** L'écart en jours entre aujourd'hui et un jour « AAAA-MM-JJ », en dates locales (midi : pas de bascule d'heure d'été). */
  const ecartDuJour = (j: string) => Math.round((new Date(`${j}T12:00:00`).getTime() - new Date(`${jourLocal()}T12:00:00`).getTime()) / 86_400_000);

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
  // LE MENU D'ACTIONS FLOTTANT SUR L'ACCUEIL DE PLANIFIER (12/11/2026, demandé ; menuActions.ts). Ses étapes et ses autres vues
  // posent leur propre action en bas d'écran : le menu s'y efface (avant l'affichage, sans clignotement).
  useLayoutEffect(() => {
    masquerMenuActions("planifier-parcours", vue !== "intro");
  }, [vue]);
  useLayoutEffect(() => () => masquerMenuActions("planifier-parcours", false), []);
  // « Planifier une tenue » demandé par le menu alors que Planifier est déjà ouvert : la demande n'est lue qu'à l'arrivée sur
  // l'écran, elle est donc reprise ici — le même geste que le bouton de la carte du hub.
  useEffect(() => {
    if (!state.planDirect || vue === "etape") return;
    // Une demande venue d'un autre composant (le store), comme les entrées lues à l'arrivée : l'effet est le bon endroit.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recommencer();
    actions.oublierPlanDirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.planDirect]);


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
  // « Actualiser la tenue » d'un plan dont la prévision a changé (04/11/2026) : le calcul, et l'identifiant du plan pour lequel il n'a rien
  // trouvé à changer (le message ne suit pas un autre plan).
  const calculerAdaptation = useCalculAdaptation();
  // La page « Look planifié » (04/11/2026) : la confirmation « Je porterai cette tenue ».
  const [confirmationEchouee, setConfirmationEchouee] = useState<string | null>(null);
  const confirmerPlan = (t: TenuePlanifiee, confirme: boolean) => {
    // Affichée tout de suite (le plan ouvert et la liste) ; écrite à part, comme l'humeur : avant la migration 0057, l'échec est dit.
    setPlanOuvert((p) => (p && p.id === t.id ? { ...p, confirme } : p));
    setPlans((l) => l.map((x) => (x.id === t.id ? { ...x, confirme } : x)));
    setConfirmationEchouee(null);
    void enregistrerConfirmationPlan(t.id, confirme).then((ok) => {
      if (!ok) setConfirmationEchouee(t.id);
    });
  };
  const [tenueToujoursOk, setTenueToujoursOk] = useState<string | null>(null);
  const repartirDuPlan = (t: TenuePlanifiee, mode: "modifier" | "deplacer" | "dupliquer") => {
    setChoisies([t.occasion, ...(t.occasionsSecondaires ?? [])]);
    if (t.occasion === "travail_formel" && WORK_MODES.includes(t.sousChoix as WorkMode)) setWorkMode(t.sousChoix as WorkMode);
    if (t.occasion === "date" && DATE_CONTEXTS.some(([c]) => c === t.sousChoix)) setDateContext(t.sousChoix as DateContext);
    const aujourdhui = new Date();
    aujourdhui.setHours(12, 0, 0, 0);
    const ecart = Math.round((new Date(`${t.jour}T12:00:00`).getTime() - aujourdhui.getTime()) / 86400000);
    // Déplacer ou dupliquer : c'est justement la date qui va changer, on la laisse à choisir.
    setJour(mode === "modifier" && ecart >= 0 && ecart <= JOURS_PROPOSES ? ecart : null);
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
    setEtape(mode === "modifier" ? 1 : 2);
  };

  /** Le message sous le bouton inactif : lié à l'état qui l'a provoqué, il disparaît dès qu'on change d'étape ou de choix. */
  const [messageBrut, setMessageBrut] = useState<{ txt: string; cle: string } | null>(null);
  const cleMessage = `${etape}|${occ}|${jour}|${moment}`;
  const message = messageBrut?.cle === cleMessage ? messageBrut.txt : null;
  /**
   * Trois questions (04/11/2026 : « Où » et « Quand » réunies en « Où et quand ? »), deux pour une tenue imposée (sa composition est faite,
   * la préférence n'aurait rien à départager).
   */
  const derniere = composition ? 2 : 3;
  const etapeValide = etape === 1 ? !!occ : etape === 2 ? jour != null && !!moment && momentPossible(moment, jour) : true;

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
    // Dans l'agenda, la vue Jour et la vue Liste reviennent d'abord au calendrier.
    if (vue === "liste" && etatAgenda.mode !== "agenda") {
      setEtatAgenda({ ...etatAgenda, mode: "agenda" });
      return;
    }
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
    } else if (vue === "liste" || vue === "confirmation") setVue("intro");
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
    1: [`Étape 1 sur ${derniere}`, "Quelle est", "l'occasion ?", "Une ou plusieurs : Capsela compose une tenue qui passe de l'une à l'autre."],
    // « Où » et « Quand » réunies (04/11/2026, brief « Évolution du parcours de planification ») : la date fixe la saison, le lieu la prévision,
    // le moment le créneau de la prévision. Le type de lieu précise l'occasion ; le moteur le lit pour une soirée (soireeHabillee).
    2: [`Étape 2 sur ${derniere}`, "Où et", "quand ?", "Capsela adapte la tenue à la date, au lieu et à la météo de ce moment."],
    // Une préférence, pas un style : elle ne départage que des tenues déjà compatibles (humeur.ts).
    3: [`Étape 3 sur ${derniere}`, "Une", "préférence ?", "Facultatif : comment veux-tu te sentir dans cette tenue ?"],
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
                : state.planRetour === "home"
                  ? "Revenir à l'accueil"
                  : "Revenir"
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

      <div ref={zoneScroll} className={"scrollarea flex-1 min-h-0 overflow-y-auto px-6 " + (vue === "intro" ? "pt-[6px] " : "pt-4 ") + (vue === "intro" || vue === "detail" ? "pb-safe-nav" : "pb-5")}>
        {/* LE HUB « PLANIFIER » — brief « Page Planifier, design + UX »
            (transmis le 25/09/2026, source de vérité). Trois questions dans
            l'ordre du brief : que puis-je planifier, comment commencer,
            qu'ai-je déjà planifié. La promesse d'abord, puis les deux
            parcours, puis les planifications. */}
        {vue === "intro" && (
          <>
            {/* Le titre à la même hauteur que sur les autres onglets (mesuré en rendu : le bandeau de cet écran est hors de la zone qui
                défile, d'où une marge plus courte ici) ; le surtitre « Planifier », qui répétait
                l'onglet, est retiré (TitrePage, 12/11/2026). */}
            <TitrePage decalage={2} chapeau="Des tenues pensées pour tes occasions et tes voyages, selon ton style, la météo et ton dressing.">
              Anticipe tes moments. <span className="italic text-terracotta">Capsela s&apos;occupe du look</span>
            </TitrePage>

            {/* LES DEUX VISUELS ÉDITORIAUX sont ceux d'avant (recette du 26/09/2026, fournis par la propriétaire) : une tenue
                pour « Planifier une tenue », la valise ouverte pour « Préparer ma valise » — les deux pour un profil femme,
                la valise et la tenue pour un profil homme. Sans genre renseigné, pas de visuel choisi au hasard : la
                carte garde sa forme d'avant, glyphe seul. Ils inspirent et expliquent ; les pièces réelles de la personne
                n'apparaissent que dans ce qu'elle a déjà créé, sous le bouton de création. */}
            {/* Une seule carte à la fois ; elle apparaît par le fondu léger de l'app (capsule-apparition, 220 ms), sans animation si le
                téléphone demande moins de mouvement. */}
            {/* LES DEUX ENTRÉES DE PLANIFIER, VISIBLES DÈS L'ARRIVÉE (12/11/2026, brief 2.3, point 7 : « les entrées Tenue et Valise ne
                sont pas suffisamment visibles »). Le sélecteur à deux segments, discret, devient deux tuiles côte à côte : le visuel
                éditorial de chacune (celui qui ouvrait sa carte, qui ne le répète plus), son nom et une ligne. La tuile choisie se marque
                par la bordure terracotta et le fond de sélection, comme les autres choix de l'app ; elle ouvre toujours sa carte dessous. */}
            <div className="grid grid-cols-2 gap-[10px] mt-5" role="tablist" aria-label="Ce que tu veux planifier">
              {(
                [
                  ["tenue", "Tenue", "Une occasion à venir"],
                  ["valise", "Valise", "Un voyage à préparer"],
                ] as const
              ).map(([cle, nom, ligne]) => {
                const on = hub === cle;
                return (
                  <button
                    key={cle}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setHub(cle)}
                    className={
                      "flex flex-col text-left rounded-tuile overflow-hidden border cursor-pointer transition-colors duration-150 " +
                      (on ? "bg-selected-bg border-terracotta" : "bg-card border-border")
                    }
                    style={{ borderWidth: 1.5 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={visuelHub(cle, profile.gender)}
                      alt=""
                      width={900}
                      height={600}
                      decoding="async"
                      className="block w-full object-cover"
                      style={{ aspectRatio: "4/3", objectPosition: cle === "valise" ? "center 60%" : "center 38%" }}
                    />
                    <span className="block px-[12px] pt-[10px] pb-[12px]">
                      <span className={"block t-titre-carte " + (on ? "text-terracotta" : "text-ink")}>{nom}</span>
                      <span className="block text-[12px] text-muted-3 leading-[1.35] mt-[2px]">{ligne}</span>
                    </span>
                  </button>
                );
              })}
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
              >
                {/* Ce qui existe déjà : trois au plus, « Voir tout » ouvre la liste complète. Le premier est le prochain. */}
                {tenuesAVenir.length > 0 && (
                  <>
                    <EnteteExistant
                      titre="Tes tenues planifiées"
                      nombre={tenuesAVenir.length}
                      onVoirTout={() => {
                        setOnglet("up");
                        setEtatAgenda((e) => ({ ...e, mode: "agenda" }));
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
              >
                {valisesAVenir.length > 0 && (
                  <>
                    <EnteteExistant
                      titre="Tes valises"
                      nombre={valisesAVenir.length}
                      onVoirTout={() => {
                        setOnglet("up");
                        setEtatAgenda((e) => ({ ...e, mode: "liste" }));
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
            {/* Les looks passés sont des TENUES planifiées : ils n'ont pas leur place sous l'onglet Valise (11/10/2026, signalé). */}
            {hub !== "tenue" ? null : nbPlanifications === 0 ? (
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
                        setEtatAgenda((e) => ({ ...e, mode: "liste" }));
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
              {/* LES TROIS TEMPS DE LA COMPOSITION (04/11/2026, brief « Évolution du parcours de planification ») — chacun dit ce qu'il lit
                  réellement : le contexte (occasions, lieu et météo, préférence), les pièces (le dressing, la capsule s'il la complète), le
                  look (le style du profil). Cochés au rythme de l'écran : le moteur, lui, a déjà composé. */}
              {([
                [
                  "Analyse du contexte",
                  [
                    choisies.map((o) => occasionShortLabel(o)).join(" et "),
                    meteoMoment && villeAffichee ? `${villeAffichee} · ${degres(meteoMoment.temp)}` : villeAffichee || lieu.trim() || "",
                    humeur ? libelleHumeur(humeur, profile.gender) : "",
                  ]
                    .filter(Boolean)
                    .join(" · "),
                ],
                [
                  "Sélection des pièces",
                  state.items.length
                    ? `${state.items.length} pièce${state.items.length > 1 ? "s" : ""} de ton dressing${dressingSeul ? "" : ", ta capsule en complément"}`
                    : "Ta capsule, en attendant ton dressing",
                ],
                ["Composition du look", profile.styles.length ? `Ton style ${libelleStyles(profile.styles, profile.gender)}` : "Les règles de composition de Capsela"],
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
                {depuisPlan ? (adaptation ? "Ton look adapté à la météo" : "Ta tenue planifiée est gardée") : "La tenue de ta photo est gardée"} · {pieces.length} pièce
                {pieces.length > 1 ? "s" : ""}
              </div>
            )}
            {/* Ce qui a changé par rapport au look planifié, dit simplement : les pièces gardées ne bougent pas. Un look planifié reste
                modifiable : « Voir ma tenue », puis « Planifier » remplace l'ancien. */}
            {adaptation && notesAdaptation.length > 0 && (
              <ul className="list-none p-0 mt-[10px] flex flex-col gap-[4px]" aria-label="Ce qui change dans ton look">
                {notesAdaptation.map((n) => (
                  <li key={n} className="text-[12.5px] text-ink-soft leading-[1.45]">
                    {n}
                  </li>
                ))}
              </ul>
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
                      actif={choisies.includes(key)}
                      onClick={() => {
                        // Une ou plusieurs (04/11/2026) : Sport et Cocooning restent seuls (tenuePolyvalente.ts).
                        const suivantes = basculerOccasion(choisies, key);
                        setChoisies(suivantes);
                        /* Le type de lieu déjà choisi ne survit pas à un changement d'occasion principale qui ne le propose plus —
                           sinon `planned_outfits.type_lieu` recevrait un « Bar / Rooftop » sur un Voyage. */
                        const principale = occasionPrincipale(suivantes);
                        const permis = principale ? TYPES_LIEU_PAR_OCCASION[principale] : undefined;
                        if (!permis || (typeLieu !== TYPE_LIEU_AUTRE && !permis.includes(typeLieu ?? ""))) setTypeLieu(null);
                      }}
                    />
                  ))}
                </div>
                {/* Plusieurs occasions : laquelle mène la composition, et pourquoi Sport ou Cocooning ne se combinent pas. */}
                {choisies.length > 1 && occ && (
                  <div className="mt-4 text-[12px] text-muted-3 leading-[1.45]" role="status">
                    Une tenue pour {choisies.map((o) => occasionShortLabel(o)).join(" et ")}, composée d&apos;abord pour {occasionShortLabel(occ)}.
                  </div>
                )}
                {choisies.length === 1 && OCCASIONS_SEULES.includes(choisies[0]) && (
                  <div className="mt-4 text-[12px] text-muted-3 leading-[1.45]">{occasionShortLabel(choisies[0])} se planifie seul : sa tenue ne passe pas pour une autre occasion.</div>
                )}
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
                            <span className="whitespace-nowrap">{sansBarre(v)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {etape === 2 && (
              <>
                {/* LE CALENDRIER MENSUEL (maquette Planifier V3, 07/10/2026), à la place de la bande de 21 jours : on peut
                    préparer une tenue pour dans trois mois, la saison et l'occasion suffisent. Aujourd'hui se planifie depuis le 04/11/2026
                    (retour des testeurs : « la planification pour ce soir », qui revient sur la règle du 27/09/2026) — pour les seuls
                    moments pas encore passés (momentPossible). */}
                <CalendrierMois
                  mois={moisAffiche}
                  onMois={setMoisAffiche}
                  aujourdhui={dansNJours(0)}
                  premier={dansNJours(0)}
                  choisi={dateChoisie}
                  onChoisir={(d) => {
                    const t0 = dansNJours(0);
                    const e = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - new Date(t0.getFullYear(), t0.getMonth(), t0.getDate()).getTime()) / 86_400_000);
                    setJour(e);
                    // Aujourd'hui, un moment déjà passé ne reste pas choisi.
                    if (moment && !momentPossible(moment, e)) setMoment(null);
                  }}
                />
                {/* LE LIEU, facultatif, et la météo qu'il donne pour la date choisie (EtapeLieu) : sur la même page que la date depuis le
                    04/11/2026. La carte météo qui suivait le calendrier n'a plus lieu d'être : EtapeLieu dit déjà la prévision, ou ce qui manque. */}
                <div className="mt-6">
                  <Surtitre>Où ? · Facultatif</Surtitre>
                </div>
                <div className="mt-2">
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
                </div>
                <div className="mt-5">
                  <Surtitre>À quel moment ?</Surtitre>
                </div>
                <div className="grid grid-cols-2 gap-[10px] mt-3">
                  {MOMENTS.filter(([m]) => momentPossible(m, jour ?? 1)).map(([m, d]) => (
                    <TuileIcone key={m} icone={ICONE_MOMENT[m] ?? "journee"} label={m} sousTitre={d} actif={moment === m} onClick={() => setMoment(m)} hauteur={84} />
                  ))}
                </div>
              </>
            )}

            {etape === 3 && (
              <div className="flex flex-col gap-[7px] mt-4" role="radiogroup" aria-label="Préférence pour cet événement">
                {humeursProposees(profile.gender).map((h) => (
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
              {choisies.map((o) => occasionShortLabel(o)).join(" · ") || occLabel} · {dateLongue}
              {moment ? ` · ${moment}` : ""}
            </div>
            <div className="text-[12px] text-muted mt-[2px]">
              {meteoMoment && villeAffichee
                ? `${villeAffichee} · ${degres(meteoMoment.temp)} · ${meteoMoment.label}`
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
                {/* LE MÊME HERO QUE LE LOOK PLANIFIÉ (04/11/2026, demandé : « harmonise aussi l'affichage sur cette page ») : surtitre,
                    flat lay du look (sans phrase manuscrite, comme les autres heros : 04/11/2026), provenance, indicateurs et « Pour l'extérieur » (HeroTenue). Ses actions restent en pied d'écran. */}
                <HeroTenue
                  onPiece={(it, look) =>
                    remplacement.ouvrir(it, {
                      look,
                      contexte: contexteResultat,
                      dressing: state.items,
                      suggestions: dressingSeul ? [] : capsuleDeLaDate,
                      appliquer: remplacerDansResultat,
                    })
                  }
                  statut={composition ? (depuisPlan ? "Tenue déjà planifiée" : "Tenue de ta photo") : "Ta tenue proposée"}
                  pieces={pieces}
                  temperature={tempResultat}
                  quand="prévus"
                  candidatsExterieur={candidatsResultat}
                  indicateurs={<IndicateursTenue items={indicateursResultat} />}
                  vide="Aucune pièce à montrer pour l'instant."
                  actions={
                    composition || !occ || !idsAffiches.length
                      ? []
                      : [
                          // « Enregistrer » : dans « Mes looks », selon la logique existante (basculerIdeeLook : le cœur des idées de look).
                          {
                            cle: "enregistrer",
                            glyphe: lookEnregistre ? "♥" : "♡",
                            libelle: lookEnregistre ? "Enregistrée" : "Enregistrer",
                            onClick: () => actions.basculerIdeeLook(idsAffiches, occ),
                          },
                          // « Avis d'un proche » : le partage existant ; au retour, ce même résultat (ResultatGarde).
                          {
                            cle: "avis",
                            glyphe: "✦",
                            libelle: "Avis d'un proche",
                            onClick: () =>
                              actions.openOpinionShare({
                                pieceIds: idsAffiches,
                                occasion: occ,
                                temp: meteoMoment?.temp ?? null,
                                label: meteoMoment?.label ?? null,
                                moment: `pour ${dateLongue}`,
                                retour: "planifier",
                              }),
                          },
                        ]
                  }
                />

                {/* UNE TENUE A TOUJOURS SES CHAUSSURES (08/10/2026, demandé) : quand le moteur n'en a trouvé aucune pour la saison de
                    la date, la phrase le dit au lieu de présenter une tenue incomplète comme finie. */}
                {!composition && pieces.length > 0 && !pieces.some((p) => p.cat === "chaussures") && (
                  <div role="status" className="mt-3 text-[12px] leading-[1.45] text-terracotta-deep">
                    {dressingSeul
                      ? "Aucune paire de chaussures de ton dressing ne convient à cette date. Décoche « Uniquement mon dressing » pour en voir une, ou ajoute-en une."
                      : "Aucune paire de chaussures ne convient à cette date pour l'instant."}
                  </div>
                )}

                {/* LES PIÈCES DU LOOK (04/11/2026, brief « Évolution du parcours de planification ») : le composant de la page Tenue
                    (RailPiecesTenue) — visuel, nom, catégorie, « Ton dressing » ou « Capsule », la fiche au toucher. Sans l'échange ⇄ : la
                    tenue se change en entier (« Autre tenue ») ou par ses critères. Le manteau montré à part n'y est pas. */}
                <RailPiecesTenue pieces={piecesDuLook} />

                {/* « POURQUOI CE LOOK ? » : une liste, sans carte (non cliquable). Seuls les critères réellement utilisés par le
                    moteur y figurent — le type de lieu n'y est pas, il n'entre pas dans le calcul. */}
                <div id="pourquoi" className="mt-6">
                  <div className="t-titre-carte text-ink">Pourquoi ce look ?</div>
                  <ul className="mt-2">
                    {([
                      ["journee", secondaires.length ? "Tes occasions" : "Ton occasion", `${composition ? "Prévue" : "Pensée"}${secondaires.length && !composition && !tenue?.polyvalente ? " d'abord" : ""} pour « ${occLong} »${occ === "travail_formel" ? ` · ${workMode}` : occ === "date" && dateContext ? ` · ${sansBarre(dateContext)}` : ""}${
                        // Tenue polyvalente (04/11/2026) : elle convient aussi aux autres occasions, ou le moteur n'en a pas trouvé qui le fasse.
                        !secondaires.length || composition
                          ? ""
                          : tenue?.polyvalente
                            ? `, et elle convient aussi pour ${secondaires.map((o) => occasionShortLabel(o)).join(" et ")}.`
                            : ` : aucune tenue de tes pièces ne convient aussi pour ${secondaires.map((o) => occasionShortLabel(o)).join(" et ")}.`
                      }`],
                      ...(meteoMoment ? [["nuage", "La météo", phraseMeteo] as [IconePlanifier, string, string]] : []),
                      ...(!composition && !dressingSeul && nbCapsule > 0 && profile.styles.length
                        ? [["elegant", "Ton style", `Une base de ta capsule ${libelleStyles(profile.styles, profile.gender)}.`] as [IconePlanifier, string, string]]
                        : []),
                      ...(humeur && !composition ? [["confortable", "Ton envie", `« ${libelleHumeur(humeur, profile.gender)} » a départagé des tenues proches.`] as [IconePlanifier, string, string]] : []),
                      ["cintre", composition ? "Ta tenue" : "Ton dressing", provenance],
                    ] as [IconePlanifier, string, string][]).map(([icone, titre, texte]) => (
                      <li key={titre} className="flex gap-3 items-start py-3 border-b border-border last:border-b-0">
                        <span className="flex-shrink-0 text-terracotta mt-[1px]"><IconeTuile nom={icone} taille={18} /></span>
                        <span className="flex-1 min-w-0">
                          <span className="block t-titre-vignette text-ink">{titre}</span>
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
                  <LigneInterrupteur titre="Uniquement mon dressing" texte="Sans compléter avec des pièces de ta capsule." actif={dressingSeul} onClick={() => setDressingSeul(!dressingSeul)} className="mt-[14px]" />
                )}
              </>
            )}
          </>
        )}

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
                      {gardee.temp != null ? ` · ${degres(gardee.temp)}` : ""}
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
          // LA MAQUETTE « LOOK PLANIFIÉ » (04/11/2026) — tout ce qui suit vient des données du plan, jamais d'une déduction :
          const alertePlan = meteoPlanVive ? alerteMeteoPlan(pieces, meteoPlanVive) : null;
          const tempPlan = meteoPlanVive?.temp ?? t.temp ?? null;
          const meteoMoteurPlan = tempPlan != null ? weatherForDay(tempPlan, meteoPlanVive?.label ?? t.weatherLabel ?? "Nuageux", saisonCalendairePour(d), CHALEUR_HORS_SAISON) : null;
          const candidatsPlan =
            meteoMoteurPlan && tempPlan != null && tempPlan < SEUIL_MANTEAU
              ? candidatsDeRemplacement(pieces, wardrobePool, -1, "manteau", t.occasion, (t.sousChoix ?? "Présentiel") as WorkMode, (t.sousChoix ?? DATE_CONTEXTS[0][0]) as DateContext, meteoMoteurPlan)
              : [];
          const sepPlan = separerCoucheExterieure(pieces, tempPlan, candidatsPlan);
          const colo = colorimetrieMoteur(profile.colorimetrie);
          const indicateursPlan = [
            // Le style : seulement si le look tire des pièces de la capsule, qui est bâtie sur les styles du profil.
            ...(sepPlan.principal.some((p) => isCatalogId(p.id)) && profile.styles.length
              ? [{ cle: "style", icone: ICONES_INDICATEUR.style, texte: libelleStyles(profile.styles, profile.gender) }]
              : []),
            // Une tenue polyvalente (04/11/2026) dit toutes ses occasions, la principale d'abord.
            { cle: "occasion", icone: ICONES_INDICATEUR.occasion, texte: t.occasion === "all" ? "Toutes occasions" : [t.occasion, ...(t.occasionsSecondaires ?? [])].map((o) => occasionShortLabel(o)).join(" · ") },
            // La météo : seulement avec une température, et seulement si le moteur ne signale rien (alerteMeteoPlan).
            ...(tempPlan != null && !alertePlan ? [{ cle: "meteo", icone: ICONES_INDICATEUR.meteo, texte: `Adaptée à ${degres(tempPlan)}` }] : []),
            // La palette : seulement avec une colorimétrie, et si la tenue s'y accorde près du visage (accordVisage, R-S18).
            ...(colo && accordVisage(sepPlan.principal, colo) ? [{ cle: "palette", icone: ICONES_INDICATEUR.palette, texte: "Ta palette", coche: true }] : []),
          ];
          return (
            <>
              {/* INTRODUCTION — type d'écran, occasion et ville, puis date et
                  moment sur une ligne légère, avec leurs icônes. */}
              {/* L'EN-TÊTE COMME L'ACCUEIL (14/10/2026) : un titre, puis la barre « date (i) · lieu » avec la météo à droite. L'occasion et le moment
                  ne sont dits qu'une fois, dans le hero (« pensée pour ta soirée ») ; la source de la prévision est dans le « i » près de la date. */}
              {/* LE STATUT, DISCRET (04/11/2026, maquette « Look planifié ») : « Planifié », ou « Confirmé » après « Je porterai cette
                  tenue ». Un look passé n'en a pas. */}
              <div className="flex items-center justify-between gap-3 mt-[18px]">
                <div className="t-titre-ecran text-ink">
                  Look <span className="italic text-terracotta">planifié</span>
                </div>
                {!passee && (
                  <span className="inline-flex items-center gap-[6px] flex-shrink-0 rounded-full px-[12px] py-[6px] text-[12px] text-terracotta-deep" style={{ background: "var(--color-selected-bg)" }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {t.confirme ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>}
                    </svg>
                    {t.confirme ? "Confirmé" : "Planifié"}
                  </span>
                )}
              </div>
              <BarreDuPlan
                className="mt-1"
                date={jourLong.charAt(0).toUpperCase() + jourLong.slice(1)}
                lieu={villePlan}
                prevision={meteoPlanVive}
                enregistree={{ temp: t.temp, label: t.weatherLabel }}
                info={
                  meteoPlanVive
                    ? `Prévision ${ecartJoursPlan === 0 ? "d'aujourd'hui" : ecartJoursPlan === 1 ? "de demain" : "à jour"} à ${villePlan || "ce lieu"}, pour ${t.moment.toLowerCase()}.`
                    : t.temp != null
                      ? "Météo enregistrée à la planification — la prévision de ce lieu n'est pas disponible pour cette date."
                      : null
                }
              >

              </BarreDuPlan>

              {/* LA MÉTÉO A ÉVOLUÉ (04/11/2026, maquette) : UN message, jamais deux qui se contredisent. La tenue reste adaptée (aucune
                  alerte du moteur, alerteMeteoPlan) : on le dit, sans action. Elle ne l'est plus : on dit pourquoi et on propose
                  « Actualiser » — la même adaptation que l'accueil (useCalculAdaptation). Rien à changer malgré l'alerte : on le dit. */}
              {!passee && meteoPlanVive && (previsionAChange(t, meteoPlanVive) || alertePlan) && (
                <div role="status" className="mt-[10px] flex items-start gap-[10px] rounded-bloc px-[12px] py-[10px]" style={{ background: "var(--color-warm-bg)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="flex-shrink-0 mt-[1px] text-ink-soft">
                    <circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8h.01" />
                  </svg>
                  <div className="flex-1 min-w-0 text-[12.5px] leading-[1.45] text-ink">
                    {alertePlan ? (
                      <>
                        {previsionAChange(t, meteoPlanVive) ? "La météo a évolué. " : ""}
                        {alertePlan}
                        {tenueToujoursOk === t.id && <span className="block text-ink-soft mt-[2px]">Aucune pièce de ton dressing ne conviendrait mieux pour l&apos;instant.</span>}
                      </>
                    ) : (
                      "La météo a évolué, mais ta tenue reste adaptée."
                    )}
                  </div>
                  {alertePlan && tenueToujoursOk !== t.id && (
                    <button
                      type="button"
                      onClick={() => {
                        const proposition = calculerAdaptation(t, pieces, meteoPlanVive);
                        if (!proposition) return setTenueToujoursOk(t.id);
                        if (ecartJoursDuPlan(t.jour) <= 0) {
                          actions.viewItemOutfit(proposition.ids, t.occasion);
                          return actions.goTenues();
                        }
                        repartirDuPlan(t, "modifier");
                        setComposition(proposition.ids);
                        setEtape(2);
                      }}
                      className="flex-shrink-0 inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-terracotta-deep underline underline-offset-[3px] cursor-pointer min-h-[32px]"
                    >
                      Actualiser
                    </button>
                  )}
                </div>
              )}

              {/* LE HERO DE LA PAGE TENUE (14/10/2026, demandé), pour la tenue GARDÉE. « Modifier ma tenue » est passé sous la composition
                  (04/11/2026) ; « Avis d'un proche » reste ici, comme sur Tenue. */}
              <HeroTenue
                // Une tenue passée ne se modifie plus : la fiche directe, comme avant.
                onPiece={
                  passee
                    ? undefined
                    : (it, look) =>
                        remplacement.ouvrir(it, {
                          look,
                          contexte: {
                            ...contexteResultat,
                            occasion: t.occasion,
                            weather: meteoMoteurPlan ?? meteoUtilisee,
                            workMode: (t.sousChoix ?? "Présentiel") as WorkMode,
                            dateContext: (t.sousChoix ?? DATE_CONTEXTS[0][0]) as DateContext,
                          },
                          dressing: state.items,
                          suggestions: t.dressingSeul ? [] : wardrobePool,
                          appliquer: (a, n) => remplacerDansPlan(t, a, n),
                        })
                }
                statut={passee ? "Ton look était planifié" : "Ta tenue planifiée"}
                pieces={pieces}
                temperature={tempPlan}
                quand={passee ? "ce jour-là" : "prévus"}
                candidatsExterieur={passee ? [] : candidatsPlan}
                indicateurs={<IndicateursTenue items={indicateursPlan} />}
                vide="Les pièces de ce look ne sont plus dans ton dressing."
                actions={
                  pieces.length > 0
                    ? [
                        {
                          cle: "avis",
                          glyphe: "✦",
                          libelle: "Avis d'un proche",
                          onClick: () =>
                            actions.openOpinionShare({
                              pieceIds: t.pieceIds,
                              occasion: t.occasion,
                              temp: t.temp,
                              label: t.weatherLabel,
                              moment: `pour ${DOW_LONG[d.getDay()].toLowerCase()} ${d.getDate()} ${MOIS[d.getMonth()]}`,
                              plan: t,
                            }),
                        },
                      ]
                    : []
                }
              />

              {/* On dit ce qui manque plutôt que de compléter avec autre
                  chose : une pièce retirée du dressing depuis la
                  planification ne doit pas être remplacée en silence. */}
              {manquantes > 0 && pieces.length > 0 && (
                <div className="text-[12px] text-muted mt-3 leading-[1.45]">
                  {manquantes === 1 ? "Une pièce de ce look n'est plus" : `${manquantes} pièces de ce look ne sont plus`} dans
                  ton dressing.
                </div>
              )}

              {/* LES PIÈCES DU LOOK : le composant de la page Tenue, comme au résultat (04/11/2026 : une seule source pour les pièces d'un
                  look). Le manteau montré à part n'y est pas. */}
              <RailPiecesTenue pieces={sepPlan.principal} />

              {/* LES DEUX ACTIONS (04/11/2026, maquette). « Je porterai cette tenue » CONFIRME le plan (colonne `confirme`, 0057) —
                  ce n'est pas « portée » : le Journal ne l'enregistre que le jour même, depuis la tenue du jour. « Modifier ma tenue »
                  reprend le parcours existant (repartirDuPlan), le plan n'est remplacé qu'à l'enregistrement. Pas sur un look passé. */}
              {!passee && pieces.length > 0 && (
                <div className="mt-[14px] flex flex-col gap-[9px]">
                  {t.confirme ? (
                    <div role="status" className="flex items-center gap-3 rounded-full px-4" style={{ minHeight: 52, background: "rgba(29,26,22,.07)" }}>
                      <span className="w-8 h-8 rounded-full bg-terracotta-deep text-cream flex items-center justify-center flex-shrink-0" aria-hidden="true">✓</span>
                      <span className="flex-1 min-w-0 text-[13px] text-ink">C&apos;est noté : tu porteras cette tenue.</span>
                      <button type="button" onClick={() => confirmerPlan(t, false)} className="text-[12px] text-muted-3 underline cursor-pointer min-h-[44px] flex-shrink-0">
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <Button variante="sombre" onClick={() => confirmerPlan(t, true)}>
                      Je porterai cette tenue
                    </Button>
                  )}
                  {confirmationEchouee === t.id && (
                    <div role="alert" className="text-[12px] text-rust leading-[1.45] text-center">
                      Ta confirmation n&apos;a pas pu être gardée sur ton compte. Elle reste affichée sur cet appareil.
                    </div>
                  )}
                  <Button variante="contour" onClick={() => repartirDuPlan(t, "modifier")}>
                    Modifier ma tenue
                  </Button>
                </div>
              )}

              {/* L'AVIS DE STYLISTE, mis en avant (maquette du 04/10/2026) — la fonctionnalité Premium existante (son
                  écran, sa décision d'accès, son Gate), avec son propre CTA. Pas sur une tenue passée : « avant le jour J »
                  n'y a plus de sens. */}
              {!passee && (
                <div className="mt-[14px] bg-warm-bg border border-warm-border rounded-carte px-[16px] py-[16px]">
                  {premiumRequis("AVIS_DE_STYLISTE") && <BadgePremium />}
                  <div className="t-titre-section text-ink mt-[2px]" style={{ textWrap: "balance" }}>
                    L&apos;œil de Capsela, avant le jour J.
                  </div>
                  <div className="text-[12px] text-muted-3 leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
                    Obtiens un regard expert sur ce look avant le jour J.
                  </div>
                  <Button variante="principal" className="mt-[14px]" onClick={ouvrirAvisStyliste} aria-busy={verificationAvis}>
                    {verificationAvis ? <LoadingSpinner size={18} /> : "Obtenir l'avis de Capsela"}
                  </Button>
                </div>
              )}
            </>
          );
        })()}

        {/* « MES LOOKS À VENIR » (30/09/2026, brief « Refonte premium de la
            page Mes planifications ») : l'agenda de looks — le prochain en
            grand, les suivants en frise, les voyages en contexte. Mêmes
            données et mêmes actions que la liste d'avant (AgendaLooks). */}
        {vue === "liste" && (
          <AgendaLooks
            etat={etatAgenda}
            onEtat={setEtatAgenda}
            peutPlanifierLe={(j) => {
              const e = ecartDuJour(j);
              return e >= 0 && e <= JOURS_PROPOSES;
            }}
            onPlanifierLe={(j) => {
              // Le parcours existant, la date déjà choisie (comme « Planifier une tenue pour mardi » depuis Tenue).
              recommencer();
              const e = ecartDuJour(j);
              if (e >= 0 && e <= JOURS_PROPOSES) setJour(e);
            }}
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
              {etape === derniere ? (etape === 3 ? "Composer ma tenue" : "Voir ma tenue") : "Continuer"}
            </Button>
          </>
        )}
        {vue === "etape" && !compose && etape === 3 && (
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
          <Button onClick={recommencer}>Planifier un look</Button>
        )}
        {vue === "confirmation" && (
          <>
            <Button
              onClick={() => {
                // Le jour de la tenue gardée, dans l'agenda (17/10/2026).
                if (gardee) setEtatAgenda({ mode: "jour", jour: gardee.jour, mois: gardee.jour });
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
            {/* LES ACTIONS DU RÉSULTAT (04/11/2026, brief « Évolution du parcours de planification »). « Porter cette tenue » est le
                principal : la tenue est associée à sa date, « Planifiée » (garder). « Enregistrer » et « Avis d'un proche » sont dans le
                hero, comme sur la page Tenue. « Autre tenue » remplace la proposition en gardant les critères, sans refaire le parcours
                ni reproposer une tenue déjà vue (autresIdees). « Modifier cet évènement » rouvre les étapes déjà remplies. Désactivés
                pendant l'écriture : un double tap ne part pas deux fois. */}
            {sansTenueTextes ? (
              sansTenueTextes.peutAjouter && <Button onClick={actions.openAddEtRevenir}>Ajouter des pièces</Button>
            ) : (
              <Button onClick={garder} disabled={enregistrement}>
                {enregistrement ? "Un instant…" : "Porter cette tenue"}
              </Button>
            )}
            {autreIndisponible && (
              <div role="status" className="text-center text-[12px] text-muted-3">
                Pas d&apos;autre tenue vraiment différente avec ces critères. Modifie l&apos;évènement pour élargir la recherche.
              </div>
            )}
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
              {/* Une composition imposée est LA tenue de la photo : pas de nouveau tirage. Sans tenue, rien à régénérer. */}
              {!composition && !sansTenueTextes && (
                <button
                  onClick={autreTenue}
                  disabled={autreIndisponible}
                  className={"flex-1 rounded-full bg-card border border-terracotta text-[12px] font-medium text-terracotta cursor-pointer " + (autreIndisponible ? "opacity-50" : "")}
                  style={{ minHeight: 44 }}
                >
                  Autre tenue
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
      {/* La feuille Voir / Remplacer d'une pièce du flat lay, et sa confirmation (RemplacementPiece). */}
      {remplacement.rendu}
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
