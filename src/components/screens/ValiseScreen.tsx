"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import FilEtapes from "@/components/FilEtapes";
import { OutfitComposition } from "@/components/OutfitComposition";
import Input from "@/components/Input";
import SegmentedControl from "@/components/SegmentedControl";
import TabBar from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { resolveItemImage } from "@/lib/catalogImages";
import { occasionShortLabel } from "@/lib/data";
import { jourLocal } from "@/lib/outfitFeedback";
import { villeDuLieu } from "@/lib/planifier";
import { HORIZON_PREVISION_JOURS, previsionPour, type Prevision } from "@/lib/prevision";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { computeDefaultCapsule } from "@/lib/capsule";
import { useCapsela } from "@/lib/store";
import type { CategoryKey, Item, OccasionKey } from "@/lib/types";
import {
  allegement,
  alternatives,
  amplitudePrevue,
  categoriesPourCompleter,
  completerAvecCapsule,
  poolDeLaValise,
  BAGAGES,
  capaciteDe,
  UNITES_MOYENNES_PAR_PIECE,
  unitesDe,
  volumeDe,
  cibleDeVolume,
  composerValise,
  conseilMeteo,
  dateDe,
  DUREE_MAX_JOURS,
  etatJauge,
  generateurMoteur,
  GROUPES_VALISE,
  joursDuSejour,
  libelleDuree,
  lookAChaussuresEtSac,
  looksDeLaValise,
  looksParPiece,
  SEUIL_POLYVALENTE,
  nomCategorie,
  occasionsCouvertes,
  occasionsDeLaPiece,
  occasionsDuLook,
  occasionsRetenues,
  MINIMUM_PIECES_VALISE,
  meteosPrevuesDuSejour,
  pluieAnnoncee,
  pretPourUneValise,
  resumeLook,
  situationsDuProgramme,
  capsuleDuSejour,
  type SituationValise,
  type LookValise,
  type MeteoJour,
  type TailleBagage,
  type TypeSejour,
} from "@/lib/valise";
import { selectionApercu } from "@/lib/valiseApercu";
import { decalerMois, grilleDuMois, toucherJour } from "@/lib/calendrierPeriode";
import { articlesChecklist, progressionChecklist, raisonsPartagees, sectionsChecklist, type FiltreChecklist, type Progression, type SectionChecklist } from "@/lib/checklistValise";
import { lireNomEvenement } from "@/lib/lectureEvenement";
import {
  CATEGORIES_IDEES,
  IDEES_GENERIQUES,
  LIBELLE_MAX,
  activiteDeLOccasion,
  activiteDuLibelle,
  activitesDesChoix,
  ajouterLibelle,
  basculerIdee,
  choixDeLaValise,
  cleLibelle,
  dejaChoisi,
  destinationAvecPreposition,
  ideesUniques,
  libellePropre,
  type ActiviteChoisie,
  type CategorieIdee,
  type IdeeSejour,
} from "@/lib/activitesSejour";
import { ideesGardees, ideesPourDestination } from "@/lib/ideesSejour";
import { appliquerPeriode, arriveeAuMilieu, destinationDuJour, etapesRetenues, joursParEtape, libelleItineraire, periodeValide, periodesDesDestinations, ETAPES_MAX, type EtapeSejour, type Periode } from "@/lib/etapesSejour";
import LoadingSpinner from "@/components/LoadingSpinner";
import { pieceLaPlusUtilisee, planningDeLaValise, type CreneauPlanning } from "@/lib/planningValise";
import { creneauxDeLaPiece, vetementsDeLaValise, vetementsParFamille } from "@/lib/valiseVetements";
import {
  evenementsDuSejour,
  libelleEvenement,
  situationsDesEvenements,
  libelleMoment,
  type EvenementValise,
} from "@/lib/evenementsValise";
import { LIBELLE_RAISON, apercuAllegement, avecTenue, nouvelleTenue, piecesAllegeables, type TenueProposee } from "@/lib/ajustementsValise";
import { estIdLocal, nouvelIdLocal, type ValiseGardee } from "@/lib/valises";
import {
  affairesAffichees,
  affairesMasquees,
  cocheesValides,
  libelleAjoutValide,
  noteCabine,
  type EtatAffaires,
} from "@/lib/affairesVoyage";
import {
  activitesDuProgramme,
  bagageConseille,
  couvertureMeteo,
  elementProgramme,
  occasionsDuProgramme,
  programmeDepuisOccasions,
  programmeDesActivites,
  type ActiviteSejour,
  type ItemProgramme,
} from "@/lib/programmeValise";
import { ChoixVille } from "@/components/EtapeLieu";
import { fetchClimat, previsionGardee, type Climat, type VilleSuggeree } from "@/lib/weather";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import Card from "@/components/Card";

/**
 * PRÉPARER SA VALISE (docs/valise.md).
 *
 * REFONTE UX/UI DU 27/09/2026 (maquette « Parcours Ma valise », 10 écrans) :
 * quatre questions (destination, valise, type de séjour, programme), une
 * génération qui montre ses étapes réelles, un résultat qui ouvre sur les
 * LOOKS avant les PIÈCES, le détail d'un look et le détail d'une pièce.
 * Le moteur (valise.ts → generateOutfitWithFallback) n'a pas changé : seules
 * la présentation et la navigation interne ont été reprises.
 *
 * CE QUE LA MAQUETTE MONTRE ET QUE L'ÉCRAN NE REPREND PAS, FAUTE DE DONNÉE :
 * - les noms de looks (« City day », « Dîner en ville ») : un look porte le
 *   nom de ce qu'il contient (resumeLook), ses occasions en métadonnées ;
 * - « Pourquoi cette pièce ? » : aucun système de justification stylistique
 *   n'existe ; le détail d'une pièce dit ce qui est compté (looks, occasions) ;
 * - le cœur (favori) : l'action réelle est « Enregistrer dans mes looks » ;
 * - l'interrupteur « Uniquement ton dressing » : il n'existe pas d'autre
 *   source, la ligne le dit sans proposer de bascule ;
 * - les photos de valises et l'illustration de chargement : aucun visuel de
 *   ce type dans le projet ; le glyphe valise de l'accueil en tient lieu.
 * - pas de température inventée : la météo n'apparaît que pour les jours
 *   que la prévision couvre (4 jours). Au-delà, la règle de Planifier.
 *
 * La valise est gardée sur l'appareil ET, quand la table `valises` existe
 * (migration 0038), dans le compte. L'écran dit où elle est gardée.
 */

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const DOW = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];


/** Les quatre vues du résultat (maquette V2) : Aperçu, Looks, Pièces (tous les groupes, avec filtre de provenance), Checklist. */
type Onglet = "ensemble" | "looks" | "pieces" | "checklist";

