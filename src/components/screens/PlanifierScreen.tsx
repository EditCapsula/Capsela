"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import FilEtapes from "@/components/FilEtapes";
import { GlypheOccasion, GlypheSousChoix } from "@/components/GlyphesOccasion";
import { OutfitComposition } from "@/components/OutfitComposition";
import { useAuth } from "@/lib/auth";
import { CATS, DATE_CONTEXTS, OCCASIONS, occasionShortLabel } from "@/lib/data";
import { emptyStateCopy } from "@/lib/emptyStateCopy";
import { generateOutfitWithFallback } from "@/lib/logic";
import { jourLocal } from "@/lib/outfitFeedback";
import { joursCouverts, previsionPour, type MomentJournee, type Prevision } from "@/lib/prevision";
import { saisonCalendairePour, weatherForDay } from "@/lib/capsule";
import { fetchPrevisionByCity } from "@/lib/weather";
import { paletteHexes } from "@/lib/profile";
import { composeWardrobePool } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "@/lib/types";

/**
 * Planifier une tenue — maquette du 23/09/2026, LOT 1.
 *
 * REMPLACE L'ÉCRAN D'ATTENTE du 22/09. Celui-ci assumait de ne rien faire ;
 * celui-là fait le parcours en entier (intro, 4 étapes, résultat) sur le vrai
 * moteur et la vraie taxonomie.
 *
 * CE QUE LE LOT 1 NE FAIT PAS, ET POURQUOI C'EST ÉCRIT À L'ÉCRAN PLUTÔT QUE
 * SIMULÉ :
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

const G_CALENDRIER = (
  <>
    <rect x="4" y="6" width="16" height="14" rx="2" {...T} />
    <line x1="4" y1="10" x2="20" y2="10" {...T} />
    <line x1="8.5" y1="3.5" x2="8.5" y2="7" {...T} />
    <line x1="15.5" y1="3.5" x2="15.5" y2="7" {...T} />
  </>
);
const G_CINTRE = (
  <>
    <path d="M12 6a2 2 0 1 1 2 2v1.4" {...T} />
    <path d="M14 9.4 3.9 16.2a1 1 0 0 0 .6 1.8h15a1 1 0 0 0 .6-1.8L14 9.4z" {...T} />
  </>
);
const G_MAIN = (
  <>
    <path d="M9 11.5V5.8a1.4 1.4 0 0 1 2.8 0v5.2" {...T} />
    <path d="M11.8 10.6V9.3a1.4 1.4 0 0 1 2.8 0v1.8" {...T} />
    <path d="M14.6 10.9V9.9a1.4 1.4 0 0 1 2.8 0v5.3a4.8 4.8 0 0 1-4.8 4.8h-1a4 4 0 0 1-3.3-1.8L6 14.8a1.3 1.3 0 0 1 2.1-1.5l.9 1.2" {...T} />
  </>
);
const G_NUAGE = (
  <path d="M7.6 18.2h9.2a3.7 3.7 0 0 0 .4-7.4 5.6 5.6 0 0 0-10.8 1 3.2 3.2 0 0 0 1.2 6.4z" {...T} />
);
const G_COCHE = <path d="M5 12.5l4.5 4.5L19 7.5" {...T} strokeWidth={1.8} />;

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

/** Étiquette de section, reprise telle quelle des autres écrans. */
function Surtitre({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] tracking-[.16em] uppercase text-muted">{children}</div>;
}

