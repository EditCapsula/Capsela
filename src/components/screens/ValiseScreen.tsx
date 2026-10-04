"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import FilEtapes from "@/components/FilEtapes";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { OutfitComposition } from "@/components/OutfitComposition";
import SegmentedControl from "@/components/SegmentedControl";
import TabBar from "@/components/TabBar";
import { useAuth } from "@/lib/auth";
import { resolveItemImage } from "@/lib/catalogImages";
import { OCCASIONS, occasionShortLabel } from "@/lib/data";
import { jourLocal } from "@/lib/outfitFeedback";
import { villeDuLieu } from "@/lib/planifier";
import { HORIZON_PREVISION_JOURS, previsionPour, type Prevision } from "@/lib/prevision";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { useCapsela } from "@/lib/store";
import type { CategoryKey, Item, OccasionKey } from "@/lib/types";
import {
  allegement,
  alternatives,
  amplitudePrevue,
  categoriesPourCompleter,
  BAGAGES,
  capaciteDe,
  composerValise,
  conseilMeteo,
  dateDe,
  DUREE_MAX_JOURS,
  etatJauge,
  generateurMoteur,
  GROUPES_VALISE,
  joursDuSejour,
  libelleDuree,
  looksDeLaValise,
  looksParPiece,
  nomCategorie,
  occasionsCouvertes,
  occasionsDeLaPiece,
  occasionsDuLook,
  occasionsDuSejour,
  occasionsRetenues,
  MINIMUM_PIECES_VALISE,
  pluieAnnoncee,
  pretPourUneValise,
  resumeLook,
  SEJOURS,
  situationsDuSejour,
  type LookValise,
  type MeteoJour,
  type TailleBagage,
  type TypeSejour,
  VISUEL_SEJOUR,
} from "@/lib/valise";
import { estIdLocal, nouvelIdLocal, type ValiseGardee } from "@/lib/valises";
import { fetchPrevisionByCity, fetchVilles, libelleVille, type VilleSuggeree } from "@/lib/weather";
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


type Onglet = "looks" | "pieces";

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

// ── Glyphes (grammaire de GlyphesOccasion : trait 1,5, currentColor) ────

