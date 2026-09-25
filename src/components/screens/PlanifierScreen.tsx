"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import FilEtapes from "@/components/FilEtapes";
import { GlypheOccasion, GlypheSousChoix } from "@/components/GlyphesOccasion";
import { OutfitComposition } from "@/components/OutfitComposition";
import { useAuth } from "@/lib/auth";
import { CATS, DATE_CONTEXTS, OCCASIONS, occasionShortLabel } from "@/lib/data";
import { emptyStateCopy } from "@/lib/emptyStateCopy";
import { generateOutfitWithFallback } from "@/lib/logic";
import { jourLocal } from "@/lib/outfitFeedback";
import { HORIZON_PREVISION_JOURS, joursCouverts, previsionPour, type MomentJournee, type Prevision } from "@/lib/prevision";
import { saisonCalendairePour, weatherForDay } from "@/lib/capsule";
import { fetchPrevisionByCity, fetchVilles, libelleVille, type VilleSuggeree } from "@/lib/weather";
import { deleteTenuePlanifiee, fetchTenuesPlanifiees, repartirParEcheance, upsertTenuePlanifiee, type TenuePlanifiee } from "@/lib/planifier";
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
  return <div className="text-[11px] tracking-[.16em] uppercase text-muted">{children}</div>;
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

export default function PlanifierScreen() {
  const { state, weather, defaultCapsule, actions } = useCapsela();
  const { profile, userId } = useAuth();

  const [vue, setVue] = useState<"intro" | "etape" | "resultat" | "liste">("intro");
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
  const [jour, setJour] = useState<number | null>(null);
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
   * Gardées ICI et non dans le store : elles n'ont qu'un seul consommateur.
   * Le jour où l'écran Tenue en aura besoin — « le jour J, ce look devient ta
   * tenue du jour » — elles monteront dans le store comme savedLooks. Les y
   * mettre avant leur second lecteur alourdirait le store sans rien régler.
   */
  const [plans, setPlans] = useState<TenuePlanifiee[]>([]);
  const [enregistrement, setEnregistrement] = useState(false);
  const [onglet, setOnglet] = useState<"up" | "past">("up");
  const [toast, setToast] = useState<string | null>(null);

  const [prevision, setPrevision] = useState<Prevision | null>(null);
  const [previsionEtat, setPrevisionEtat] = useState<"vide" | "encours" | "faite">("vide");

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
      dateContext,
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
      // Avant l'appel il n'y a rien à annoncer sur la météo — seulement à dire
      // ce qu'il manque pour l'obtenir. Une phrase produit, pas un disclaimer.
      return `Indique la ville : la tenue tiendra compte de la météo prévue sur place.`;
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
  /* Chargement unique à l'ouverture de l'écran. `fetchTenuesPlanifiees` rend
     [] en mode démo comme en cas d'échec : il n'y a donc pas d'état d'erreur
     à afficher, seulement une liste vide. */
  useEffect(() => {
    if (!userId) return;
    let annule = false;
    fetchTenuesPlanifiees(userId).then((r) => {
      if (!annule) setPlans(r);
    });
    return () => {
      annule = true;
    };
  }, [userId]);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2600);
  };

  const { aVenir, passees } = repartirParEcheance(plans);
  const listeAffichee = onglet === "up" ? aVenir : passees;

  /**
   * « Garder cette tenue ». L'écriture précède l'affichage : la liste n'est
   * mise à jour qu'une fois la ligne confirmée par la base, jamais avant
   * (même précaution que saveItem). En cas d'échec on le dit — une tenue qu'on
   * croit gardée et qui a disparu au rechargement coûte plus qu'un message.
   */
  const garder = async () => {
    if (!userId || !occ || jour == null || !moment || !tenue || tenue.noCompleteOutfit) return;
    setEnregistrement(true);
    try {
      const ligne = await upsertTenuePlanifiee(userId, {
        jour: jourLocal(dansNJours(jour)),
        moment,
        occasion: occ,
        sousChoix: sousChoix ? String(sousChoix.courant) : null,
        lieu: lieu.trim(),
        typeLieu,
        dressingSeul,
        pieceIds: tenue.ids,
        temp: meteoMoment ? meteoMoment.temp : null,
        weatherLabel: meteoMoment ? meteoMoment.label : null,
      });
      setPlans((l) => [...l.filter((x) => x.id !== ligne.id), ligne]);
      setVue("liste");
      setOnglet("up");
      flash("Ajoutée à tes tenues planifiées");
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
      flash("Tenue retirée");
    } catch {
      // Remise en place : la ligne est toujours en base, la masquer mentirait.
      setPlans(avant);
      flash("La suppression a échoué. Réessaie.");
    }
  };

  const recommencer = () => {
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

  const revenir = () => {
    if (vue === "liste") setVue("intro");
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
    3: ["Étape 3 sur 3", "Où", "seras-tu ?", "La ville donne la météo prévue sur place."],
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
          <FilEtapes total={3} courante={etape - 1} />
        </div>
      )}

      <div ref={zoneScroll} className="scrollarea flex-1 min-h-0 overflow-y-auto px-6 pt-4 pb-5">
        {vue === "intro" && (
          <>
            <Surtitre>Planifier</Surtitre>
            <TitreEtape a="Le bon look," b="au bon moment" />
            {/* Visuel dédié (24/09/2026, fourni) — il remplace l'emprunt à
                l'état vide du Dressing. Le ratio du conteneur suit celui de
                l'image (1,433) plutôt que l'inverse : en gardant 1,5 avec un
                objectFit cover, on rognait 5 % de la hauteur, donc le carnet
                « Mes tenues » qui est le sujet. */}
            <div className="mt-4 rounded-[24px] overflow-hidden bg-warm-bg" style={{ aspectRatio: "1.433" }}>
              {/* <img> et non next/image : l'export statique (output: "export",
                  nécessaire à l'empaquetage Capacitor) n'embarque pas
                  l'optimiseur d'images. Même convention que l'accueil et le
                  dressing. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/editorial/capsela_planifier_intro.webp"
                alt="Un carnet « Mes tenues » posé sur une coiffeuse, devant un miroir et un portant"
                width={874}
                height={610}
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
                    <div className="text-[13px] font-medium text-ink">{t}</div>
                    <div className="text-[12px] text-muted leading-[1.45] mt-[2px]">{s}</div>
                  </div>
                </div>
              ))}
            </div>
            {plans.length > 0 && (
              <button
                onClick={() => {
                  setVue("liste");
                  setOnglet("up");
                }}
                className="w-full flex items-center gap-3 mt-5 bg-card border border-border rounded-[20px] px-[15px] py-[13px] cursor-pointer text-left"
              >
                <span className="flex-1 text-[13px] font-medium text-ink">Mes tenues planifiées</span>
                <span className="text-[11px] text-terracotta bg-warm-bg rounded-full px-[9px] py-[4px]">{plans.length}</span>
              </button>
            )}

            {/* LE PAVÉ EXPLICATIF EST RETIRÉ (recette 24/09/2026). Il annonçait
                deux choses. La première — « la météo du jour J est celle prévue
                sur place » — est une mécanique interne : elle se constate à
                l'étape 3, où la phrase météo nomme la ville, l'amplitude et la
                limite de la prévision. La seconde — « rien n'est conservé pour
                l'instant » — était devenue FAUSSE au lot 3 : `planned_outfits`
                existe, « Garder cette tenue » écrit dedans, et la liste « Mes
                tenues planifiées » la relit. Un avertissement périmé sur un
                écran d'accueil coûte plus cher que pas d'avertissement. */}
          </>
        )}

        {vue === "etape" && (
          <>
            <Surtitre>{ETAPES[etape][0]}</Surtitre>
            <TitreEtape a={ETAPES[etape][1]} b={ETAPES[etape][2]} />
            <div className="text-[12px] text-muted leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
              {ETAPES[etape][3]}
            </div>

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
                      className={actif ? "rounded-[14px] bg-warm-bg px-3 my-1" : "border-b border-[#EFE7DA] last:border-b-0"}
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
                <div className="scrollarea flex gap-[7px] overflow-x-auto mt-4 -mx-6 px-6">
                  {Array.from({ length: JOURS_PROPOSES }, (_, i) => i + 1).map((n) => {
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
                          "flex-shrink-0 w-[54px] rounded-[16px] py-[7px] cursor-pointer border transition-colors " +
                          (on ? "bg-terracotta-deep border-terracotta-deep" : "bg-card border-border")
                        }
                        style={{ minHeight: 66 }}
                      >
                        <span className={"block text-[9px] tracking-[.08em] uppercase " + (on ? "text-cream" : "text-muted")}>
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
                    if (n !== HORIZON_PREVISION_JOURS) return bouton;
                    return (
                      <div key={n} className="flex-shrink-0 flex gap-[7px]">
                        {bouton}
                        <span
                          aria-hidden="true"
                          className="flex-shrink-0 self-stretch"
                          style={{ width: 1, background: "var(--color-sand-border)" }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="text-[11px] text-muted leading-[1.45] mt-[9px]" style={{ textWrap: "pretty" }}>
                  {jour != null && jour > HORIZON_PREVISION_JOURS
                    ? `La prévision météo ne va pas jusque-là : elle couvre ${HORIZON_PREVISION_JOURS} jours. La tenue sera composée sur la saison, sans météo du jour J.`
                    : `La prévision météo couvre les ${HORIZON_PREVISION_JOURS} prochains jours. Au-delà du filet, la tenue se compose sur la saison seule.`}
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
                </div>
                {/* Les suggestions ne s'affichent QUE si l'autocomplétion a
                    répondu quelque chose. `null` (mode démo, réseau, fonction
                    Edge pas encore redéployée) ne montre rien du tout : la
                    saisie libre reste entièrement valable, elle est seulement
                    moins précise. Rien n'est jamais bloqué par l'absence de
                    suggestion. */}
                {suggestionsVisibles.length > 0 && (
                  <div className="flex flex-col mt-2 bg-card border border-border rounded-[14px] overflow-hidden">
                    {suggestionsVisibles.map((v) => (
                      <button
                        key={`${v.lat},${v.lon}`}
                        onClick={() => {
                          setVille(v);
                          setLieu(libelleVille(v));
                          setSuggestions([]);
                        }}
                        className="flex items-center gap-[10px] text-left px-[14px] cursor-pointer border-b border-[#EFE7DA] last:border-b-0"
                        style={{ minHeight: 46 }}
                      >
                        <span aria-hidden="true" className="flex-shrink-0 text-muted">
                          <Glyphe taille={15}>{G_EPINGLE}</Glyphe>
                        </span>
                        <span className="flex-1 min-w-0 text-[13px] text-ink truncate">{libelleVille(v)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {ville && (
                  <div className="text-[11px] text-muted mt-2">
                    Météo demandée pour {ville.name}, à ses coordonnées exactes.
                  </div>
                )}
                {/* Le type de lieu ne s'affiche que pour les occasions où il
                    veut dire quelque chose (cf. TYPES_LIEU_PAR_OCCASION).
                    Pour les autres, l'étape se réduit à la ville — ce qui est
                    exactement ce qu'elle a à demander. */}
                {typesLieuProposes.length > 0 && (
                  <>
                    <div className="mt-5">
                      <Surtitre>Type de lieu · facultatif</Surtitre>
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
            {/* 9,5 px / .1em : la forme des deux autres pastilles terracotta de
                l'app (accueil, Valise). Le 10 px d'ici était un troisième
                réglage pour le même objet. */}
            <span className="inline-block text-[9px] tracking-[.1em] uppercase text-terracotta bg-warm-bg rounded-full px-[10px] py-[4px]">
              {occLong}
            </span>
            <TitreEtape a={occLabel} b={lieu.trim() ? `· ${lieu.trim()}` : ""} />
            <div className="text-[12px] text-muted mt-[6px]">
              {dateLongue.charAt(0).toUpperCase() + dateLongue.slice(1)}
              {moment ? ` · ${moment}` : ""}
              {typeLieu ? ` · ${typeLieu}` : ""}
            </div>

            {tenue.noCompleteOutfit ? (
              <div className="mt-[14px] bg-card border border-border rounded-[20px] p-[15px]">
                <div className="font-serif text-[18px] text-ink">
                  {emptyStateCopy(tenue.reason ?? "no_match", dressingSeul ? "ton dressing" : "ton dressing et ta capsule").title}
                </div>
                <div className="text-[12px] text-muted-3 leading-[1.5] mt-2">
                  {emptyStateCopy(tenue.reason ?? "no_match", dressingSeul ? "ton dressing" : "ton dressing et ta capsule").body}
                </div>
              </div>
            ) : (
              <>
                <div className="mt-[14px] rounded-[24px] p-4" style={{ background: "var(--color-terracotta-deep)" }}>
                  <div className="flex items-center justify-between gap-[10px]">
                    <span className="text-[10px] tracking-[.14em] uppercase text-cream">Tenue préparée</span>
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
                        <span className="text-[12px] text-muted-3 leading-[1.45]">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* L'ANCIENNE ÉTAPE 4, DEVENUE UN RÉGLAGE. Ici il a un effet
                    immédiat et visible : le pool change, `tenue` se recalcule,
                    la composition au-dessus se refait. Posé avant la
                    génération, il demandait de deviner ce qu'on préférerait
                    sans avoir rien vu. */}
                <button
                  onClick={() => setDressingSeul(!dressingSeul)}
                  aria-pressed={dressingSeul}
                  className="w-full flex gap-3 items-center mt-[14px] bg-card border border-border rounded-[20px] p-[14px] cursor-pointer text-left"
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

                <div className="text-[12px] text-muted leading-[1.5] mt-[14px] text-center" style={{ textWrap: "pretty" }}>
                  Gardée, tu la retrouveras dans tes tenues planifiées jusqu&apos;au jour J.
                </div>
              </>
            )}
          </>
        )}

        {vue === "liste" && (
          <>
            <Surtitre>Planifier</Surtitre>
            <TitreEtape a="Mes tenues" b="planifiées" />

            <div className="flex gap-2 mt-4">
              {([["up", `À venir${aVenir.length ? ` (${aVenir.length})` : ""}`], ["past", "Passées"]] as const).map(([cle, label]) => (
                <button
                  key={cle}
                  onClick={() => setOnglet(cle)}
                  aria-pressed={onglet === cle}
                  className={
                    "rounded-full px-4 text-[12px] cursor-pointer border transition-colors " +
                    (onglet === cle ? "bg-terracotta-deep border-terracotta-deep text-cream" : "bg-card border-border text-muted-3")
                  }
                  style={{ minHeight: 44 }}
                >
                  {label}
                </button>
              ))}
            </div>

            {listeAffichee.length === 0 ? (
              <div className="mt-4 rounded-[20px] px-5 py-[26px] text-center text-[12px] text-muted leading-[1.5]" style={{ border: "1px dashed var(--color-sand-border)" }}>
                {onglet === "up" ? "Rien de prévu pour l'instant." : "Tes tenues passées apparaîtront ici."}
              </div>
            ) : (
              <div className="flex flex-col gap-[9px] mt-4">
                {listeAffichee.map((t) => {
                  const d = new Date(`${t.jour}T12:00:00`);
                  return (
                    <div key={t.id} className="flex gap-3 items-center bg-card border border-border rounded-[20px] p-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] tracking-[.14em] uppercase text-terracotta">
                          {DOW[d.getDay()]}. {d.getDate()} {MOIS[d.getMonth()]}
                        </div>
                        <div className="font-serif text-[15px] text-ink mt-[3px]">{occasionShortLabel(t.occasion)}</div>
                        <div className="text-[11px] text-muted mt-[2px]">
                          {t.lieu} · {t.moment}
                          {/* La prévision telle qu'elle était AU MOMENT DE
                              PLANIFIER, jamais présentée comme celle du jour
                              J : elle aura changé d'ici là. */}
                          {t.temp != null && ` · ${t.temp}° prévus`}
                        </div>
                      </div>
                      <button
                        onClick={() => retirer(t.id)}
                        aria-label={`Retirer la tenue du ${d.getDate()} ${MOIS[d.getMonth()]}`}
                        className="w-11 h-11 flex-shrink-0 flex items-center justify-center cursor-pointer text-placeholder"
                      >
                        <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
                          <path d="M5 7h14M10 7V5h4v2M7 7l1 12.5h8L17 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="relative flex-shrink-0 px-6 pt-[10px] pb-[18px] flex flex-col gap-2 border-t border-border">
        {/* Ancré à la barre d'action elle-même (bottom: 100%) et non à une
            hauteur devinée : la barre change de hauteur selon la vue — un
            bouton, ou un bouton plus deux secondaires — et un toast posé à
            une distance fixe finirait collé à l'un des deux cas. */}
        {toast && (
          <div
            className="absolute inset-x-6 z-30 pointer-events-none rounded-[15px] px-4 py-[13px] text-[12px]"
            style={{ bottom: "100%", marginBottom: 12, background: "var(--color-ink)", color: "var(--color-cream)" }}
            aria-live="polite"
          >
            {toast}
          </div>
        )}
        {vue === "intro" && (
          <button
            onClick={() => {
              setVue("etape");
              setEtape(1);
            }}
            className="w-full rounded-full bg-terracotta-deep text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer"
            style={{ minHeight: 52 }}
          >
            Commencer
          </button>
        )}
        {vue === "etape" && (
          <button
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
            className="w-full rounded-full text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer disabled:cursor-not-allowed"
            style={{
              minHeight: 52,
              background: etapeValide && !attend ? "var(--color-terracotta-deep)" : "var(--color-cream-dark-soft)",
            }}
          >
            {attend ? "Un instant…" : etape === 3 ? "Voir ma tenue" : "Suivant"}
          </button>
        )}
        {vue === "liste" && (
          <button
            onClick={recommencer}
            className="w-full rounded-full bg-terracotta-deep text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer"
            style={{ minHeight: 52 }}
          >
            + Planifier un nouvel évènement
          </button>
        )}
        {vue === "resultat" && (
          <>
            {/* « Garder cette tenue » existe désormais vraiment (lot 3). Elle
                est désactivée quand il n'y a pas de tenue à garder — un état
                vide ne se planifie pas — et pendant l'écriture, pour qu'un
                double tap ne parte pas deux fois. */}
            <button
              onClick={garder}
              disabled={enregistrement || !tenue || tenue.noCompleteOutfit}
              className="w-full rounded-full text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer disabled:cursor-not-allowed"
              style={{
                minHeight: 52,
                background: enregistrement || !tenue || tenue.noCompleteOutfit ? "var(--color-cream-dark-soft)" : "var(--color-terracotta-deep)",
              }}
            >
              {enregistrement ? "Un instant…" : "Garder cette tenue"}
            </button>
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
              <button
                onClick={() => setTirage(tirage + 1)}
                className="flex-1 rounded-full bg-card border border-terracotta text-[12px] font-medium text-terracotta cursor-pointer"
                style={{ minHeight: 44 }}
              >
                Une autre tenue
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