/** Titre éditorial en deux temps — la seconde moitié en italique terracotta. */
function TitreEtape({ a, b }: { a: string; b: string }) {
  return (
    <div className="font-serif text-[27px] leading-[1.12] text-ink mt-[6px]" style={{ textWrap: "balance" }}>
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
        "flex items-center gap-3 w-full text-left rounded-[14px] px-[14px] py-2 cursor-pointer border transition-colors " +
        (actif ? "bg-warm-bg border-sand-border" : "bg-card border-border")
      }
      style={{ minHeight: 52 }}
    >
      {glyphe && <span className={"flex-shrink-0 " + (actif ? "text-terracotta-deep" : "text-muted-3")}>{glyphe}</span>}
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-medium text-ink">{titre}</span>
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

/** Pastille de sous-choix — même grammaire que les chips de l'écran Tenue. */
function Pastille({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      className={
        "inline-flex items-center gap-[6px] rounded-full px-[14px] text-[12.5px] font-medium cursor-pointer border transition-colors " +
        (actif ? "bg-terracotta-deep border-terracotta-deep text-cream" : "bg-card border-border text-muted-3")
      }
      style={{ minHeight: 40 }}
    >
      {children}
    </button>
  );
}

export default function PlanifierScreen() {
  const { state, weather, defaultCapsule, actions } = useCapsela();
  const { profile } = useAuth();

  const [vue, setVue] = useState<"intro" | "etape" | "resultat">("intro");
  const [etape, setEtape] = useState(1);
  const [occ, setOcc] = useState<OccasionKey | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>("Présentiel");
  const [dateContext, setDateContext] = useState<DateContext | null>(null);
  const [jour, setJour] = useState<number | null>(null);
  const [moment, setMoment] = useState<MomentJournee | null>(null);
  const [lieu, setLieu] = useState("");
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
  const [prevision, setPrevision] = useState<Prevision | null>(null);
  const [previsionEtat, setPrevisionEtat] = useState<"vide" | "encours" | "faite">("vide");

  const occLabel = occ && occ !== "all" ? occasionShortLabel(occ) : "";
  const occLong = occ ? (OCCASIONS.find(([k]) => k === occ)?.[1] ?? "") : "";

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
   */
  const meteoUtilisee =
    meteoMoment && dateChoisie
      ? weatherForDay(meteoMoment.temp, meteoMoment.label, saisonCalendairePour(dateChoisie))
      : weather;

  const tenue = useMemo(() => {
    if (!occ) return null;
    // Même composition que `regen` (store.tsx) : une catégorie dont aucune
    // pièce réelle ne déclare l'occasion se voit rendre celles de la capsule
    // qui la déclarent. « Uniquement mon dressing » court-circuite cette
    // complétion — c'est tout ce que ce réglage fait, et c'est suffisant.
    const pool = dressingSeul ? state.items : composeWardrobePool(state.items, defaultCapsule, CAT_KEYS, { completerPourOccasion: occ });
    return generateOutfitWithFallback(
      pool,
      meteoUtilisee,
      occ,
      workMode,
      dateContext ?? "Verre",
      paletteHexes(profile),
      profile.gender
    );
    // `tirage` est une dépendance délibérée : c'est le bouton « Autre
    // proposition ». Sans elle, redemander une tenue rendrait la même.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occ, dressingSeul, state.items, defaultCapsule, meteoUtilisee, workMode, dateContext, profile, tirage]);

  const pieces: Item[] = useMemo(() => {
    if (!tenue) return [];
    const source = dressingSeul ? state.items : [...state.items, ...defaultCapsule];
    return tenue.ids.map((id) => source.find((i) => i.id === id)).filter((i): i is Item => !!i);
  }, [tenue, state.items, defaultCapsule, dressingSeul]);

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
  const provenance = dressingSeul
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
    if (previsionEtat !== "faite") {
      return `On regardera la météo prévue sur place le jour J, pas celle d'aujourd'hui.`;
    }
    if (meteoMoment) {
      const amplitude =
        meteoMoment.tempMin === meteoMoment.tempMax
          ? `${meteoMoment.temp}°`
          : `de ${meteoMoment.tempMin}° à ${meteoMoment.tempMax}°`;
      return `Prévision à ${prevision?.city || lieu.trim()} pour ce moment : ${amplitude}, ${meteoMoment.label.toLowerCase()}. La tenue en tient compte.`;
    }
    if (prevision && dernierJourConnu && dateChoisie && jourLocal(dateChoisie) > dernierJourConnu) {
      const d = new Date(`${dernierJourConnu}T12:00:00`);
      return `La prévision ne va que jusqu'au ${d.getDate()} ${MOIS[d.getMonth()]}. Au-delà, la tenue est composée sur la météo d'aujourd'hui — ${aujourdhui}.`;
    }
    return `Pas de prévision disponible pour ce lieu. La tenue est composée sur la météo d'aujourd'hui — ${aujourdhui}.`;
  })();

  const sousChoixRequis = occ === "travail_formel" || occ === "date";
  const sousChoixFait = occ === "travail_formel" ? true : occ === "date" ? !!dateContext : true;
  /**
   * L'étape 4 attend la prévision plutôt que de composer sur la météo du jour
   * puis de changer la tenue sous les yeux : la requête est partie en
   * quittant l'étape 3, elle est presque toujours revenue quand on arrive
   * ici. Les étapes 1 à 3 ne sont jamais bloquées par elle.
   */
  const attend = etape === 4 && previsionEtat === "encours";
  const etapeValide =
    etape === 1 ? !!occ && sousChoixFait : etape === 2 ? jour != null && !!moment : etape === 3 ? !!lieu.trim() : true;

  const revenir = () => {
    if (vue === "resultat") setVue("etape");
    else if (vue === "etape" && etape > 1) setEtape(etape - 1);
    else if (vue === "etape") setVue("intro");
    else actions.goHome();
  };

  const ETAPES: Record<number, [string, string, string, string]> = {
    1: ["Étape 1 sur 4", "Quelle est", "l'occasion ?", "Choisis ce qui est prévu ce jour-là."],
    2: ["Étape 2 sur 4", "Pour", "quand ?", "La date décrit le rendez-vous. Elle n'entre pas encore dans la composition."],
    3: ["Étape 3 sur 4", "Où", "seras-tu ?", "Noté pour le rendez-vous. Le lieu n'affine pas encore la tenue."],
    4: ["Étape 4 sur 4", "Une envie", "particulière ?", "Un seul réglage agit sur la tenue aujourd'hui."],
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-cream">
      <div className="flex-shrink-0 px-6 pt-[6px]">
        <AppHeader showAvatar={false} onBack={revenir} backLabel={vue === "intro" ? "Revenir à l'accueil" : "Revenir à l'étape précédente"} />
      </div>

      {/* Le fil de l'onboarding, repris tel quel (24/09/2026, demandé). Il
          portait ici quatre barres pleine largeur, écrites sans regarder
          l'existant. Centré et non aligné à gauche : dans l'onboarding il
          l'est entre le retour et sa gouttière miroir, et le bandeau de cet
          écran centre déjà le logo juste au-dessus. */}
      {vue === "etape" && (
        <div className="flex-shrink-0 flex justify-center px-6 pb-[2px]">
          <FilEtapes total={4} courante={etape - 1} />
        </div>
      )}

      <div className="scrollarea flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-5">
        {vue === "intro" && (
          <>
            <Surtitre>Planifier</Surtitre>
            <TitreEtape a="Le bon look," b="au bon moment" />
            <div className="mt-4 rounded-[24px] overflow-hidden bg-warm-bg" style={{ aspectRatio: "1.5" }}>
              {/* <img> et non next/image : l'export statique (output: "export",
                  nécessaire à l'empaquetage Capacitor) n'embarque pas
                  l'optimiseur d'images. Même convention que l'accueil et le
                  dressing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/editorial/capsela_dressing_empty.webp"
                alt="Pièces posées à plat, prêtes pour un rendez-vous à venir"
                width={864}
                height={558}
                loading="lazy"
                decoding="async"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            <div className="flex flex-col gap-[14px] mt-5">
              {([
                [G_CALENDRIER, "Décris le rendez-vous", "Une occasion, une date, un lieu."],
                [G_CINTRE, "Capsela compose la tenue", "Le vrai moteur, sur ton dressing et ta capsule."],
                [G_MAIN, "Tu gardes la main", "Une autre proposition, ou tu reprends les réponses."],
              ] as const).map(([g, t, s]) => (
                <div key={t} className="flex gap-[13px] items-start">
                  <span className="w-10 h-10 flex-shrink-0 rounded-full bg-warm-bg flex items-center justify-center text-terracotta-deep">
                    <Glyphe>{g}</Glyphe>
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink">{t}</div>
                    <div className="text-[12px] text-muted leading-[1.45] mt-[2px]">{s}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[14px] bg-card border border-border px-[14px] py-3 text-[12px] text-muted-3 leading-[1.45]" style={{ textWrap: "pretty" }}>
              La météo du jour J est celle prévue sur place, dans la limite de ce que la prévision couvre —
              au-delà, l&apos;écran le dit plutôt que de l&apos;inventer. Rien n&apos;est conservé pour
              l&apos;instant : la liste de tes tenues planifiées viendra avec.
            </div>
          </>
        )}

        {vue === "etape" && (
          <>
            <Surtitre>{ETAPES[etape][0]}</Surtitre>
            <TitreEtape a={ETAPES[etape][1]} b={ETAPES[etape][2]} />
            <div className="text-[12.5px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
              {ETAPES[etape][3]}
            </div>

            {etape === 1 && (
              <>
                <div className="flex flex-col gap-[7px] mt-4">
                  {OCCASIONS.map(([key, label, desc]) => (
                    <LigneChoix
                      key={key}
                      actif={occ === key}
                      titre={label}
                      sousTitre={desc}
                      glyphe={<GlypheOccasion occasion={key} taille={19} />}
                      onClick={() => {
                        setOcc(key);
                        setDateContext(null);
                      }}
                    />
                  ))}
                </div>
                {sousChoixRequis && (
                  /* `key={occ}` force le remontage en passant de Travail à
                     Date, sans quoi le bloc reste en place et la mise en vue
                     ci-dessous ne rejouerait pas. */
                  <div
                    key={occ}
                    ref={(el) => {
                      /* Les dix occasions dépassent la hauteur d'écran :
                         sélectionner « Date » faisait apparaître une question
                         obligatoire SOUS le pli, pendant que « Suivant »
                         restait grisé sans raison visible. Mesuré, identique
                         à 320 et 390 px : le bloc naissait 218 px sous le pli,
                         et la mise en vue le ramène entièrement dans le
                         cadre (bas du bloc = bas de la zone défilante). */
                      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                    }}
                  >
                    <div className="mt-[18px]">
                      <Surtitre>{occ === "travail_formel" ? "Où travailleras-tu ?" : "Quel type de date ?"}</Surtitre>
                    </div>
                    <div className="flex flex-wrap gap-[7px] mt-[9px]">
                      {occ === "travail_formel"
                        ? WORK_MODES.map((m) => (
                            <Pastille key={m} actif={workMode === m} onClick={() => setWorkMode(m)}>
                              <GlypheSousChoix valeur={m} taille={14} />
                              {m}
                            </Pastille>
                          ))
                        : DATE_CONTEXTS.map(([c]) => (
                            <Pastille key={c} actif={dateContext === c} onClick={() => setDateContext(c)}>
                              <GlypheSousChoix valeur={c} taille={14} />
                              {c}
                            </Pastille>
                          ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {etape === 2 && (
              <>
                <div className="scrollarea flex gap-[7px] overflow-x-auto mt-4 -mx-6 px-6">
                  {Array.from({ length: JOURS_PROPOSES }, (_, i) => i + 1).map((n) => {
                    const d = dansNJours(n);
                    const on = jour === n;
                    return (
                      <button
                        key={n}
                        onClick={() => setJour(n)}
                        aria-pressed={on}
                        className={
                          "flex-shrink-0 w-[54px] rounded-[16px] py-[7px] cursor-pointer border transition-colors " +
                          (on ? "bg-terracotta-deep border-terracotta-deep" : "bg-card border-border")
                        }
                        style={{ minHeight: 66 }}
                      >
                        <span className={"block text-[9px] tracking-[.08em] uppercase " + (on ? "text-cream" : "text-muted")}>
                          {DOW[d.getDay()]}
                        </span>
                        <span className={"block font-serif text-[19px] mt-[2px] " + (on ? "text-cream" : "text-ink")}>
                          {d.getDate()}
                        </span>
                        <span className={"block text-[8.5px] " + (on ? "text-cream" : "text-muted")}>
                          {MOIS[d.getMonth()]}
                        </span>
                      </button>
                    );
                  })}
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
                <div className="flex items-center gap-[10px] mt-4 bg-card border border-border rounded-[14px] px-[14px]" style={{ minHeight: 48 }}>
                  <input
                    className="capin flex-1 min-w-0 bg-transparent border-none text-[13px] font-medium text-ink"
                    value={lieu}
                    onChange={(e) => setLieu(e.target.value)}
                    placeholder="Ville ou lieu — ex. Paris, Clichy…"
                    aria-label="Lieu du rendez-vous"
                  />
                </div>
                <div className="mt-5">
                  <Surtitre>Type de lieu · facultatif</Surtitre>
                </div>
                <div className="flex flex-col gap-[7px] mt-3">
                  {TYPES_LIEU.map(([t, d]) => (
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

            {etape === 4 && (
              <button
                onClick={() => setDressingSeul(!dressingSeul)}
                aria-pressed={dressingSeul}
                className="w-full flex gap-3 items-center mt-4 bg-card border border-border rounded-[20px] p-[14px] cursor-pointer text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-medium text-ink">Uniquement mon dressing</span>
                  <span className="block text-[11.5px] text-muted leading-[1.45] mt-[3px]">
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

            <div className="flex gap-[10px] items-start mt-[18px] bg-warm-bg rounded-[14px] px-[14px] py-3">
              <span className="flex-shrink-0 mt-[1px]" style={{ color: "var(--color-gold)" }}>
                <Glyphe taille={17}>{G_NUAGE}</Glyphe>
              </span>
              <div className="text-[12px] text-muted-3 leading-[1.45]" style={{ textWrap: "pretty" }}>
                {previsionEtat === "encours" ? "Prévision en cours de récupération…" : phraseMeteo}
              </div>
            </div>
          </>
        )}

        {vue === "resultat" && tenue && (
          <>
            <span className="inline-block text-[10px] tracking-[.1em] uppercase text-terracotta bg-warm-bg rounded-full px-[10px] py-[5px]">
              {occLong}
            </span>
            <TitreEtape a={occLabel} b={lieu.trim() ? `· ${lieu.trim()}` : ""} />
            <div className="text-[12.5px] text-muted mt-[6px]">
              {dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)}
              {moment ? ` · ${moment}` : ""}
              {typeLieu ? ` · ${typeLieu}` : ""}
            </div>

            {tenue.noCompleteOutfit ? (
              <div className="mt-[14px] bg-card border border-border rounded-[20px] p-[15px]">
                <div className="font-serif text-[18px] text-ink">
                  {emptyStateCopy(tenue.reason ?? "no_match", dressingSeul ? "ton dressing" : "ton dressing et ta capsule").title}
                </div>
                <div className="text-[12.5px] text-muted-3 leading-[1.5] mt-2">
                  {emptyStateCopy(tenue.reason ?? "no_match", dressingSeul ? "ton dressing" : "ton dressing et ta capsule").body}
                </div>
              </div>
            ) : (
              <>
                <div className="mt-[14px] rounded-[24px] p-4" style={{ background: "var(--color-terracotta-deep)" }}>
                  <div className="flex items-center justify-between gap-[10px]">
                    <span className="text-[10.5px] tracking-[.12em] uppercase text-cream">Tenue préparée</span>
                    <span
                      className="text-[10.5px] text-cream rounded-full px-[11px] py-[5px] whitespace-nowrap"
                      style={{ background: "rgba(251,243,234,.2)" }}
                    >
                      {jour === 1 ? "Demain" : `Dans ${jour} jours`}
                    </span>
                  </div>
                  <div className="mt-3">
                    <OutfitComposition items={pieces} variant="hero" />
                  </div>
                </div>

                <div className="mt-[14px] bg-card border border-border rounded-[20px] p-[15px]">
                  <div className="font-serif text-[18px] text-ink">Pourquoi ce look ?</div>
                  <div className="flex flex-col gap-2 mt-[10px]">
                    {[
                      `Pensée pour « ${occLong} »${occ === "travail_formel" ? ` · ${workMode}` : occ === "date" && dateContext ? ` · ${dateContext}` : ""}`,
                      phraseMeteo,
                      provenance,
                    ].map((r) => (
                      <div key={r} className="flex gap-[9px] items-start">
                        <span className="flex-shrink-0 text-terracotta-deep mt-[1px]">
                          <Glyphe taille={16}>{G_COCHE}</Glyphe>
                        </span>
                        <span className="text-[12.5px] text-muted-3 leading-[1.45]">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-[12px] text-muted leading-[1.5] mt-[14px] text-center" style={{ textWrap: "pretty" }}>
                  Cette tenue n&apos;est pas conservée : la garder jusqu&apos;au jour J arrive avec la suite.
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="flex-shrink-0 px-6 pt-[10px] pb-[18px] flex flex-col gap-2 border-t border-border">
        {vue === "intro" && (
          <button
            onClick={() => {
              setVue("etape");
              setEtape(1);
            }}
            className="w-full rounded-full bg-terracotta-deep text-cream text-[14px] font-semibold cursor-pointer"
            style={{ minHeight: 52 }}
          >
            Commencer
          </button>
        )}
        {vue === "etape" && (
          <button
            onClick={() => {
              if (!etapeValide || attend) return;
              if (etape === 3) {
                /* Le lieu est arrêté : c'est ici qu'on demande la prévision,
                   et pas à chaque frappe dans le champ. Aucun effet — un
                   clic, une requête. */
                setPrevisionEtat("encours");
                const demande = lieu.trim();
                fetchPrevisionByCity(demande)
                  .then((p) => {
                    setPrevision(p);
                    setPrevisionEtat("faite");
                  })
                  .catch(() => {
                    setPrevision(null);
                    setPrevisionEtat("faite");
                  });
              }
              if (etape === 4) setVue("resultat");
              else setEtape(etape + 1);
            }}
            disabled={!etapeValide || attend}
            className="w-full rounded-full text-cream text-[14px] font-semibold cursor-pointer disabled:cursor-not-allowed"
            style={{
              minHeight: 52,
              background: etapeValide && !attend ? "var(--color-terracotta-deep)" : "var(--color-cream-dark-soft)",
            }}
          >
            {attend ? "Un instant…" : etape === 4 ? "Voir ma tenue" : "Suivant"}
          </button>
        )}
        {vue === "resultat" && (
          <>
            <button
              onClick={actions.goHome}
              className="w-full rounded-full bg-terracotta-deep text-cream text-[14px] font-semibold cursor-pointer"
              style={{ minHeight: 52 }}
            >
              Terminer
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setTirage(tirage + 1)}
                className="flex-1 rounded-full bg-card border border-border text-[12.5px] font-medium text-muted-3 cursor-pointer"
                style={{ minHeight: 44 }}
              >
                Autre proposition
              </button>
              <button
                onClick={() => {
                  setVue("etape");
                  setEtape(1);
                }}
                className="flex-1 rounded-full bg-card border border-border text-[12.5px] font-medium text-muted-3 cursor-pointer"
                style={{ minHeight: 44 }}
              >
                Modifier
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