const trait = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const svg = (children: React.ReactNode, taille = 19) => (
  <svg width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    {children}
  </svg>
);
const G_EPINGLE = svg(
  <>
    <path d="M12 21s6.5-6.1 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 14.9 12 21 12 21z" {...trait} />
    <circle cx="12" cy="10.4" r="2.3" {...trait} />
  </>,
  17
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
const G_LISTE = svg(<path d="M9 7h11M9 12h11M9 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" {...trait} strokeWidth={1.7} />, 18);
const G_COCHE = (taille = 12, couleur = "currentColor") => svg(<path d="M5 12.5l4.5 4.5L19 7.5" {...trait} stroke={couleur} strokeWidth={2.2} />, taille);
const G_CROIX = svg(<path d="M6 6l12 12M18 6L6 18" {...trait} strokeWidth={1.7} />, 14);
const G_ECHANGE = svg(<path d="M7 7h11l-3-3M17 17H6l3 3" {...trait} />, 15);
const G_PLUS = svg(<path d="M12 5v14M5 12h14" {...trait} strokeWidth={1.7} />, 15);
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

function TitreEtape({ a, b }: { a: string; b: string }) {
  return (
    <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
      {a} <span className="italic text-terracotta">{b}</span>
    </div>
  );
}

function Puce({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={actif}
      className={
        "rounded-full px-[14px] text-[12px] cursor-pointer border transition-colors " +
        (actif ? "bg-terracotta-deep border-terracotta-deep text-cream" : "bg-card border-border text-ink")
      }
      style={{ minHeight: 40 }}
    >
      {children}
    </button>
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

type Vue = { nom: "etape" } | { nom: "calcul" } | { nom: "resultat" } | { nom: "look"; index: number } | { nom: "piece"; id: number; depuis: Vue };

const ETAPES_CALCUL: [React.ReactNode, string][] = [
  [svg(<path d="M7 18.5h9.5a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.4 1.6A3.2 3.2 0 0 0 7 18.5z" {...trait} />, 18), "Analyse de la météo"],
  [G_LISTE, "Prise en compte de ton programme"],
  [G_CINTRE, "Sélection dans ton dressing"],
  [G_ETINCELLE, "Optimisation des looks et des pièces"],
];

export default function ValiseScreen() {
  const { state, weather, defaultCapsule, actions } = useCapsela();
  const { profile } = useAuth();
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
  const [destination, setDestination] = useState("");
  const [ville, setVille] = useState<VilleSuggeree | null>(null);
  const [suggestions, setSuggestions] = useState<VilleSuggeree[] | null>(null);
  const [depart, setDepart] = useState("");
  const [retour, setRetour] = useState("");
  const [bagage, setBagage] = useState<TailleBagage | null>(null);
  const [sejour, setSejour] = useState<TypeSejour | null>(null);
  const [occasions, setOccasions] = useState<OccasionKey[]>([]);
  // Les occasions suivent le séjour tant qu'on n'y a pas touché.
  const [occasionsTouchees, setOccasionsTouchees] = useState(false);

  const villeChoisieAffichee = ville != null && libelleVille(ville) === destination;
  useEffect(() => {
    if (vue.nom !== "etape" || etape !== 1) return;
    const q = destination.trim();
    if (q.length < 2 || villeChoisieAffichee) return;
    let annule = false;
    const t = setTimeout(() => {
      fetchVilles(q)
        .then((v) => !annule && setSuggestions(v))
        .catch(() => !annule && setSuggestions(null));
    }, 280);
    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [destination, etape, vue.nom, villeChoisieAffichee]);
  const suggestionsVisibles = destination.trim().length < 2 || villeChoisieAffichee ? [] : (suggestions ?? []);

  /** Villes de tes tenues planifiées : des lieux que tu as réellement donnés (aucun « favori » n'existe). */
  const villesConnues = useMemo(
    () => [...new Set(state.tenuesPlanifiees.map((t) => villeDuLieu(t.lieu)).filter(Boolean))].slice(0, 4),
    [state.tenuesPlanifiees]
  );

  const jours = depart && retour && retour >= depart ? joursDuSejour(depart, retour) : [];
  const dureeOk = jours.length > 0 && dateDe(retour) <= dateDe(plusJours(depart, DUREE_MAX_JOURS - 1));
  const nomVille = ville ? ville.name : villeDuLieu(destination.trim());

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
      fetchPrevisionByCity(ville ? ville.name : destination.trim(), ville)
        .catch(() => null)
        .then((p) => !annule && setPrevision({ cle: clePrevision, p }));
    }, 600);
    return () => {
      annule = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clePrevision]);

  const meteosDe = (p: Prevision | null, js: string[] = jours): MeteoJour[] =>
    js.map((j) => {
      const m = p ? previsionPour(p, j, "Toute la journée") : null;
      return m ? { jour: j, temp: m.temp, label: m.label, prevue: true } : { jour: j, temp: weather.temp, label: weather.label, prevue: false };
    });
  const meteosEtape1 = prevision && prevision.cle === clePrevision ? meteosDe(prevision.p) : null;
  const amplitudeEtape1 = meteosEtape1 ? amplitudePrevue(meteosEtape1) : null;

  const etapeValide =
    etape === 1 ? destination.trim().length > 1 && depart >= aujourdhui && dureeOk : etape === 2 ? bagage != null : etape === 3 ? sejour != null : true;

  const zoneScroll = useRef<HTMLDivElement | null>(null);
  const [onglet, setOnglet] = useState<Onglet>("looks");
  const cleVue = vue.nom === "look" ? `look${vue.index}` : vue.nom === "piece" ? `piece${vue.id}` : vue.nom;
  useEffect(() => {
    zoneScroll.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [etape, cleVue, onglet]);

  const choisirSejour = (t: TypeSejour) => {
    setSejour(t);
    if (!occasionsTouchees) setOccasions(occasionsDuSejour(t));
  };

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
    depart: string;
    retour: string;
    bagage: TailleBagage;
    sejour: TypeSejour | null;
    occasions: OccasionKey[];
  };
  const lancer = async (rep: Reponses, idCible: string | null) => {
    const joursRep = joursDuSejour(rep.depart, rep.retour);
    const cle = rep.ville ? `${rep.ville.lat},${rep.ville.lon}` : villeDuLieu(rep.destination).toLowerCase();
    setFaites(0);
    setVue({ nom: "calcul" });
    const [p] = await Promise.all([
      prevision && prevision.cle === cle ? prevision.p : fetchPrevisionByCity(rep.ville ? rep.ville.name : rep.destination.trim(), rep.ville).catch(() => null),
      pause(450),
    ]);
    const meteos = meteosDe(p, joursRep);
    if (!actif.current) return;
    setFaites(1);
    const situations = situationsDuSejour(rep.occasions, meteos);
    await pause(380);
    if (!actif.current) return;
    setFaites(2);
    await pause(30);
    const r = composerValise(dressing, situations, capaciteDe(rep.bagage), generer);
    await pause(380);
    if (!actif.current) return;
    setFaites(3);
    await pause(380);
    if (!actif.current) return;
    setFaites(4);
    await pause(260);
    if (!actif.current) return;
    const id = idCible ?? nouvelIdLocal();
    sauver({
      version: 2,
      id,
      destination: rep.ville ? rep.ville.name : villeDuLieu(rep.destination.trim()),
      depart: rep.depart,
      retour: rep.retour,
      bagage: rep.bagage,
      sejour: rep.sejour,
      occasions: rep.occasions,
      meteos,
      situations,
      ...r,
      // Les pièces du dressing au moment du calcul : une pièce ajoutée
      // ensuite se reconnaît, et l'écran propose de recomposer.
      dressingIds: dressing.map((i) => i.id),
    });
    actions.afficherValise(id);
    setIdEnModification(null);
    setOnglet("looks");
    setVue({ nom: "resultat" });
  };
  const preparer = (passer: boolean) => {
    if (!bagage) return;
    void lancer({ destination, ville, depart, retour, bagage, sejour, occasions: occasionsRetenues(passer ? [] : occasions, sejour) }, idEnModification);
  };
  /** Recomposer la valise affichée avec le dressing d'aujourd'hui (des pièces y ont été ajoutées) : mêmes réponses, même valise. */
  const recomposer = () => {
    if (!valise) return;
    void lancer(
      { destination: valise.destination, ville: null, depart: valise.depart, retour: valise.retour, bagage: valise.bagage, sejour: valise.sejour, occasions: valise.occasions },
      valise.id
    );
  };

  /** Nouvelles pièces : les looks sont recomptés par le moteur. */
  const avecPieces = (v: ValiseGardee, ids: number[]): ValiseGardee => ({ ...v, ...looksDeLaValise(ids, dressing, v.situations, generer, v.looks) });
  const retirer = (ids: number[]) => valise && sauver(avecPieces(valise, valise.pieceIds.filter((x) => !ids.includes(x))));
  const ajouter = (id: number) => valise && sauver(avecPieces(valise, [...valise.pieceIds, id]));
  const remplacer = (ancien: number, nouveau: number) => valise && sauver(avecPieces(valise, [...valise.pieceIds.filter((x) => x !== ancien), nouveau]));

  /** « Nouvelle valise » : la précédente reste dans « Mes planifications ». */
  const recommencer = () => {
    actions.afficherValise(null);
    setIdEnModification(null);
    setDestination("");
    setVille(null);
    setDepart("");
    setRetour("");
    setBagage(null);
    setSejour(null);
    setOccasions([]);
    setOccasionsTouchees(false);
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
    setDestination(valise.destination);
    setVille(null);
    setDepart(valise.depart);
    setRetour(valise.retour);
    setBagage(valise.bagage);
    setSejour(valise.sejour);
    setOccasions(valise.occasions);
    setOccasionsTouchees(true);
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

  const presel = occasionsDuSejour(sejour);
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
          <FilEtapes total={4} courante={etape - 1} />
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
            <Surtitre>Ta valise · 1 / 4</Surtitre>
            <TitreEtape a="Où" b="pars-tu ?" />
            <Card rayon="pilule" className="flex items-center gap-[10px] mt-4 px-[16px]" style={{ minHeight: 50 }}>
              <span className="flex-shrink-0 text-placeholder">{G_EPINGLE}</span>
              <input
                className="capin flex-1 min-w-0 bg-transparent border-none text-[13px] font-medium text-ink"
                value={destination}
                onChange={(e) => {
                  setDestination(e.target.value);
                  setVille(null);
                }}
                placeholder="Rechercher une ville"
                aria-label="Destination"
                autoComplete="off"
                autoCapitalize="words"
              />
            </Card>
            {suggestionsVisibles.length > 0 && (
              <Card rayon="tuile" className="flex flex-col mt-2 overflow-hidden">
                {suggestionsVisibles.map((v) => (
                  <button
                    key={`${v.lat},${v.lon}`}
                    onClick={() => {
                      setVille(v);
                      setDestination(libelleVille(v));
                    }}
                    className="text-left px-[16px] py-[12px] text-[13px] text-ink border-b border-border last:border-b-0 cursor-pointer"
                  >
                    {libelleVille(v)}
                  </button>
                ))}
              </Card>
            )}
            {villesConnues.length > 0 && (
              <>
                <div className="mt-6">
                  <Surtitre>Tes lieux planifiés</Surtitre>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {villesConnues.map((v) => (
                    <Puce
                      key={v}
                      actif={destination === v}
                      onClick={() => {
                        setDestination(v);
                        setVille(null);
                      }}
                    >
                      {v}
                    </Puce>
                  ))}
                </div>
              </>
            )}
            <div className="mt-6">
              <Surtitre>Tes dates</Surtitre>
            </div>
            <div className="grid grid-cols-2 gap-[10px] mt-3">
              {([
                [
                  "Départ",
                  depart,
                  aujourdhui,
                  undefined,
                  (v: string) => {
                    setDepart(v);
                    if (retour && retour < v) setRetour(v);
                  },
                ],
                ["Retour", retour, depart || aujourdhui, depart ? plusJours(depart, DUREE_MAX_JOURS - 1) : undefined, setRetour],
              ] as const).map(([titre, valeur, min, max, changer]) => (
                <Card as="label" key={titre} className="flex items-center gap-[9px] px-[12px] py-[10px] cursor-pointer min-w-0">
                  <span className="flex-shrink-0 text-muted-3">{G_CALENDRIER}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[11px] text-muted">{titre}</span>
                    <input
                      type="date"
                      value={valeur}
                      min={min}
                      max={max}
                      onChange={(e) => changer(e.target.value)}
                      aria-label={`Date de ${titre.toLowerCase()}`}
                      className="capin block w-full min-w-0 bg-transparent border-none font-serif text-[14px] text-ink mt-[1px] p-0"
                    />
                  </span>
                </Card>
              ))}
            </div>
            {jours.length > 0 && (
              <div className="text-[12px] text-muted mt-3">{dureeOk ? libelleDuree(jours.length) : `Un séjour de ${DUREE_MAX_JOURS} jours au plus.`}</div>
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
                </div>
              </Card>
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
            <Surtitre>Ta valise · 2 / 4</Surtitre>
            <TitreEtape a="Quelle valise" b="prends-tu ?" />
            <div className="grid grid-cols-2 gap-[10px] mt-5">
              {BAGAGES.map(([t, libelle, cap], i) => {
                const on = bagage === t;
                return (
                  <button
                    key={t}
                    onClick={() => setBagage(t)}
                    aria-pressed={on}
                    aria-label={`${t}, ${libelle}, jusqu'à ${cap} pièces`}
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
                    <span className="block text-[13px] text-ink leading-[1.25]">{libelle}</span>
                    <span className="block text-[11px] text-muted mt-[2px]">jusqu&apos;à {cap} pièces</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[12px] text-muted leading-[1.5] mt-4">
              Chaussures, sacs et accessoires compris.
              <br />
              La capacité ne dépend que de la taille de la valise.
            </div>
          </>
        )}

        {/* ── 3. TYPE DE SÉJOUR ── */}
        {questions && etape === 3 && (
          <>
            <Surtitre>Ta valise · 3 / 4</Surtitre>
            <TitreEtape a="Quel type" b="de séjour ?" />
            <div className="grid grid-cols-2 gap-[10px] mt-5">
              {SEJOURS.filter(([t]) => VISUEL_SEJOUR[t]).map(([t, libelle]) => {
                const on = sejour === t;
                return (
                  <button
                    key={t}
                    onClick={() => choisirSejour(t)}
                    aria-pressed={on}
                    className={"relative text-left rounded-carte overflow-hidden cursor-pointer border bg-card transition-colors " + (on ? "border-terracotta" : "border-border")}
                    style={{ borderWidth: on ? 1.5 : 1 }}
                  >
                    {/* Visuel décoratif : le libellé dessous dit le séjour. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={VISUEL_SEJOUR[t]} alt="" loading="lazy" className="block w-full object-cover" style={{ height: "clamp(72px, 22vw, 92px)" }} />
                    {on && (
                      <span className="absolute top-[7px] right-[7px]">
                        <Coche />
                      </span>
                    )}
                    <span className={"block px-[11px] py-[9px] text-[12px] leading-[1.3] " + (on ? "text-terracotta-deep" : "text-ink")}>{libelle}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-[10px]">
              <button
                onClick={() => choisirSejour("autre")}
                aria-pressed={sejour === "autre"}
                className={
                  "inline-flex items-center gap-[8px] rounded-full px-[16px] text-[12px] cursor-pointer border transition-colors " +
                  (sejour === "autre" ? "bg-terracotta-deep border-terracotta-deep text-cream" : "bg-card border-border text-ink")
                }
                style={{ minHeight: 44 }}
              >
                {sejour === "autre" ? G_COCHE(13) : G_PLUS}
                Autre
              </button>
            </div>
          </>
        )}

        {/* ── 4. PROGRAMME / OCCASIONS ── */}
        {questions && etape === 4 && (
          <>
            <Surtitre>Ta valise · 4 / 4</Surtitre>
            <TitreEtape a="Qu'est-ce" b="qui est prévu ?" />
            <div className="t-chapeau text-muted-3 mt-2">Sélectionne tout ce qui pourrait arriver pendant ton séjour.</div>
            {presel.length > 0 && (
              <div className="mt-4">
                <CarteInfo glyphe={G_AMPOULE}>Capsela a déjà préparé une première sélection selon ton séjour. Tu peux la modifier.</CarteInfo>
              </div>
            )}
            <div className="grid grid-cols-2 gap-[8px] mt-4">
              {OCCASIONS.filter(([k]) => k !== "all").map(([k, libelle]) => {
                const on = occasions.includes(k);
                return (
                  <button
                    key={k}
                    onClick={() => {
                      setOccasionsTouchees(true);
                      setOccasions((l) => (l.includes(k) ? l.filter((x) => x !== k) : [...l, k]));
                    }}
                    aria-pressed={on}
                    className={
                      "flex items-center gap-[9px] text-left rounded-tuile px-[12px] cursor-pointer border transition-colors " +
                      (on ? "bg-terracotta-deep border-terracotta-deep text-cream" : "bg-card border-border text-ink")
                    }
                    style={{ minHeight: 56 }}
                  >
                    <span className={"flex-shrink-0 " + (on ? "text-cream" : "text-muted-3")}>
                      <GlypheOccasion occasion={k} taille={18} />
                    </span>
                    <span className="flex-1 min-w-0 text-[12px] leading-[1.25]">{libelle}</span>
                    {on && <span className="flex-shrink-0">{G_COCHE(12)}</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* ── 5. GÉNÉRATION ── */}
        {vue.nom === "calcul" && (
          <div className="flex flex-col justify-center" style={{ minHeight: "62vh" }} aria-live="polite">
            <div className="t-titre-ecran text-ink text-center">
              Je prépare <span className="italic text-terracotta">ta valise…</span>
            </div>
            <div className="text-[13px] text-muted leading-[1.5] mt-3 text-center max-w-[300px] mx-auto">
              Capsela compose une sélection sur mesure en fonction de ton séjour et de ton dressing.
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
            <div className="h-[3px] rounded-full mt-9 mx-auto overflow-hidden" style={{ width: "min(100%, 290px)", background: "var(--color-chip-soft-bg)" }} aria-hidden="true">
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
            remplacer={remplacer}
            enregistrerLook={actions.enregistrerIdeeLook}
            ajouterAuDressing={actions.openAddEtRevenir}
            ajouterCategorie={actions.openAddForCategory}
            capsule={defaultCapsule}
            recomposer={recomposer}
            modifier={modifier}
            recommencer={recommencer}
            supprimer={supprimer}
          />
        )}
      </div>

      {questions && (
        <div className="flex-shrink-0 px-6 pt-[10px] pb-[18px] flex flex-col gap-1 border-t border-border">
          <Button
            onClick={() => (etape < 4 ? etapeValide && setEtape(etape + 1) : preparer(false))}
            disabled={!etapeValide}
          >
            {etape < 4 ? "Continuer" : "Préparer ma valise"}
          </Button>
          {etape === 4 && (
            <button onClick={() => preparer(true)} className="text-[12px] text-terracotta cursor-pointer py-[10px]">
              Passer cette étape
            </button>
          )}
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
  remplacer,
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
  remplacer: (ancien: number, nouveau: number) => void;
  enregistrerLook: (ids: number[], occasion: OccasionKey) => void;
  ajouterAuDressing: () => void;
  ajouterCategorie: (c: CategoryKey) => void;
  capsule: Item[];
  recomposer: () => void;
  modifier: () => void;
  recommencer: () => void;
  supprimer: () => void;
}) {
  const [indexLook, setIndexLook] = useState(0);
  const [feuille, setFeuille] = useState<{ type: "ajuster" } | { type: "ajouter" } | { type: "supprimer" } | { type: "remplacer"; id: number } | null>(null);
  const [enregistres, setEnregistres] = useState<string[]>([]);
  const toucher = useRef<number | null>(null);

  const capacite = capaciteDe(valise.bagage);
  // Une pièce supprimée du dressing depuis n'est plus dans la valise.
  const pieces = valise.pieceIds.map((id) => dressing.find((i) => i.id === id)).filter((i): i is Item => !!i);
  const ids = pieces.map((p) => p.id);
  const looks = valise.looks.filter((l) => l.ids.every((id) => ids.includes(id)));
  const parPiece = looksParPiece(looks);
  const couvertes = occasionsCouvertes(looks, valise.situations);
  const depasse = etatJauge(pieces.length, capacite) === "depassee";
  const aAlleger = depasse ? allegement(ids, looks, capacite) : [];
  const amplitude = amplitudePrevue(valise.meteos);
  const nbJours = valise.meteos.length;
  const pieceDe = (id: number) => pieces.find((p) => p.id === id);
  const occasionsDemandees = [...new Set(valise.situations.map((s) => s.occasion))];
  const occasionsSansLook = occasionsDemandees.filter((o) => !couvertes.includes(o));
  /** Occasions couvertes seulement par des looks « élargis » : le dressing n'a pas de pièce déclarée pour elles. */
  const occasionsElargies = occasionsDemandees.filter((o) => {
    const siens = looks.filter((l) => occasionsDuLook(l, valise.situations).includes(o));
    return siens.length > 0 && siens.every((l) => l.elargie);
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
        dressing,
        capsule,
        valise.situations,
        valise.situations.map((_, i) => i).filter((i) => cleSansLook.split(",").includes(valise.situations[i].occasion)),
        generer
      ),
    [dressing, capsule, valise.situations, cleSansLook, generer]
  );
  const peuDeLooks = looks.length > 0 && looks.length < nbJours;
  const numero = (i: number) => String(i + 1).padStart(2, "0");

  // Les looks de chaque pièce de remplacement sont comptés par le moteur à
  // l'ouverture de la feuille — pas avant, c'est le calcul le plus coûteux.
  const idRemplacee = feuille?.type === "remplacer" ? feuille.id : null;
  const alts = useMemo(
    () => (idRemplacee != null ? alternatives(idRemplacee, valise.pieceIds, dressing, valise.situations, generer) : []),
    [idRemplacee, valise.pieceIds, valise.situations, dressing, generer]
  );

  const piecesDuLook = (l: LookValise) => l.ids.map(pieceDe).filter((i): i is Item => !!i);
  const ouvrirPiece = (id: number) => setVue({ nom: "piece", id, depuis: vue });

  const feuilles = (
    <>
      <BottomSheet title="Ajuster ma valise" open={feuille?.type === "ajuster"} onClose={() => setFeuille(null)}>
        <div className="flex flex-col gap-2">
          {(
            [
              [G_ECHANGE, "Retirer ou remplacer une pièce", "Depuis l'onglet Pièces, sur chaque pièce.", () => (setOnglet("pieces"), setVue({ nom: "resultat" }))],
              [G_PLUS, "Ajouter une pièce de ton dressing", "Les looks sont recomposés avec elle.", () => setFeuille({ type: "ajouter" })],
              [G_CALENDRIER, "Modifier le séjour", "Destination, dates, valise ou programme.", modifier],
            ] as const
          ).map(([glyphe, titre, sous, f]) => (
            <button
              key={titre}
              onClick={() => {
                if (titre !== "Ajouter une pièce de ton dressing") setFeuille(null);
                f();
              }}
              className="flex items-center gap-3 text-left bg-card border border-border rounded-tuile px-[14px] cursor-pointer"
              style={{ minHeight: 60 }}
            >
              <span className="flex-shrink-0 text-terracotta">{glyphe}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] text-ink">{titre}</span>
                <span className="block text-[11px] text-muted mt-[2px]">{sous}</span>
              </span>
            </button>
          ))}
          {/* Supprimer est une action explicite depuis le 27/09/2026 : « Nouvelle
              valise » garde la précédente dans « Mes planifications ». */}
          <button onClick={() => setFeuille({ type: "supprimer" })} className="text-[12px] text-muted cursor-pointer mt-2 py-[10px]">
            Supprimer cette valise
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

      <BottomSheet title={idRemplacee != null ? `Remplacer ${pieceDe(idRemplacee)?.name ?? "la pièce"}` : "Remplacer"} open={idRemplacee != null} onClose={() => setFeuille(null)}>
        {alts.length === 0 ? (
          <EmptyState>Aucune autre pièce de cette famille dans ton dressing.</EmptyState>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-muted leading-[1.45] mb-1">Avec chacune, la valise compterait ce nombre de looks (aujourd&apos;hui : {looks.length}).</div>
            {alts.map(({ item, looks: n }) => (
              <button
                key={item.id}
                onClick={() => {
                  if (idRemplacee != null) remplacer(idRemplacee, item.id);
                  setFeuille(null);
                  if (vue.nom === "piece") setVue(vue.depuis);
                }}
                className="flex items-center gap-3 text-left bg-card border border-border rounded-tuile p-[7px] cursor-pointer"
              >
                <Vignette it={item} taille={40} />
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-ink truncate">{item.name}</span>
                  <span className={"block text-[11px] " + (n ? "text-terracotta" : "text-muted")}>
                    {n} {n > 1 ? "looks" : "look"}
                  </span>
                </span>
              </button>
            ))}
          </div>
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
              retirer([p.id]);
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
        <div className="rounded-feuille bg-warm-bg px-[16px] py-[20px] mt-4">
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
                    Dans {n} {n > 1 ? "looks" : "look"}
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
          {enregistre ? "Enregistré dans tes looks" : "Enregistrer dans mes looks"}
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
  const pluie = pluieAnnoncee(valise.meteos);
  /** La température d'un look : seulement celle des jours PRÉVUS qu'il habille — jamais une météo de repli présentée comme une prévision. */
  const tempDuLook = (lk: LookValise) => {
    const jours = new Set(lk.situations.flatMap((i) => valise.situations[i]?.jours ?? []));
    return amplitudePrevue(valise.meteos.filter((m) => jours.has(m.jour)));
  };
  /** Le séjour est couvert : un look pour chaque occasion demandée, et de quoi varier sur la durée. C'est ce que dit le bloc de validation, rien de plus. */
  const sejourCouvert = looks.length > 0 && occasionsAManque.length === 0 && !peuDeLooks;
  const piecesRepetees = looks.length > 1 && pieces.some((p) => (parPiece.get(p.id) ?? 0) > 1);
  const aOptimiser = nouvelles === 0 && (occasionsAManque.length > 0 || peuDeLooks);
  const nbPieces = (n: number) => `${n} ${n > 1 ? "pièces" : "pièce"}`;

  return (
    <>
      {/* 1 · OÙ VAIS-JE ? La destination est le premier élément éditorial. */}
      <h1 className="font-serif uppercase text-terracotta text-[34px] leading-[1.05] tracking-[.02em] break-words" style={{ textWrap: "balance" }}>
        {valise.destination}
      </h1>
      <div className="t-surtitre text-muted mt-[6px]">{libellePeriode(valise.depart, valise.retour)}</div>

      {/* 2 · TA VALISE EST-ELLE PRÊTE ? */}
      <div className="t-titre-ecran text-ink mt-[14px] flex items-center flex-wrap gap-x-[10px]">
        <span>
          Ta valise <span className="italic text-terracotta">est prête</span>
        </span>
        <span aria-hidden="true" className="w-[26px] h-[26px] rounded-full bg-terracotta-deep text-cream flex items-center justify-center flex-shrink-0">
          {G_COCHE(14, "var(--color-cream)")}
        </span>
      </div>
      <div className="t-chapeau text-muted-3 mt-[6px]">{libelleDuree(nbJours)}</div>

      {/* La météo, compacte, et seulement celle qui est connue. */}
      <div className="flex flex-wrap gap-x-5 gap-y-[10px] mt-4 text-[12px] text-ink">
        {amplitude ? (
          <>
            <span className="inline-flex items-center gap-[9px]">
              <span className="text-terracotta">{G_METEO_PETIT}</span>
              <span className="leading-[1.25]">
                <span className="block text-[13px] font-medium">{libelleAmplitude(amplitude)}</span>
                <span className="block text-[11px] text-muted">prévus{amplitude.jours < nbJours ? ` sur ${amplitude.jours} ${amplitude.jours > 1 ? "jours" : "jour"}` : ""}</span>
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
      {amplitude?.jours !== nbJours && (
        <div className="text-[11px] text-placeholder leading-[1.45] mt-[8px]">
          {amplitude
            ? "Les autres jours, au-delà de la prévision, suivent la saison de leur date et la température d'aujourd'hui."
            : "Les looks suivent la saison du séjour et la température d'aujourd'hui."}
        </div>
      )}

      {/* 3 · EST-ELLE ADAPTÉE ? Dit seulement quand c'est vrai (voir sejourCouvert). */}
      <div className="mt-4">
        {sejourCouvert ? (
          <div className="flex items-start gap-[12px] rounded-tuile bg-success-bg border border-success px-[14px] py-[12px]" style={{ borderColor: "color-mix(in srgb, var(--color-success) 35%, transparent)" }}>
            <span aria-hidden="true" className="w-[24px] h-[24px] rounded-full bg-success text-cream flex items-center justify-center flex-shrink-0 mt-[1px]">
              {G_COCHE(13, "var(--color-cream)")}
            </span>
            <div className="min-w-0">
              <div className="text-[13px] text-ink font-medium leading-[1.35]">Ta valise couvre les besoins de ton séjour.</div>
              <div className="text-[12px] text-ink-soft leading-[1.45] mt-[2px]">Les looks ont été composés à partir de ton dressing et de la saison.</div>
            </div>
          </div>
        ) : (
          <CarteInfo glyphe={G_AMPOULE}>Une sélection pensée pour ton séjour, ta météo et ton dressing.</CarteInfo>
        )}
      </div>

      {/* LE RATIO PIÈCES → LOOKS, au centre de la fonctionnalité — compact. La capacité n'est pas un objectif à remplir : elle est dite en second. */}
      <Card rayon="tuile" className="mt-3 grid py-[14px]" style={{ gridTemplateColumns: couvertes.length ? "1fr 1fr 1fr" : "1fr 1fr" }}>
        {(
          [
            [glypheValise(18), pieces.length, pieces.length > 1 ? "pièces" : "pièce"],
            [G_CINTRE, looks.length, looks.length > 1 ? "looks" : "look"],
            ...(couvertes.length ? ([[G_ETINCELLE, couvertes.length, couvertes.length > 1 ? "occasions couvertes" : "occasion couverte"]] as const) : []),
          ] as const
        ).map(([glyphe, n, libelle], i) => (
          <div key={libelle} className="flex flex-col items-center text-center px-[6px]" style={{ borderLeft: i ? "1px solid var(--color-border)" : undefined }}>
            <span className="flex items-center gap-[7px] text-terracotta">
              {glyphe}
              <span className="font-serif text-[26px] leading-none text-ink">{n}</span>
            </span>
            <span className="text-[11px] leading-[1.25] mt-[6px] text-muted">{libelle}</span>
          </div>
        ))}
      </Card>
      <div className="flex items-center justify-between gap-3 mt-3">
        <span className="inline-flex items-center gap-[7px] text-[12px] text-ink">
          <span className="text-terracotta">{G_COCHE(14)}</span>
          Uniquement ton dressing
        </span>
        <span className={"text-[11px] " + (depasse ? "text-terracotta" : "text-muted")}>
          Valise {valise.bagage} · {depasse ? `${pieces.length - capacite} de trop` : `jusqu'à ${capacite} pièces`}
        </span>
      </div>

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

      <div className="mt-5">
        <SegmentedControl
          ariaLabel="Contenu de la valise"
          segments={[
            { key: "looks", label: `Looks · ${looks.length}` },
            { key: "pieces", label: `Pièces · ${pieces.length}` },
          ]}
          actif={onglet}
          onChange={setOnglet}
        />
      </div>

      {/* 4 · QU'EST-CE QUE JE VAIS PORTER ? Une grande carte éditoriale à la fois. */}
      {onglet === "looks" && (
        <section className="mt-6" aria-labelledby="titre-looks">
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
                    className="block w-full rounded-carte bg-warm-bg px-[12px] py-[14px] cursor-pointer"
                    style={{ height: "clamp(270px, 80vw, 340px)" }}
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

          {/* 5 · PUIS-JE L'AMÉLIORER ? « Nécessaire » (une occasion sans look) et « Optionnel » (plus de variété) sont dits comme tels. */}
          {aOptimiser && (
            <Card rayon="carte" className="mt-7 p-[16px]">
              <div className="flex items-center gap-[9px]">
                <span className="text-terracotta flex-shrink-0">{G_ETINCELLE}</span>
                <h2 className="t-titre-carte text-ink">Optimise ta valise</h2>
              </div>
              <div className="text-[12px] text-muted-3 leading-[1.5] mt-[6px]">
                {occasionsAManque.length > 0
                  ? "Capsela a repéré ce qui compléterait tes looks pour tout ton séjour."
                  : "Capsela a repéré quelques pièces qui pourraient enrichir tes looks et t'offrir plus de variété."}
              </div>
              <div className="flex flex-col gap-4 mt-4">
                {occasionsAManque.map((o) => {
                  const m = manques.find((x) => x.occasion === o);
                  const elargie = occasionsElargies.includes(o);
                  return (
                    <div key={o}>
                      <div className="t-label text-terracotta">Nécessaire</div>
                      <div className="text-[12px] text-ink leading-[1.45] mt-[3px]">
                        {elargie ? `Tes looks ${occasionShortLabel(o)} empruntent des pièces pensées pour d'autres occasions` : `Pas encore de look ${occasionShortLabel(o)}`}
                        {m?.capacite && !elargie ? " : ta valise manque de place pour lui." : m?.categories.length ? " : il te manque" : "."}
                      </div>
                      {m && m.categories.length > 0 && (
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
                      {looks.length} {looks.length > 1 ? "looks" : "look"} pour {nbJours} jours : quelques pièces de plus varieraient tes tenues.
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Ajouter une pièce : les deux parcours existants, dits comme tels. */}
          <Card rayon="carte" className="mt-4 p-[16px]">
            <div className="flex items-center gap-[9px]">
              <span className="text-terracotta flex-shrink-0">{G_PLUS}</span>
              <h2 className="t-titre-carte text-ink">Ajouter une pièce</h2>
            </div>
            <div className="text-[12px] text-muted-3 leading-[1.5] mt-[6px]">Ajoute une pièce depuis ton dressing ou en scannant une nouvelle pièce.</div>
            <div className="flex flex-col min-[400px]:flex-row gap-2 mt-3">
              <Button variante="secondaire" pleine={false} className="flex-1 bg-card" onClick={() => setFeuille({ type: "ajouter" })}>
                Depuis mon dressing
              </Button>
              <Button variante="secondaire" pleine={false} className="flex-1 bg-card" onClick={ajouterAuDressing}>
                Ajouter une nouvelle pièce
              </Button>
            </div>
          </Card>
        </section>
      )}

      {/* ── PIÈCES ── regroupées, chacune justifiée par ses looks */}
      {onglet === "pieces" && (
        <>
          {aAlleger.length > 0 && (
            <Card className="mt-4 p-[14px]">
              <div className="t-titre-carte text-ink">On allège un peu ?</div>
              <div className="text-[12px] text-muted-3 leading-[1.45] mt-[4px]">
                {pieces.length - capacite} {pieces.length - capacite > 1 ? "pièces de trop" : "pièce de trop"} pour une valise {valise.bagage}. Voici celles qui servent
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
              <Button variante="principal" className="mt-3" onClick={() => retirer(aAlleger.map((a) => a.id))}>
                Optimiser
              </Button>
            </Card>
          )}
          {GROUPES_VALISE.map(([titre, cats]) => {
            const duGroupe = pieces.filter((p) => cats.includes(p.cat));
            if (!duGroupe.length) return null;
            return (
              <section key={titre} className="mt-5">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-serif text-[16px] text-ink">{titre}</h3>
                  <span className="text-[12px] text-muted">{duGroupe.length}</span>
                </div>
                <div className="flex flex-col gap-2 mt-2">
                  {duGroupe.map((p) => {
                    const n = parPiece.get(p.id) ?? 0;
                    return (
                      <Card key={p.id} rayon="tuile" className="flex items-center pr-[2px]">
                        <button onClick={() => ouvrirPiece(p.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left p-[7px] cursor-pointer" aria-label={`${p.name}, dans ${n} ${n > 1 ? "looks" : "look"}. Voir la pièce`}>
                          <Vignette it={p} />
                          <span className="flex-1 min-w-0">
                            <span className="block text-[13px] text-ink truncate">{p.name}</span>
                            <span className={"block text-[11px] mt-[2px] " + (n ? "text-terracotta" : "text-muted")}>
                              {n ? `Dans ${n} ${n > 1 ? "looks" : "look"}` : "Dans aucun look de la valise"}
                            </span>
                          </span>
                        </button>
                        <button onClick={() => setFeuille({ type: "remplacer", id: p.id })} aria-label={`Remplacer ${p.name}`} className="w-[40px] h-[44px] flex items-center justify-center flex-shrink-0 text-muted cursor-pointer">
                          {G_ECHANGE}
                        </button>
                        <button onClick={() => retirer([p.id])} aria-label={`Retirer ${p.name} de la valise`} className="w-[40px] h-[44px] flex items-center justify-center flex-shrink-0 text-muted cursor-pointer">
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
        </>
      )}

      {/* 6 · QUE PUIS-JE FAIRE MAINTENANT ? L'action dominante reste sous le pouce, posée sur la barre du bas : le défilement réserve déjà la hauteur de la barre (pb-safe-nav), le -16 px retire sa marge de confort. */}
      <div
        className="sticky z-10 -mx-6 px-6 pt-[10px] pb-[10px] mt-6 bg-cream border-t border-border"
        style={{ bottom: "-16px" }}
      >
        <Button onClick={() => setFeuille({ type: "ajuster" })}>Ajuster ma valise →</Button>
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
