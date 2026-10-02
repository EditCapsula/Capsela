"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BadgePremium from "@/components/BadgePremium";
import GateAvisStyliste from "@/components/GateAvisStyliste";
import LoadingSpinner from "@/components/LoadingSpinner";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { StatutComposition, ZoneLookDuJour } from "@/components/ZoneLookDuJour";
import { useQuotaTenues } from "@/components/QuotaTenues";
import { clePieces, jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { OCC_LABELS } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { computeDefaultCapsule, currentSeasonKey } from "@/lib/capsule";
import { estContexteMaison, qualificatifLook, tenueAUnSocle, titreLookDuJour } from "@/lib/logic";
import { useAuth } from "@/lib/auth";
import { decisionAcces, premiumRequis } from "@/lib/autorisations";
import { styleLabel } from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import { JourEtMeteo } from "@/components/JourMeteo";
import { PlansDuJour, usePlanApplique } from "@/components/PlansDuJour";
import { occasionParDefaut } from "@/lib/jourConsulte";
import type { CategoryKey, Item, SavedLook } from "@/lib/types";
import Badge from "@/components/Badge";
import Button, { BoutonDiscret } from "@/components/Button";

/**
 * Emplacement en %, légèrement pivoté — la géométrie des collages éditoriaux.
 *
 * Servait aussi aux planches de pièces réelles (StyleBoard) jusqu'au
 * 23/09/2026 : les deux cards de l'Accueil portent depuis des visuels
 * éditoriaux composés pour leur bande, et le reste du fichier a suivi.
 */
type BoardSlot = { left: number; top: number; w: number; h: number; rotate: number; z: number };
/**
 * Visuels éditoriaux génériques Capsela pour la card Journal (brief
 * 26/08/2026) — JAMAIS les photos personnelles de l'utilisatrice : le rôle de
 * ces images est d'illustrer le concept « tenues portées au quotidien »,
 * adapté uniquement au genre du profil.
 *
 * Les dimensions intrinsèques sont déclarées par fichier (relevées le
 * 21/09/2026) et non devinées : elles ne sont pas uniformes (480×600, 480×717,
 * 480×720), donc une valeur unique en aurait faussé deux sur trois.
 *
 * Ordre = priorité visuelle : la photo la plus lumineuse, à la silhouette la
 * plus lisible, vient en premier et reçoit toujours le plus grand emplacement.
 */
type EditorialPhoto = { src: string; w: number; h: number };
const JOURNAL_VISUALS: Record<"femme" | "homme", EditorialPhoto[]> = {
  femme: [
    { src: "/editorial/editcapsela-femme2-hp.jpg", w: 480, h: 720 },
    { src: "/editorial/editcapsela-femme1-hp.jpg", w: 480, h: 600 },
    { src: "/editorial/editcapsela-femme3-hp.jpg", w: 480, h: 600 },
  ],
  homme: [
    { src: "/editorial/editcapsela-homme3-hp.jpg", w: 480, h: 720 },
    { src: "/editorial/editcapsela-homme1-hp.jpg", w: 480, h: 600 },
    { src: "/editorial/editcapsela-homme2-hp.jpg", w: 480, h: 717 },
  ],
};

/**
 * Collage de photos éditoriales — repli de la card Dressing tant qu'aucune
 * pièce n'est saisie (brief 28/08/2026), et de « Ton style évolue » tant
 * qu'aucun look n'est enregistré. Même hauteur que StyleBoard, donc aucun
 * décalage au passage vide -> rempli.
 *
 * TROIS PHOTOS SÉPARÉES, et ce point ne se négocie pas. La maquette du
 * 23/09 propose à nouveau des tirages partiellement superposés, comme la V3
 * avant elle : le chevauchement a été SIGNALÉ CINQ FOIS par l'utilisatrice
 * avant d'être éliminé le 26/08/2026, quatre passes l'ayant réduit sans
 * jamais le supprimer. On ne le réintroduit pas au nom d'une direction
 * artistique.
 *
 * Géométrie vérifiée par calcul sur 320/360/390/412/430 px de large, ROTATION
 * COMPRISE — une boîte tournée déborde de sa boîte CSS : 3° sur ~55 px
 * ajoutent ~1,5 px de chaque côté, ce qui suffit à faire se toucher deux
 * photos calées au pixel près. Toute retouche de left/top/w/h/rotate doit
 * être revérifiée sur ces cinq largeurs, pas seulement à l'œil sur une seule.
 *
 * Ces images sont purement décoratives. Elles ne sont jamais comptées,
 * n'entrent ni dans wardrobePool ni dans le moteur.
 *
 * (POLAROID_SLOTS, la géométrie jumelle de l'ancienne card Journal, est
 * partie avec elle le 23/09 : le journal montre désormais les vrais looks.)
 */
const EMPTY_BOARD_SLOTS: BoardSlot[] = [
  { left: 5, top: 5, w: 43, h: 80, rotate: -3, z: 3 },
  { left: 55, top: 5, w: 40, h: 40, rotate: 4, z: 2 },
  { left: 55, top: 52, w: 40, h: 40, rotate: -2, z: 1 },
];

function EmptyDressingBoard({ visuals, height }: { visuals: EditorialPhoto[]; height: number }) {
  return (
    <div style={{ position: "relative", height }} aria-hidden="true">
      {visuals.map((photo, i) => (
        <PolaroidPhoto key={photo.src} photo={photo} slot={EMPTY_BOARD_SLOTS[i]} />
      ))}
    </div>
  );
}

function PolaroidPhoto({ photo, slot }: { photo: EditorialPhoto; slot: BoardSlot }) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      style={{
        position: "absolute",
        left: slot.left + "%",
        top: slot.top + "%",
        width: slot.w + "%",
        height: slot.h + "%",
        transform: `rotate(${slot.rotate}deg)`,
        zIndex: slot.z,
        background: "var(--color-card)",
        padding: 4,
        paddingBottom: 8,
        borderRadius: 4,
        boxSizing: "border-box",
        boxShadow: "0 3px 9px rgba(29,26,22,.12)",
      }}
    >
      {!failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photo.src}
          alt=""
          width={photo.w}
          height={photo.h}
          decoding="async"
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 2, display: "block" }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", borderRadius: 2, background: "var(--color-chip-soft-bg)" }} />
      )}
    </div>
  );
}