/** « 16 → 20 oct. », « 30 sept. → 8 oct. » */
function libellePeriode(depart: string, retour: string): string {
  const a = dateDe(depart);
  const b = dateDe(retour);
  if (depart === retour) return `${a.getDate()} ${MOIS[a.getMonth()]}`;
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} → ${b.getDate()} ${MOIS[b.getMonth()]}`
    : `${a.getDate()} ${MOIS[a.getMonth()]} → ${b.getDate()} ${MOIS[b.getMonth()]}`;
}

const dateCourte = (jour: string) => {
  const d = dateDe(jour);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
};

const plusJours = (jour: string, n: number) => {
  const d = dateDe(jour);
  d.setDate(d.getDate() + n);
  return jourLocal(d);
};

const joursEntre = (a: string, b: string) => Math.round((dateDe(b).getTime() - dateDe(a).getTime()) / 86400000);

/** « 17° » ou « 17° – 18° ». */
const libelleAmplitude = (a: { min: number; max: number }) => (a.min === a.max ? `${a.min}°` : `${a.min}° – ${a.max}°`);

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/**
 * LES DATES DU SÉJOUR DANS UN SEUL CALENDRIER (20/10/2026, demandé) : premier toucher le départ, second le retour (calendrierPeriode.ts).
 * Les jours passés, et au-delà de DUREE_MAX_JOURS après le départ tant que le retour n'est pas choisi, ne se touchent pas. Le mois
 * affiché suit le départ ; on navigue mois par mois, jamais avant le mois en cours.
 */
function CalendrierPeriode({
  depart,
  retour,
  aujourdhui,
  premierJour = aujourdhui,
  onChange,
}: {
  depart: string;
  retour: string;
  aujourdhui: string;
  /** Le premier jour qu'on peut toucher : aujourd'hui, ou le départ déjà passé d'un séjour en cours qu'on modifie (30/10/2026). */
  premierJour?: string;
  onChange: (p: { depart: string; retour: string }) => void;
}) {
  const base = dateDe(depart || aujourdhui);
  const [vue, setVue] = useState({ annee: base.getFullYear(), mois: base.getMonth() });
  const debut = dateDe(premierJour);
  const auPremierMois = vue.annee === debut.getFullYear() && vue.mois === debut.getMonth();
  const limite = depart && !retour ? plusJours(depart, DUREE_MAX_JOURS - 1) : null;
  const fin = retour || depart;
  return (
    <Card rayon="carte" className="px-[12px] pt-[10px] pb-[12px]">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setVue(decalerMois(vue.annee, vue.mois, -1))}
          disabled={auPremierMois}
          aria-label="Mois précédent"
          className="w-[44px] h-[44px] flex items-center justify-center text-terracotta cursor-pointer disabled:opacity-30 disabled:cursor-default"
        >
          {chevron("g")}
        </button>
        <span className="t-titre-ligne text-ink first-letter:uppercase" aria-live="polite">
          {MOIS_LONGS[vue.mois]} {vue.annee}
        </span>
        <button
          onClick={() => setVue(decalerMois(vue.annee, vue.mois, 1))}
          aria-label="Mois suivant"
          className="w-[44px] h-[44px] flex items-center justify-center text-terracotta cursor-pointer"
        >
          {chevron("d")}
        </button>
      </div>
      <div className="grid grid-cols-7 mt-1" aria-hidden="true">
        {["L", "M", "M", "J", "V", "S", "D"].map((j, i) => (
          <span key={i} className="text-center t-label text-muted py-[4px]">
            {j}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-[2px]" role="group" aria-label="Choisir les dates du séjour">
        {grilleDuMois(vue.annee, vue.mois).map((jour, i) => {
          if (!jour) return <span key={i} />;
          const passe = jour < premierJour;
          const tropLoin = limite != null && jour > limite;
          const bout = jour === depart || jour === retour;
          const dedans = depart && fin && jour > depart && jour < fin;
          // La bande de la période relie les deux bouts : demi-bande sous le départ et le retour, pleine entre les deux.
          const bande = retour && retour !== depart && (dedans || bout)
            ? jour === depart
              ? "linear-gradient(to right, transparent 50%, var(--color-hero-background) 50%)"
              : jour === retour
                ? "linear-gradient(to right, var(--color-hero-background) 50%, transparent 50%)"
                : "var(--color-hero-background)"
            : undefined;
          return (
            <div key={jour} className="flex justify-center" style={{ background: bande }}>
              <button
                onClick={() => onChange(toucherJour({ depart, retour }, jour))}
                disabled={passe || tropLoin}
                aria-pressed={bout}
                aria-label={`${dateCourte(jour)}${jour === depart ? ", départ" : jour === retour ? ", retour" : ""}`}
                className={
                  "w-[40px] h-[40px] rounded-full text-[13px] cursor-pointer disabled:cursor-default disabled:text-placeholder " +
                  (bout ? "bg-terracotta-deep text-on-terracotta" : jour === aujourdhui ? "border border-border text-ink" : "text-ink")
                }
              >
                {Number(jour.slice(8))}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Glyphes (grammaire de GlyphesOccasion : trait 1,5, currentColor) ────

/**
 * La check-list d'avant le 11/10/2026 vivait dans le stockage de l'appareil (`capsela.valise.check.<id>`). Elle est reprise une fois, à la
 * première coche, puis écrite avec la valise : elle suit désormais la valise d'un appareil à l'autre.
 */
function lireChecklistHeritee(id: string): number[] {
  try {
    const brut = localStorage.getItem(`capsela.valise.check.${id}`);
    const ids = brut ? (JSON.parse(brut) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is number => typeof x === "number") : [];
  } catch {
    return [];
  }
}

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const svg = (children: React.ReactNode, taille = 19) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    {children}
  </svg>
);
const G_CALENDRIER = svg(
  <>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...trait} />
    <path d="M3.5 10h17M8 3v4M16 3v4" {...trait} />
  </>,
  17
);
/** Le glyphe valise de l'accueil (« Préparer une valise »), repris à plusieurs tailles. */
const glypheValise = (taille: number) =>
  svg(
    <>
      <rect x="3" y="7.5" width="18" height="13" rx="2.5" {...trait} strokeWidth={1.4} />
      <path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M9.5 11.5v5M14.5 11.5v5" {...trait} strokeWidth={1.4} />
    </>,
    taille
  );
const G_METEO = svg(
  <>
    <path d="M7 18.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.4 1.6A3.2 3.2 0 0 0 7 18.5z" {...trait} />
    <path d="M15.5 4.5v1.3M19.8 6.3l-.9.9M21.5 10.5h-1.3" {...trait} />
  </>,
  26
);
const G_METEO_PETIT = svg(
  <>
    <circle cx="12" cy="12" r="4.2" {...trait} />
    <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.5 1.5M16.9 16.9l1.5 1.5M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5" {...trait} />
  </>,
  20
);
const G_GOUTTE = svg(<path d="M12 3.5s5.5 6 5.5 10a5.5 5.5 0 0 1-11 0c0-4 5.5-10 5.5-10z" {...trait} />, 19);
const G_AMPOULE = svg(
  <>
    <path d="M9 17.5h6M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.3 9.9c.6.5 1 1.2 1 2V16h4.6v-.6c0-.8.4-1.5 1-2A5.5 5.5 0 0 0 12 3.5z" {...trait} />
  </>,
  18
);
const G_CINTRE = svg(
  <>
    <path d="M12 6a2 2 0 1 1 2 2v1.4" {...trait} />
    <path d="M14 9.4 3.9 16.2a1 1 0 0 0 .6 1.8h15a1 1 0 0 0 .6-1.8L14 9.4z" {...trait} />
  </>,
  18
);
const G_ETINCELLE = svg(<path d="M12 3.5l1.7 5.3 5.3 1.7-5.3 1.7L12 17.5l-1.7-5.3L5 10.5l5.3-1.7z" {...trait} />, 18);
const G_COCHE = (taille = 12, couleur = "currentColor") => svg(<path d="M5 12.5l4.5 4.5L19 7.5" {...trait} stroke={couleur} strokeWidth={2.2} />, taille);
const G_CROIX = svg(<path d="M6 6l12 12M18 6L6 18" {...trait} strokeWidth={1.7} />, 14);
const G_ECHANGE = svg(<path d="M7 7h11l-3-3M17 17H6l3 3" {...trait} />, 15);
const G_PLUS = svg(<path d="M12 5v14M5 12h14" {...trait} strokeWidth={1.7} />, 15);
const G_POUBELLE = svg(<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12M10.5 10.5v5M13.5 10.5v5" {...trait} />, 16);
const chevronBas = (ouvert: boolean) => svg(<path d={ouvert ? "M7 14l5-5 5 5" : "M7 10l5 5 5-5"} {...trait} />, 16);

/**
 * LA BARRE DE PRÉPARATION (19/10/2026, refonte Valise) : « 18 / 42 », la barre, « 24 articles restants · 43 % ». Une seule source,
 * progressionChecklist : l'Aperçu et la Checklist disent les mêmes nombres. Les articles PRÉPARÉS, jamais les pièces sélectionnées
 * ni les looks.
 */
function BarrePreparation({ titre, p }: { titre: string; p: Progression }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-titre-carte text-ink">{titre}</span>
        <span className="t-titre-carte text-ink" aria-label={`${p.preparees} articles préparés sur ${p.total}`}>
          {p.preparees} / {p.total}
        </span>
      </div>
      <div className="h-[4px] rounded-full mt-2 overflow-hidden" style={{ background: "var(--color-chip-soft-bg)" }} aria-hidden="true">
        <div className="h-full rounded-full bg-terracotta-deep transition-[width]" style={{ width: `${p.pourcentage}%` }} />
      </div>
      <div className="flex items-baseline justify-between gap-3 mt-[6px] text-[11px] text-muted-3 whitespace-nowrap">
        <span>{p.restantes === 0 ? "Tout est prêt" : `${p.restantes} ${p.restantes > 1 ? "articles restants" : "article restant"}`}</span>
        <span>{p.pourcentage} %</span>
      </div>
    </div>
  );
}
const chevron = (vers: "g" | "d") => svg(<path d={vers === "g" ? "M14.5 6l-6 6 6 6" : "M9.5 6l6 6-6 6"} {...trait} strokeWidth={1.7} />, 16);

/** Pastille de sélection (maquette : cercle terracotta, coche crème). */
function Coche() {
  return (
    <span aria-hidden="true" className="w-[20px] h-[20px] rounded-full bg-terracotta-deep flex items-center justify-center flex-shrink-0">
      {G_COCHE(11, "var(--color-cream)")}
    </span>
  );
}

// ── Petits composants, même grammaire que Planifier ─────────────────────

function Surtitre({ children }: { children: React.ReactNode }) {
  return <div className="t-surtitre text-muted">{children}</div>;
}

/**
 * Le trait d'union de Bodoni Moda est un filet : à 24 px, sa taille optique d'affichage l'amincit au point qu'il disparaît (« Qu'as tu »,
 * constaté en rendu le 30/10/2026). Il garde la même police, avec la taille optique d'un texte courant, dont le filet reste visible.
 */
function avecTraitsDUnion(texte: string): React.ReactNode {
  const morceaux = texte.split("-");
  return morceaux.flatMap((m, i) => (i === 0 ? [m] : [<span key={i} style={{ fontVariationSettings: '"opsz" 10' }}>-</span>, m]));
}

function TitreEtape({ a, b }: { a: string; b: string }) {
  return (
    <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
      {avecTraitsDUnion(a)} <span className="italic text-terracotta">{avecTraitsDUnion(b)}</span>
    </div>
  );
}

/** Métadonnée d'occasion autour d'un look — jamais incrustée sur le visuel. */
function PuceOccasion({ occasion }: { occasion: OccasionKey }) {
  return <span className="inline-flex items-center rounded-full bg-chip-soft-bg px-[10px] py-[4px] text-[11px] text-muted-3">{occasionShortLabel(occasion)}</span>;
}

function Vignette({ it, taille = 46 }: { it: Item; taille?: number }) {
  const img = resolveItemImage(it);
  return (
    <span
      className="flex-shrink-0 rounded-champ overflow-hidden"
      style={{ width: taille, height: taille, ...(img.url ? { background: "var(--color-photo-bg)", padding: img.kind === "photo" ? 0 : 3 } : { background: it.hex }) }}
    >
      {img.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.url} alt="" loading="lazy" className={"w-full h-full " + (img.kind === "photo" ? "object-cover" : "object-contain")} />
      )}
    </span>
  );
}

function CarteInfo({ glyphe, children }: { glyphe: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-[10px] bg-warm-bg border border-sand-border rounded-tuile px-[14px] py-[11px]">
      <span className="flex-shrink-0 text-terracotta mt-[1px]">{glyphe}</span>
      <div className="flex-1 min-w-0 text-[12px] text-ink-soft leading-[1.45]">{children}</div>
    </div>
  );
}

// ── Écran ────────────────────────────────────────────────────────────────

type Vue = { nom: "etape" } | { nom: "calcul" } | { nom: "erreur" } | { nom: "resultat" } | { nom: "look"; index: number } | { nom: "piece"; id: number; depuis: Vue };

/** Les pictogrammes des activités (maquette V2, plus Randonnée le 19/10/2026). */
/** À quel séjour chaque valise convient (maquette V2). */
const USAGE_BAGAGE: Record<TailleBagage, string> = {
  S: "Week-end ou court séjour",
  M: "Séjour d'une semaine",
  L: "Long séjour",
  XL: "Très long séjour",
};

const GLYPHES_ACTIVITE: Record<ActiviteSejour, React.ReactNode> = {
  plage: svg(<path d="M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19M12 4a7 7 0 0 1 7 7H5a7 7 0 0 1 7-7zM12 11v7" {...trait} />, 18),
  ville: svg(<path d="M4 20V10l5-3v13M9 20V4h7v16M16 20v-9h4v9M3 20h18" {...trait} />, 18),
  nature: svg(<path d="M12 3l6 9h-3l4 6H5l4-6H6zM12 18v3" {...trait} />, 18),
  randonnee: svg(<path d="M3 19l6-10 4 6 2-3 6 7zM8 3.5a1.5 1.5 0 1 0 0 .01" {...trait} />, 18),
  detente: svg(<path d="M5 20l3-8h8l3 8M8 12l-2-5M10 16h4" {...trait} />, 18),
  soiree: svg(<path d="M8 3h8l-1 6a3 3 0 0 1-6 0zM12 12v8M8.5 21h7" {...trait} />, 18),
  travail: svg(<path d="M4 8h16v11H4zM9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M4 13h16" {...trait} />, 18),
  sport: svg(<path d="M6 9v6M18 9v6M3 11v2M21 11v2M6 12h12" {...trait} />, 18),
  evenement: svg(<path d="M12 4l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 9.3l5-.7z" {...trait} />, 18),
};

/** Le parcours compte trois étapes depuis le 30/10/2026 : ton séjour, ta valise, ce que tu as prévu (activités et événements ensemble). */
const DERNIERE_ETAPE = 3;

/**
 * LES ÉTAPES DE LA PRÉPARATION, TELLES QU'ELLES ONT LIEU (30/10/2026) : trois traitements réels, dans leur ordre, chacun coché quand il est
 * fait. Avant : cinq lignes, dont « Composition des looks » et « Vérification de la capacité », cochées après coup — elles ont lieu DANS
 * la sélection (composerValise) — et retardées par des pauses : une progression qui ne correspondait pas au calcul.
 */
const ETAPES_CALCUL: [React.ReactNode, string][] = [
  [svg(<path d="M7 18.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.4 1.6A3.2 3.2 0 0 0 7 18.5z" {...trait} />, 18), "La météo et ton programme"],
  [G_CINTRE, "Tes pièces et tes looks, dans la place de ta valise"],
  [G_PLUS, "Ta capsule, si ton dressing ne couvre pas tout"],
];

/** Un créneau du planning : un événement daté dit son moment (« Mariage de Léa · Soirée ») ; une activité répartie, son seul libellé. */
const libelleCreneau = (c: CreneauPlanning) =>
  c.evenement ? `${c.libelle} · ${c.moment ? libelleMoment(c.moment) : c.creneau === "soir" ? "Soirée" : "Journée"}` : c.libelle;

/** Les idées montrées d'emblée : assez pour choisir, peu pour rester lisible sur un petit écran ; « Voir plus d'idées » montre le reste. */
const IDEES_VISIBLES = 8;
/** Les filtres n'apparaissent qu'avec assez d'idées, et au moins trois familles : en dessous, ils encombrent sans aider. */
const IDEES_POUR_FILTRES = 8;
const FAMILLES_POUR_FILTRES = 3;

/**
 * L'ÉTAPE ACTIVITÉS (30/10/2026, brief « Refonte UX de l'étape Activités ») : une seule sélection. Des idées selon la destination (la
 * fonction `lire-evenement`, ideesSejour.ts ; à défaut, IDEES_GENERIQUES), ce que la personne écrit elle-même, et « Ton programme » qui
 * rassemble ses choix. Aucun jour, aucun moment, aucun nom demandé : un mariage s'ajoute comme une visite, en un geste. Chaque choix garde
 * son libellé et porte l'activité du moteur qu'il évoque (activitesSejour.ts) ; seule celle-ci part vers le programme. Les événements
 * datés d'une valise d'avant restent avec leur jour : ils figurent au programme et se retirent de la même façon.
 */
function EtapeActivites({
  requete,
  jours,
  choix,
  setChoix,
  evenements,
  setEvenements,
}: {
  /** Le lieu tel qu'il part pour les idées (« Marrakech, Maroc »). */
  requete: string;
  jours: string[];
  choix: ActiviteChoisie[];
  setChoix: (f: (l: ActiviteChoisie[]) => ActiviteChoisie[]) => void;
  evenements: EvenementValise[];
  setEvenements: (f: (l: EvenementValise[]) => EvenementValise[]) => void;
}) {
  const [idees, setIdees] = useState<{ requete: string; liste: IdeeSejour[]; duLieu: boolean } | null>(() => {
    const gardees = ideesGardees(requete);
    return gardees ? { requete, liste: gardees, duLieu: true } : null;
  });
  useEffect(() => {
    if (idees?.requete === requete) return;
    let annule = false;
    void ideesPourDestination(requete).then((liste) => {
      if (!annule) setIdees({ requete, liste: liste ?? IDEES_GENERIQUES, duLieu: Boolean(liste) });
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requete]);
  const chargement = !idees || idees.requete !== requete;
  const liste = ideesUniques(chargement ? [] : idees.liste);

  const [filtre, setFiltre] = useState<CategorieIdee | null>(null);
  const [toutes, setToutes] = useState(false);
  const familles = CATEGORIES_IDEES.filter((c) => liste.some((i) => i.categorie === c.id));
  const avecFiltres = liste.length >= IDEES_POUR_FILTRES && familles.length >= FAMILLES_POUR_FILTRES;
  const filtrees = avecFiltres && filtre ? liste.filter((i) => i.categorie === filtre) : liste;
  const visibles = toutes || filtre ? filtrees : filtrees.slice(0, IDEES_VISIBLES);

  const [saisie, setSaisie] = useState("");
  const [doublon, setDoublon] = useState(false);
  const ajouter = () => {
    const libelle = libellePropre(saisie);
    if (!cleLibelle(libelle)) return;
    if (dejaChoisi(choix, libelle)) {
      setDoublon(true);
      return;
    }
    setChoix((l) => ajouterLibelle(l, libelle));
    setSaisie("");
    setDoublon(false);
    // Aucun mot ne dit l'activité : la lecture IA du libellé (celle des événements « Autre ») prend le relais, sans rien bloquer.
    if (!activiteDuLibelle(libelle)) {
      void lireNomEvenement(libelle).then((occasion) => {
        const activite = activiteDeLOccasion(occasion);
        if (activite) setChoix((l) => l.map((c) => (c.libelle === libelle && c.source === "perso" && !c.activite ? { ...c, activite } : c)));
      });
    }
  };

  const evtsDuSejour = evenementsDuSejour(evenements, jours);
  const total = choix.length + evtsDuSejour.length;
  const [confirmerEffacer, setConfirmerEffacer] = useState(false);

  const glyphe = (activite: ActiviteSejour | null) => (activite ? GLYPHES_ACTIVITE[activite] : GLYPHES_ACTIVITE.ville);

  return (
    <>
      {/* ── LES IDÉES ── */}
      <section className="mt-6" aria-labelledby="idees-sejour">
        <div id="idees-sejour" className="font-serif text-[19px] text-ink leading-[1.25]">
          Quelques idées pour ton séjour
        </div>
        <div className="text-[13px] text-muted leading-[1.5] mt-[4px]">
          {chargement || idees?.duLieu ? "Des suggestions selon ta destination." : "Des idées pour tout voyage : ajoute aussi les tiennes."}
        </div>

        {chargement ? (
          <div className="flex items-center gap-[10px] mt-4 text-[13px] text-muted" aria-live="polite">
            <LoadingSpinner size={16} /> On cherche des idées pour ta destination…
          </div>
        ) : (
          <>
            {avecFiltres && (
              <div className="scrollarea flex gap-[8px] overflow-x-auto -mx-6 px-6 mt-4" role="group" aria-label="Filtrer les idées">
                {[{ id: null, libelle: "Toutes" } as { id: CategorieIdee | null; libelle: string }, ...familles].map((f) => {
                  const on = filtre === f.id;
                  return (
                    <button
                      key={f.libelle}
                      type="button"
                      onClick={() => setFiltre(f.id)}
                      aria-pressed={on}
                      className={"flex-shrink-0 rounded-full px-[14px] text-[12px] border cursor-pointer " + (on ? "bg-ink text-cream border-ink" : "bg-transparent text-muted-3 border-border")}
                      style={{ minHeight: 36 }}
                    >
                      {f.libelle}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label="Idées d'activités">
              {visibles.map((idee) => {
                const on = dejaChoisi(choix, idee.libelle);
                return (
                  <button
                    key={idee.libelle}
                    type="button"
                    onClick={() => setChoix((l) => basculerIdee(l, idee))}
                    aria-pressed={on}
                    className={
                      "inline-flex items-center gap-[8px] rounded-[22px] pl-[12px] pr-[12px] py-[8px] border text-left cursor-pointer transition-colors max-w-full " +
                      (on ? "bg-terracotta-deep border-terracotta-deep text-on-terracotta" : "bg-card border-border text-ink")
                    }
                    style={{ minHeight: 44 }}
                  >
                    <span className={"flex-shrink-0 " + (on ? "text-on-terracotta" : "text-terracotta-deep")}>{glyphe(idee.activite)}</span>
                    <span className="text-[13px] leading-[1.25]">{idee.libelle}</span>
                    <span className="flex-shrink-0 opacity-80" aria-hidden="true">
                      {on ? G_COCHE(13, "currentColor") : G_PLUS}
                    </span>
                  </button>
                );
              })}
            </div>
            {!toutes && !filtre && filtrees.length > IDEES_VISIBLES && (
              <button type="button" onClick={() => setToutes(true)} className="mt-3 text-[13px] text-terracotta cursor-pointer min-h-[44px]">
                Voir plus d&apos;idées ({filtrees.length - IDEES_VISIBLES})
              </button>
            )}
          </>
        )}
      </section>

      {/* ── UNE AUTRE IDÉE ── un champ, un geste ; Entrée ajoute aussi. */}
      <section className="mt-8 pt-6 border-t border-border" aria-labelledby="autre-idee">
        <div id="autre-idee" className="font-serif text-[19px] text-ink leading-[1.25]">
          Une autre idée ?
        </div>
        <div className="text-[13px] text-muted leading-[1.5] mt-[4px]">Tu as prévu autre chose ? Ajoute-le ici.</div>
        <form
          className="flex items-center gap-2 mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            ajouter();
          }}
        >
          <Input
            value={saisie}
            onChange={(e) => {
              setSaisie(e.target.value);
              setDoublon(false);
            }}
            maxLength={LIBELLE_MAX}
            placeholder="Ex. Un mariage, une sortie en quad…"
            aria-label="Une autre activité ou un événement"
            enterKeyHint="done"
            className="flex-1 min-w-0"
          />
          <button
            type="submit"
            disabled={!cleLibelle(saisie)}
            aria-label="Ajouter à mon programme"
            className="flex-shrink-0 w-[48px] h-[48px] rounded-full bg-terracotta-deep text-on-terracotta flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-default"
          >
            {G_PLUS}
          </button>
        </form>
        {doublon && <div className="text-[12px] text-muted mt-2">C&apos;est déjà dans ton programme.</div>}
      </section>

      {/* ── TON PROGRAMME ── seulement s'il y a quelque chose : une section vide ne s'affiche pas. */}
      {total > 0 && (
        <section className="mt-8 pt-6 border-t border-border" aria-labelledby="ton-programme">
          <div className="flex items-baseline justify-between gap-3">
            <div id="ton-programme" className="font-serif text-[19px] text-ink leading-[1.25]">
              Ton programme <span className="text-muted text-[15px]">· {total}</span>
            </div>
            {total > 1 && (
              <button type="button" onClick={() => setConfirmerEffacer(true)} className="flex-shrink-0 text-[12px] text-terracotta cursor-pointer min-h-[44px] -my-[12px]">
                Tout effacer
              </button>
            )}
          </div>
          <ul className="flex flex-col gap-2 mt-3">
            {choix.map((c) => (
              <li key={c.libelle} className="flex items-center gap-[10px] bg-card border border-border rounded-tuile pl-[14px] pr-[2px]" style={{ minHeight: 48 }}>
                <span className="flex-shrink-0 text-terracotta-deep">{glyphe(c.activite)}</span>
                <span className="flex-1 min-w-0 text-[13px] text-ink leading-[1.3] py-[8px]">{c.libelle}</span>
                <button
                  type="button"
                  onClick={() => setChoix((l) => l.filter((x) => x.libelle !== c.libelle))}
                  aria-label={`Retirer ${c.libelle} de mon programme`}
                  className="flex-shrink-0 w-[44px] h-[44px] flex items-center justify-center text-muted cursor-pointer"
                >
                  {G_CROIX}
                </button>
              </li>
            ))}
            {evtsDuSejour.map((e) => (
              <li key={e.id} className="flex items-center gap-[10px] bg-card border border-border rounded-tuile pl-[14px] pr-[2px]" style={{ minHeight: 48 }}>
                <span className="flex-shrink-0 text-terracotta-deep">{GLYPHES_ACTIVITE.evenement}</span>
                <span className="flex-1 min-w-0 py-[8px]">
                  <span className="block text-[13px] text-ink leading-[1.3]">{libelleEvenement(e)}</span>
                  <span className="block text-[11px] text-muted mt-[2px]">
                    {dateCourte(e.jour)} · {libelleMoment(e.moment)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setEvenements((l) => l.filter((x) => x.id !== e.id))}
                  aria-label={`Retirer ${libelleEvenement(e)} de mon programme`}
                  className="flex-shrink-0 w-[44px] h-[44px] flex items-center justify-center text-muted cursor-pointer"
                >
                  {G_CROIX}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <BottomSheet title="Effacer ton programme ?" open={confirmerEffacer} onClose={() => setConfirmerEffacer(false)}>
        <div className="text-[13px] text-muted-3 leading-[1.5]">
          {total} {total > 1 ? "activités seront retirées" : "activité sera retirée"}. Les idées restent proposées : tu pourras les choisir à nouveau.
        </div>
        <div className="flex gap-2 mt-5">
          <Button variante="secondaire" pleine={false} className="flex-1 bg-card" onClick={() => setConfirmerEffacer(false)}>
            Garder
          </Button>
          <Button
            variante="principal"
            pleine={false}
            className="flex-1"
            onClick={() => {
              setChoix(() => []);
              setEvenements((l) => l.filter((x) => !evtsDuSejour.some((e) => e.id === x.id)));
              setConfirmerEffacer(false);
            }}
          >
            Tout effacer
          </Button>
        </div>
      </BottomSheet>
    </>
  );
}

/** La première étape d'un séjour : la destination choisie, avec ses coordonnées quand elle vient de la liste des villes. */
const etapePremiere = (destination: string, ville: VilleSuggeree | null): Omit<EtapeSejour, "arrivee"> =>
  ville
    ? { destination: ville.name, lat: ville.lat, lon: ville.lon, ...(ville.capitaleDe && ville.country ? { pays: ville.country } : {}) }
    : { destination: villeDuLieu(destination.trim()) };

/**
 * TES DESTINATIONS ET TES DATES (30/10/2026, demandé : « l'organisation et les textes » de la capture partagée). Chaque destination a
 * son champ de ville et, juste dessous, son champ de dates ; « Ajouter une autre destination » en ajoute une. Le modèle reste celui du
 * road trip (etapesSejour.ts) : le départ, le retour et le jour d'arrivée de chaque autre ville. Les dates d'une destination en sont la
 * lecture (periodesDesDestinations) ; les choisir les écrit (appliquerPeriode). Un seul calendrier ouvert à la fois, sous la destination
 * dont on choisit les dates : les deux touchers (début, fin) restent en brouillon, puis s'appliquent.
 */
function DestinationsDuVoyage({
  destination,
  onChoisirPremiere,
  paysPrefere,
  autres,
  setAutres,
  depart,
  retour,
  setDates,
  aujourdhui,
  premierJour,
}: {
  destination: string;
  onChoisirPremiere: (v: VilleSuggeree | null, libelle: string) => void;
  paysPrefere?: string;
  autres: EtapeSejour[];
  setAutres: (f: (l: EtapeSejour[]) => EtapeSejour[]) => void;
  depart: string;
  retour: string;
  setDates: (depart: string, retour: string) => void;
  aujourdhui: string;
  premierJour: string;
}) {
  const periodes = periodesDesDestinations(depart, retour, autres.map((e) => e.arrivee));
  const plusieurs = periodes.length > 1;
  // Le calendrier ouvert : celui de la première destination tant que le voyage n'a pas de dates, sinon aucun.
  const [ouvert, setOuvert] = useState<number | null>(depart && retour ? null : 0);
  const [brouillon, setBrouillon] = useState<Periode>({ debut: "", fin: "" });
  const ouvrir = (i: number) => {
    if (ouvert === i) return setOuvert(null);
    setBrouillon(periodes[i]);
    setOuvert(i);
  };
  const appliquer = (i: number, p: Periode) => {
    const r = appliquerPeriode({ depart, retour, arrivees: autres.map((e) => e.arrivee) }, i, p);
    setDates(r.depart, r.retour);
    setAutres((l) => l.map((e, k) => ({ ...e, arrivee: r.arrivees[k] ?? e.arrivee })));
  };
  const libellePeriode = (p: Periode) => {
    if (!periodeValide(p)) return null;
    const n = joursEntre(p.debut, p.fin);
    return { dates: `${dateCourte(p.debut)} → ${dateCourte(p.fin)}`, nuits: `${n} ${n > 1 ? "nuits" : "nuit"}` };
  };
  const ajouter = () => {
    const derniere = periodes[periodes.length - 1];
    setAutres((l) => [...l, { destination: "", arrivee: arriveeAuMilieu(derniere, joursDuSejour) }]);
    setOuvert(null);
  };
  const derniereNommee = autres.length === 0 ? destination.trim().length > 1 : !!autres[autres.length - 1].destination.trim();

  return (
    <ol className="flex flex-col gap-6 mt-6">
      {periodes.map((p, i) => {
        const etape = i > 0 ? autres[i - 1] : null;
        const lu = libellePeriode(p);
        // Le premier jour qu'on peut toucher : le départ (ou aujourd'hui) pour la première, le lendemain du début de la précédente ensuite.
        const minimum = i === 0 ? premierJour : periodes[i - 1].debut ? plusJours(periodes[i - 1].debut, 1) : premierJour;
        return (
          <li key={i}>
            <div className="flex items-baseline justify-between gap-3">
              <Surtitre>{plusieurs ? `Destination ${i + 1}` : "Ta destination"}</Surtitre>
              {etape && (
                <button
                  type="button"
                  onClick={() => {
                    setAutres((l) => l.filter((_, k) => k !== i - 1));
                    setOuvert(null);
                  }}
                  className="t-lien text-terracotta-deep cursor-pointer min-h-[44px] -my-[12px]"
                >
                  Retirer
                </button>
              )}
            </div>
            {i === 0 ? (
              <ChoixVille avecPosition={false} avecRecentes={false} titre={null} lieu={destination} onChoisir={onChoisirPremiere} />
            ) : (
              <ChoixVille
                avecPosition={false}
                avecRecentes={false}
                titre={null}
                paysPrefere={paysPrefere}
                lieu={etape?.destination ?? ""}
                onChoisir={(v, libelle) =>
                  setAutres((l) => l.map((x, k) => (k === i - 1 ? { ...x, destination: v ? v.name : villeDuLieu(libelle), ...(v ? { lat: v.lat, lon: v.lon } : {}) } : x)))
                }
              />
            )}
            {/* Le champ de dates, sous la ville (comme la capture) : « Sélectionner les dates », ou les dates et les nuits. */}
            <button
              type="button"
              onClick={() => ouvrir(i)}
              aria-expanded={ouvert === i}
              className={
                "w-full mt-[8px] flex items-center gap-[10px] rounded-bloc border bg-card px-[14px] text-left cursor-pointer " +
                (ouvert === i ? "border-terracotta" : "border-border")
              }
              style={{ minHeight: 52 }}
            >
              <span className={"flex-shrink-0 " + (lu ? "text-terracotta-deep" : "text-placeholder")}>{G_CALENDRIER}</span>
              <span className="flex-1 min-w-0">
                {lu ? (
                  <>
                    <span className="block font-serif text-[15px] text-ink">{lu.dates}</span>
                    <span className="block text-[11px] text-muted mt-[1px]">{lu.nuits}</span>
                  </>
                ) : (
                  <span className="block text-[14px] text-placeholder">Sélectionner les dates</span>
                )}
              </span>
            </button>
            {ouvert === i && (
              <div className="mt-2">
                <CalendrierPeriode
                  depart={brouillon.debut}
                  retour={brouillon.fin}
                  aujourdhui={aujourdhui}
                  premierJour={minimum}
                  onChange={(n) => {
                    setBrouillon({ debut: n.depart, fin: n.retour });
                    if (n.depart && n.retour) {
                      appliquer(i, { debut: n.depart, fin: n.retour });
                      setOuvert(null);
                    }
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
      {derniereNommee && autres.length < ETAPES_MAX - 1 && (
        <li>
          <button type="button" onClick={ajouter} className="w-full inline-flex items-center justify-center gap-[8px] text-[14px] text-ink cursor-pointer" style={{ minHeight: 44 }}>
            {G_PLUS} Ajouter une autre destination
          </button>
        </li>
      )}
    </ol>
  );
}

export default function ValiseScreen() {
  const { state, weather, defaultCapsule, vestiairePool, actions } = useCapsela();
  const { profile } = useAuth();
  /** La capsule du séjour : bâtie sur la météo du séjour, pas sur celle d'aujourd'hui à la maison (capsuleDuSejour, 22/10/2026). */
  const capsuleDe = (situations: SituationValise[]): Item[] =>
    capsuleDuSejour(situations, (meteo, saison) => computeDefaultCapsule(profile, meteo, state.suggestedExcluded, saison, vestiairePool));
  const dressing = state.items;
  const generer = useMemo(() => generateurMoteur(paletteHexes(profile), profile.gender, colorimetrieMoteur(profile.colorimetrie)), [profile]);

  const [vue, setVue] = useState<Vue>({ nom: "etape" });
  const [etape, setEtape] = useState(1);
  /**
   * LA VALISE AFFICHÉE vient du store (27/09/2026) : les valises sont une
   * liste, gardée sur l'appareil et dans le compte, rappelée dans « Mes
   * planifications ». `valiseOuverte` null : une nouvelle valise.
   */
  const valise = state.valises.find((v) => v.id === state.valiseOuverte) ?? null;
  /** La capsule de la valise affichée, pour la compléter ou y ajouter une tenue : celle de son séjour, recalculée depuis ses situations. */
  const capsuleDuSejourAffiche = useMemo(
    () => (valise ? capsuleDe(valise.situations) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [valise?.situations, profile, state.suggestedExcluded, vestiairePool]
  );
  /** La valise dont on modifie les réponses : la génération la remplace au lieu d'en créer une. */
  const [idEnModification, setIdEnModification] = useState<string | null>(null);
  /** Où elle est gardée, tel que c'est : une valise locale, ou dont la dernière écriture a échoué, ne suit pas sur un autre appareil. */
  const gardeeOu: "compte" | "appareil" | null = !valise ? null : estIdLocal(valise.id) || state.valiseStatut === "appareil" ? "appareil" : "compte";
  // Ouverte depuis Planifier (ou rouverte) : directement le résultat.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (valise && vue.nom === "etape" && !idEnModification) setVue({ nom: "resultat" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valise?.id]);
  const sauver = actions.sauverValise;

  // ── Réponses ──
  const aujourdhui = jourLocal();
  /**
   * RACCOURCIR OU PROLONGER UN SÉJOUR COMMENCÉ (30/10/2026, demandé : « je dois pouvoir modifier les dates du séjour pour le raccourcir »).
   * Une valise qu'on modifie garde le droit à sa date de départ, même passée : sans cela, le calendrier refusait tout jour d'avant
   * aujourd'hui et l'étape restait bloquée. Une nouvelle valise, elle, part toujours d'aujourd'hui ou plus tard.
   */
  const departGarde = idEnModification && valise?.id === idEnModification ? valise.depart : null;
  const premierJour = departGarde && departGarde < aujourdhui ? departGarde : aujourdhui;
  const sejourCommence = premierJour < aujourdhui;
  const [destination, setDestination] = useState("");
  const [ville, setVille] = useState<VilleSuggeree | null>(null);
  /** LES AUTRES ÉTAPES D'UN ROAD TRIP (30/10/2026, etapesSejour.ts) : chaque ville et son jour d'arrivée. La première est `destination`. */
  const [autresEtapes, setAutresEtapes] = useState<EtapeSejour[]>([]);
  const [depart, setDepart] = useState("");
  const [retour, setRetour] = useState("");
  const [bagage, setBagage] = useState<TailleBagage | null>(null);
  /**
   * LES ACTIVITÉS du séjour (maquette V2, 11/10/2026) : jusqu'à quatre. Elles donnent le programme (programmeDesActivites), que le
   * moteur reçoit en occasions mères et que le planning jour par jour répartit — le moteur et la phase B sont inchangés.
   */
  const [choix, setChoix] = useState<ActiviteChoisie[]>([]);
  /** Depuis le 30/10/2026, les activités viennent des CHOIX de l'étape (idées ou libellés saisis, activitesSejour.ts) : leur traduction. */
  const activites = activitesDesChoix(choix);
  /** LES ÉVÉNEMENTS DATÉS (étape 4, 22/10/2026) : facultatifs ; chacun a son jour, son moment, son look (evenementsValise.ts). */
  const [evenements, setEvenements] = useState<EvenementValise[]>([]);
  /** Les réponses de la dernière préparation, gardées pour « Réessayer » après un échec. */
  const [dernieresReponses, setDernieresReponses] = useState<{ rep: Reponses; id: string | null } | null>(null);

  const jours = depart && retour && retour >= depart ? joursDuSejour(depart, retour) : [];
  /** La valise que la durée du séjour conseille (maquette : « Valise M conseillée pour 5 jours »). */
  const conseille = bagageConseille(Math.max(1, jours.length));
  const dureeOk = jours.length > 0 && dateDe(retour) <= dateDe(plusJours(depart, DUREE_MAX_JOURS - 1));
  const nomVille = ville ? ville.name : villeDuLieu(destination.trim());
  const etapes = depart && retour ? etapesRetenues(etapePremiere(destination, ville), autresEtapes, depart, retour) : [];
  const roadTrip = etapes.length > 1;
  /** Une étape ajoutée sans ville, ou dont le jour d'arrivée est déjà pris : on le dit, le bouton attend (jamais écartée en silence). */
  const etapesCompletes =
    autresEtapes.every((e) => e.destination.trim() && etapes.includes(e)) &&
    // Chaque destination a des dates complètes et dans l'ordre (30/10/2026, une destination, ses dates).
    (autresEtapes.length === 0 || periodesDesDestinations(depart, retour, autresEtapes.map((e) => e.arrivee)).every(periodeValide));
  const programme: ItemProgramme[] = programmeDesActivites(activites, jours.length || 1);

  /**
   * LA MÉTÉO SUR PLACE, DÈS L'ÉTAPE 1 — seulement quand la prévision peut la
   * connaître (départ dans l'horizon de 4 jours). Demandée une fois la
   * destination et les dates posées ; gardée pour la génération, qui ne la
   * redemande pas.
   */
  const clePrevision = nomVille.length > 1 && dureeOk && joursEntre(aujourdhui, depart) <= HORIZON_PREVISION_JOURS ? `${ville ? `${ville.lat},${ville.lon}` : nomVille.toLowerCase()}` : null;
  const [prevision, setPrevision] = useState<{ cle: string; p: Prevision | null } | null>(null);
  useEffect(() => {
    if (!clePrevision || prevision?.cle === clePrevision) return;
    let annule = false;
    const t = setTimeout(() => {
      previsionGardee(ville ? ville.name : destination.trim(), ville)
        .catch(() => null)
        .then((p) => !annule && setPrevision({ cle: clePrevision, p }));
    }, 600);
    return () => {
      annule = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clePrevision]);

  /**
   * LA MÉTÉO DE CHAQUE JOUR DU SÉJOUR : la prévision quand elle couvre le jour ; sinon (au-delà de l'horizon, ou sans réponse) les
   * TEMPÉRATURES HABITUELLES du lieu à la date du séjour (`climat`, 08/10/2026) — jamais les degrés d'aujourd'hui quand on part ailleurs,
   * plus tard. Sans climatologie : la météo d'aujourd'hui, comme avant. `prevue` dit seulement s'il s'agit d'une prévision.
   */
  const meteosDe = (p: Prevision | null, js: string[] = jours, climat: Climat | null = null): MeteoJour[] =>
    js.map((j) => {
      const m = p ? previsionPour(p, j, "Toute la journée") : null;
      if (m) return { jour: j, temp: m.temp, label: m.label, prevue: true };
      if (climat) {
        const temp = Math.round((climat.tempMin + climat.tempMax) / 2);
        return { jour: j, temp, label: climat.pluie >= 0.6 ? "Pluvieux" : climat.tempMax >= 25 ? "Ensoleillé" : "Nuageux", prevue: false };
      }
      return { jour: j, temp: weather.temp, label: weather.label, prevue: false };
    });
  const meteosEtape1 = prevision && prevision.cle === clePrevision ? meteosDe(prevision.p) : null;
  const amplitudeEtape1 = meteosEtape1 ? amplitudePrevue(meteosEtape1) : null;

  const etapeValide =
    etape === 1 ? destination.trim().length > 1 && depart >= premierJour && dureeOk && etapesCompletes : etape === 2 ? bagage != null : true;

  const zoneScroll = useRef<HTMLDivElement | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("ensemble");
  const cleVue = vue.nom === "look" ? `look${vue.index}` : vue.nom === "piece" ? `piece${vue.id}` : vue.nom;
  useEffect(() => {
    zoneScroll.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [etape, cleVue, onglet]);

  /**
   * LA GÉNÉRATION, EN QUATRE ÉTAPES RÉELLES — chacune cochée quand elle est
   * faite : la météo (prévision du lieu, ou la règle de Planifier), le
   * programme (les situations occasion × météo), la sélection dans le
   * dressing et l'optimisation (composerValise : couvrir, alléger, enrichir,
   * looks finaux). Le calcul prend une fraction de seconde : chaque étape
   * reste affichée un court instant, pour qu'on la lise — rien n'est simulé.
   */
  const [faites, setFaites] = useState(0);
  // Le parcours peut être quitté pendant la génération : on n'écrit plus rien
  // alors. Remis à vrai au montage (le double montage du mode strict passe
  // par un démontage).
  const actif = useRef(true);
  useEffect(() => {
    actif.current = true;
    return () => {
      actif.current = false;
    };
  }, []);
  type Reponses = {
    destination: string;
    ville: VilleSuggeree | null;
    /** Les étapes d'un road trip (au moins deux) ; absentes pour une seule destination. */
    etapes?: EtapeSejour[];
    depart: string;
    retour: string;
    bagage: TailleBagage;
    sejour: TypeSejour | null;
    occasions: OccasionKey[];
    /** Le programme du séjour (absent d'une valise recomposée qui n'en avait pas). */
    programme?: ItemProgramme[];
    /** Les activités choisies, gardées avec la valise pour rouvrir le parcours tel qu'il a été rempli. */
    activites?: ActiviteSejour[];
    /** Les choix de l'étape Activités, avec leur libellé (30/10/2026). */
    choix?: ActiviteChoisie[];
    /** Les événements datés du séjour (étape 4), déjà restreints à ses dates. */
    evenements?: EvenementValise[];
  };
  /** Une préparation à la fois (22/10/2026) : un double toucher sur « Générer ma valise » ne lance pas deux calculs. */
  const preparationEnCours = useRef(false);
  const lancer = async (rep: Reponses, idCible: string | null) => {
    if (preparationEnCours.current) return;
    preparationEnCours.current = true;
    setDernieresReponses({ rep, id: idCible });
    try {
      await calculer(rep, idCible);
    } catch (err) {
      // Un échec (réseau, calcul) ne perd rien : les réponses sont gardées, l'écran propose de relancer.
      console.error("[valise] préparation interrompue", err);
      if (actif.current) setVue({ nom: "erreur" });
    } finally {
      preparationEnCours.current = false;
    }
  };
  const calculer = async (rep: Reponses, idCible: string | null) => {
    const joursRep = joursDuSejour(rep.depart, rep.retour);
    setFaites(0);
    setVue({ nom: "calcul" });
    /**
     * La météo de chaque jour, VILLE PAR VILLE pour un road trip (30/10/2026) : chaque étape, sa prévision et sa climatologie, sur ses
     * seuls jours. Une seule destination : une seule étape, le calcul d'avant.
     */
    const etapesRep: { nom: string; ville: VilleSuggeree | null; jours: string[] }[] = rep.etapes?.length
      ? joursParEtape(rep.etapes, joursRep).map(({ etape, jours: js }) => ({
          nom: etape.destination,
          ville: etape.lat != null && etape.lon != null ? { name: villeDuLieu(etape.destination), country: "", state: "", lat: etape.lat, lon: etape.lon } : null,
          jours: js,
        }))
      : [{ nom: rep.ville ? rep.ville.name : rep.destination.trim(), ville: rep.ville, jours: joursRep }];
    const [meteosParEtape] = await Promise.all([
      Promise.all(
        etapesRep.map(async (e) => {
          const cle = e.ville ? `${e.ville.lat},${e.ville.lon}` : villeDuLieu(e.nom).toLowerCase();
          const p = prevision && prevision.cle === cle ? prevision.p : await previsionGardee(e.ville ? e.ville.name : villeDuLieu(e.nom), e.ville).catch(() => null);
          // Les jours que la prévision ne couvre pas : la climatologie du lieu, à la date au milieu de ces jours (un seul appel).
          const sansPrevision = e.jours.filter((j) => !(p && previsionPour(p, j, "Toute la journée")));
          const climat =
            e.ville && sansPrevision.length > 0 ? await fetchClimat({ lat: e.ville.lat, lon: e.ville.lon }, dateDe(sansPrevision[Math.floor(sansPrevision.length / 2)])).catch(() => null) : null;
          return meteosDe(p, e.jours, climat);
        })
      ),
      pause(450),
    ]);
    const meteos = meteosParEtape.flat();
    if (!actif.current) return;
    setFaites(1);
    // Les événements datés ont chacun leur situation, APRÈS celles du programme : les indices de celles-ci ne bougent pas.
    const situations = [...situationsDuProgramme(rep.programme ?? [], meteos, rep.occasions), ...situationsDesEvenements(rep.evenements, meteos)];
    // Une courte pause entre deux traitements, le temps qu'on lise la ligne cochée : jamais une étape qui n'aurait pas eu lieu.
    await pause(300);
    if (!actif.current) return;
    const r0 = composerValise(dressing, situations, capaciteDe(rep.bagage), generer);
    setFaites(2);
    await pause(300);
    if (!actif.current) return;
    // Le dressing ne couvre pas toutes les occasions : la capsule complète la valise, ses pièces marquées « à ajouter » (completerAvecCapsule).
    const r = completerAvecCapsule(dressing, capsuleDe(situations), situations, r0, capaciteDe(rep.bagage), generer);
    setFaites(3);
    await pause(300);
    if (!actif.current) return;
    const id = idCible ?? nouvelIdLocal();
    const ancienne = idCible ? state.valises.find((v) => v.id === idCible) : undefined;
    const cochees = (ancienne?.cochees ?? []).filter((x) => r.pieceIds.includes(x));
    sauver({
      version: 2,
      id,
      destination: rep.etapes?.length ? libelleItineraire(rep.etapes) : rep.ville ? rep.ville.name : villeDuLieu(rep.destination.trim()),
      ...(rep.etapes && rep.etapes.length > 1 ? { etapes: rep.etapes } : {}),
      depart: rep.depart,
      retour: rep.retour,
      bagage: rep.bagage,
      sejour: rep.sejour,
      occasions: rep.occasions,
      ...(rep.programme?.length ? { programme: rep.programme } : {}),
      ...(rep.activites?.length ? { activites: rep.activites } : {}),
      ...(rep.choix?.length ? { choix: rep.choix } : {}),
      ...(rep.evenements?.length ? { evenements: rep.evenements } : {}),
      // La check-list suit la valise recomposée : seules les pièces encore présentes restent cochées.
      ...(cochees.length ? { cochees } : {}),
      // Les affaires de voyage de la personne (cochées, ajoutées, masquées) suivent la valise recomposée.
      ...(ancienne?.affaires ? { affaires: ancienne.affaires } : {}),
      meteos,
      situations,
      ...r,
      // Les pièces du dressing au moment du calcul : une pièce ajoutée
      // ensuite se reconnaît, et l'écran propose de recomposer.
      dressingIds: dressing.map((i) => i.id),
    });
    actions.afficherValise(id);
    setIdEnModification(null);
    setOnglet("ensemble");
    setVue({ nom: "resultat" });
  };
  const preparer = () => {
    if (!bagage) return;
    // Les occasions que reçoit le moteur sont les MÈRES du programme (occasionsDuProgramme) : une sous-occasion hérite des
    // règles de son occasion mère, le moteur ne connaît pas autre chose.
    const retenu = programme;
    // Les événements hors des dates (les dates ont changé depuis leur ajout) ne partent pas avec la valise.
    const evts = evenementsDuSejour(evenements, jours);
    const meres = occasionsDuProgramme([...retenu, ...evts.map((e) => ({ id: e.type, frequence: 1 }))]);
    void lancer(
      { destination, ville, ...(roadTrip ? { etapes } : {}), depart, retour, bagage, sejour: null, occasions: occasionsRetenues(meres, null), programme: retenu, activites, choix, evenements: evts },
      idEnModification
    );
  };
  /** Recomposer la valise affichée avec le dressing d'aujourd'hui (des pièces y ont été ajoutées) : mêmes réponses, même valise. */
  const recomposer = () => {
    if (!valise) return;
    void lancer(
      { destination: valise.destination, ville: null, ...(valise.etapes ? { etapes: valise.etapes } : {}), depart: valise.depart, retour: valise.retour, bagage: valise.bagage, sejour: valise.sejour, occasions: valise.occasions, programme: valise.programme, activites: valise.activites, choix: valise.choix, evenements: valise.evenements },
      valise.id
    );
  };

  /** Nouvelles pièces : les looks sont recomptés par le moteur. */
  const avecPieces = (v: ValiseGardee, ids: number[]): ValiseGardee => {
    // Le pool compte les suggestions de capsule que la valise porte : sans elles, le moteur perdrait leurs looks à chaque modification.
    const pool = poolDeLaValise(dressing, v.suggestionIds, [...defaultCapsule, ...vestiairePool]);
    const restantes = (v.suggestionIds ?? []).filter((id) => ids.includes(id));
    const cochees = (v.cochees ?? []).filter((id) => ids.includes(id));
    return { ...v, ...looksDeLaValise(ids, pool, v.situations, generer, v.looks), suggestionIds: restantes.length ? restantes : undefined, cochees: cochees.length ? cochees : undefined };
  };
  const retirer = (ids: number[]) => valise && sauver(avecPieces(valise, valise.pieceIds.filter((x) => !ids.includes(x))));
  const ajouter = (id: number) => valise && sauver(avecPieces(valise, [...valise.pieceIds, id]));
  /** « Ajouter une tenue » : la tenue et les pièces qu'elle demande entrent dans la valise, sans recomposer le reste. */
  const ajouterTenue = (t: TenueProposee, situation: number) => valise && sauver({ ...valise, ...avecTenue(valise, t, situation) });
  const remplacer = (ancien: number, nouveau: number) => valise && sauver(avecPieces(valise, [...valise.pieceIds.filter((x) => x !== ancien), nouveau]));
  /**
   * CHANGER LA TAILLE d'une valise déjà préparée : la sélection est CONSERVÉE (aucune pièce n'est retirée en silence) ; seule la capacité
   * change. Plus petite et dépassée : l'écran le dit et propose d'alléger (« On allège un peu ? »). Plus grande : la sélection reste, et
   * l'écran propose de recomposer pour profiter de la place.
   */
  const changerBagage = (t: TailleBagage) => valise && sauver({ ...valise, bagage: t });
  /** Les affaires de voyage : ce que la personne coche, ajoute ou masque est gardé avec la valise (appareil et compte). */
  const majAffaires = (f: (e: EtatAffaires) => EtatAffaires) => {
    if (!valise) return;
    const e = f(valise.affaires ?? {});
    const propre: EtatAffaires = {
      ...(e.cochees?.length ? { cochees: e.cochees } : {}),
      ...(e.ajoutees?.length ? { ajoutees: e.ajoutees } : {}),
      ...(e.masquees?.length ? { masquees: e.masquees } : {}),
    };
    sauver({ ...valise, affaires: Object.keys(propre).length ? propre : undefined });
  };
  /** Coche ou décoche une pièce de la check-list : l'état vit avec la valise (appareil et compte). */
  const cocherPiece = (id: number) => {
    if (!valise) return;
    const actuelles = (valise.cochees ?? lireChecklistHeritee(valise.id)).filter((x) => valise.pieceIds.includes(x));
    const suivantes = actuelles.includes(id) ? actuelles.filter((x) => x !== id) : [...actuelles, id];
    sauver({ ...valise, cochees: suivantes.length ? suivantes : undefined });
  };

  /** « Nouvelle valise » : la précédente reste dans « Mes planifications ». */
  const recommencer = () => {
    actions.afficherValise(null);
    setIdEnModification(null);
    setDestination("");
    setVille(null);
    setAutresEtapes([]);
    setDepart("");
    setRetour("");
    setBagage(null);
    setChoix([]);
    setEvenements([]);
    setVue({ nom: "etape" });
    setEtape(1);
  };

  const supprimer = () => {
    if (!valise) return;
    actions.supprimerValise(valise.id);
    actions.quitterValise();
  };

  /** Reprendre les réponses de la valise affichée, pour la modifier. */
  const modifier = () => {
    if (!valise) return;
    // Un road trip reprend sa première ville comme destination, les autres comme étapes (avec leurs coordonnées).
    const [premiere, ...suivantes] = valise.etapes ?? [];
    setDestination(premiere ? premiere.destination : valise.destination);
    setVille(
      premiere && premiere.lat != null && premiere.lon != null
        ? { name: villeDuLieu(premiere.destination), country: premiere.pays ?? "", state: "", lat: premiere.lat, lon: premiere.lon, ...(premiere.pays ? { capitaleDe: villeDuLieu(premiere.destination) } : {}) }
        : null
    );
    setAutresEtapes(suivantes);
    setDepart(valise.depart);
    setRetour(valise.retour);
    setBagage(valise.bagage);
    // Les activités qu'évoque le programme gardé ; une valise d'avant la refonte n'a que ses occasions mères.
    setChoix(choixDeLaValise(valise.choix, valise.activites ?? activitesDuProgramme(valise.programme ?? programmeDepuisOccasions(valise.occasions, valise.meteos.length || 1))));
    setEvenements(valise.evenements ?? []);
    setIdEnModification(valise.id);
    setVue({ nom: "etape" });
    setEtape(1);
  };

  const revenir = () => {
    if (vue.nom === "etape" && etape > 1) setEtape(etape - 1);
    else if (vue.nom === "look") setVue({ nom: "resultat" });
    else if (vue.nom === "piece") setVue(vue.depuis);
    else if (vue.nom === "etape" && idEnModification && valise) {
      // Modification abandonnée : retour à la valise telle qu'elle était.
      setIdEnModification(null);
      setVue({ nom: "resultat" });
    } else actions.quitterValise();
  };
  const libelleRetour =
    vue.nom === "etape" && etape > 1
      ? "Revenir à l'étape précédente"
      : vue.nom === "look"
        ? "Revenir à ta valise"
        : vue.nom === "piece"
          ? vue.depuis.nom === "look"
            ? "Revenir au look"
            : "Revenir à ta valise"
          : state.valiseRetour === "planifier"
            ? "Revenir à Planifier"
            : "Revenir à l'accueil";

  /**
   * LE MINIMUM POUR UNE NOUVELLE VALISE (27/09/2026) : de quoi remplir une
   * valise S. En dessous, les questions ne s'ouvrent pas : l'écran dit ce
   * qui manque et mène à l'ajout. Une valise existante reste consultable et
   * modifiable.
   */
  const pret = pretPourUneValise(dressing);
  const bloquee = vue.nom === "etape" && !idEnModification && !pret.pret;
  const questions = vue.nom === "etape" && !bloquee;

  // ── Rendu ──
  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 px-6 pt-[6px]">
        <AppHeader onBack={vue.nom === "calcul" ? undefined : revenir} backLabel={libelleRetour} />
      </div>
      {questions && (
        <div className="flex-shrink-0 flex justify-center px-6 pb-[2px]">
          <FilEtapes total={DERNIERE_ETAPE} courante={etape - 1} />
        </div>
      )}

      <div
        ref={zoneScroll}
        className={"scrollarea flex-1 min-h-0 overflow-y-auto px-6 pt-4 " + (vue.nom === "etape" || vue.nom === "calcul" ? "pb-5" : "pb-safe-nav")}
      >
        {/* ── AVANT LA PREMIÈRE QUESTION : LE MINIMUM ── */}
        {bloquee && (
          <>
            <Surtitre>Ta valise</Surtitre>
            <TitreEtape a="Ton dressing" b="d'abord" />
            <div className="t-chapeau text-muted-3 mt-2">
              Ta valise se compose uniquement avec tes pièces. Pour la préparer, il en faut au moins {MINIMUM_PIECES_VALISE}
              {"\u00a0"}: de quoi remplir une valise S.
            </div>
            <Card className="mt-5 p-[16px]">
              <div className="flex items-baseline justify-between">
                <span className="font-serif text-[20px] text-ink">
                  {Math.min(dressing.length, MINIMUM_PIECES_VALISE)} / {MINIMUM_PIECES_VALISE} pièces
                </span>
                {pret.manquePieces > 0 && (
                  <span className="text-[12px] text-terracotta">
                    encore {pret.manquePieces} {pret.manquePieces > 1 ? "pièces" : "pièce"}
                  </span>
                )}
              </div>
              <div className="h-[5px] rounded-full mt-3 overflow-hidden" style={{ background: "var(--color-chip-soft-bg)" }} aria-hidden="true">
                <div className="h-full rounded-full bg-terracotta-deep" style={{ width: `${(Math.min(dressing.length, MINIMUM_PIECES_VALISE) / MINIMUM_PIECES_VALISE) * 100}%` }} />
              </div>
              {pret.manqueBase.length > 0 && (
                <>
                  <div className="text-[12px] text-ink leading-[1.45] mt-4">
                    Il manque aussi la base d&apos;une tenue{"\u00a0"}:
                  </div>
                  <div className="flex flex-wrap gap-[6px] mt-[8px]">
                    {pret.manqueBase.map((m) => (
                      <button
                        key={m}
                        onClick={() => actions.openAddForCategory(m === "bas" ? "pantalon" : m)}
                        aria-label={`Ajouter ${m === "bas" ? "un bas" : m === "haut" ? "un haut" : "des chaussures"} à ton dressing`}
                        className="inline-flex items-center gap-[5px] rounded-full border border-terracotta text-terracotta px-[12px] text-[12px] cursor-pointer"
                        style={{ minHeight: 38 }}
                      >
                        {G_PLUS} {m === "bas" ? "un bas" : m === "haut" ? "un haut" : "des chaussures"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </>
        )}

        {/* ── 1. DESTINATION ── */}
        {questions && etape === 1 && (
          <>
            <Surtitre>Ta valise · 1 / 3</Surtitre>
            <TitreEtape a="Ton prochain" b="voyage" />
            <div className="text-[13px] text-muted leading-[1.5] mt-2">Choisis tes destinations et les dates de ton voyage.</div>
            {/* L'ORGANISATION DE LA CAPTURE PARTAGÉE (30/10/2026, demandé) : chaque destination, sa ville puis ses dates
                (DestinationsDuVoyage) ; le même choix de ville que « Planifier une tenue », sans villes récentes ni position. */}
            <DestinationsDuVoyage
              destination={destination}
              onChoisirPremiere={(v, libelle) => {
                setVille(v);
                setDestination(libelle);
              }}
              paysPrefere={ville?.capitaleDe ? ville.country || undefined : undefined}
              autres={autresEtapes}
              setAutres={setAutresEtapes}
              depart={depart}
              retour={retour}
              setDates={(d, r) => {
                setDepart(d);
                setRetour(r);
              }}
              aujourdhui={aujourdhui}
              premierJour={premierJour}
            />
            {autresEtapes.some((e) => !e.destination.trim()) && (
              <div className="text-[12px] text-muted mt-3">Choisis la ville de ta nouvelle destination, ou retire-la, pour continuer.</div>
            )}
            {autresEtapes.some((e) => e.destination.trim()) && !etapesCompletes && (
              <div className="text-[12px] text-muted mt-3">Choisis les dates de chaque destination pour continuer.</div>
            )}
            {jours.length > 0 && (
              <div className="text-[12px] text-muted mt-3">{dureeOk ? libelleDuree(jours.length) : `Un séjour de ${DUREE_MAX_JOURS} jours au plus.`}</div>
            )}

            {/* Les saisies invalides sont dites, jamais corrigées en silence : le bouton reste grisé tant qu'elles le sont. */}
            {depart && depart < premierJour && (
              <div role="alert" className="text-[12px] text-terracotta mt-2">
                La date de départ est passée : choisis une date à venir.
              </div>
            )}
            {sejourCommence && (
              <div className="text-[12px] text-muted leading-[1.5] mt-2">
                Ton séjour a déjà commencé : touche ta date de départ, puis ta nouvelle date de retour.
              </div>
            )}
            {destination.trim().length > 1 && (!depart || !retour) && (
              <div className="text-[12px] text-muted mt-2">Choisis les dates de ton voyage pour continuer.</div>
            )}
            {/* Le résumé météo n'existe que si la prévision a répondu pour au
                moins un jour du séjour — jamais une température supposée. */}
            {meteosEtape1 && amplitudeEtape1 && (
              <Card className="flex items-start gap-[12px] mt-5 px-[16px] py-[14px]">
                <span className="flex-shrink-0 text-terracotta mt-[2px]">{G_METEO}</span>
                <div className="min-w-0">
                  <div className="text-[13px] text-ink">{nomVille}</div>
                  <div className="font-serif text-[16px] text-ink mt-[2px]">
                    {libelleAmplitude(amplitudeEtape1)} prévus
                    {amplitudeEtape1.jours < jours.length && (
                      <span className="text-[12px] text-muted font-sans">
                        {" "}
                        · {amplitudeEtape1.jours} {amplitudeEtape1.jours > 1 ? "premiers jours" : "premier jour"}
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] text-muted leading-[1.45] mt-[4px]">{conseilMeteo(meteosEtape1)}</div>
                  {couvertureMeteo(meteosEtape1).sansPrevision.length > 0 && (
                    <div className="text-[12px] text-muted-3 leading-[1.45] mt-[6px]">
                      {couvertureMeteo(meteosEtape1).sansPrevision.join(", ")} : prévisions météo non disponibles. Capsela adapte les looks selon la saison et le type de séjour.
                    </div>
                  )}
                </div>
              </Card>
            )}
            {/* Aucune prévision pour ces dates : on le dit, sans température (la prévision ne va pas au-delà de quelques jours). */}
            {jours.length > 0 && dureeOk && !(meteosEtape1 && amplitudeEtape1) && clePrevision == null && (
              <div className="text-[12px] text-muted-3 leading-[1.5] mt-4">
                Prévisions météo non disponibles pour ces dates. Capsela adapte les looks selon la saison et le type de séjour.
              </div>
            )}
          </>
        )}

        {/* Dès la première question : la valise ne puise que dans le dressing
            (27/09/2026). Le nombre dit, et le chemin pour le compléter. */}
        {questions && etape === 1 && (
          <div className="mt-5">
            <CarteInfo glyphe={G_CINTRE}>
              {dressing.length
                ? `Ta valise sera composée avec les ${dressing.length} ${dressing.length > 1 ? "pièces" : "pièce"} de ton dressing : plus il est complet, plus elle aura de looks.`
                : "Ta valise se compose avec les pièces de ton dressing, encore vide."}{" "}
              <button onClick={actions.openAddEtRevenir} className="text-terracotta cursor-pointer">
                Ajouter des pièces
              </button>
            </CarteInfo>
          </div>
        )}

        {/* ── 2. VALISE ── */}
        {questions && etape === 2 && (
          <>
            <Surtitre>Ta valise · 2 / 3</Surtitre>
            <TitreEtape a="Quelle valise" b="emportes-tu ?" />
            <div className="text-[13px] text-muted leading-[1.5] mt-2">Nous adaptons ta sélection à sa capacité.</div>
            <div className="grid grid-cols-2 gap-[10px] mt-5">
              {BAGAGES.map(([t, , cap], i) => {
                const on = bagage === t;
                return (
                  <button
                    key={t}
                    onClick={() => setBagage(t)}
                    aria-pressed={on}
                    aria-label={`${t}, ${USAGE_BAGAGE[t]}, environ ${cap} pièces${conseille === t ? ", conseillée" : ""}`}
                    className={
                      "relative flex flex-col text-left rounded-feuille px-[14px] pt-[14px] pb-[13px] cursor-pointer border transition-colors " +
                      (on ? "bg-warm-bg border-terracotta" : "bg-card border-border")
                    }
                    style={{ minHeight: 158, borderWidth: on ? 1.5 : 1 }}
                  >
                    <span className="flex items-start justify-between w-full">
                      <span className={"font-serif text-[24px] leading-none " + (on ? "text-terracotta" : "text-ink")}>{t}</span>
                      {on && <Coche />}
                    </span>
                    {/* Le glyphe grandit avec la valise : S à XL se lisent d'un coup d'œil. */}
                    <span className={"flex-1 flex items-center justify-center " + (on ? "text-terracotta" : "text-muted-3")} style={{ minHeight: 56 }}>
                      {glypheValise(26 + i * 7)}
                    </span>
                    <span className="block text-[13px] font-semibold text-ink leading-[1.25]">environ {cap} pièces</span>
                    <span className="block text-[11px] text-muted mt-[2px]">{USAGE_BAGAGE[t]}</span>
                    {conseille === t && !on && <span className="absolute top-[14px] right-[12px] text-[10.5px] font-semibold text-terracotta-deep">Conseillée</span>}
                  </button>
                );
              })}
            </div>
            {jours.length > 0 && dureeOk && (
              <div className="text-[12px] text-muted leading-[1.5] mt-4">
                Valise {conseille} conseillée pour {jours.length} {jours.length > 1 ? "jours" : "jour"}.
              </div>
            )}
            <div className="text-[12px] text-muted-3 leading-[1.5] mt-[6px]">
              Ces quantités sont indicatives : la place tient compte de l&apos;encombrement (chaussures et manteaux en prennent plus qu&apos;un t-shirt). Tu pourras ajuster ta sélection ensuite.
            </div>
          </>
        )}

        {/* ── 3. CE QUE TU AS PRÉVU ── refondue le 30/10/2026 (brief « Refonte UX de l'étape Activités ») : une seule sélection — des
            idées selon la destination, ce que la personne ajoute, son programme (EtapeActivites). FACULTATIVE : sans choix, le programme
            retombe sur le quotidien (programmeDesActivites), comme le moteur le faisait déjà. */}
        {questions && etape === 3 && (
          <>
            <Surtitre>Ta valise · 3 / 3</Surtitre>
            <TitreEtape
              a="Qu'as-tu prévu"
              b={`${roadTrip ? "pendant ton road trip" : (destinationAvecPreposition(ville?.capitaleDe ?? nomVille) ?? "pendant ton séjour")} ?`}
            />
            <div className="text-[13px] text-muted leading-[1.5] mt-2">
              Voici quelques idées pour profiter de ton séjour. Sélectionne celles qui te plaisent, tu peux en ajouter autant que tu veux !
            </div>
            {/* Un road trip : les idées couvrent toutes ses villes (« Lisbonne, Porto, Faro »). */}
            <EtapeActivites requete={roadTrip ? etapes.map((e) => e.destination).join(", ") : destination.trim()} jours={jours} choix={choix} setChoix={setChoix} evenements={evenements} setEvenements={setEvenements} />
          </>
        )}

        {/* ── LA PRÉPARATION N'A PAS ABOUTI ── les réponses sont gardées : on relance sans rien ressaisir. */}
        {vue.nom === "erreur" && (
          <div className="mt-2">
            <Surtitre>Un instant</Surtitre>
            <TitreEtape a="On n'a pas pu" b="préparer ta valise" />
            <div className="text-[13px] text-muted leading-[1.5] mt-2">Tout ce que tu as indiqué est gardé : tu peux réessayer sans rien ressaisir.</div>
          </div>
        )}

        {/* ── 5. GÉNÉRATION ── */}
        {vue.nom === "calcul" && (
          <div className="flex flex-col justify-center" style={{ minHeight: "62vh" }} aria-live="polite">
            <div className="t-titre-ecran text-ink text-center">
              On prépare <span className="italic text-terracotta">ta valise…</span>
            </div>
            <div className="text-[13px] text-muted leading-[1.5] mt-3 text-center max-w-[300px] mx-auto">
              On sélectionne les tenues qui correspondent à ton séjour, à la météo et à ton style.
            </div>
            <ul className="flex flex-col gap-[14px] mt-8 mx-auto" style={{ width: "min(100%, 290px)" }}>
              {ETAPES_CALCUL.map(([glyphe, libelle], i) => {
                const faite = i < faites;
                const enCours = i === faites;
                return (
                  <li
                    key={libelle}
                    className={"flex items-center gap-[12px] text-[13px] transition-opacity duration-300 " + (faite ? "text-ink" : enCours ? "text-muted-3" : "text-placeholder")}
                    style={{ opacity: faite || enCours ? 1 : 0.55 }}
                  >
                    <span className={faite ? "text-terracotta" : ""}>{glyphe}</span>
                    <span className="flex-1">{libelle}</span>
                    {faite && <Coche />}
                  </li>
                );
              })}
            </ul>
            <div className="text-center text-[12px] text-muted mt-6">Garde l&apos;appli ouverte quelques secondes.</div>
            <div className="h-[3px] rounded-full mt-6 mx-auto overflow-hidden" style={{ width: "min(100%, 290px)", background: "var(--color-chip-soft-bg)" }} aria-hidden="true">
              <div className="h-full bg-terracotta-deep transition-[width] duration-300" style={{ width: `${(faites / ETAPES_CALCUL.length) * 100}%` }} />
            </div>
          </div>
        )}

        {/* ── 6 à 10. RÉSULTAT, LOOK, PIÈCE ── */}
        {(vue.nom === "resultat" || vue.nom === "look" || vue.nom === "piece") && valise && (
          <Resultat
            vue={vue}
            setVue={setVue}
            valise={valise}
            dressing={dressing}
            onglet={onglet}
            setOnglet={setOnglet}
            gardeeOu={gardeeOu}
            generer={generer}
            retirer={retirer}
            ajouter={ajouter}
            ajouterTenue={ajouterTenue}
            remplacer={remplacer}
            changerBagage={changerBagage}
            cocherPiece={cocherPiece}
            majAffaires={majAffaires}
            enregistrerLook={actions.enregistrerIdeeLook}
            ajouterAuDressing={actions.openAddEtRevenir}
            ajouterCategorie={actions.openAddForCategory}
            capsule={capsuleDuSejourAffiche}
            recomposer={recomposer}
            modifier={modifier}
            recommencer={recommencer}
            supprimer={supprimer}
          />
        )}
      </div>

      {questions && (
        <div className="flex-shrink-0 px-6 pt-[10px] pb-[18px] flex flex-col gap-1 border-t border-border">
          <Button onClick={() => (etape < DERNIERE_ETAPE ? etapeValide && setEtape(etape + 1) : preparer())} disabled={!etapeValide}>
            {etape < DERNIERE_ETAPE ? "Continuer" : "Préparer ma valise"}
          </Button>
          {etape === DERNIERE_ETAPE && <div className="text-center text-[12px] text-muted">Tu pourras toujours modifier ta valise ensuite.</div>}
        </div>
      )}

      {vue.nom === "erreur" && (
        <div className="flex-shrink-0 px-6 pt-[10px] pb-[18px] flex flex-col gap-1 border-t border-border">
          <Button onClick={() => dernieresReponses && void lancer(dernieresReponses.rep, dernieresReponses.id)} disabled={!dernieresReponses}>
            Réessayer
          </Button>
          <button
            onClick={() => {
              setVue({ nom: "etape" });
              setEtape(1);
            }}
            className="text-[12px] text-terracotta cursor-pointer py-[10px]"
          >
            Modifier mes réponses
          </button>
        </div>
      )}

      {bloquee && (
        <div className="flex-shrink-0 px-6 pt-[10px] pb-[18px] border-t border-border">
          <Button variante="principal" onClick={actions.openAddEtRevenir}>
            Ajouter une pièce
          </Button>
        </div>
      )}

      {/* Le résultat est une page à part entière : la barre du bas y revient
          (comme le hub de Planifier), les étapes la laissent au bouton. */}
      {(vue.nom === "resultat" || vue.nom === "look" || vue.nom === "piece") && <TabBar />}
    </div>
  );
}

// ── Résultat, détail d'un look, détail d'une pièce ──────────────────────

function Resultat({
  vue,
  setVue,
  valise,
  dressing,
  onglet,
  setOnglet,
  gardeeOu,
  generer,
  retirer,
  ajouter,
  ajouterTenue,
  remplacer,
  changerBagage,
  cocherPiece,
  majAffaires,
  enregistrerLook,
  ajouterAuDressing,
  ajouterCategorie,
  capsule,
  recomposer,
  modifier,
  recommencer,
  supprimer,
}: {
  vue: Vue;
  setVue: (v: Vue) => void;
  valise: ValiseGardee;
  dressing: Item[];
  onglet: Onglet;
  setOnglet: (o: Onglet) => void;
  gardeeOu: "compte" | "appareil" | null;
  generer: ReturnType<typeof generateurMoteur>;
  retirer: (ids: number[]) => void;
  ajouter: (id: number) => void;
  ajouterTenue: (t: TenueProposee, situation: number) => void;
  remplacer: (ancien: number, nouveau: number) => void;
  changerBagage: (t: TailleBagage) => void;
  cocherPiece: (id: number) => void;
  majAffaires: (f: (e: EtatAffaires) => EtatAffaires) => void;
  enregistrerLook: (ids: number[], occasion: OccasionKey) => void;
  ajouterAuDressing: () => void;
  ajouterCategorie: (c: CategoryKey) => void;
  capsule: Item[];
  recomposer: () => void;
  modifier: () => void;
  recommencer: () => void;
  supprimer: () => void;
}) {
  const { vestiairePool } = useCapsela();
  /** Le dressing plus les suggestions de capsule que la valise porte : ce que le moteur et l'affichage résolvent. */
  const base = useMemo(() => poolDeLaValise(dressing, valise.suggestionIds, [...capsule, ...vestiairePool]), [dressing, valise.suggestionIds, capsule, vestiairePool]);
  const suggestions = new Set(valise.suggestionIds ?? []);
  const [indexLook, setIndexLook] = useState(0);
  const [feuille, setFeuille] = useState<{ type: "ajuster" } | { type: "ajouter" } | { type: "supprimer" } | { type: "remplacer"; id: number } | { type: "retirer"; id: number } | { type: "alleger" } | { type: "tenue" } | null>(null);
  const [enregistres, setEnregistres] = useState<string[]>([]);
  const toucher = useRef<number | null>(null);

  const capacite = capaciteDe(valise.bagage);
  // Une pièce supprimée du dressing depuis n'est plus dans la valise.
  const pieces = valise.pieceIds.map((id) => base.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const ids = pieces.map((p) => p.id);
  // Un look de valise a toujours chaussures et sac (lookAChaussuresEtSac) : les valises gardées avant cette règle ne montrent plus
  // les looks qui n'en ont pas — « Recomposer » en refait avec.
  const looks = valise.looks.filter((l) => l.ids.every((id) => ids.includes(id)) && lookAChaussuresEtSac(l.ids, pieces));
  const parPiece = looksParPiece(looks);
  const couvertes = occasionsCouvertes(looks, valise.situations);
  const volume = volumeDe(pieces);
  const depasse = etatJauge(volume, capacite) === "depassee";
  const aAlleger = depasse ? allegement(ids, looks, capacite, (id) => unitesDe(pieces.find((p) => p.id === id)?.cat ?? "haut")) : [];
  const tauxRemplissage = Math.round((volume / capacite) * 100);
  const nbJours = valise.meteos.length;
  const pieceDe = (id: number) => pieces.find((p) => p.id === id);
  const occasionsDemandees = [...new Set(valise.situations.map((s) => s.occasion))];
  const occasionsSansLook = occasionsDemandees.filter((o) => !couvertes.includes(o));
  /** Occasions couvertes seulement par des looks « élargis » : le dressing n'a pas de pièce déclarée pour elles. */
  const occasionsElargies = occasionsDemandees.filter((o) => {
    const siens = looks.filter((l) => occasionsDuLook(l, valise.situations).includes(o));
    // Une occasion déjà complétée par une suggestion de capsule de la valise n'est plus à compléter.
    return siens.length > 0 && siens.every((l) => l.elargie) && !siens.some((l) => l.ids.some((id) => suggestions.has(id)));
  });
  const occasionsAManque = [...occasionsSansLook, ...occasionsElargies];
  const index = Math.min(indexLook, Math.max(0, looks.length - 1));
  /** Pièces ajoutées au dressing depuis le calcul de la valise. */
  const nouvelles = valise.dressingIds ? dressing.filter((i) => !valise.dressingIds!.includes(i.id)).length : 0;
  /** Ce qui manque au dressing pour les occasions restées sans look — le moteur le dit, sur la capsule. */
  const cleSansLook = occasionsAManque.join(",");
  const manques = useMemo(
    () =>
      categoriesPourCompleter(
        // Le dressing ET les suggestions déjà dans la valise : une pièce de capsule déjà retenue n'est pas proposée une seconde fois.
        base,
        capsule,
        valise.situations,
        valise.situations.map((_, i) => i).filter((i) => cleSansLook.split(",").includes(valise.situations[i].occasion)),
        generer
      ),
    [base, capsule, valise.situations, cleSansLook, generer]
  );
  const peuDeLooks = looks.length > 0 && looks.length < nbJours;
  const numero = (i: number) => String(i + 1).padStart(2, "0");

  /**
   * LA MÉTÉO AFFICHÉE EST CELLE D'AUJOURD'HUI, pas celle du calcul (04/10/2026, « sois juste sur la météo ») : la
   * prévision de l'application (fetchPrevisionByCity, comme Planifier et la création de la valise) est redemandée à
   * l'ouverture, pour les jours qui ne sont pas passés et dans son horizon. `valise.meteos` reste ce que le moteur a
   * reçu ; il ne sert plus à dire « prévu ».
   */
  const aujourdhui = jourLocal();
  const joursAVenir = valise.meteos.map((m) => m.jour).filter((j) => j >= aujourdhui);
  // Un road trip : la ville du premier jour à venir (etapesSejour.ts) ; jamais l'itinéraire entier, qui n'est pas un lieu.
  const villePrevision = joursAVenir.length > 0 && joursEntre(aujourdhui, joursAVenir[0]) <= HORIZON_PREVISION_JOURS ? destinationDuJour(valise, joursAVenir[0]) : null;
  const [previsionVive, setPrevisionVive] = useState<{ ville: string; p: Prevision | null } | null>(null);
  useEffect(() => {
    if (!villePrevision) return;
    let annule = false;
    previsionGardee(villePrevision)
      .catch(() => null)
      .then((p) => !annule && setPrevisionVive({ ville: villePrevision, p }));
    return () => {
      annule = true;
    };
  }, [villePrevision]);
  /** Les jours du séjour que la prévision du moment couvre — vide tant qu'elle n'est pas arrivée, ou si elle manque. */
  // Seuls les jours passés dans cette ville : la prévision de Lisbonne ne dit rien des jours à Porto.
  const joursDeLaVille = villePrevision ? joursAVenir.filter((j) => destinationDuJour(valise, j) === villePrevision) : [];
  const meteosPrevues = previsionVive && previsionVive.ville === villePrevision ? meteosPrevuesDuSejour(previsionVive.p, joursDeLaVille) : [];
  const amplitude = amplitudePrevue(meteosPrevues);
  const previsionAttendue = villePrevision != null && !(previsionVive && previsionVive.ville === villePrevision);

  // Les looks de chaque pièce de remplacement sont comptés par le moteur à
  // l'ouverture de la feuille — pas avant, c'est le calcul le plus coûteux.
  const idRemplacee = feuille?.type === "remplacer" ? feuille.id : null;
  const alts = useMemo(
    () => (idRemplacee != null ? alternatives(idRemplacee, valise.pieceIds, base, valise.situations, generer, 6, capaciteDe(valise.bagage)) : []),
    [idRemplacee, valise.pieceIds, valise.situations, base, generer, valise.bagage]
  );

  // « Alléger » : les pièces cochées ; « Ajouter une tenue » : la proposition du moteur pour la situation choisie (calculée au
  // choix, pas à l'ouverture — c'est un calcul du moteur) ; « Check-list » : les pièces cochées, gardées sur l'appareil.
  const [retirees, setRetirees] = useState<number[]>([]);
  const [proposition, setProposition] = useState<{ situation: number; tenue: TenueProposee | null } | null>(null);
  /** La check-list : les pièces préparées, gardées AVEC la valise ; seules celles qui sont encore dans la valise comptent. */
  const piecesCochees = (valise.cochees ?? lireChecklistHeritee(valise.id)).filter((id) => valise.pieceIds.includes(id));
  const cocher = cocherPiece;
  const [tailleOuverte, setTailleOuverte] = useState(false);
  /** Les affaires de voyage : celles du séjour (programme, météo) moins les masquées, plus celles que la personne a ajoutées. */
  const contexteAffaires = { programme: valise.programme ?? [], meteos: valise.meteos };
  const affaires = affairesAffichees(contexteAffaires, valise.affaires);
  const affairesCochees = cocheesValides(affaires, valise.affaires);
  const affairesCachees = affairesMasquees(contexteAffaires, valise.affaires);
  /** Les articles de la checklist : pièces et affaires (checklistValise.ts), lus séparément ci-dessous. */
  const articles = articlesChecklist(pieces, piecesCochees, affaires, affairesCochees);
  /**
   * VÊTEMENTS ET INDISPENSABLES À PART (30/10/2026, brief « Refonte de l'écran Ma valise ») : les vêtements se cochent dans l'onglet
   * Vêtements, les affaires de voyage dans l'onglet Indispensables. Les suggestions de la capsule n'en font pas partie : elles ne sont pas
   * encore dans le dressing. Mêmes données qu'avant (cochees, affaires.cochees) : rien de nouveau n'est gardé.
   */
  const progressionVetements = progressionChecklist(articles.filter((a) => a.piece && !suggestions.has(a.piece.id)));
  const articlesAffaires = articles.filter((a) => a.affaire);
  const progressionAffaires = progressionChecklist(articlesAffaires);
  const [filtreChecklist, setFiltreChecklist] = useState<FiltreChecklist>("tout");
  /** Les sections repliées : gardées le temps de l'écran (on passe d'un onglet à l'autre sans les rouvrir). */
  const [repliees, setRepliees] = useState<SectionChecklist[]>([]);
  /**
   * RETIRER UNE PIÈCE DIT CE QUE DEVIENNENT LES LOOKS (19/10/2026, refonte) : la valise recompose déjà ses looks avec les pièces
   * restantes (avecPieces → looksDeLaValise) ; l'écran le dit, avec le nombre avant et après — jamais un look incomplet en silence.
   */
  const [retrait, setRetrait] = useState<{ nb: number; looksAvant: number } | null>(null);
  const [retraitDit, setRetraitDit] = useState<string | null>(null);
  const retirerEtDire = (ids: number[]) => {
    setRetrait({ nb: ids.length, looksAvant: looks.length });
    retirer(ids);
  };
  /** Une pièce que des tenues portent n'est pas retirée en silence (30/10/2026) : la feuille dit lesquelles et propose de la remplacer. */
  const demanderRetrait = (id: number) => ((parPiece.get(id) ?? 0) > 0 ? setFeuille({ type: "retirer", id }) : retirerEtDire([id]));
  const nbLooks = looks.length;
  useEffect(() => {
    if (!retrait) return;
    const { nb, looksAvant } = retrait;
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setRetrait(null);
    setRetraitDit(
      `${nb > 1 ? `${nb} pièces retirées` : "Pièce retirée"} · ${looksAvant === nbLooks ? `${nbLooks} ${nbLooks > 1 ? "looks" : "look"}, inchangés` : `looks recomposés : ${looksAvant} → ${nbLooks}`}.`
    );
    // Seul le changement de la valise déclenche le message (le nombre de looks recalculé après le retrait).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valise.pieceIds.join(",")]);
  const [nouvelleAffaire, setNouvelleAffaire] = useState("");
  const [voirMasquees, setVoirMasquees] = useState(false);
  const basculer = (liste: string[] | undefined, id: string) => ((liste ?? []).includes(id) ? (liste ?? []).filter((x) => x !== id) : [...(liste ?? []), id]);
  const ajouterAffaire = () => {
    const libelle = libelleAjoutValide(nouvelleAffaire, affaires);
    if (!libelle) return;
    majAffaires((e) => ({ ...e, ajoutees: [...(e.ajoutees ?? []), { id: `perso-${Date.now().toString(36)}`, libelle }] }));
    setNouvelleAffaire("");
  };
  const masquerAffaire = (id: string) =>
    majAffaires((e) =>
      id.startsWith("perso-")
        ? { ...e, ajoutees: (e.ajoutees ?? []).filter((a) => a.id !== id), cochees: (e.cochees ?? []).filter((x) => x !== id) }
        : { ...e, masquees: [...(e.masquees ?? []), id], cochees: (e.cochees ?? []).filter((x) => x !== id) }
    );
  /**
   * RETIRER UN ARTICLE DE LA CHECKLIST, AVEC « ANNULER » (20/10/2026) : la croix masque une affaire proposée (réaffichable plus bas) ou
   * supprime une affaire ajoutée à la main — définitif. Le geste reste celui d'avant ; un « Annuler » de quelques secondes rattrape
   * un toucher malheureux, dans les deux cas.
   */
  const [annulation, setAnnulation] = useState<{ libelle: string; avant: EtatAffaires } | null>(null);
  const retirerDeLaChecklist = (a: { id: string; libelle: string }) => {
    setAnnulation({ libelle: a.libelle, avant: valise.affaires ?? {} });
    masquerAffaire(a.id);
  };
  useEffect(() => {
    if (!annulation) return;
    const t = setTimeout(() => setAnnulation(null), 6000);
    return () => clearTimeout(t);
  }, [annulation]);
  const noteLiquides = noteCabine(valise.bagage);
  const [retourTaille, setRetourTaille] = useState<string | null>(null);
  const proposer = (situation: number) => setProposition({ situation, tenue: nouvelleTenue(valise.situations[situation], valise.pieceIds, base, valise.looks, generer) });
  /** Une situation, dite comme le programme : ses occasions (« Plage · Piscine »), à défaut l'occasion de Capsela. */
  const libelleSituation = (i: number) => {
    const s = valise.situations[i];
    const noms = (s.sousIds ?? []).flatMap((id) => elementProgramme(id)?.libelle ?? []);
    return noms.length ? noms.join(" · ") : occasionShortLabel(s.occasion);
  };

  const piecesDuLook = (l: LookValise) => l.ids.map(pieceDe).filter((i): i is Item => !!i);
  const ouvrirPiece = (id: number) => setVue({ nom: "piece", id, depuis: vue });

  const feuilles = (
    <>
      {/* AJUSTER MA VALISE (refonte du 19/10/2026) : les mêmes actions qu'avant, regroupées par intention — mes tenues, ma sélection, mon
          départ — et la suppression à part, en bas, toujours derrière sa confirmation. Aucune action nouvelle, aucun sous-menu. */}
      <BottomSheet title="Ajuster ma valise" open={feuille?.type === "ajuster"} onClose={() => setFeuille(null)}>
        {(
          [
            ["Mes tenues", [[G_CINTRE, "Ajouter une tenue", "Compléter le programme du séjour.", () => setFeuille({ type: "tenue" })]]],
            [
              "Ma sélection",
              [
                [G_ETINCELLE, "Optimiser ma valise", "Voir les pièces qu'on peut retirer, avant de le faire.", () => setFeuille({ type: "alleger" })],
                [G_PLUS, "Ajouter une pièce", "Depuis ton dressing ; les looks sont recomposés avec elle.", () => setFeuille({ type: "ajouter" })],
                [G_ECHANGE, "Gérer les pièces", "Retirer ou remplacer une pièce de la sélection.", () => (setOnglet("pieces"), setVue({ nom: "resultat" }))],
              ],
            ],
            [
              "Mon départ",
              [
                [G_COCHE(18), "Préparer ma valise", "Cocher les articles au fur et à mesure.", () => (setOnglet("checklist"), setVue({ nom: "resultat" }))],
                [G_CALENDRIER, "Modifier mon séjour", "Destination, dates, valise ou programme.", modifier],
              ],
            ],
          ] as const
        ).map(([groupe, actions], gi) => (
          <section key={groupe} className={gi ? "mt-4" : ""}>
            <h3 className="t-surtitre text-terracotta">{groupe}</h3>
            <div className="flex flex-col gap-2 mt-2">
              {actions.map(([glyphe, titre, sous, f]) => (
                <button
                  key={titre}
                  onClick={() => {
                    setFeuille(null);
                    f();
                  }}
                  className="flex items-center gap-3 text-left bg-card border border-border rounded-tuile px-[14px] py-[9px] cursor-pointer"
                  style={{ minHeight: 56 }}
                >
                  <span className="w-[22px] flex justify-center flex-shrink-0 text-terracotta">{glyphe}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-ink leading-[1.3]">{titre}</span>
                    <span className="block text-[12px] text-muted-3 leading-[1.35] mt-[1px]">{sous}</span>
                  </span>
                  <span aria-hidden="true" className="text-placeholder flex-shrink-0">{chevron("d")}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {/* Supprimer : séparée des actions courantes ; une confirmation explicite suit (feuille « Supprimer cette valise ? »). */}
        <div className="border-t border-divider mt-5 pt-2">
          <button
            onClick={() => setFeuille({ type: "supprimer" })}
            className="w-full inline-flex items-center justify-center gap-[8px] text-[13px] text-rust cursor-pointer"
            style={{ minHeight: 48 }}
          >
            {G_POUBELLE} Supprimer cette valise
          </button>
        </div>
      </BottomSheet>

      <BottomSheet title="Supprimer cette valise ?" open={feuille?.type === "supprimer"} onClose={() => setFeuille(null)}>
        <div className="text-[13px] text-muted-3 leading-[1.5]">
          <span className="block text-ink">
            {valise.destination} · {libellePeriode(valise.depart, valise.retour)}
          </span>
          Elle disparaît de « Mes planifications ». Tes pièces restent dans ton dressing.
        </div>
        <div className="flex gap-2 mt-5">
          <Button variante="secondaire" pleine={false} className="flex-1 bg-card" onClick={() => setFeuille(null)}>
            Garder
          </Button>
          <Button variante="principal" pleine={false} className="flex-1"
            onClick={() => {
              setFeuille(null);
              supprimer();
            }}
          >
            Supprimer
          </Button>
        </div>
      </BottomSheet>

      <BottomSheet title="Ajouter une pièce" open={feuille?.type === "ajouter"} onClose={() => setFeuille(null)}>
        {GROUPES_VALISE.map(([titre, cats]) => {
          const dispo = dressing.filter((p) => cats.includes(p.cat) && !ids.includes(p.id));
          if (!dispo.length) return null;
          return (
            <section key={titre} className="mb-4">
              <h3 className="t-surtitre text-muted">{titre}</h3>
              <div className="flex flex-col gap-2 mt-2">
                {dispo.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      ajouter(p.id);
                      setFeuille(null);
                    }}
                    aria-label={`Ajouter ${p.name} à la valise`}
                    className="flex items-center gap-3 text-left bg-card border border-border rounded-tuile p-[7px] cursor-pointer"
                  >
                    <Vignette it={p} taille={40} />
                    <span className="flex-1 min-w-0 text-[13px] text-ink truncate">{p.name}</span>
                    <span className="text-terracotta px-2">{G_PLUS}</span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {dressing.every((p) => ids.includes(p.id)) && <div className="text-[13px] text-muted">Toutes les pièces de ton dressing sont déjà dans la valise.</div>}
      </BottomSheet>

      <BottomSheet title="Taille de la valise" open={tailleOuverte} onClose={() => setTailleOuverte(false)}>
        <div className="text-[12px] text-muted leading-[1.45] mb-3">
          Ta sélection est conservée : aucune pièce n&apos;est retirée sans toi. Si la nouvelle valise est plus petite, Capsela te propose d&apos;alléger.
        </div>
        <div role="radiogroup" aria-label="Taille de la valise" className="flex flex-col gap-2">
          {BAGAGES.map(([t, , cap]) => {
            const on = valise.bagage === t;
            return (
              <button
                key={t}
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setTailleOuverte(false);
                  if (on) return;
                  changerBagage(t);
                  const place = volume - capaciteDe(t);
                  setRetourTaille(
                    place > 0
                      ? `Valise ${t} : ta sélection ne tient plus (environ ${Math.max(1, Math.ceil(place / UNITES_MOYENNES_PAR_PIECE))} ${place / UNITES_MOYENNES_PAR_PIECE > 1 ? "pièces" : "pièce"} de trop). Elle est conservée telle quelle.`
                      : capaciteDe(t) > capacite
                        ? `Valise ${t} : ta sélection est conservée. Il reste de la place : « Recomposer ma valise » en profiterait.`
                        : `Valise ${t} : ta sélection est conservée et tient dedans.`
                  );
                }}
                className={"flex items-center gap-3 text-left rounded-tuile border px-[14px] cursor-pointer " + (on ? "bg-warm-bg border-terracotta" : "bg-card border-border")}
                style={{ minHeight: 56 }}
              >
                <span className={"font-serif text-[22px] w-[34px] " + (on ? "text-terracotta" : "text-ink")}>{t}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-ink">environ {cap} pièces</span>
                  <span className="block text-[11px] text-muted">{USAGE_BAGAGE[t]}</span>
                </span>
                {on && <Coche />}
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* RETIRER UNE PIÈCE QUE DES TENUES PORTENT (30/10/2026) : les tenues touchées sont nommées, d'après le planning ; on peut la remplacer
          plutôt que la retirer. Rien n'est supprimé avant le choix. */}
      <BottomSheet title={feuille?.type === "retirer" ? `Retirer ${pieceDe(feuille.id)?.name ?? "la pièce"} ?` : "Retirer"} open={feuille?.type === "retirer"} onClose={() => setFeuille(null)}>
        {feuille?.type === "retirer" &&
          (() => {
            const id = feuille.id;
            const n = parPiece.get(id) ?? 0;
            const touches = creneauxDeLaPiece(planningDeLaValise(valise, joursDuSejour(valise.depart, valise.retour), looks), looks, id);
            return (
              <>
                <div className="text-[13px] text-ink leading-[1.5]">
                  Elle sert dans {n} {n > 1 ? "tenues" : "tenue"} de ta valise.{touches.length ? " Au programme :" : ""}
                </div>
                {touches.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-[4px]">
                    {touches.slice(0, 6).map((c) => (
                      <li key={c.jour + c.creneau + c.sousId} className="text-[12px] text-ink-soft">
                        {dateCourte(c.jour)} · {libelleCreneau(c)}
                      </li>
                    ))}
                    {touches.length > 6 && <li className="text-[12px] text-muted">et {touches.length - 6} de plus</li>}
                  </ul>
                )}
                <div className="text-[12px] text-muted leading-[1.5] mt-3">Sans elle, Capsela recompose ces tenues avec le reste de ta valise. Tu peux aussi la remplacer par une autre pièce de ton dressing.</div>
                <Button variante="principal" className="mt-4" onClick={() => setFeuille({ type: "remplacer", id })}>
                  La remplacer
                </Button>
                <Button
                  variante="secondaire"
                  className="mt-2 bg-card"
                  onClick={() => {
                    setFeuille(null);
                    retirerEtDire([id]);
                  }}
                >
                  La retirer quand même
                </Button>
                <button onClick={() => setFeuille(null)} className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer">
                  Annuler
                </button>
              </>
            );
          })()}
      </BottomSheet>

      <BottomSheet title={idRemplacee != null ? `Remplacer ${pieceDe(idRemplacee)?.name ?? "la pièce"}` : "Remplacer"} open={idRemplacee != null} onClose={() => setFeuille(null)}>
        {alts.length === 0 ? (
          <EmptyState>Aucune autre pièce de cette famille dans ton dressing.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-muted leading-[1.45] mb-1">Avec chacune, la valise compterait ce nombre de looks (aujourd&apos;hui : {looks.length}).</div>
            {alts.map(({ item, looks: n, tient }) => (
              <button
                key={item.id}
                disabled={!tient}
                onClick={() => {
                  if (idRemplacee != null) remplacer(idRemplacee, item.id);
                  setFeuille(null);
                  if (vue.nom === "piece") setVue(vue.depuis);
                }}
                className="flex items-center gap-3 text-left bg-card border border-border rounded-tuile p-[7px] cursor-pointer disabled:cursor-default disabled:opacity-60"
              >
                <Vignette it={item} taille={40} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-ink truncate">{item.name}</span>
                  <span className={"block text-[11px] " + (n ? "text-terracotta" : "text-muted")}>
                    {n} {n > 1 ? "looks" : "look"}
                  </span>
                  {!tient && <span className="block text-[11px] text-muted">Prendrait trop de place dans une valise {valise.bagage}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* ALLÉGER MA VALISE : on voit l'avant et l'après AVANT de retirer. Les pièces proposées sont celles qui n'atteignent pas
          le seuil de polyvalence (SEUIL_POLYVALENTE) ; l'aperçu compte les looks conservés (un plancher : à l'enregistrement
          le moteur recompose avec les pièces restantes). */}
      <BottomSheet title="Optimiser ma valise" open={feuille?.type === "alleger"} onClose={() => (setFeuille(null), setRetirees([]))}>
        {(() => {
          const candidates = piecesAllegeables(pieces, looks);
          if (!candidates.length) return <EmptyState>Chaque pièce de ta valise revient dans au moins {SEUIL_POLYVALENTE} looks : rien à retirer sans perdre de variété.</EmptyState>;
          const a = apercuAllegement(ids, looks, valise.situations, retirees);
          return (
            <>
              <div className="text-[12px] text-muted leading-[1.45] mb-3">Choisis les pièces à retirer : tu vois ce que ta valise garde avant de valider.</div>
              <div className="flex flex-col gap-2">
                {candidates.map((c) => {
                  const p = pieceDe(c.id);
                  if (!p) return null;
                  const coche = retirees.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => setRetirees(coche ? retirees.filter((x) => x !== c.id) : [...retirees, c.id])}
                      aria-pressed={coche}
                      className={"flex items-center gap-3 text-left bg-card border rounded-tuile p-[7px] cursor-pointer " + (coche ? "border-terracotta-deep" : "border-border")}
                    >
                      <Vignette it={p} taille={40} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-ink truncate">{p.name}</span>
                        <span className="block text-[11px] text-muted">
                          {LIBELLE_RAISON[c.raison]}
                          {c.looks > 0 ? ` · ${c.looks} ${c.looks > 1 ? "looks" : "look"}` : ""}
                        </span>
                      </span>
                      <span aria-hidden="true" className={"w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 mr-2 " + (coche ? "bg-terracotta-deep text-cream" : "border border-border text-transparent")}>
                        {G_COCHE(12, "currentColor")}
                      </span>
                    </button>
                  );
                })}
              </div>
              <Card rayon="tuile" className="mt-4 p-[14px]">
                <div className="t-label text-muted">Avant → après</div>
                {(
                  [
                    ["Pièces", a.piecesAvant, a.piecesApres],
                    ["Looks conservés", a.looksAvant, a.looksApres],
                  ] as const
                ).map(([libelle, avant, apres]) => (
                  <div key={libelle} className="flex items-baseline justify-between mt-2">
                    <span className="text-[13px] text-ink">{libelle}</span>
                    <span className="text-[13px] text-ink">
                      {avant} → <span className="font-serif text-[18px]">{apres}</span>
                    </span>
                  </div>
                ))}
                {a.occasionsPerdues.length > 0 && (
                  <div className="text-[12px] text-terracotta leading-[1.45] mt-3">
                    Plus aucun look pour : {a.occasionsPerdues.map((o) => occasionShortLabel(o)).join(", ")}.
                  </div>
                )}
                <div className="text-[11px] text-muted leading-[1.45] mt-3">Une fois retirées, Capsela recompose les looks avec les pièces restantes : tu peux en retrouver davantage.</div>
              </Card>
              <Button
                variante="principal"
                className="mt-4"
                disabled={!retirees.length}
                onClick={() => {
                  retirerEtDire(retirees);
                  setRetirees([]);
                  setFeuille(null);
                }}
              >
                {retirees.length ? `Retirer ${retirees.length} ${retirees.length > 1 ? "pièces" : "pièce"}` : "Choisis une pièce"}
              </Button>
            </>
          );
        })()}
      </BottomSheet>

      {/* AJOUTER UNE TENUE : pour une occasion du séjour, une tenue de plus — d'abord avec la valise, sinon avec le reste du
          dressing, et la sheet dit alors quelles pièces s'ajoutent. Le moteur compose ; rien n'est inventé. */}
      <BottomSheet title="Ajouter une tenue" open={feuille?.type === "tenue"} onClose={() => (setFeuille(null), setProposition(null))}>
        {valise.situations.length === 0 ? (
          <EmptyState>Aucune occasion à couvrir pour cette valise.</EmptyState>
        ) : (
          <>
            <div className="text-[12px] text-muted leading-[1.45] mb-3">Pour quelle occasion ?</div>
            <div className="flex flex-wrap gap-2">
              {valise.situations.map((_, i) => {
                const nb = looks.filter((l) => l.situations.includes(i)).length;
                const actif = proposition?.situation === i;
                return (
                  <button
                    key={i}
                    onClick={() => proposer(i)}
                    aria-pressed={actif}
                    className={"rounded-full border px-[14px] text-[12px] cursor-pointer " + (actif ? "bg-terracotta-deep text-cream border-terracotta-deep" : "bg-card text-ink border-border")}
                    style={{ minHeight: 44 }}
                  >
                    {libelleSituation(i)} · {nb} {nb > 1 ? "looks" : "look"}
                  </button>
                );
              })}
            </div>
            {proposition &&
              (proposition.tenue ? (
                (() => {
                  const t = proposition.tenue;
                  const piecesT = t.ids.map((id) => base.find((x) => x.id === id)).filter((x): x is Item => !!x);
                  const idsTotal = new Set([...valise.pieceIds, ...t.ids]);
                  const total = volumeDe(base.filter((x) => idsTotal.has(x.id)));
                  return (
                    <Card rayon="tuile" className="mt-4 p-[14px]">
                      <div className="flex gap-[3px]">
                        {piecesT.slice(0, 5).map((x) => (
                          <Vignette key={x.id} it={x} taille={44} />
                        ))}
                      </div>
                      <div className="text-[13px] text-ink leading-[1.35] mt-3">{resumeLook(piecesT)}</div>
                      <div className="text-[12px] text-muted-3 leading-[1.45] mt-[6px]">
                        {t.ajouts.length
                          ? `Elle demande ${t.ajouts.length} ${t.ajouts.length > 1 ? "pièces" : "pièce"} de ton dressing : ${t.ajouts.map((id) => base.find((x) => x.id === id)?.name ?? "").join(", ")}.`
                          : "Elle se fait avec les pièces de ta valise."}
                      </div>
                      {total > capacite && (
                        <div className="text-[12px] text-terracotta leading-[1.45] mt-[6px]">
                          Ta valise dépasserait la place d&apos;une valise {valise.bagage}.
                        </div>
                      )}
                      <div className="flex gap-2 mt-4">
                        <Button variante="secondaire" pleine={false} className="flex-1 bg-card" onClick={() => proposer(proposition.situation)}>
                          Autre tenue
                        </Button>
                        <Button
                          variante="principal"
                          pleine={false}
                          className="flex-1"
                          onClick={() => {
                            ajouterTenue(t, proposition.situation);
                            setProposition(null);
                            setFeuille(null);
                          }}
                        >
                          Ajouter
                        </Button>
                      </div>
                    </Card>
                  );
                })()
              ) : (
                <div className="mt-4">
                  <EmptyState>Aucune autre tenue possible pour cette occasion avec ton dressing.</EmptyState>
                </div>
              ))}
          </>
        )}
      </BottomSheet>

    </>
  );

  // ── DÉTAIL D'UNE PIÈCE ──
  if (vue.nom === "piece") {
    const p = pieceDe(vue.id);
    if (!p) return feuilles;
    const img = resolveItemImage(p);
    const sesLooks = looks.map((l, i) => ({ l, i })).filter(({ l }) => l.ids.includes(p.id));
    const occ = occasionsDeLaPiece(p.id, looks, valise.situations);
    return (
      <>
        <Surtitre>Détail d&apos;une pièce</Surtitre>
        <div className="flex gap-[14px] mt-3">
          <div
            className="flex-shrink-0 rounded-carte overflow-hidden"
            style={{ width: "42%", aspectRatio: "4 / 5", ...(img.url ? { background: "var(--color-photo-bg)", padding: img.kind === "photo" ? 0 : 8 } : { background: p.hex }) }}
          >
            {img.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img.url} alt={p.name} className={"w-full h-full " + (img.kind === "photo" ? "object-cover" : "object-contain")} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif text-[20px] text-ink leading-[1.2]" style={{ textWrap: "balance" }}>
              {p.name}
            </div>
            <div className="text-[12px] text-terracotta mt-[6px]">
              {sesLooks.length ? `Dans ${sesLooks.length} ${sesLooks.length > 1 ? "looks" : "look"}` : "Dans aucun look de la valise"}
            </div>
            {sesLooks.length > 0 && (
              <div className="grid grid-cols-3 gap-[6px] mt-3">
                {sesLooks.slice(0, 3).map(({ l, i }) => (
                  <button
                    key={l.ids.join(",")}
                    onClick={() => setVue({ nom: "look", index: i })}
                    aria-label={`Voir le look ${numero(i)}`}
                    className="rounded-champ bg-warm-bg p-[3px] cursor-pointer grid grid-cols-2 gap-[2px] overflow-hidden"
                    style={{ height: 78 }}
                  >
                    {/* À cette taille, une composition ne se lit plus : un aperçu
                        de ses pièces, comme les rappels de tenues planifiées. */}
                    {piecesDuLook(l)
                      .slice(0, 4)
                      .map((it) => {
                        const im = resolveItemImage(it);
                        return im.url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={it.id} src={im.url} alt="" loading="lazy" className="w-full h-full object-contain min-h-0" />
                        ) : (
                          <span key={it.id} className="block w-full h-full rounded-[3px]" style={{ background: it.hex }} />
                        );
                      })}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {occ.length > 0 && (
          <>
            <div className="text-[13px] text-ink mt-6">Occasions couvertes</div>
            <div className="flex flex-wrap gap-[6px] mt-2">
              {occ.map((o) => (
                <PuceOccasion key={o} occasion={o} />
              ))}
            </div>
          </>
        )}

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setFeuille({ type: "remplacer", id: p.id })}
            className="flex-1 rounded-full border border-border bg-card text-ink text-[12px] cursor-pointer inline-flex items-center justify-center gap-[6px]"
            style={{ minHeight: 44 }}
          >
            {G_ECHANGE} Remplacer
          </button>
          <button
            onClick={() => {
              retirerEtDire([p.id]);
              setVue(vue.depuis.nom === "look" ? { nom: "resultat" } : vue.depuis);
            }}
            className="flex-1 rounded-full border border-border bg-card text-ink text-[12px] cursor-pointer inline-flex items-center justify-center gap-[6px]"
            style={{ minHeight: 44 }}
          >
            {G_CROIX} Retirer de la valise
          </button>
        </div>
        {feuilles}
      </>
    );
  }

  // ── DÉTAIL D'UN LOOK ──
  if (vue.nom === "look") {
    const l = looks[vue.index];
    if (!l) return feuilles;
    const items = piecesDuLook(l);
    const occ = occasionsDuLook(l, valise.situations);
    const cle = l.ids.join(",");
    const enregistre = enregistres.includes(cle);
    return (
      <>
        <Surtitre>
          Look {numero(vue.index)} · {looks.length} dans ta valise
        </Surtitre>
        <div className="font-serif text-[22px] text-ink leading-[1.25] mt-[6px]" style={{ textWrap: "balance" }}>
          {resumeLook(items)}
        </div>
        {occ.length > 0 && (
          <div className="flex flex-wrap gap-[6px] mt-3">
            {occ.map((o) => (
              <PuceOccasion key={o} occasion={o} />
            ))}
          </div>
        )}
        {l.elargie && <div className="text-[11px] text-muted mt-2">Occasion élargie : ton dressing n&apos;a pas de pièce déclarée pour cette occasion.</div>}
        <div className="rounded-feuille px-[16px] py-[20px] mt-4" style={{ background: "var(--color-hero-background)" }}>
          <OutfitComposition items={items} variant="editoriale" label={"Composition du look : " + items.map((p) => p.name).join(", ")} />
        </div>
        <div className="flex items-center justify-between mt-3">
          <button
            onClick={() => setVue({ nom: "look", index: vue.index - 1 })}
            disabled={vue.index === 0}
            aria-label="Look précédent"
            className="w-[44px] h-[44px] flex items-center justify-center text-terracotta cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            {chevron("g")}
          </button>
          <span className="text-[12px] text-muted">
            {vue.index + 1} / {looks.length}
          </span>
          <button
            onClick={() => setVue({ nom: "look", index: vue.index + 1 })}
            disabled={vue.index >= looks.length - 1}
            aria-label="Look suivant"
            className="w-[44px] h-[44px] flex items-center justify-center text-terracotta cursor-pointer disabled:opacity-30 disabled:cursor-default"
          >
            {chevron("d")}
          </button>
        </div>

        <div className="text-[13px] text-ink mt-4">Les pièces du look</div>
        <div className="flex flex-col gap-2 mt-2">
          {items.map((p) => {
            const n = parPiece.get(p.id) ?? 0;
            return (
              <button key={p.id} onClick={() => ouvrirPiece(p.id)} className="flex items-center gap-3 text-left bg-card border border-border rounded-tuile p-[7px] cursor-pointer">
                <Vignette it={p} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-ink truncate">{p.name}</span>
                  <span className="block text-[11px] text-terracotta mt-[2px]">
                    {suggestions.has(p.id) ? "À ajouter à ton dressing · " : ""}Dans {n} {n > 1 ? "tenues" : "tenue"}
                  </span>
                </span>
                <span className="text-placeholder pr-1">{chevron("d")}</span>
              </button>
            );
          })}
        </div>
        {/* L'action réelle derrière le cœur de la maquette : enregistrer le look dans « Mes looks ». */}
        <Button
          variante={enregistre ? "secondaire" : "contour"}
          className="mt-5"
          onClick={() => {
            if (enregistre) return;
            enregistrerLook(l.ids, occ[0] ?? "quotidien");
            setEnregistres((e) => [...e, cle]);
          }}
          disabled={enregistre}
        >
          {enregistre ? "Enregistré dans mes looks" : "Enregistrer dans mes looks"}
        </Button>
        {feuilles}
      </>
    );
  }

  // ── RÉSULTAT « TA VALISE » ──

  // Dressing vide : rien à emporter — on le dit, avec l'action qui débloque.
  if (!dressing.length) {
    return (
      <>
        <Surtitre>
          {valise.destination} · {libellePeriode(valise.depart, valise.retour)}
        </Surtitre>
        <TitreEtape a="Ta" b="valise" />
        <EmptyState forme="carte" className="mt-4" titre="Ton dressing est vide" action={{ libelle: "Ajouter une pièce →", onClick: ajouterAuDressing }}>
          La valise se prépare avec les pièces que tu possèdes. Ajoute-les à ton dressing, et Capsela choisira celles à emporter.
        </EmptyState>
        <Pied gardeeOu={gardeeOu} ajuster={modifier} recommencer={recommencer} />
      </>
    );
  }

  const l = looks[index];
  const pluie = pluieAnnoncee(meteosPrevues);
  /** La température d'un look : seulement celle des jours PRÉVUS qu'il habille — jamais une météo de repli présentée comme une prévision. */
  const tempDuLook = (lk: LookValise) => {
    const jours = new Set(lk.situations.flatMap((i) => valise.situations[i]?.jours ?? []));
    return amplitudePrevue(meteosPrevues.filter((m) => jours.has(m.jour)));
  };
  /**
   * « PRÊTE » n'est dit que si elle l'est (04/10/2026, signalé : « prête » pour 1 pièce et 0 look, puis « on est partie
   * sur un nombre de pièces par type de valise ») : au moins un look pour chaque occasion demandée, ET la cible de pièces
   * du type de valise atteinte (cibleDePieces, 70 % de la capacité), sans dépasser la capacité. Sinon elle est à
   * compléter, et l'écran dit par quoi.
   */
  const cible = cibleDeVolume(valise.bagage);
  const manqueVolume = Math.max(0, cible - volume);
  /** Environ combien de pièces ordinaires combleraient ce volume — dit « environ », jamais comme un compte exact. */
  const manquePieces = manqueVolume > 0 ? Math.max(1, Math.ceil(manqueVolume / UNITES_MOYENNES_PAR_PIECE)) : 0;
  const prete = looks.length > 0 && occasionsAManque.length === 0 && manquePieces === 0 && !depasse;
  /** Le séjour est couvert : une valise prête, et de quoi varier sur la durée. C'est ce que dit le bloc de validation, rien de plus. */
  const sejourCouvert = prete && !peuDeLooks;
  const piecesRepetees = looks.length > 1 && pieces.some((p) => (parPiece.get(p.id) ?? 0) > 1);
  /** Les pièces de l'aperçu : une sélection représentative (valiseApercu.ts), le reste compté. */
  /** Les vêtements UNIQUES à emporter (par identifiant) et les suggestions à ajouter, à part (valiseVetements.ts). Les tenues ne bougent pas. */
  const { aEmporter, aAjouter } = vetementsDeLaValise(valise.pieceIds, looks, valise.suggestionIds, pieceDe);
  const familles = vetementsParFamille(aEmporter);
  const apercu = selectionApercu(aEmporter.map((v) => v.item));
  const aOptimiser = nouvelles === 0 && (occasionsAManque.length > 0 || peuDeLooks);
  /**
   * LES LOOKS JOUR PAR JOUR (phase B, 04/10/2026) : le programme réparti sur les jours, un look de la valise par créneau
   * (planningDuProgramme, pur et déterministe — recalculé ici, jamais stocké). Il n'existe que pour une valise préparée avec
   * un programme ET dont les situations portent leurs occasions ; sinon, les looks s'affichent en carrousel, comme avant.
   */
  const joursDuSejourValise = joursDuSejour(valise.depart, valise.retour);
  const planning: CreneauPlanning[] = planningDeLaValise(valise, joursDuSejourValise, looks);
  const aPlanning = planning.length > 0;
  const planningParJour = joursDuSejourValise
    .map((jour, i) => ({ jour, numero: i + 1, creneaux: planning.filter((c) => c.jour === jour) }))
    .filter((j) => j.creneaux.length > 0);
  const plusUtilisee = pieceLaPlusUtilisee(parPiece);
  /**
   * LES CARTES DE TENUES DE L'APERÇU (30/10/2026) : le jour et l'occasion de chaque créneau qui a sa tenue, d'après le planning ; sans
   * planning (valise d'avant le jour par jour), une carte par tenue avec sa première occasion. Le visuel, ce sont les vraies pièces.
   */
  const cartesTenues: { cle: string; look: number; quand: string; quoi: string }[] = aPlanning
    ? planning.flatMap((c) =>
        c.look == null
          ? []
          : [{ cle: c.jour + c.creneau + c.sousId, look: c.look, quand: dateCourte(c.jour), quoi: c.evenement ? libelleCreneau(c) : c.creneau === "soir" ? `${c.libelle} · soir` : c.libelle }]
      )
    : looks.map((lk, i) => ({ cle: `look-${i}`, look: i, quand: `Tenue ${i + 1}`, quoi: occasionsDuLook(lk, valise.situations).map((o) => occasionShortLabel(o))[0] ?? "" }));
  /**
   * « À COMPLÉTER » (30/10/2026) : ce qui n'est pas dans le dressing. D'abord les suggestions de la capsule que des tenues portent déjà,
   * avec la tenue qui les demande ; puis ce que le moteur a repéré pour une occasion sans tenue ou élargie (l'ancien « Optimise ta
   * valise »). Jamais affiché vide, jamais ajouté sans toi : chaque pièce s'ajoute au dressing d'un geste.
   */
  const blocACompleter =
    aAjouter.length > 0 || aOptimiser ? (
      <section className="mt-7" aria-labelledby="titre-a-completer">
        <h2 id="titre-a-completer" className="t-titre-section text-ink">
          À compléter
        </h2>
        <div className="t-chapeau text-muted-3 mt-[4px]">Quelques pièces pourraient encore améliorer tes tenues.</div>
        {aAjouter.length > 0 && (
          <div className="flex flex-col gap-2 mt-3">
            {aAjouter.map(({ item: p, tenues }) => {
              const pour = creneauxDeLaPiece(planning, looks, p.id)[0];
              const raison = pour
                ? `Pour ta tenue ${libelleCreneau(pour)} du ${dateCourte(pour.jour).toLowerCase()}`
                : `Pour ${tenues.length > 1 ? `${tenues.length} de tes tenues` : "une de tes tenues"}`;
              return (
                <Card key={p.id} rayon="tuile" className="relative">
                  <button
                    onClick={() => ajouterCategorie(p.cat)}
                    aria-label={`Ajouter ${p.name} à ton dressing`}
                    className="w-full flex items-center gap-[10px] text-left pl-[10px] pr-[44px] py-[10px] min-h-[62px] cursor-pointer"
                  >
                    <Vignette it={p} taille={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] text-ink leading-[1.2] break-words">{p.name}</span>
                      <span className="block text-[11px] text-muted leading-[1.3] mt-[2px]">{raison.endsWith(".") ? raison : `${raison}.`}</span>
                      <span className="block text-[11px] text-terracotta-deep mt-[1px]">À ajouter</span>
                    </span>
                    <span aria-hidden="true" className="absolute right-[10px] top-1/2 -translate-y-1/2 w-[26px] h-[26px] rounded-full bg-terracotta-deep text-cream flex items-center justify-center">
                      {G_PLUS}
                    </span>
                  </button>
                </Card>
              );
            })}
          </div>
        )}
        {aOptimiser && (
          <div className="flex flex-col gap-4 mt-4">
                {occasionsAManque.map((o) => {
                  const m = manques.find((x) => x.occasion === o);
                  const elargie = occasionsElargies.includes(o);
                  return (
                    <div key={o}>
                      <div className="t-label text-terracotta">Nécessaire</div>
                      <div className="text-[12px] text-ink leading-[1.45] mt-[3px]">
                        {elargie
                          ? `Tes looks ${occasionShortLabel(o)} empruntent des pièces pensées pour d'autres occasions${m?.categories.length ? " : ces pièces les compléteraient." : "."}`
                          : m?.capacite
                            ? `Pas encore de look ${occasionShortLabel(o)} : ta valise manque de place pour lui.`
                            : m?.categories.length
                              ? `Il manque une pièce pour couvrir ${occasionShortLabel(o)}.`
                              : `Pas encore de look ${occasionShortLabel(o)}.`}
                      </div>
                      {m && m.pieces.length > 0 && (
                        <div className="grid grid-cols-1 gap-[8px] mt-[10px]">
                          {m.pieces.map((p) => (
                            <Card key={p.id} rayon="tuile" className="relative">
                              <button
                                onClick={() => ajouterCategorie(p.cat)}
                                aria-label={`Ajouter ${p.name} à ton dressing`}
                                className="w-full flex items-center gap-[10px] text-left pl-[10px] pr-[44px] py-[10px] min-h-[62px] cursor-pointer"
                              >
                                <Vignette it={p} taille={44} />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] text-ink leading-[1.2] break-words">{p.name}</span>
                                  <span className="block text-[11px] text-muted leading-[1.3] mt-[2px]">
                                    À ajouter · compose un look {occasionShortLabel(o)} avec ton dressing
                                  </span>
                                </span>
                                <span aria-hidden="true" className="absolute right-[10px] top-1/2 -translate-y-1/2 w-[26px] h-[26px] rounded-full bg-terracotta-deep text-cream flex items-center justify-center">
                                  {G_PLUS}
                                </span>
                              </button>
                            </Card>
                          ))}
                        </div>
                      )}
                      {m && m.pieces.length === 0 && m.categories.length > 0 && (
                        <div className="grid grid-cols-1 gap-[8px] mt-[10px]">
                          {m.categories.map((c) => (
                            <Card key={c} rayon="tuile" className="relative">
                              <button
                                onClick={() => ajouterCategorie(c)}
                                aria-label={`Ajouter ${nomCategorie(c)} à ton dressing`}
                                className="w-full flex items-center gap-[10px] text-left pl-[10px] pr-[44px] py-[10px] min-h-[62px] cursor-pointer"
                              >
                                <span aria-hidden="true" className="w-[40px] h-[40px] rounded-champ bg-warm-bg text-terracotta flex items-center justify-center flex-shrink-0">
                                  {G_CINTRE}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[13px] text-ink leading-[1.2] break-words first-letter:uppercase">{nomCategorie(c)}</span>
                                  <span className="block text-[11px] text-muted leading-[1.3] mt-[2px]">pour {occasionShortLabel(o)}</span>
                                </span>
                                <span aria-hidden="true" className="absolute right-[10px] top-1/2 -translate-y-1/2 w-[26px] h-[26px] rounded-full bg-terracotta-deep text-cream flex items-center justify-center">
                                  {G_PLUS}
                                </span>
                              </button>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {peuDeLooks && (
                  <div>
                    <div className="t-label text-muted">Optionnel</div>
                    <div className="text-[12px] text-ink leading-[1.45] mt-[3px]">
                      Quelques pièces de plus ajouteraient de la variété à tes looks : {looks.length} {looks.length > 1 ? "looks" : "look"} pour {nbJours} jours.
                    </div>
                  </div>
                )}
              </div>
        )}
      </section>
    ) : null;
  const pieceReutilisee = plusUtilisee ? pieces.find((p) => p.id === plusUtilisee.id) : undefined;
  /** Une journée du planning : ses créneaux, chacun avec le look de la valise qui lui répond. */
  const carteJour = (j: (typeof planningParJour)[number]) => (
    <Card key={j.jour} rayon="carte" className="px-[14px] pt-[12px] pb-[6px]">
      <div className="t-label text-terracotta">
        Jour {j.numero} · {dateCourte(j.jour)}
      </div>
      <div className="flex flex-col">
        {j.creneaux.map((c) => {
          const lk = c.look != null ? looks[c.look] : null;
          const items = lk ? piecesDuLook(lk) : [];
          return lk ? (
            <button
              key={c.creneau + c.sousId}
              onClick={() => setVue({ nom: "look", index: c.look as number })}
              aria-label={`${libelleCreneau(c)} : voir le look ${numero(c.look as number)}`}
              className="flex items-center gap-3 py-[8px] text-left cursor-pointer min-h-[60px] border-t border-divider first:border-t-0 transition-opacity active:opacity-70"
            >
              {/* Les vraies pièces du look, trois au plus, en miniatures plus grandes (19/10/2026, refonte). */}
              <span className="flex gap-[3px] flex-shrink-0">
                {items.slice(0, 3).map((p) => (
                  <Vignette key={p.id} it={p} taille={42} />
                ))}
              </span>
              <span className="flex-1 min-w-0">
                <span className={"block t-label " + (c.evenement ? "text-terracotta" : "text-muted")}>{libelleCreneau(c)}</span>
                <span className="block text-[13px] text-ink leading-[1.3] mt-[2px] truncate">{resumeLook(items)}</span>
              </span>
              <span aria-hidden="true" className="text-muted flex-shrink-0">{chevron("d")}</span>
            </button>
          ) : (
            <div key={c.creneau + c.sousId} className="py-[10px] border-t border-divider first:border-t-0 min-h-[52px]">
              <span className={"block t-label " + (c.evenement ? "text-terracotta" : "text-muted")}>{libelleCreneau(c)}</span>
              <span className="block text-[12px] text-muted-3 leading-[1.4] mt-[2px]">Aucun look de ta valise ne répond encore à cette occasion.</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
  const nbPieces = (n: number) => `${n} ${n > 1 ? "pièces" : "pièce"}`;

  return (
    <>
      {/* 1 · OÙ VAIS-JE ? La destination est le premier élément éditorial. */}
      <div className="t-surtitre text-muted">{libellePeriode(valise.depart, valise.retour)}</div>
      <h1 className="t-display text-terracotta mt-[4px] break-words" style={{ textWrap: "balance" }}>
        {valise.destination}
      </h1>

      {/* 2 · TA VALISE EST-ELLE PRÊTE ? */}
      <div className="t-titre-ecran text-ink mt-[14px] flex items-center flex-wrap gap-x-[10px]">
        <span>
          Ta valise <span className="italic">{prete ? "est prête\u00a0!" : "à compléter"}</span>
        </span>
        {prete && (
          <span aria-hidden="true" className="w-[26px] h-[26px] rounded-full bg-terracotta-deep text-cream flex items-center justify-center flex-shrink-0">
            {G_COCHE(14, "var(--color-cream)")}
          </span>
        )}
      </div>
      {prete && <div className="t-chapeau text-muted-3 mt-[6px]">{"On a sélectionné les tenues et les indispensables pour ton séjour. À toi de les ajuster\u00a0!"}</div>}
      {/* LA SYNTHÈSE (30/10/2026) : une ligne, des nombres comptés — tenues, vêtements UNIQUES à emporter (sans les suggestions), indispensables. */}
      <div className="text-[12px] text-muted mt-[8px]">
        {[
          libelleDuree(nbJours),
          `${looks.length} ${looks.length > 1 ? "tenues" : "tenue"}`,
          `${aEmporter.length} ${aEmporter.length > 1 ? "vêtements" : "vêtement"}`,
          `${affaires.length} ${affaires.length > 1 ? "indispensables" : "indispensable"}`,
        ].join(" · ")}
      </div>

      {/* La météo, compacte : celle de la prévision d'aujourd'hui, pour les jours qu'elle couvre — rien d'autre. */}
      {(amplitude || !previsionAttendue) && (
        <div className="flex flex-wrap gap-x-5 gap-y-[10px] mt-4 text-[12px] text-ink">
          {amplitude ? (
            <>
              <span className="inline-flex items-center gap-[9px]">
                <span className="text-terracotta">{G_METEO_PETIT}</span>
                <span className="leading-[1.25]">
                  <span className="block text-[13px] font-medium">{libelleAmplitude(amplitude)}</span>
                  <span className="block text-[11px] text-muted">prévus {libellePeriode(meteosPrevues[0].jour, meteosPrevues[meteosPrevues.length - 1].jour)}</span>
                </span>
              </span>
              <span className="inline-flex items-center gap-[9px]">
                <span className="text-terracotta">{G_GOUTTE}</span>
                <span className="text-[13px] font-medium leading-[1.25]">{pluie ? "Pluie annoncée" : "Pas de pluie annoncée"}</span>
              </span>
            </>
          ) : (
            <span className="inline-flex items-center gap-[9px]">
              <span className="text-muted">{G_METEO_PETIT}</span>
              <span className="text-[13px] leading-[1.25]">Météo non disponible pour ces dates</span>
            </span>
          )}
        </div>
      )}

      {/* 3 · EST-ELLE ADAPTÉE ? Dit seulement quand c'est vrai (voir sejourCouvert). */}
      <div className="mt-4">
        {/* « Ta valise couvre les besoins de ton séjour » répétait le titre (30/10/2026) : seule l'information utile reste. */}
        {!sejourCouvert && (
          <CarteInfo glyphe={G_AMPOULE}>
            {looks.length === 0
              ? "Aucun look complet avec ces pièces pour l'instant : ajoute des pièces à ton dressing, Capsela composera tes looks avec elles."
              : manquePieces > 0
                ? (
                  <>
                    {`Environ ${manquePieces} ${manquePieces > 1 ? "pièces" : "pièce"} de plus compléteraient ta valise ${valise.bagage} (remplie à ${tauxRemplissage} %).`}
                    <button onClick={() => setFeuille({ type: "ajouter" })} className="block mt-[6px] t-lien text-terracotta underline underline-offset-[3px] cursor-pointer">
                      Trouver dans mon dressing
                    </button>
                  </>
                )
                : "Une sélection pensée pour ton séjour, ta météo et ton dressing."}
          </CarteInfo>
        )}
      </div>

      {/* LA TAILLE ET LA PROVENANCE (maquette V2, 11/10/2026) : « Valise M · 12 pièces », « Changer », et ce qui vient du dressing ou de
          la capsule. Les nombres sont ceux de la sélection enregistrée. */}
      <div className="flex items-center justify-between gap-3 mt-5">
        <span className="font-serif text-[16px] text-ink">
          Valise {valise.bagage} · {depasse ? "trop pleine" : `remplie à ${tauxRemplissage}\u00a0%`}
        </span>
        <button onClick={() => setTailleOuverte(true)} className="t-lien text-terracotta-deep underline underline-offset-[3px] cursor-pointer min-h-[44px] flex-shrink-0">
          Changer
        </button>
      </div>
      {retourTaille && (
        <div role="status" className="text-[12px] text-ink-soft leading-[1.45] mt-2">
          {retourTaille}
        </div>
      )}
      {depasse && (
        <div role="status" className="text-[12px] text-terracotta leading-[1.45] mt-2">
          Ta sélection dépasse la place d&apos;une valise {valise.bagage}. Rien n&apos;est retiré sans toi :{" "}
          <button onClick={() => setOnglet("pieces")} className="underline underline-offset-[3px] cursor-pointer">
            voir ce qu&apos;on peut alléger
          </button>
          .
        </div>
      )}

      {retraitDit && (
        <div role="status" className="text-[12px] text-ink-soft leading-[1.45] mt-2">
          {retraitDit}
        </div>
      )}

      {/* LES ONGLETS : Aperçu (la valise et ses premiers looks), Looks (jour par jour), Pièces, Checklist. */}
      <div className="mt-5">
        <SegmentedControl
          ariaLabel="Contenu de la valise"
          serre
          segments={[
            { key: "ensemble", label: "Aperçu" },
            { key: "looks", label: "Tenues" },
            { key: "pieces", label: "Vêtements" },
            // « Indispensables » ne tient pas à côté des trois autres sous 360 px (coupé à 320) : « Essentiels », le même onglet.
            { key: "checklist", label: typeof window !== "undefined" && window.innerWidth < 360 ? "Essentiels" : "Indispensables" },
          ]}
          actif={onglet}
          onChange={setOnglet}
        />
      </div>

      {onglet === "ensemble" && (
        <>
      {/* L'APERÇU (refonte du 30/10/2026) : les tenues d'abord, en galerie ; puis les pièces à emporter ; ce qui reste à compléter ; les
          indispensables. Chaque bloc mène à son onglet. */}
      <section className="mt-6" aria-labelledby="titre-tenues">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titre-tenues" className="t-titre-section text-ink">
            Tes tenues
          </h2>
          {looks.length > 0 && (
            <button onClick={() => setOnglet("looks")} className="t-lien text-terracotta cursor-pointer py-[6px] flex-shrink-0">
              Voir toutes mes tenues →
            </button>
          )}
        </div>
        {cartesTenues.length === 0 ? (
          <EmptyState className="mt-3">Aucune tenue complète avec les pièces de cette valise.</EmptyState>
        ) : (
          <div className="scrollarea flex gap-[10px] overflow-x-auto -mx-6 px-6 mt-3 pb-[4px]" style={{ scrollbarWidth: "none", scrollSnapType: "x mandatory", scrollPaddingInline: 24 }}>
            {cartesTenues.slice(0, 8).map((c) => (
              <button
                key={c.cle}
                onClick={() => setVue({ nom: "look", index: c.look })}
                aria-label={`${c.quand}, ${c.quoi} : voir la tenue`}
                className="flex-shrink-0 w-[150px] text-left bg-card border border-border rounded-carte overflow-hidden cursor-pointer active:opacity-80"
                style={{ scrollSnapAlign: "start" }}
              >
                <span className="block h-[150px] px-[8px] py-[10px]" style={{ background: "var(--color-hero-background)" }}>
                  <OutfitComposition items={piecesDuLook(looks[c.look])} variant="planche" />
                </span>
                <span className="block px-[10px] py-[9px]">
                  <span className="block t-label text-terracotta truncate">{c.quand}</span>
                  <span className="block text-[13px] text-ink leading-[1.25] mt-[3px] truncate">{c.quoi}</span>
                  <span className="block text-[11px] text-muted mt-[2px]">{nbPieces(looks[c.look].ids.length)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* LES PIÈCES DE MA VALISE : chaque vêtement une fois, quel que soit le nombre de tenues qui le portent ; les suggestions sont à part. */}
      <section className="mt-7" aria-labelledby="titre-pieces">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="titre-pieces" className="t-titre-section text-ink">
            Les pièces de ma valise
          </h2>
          <button onClick={() => setOnglet("pieces")} className="t-lien text-terracotta cursor-pointer py-[6px] flex-shrink-0">
            Voir mes vêtements →
          </button>
        </div>
        {familles.length > 0 && <div className="text-[12px] text-muted leading-[1.5] mt-[4px]">{familles.map((f) => `${f.titre} ${f.vetements.length}`).join(" · ")}</div>}
        {aEmporter.length > 0 && (
          <Card rayon="carte" className="mt-3 px-[14px] pt-[14px] pb-[16px]">
            <div className="flex items-center justify-between gap-3">
              <span className="t-label text-muted">À emporter</span>
              <span className="text-[11px] text-ink rounded-full bg-cream border border-border px-[10px] py-[3px]">{nbPieces(aEmporter.length)}</span>
            </div>
            <ul className="grid grid-cols-6 gap-[8px] mt-3 list-none p-0" style={{ gridAutoRows: "clamp(40px, 11.5vw, 54px)", gridAutoFlow: "dense" }}>
              {apercu.affichees.map(({ item: p, role, echelle, compacte }, i) => {
                const im = resolveItemImage(p);
                const gabarit = compacte
                  ? "col-span-2 row-span-1"
                  : echelle === "grand"
                    ? role === "petit"
                      ? "col-span-3 row-span-2"
                      : "col-span-3 row-span-3"
                    : role === "chaussures" || role === "petit"
                      ? "col-span-2 row-span-1"
                      : "col-span-2 row-span-2";
                return (
                  <li key={p.id} className={gabarit} style={{ transform: i % 2 ? "translateY(4px)" : undefined }}>
                    <button onClick={() => ouvrirPiece(p.id)} aria-label={`Voir la pièce : ${p.name}`} className="block w-full h-full cursor-pointer">
                      {im.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={im.url} alt="" loading="lazy" className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 2px 3px rgba(29,26,22,.14))" }} />
                      ) : (
                        <span className="block w-full h-full rounded-champ" style={{ background: p.hex }} />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {apercu.reste > 0 && <div className="text-[12px] text-muted text-right mt-[14px]">+{apercu.reste} {apercu.reste > 1 ? "pièces" : "pièce"}</div>}
          </Card>
        )}
        {/* Une métrique n'est dite que si elle est comptée : la pièce la plus portée, et dans combien de tenues. */}
        {plusUtilisee && pieceReutilisee && !suggestions.has(pieceReutilisee.id) && (
          <div className="text-[12px] text-muted-3 leading-[1.45] mt-[8px]">
            {pieceReutilisee.name} revient dans {plusUtilisee.fois} tenues.
          </div>
        )}
      </section>

      {blocACompleter}

      {progressionAffaires.total > 0 && (
        <section className="mt-7" aria-labelledby="titre-indispensables">
          <h2 id="titre-indispensables" className="t-titre-section text-ink">
            Les indispensables
          </h2>
          <button onClick={() => setOnglet("checklist")} className="block w-full text-left bg-card border border-border rounded-tuile px-[14px] pt-[12px] pb-[10px] mt-3 cursor-pointer" aria-label="Ouvrir les indispensables">
            <BarrePreparation titre="Préparés" p={progressionAffaires} />
          </button>
        </section>
      )}

      {/* Au retour d'un ajout au dressing : la proposition de recomposer. */}
      {nouvelles > 0 && (
        <Card className="mt-4 p-[16px]">
          <div className="t-titre-carte text-ink">
            {nouvelles > 1 ? `${nouvelles} nouvelles pièces dans ton dressing` : "Une nouvelle pièce dans ton dressing"}
          </div>
          <div className="text-[12px] text-muted-3 leading-[1.5] mt-[5px]">Recompose ta valise pour que Capsela en tienne compte.</div>
          <Button variante="principal" className="mt-3" onClick={recomposer}>
            Recomposer ma valise
          </Button>
        </Card>
      )}

        </>
      )}

      {/* 4 · QU'EST-CE QUE JE VAIS PORTER ? Une grande carte éditoriale à la fois. */}
      {onglet === "looks" && (
        <section className="mt-6" aria-labelledby="titre-looks">
          {aPlanning ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <h2 id="titre-looks" className="t-titre-section text-ink">
                  Tes tenues jour par jour
                </h2>
                <span className="text-[12px] text-muted flex-shrink-0">{looks.length} {looks.length > 1 ? "tenues" : "tenue"}</span>
              </div>
              <div className="t-chapeau text-muted-3 mt-[4px]">Chaque journée, et chaque soir, avec une tenue de ta valise.</div>
              <div className="flex flex-col gap-2 mt-3">{planningParJour.map(carteJour)}</div>
              {piecesRepetees && (
                <div className="text-[12px] text-muted-3 leading-[1.5] text-center mt-3">
                  Certaines pièces sont pensées pour être portées plusieurs fois et combinées différemment.
                </div>
              )}
            </>
          ) : (
            <>
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="titre-looks" className="t-titre-section text-ink">
              Tes looks pour le séjour
            </h2>
            {l && (
              <span className="text-[12px] text-muted flex-shrink-0" aria-live="polite">
                {index + 1} / {looks.length}
              </span>
            )}
          </div>
          <div className="t-chapeau text-muted-3 mt-[4px]">Des tenues pensées à partir de ton dressing.</div>

          {!l ? (
            <EmptyState className="mt-4">Aucun look complet avec les pièces de cette valise.</EmptyState>
          ) : (
            <>
              <Card
                rayon="hero"
                className="mt-4 p-[10px]"
                onTouchStart={(e) => (toucher.current = e.touches[0].clientX)}
                onTouchEnd={(e) => {
                  const dx = e.changedTouches[0].clientX - (toucher.current ?? e.changedTouches[0].clientX);
                  toucher.current = null;
                  if (Math.abs(dx) < 40) return;
                  setIndexLook(Math.max(0, Math.min(looks.length - 1, index + (dx < 0 ? 1 : -1))));
                }}
              >
                <div className="relative">
                  <button
                    onClick={() => setVue({ nom: "look", index })}
                    aria-label={`Voir le look ${numero(index)} : ${resumeLook(piecesDuLook(l))}`}
                    className="block w-full rounded-carte px-[12px] py-[14px] cursor-pointer"
                    style={{ height: "clamp(270px, 80vw, 340px)", background: "var(--color-hero-background)" }}
                  >
                    <OutfitComposition items={piecesDuLook(l)} variant="hero" ajustee />
                  </button>
                  {looks.length > 1 && (
                    <>
                      <button
                        onClick={() => setIndexLook(index - 1)}
                        disabled={index === 0}
                        aria-label="Look précédent"
                        className="absolute left-[8px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] rounded-full bg-cream border border-border text-terracotta flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default"
                      >
                        {chevron("g")}
                      </button>
                      <button
                        onClick={() => setIndexLook(index + 1)}
                        disabled={index >= looks.length - 1}
                        aria-label="Look suivant"
                        className="absolute right-[8px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] rounded-full bg-cream border border-border text-terracotta flex items-center justify-center cursor-pointer disabled:opacity-30 disabled:cursor-default"
                      >
                        {chevron("d")}
                      </button>
                    </>
                  )}
                </div>

                <div className="px-[6px] pt-[14px] pb-[4px]">
                  <div className="t-label text-terracotta">
                    Look {index + 1} / {looks.length}
                  </div>
                  <div className="font-serif text-[20px] text-ink leading-[1.25] mt-[5px]">{resumeLook(piecesDuLook(l))}</div>

                  <div className="flex flex-wrap items-center gap-[6px] mt-[10px]">
                    {(() => {
                      const t = tempDuLook(l);
                      return t ? (
                        <span className="inline-flex items-center gap-[5px] text-[12px] text-ink mr-1">
                          <span className="text-terracotta">{G_METEO_PETIT}</span>
                          {libelleAmplitude(t)}
                        </span>
                      ) : null;
                    })()}
                    {occasionsDuLook(l, valise.situations).map((o) => (
                      <PuceOccasion key={o} occasion={o} />
                    ))}
                  </div>
                  {l.elargie && <div className="text-[11px] text-muted mt-2">Occasion élargie</div>}

                  <div className="text-[13px] text-ink mt-4">{nbPieces(l.ids.length)} de ta valise</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {piecesDuLook(l).map((p) => (
                      <button key={p.id} onClick={() => ouvrirPiece(p.id)} aria-label={`Voir la pièce : ${p.name}`} className="rounded-champ cursor-pointer">
                        <Vignette it={p} taille={52} />
                      </button>
                    ))}
                  </div>

                  <Button variante="contour" className="mt-4" onClick={() => setVue({ nom: "look", index })}>
                    Voir le look complet →
                  </Button>
                </div>
              </Card>

              {looks.length > 1 && (
                <div role="group" aria-label="Choisir un look" className="flex flex-wrap justify-center mt-2">
                  {looks.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setIndexLook(i)}
                      aria-label={`Look ${i + 1} sur ${looks.length}`}
                      aria-current={i === index ? "true" : undefined}
                      className="w-[24px] h-[24px] flex items-center justify-center cursor-pointer"
                    >
                      <span className={"block rounded-full " + (i === index ? "w-[8px] h-[8px] bg-terracotta-deep" : "w-[7px] h-[7px] border border-placeholder")} />
                    </button>
                  ))}
                </div>
              )}
              {/* La répétition d'une pièce est le principe de la capsule : elle est dite comme telle. */}
              {piecesRepetees && (
                <div className="text-[12px] text-muted-3 leading-[1.5] text-center mt-2">
                  Certaines pièces sont pensées pour être portées plusieurs fois et combinées différemment.
                </div>
              )}
            </>
          )}

            </>
          )}

        </section>
      )}

      {/* ── PIÈCES ── regroupées, chacune justifiée par ses looks */}
      {onglet === "pieces" && (
        <>
          {/* LES VÊTEMENTS (30/10/2026) : chaque pièce une fois, par famille, avec sa provenance, ses tenues et son état — à emporter ou
              déjà dans la valise. Cocher, c'est le même état qu'avant (cochees). Les suggestions sont dans « À compléter », plus bas. */}
          {progressionVetements.total > 0 && (
            <div className="mt-5">
              <BarrePreparation titre="Dans ta valise" p={progressionVetements} />
            </div>
          )}
          {aAlleger.length > 0 && (
            <Card className="mt-4 p-[14px]">
              <div className="t-titre-carte text-ink">On allège un peu ?</div>
              <div className="text-[12px] text-muted-3 leading-[1.45] mt-[4px]">
                Ta valise dépasse la place d&apos;une valise {valise.bagage}. Voici les pièces qui servent
                le moins.
              </div>
              <div className="flex flex-col gap-2 mt-3">
                {aAlleger.map(({ id, looksPerdus }) => {
                  const p = pieceDe(id);
                  if (!p) return null;
                  return (
                    <div key={id} className="flex items-center gap-3">
                      <Vignette it={p} taille={38} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[13px] text-ink truncate">{p.name}</span>
                        <span className="block text-[11px] text-muted">
                          {looksPerdus ? `${looksPerdus} ${looksPerdus > 1 ? "looks" : "look"} en moins sans elle` : "Dans aucun look de la valise"}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <Button variante="principal" className="mt-3" onClick={() => retirerEtDire(aAlleger.map((a) => a.id))}>
                Optimiser
              </Button>
            </Card>
          )}
          {familles.map(({ titre, vetements }) => {
            const duGroupe = vetements.map((v) => v.item);
            return (
              <section key={titre} className="mt-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-[16px] text-ink">{titre}</h3>
                  <span className="text-[12px] text-muted">{duGroupe.length}</span>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {duGroupe.map((p) => {
                    const n = parPiece.get(p.id) ?? 0;
                    const dedans = piecesCochees.includes(p.id);
                    return (
                      <Card key={p.id} rayon="tuile" className="flex items-center pr-[2px]">
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={dedans}
                          onClick={() => cocher(p.id)}
                          aria-label={`${p.name} : ${dedans ? "déjà dans la valise" : "à emporter"}`}
                          className="w-[44px] h-[44px] flex items-center justify-center flex-shrink-0 cursor-pointer"
                        >
                          <span className={"w-[22px] h-[22px] rounded-full border flex items-center justify-center " + (dedans ? "bg-terracotta-deep border-terracotta-deep" : "border-placeholder bg-card")}>
                            {dedans && G_COCHE(12, "var(--color-cream)")}
                          </span>
                        </button>
                        <button onClick={() => ouvrirPiece(p.id)} className="flex-1 min-w-0 flex items-center gap-[10px] text-left py-[7px] pr-[4px] cursor-pointer" aria-label={`${p.name}, dans ${n} ${n > 1 ? "tenues" : "tenue"}. Voir la pièce`}>
                          <Vignette it={p} taille={40} />
                          <span className="flex-1 min-w-0">
                            <span className={"block text-[13px] leading-[1.3] line-clamp-2 " + (dedans ? "text-muted" : "text-ink")}>{p.name}</span>
                            <span className="block text-[11px] leading-[1.35] text-muted mt-[2px]">Dans ton dressing</span>
                            <span className="block text-[11px] leading-[1.35] mt-[1px]">
                              <span className="text-muted whitespace-nowrap">{n ? `${n} ${n > 1 ? "tenues" : "tenue"}` : "Aucune tenue"} ·</span>{" "}
                              {/* Un bloc insécable : à 320 px, « À emporter » passe entier à la ligne au lieu de se couper (l'espace qui
                                  précède reste hors du segment insécable : c'est là que la ligne se coupe). */}
                              <span className={"inline-block " + (dedans ? "text-muted" : "text-terracotta")}>{dedans ? "Déjà dans la valise" : "À emporter"}</span>
                            </span>
                          </span>
                        </button>
                        <button onClick={() => setFeuille({ type: "remplacer", id: p.id })} aria-label={`Remplacer ${p.name}`} className="w-[36px] h-[44px] flex items-center justify-center flex-shrink-0 text-muted cursor-pointer">
                          {G_ECHANGE}
                        </button>
                        <button onClick={() => demanderRetrait(p.id)} aria-label={`Retirer ${p.name} de la valise`} className="w-[36px] h-[44px] flex items-center justify-center flex-shrink-0 text-muted cursor-pointer">
                          {G_CROIX}
                        </button>
                      </Card>
                    );
                  })}
                </div>
              </section>
            );
          })}
          <button
            onClick={() => setFeuille({ type: "ajouter" })}
            className="w-full mt-4 rounded-full border border-border bg-card text-[12px] text-ink cursor-pointer inline-flex items-center justify-center gap-[6px]"
            style={{ minHeight: 44 }}
          >
            {G_PLUS} Ajouter une pièce de ton dressing
          </button>
          {/* Deux ajouts différents, dits comme tels : ci-dessus une pièce du
              dressing entre dans la valise ; ici, une pièce qu'on n'a pas
              encore entre dans le dressing. */}
          <div className="text-[12px] text-muted leading-[1.5] mt-4 text-center">
            Une pièce qui n&apos;est pas encore dans ton dressing ?{" "}
            <button onClick={ajouterAuDressing} className="text-terracotta cursor-pointer">
              L&apos;ajouter à mon dressing
            </button>
          </div>
          {blocACompleter}
        </>
      )}

      {/* ── INDISPENSABLES ── (depuis le 30/10/2026, les affaires de voyage seules : les vêtements se cochent dans l'onglet Vêtements) — par
          section repliable avec sa progression, filtrées Tout / À préparer / Préparés. Cocher = « préparé physiquement » : rien n'est
          ajouté, retiré ni recomposé. L'état est celui que la valise garde déjà (appareil et compte). */}
      {onglet === "checklist" && (
        <div className="mt-5">
          <BarrePreparation titre="Tes indispensables" p={progressionAffaires} />
          {progressionAffaires.total > 0 && progressionAffaires.restantes === 0 && progressionVetements.restantes === 0 && (
            <div role="status" className="flex items-center gap-[10px] rounded-tuile bg-success-bg px-[14px] py-[10px] mt-3">
              <span aria-hidden="true" className="w-[22px] h-[22px] rounded-full bg-success text-cream flex items-center justify-center flex-shrink-0">
                {G_COCHE(12, "var(--color-cream)")}
              </span>
              <span className="text-[13px] text-ink">Ta valise est prête à partir.</span>
            </div>
          )}
          <div className="mt-4">
            <SegmentedControl
              ariaLabel="Filtrer la checklist"
              variante="pastilles"
              segments={[
                // Sans compte dans les libellés : à 320 px « À préparer · 42 » était coupé ; les nombres sont dans l'en-tête.
                { key: "tout", label: "Tout" },
                { key: "a_preparer", label: "À préparer" },
                { key: "preparees", label: "Préparés" },
              ]}
              actif={filtreChecklist}
              onChange={setFiltreChecklist}
            />
          </div>
          {annulation && (
            <div role="status" className="flex items-center justify-between gap-3 rounded-tuile bg-ink text-cream px-[14px] mt-3" style={{ minHeight: 48 }}>
              <span className="text-[13px] min-w-0 truncate">{annulation.libelle} retiré de la checklist</span>
              <button
                type="button"
                onClick={() => {
                  const avant = annulation.avant;
                  majAffaires(() => avant);
                  setAnnulation(null);
                }}
                className="t-cta text-cream underline underline-offset-[3px] cursor-pointer flex-shrink-0"
                style={{ minHeight: 44 }}
              >
                Annuler
              </button>
            </div>
          )}
          {progressionAffaires.total === 0 && <EmptyState className="mt-4">Rien à préparer pour l&apos;instant.</EmptyState>}
          {progressionAffaires.total > 0 && filtreChecklist === "preparees" && progressionAffaires.preparees === 0 && (
            <div className="text-[12px] text-muted-3 mt-4">Aucun article préparé pour l&apos;instant : coche-les au fil de ta préparation.</div>
          )}
          <div className="flex flex-col gap-2 mt-4">
            {/* Sous un filtre, une section sans article concerné ne s'affiche pas : la liste montre ce qu'on cherche, rien d'autre. */}
            {sectionsChecklist(articlesAffaires, filtreChecklist)
              .filter((sec) => filtreChecklist === "tout" || sec.articles.length > 0)
              .map((sec) => {
              const repliee = repliees.includes(sec.id);
              // Une raison partagée par TOUS les articlesAffaires de la section (« Trajet au programme ») est dite une fois, sous son titre,
              // plutôt que répétée sur chaque ligne (19/10/2026, demandé).
              // Une raison portée par plusieurs articlesAffaires de la section (« Plage au programme ») est dite une fois, sous son titre ; une
              // raison propre à un article (« Pluie annoncée ») reste sous lui (raisonsPartagees, 20/10/2026).
              const partagees = raisonsPartagees(articlesAffaires.filter((x) => x.section === sec.id));
              return (
                <Card key={sec.id} rayon="tuile" className="px-[12px]">
                  <button
                    onClick={() => setRepliees((r) => (repliee ? r.filter((x) => x !== sec.id) : [...r, sec.id]))}
                    aria-expanded={!repliee}
                    className="w-full flex items-center gap-[10px] text-left cursor-pointer"
                    style={{ minHeight: 48 }}
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] text-ink font-medium">{sec.libelle}</span>
                      {partagees.length > 0 && <span className="block text-[11px] text-terracotta">{partagees.join(" · ")}</span>}
                    </span>
                    <span className={"text-[12px] " + (sec.progression.restantes === 0 ? "text-success" : "text-muted")}>
                      {sec.progression.preparees} / {sec.progression.total}
                    </span>
                    <span aria-hidden="true" className="text-muted">{chevronBas(!repliee)}</span>
                  </button>
                  {!repliee && (
                    <div className="border-t border-divider pb-[4px]">
                      {sec.articles.map((art) => {
                        const p = art.piece;
                        const a = art.affaire;
                        const basculerArticle = () => (p ? cocher(p.id) : a && majAffaires((e) => ({ ...e, cochees: basculer(e.cochees, a.id) })));
                        const raisonPropre = a?.raison && !partagees.includes(a.raison) ? a.raison : null;
                        /*
                         * TROIS ZONES DISTINCTES (20/10/2026, demandé : la coche et la croix trop proches). Depuis le 22/10/2026 (demandé) :
                         * la croix à GAUCHE de la ligne, la coche à DROITE — le contenu entre les deux, les deux actions aux deux bouts.
                         * Deux boutons frères de 44 × 44, jamais imbriqués : un toucher n'en déclenche qu'un. Une pièce de la valise n'a pas
                         * de croix (on la retire depuis l'onglet Pièces) : sa ligne commence par sa vignette, et les coches restent alignées à droite.
                         */
                        const croix = a ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              retirerDeLaChecklist(a);
                            }}
                            aria-label={`Retirer ${a.libelle} de la checklist`}
                            className="w-[44px] h-[44px] -ml-[12px] flex items-center justify-center rounded-full text-placeholder cursor-pointer focus-visible:outline-2 focus-visible:outline-terracotta"
                          >
                            {G_CROIX}
                          </button>
                        ) : null;
                        return (
                          <div
                            key={art.cle}
                            className="grid items-center border-b border-divider last:border-b-0"
                            style={{ gridTemplateColumns: a ? "32px minmax(0, 1fr) 44px" : "minmax(0, 1fr) 44px", columnGap: 8, minHeight: 52 }}
                          >
                            {croix}
                            <div className="flex items-center gap-[10px] min-w-0 py-[6px]">
                              {p ? <Vignette it={p} taille={40} /> : null}
                              <span className="flex-1 min-w-0">
                                <span className={"block text-[13px] leading-[1.3] line-clamp-2 break-words " + (art.prete ? "text-muted line-through" : "text-ink")}>{art.libelle}</span>
                                {/* Une suggestion de la capsule se dit « Capsule » (19/10/2026, demandé) ; l'en-tête de la valise explique qu'elle est à ajouter au dressing. */}
                                {p && suggestions.has(p.id) && <span className="block text-[11px] text-terracotta">Capsule</span>}
                                {raisonPropre && <span className="block text-[11px] text-terracotta truncate">{raisonPropre}</span>}
                              </span>
                            </div>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={art.prete}
                              onClick={basculerArticle}
                              aria-label={`Marquer ${art.libelle} comme ${art.prete ? "non préparé" : "préparé"}`}
                              className="w-[44px] h-[44px] flex items-center justify-center rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-terracotta"
                            >
                              <span aria-hidden="true" className={"w-[26px] h-[26px] rounded-full flex items-center justify-center " + (art.prete ? "bg-terracotta-deep text-cream" : "border-[1.5px] border-muted text-transparent")}>
                                {G_COCHE(13, "currentColor")}
                              </span>
                            </button>
                          </div>
                        );
                      })}
                      {sec.id === "toilette" && noteLiquides && <div className="text-[11px] text-muted-3 leading-[1.45] py-[8px]">{noteLiquides}</div>}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Ajouter une affaire : elle rejoint « Équipement du séjour », le total et la progressionAffaires ; gardée avec la valise. */}
          <div className="mt-5">
            <form
              className="flex items-center gap-2 mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                ajouterAffaire();
              }}
            >
              <Input
                value={nouvelleAffaire}
                onChange={(e) => setNouvelleAffaire(e.target.value)}
                placeholder="Ajouter une affaire (ex. appareil photo)"
                aria-label="Ajouter une affaire de voyage"
                maxLength={60}
              />
              <Button variante="secondaire" pleine={false} className="bg-card flex-shrink-0" disabled={!libelleAjoutValide(nouvelleAffaire, affaires)} onClick={ajouterAffaire}>
                Ajouter
              </Button>
            </form>

            {affairesCachees.length > 0 && (
              <div className="mt-3">
                <button onClick={() => setVoirMasquees((v) => !v)} aria-expanded={voirMasquees} className="t-lien text-terracotta underline underline-offset-[3px] cursor-pointer min-h-[44px]">
                  {voirMasquees ? "Cacher les affaires masquées" : affairesCachees.length > 1 ? `Afficher les ${affairesCachees.length} affaires masquées` : "Afficher l'affaire masquée"}
                </button>
                {voirMasquees && (
                  <div className="flex flex-col gap-2 mt-1">
                    {affairesCachees.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 bg-card border border-border rounded-tuile px-[12px]" style={{ minHeight: 44 }}>
                        <span className="text-[13px] text-muted">{a.libelle}</span>
                        <button
                          onClick={() => majAffaires((e) => ({ ...e, masquees: (e.masquees ?? []).filter((x) => x !== a.id) }))}
                          className="t-lien text-terracotta cursor-pointer min-h-[44px]"
                        >
                          Réafficher
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6 · QUE PUIS-JE FAIRE MAINTENANT ? L'action dominante reste sous le pouce, posée sur la barre du bas : le défilement réserve déjà la hauteur de la barre (pb-safe-nav), le -16 px retire sa marge de confort. */}
      <div
        className="sticky z-10 -mx-6 px-6 pt-[10px] pb-[10px] mt-6 bg-cream border-t border-border"
        style={{ bottom: "-16px" }}
      >
        <Button onClick={() => setFeuille({ type: "ajuster" })}>Ajuster ma valise</Button>
      </div>
      <button onClick={recommencer} className="block mx-auto mt-1 t-lien text-terracotta underline underline-offset-[3px] cursor-pointer py-[10px]">
        Créer une autre valise
      </button>
      <div className="text-[11px] text-placeholder leading-[1.5] mt-2 text-center">
        <div>{`${dateCourte(valise.depart)} → ${dateCourte(valise.retour)}`}</div>
        {gardeeOu === "compte" && <div>Enregistrée dans ton compte.</div>}
        {gardeeOu === "appareil" && <div>Enregistrée sur cet appareil seulement.</div>}
      </div>
      {feuilles}
    </>
  );
}

function Pied({ gardeeOu, ajuster, recommencer, periode }: { gardeeOu: "compte" | "appareil" | null; ajuster: () => void; recommencer: () => void; periode?: string }) {
  return (
    <>
      {/* « Ajuster » dit qu'on retouche la sélection générée ; « Nouvelle valise » repart de zéro. */}
      <div className="flex gap-2 mt-7">
        <Button variante="secondaire" pleine={false} className="flex-1 bg-card" onClick={ajuster}>
          Ajuster ma valise
        </Button>
        <Button variante="principal" pleine={false} className="flex-1" onClick={recommencer}>
          Nouvelle valise
        </Button>
      </div>
      <div className="text-[11px] text-placeholder leading-[1.5] mt-4">
        {periode && <div>{periode}</div>}
        {/* Où elle est gardée, tel que c'est : avant la migration 0038, ou
            sans réseau, elle ne suit pas sur un autre appareil. */}
        {gardeeOu === "compte" && <div>Enregistrée dans ton compte.</div>}
        {gardeeOu === "appareil" && <div>Enregistrée sur cet appareil seulement.</div>}
      </div>
    </>
  );
}