/**
 * Card de module de la partie basse (maquette 23/09/2026) — titre, sous-titre,
 * flèche ronde, puis la planche.
 *
 * UN SEUL BOUTON, et pas une card contenant un bouton : la maquette rend la
 * flèche ronde comme unique affordance, mais toute la surface se tape. Deux
 * éléments focalisables pour une seule destination créeraient un doublon au
 * clavier et au lecteur d'écran. La flèche est donc décorative
 * (`aria-hidden`), et `cta` porte le nom accessible du bouton entier.
 *
 * Les planches sont déjà `aria-hidden` : purement décoratives, elles
 * répètent une information que le titre et le sous-titre donnent en toutes
 * lettres.
 */
function CardModule({
  onClick,
  titre,
  sousTitre,
  cta,
  fond,
  children,
}: {
  onClick: () => void;
  titre: React.ReactNode;
  sousTitre: string;
  cta: string;
  fond: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={cta}
      className="w-full min-w-0 text-left cursor-pointer rounded-[22px] border border-border overflow-hidden box-border transition-opacity active:opacity-90"
      style={{ background: fond }}
    >
      <div className="flex items-start justify-between gap-3 px-[16px] pt-[15px]">
        <div className="min-w-0">
          <div className="t-titre-carte text-ink">{titre}</div>
          <div className="text-[11px] text-muted leading-[1.45] mt-[5px]" style={{ textWrap: "pretty" }}>
            {sousTitre}
          </div>
        </div>
        <span
          aria-hidden="true"
          className="flex items-center justify-center rounded-full bg-terracotta text-cream flex-shrink-0"
          style={{ width: 38, height: 38 }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" style={{ display: "block" }}>
            <path
              d="M5 12h13M13 6.5l5.5 5.5L13 17.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      <div className="px-[14px] pt-[10px] pb-[14px]">{children}</div>
    </button>
  );
}

/**
 * Bande éditoriale d'une card de l'Accueil — livrée le 23/09/2026, composée
 * POUR ce format plutôt que recadrée depuis une photo classique.
 *
 * LA ZONE DE SÉCURITÉ EST LES 60 % CENTRAUX, et ce n'est pas une marge de
 * confort : la bande garde 150 px de haut à toutes les largeurs, donc son
 * ratio varie de 1,61:1 à 320 px à 2,68:1 dès 480 px. Mesuré sur la vraie
 * card — part de la source réellement visible :
 *
 *     320 px -> 59,9 %    390 px -> 77,2 %    480 px et + -> 99,5 %
 *
 * Le rognage est UNIQUEMENT latéral : la hauteur se remplit toujours
 * exactement (150 = 300 / 2), donc rien n'est jamais perdu en haut ni en bas.
 * Toute image de remplacement doit porter son sujet entre x=162 et x=646 sur
 * une source de 808 px, les côtés servant de prolongement.
 *
 * `width`/`height` sont déclarés : sans eux le navigateur ne réserve pas la
 * place et la card saute quand l'image arrive.
 */
function BandeEditoriale({ src, alt }: { src: string; alt: string }) {
  return (
    <div style={{ height: 150, borderRadius: 14, overflow: "hidden", background: "var(--color-warm-bg)" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={808}
        height={300}
        loading="lazy"
        decoding="async"
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
      />
    </div>
  );
}

/**
 * Bande de looks enregistrés — la planche de « Ton style évolue ».
 *
 * AUCUN CHEVAUCHEMENT, et ce point ne se négocie pas : le recouvrement des
 * tirages a été signalé CINQ FOIS avant d'être éliminé le 26/08/2026, et la
 * maquette qui le repropose ne le remet pas en cause. Ici il est impossible
 * par construction — les tirages sont posés dans une rangée flex avec
 * gouttière, pas en absolu. La rotation reste, bornée à 2°, et la gouttière
 * de 10 px la couvre largement (2° sur une boîte de 96 px de haut ajoutent
 * ~1,7 px de chaque côté).
 *
 * Chaque tirage montre les pièces RÉELLES du look, résolues sur le même pool
 * que partout ailleurs (pièces + vestiaire) : un look enregistré pendant
 * l'exploration d'un autre style reste lisible.
 */
function FilmstripLooks({
  looks,
  resolvePool,
  height,
}: {
  looks: SavedLook[];
  resolvePool: Item[];
  height: number;
}) {
  return (
    <div className="scrollarea flex gap-[10px] overflow-x-auto" style={{ height }} aria-hidden="true">
      {looks.map((look, i) => {
        const pieces = look.pieceIds
          .map((id) => resolvePool.find((it) => it.id === id))
          .filter((it): it is Item => Boolean(it))
          .slice(0, 4);
        return (
          <div
            key={look.id}
            className="flex-none flex flex-col"
            style={{
              width: 108,
              background: "var(--color-card)",
              padding: 5,
              paddingBottom: 7,
              borderRadius: 5,
              boxSizing: "border-box",
              transform: `rotate(${i % 2 === 0 ? -1.6 : 1.6}deg)`,
              boxShadow: "0 3px 9px rgba(29,26,22,.12)",
            }}
          >
            <div className="grid grid-cols-2 gap-[3px] flex-1 min-h-0">
              {pieces.map((p) => (
                <VignetteLook key={p.id} piece={p} />
              ))}
            </div>
            <div className="text-[9px] text-muted mt-[4px] px-[2px] overflow-hidden text-ellipsis whitespace-nowrap">
              {look.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VignetteLook({ piece }: { piece: Item }) {
  const [failed, setFailed] = useState(false);
  const img = resolveItemImage(piece);
  const showImg = Boolean(img.url) && !failed;
  return (
    <div style={{ borderRadius: 3, overflow: "hidden", background: showImg ? "var(--color-photo-bg)" : piece.hex }}>
      {showImg && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img.url}
          alt=""
          decoding="async"
          loading="lazy"
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
        />
      )}
    </div>
  );
}

const GLYPHE_CALENDRIER = (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5.5" width="17" height="15" rx="2.5" />
      <path d="M3.5 10h17M8 3.5v4M16 3.5v4" />
    </g>
  </svg>
);
const GLYPHE_VALISE = (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="7.5" width="18" height="13" rx="2.5" />
      <path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M9.5 11.5v5M14.5 11.5v5" />
    </g>
  </svg>
);

/** Une des deux actions de « Prépare la suite » — glyphe propre à chacune. */
function ActionSuite({ onClick, label, glyphe }: { onClick: () => void; label: string; glyphe: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="min-w-0 text-left bg-card border border-border rounded-[14px] px-[12px] py-[11px] cursor-pointer flex flex-col justify-between transition-opacity active:opacity-80"
      style={{ minHeight: 68 }}
    >
      <span className="text-terracotta">{glyphe}</span>
      <span className="text-[12px] text-ink leading-[1.3] mt-[9px]">{label}</span>
    </button>
  );
}

export default function HomeScreen() {
  const { state, geoLoading, vestiairePool, weather, meteoDuJour, jourConsulte, etatPremium, actions } = useCapsela();
  // Navigation par date (27/09/2026) : la tenue et sa météo sont celles du jour consulté.
  const meteoEnAttente = geoLoading || jourConsulte.previsionEnChargement;
  const jourAVenir = jourConsulte.decalage > 0;
  const planApplique = usePlanApplique();

  /**
   * « PAS POUR MOI » PROPOSE UNE AUTRE TENUE (recette du 26/09/2026) — et
   * c'est un avis : le refus est enregistré (outfit_feedback), puis la
   * tenue suivante l'évite (regenOutfit). Le tirage compte comme une
   * alternative du quota gratuit, exactement comme « Autre tenue »
   * (arbitrage de la propriétaire) : même quota, même Gate (QuotaTenues).
   */
  const quota = useQuotaTenues();
  const [cleRefusee, setCleRefusee] = useState<string | null>(null);
  const cleCourante = clePieces(state.outfit).join(",");
  const autreProposee = cleRefusee !== null && cleRefusee !== cleCourante;
  const pasPourMoi = () => {
    setCleRefusee(cleCourante);
    actions.setOutfitFeedback("pas_aujourdhui");
    quota.demander(actions.regenOutfit);
  };

  /**
   * AVIS DE STYLISTE — accès (docs/avis-de-styliste.md sections 4 et 5,
   * arbitrages du 25/09/2026). Règle unique AVIS_DE_STYLISTE (autorisations.ts).
   * En phase de test (26/09/2026), ACCES_LIBRE : la carte ouvre l'écran, sans
   * badge ni Gate. Sous PREMIUM_REQUIRED : Premium confirmé → écran ; gratuit,
   * expiré, démo → Premium Gate. Un statut encore inconnu n'est jamais pris
   * pour du Premium : la carte passe en vérification, le statut est relu, et
   * seul un Premium confirmé ouvre l'écran — sinon, le Gate.
   *
   * Le Gate est une feuille posée sur l'écran courant : « Plus tard » la
   * referme et l'on reste exactement là où l'on était.
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

  /**
   * PRÉPARER UNE VALISE (27/09/2026, docs/valise.md) — la décision d'accès
   * (règle PREPARER_VALISE) vit dans le store (`ouvrirValise`), partagée avec
   * Planifier. Depuis l'accueil : une nouvelle valise.
   */
  const ouvrirValise = () => void actions.ouvrirValise(null);

  /**
   * L'avis du jour vient désormais du store, donc de la base (0029), et non
   * plus d'un useState local qui disparaissait au rechargement.
   *
   * Le verdict n'est affiché que si une ligne correspond aux pièces AFFICHÉES
   * — pas seulement à la date. Une tenue régénérée dans la journée repart donc
   * sans avis, ce qui est juste : l'avis portait sur l'autre tenue.
   *
   * « pas_pour_moi » de l'ancienne version locale n'existe pas côté base : la
   * contrainte CHECK dit « pas_aujourdhui ». C'est ce vocabulaire qui est
   * repris ici, pour qu'il n'y ait pas deux noms pour un même verdict.
   */
  const avisDuJour = useMemo(() => {
    const jour = jourLocal();
    return (
      state.outfitFeedbackDuJour.find((a) => a.jour === jour && memeTenue(a.pieceIds, state.outfit))?.verdict ?? null
    );
  }, [state.outfitFeedbackDuJour, state.outfit]);
  const { profile } = useAuth();
  const firstNameOrYou = profile.displayName || "toi";

  // Lecture seule des données déjà disponibles ailleurs dans l'app
  // (météo/localisation, occasion auto-sélectionnée, tenue déjà déterminée) —
  // jamais de génération de tenue ni d'appel image depuis cet écran.
  // Pool de résolution stable : wardrobePool ne contient, par catégorie, que
  // les pièces réelles ou les suggestions de la capsule du profil courant,
  // alors que state.outfit peut venir d'un style exploré ou d'une entrée
  // d'historique rejouée.
  const resolvePool = [...state.items, ...vestiairePool];
  const piecesResolues = state.outfit
    .map((id) => resolvePool.find((i) => i.id === id))
    .filter((it): it is Item => Boolean(it));
  // « Ta tenue est prête » exige un SOCLE résolu — haut + bas, ou robe
  // (recette du 26/09/2026) : une tenue réduite à un sac, parce que ses
  // autres pièces ne se résolvaient plus, s'affichait comme prête. Le store
  // la recompose (réparation) ; d'ici là, la card n'annonce rien de faux.
  const hasOutfit = piecesResolues.length > 0 && tenueAUnSocle(piecesResolues);
  const occasionKey =
    state.occasion && state.occasion !== "all" ? state.occasion : occasionParDefaut(profile.prefs, jourConsulte.date);
  const occasionLabel = OCC_LABELS[occasionKey];

  const outfitPieces = hasOutfit ? piecesResolues : [];

  // Le qualificatif sous le titre (qualificatifLook) : celui de la météo, sans
  // jamais présenter comme une option une veste que la tenue contient. Aucune
  // température affichée : elle est sur la ligne jour + météo, juste au-dessus.
  const qualificatif = qualificatifLook(meteoEnAttente ? null : meteoDuJour.temp, outfitPieces);

  // Capsule calculée avec le même moteur que CapsuleScreen, jamais un second
  // calcul : saison/style/effectif affichés ici correspondent toujours
  // exactement à l'écran Capsule.
  const capsuleSeason = state.capsuleSeason || currentSeasonKey();
  const capsule = computeDefaultCapsule(profile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool);
  const capsuleStyleLabel = styleLabel(profile.styles[0], profile.gender);

  /*
   * « J'ADORE » ENREGISTRE LA TENUE (recette du 26/09/2026, qui revient sur
   * l'arbitrage du 22/09) : l'avis est gardé dans `outfit_feedback` ET la
   * tenue rejoint « Mes looks », sans doublon (enregistrerTenueSiAbsente).
   */
  /**
   * AUCUNE TENUE POSSIBLE — et non « pas encore de tenue ».
   *
   * `state.outfit` est vide dans DEUX situations très différentes : pendant
   * le chargement, avant que l'effet d'amorçage ait tourné, et après une
   * génération qui n'a rien produit. Afficher « ajoute des pièces » dans le
   * premier cas accuserait un dressing que personne n'a encore lu.
   *
   * `outfitNoCompleteOutfit` n'est posé que par generateOutfitWithFallback,
   * donc après une tentative réelle : c'est le seul signal qui distingue les
   * deux. Le vide seul n'en est pas un.
   */
  const aucuneTenuePossible = !hasOutfit && state.outfitNoCompleteOutfit;

  /**
   * LA SILHOUETTE ATTENDUE, avant que la tenue soit composée (chargement,
   * 30/09/2026). Le moteur n'a rien choisi : on ne dessine que ce qu'on sait.
   * Un haut, un bas, des chaussures — le socle de toute tenue hors robe — et
   * un sac, sauf à la maison, où le moteur n'en met jamais (R-B14, la même
   * règle : estContexteMaison). Ni robe ni surcouche : elles dépendent des
   * pièces et de leur météo, que seul le moteur tranche. Dès que la tenue
   * existe, la silhouette prend ses catégories réelles (ZoneLookDuJour).
   */
  const categoriesAttendues: CategoryKey[] = estContexteMaison(occasionKey, state.workMode)
    ? ["haut", "pantalon", "chaussures"]
    : ["haut", "pantalon", "chaussures", "sac"];

  const dressingCount = state.items.length;
  const dressingVide = dressingCount === 0;

  const journalGender: "femme" | "homme" = profile.gender === "homme" ? "homme" : "femme";
  const journalVisuals = JOURNAL_VISUALS[journalGender];

  /**
   * Les trois résumés chiffrés de la partie basse — TOUS lus des données
   * réelles déjà en mémoire (aucune requête ajoutée : `savedLooks` est chargé
   * au montage du store avec les pièces et l'historique).
   *
   * Un compteur à zéro ne s'écrit jamais : « 0 look enregistré ce mois-ci »
   * est une donnée exacte et un mauvais accueil. La phrase change alors.
   */
  const resumeDressing = useMemo(() => {
    const p = `${dressingCount} ${dressingCount <= 1 ? "pièce" : "pièces"}`;
    const n = state.savedLooks.length;
    if (!n) return `${p} dans ton vestiaire.`;
    return `${p} · ${n} ${n <= 1 ? "look prêt à porter" : "looks prêts à porter"}`;
  }, [dressingCount, state.savedLooks.length]);

  /** Les looks du MOIS EN COURS, bornes locales — jamais un décalage UTC en début ou fin de mois. */
  const looksDuMois = useMemo(() => {
    const now = new Date();
    const debut = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return state.savedLooks.filter((l) => l.createdAt >= debut);
  }, [state.savedLooks]);

  const resumeJournal = useMemo(() => {
    const m = looksDuMois.length;
    if (m > 0) return `${m} ${m <= 1 ? "look enregistré" : "looks enregistrés"} ce mois-ci.`;
    const t = state.savedLooks.length;
    if (t > 0) return `${t} ${t <= 1 ? "look enregistré" : "looks enregistrés"} en tout.`;
    return "Ton journal commence ici.";
  }, [looksDuMois.length, state.savedLooks.length]);

  /**
   * « 0 pièce » ne s'écrit pas non plus pour la capsule. Elle n'est vide que
   * si le vestiaire n'a pas pu être chargé — rare, mais alors la phrase doit
   * rester juste sans exhiber un compteur à zéro.
   */
  const resumeCapsule = (() => {
    // Sans useMemo, délibérément : `capsule` est recalculée à chaque rendu en
    // amont, donc la mémoïser ici ne garderait rien — et le compilateur React
    // refuse de l'optimiser sur une dépendance qu'il voit mutable (erreur
    // react-hooks/preserve-manual-memoization, vue au lint). Deux
    // concaténations ne valent pas cette dette.
    const n = capsule.length;
    const style = capsuleStyleLabel ? ` ${capsuleStyleLabel}` : "";
    if (!n) return `Une sélection pensée pour ton style${style}.`;
    return `Une sélection pensée pour ton style${style} · ${n} ${n <= 1 ? "pièce" : "pièces"}.`;
  })();

  /** Les plus récents d'abord, au plus quatre : au-delà la bande se lit comme une liste. */
  const looksRecents = useMemo(
    () => [...state.savedLooks].sort((a, b) => b.createdAt - a.createdAt).slice(0, 4),
    [state.savedLooks]
  );

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-[100px]">
      <div className="px-6">
        <AppHeader />
      </div>

      {/* Salutation — présence renforcée (30 → 34 px) sans gonfler la hauteur
          de l'en-tête : le gain vient de la taille du serif, pas d'un
          interlignage ou d'une marge supplémentaires. */}
      <div className="px-6 mt-[18px]">
        <div className="t-display text-ink">
          Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
        </div>
        {/* LE JOUR ET SA MÉTÉO, SUR UNE LIGNE (27/09/2026, navigation par
            date) : le jour se change par ses chevrons, la météo ouvre
            « Localisation & météo » des Préférences — les réglages existants,
            aucun écran de plus. Composant partagé avec Tenue. Le surtitre
            « Aujourd'hui » a disparu : la ligne porte la date. */}
        <JourEtMeteo className="mt-4" />
        {/* Ce qui est planifié ce jour-là (Planifier) : un rappel qui mène à
            la fiche du plan, sous la ligne du jour. Rien sans plan. */}
        <PlansDuJour depuis="home" className="mt-3" />
      </div>

      {/* ══ Card héros « LOOK DU JOUR » — refonte du 28/09/2026 ════════════
          L'ACCUEIL MONTRE TOUT LE LOOK. La card n'en montrait qu'un extrait
          (au plus cinq pièces, sans veste ni ceinture) et renvoyait à l'écran
          Tenue pour découvrir le reste. Elle en est désormais la projection
          complète ; l'écran Tenue sert à l'approfondir.

          UNE SEULE REPRÉSENTATION POUR LES DEUX ÉCRANS : OutfitComposition,
          variante "planche" depuis le 30/09/2026 (d'abord "hero"), dans une
          zone de même proportion que sur l'écran Tenue, alimentée par la même
          tenue (state.outfit).
          Mêmes pièces, mêmes images, même ordre, par construction — aucune
          sélection propre à l'accueil.

          TROIS ÉTATS, qui ne partagent que le surtitre :
            · la tenue est là — titre éditorial, qualificatif, composition,
              occasion, « Découvrir le look », avis ;
            · le moteur n'a rien pu composer — le message et le CTA d'avant,
              qui mènent au dressing ;
            · sinon, elle se compose (profil, dressing, vestiaire ou
              localisation pas encore prêts) — une silhouette abstraite aux
              emplacements du look et « Sélection des pièces en cours », qui
              n'apparaissent qu'après 300 ms : une génération rapide ne fait
              jamais clignoter le chargement (30/09/2026, à la place de six
              cases et d'un anneau qui tournait : « on doit sentir que Capsela
              compose une silhouette, pas qu'elle charge six produits »).

          LA ZONE DE COMPOSITION EST COMMUNE AU CHARGEMENT ET AU LOOK : seul le
          texte au-dessus change d'un état à l'autre. Elle reste montée, à la
          même place et à la même hauteur ; la planche y remplace la
          silhouette en fondu (ZoneLookDuJour). */}
      <div
        className="mx-6 mt-6 bg-terracotta rounded-[24px] text-left"
        style={{ width: "calc(100% - 48px)", padding: "20px 18px 20px" }}
      >
        <div className="flex items-center gap-[7px] t-label" style={{ color: "rgba(243,238,229,.86)" }}>
          <span aria-hidden="true" className="font-serif italic text-[13px] leading-none">
            ✦
          </span>
          {/* « Ta tenue planifiée » quand la tenue affichée vient de Planifier
              (option C, 30/09/2026) : l'étiquette dit d'où elle vient. */}
          {planApplique && hasOutfit ? "Ta tenue planifiée" : "Look du jour"}
        </div>

        {aucuneTenuePossible ? (
          <>
            <div className="font-serif text-[23px] min-[380px]:text-[26px] text-cream leading-[1.16] mt-[12px]">
              On prépare ta première tenue
            </div>
            <div className="text-[13px] leading-[1.4] mt-[8px]" style={{ color: "rgba(243,238,229,.84)" }}>
              {dressingVide
                ? "Ajoute quelques pièces à ton dressing, et on compose ta tenue du jour."
                : "Ton dressing et ta capsule ne couvrent pas encore cette occasion. Quelques pièces de plus suffiront."}
            </div>
          </>
        ) : (
          <>
            {hasOutfit ? (
              // Une clé par état : sans elle, React réutilise le même <div> d'un
              // état à l'autre et l'animation, de même nom, ne se rejoue pas —
              // l'arrivée de la tenue se ferait sans fondu (mesuré en rendu).
              <div key="prete" className="motion-safe:animate-[capsule-apparition_320ms_ease-out_both]">
                <div className="font-serif text-[23px] min-[380px]:text-[26px] text-cream leading-[1.16] mt-[12px]">
                  {titreLookDuJour(occasionKey, state.workMode, state.dateContext)}
                </div>
                {qualificatif && (
                  <div className="text-[13px] leading-[1.4] mt-[8px]" style={{ color: "rgba(243,238,229,.84)" }}>
                    {qualificatif}
                  </div>
                )}
              </div>
            ) : (
              <div key="chargement" className="motion-safe:animate-[capsule-apparition_260ms_ease-out_300ms_both]" role="status">
                <div className="font-serif text-[23px] min-[380px]:text-[26px] text-cream leading-[1.16] mt-[12px]">
                  Capsela compose ta tenue…
                </div>
                <div className="text-[13px] leading-[1.4] mt-[8px]" style={{ color: "rgba(243,238,229,.84)" }}>
                  {jourAVenir
                    ? "Une silhouette pensée pour ton programme de ce jour-là."
                    : "Une silhouette pensée pour ton programme d'aujourd'hui."}
                </div>
              </div>
            )}
            {/* Toutes les pièces du look, sans exception, en PLANCHE (30/09/2026,
                brief « Refonte du hero Look du jour ») : une silhouette et non
                une grille — la pièce héro (robe, ou haut photographié porté),
                la surcouche derrière, le bas devant, chaussures et sac en
                finition (composerPlanche). Zone de hauteur FIXE à largeur
                donnée (82 % de la largeur, mesuré le 30/09 : la partie peinte
                d'une planche va de 0,78 à 0,94 fois la largeur ; l'ancienne
                mesure de grille laissait jusqu'à 60 px vides en haut et en
                bas). La planche s'y ajuste : la card ne bouge pas avec la tenue.

                SANS ANNOTATIONS (30/09/2026, demandé : « je veux que la hauteur
                reste la même ; enlève les annotations et réaugmente de 15 % ») :
                les « Ton haut », « Ta veste »… prenaient une marge autour des
                pièces ; sans elles, les pièces la reprennent, à hauteur de card
                inchangée. La planche sait toujours les dessiner (prop
                `annotations`, libelleAnnotation) si elles reviennent. */}
            <div className="mt-[12px]" style={{ aspectRatio: "100 / 82" }}>
              <ZoneLookDuJour pieces={outfitPieces} categoriesAttendues={categoriesAttendues} />
            </div>
          </>
        )}

        {/* L'OCCASION, étiquette de contexte : dans les trois états sauf
            « aucune tenue », où elle serait la raison même de l'échec.
            PLEINE OPACITÉ PENDANT LE CHARGEMENT (01/10/2026, signalé : « lorsque
            la page charge, le hero n'affiche pas le label de l'occasion »).
            Elle était posée à 72 % « pour rester secondaire », et sur le
            terracotta sa pastille translucide devenait presque invisible : elle
            est dans la page dès le premier rendu (mesuré), mais ne se lisait
            pas. Le contexte du look est la première chose qu'on veut savoir. */}
        {!aucuneTenuePossible && occasionLabel && (
          <div className="pt-[16px]">
            <span
              className="inline-flex items-center gap-[6px] uppercase whitespace-nowrap"
              style={{
                fontSize: 9.5,
                letterSpacing: ".08em",
                background: "rgba(243,238,229,.22)",
                color: "var(--color-on-terracotta)",
                borderRadius: 100,
                padding: "8px 14px",
              }}
            >
              <GlypheOccasion occasion={occasionKey} taille={13} />
              {occasionLabel}
            </span>
          </div>
        )}

        {/* LE CTA, pleine largeur, seule action pleine de la card. Pas pendant
            le chargement : il n'y a encore rien à découvrir. PAS DE CTA MORT
            (§9.3) : sans tenue possible, il mène au dressing. */}
        {/* Pendant le chargement, la ligne d'attente tient la place du CTA. */}
        {!hasOutfit && !aucuneTenuePossible && <StatutComposition />}
        {(hasOutfit || aucuneTenuePossible) && (
          <Button
            variante="claire"
            onClick={aucuneTenuePossible ? (dressingVide ? actions.openAdd : actions.goWardrobe) : actions.goTenues}
            className="mt-[12px]"
          >
            {hasOutfit ? (
              <>
                Découvrir le look <span aria-hidden="true">→</span>
              </>
            ) : dressingVide ? (
              "Ajouter mes pièces"
            ) : (
              "Voir mon dressing"
            )}
          </Button>
        )}

        {/* LA TENUE PLANIFIÉE : ce que la météo du jour en dit, s'il y a lieu,
            et le retour à la proposition de Capsela. Jamais de changement
            d'office : la tenue reste celle qu'elle a choisie. */}
        {planApplique && hasOutfit && (
          <div className="mt-[10px] text-center">
            {planApplique.alerte && (
              <div className="text-[12.5px] leading-[1.4] mb-[2px]" style={{ color: "var(--color-on-terracotta-soft)", textWrap: "pretty" }}>
                {planApplique.alerte}
              </div>
            )}
            <button
              onClick={actions.voirAutreProposition}
              className="text-[13px] underline underline-offset-[3px] cursor-pointer"
              style={{ color: "var(--color-on-terracotta)", minHeight: 44 }}
            >
              Voir une autre proposition
            </button>
          </div>
        )}

        {/* FEEDBACK — deux boutons discrets, jamais concurrents du CTA :
            translucides, sous lui, à 44 px comme toute cible tactile. Logique
            inchangée : « J'adore » range la tenue dans Mes looks, « Pas pour
            moi » en propose une autre. Pas sur la tenue d'un jour à venir. */}
        {hasOutfit && !jourAVenir && (
          <div className="mt-[12px]" aria-live="polite">
            {avisDuJour ? (
              // Cliquable : repasser le même verdict le retire. Sans ce
              // geste, un tap involontaire serait définitif pour la journée.
              <button
                onClick={() => actions.setOutfitFeedback(avisDuJour)}
                aria-label="Revenir sur mon avis"
                className="font-serif italic text-[13px] text-left cursor-pointer"
                style={{ color: "var(--color-on-terracotta-soft)", minHeight: 44 }}
              >
                {avisDuJour === "adore" ? "Ajoutée à tes looks — on garde cette direction." : "Noté, pas pour toi."}
              </button>
            ) : (
              <>
                {autreProposee && (
                  <div className="font-serif italic text-[13px] mb-[6px]" style={{ color: "var(--color-on-terracotta-soft)" }}>
                    Voici une autre proposition.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-[9px]">
                  <BoutonDiscret onClick={() => actions.setOutfitFeedback("adore")} className="whitespace-nowrap px-[6px]">
                    <span aria-hidden="true">♡</span> J&apos;adore cette tenue
                  </BoutonDiscret>
                  <BoutonDiscret onClick={pasPourMoi} disabled={quota.tirageEnCours} className="whitespace-nowrap px-[6px]">
                    <span aria-hidden="true">✕</span> Pas pour moi
                  </BoutonDiscret>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ TON DRESSING, AUTREMENT ═══════════════════════════════════
          Refonte du 23/09/2026, maquette annotée. Le hero au-dessus n'est
          PAS touché : ce bloc remplace exactement l'ancien rail
          « Explore L'édit Capsela » (deux cards en demi-largeur + Journal +
          Prépare la suite), et rien d'autre.

          La séquence voulue se lit de haut en bas : ta tenue -> ton dressing
          -> ta capsule -> ton historique -> préparer la suite. Les deux
          premières cards passent donc en PLEINE LARGEUR : à mi-largeur, leur
          planche tombait à ~150 px et ne montrait plus une pièce, mais une
          vignette.

          TUTOIEMENT, alors que la maquette vouvoie ces quatre blocs
          (« Votre dressing »). Arbitré : le hero juste au-dessus tutoie dans
          la maquette elle-même (« Ta tenue est prête », « Bonjour, Angela »),
          comme tous les autres écrans. Deux registres à deux cents pixels
          d'écart se verraient. */}
      <div className="mx-6 mt-7">
        {/* SYSTÈME ÉDITORIAL DES TITRES (brief du 25/09, point 9) : titre à
            l'encre, UN mot ou une expression clé en italique terracotta —
            jamais deux. Même traitement que « Bonjour, … », « La capsule … »
            et les titres de Planifier. Le titre du hero, posé sur le
            terracotta, en est exclu : l'accent y serait invisible. */}
        <div className="t-titre-section text-ink">
          Ton dressing, <span className="italic text-terracotta">autrement</span>
        </div>
        <div className="text-[12px] text-muted leading-[1.45] mt-[5px]">
          Tes pièces, ton style, en un coup d&apos;œil.
        </div>
      </div>

      <div className="flex flex-col gap-3 px-6 mt-4">
        {/* 1. TON DRESSING — planche faite de VRAIES pièces, effectif réel.
               La maquette montre une photo de portant ; cet asset n'existe
               pas, et le brief prévoit le cas (« utiliser les assets
               existants si adaptés »). StyleBoard est mieux qu'une photo de
               stock : ce sont ses pièces à elle. Le jour où un visuel
               éditorial arrivera, il se substitue à ce seul appel. */}
        <CardModule
          onClick={dressingVide ? actions.openAdd : actions.goWardrobe}
          titre={
            <>
              Ton <span className="italic text-terracotta">dressing</span>
            </>
          }
          sousTitre={dressingVide ? "Ajoute tes pièces pour créer tes premiers looks." : resumeDressing}
          cta={dressingVide ? "Ajouter mes pièces" : "Explorer ton dressing"}
          fond="#F2E9DA"
        >
          {/* Visuel éditorial et non plus la planche des vraies pièces :
              l'Accueil est un TEASER, le vestiaire réel s'ouvre d'un tap. La
              planche y était forcément petite ; une composition pensée pour
              cette bande porte mieux l'univers. Les pièces réelles restent
              partout où elles informent — écran Dressing, Tenue, looks. */}
          <BandeEditoriale
            src="/editorial/capsela_dressing_banner.webp"
            alt="Un portant de vêtements aux tons crème et terracotta, un panier, des chaussures et un sac"
          />
        </CardModule>

        {/* 2. LA CAPSULE DU MOMENT — saison, style et effectif lus depuis la
               capsule calculée, jamais écrits en dur : ce sont les valeurs
               qu'affiche l'écran Capsule. */}
        <CardModule
          onClick={actions.goCapsule}
          titre={
            <>
              La capsule <span className="italic text-terracotta">{capsuleSeason}</span>
            </>
          }
          sousTitre={resumeCapsule}
          cta="Découvrir ta capsule"
          fond="#EBDFCC"
        >
          <BandeEditoriale
            src="/editorial/capsela_capsule_banner.webp"
            alt="Une planche de styliste à plat : pull écru, jean, mocassins, bijoux dorés et lunettes"
          />
        </CardModule>

        {/* 3. TON STYLE ÉVOLUE — tes looks réels, pas des mannequins.
               Arbitré : le code choisissait jusqu'ici le jeu de photos selon
               le genre déclaré du profil, ce que le brief du 23/09 interdit
               expressément. Montrer les looks enregistrés règle la question
               de fond plutôt que de la déplacer — il n'y a plus de modèle à
               choisir — et dit littéralement ce que le titre annonce. Les
               photos éditoriales restent le repli tant qu'aucun look n'existe. */}
        <CardModule
          onClick={actions.goHistory}
          titre={
            <>
              Ton style <span className="italic text-terracotta">évolue</span>
            </>
          }
          sousTitre={resumeJournal}
          cta="Voir ton journal"
          fond="#F2E9DA"
        >
          {looksRecents.length > 0 ? (
            <FilmstripLooks looks={looksRecents} resolvePool={resolvePool} height={150} />
          ) : (
            <EmptyDressingBoard visuals={journalVisuals} height={150} />
          )}
        </CardModule>

        {/* 4. ET SI ON PRÉPARAIT LA SUITE ? — mêmes destinations, même badge,
               même absence de paywall qu'avant. Aucun flag d'abonnement
               n'existe dans l'app : la card est visible pour tout le monde,
               et c'est ici que le test se posera le jour venu. Seule la
               présentation change. */}
        <div className="bg-warm-bg border border-sand-border rounded-[22px] px-4 py-[16px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {/* balance et non pretty : mesuré à 390 px, le titre se coupait
                  après « suite » et laissait le « ? » SEUL sur la deuxième
                  ligne, la pastille Premium lui prenant ~110 px. balance
                  répartit les deux lignes et supprime l'orphelin. */}
              <div className="t-titre-carte text-ink" style={{ textWrap: "balance" }}>
                Et si on préparait <span className="italic text-terracotta">la suite</span> ?
              </div>
              <div className="text-[11px] text-muted leading-[1.45] mt-[5px]" style={{ textWrap: "pretty" }}>
                Un dîner samedi ? Une escapade ? Une semaine chargée ?
              </div>
            </div>
            {/* La pastille devient l'entrée de la page Premium (24/09/2026).
                Elle était purement décorative : elle nommait une offre sans
                dire où la voir, c'est-à-dire exactement l'entrée qui ne mène
                nulle part que cet écran a déjà corrigée deux fois. Le dessin
                ne change pas d'un pixel ; seule la zone touchable est portée
                au plancher de 44 px, reprise en marge négative. */}
            <button
              onClick={() => actions.goPremium()}
              aria-label="Découvrir Capsela Premium"
              className="flex-shrink-0 flex items-center cursor-pointer py-[13px] -my-[13px]"
            >
              <Badge tone="carte" icone="✦">Premium</Badge>
            </button>
          </div>
          {/* Deux actions VISUELLEMENT DISTINCTES (demandé) : chacune porte son
              propre glyphe au trait — un calendrier, une valise — là où les
              deux précédentes partageaient un carré plein indistinct. */}
          <div className="grid grid-cols-2 gap-[10px] mt-[13px]" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <ActionSuite onClick={actions.goPlanifier} label="Planifier une tenue" glyphe={GLYPHE_CALENDRIER} />
            {/* « Préparer une valise » MÈNE AU PARCOURS depuis le 27/09/2026
                (lot 1, docs/valise.md), selon la règle d'accès PREPARER_VALISE
                (ouvrirValise). Du 24 au 27/09, faute de parcours, elle menait
                à la page Premium, qui l'annonçait « bientôt ».

                Planifier n'est PAS passée derrière ce mur : elle fonctionne,
                et personne ne peut encore s'abonner — la mettre derrière un
                paywall qui n'encaisse pas reviendrait à la retirer à tout le
                monde. */}
            <ActionSuite onClick={ouvrirValise} label="Préparer une valise" glyphe={GLYPHE_VALISE} />
          </div>
        </div>
      </div>

      {/* 5. BESOIN D'UN REGARD ? (arbitré le 25/09/2026). Section à part, et
          non une troisième action de « Et si on préparait la suite ? » :
          planifier et préparer une valise anticipent, l'avis de styliste
          porte sur une tenue qu'on a déjà. Même système de titre que « Ton
          dressing, autrement », même carte que les modules (fond carte, rayon
          22, titre serif 18) : présente, jamais dominante. Libellés fournis
          le 25/09/2026. « Demander un avis » (écran Tenue, partage à un
          proche) est une autre fonctionnalité et n'est pas touché. */}
      <div className="mx-6 mt-7">
        <div className="t-titre-section text-ink">
          Besoin d&apos;un <span className="italic text-terracotta">regard</span> ?
        </div>
      </div>
      <div className="px-6 mt-4">
        <button
          onClick={ouvrirAvisStyliste}
          aria-busy={verificationAvis}
          className="w-full min-w-0 text-left bg-card border border-border rounded-[22px] px-4 pt-[15px] pb-[6px] cursor-pointer transition-opacity active:opacity-90"
        >
          <span className="flex items-start justify-between gap-3">
            <span className="t-titre-carte text-ink">
              Avis de <span className="italic text-terracotta">styliste</span>
            </span>
            {premiumRequis("AVIS_DE_STYLISTE") && <BadgePremium />}
          </span>
          <span className="block text-[11px] text-muted leading-[1.45] mt-[6px]" style={{ textWrap: "pretty" }}>
            Montre ta tenue à Capsela et découvre ce qui fonctionne, ce que tu peux ajuster et les pièces de ton dressing à
            essayer.
          </span>
          {/* Vérification du statut (point 7) : l'indicateur de chargement de
              l'app, à la place d'aucun texte nouveau. */}
          <span className="flex items-center gap-[10px] min-h-[44px] mt-[2px] t-cta text-terracotta">
            Obtenir mon avis
            {verificationAvis && <LoadingSpinner size={22} />}
          </span>
        </button>
      </div>

      {/* Quota « Pas pour moi » : même feuille que « Autre tenue ». */}
      {quota.feuille}

      {/* Premium Gate [DÉCIDÉ] §5 — composant unique, cf. GateAvisStyliste. */}
      <GateAvisStyliste
        open={gateAvisStyliste}
        onClose={() => setGateAvisStyliste(false)}
        onDecouvrirPremium={() => {
          setGateAvisStyliste(false);
          actions.goPremium();
        }}
      />
    </div>
  );
}
