"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useContexteRepris, useDefilementRepris, useGarderContexte } from "@/lib/memoireEcrans";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import OptionRow from "@/components/OptionRow";
import SegmentedControl, { type Segment } from "@/components/SegmentedControl";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { CATLABEL } from "@/lib/data";
import {
  CAPSULE_SEASONS,
  computeDefaultCapsule,
  currentSeasonKey,
  morphologieOrienteLaSelection,
  type CapsuleSeason,
} from "@/lib/capsule";
import {
  alternativesDeRemplacement,
  margeVignette,
  piecesCles,
  piecesDuDressingPourSaison,
  raisonsSuggestion,
  type AlternativeRemplacement,
} from "@/lib/capsuleEcran";
import {
  avancer,
  categoriesPresentes,
  choisir,
  cleEntree,
  couleursPresentes,
  detailsCapsule,
  emplacementDe,
  EMPLACEMENTS,
  FILTRES_PAR_DEFAUT,
  filtrerExplorer,
  piecesClesParFamille,
  piecesComposees,
  piecesParEmplacement,
  position,
  raisonsComposition,
  selectionDeDepart,
  type CleEmplacement,
  type EntreeCapsule,
  type FiltresExplorer,
  type SelectionComposer,
  type TriExplorer,
} from "@/lib/capsuleOnglets";
import { ecrireFavorisPieces, lireFavorisPieces } from "@/lib/favorisPieces";
import { suivreEvenement } from "@/lib/mesureAudience";
import { clePieces } from "@/lib/outfitFeedback";
import { useAuth } from "@/lib/auth";
import { libelleStyles, silhouetteForme, styleLabel, stylesLabels } from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import { resolvePhotoCatalogue } from "@/lib/catalogImages";
import { analyserImage, placementDansCadre, type Analyse } from "@/lib/cadrageImage";
import type { DateContext, Item, OccasionKey, WorkMode } from "@/lib/types";
import Button from "@/components/Button";
import Card from "@/components/Card";

/*
 * ÉCRAN CAPSULE — refonte éditoriale du 25/09/2026.
 *
 * Ce qui n'a pas bougé : la capsule elle-même. Elle vient toujours de
 * `computeDefaultCapsule`, avec les mêmes arguments qu'avant (profil ou style
 * exploré, météo, exclusions, saison affichée, vestiaire) ; le sélecteur de
 * saison, le bandeau d'exploration et les liens vers le profil sont intacts.
 *
 * Ce qui a changé, c'est la façon de la montrer : une sélection préparée, pas
 * un inventaire. Les dérivés d'affichage (pièces clés, introduction, raisons
 * d'une suggestion, alternatives) sont dans `capsuleEcran.ts`, purs et
 * testés : aucun ne choisit une pièce, aucun n'écrit une raison que le moteur
 * n'a pas lue.
 *
 * LES DEUX ÉTATS D'UNE PIÈCE. Jusqu'ici l'écran n'affichait que des
 * suggestions, toutes marquées « Suggestion » : il ne pouvait pas montrer
 * ce que l'utilisatrice possède. Ses pièces de la saison y entrent désormais,
 * en tête de leur catégorie, marquées « Dans ton dressing » (règle de saison :
 * cf. piecesDuDressingPourSaison). Elles ne prennent la place d'aucune
 * suggestion — le moteur n'est pas modifié — et ne s'affichent pas pendant
 * l'exploration d'un autre style, qui est un aperçu de ce style seul (la
 * tenue explorée n'utilise pas non plus le dressing, cf. viewExploredOutfit).
 *
 * QUATRE ONGLETS (refonte du 01/11/2026, maquettes de la propriétaire) : Composer (une planche dont chaque emplacement varie
 * seul), Explorer (la galerie, ses filtres et les favoris), Pièces clés (indispensables et pièces signature), Détails (les chiffres
 * comptés de la capsule). Les quatre lisent la même capsule ; leurs dérivés sont dans capsuleOnglets.ts, purs et testés. La
 * saison se choisit en touchant son nom, dans le titre. Les catégories repliables d'avant ont disparu (brief, 4).
 */

/**
 * Reprend le libellé naturel de l'occasion (bandeau d'exploration ci-dessous)
 * — même wording que occasionPhrase (logic.ts, non exportée), dupliqué ici
 * volontairement plutôt que d'exporter/toucher logic.ts, hors périmètre de
 * cette correction (recette 24/08/2026, parcours d'exploration).
 */
function occasionPhraseFor(occasion: OccasionKey, workMode: WorkMode, dateContext: DateContext): string {
  switch (occasion) {
    case "quotidien":
      return "ta journée";
    case "travail_formel":
      return workMode === "Télétravail" ? "ta journée en télétravail" : workMode === "Entretien" ? "ton rendez-vous important" : "ta journée au bureau";
    case "date":
      return dateContext === "Restaurant / date romantique"
        ? "ton dîner"
        : dateContext === "Soirée festive"
          ? "ta soirée"
          : "ton rendez-vous";
    case "soiree":
      return "ta soirée";
    case "sport":
      return "ta séance de sport";
    case "cocooning":
      return "ta journée cocooning";
    case "voyage":
      return "ton déplacement";
    case "evenement_perso":
      return "ta cérémonie";
    default:
      return "aujourd'hui";
  }
}


/**
 * Visuel de chaque saison (fournis le 25/09/2026 : natures mortes sans
 * personne, 1536 × 1024). Convertis en WebP 1200 × 800, qualité 82 — la
 * largeur couvre le plus grand affichage (432 px de contenu) en écran haute
 * densité ; 617 Ko les quatre au lieu de 10,2 Mo en PNG, PSNR ≥ 34,8 dB
 * (Été, le plus détaillé). Une seule image chargée à la fois : celle de la
 * saison affichée.
 */
const VISUEL_SAISON: Record<CapsuleSeason, string> = {
  Printemps: "/images/saisons/printemps.webp",
  Été: "/images/saisons/ete.webp",
  Automne: "/images/saisons/automne.webp",
  Hiver: "/images/saisons/hiver.webp",
};

/**
 * Visuels des quatre saisons pour un profil Homme (fournis le 01/10/2026, même
 * esprit : natures mortes sans texte ni personne). Planche 2 × 2 découpée en
 * quatre WebP de 768 × 512 — ratio 3:2 des visuels Femme, découpe à la frontière
 * des quadrants, aucun recadrage — qualité 82, 55 à 81 Ko chacun. Pas agrandis à
 * 1200 px : un agrandissement n'ajoute aucun détail. Même composant, même cadre ;
 * seul le fichier change. Si l'un manque, le visuel Femme de la même saison
 * prend le relais (onError ci-dessous) : jamais d'image cassée.
 */
const VISUEL_SAISON_HOMME: Record<CapsuleSeason, string> = {
  Printemps: "/images/saisons/homme-printemps.webp",
  Été: "/images/saisons/homme-ete.webp",
  Automne: "/images/saisons/homme-automne.webp",
  Hiver: "/images/saisons/homme-hiver.webp",
};

/** « 1 pièce » / « 12 pièces ». */
function pieces(n: number): string {
  return `${n} ${n > 1 ? "pièces" : "pièce"}`;
}

/** « a », « a et b », « a, b et c ». */
function enumeration(parties: string[]): string {
  if (parties.length <= 1) return parties.join("");
  return parties.slice(0, -1).join(", ") + " et " + parties[parties.length - 1];
}

/**
 * Mesures déjà faites, par URL, pour toute la session : une image n'est
 * analysée qu'une fois, quel que soit le nombre de vignettes qui la montrent.
 * null = mesure impossible, on garde l'affichage contenu.
 */
const cadrages = new Map<string, (Analyse & { ratio: number }) | null>();

/**
 * Seules les images servies par Supabase Storage sont mesurées : il envoie
 * `Access-Control-Allow-Origin: *` (vérifié le 25/09/2026), condition pour lire
 * les pixels. Une image d'un autre domaine (affiliée) chargée en CORS sans
 * cet en-tête ne s'afficherait plus du tout : elle reste en affichage contenu.
 */
function mesurable(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Publique ou signée (photos du dressing, bucket privé depuis le 30/09/2026) : même en-tête CORS.
  return Boolean(base) && (url.startsWith(`${base}/storage/v1/object/public/`) || url.startsWith(`${base}/storage/v1/object/sign/`));
}

/** Ratio largeur / hauteur de toutes les vignettes de l'écran. */
const RATIO_VIGNETTE = 4 / 5;

/**
 * Vignette d'une pièce, à présence normalisée (polish du 25/09/2026, cf.
 * cadrageImage.ts) : zone image identique partout, et la pièce — pas l'image —
 * remplit la même part de cette zone, sans déformation ni recadrage.
 *
 * Tant que la mesure n'est pas faite, l'image reste invisible (une fraction de
 * seconde, le temps du chargement) : sinon elle apparaîtrait petite puis
 * sauterait à sa taille normalisée. Mesure impossible : affichage contenu,
 * comme avant.
 */
function Vignette({ item, arrondi = 14, marge = margeVignette(item.cat) }: { item: Item; arrondi?: number; marge?: number }) {
  // Les photos du catalogue, pas le visuel du flat lay (14/10/2026, demandé).
  const image = resolvePhotoCatalogue(item);
  return (
    <div
      className="w-full border border-border relative overflow-hidden"
      style={{
        aspectRatio: "4/5",
        borderRadius: arrondi,
        background: image.url ? "var(--color-photo-bg)" : item.hex,
        boxShadow: image.url ? undefined : "inset 0 0 0 1px rgba(29,26,22,.06)",
      }}
    >
      {image.url ? (
        <ImageCadree key={image.url} url={image.url} marge={marge} />
      ) : (
        item.imageStatus === "generating" && (
          <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
        )
      )}
    </div>
  );
}

function ImageCadree({ url, marge }: { url: string; marge: number }) {
  const analysable = mesurable(url);
  const [cadrage, setCadrage] = useState(() => (cadrages.has(url) ? cadrages.get(url) : undefined));
  const enAttente = analysable && cadrage === undefined;
  const place = cadrage ? placementDansCadre(cadrage.boite, cadrage.ratio, RATIO_VIGNETTE, marge) : null;
  const pad = `${marge * 100}%`;
  return (
    <>
      {/* Fond opaque mesuré : le cadre le prolonge, pour qu'aucun rectangle
          plus clair ou plus gris ne se découpe autour de la pièce. */}
      {cadrage?.fond && <span className="absolute inset-0" style={{ background: cadrage.fond }} />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading="lazy"
        decoding="async"
        crossOrigin={analysable ? "anonymous" : undefined}
        onLoad={(e) => {
          if (!analysable) return;
          // Une autre vignette de la même image a pu mesurer entre-temps :
          // reprendre sa mesure, sans quoi celle-ci resterait invisible.
          const deja = cadrages.get(url);
          const mesure = deja !== undefined ? deja : analyserImage(e.currentTarget);
          cadrages.set(url, mesure);
          setCadrage(mesure);
        }}
        onError={() => {
          cadrages.set(url, null);
          setCadrage(null);
        }}
        className="transition-opacity duration-200"
        style={
          place
            ? { position: "absolute", width: `${place.largeur}%`, height: `${place.hauteur}%`, left: `${place.gauche}%`, top: `${place.haut}%`, maxWidth: "none", opacity: 1 }
            : {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                objectPosition: "center",
                padding: pad,
                boxSizing: "border-box",
                opacity: enAttente ? 0 : 1,
              }
        }
      />
    </>
  );
}

/**
 * Statut d'une pièce, identique partout sur l'écran : une ligne de texte sous
 * le nom, pas un badge posé sur l'image. Le glyphe porte la différence autant
 * que la couleur — ✓ pour ce qui est à toi, ✦ terracotta pour ce que Capsela
 * propose — pour rester lisible sans distinguer les couleurs.
 */
function Statut({ possedee }: { possedee: boolean }) {
  // Une seule ligne, de hauteur fixe : « Dans ton dressing » passait sur deux
  // lignes dans une carte de 97 px (360 px d'écran) et rendait les cartes
  // inégales (mesuré : 195 contre 189 px).
  return (
    <span
      className={
        "flex items-center gap-[3px] h-[14px] text-[10px] leading-[14px] whitespace-nowrap overflow-hidden " +
        (possedee ? "text-muted" : "text-terracotta")
      }
    >
      <span aria-hidden="true" className="flex-shrink-0">{possedee ? "✓" : "✦"}</span>
      <span className="truncate">{possedee ? "Dans ton dressing" : "Suggestion"}</span>
    </span>
  );
}

type Fiche = { id: number; vue: "detail" | "remplacer" };
type Onglet = "composer" | "explorer" | "cles" | "details";
type Feuille = "saison" | "pourquoi" | "categorie" | "couleur" | "tri" | null;

const ONGLETS: readonly Segment<Onglet>[] = [
  { key: "composer", label: "Composer" },
  { key: "explorer", label: "Explorer" },
  { key: "cles", label: "Pièces clés" },
  { key: "details", label: "Détails" },
];

const LIBELLES_TRI: Record<TriExplorer, string> = {
  capsule: "Par catégorie",
  dressing: "Mes pièces d'abord",
  suggestions: "Suggestions d'abord",
  nom: "Par nom",
};

/** Glyphes des tuiles de Composer : au trait, `currentColor`, même grammaire que GlyphesOccasion.tsx (viewBox 24, trait 1,5). */
const GLYPHES: Record<CleEmplacement, React.ReactNode> = {
  haut: <path d="M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4z" />,
  bas: <path d="M7 3h10l1 18h-4l-2-11-2 11H6L7 3zM7 6h10" />,
  robe: <path d="M9 3h6l-1 5 4 13H6l4-13-1-5z" />,
  maille: <path d="M8 4l-4 3 1 11h3v3h8v-3h3l1-11-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4zM9 17h6" />,
  dessus: <path d="M8 3l-4 3v15h5v-9M16 3l4 3v15h-5v-9M8 3l4 8 4-8M12 11v10" />,
  chaussures: <path d="M3 17c0-4 1-8 2-10 2 3 4 6 9 7l5 1c1.5.3 2 1.5 2 3H3zM5 17v3" />,
  sac: <path d="M5 9h14l-1 11H6L5 9zM9 9V7a3 3 0 016 0v2" />,
  accessoire: (
    <>
      <circle cx="12" cy="14" r="5" />
      <path d="M10 6l2-3 2 3-2 3z" />
    </>
  ),
};

function Glyphe({ cle }: { cle: CleEmplacement }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHES[cle]}
    </svg>
  );
}

function Fleche({ sens }: { sens: "gauche" | "droite" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={sens === "gauche" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}

function Coeur({ plein }: { plein: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={plein ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
    </svg>
  );
}

/** Statut d'une pièce dans Explorer et Pièces clés : « Sélection Capsela » (maquette du 01/11/2026) ou « Dans ton dressing ». */
function Pastille({ possedee }: { possedee: boolean }) {
  return possedee ? (
    <span className="inline-flex items-center gap-[3px] text-[10px] leading-[14px] text-muted whitespace-nowrap">
      <span aria-hidden="true">✓</span>Dans ton dressing
    </span>
  ) : (
    <span className="inline-flex items-center gap-[4px] rounded-full px-[8px] py-[3px] text-[10px] leading-[12px] text-terracotta-deep whitespace-nowrap" style={{ background: "var(--color-chip-soft-bg)" }}>
      <span aria-hidden="true">✦</span>Sélection Capsela
    </span>
  );
}

export default function CapsuleScreen() {
  const { state, weather, actions, vestiairePool } = useCapsela();
  const { profile, userId } = useAuth();

  const capsuleSeason: CapsuleSeason = state.capsuleSeason || currentSeasonKey();

  // Exploration ponctuelle d'un autre style ("Explorer d'autres styles" depuis
  // l'état vide Tenues, recette 24/08/2026) — state.exploredStyleId ne
  // remplace jamais profile.styles : seule cette variable locale, dérivée à
  // la volée, voit le style temporaire ; aucune écriture profil ici.
  const exploredStyleId = state.exploredStyleId;
  const capsuleProfile = useMemo(
    () => (exploredStyleId ? { ...profile, styles: [exploredStyleId] } : profile),
    [profile, exploredStyleId]
  );
  // UNE SEULE CAPSULE pour les quatre onglets (brief, 10) : ils lisent tous `entrees`, recalculées au changement de saison, d'exclusion
  // ou de dressing. Rien ne mélange deux saisons.
  const capsule = useMemo(
    () => computeDefaultCapsule(capsuleProfile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool),
    [capsuleProfile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool]
  );

  // Affichage seul ici (pas de déclenchement) : la génération d'un visuel se fait à l'ouverture d'une fiche, pièce par pièce.

  // Style renseigné en profil (recette 25/08/2026) — "" si aucun style n'a été renseigné, jamais un style inventé.
  const userStyleLabel = libelleStyles(profile.styles, profile.gender);
  const nbStylesProfil = stylesLabels(profile.styles, profile.gender).length;
  const exploredStyleLabel = exploredStyleId ? styleLabel(exploredStyleId, profile.gender) : null;

  /**
   * Ce à quoi cette sélection doit vraiment quelque chose, et rien d'autre (25/09/2026) : la morphologie seulement si elle ORIENTE
   * la sélection (`morphologieOrienteLaSelection`). Chaque valeur ouvre l'étape de profil correspondante, qui revient ici.
   */
  const criteres = useMemo(() => {
    const aUnePalette =
      profile.paletteCouleurs.length > 0 || !!profile.paletteAffinite || !!profile.paletteIntensite;
    const forme = morphologieOrienteLaSelection(profile.morphology)
      ? silhouetteForme(profile.morphology)
      : "";
    return [
      userStyleLabel && { cle: "style", avant: nbStylesProfil > 1 ? "tes styles " : "ton style ", valeur: userStyleLabel, etape: "style" },
      aUnePalette && { cle: "palette", avant: "ta ", valeur: "palette", etape: "pal_couleurs" },
      forme && { cle: "morpho", avant: "ta silhouette ", valeur: forme, etape: "morpho" },
    ].filter((c): c is { cle: string; avant: string; valeur: string; etape: string } => Boolean(c));
  }, [userStyleLabel, nbStylesProfil, profile.paletteCouleurs, profile.paletteAffinite, profile.paletteIntensite, profile.morphology]);

  const possedees = useMemo(
    () => (exploredStyleId ? [] : piecesDuDressingPourSaison(state.items, capsuleSeason)),
    [exploredStyleId, state.items, capsuleSeason]
  );
  const entrees = useMemo<EntreeCapsule[]>(
    () => [...possedees.map((item) => ({ item, possedee: true })), ...capsule.map((item) => ({ item, possedee: false }))],
    [possedees, capsule]
  );

  // ----- Contexte repris au retour d'une fiche (22/10/2026, memoireEcrans.ts) : onglet, filtres, composition, défilement. -----
  type ContexteCapsule = {
    onglet: Onglet;
    filtres: FiltresExplorer;
    grille: boolean;
    composition: { cle: string; sel: SelectionComposer; actif: CleEmplacement | null } | null;
    defilement: number;
  };
  const repris = useContexteRepris<ContexteCapsule>("capsule");
  const [onglet, setOnglet] = useState<Onglet>(repris?.onglet ?? "composer");
  const [filtres, setFiltres] = useState<FiltresExplorer>(repris?.filtres ?? FILTRES_PAR_DEFAUT);
  const [grille, setGrille] = useState(repris?.grille ?? true);
  const zone = useRef<HTMLDivElement | null>(null);
  const defilement = useDefilementRepris(zone, repris?.defilement);

  // ----- COMPOSER -----
  // La composition appartient à une capsule : changer de saison ou de style exploré la remet à son départ (brief, 2.2).
  const cleComposition = `${capsuleSeason}|${exploredStyleId ?? ""}`;
  const groupes = useMemo(() => piecesParEmplacement(entrees), [entrees]);
  const [composition, setComposition] = useState<ContexteCapsule["composition"]>(repris?.composition ?? null);
  const selection = useMemo<SelectionComposer>(
    () => (composition && composition.cle === cleComposition ? composition.sel : selectionDeDepart(groupes, capsuleSeason)),
    [composition, cleComposition, groupes, capsuleSeason]
  );
  const presents = EMPLACEMENTS.filter((e) => groupes[e.cle].length > 0);
  const actifDemande = composition && composition.cle === cleComposition ? composition.actif : null;
  const emplacementActif = presents.find((e) => e.cle === actifDemande) ?? presents[0] ?? null;
  const changerSelection = (sel: SelectionComposer, actif: CleEmplacement | null = emplacementActif?.cle ?? null) =>
    setComposition({ cle: cleComposition, sel, actif });
  // Mémorisées : la planche (FlatLayCapsela) ne se recompose que si les pièces changent.
  const composees = useMemo(() => piecesComposees(groupes, selection), [groupes, selection]);
  const piecesTenue = useMemo(() => composees.map((e) => e.item), [composees]);
  const raisonsTenue = raisonsComposition(piecesTenue, capsuleProfile);
  const cleTenue = clePieces(piecesTenue.map((it) => it.id)).join(",");
  const tenueEnregistree = state.savedLooks.some((l) => clePieces(l.pieceIds).join(",") === cleTenue);

  useGarderContexte("capsule", (): ContexteCapsule => ({ onglet, filtres, grille, composition, defilement: defilement.position.current }));

  const avancerActif = (pas: 1 | -1) => {
    if (!emplacementActif) return;
    changerSelection(avancer(selection, emplacementActif.cle, groupes[emplacementActif.cle].length, pas));
  };
  // Le glissement horizontal sur la planche change la pièce de l'emplacement actif ; un geste surtout vertical reste un défilement.
  const toucher = useRef<{ x: number; y: number } | null>(null);

  const composerAvec = (it: Item, possedee: boolean) => {
    const cle = emplacementDe(it.cat);
    if (!cle) return;
    const index = groupes[cle].findIndex((e) => e.item.id === it.id && e.possedee === possedee);
    if (index < 0) return;
    changerSelection(choisir(selection, cle, index), cle);
    setFiche(null);
    setOnglet("composer");
    zone.current?.scrollTo({ top: 0 });
  };

  // ----- EXPLORER -----
  const [favoris, setFavoris] = useState<string[]>(() => lireFavorisPieces(userId));
  const favorisSet = useMemo(() => new Set(favoris), [favoris]);
  const basculerFavori = (e: EntreeCapsule) => {
    const cle = cleEntree(e);
    const suivants = favorisSet.has(cle) ? favoris.filter((k) => k !== cle) : [...favoris, cle];
    setFavoris(suivants);
    ecrireFavorisPieces(userId, suivants);
  };
  const categories = useMemo(() => categoriesPresentes(entrees), [entrees]);
  const couleurs = useMemo(() => couleursPresentes(entrees), [entrees]);
  // Un filtre devenu sans objet (autre saison, catégorie disparue) ne laisse pas une galerie vide sans raison.
  const filtresValides: FiltresExplorer = {
    ...filtres,
    categorie: filtres.categorie === "toutes" || filtres.categorie === "favoris" || categories.some((c) => c.cat === filtres.categorie) ? filtres.categorie : "toutes",
    couleur: filtres.couleur && couleurs.some((c) => c.nom.toLowerCase() === filtres.couleur!.toLowerCase()) ? filtres.couleur : null,
  };
  const galerie = filtrerExplorer(entrees, filtresValides, favorisSet);
  const libelleCategorie =
    filtresValides.categorie === "toutes"
      ? "Toutes les pièces"
      : filtresValides.categorie === "favoris"
        ? "Mes favoris"
        : (categories.find((c) => c.cat === filtresValides.categorie)?.libelle ?? "Toutes les pièces");
  const couleurFiltre = filtresValides.couleur ? couleurs.find((c) => c.nom.toLowerCase() === filtresValides.couleur!.toLowerCase()) : null;

  // ----- PIÈCES CLÉS et DÉTAILS -----
  const clesSaison = useMemo(() => piecesCles(capsule, 3, capsuleSeason), [capsule, capsuleSeason]);
  const clesFamilles = useMemo(() => piecesClesParFamille(capsule, clesSaison, capsuleProfile), [capsule, clesSaison, capsuleProfile]);
  const details = useMemo(() => detailsCapsule(entrees), [entrees]);
  const maxCompo = Math.max(1, ...details.composition.map((c) => c.n));

  // ----- Feuilles -----
  const [feuille, setFeuille] = useState<Feuille>(null);
  // Les capsules des autres saisons, comptées seulement quand la feuille de saison est ouverte : quatre appels du moteur, à la
  // demande. Une saison sans pièce le dit au lieu d'ouvrir une capsule vide (brief, 2.2).
  const piecesParSaison = useMemo(() => {
    if (feuille !== "saison") return null;
    return Object.fromEntries(
      CAPSULE_SEASONS.map((s) => [
        s,
        (s === capsuleSeason ? capsule.length : computeDefaultCapsule(capsuleProfile, weather, state.suggestedExcluded, s, vestiairePool).length) +
          (exploredStyleId ? 0 : piecesDuDressingPourSaison(state.items, s).length),
      ])
    ) as Record<CapsuleSeason, number>;
  }, [feuille, capsuleSeason, capsule.length, capsuleProfile, weather, state.suggestedExcluded, vestiairePool, exploredStyleId, state.items]);

  const [fiche, setFiche] = useState<Fiche | null>(null);
  // Relue à chaque rendu plutôt que figée à l'ouverture : la génération de son
  // visuel met à jour vestiairePool pendant que la fiche est ouverte.
  const pieceFiche = fiche ? vestiairePool.find((i) => i.id === fiche.id) ?? capsule.find((i) => i.id === fiche.id) ?? null : null;

  useEffect(() => {
    if (!pieceFiche) return;
    if (
      resolvePhotoCatalogue(pieceFiche).kind === "placeholder" &&
      pieceFiche.imageStatus !== "generating" &&
      pieceFiche.imageStatus !== "error" &&
      pieceFiche.imageStatus !== "invalid"
    ) {
      actions.requestCatalogImage(pieceFiche.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceFiche?.id]);

  // Calculées seulement quand la vue « Remplacer » est ouverte : jusqu'à
  // trois appels du moteur, à la demande, jamais au rendu de l'écran.
  const alternatives = useMemo<AlternativeRemplacement[]>(() => {
    if (!fiche || fiche.vue !== "remplacer" || !pieceFiche) return [];
    return alternativesDeRemplacement(pieceFiche, capsule, state.suggestedExcluded, (exclus) =>
      computeDefaultCapsule(capsuleProfile, weather, exclus, capsuleSeason, vestiairePool)
    );
  }, [fiche, pieceFiche, capsule, state.suggestedExcluded, capsuleProfile, weather, capsuleSeason, vestiairePool]);

  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const mesure = (id: number) => ({ piece_id: id, saison: capsuleSeason, provenance: onglet });

  const ouvrir = (item: Item, possedee: boolean) => {
    if (possedee) {
      actions.openItem(item.id, false);
      return;
    }
    setFiche({ id: item.id, vue: "detail" });
    suivreEvenement("fiche_piece_capsule", mesure(item.id));
  };

  const choisirAlternative = (a: AlternativeRemplacement) => {
    a.exclusions.filter((id) => !state.suggestedExcluded.includes(id)).forEach((id) => actions.dismissSuggested(id));
    setFiche(null);
    setToast("Ta capsule est mise à jour");
  };

  const pasInteressee = (item: Item) => {
    actions.dismissSuggested(item.id);
    setFiche(null);
    setToast("Pièce retirée de ta capsule");
  };

  const raisons = pieceFiche ? raisonsSuggestion(pieceFiche, capsuleProfile) : [];
  const syntheseFiche = pieceFiche ? [CATLABEL[pieceFiche.cat], pieceFiche.color, pieceFiche.matiere].filter(Boolean).join(" · ") : "";
  const pieceFicheComposable = pieceFiche ? emplacementDe(pieceFiche.cat) !== null && groupes[emplacementDe(pieceFiche.cat)!].some((e) => !e.possedee && e.item.id === pieceFiche.id) : false;

  return (
    <>
      <div
        ref={zone}
        onScroll={defilement.onScroll}
        className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav"
      >
        <AppHeader />

        {/*
          EN-TÊTE (refonte du 01/11/2026). La saison est le second temps du titre, en italique terracotta, et c'est ELLE qui s'ouvre
          sur le choix des saisons (brief, 2.2) : ni pastilles permanentes, ni chevron. « N looks possibles » reste retiré
          (22/09/2026, compteur faux de ×0,5 à ×1,7) : le nombre affiché est compté, pas estimé.
        */}
        <div className="mt-[18px]">
          <h1 className="t-titre-ecran text-ink">
            Ma Capsule{" "}
            <button
              type="button"
              onClick={() => setFeuille("saison")}
              className="italic text-terracotta cursor-pointer"
              aria-label={`Saison ${capsuleSeason}, changer de saison`}
            >
              {capsuleSeason}
            </button>
          </h1>
          <div className="t-chapeau text-ink-soft mt-[6px]">
            {pieces(capsule.length)} {capsule.length > 1 ? "sélectionnées" : "sélectionnée"}{" "}
            {exploredStyleLabel ? "dans ce style" : "pour composer ton style"}
            {possedees.length > 0 && <>, et {pieces(possedees.length)} de ton dressing.</>}
            {!possedees.length && "."}
          </div>
          <div className="text-[12px] text-muted leading-[1.5] mt-[4px]">
            {exploredStyleLabel ? (
              <>
                Aperçu du style <span className="text-ink">{exploredStyleLabel}</span> — pas ton style habituel.
              </>
            ) : (
              criteres.length > 0 && (
                <>
                  Pensées pour{" "}
                  {criteres.map((c, i) => (
                    <span key={c.cle}>
                      {i > 0 && <span className="text-placeholder"> · </span>}
                      {c.avant}
                      <button
                        type="button"
                        onClick={() => actions.goProfileSetup(c.etape, true)}
                        className="text-terracotta font-semibold cursor-pointer"
                      >
                        {c.valeur}
                      </button>
                    </span>
                  ))}
                </>
              )
            )}
          </div>
        </div>

        {exploredStyleLabel && (
          <Card rayon="bloc" className="mt-[14px] px-4 py-[14px]">
            <div className="flex items-start gap-[11px]">
              <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-ink leading-[1.4]">Tu explores le style {exploredStyleLabel}</div>
                <div className="text-[12px] text-ink-soft leading-[1.45] mt-[3px]">
                  Cette capsule permet de composer une tenue pour{" "}
                  {occasionPhraseFor(state.occasion || "all", state.workMode, state.dateContext)}.
                </div>
              </div>
              <button
                onClick={actions.clearExploredStyle}
                className="flex-shrink-0 text-[12px] text-terracotta cursor-pointer whitespace-nowrap"
              >
                Revenir à mon style
              </button>
            </div>
            <Button variante="principal" className="mt-[14px]" onClick={actions.viewExploredOutfit}>
              Voir ma tenue
            </Button>
          </Card>
        )}

        <div className="mt-[16px]">
          <SegmentedControl segments={ONGLETS} actif={onglet} onChange={setOnglet} ariaLabel="Vues de la capsule" variante="pastilles" serre />
        </div>

        {entrees.length === 0 && (
          <div className="mt-[28px] text-center">
            <div className="text-[13px] text-ink">Aucune pièce pour la capsule {capsuleSeason}.</div>
            <button onClick={() => setFeuille("saison")} className="mt-[6px] text-[13px] text-terracotta cursor-pointer py-[8px] px-2">
              Choisir une autre saison
            </button>
          </div>
        )}

        {/* ====================================== COMPOSER ====================================== */}
        {onglet === "composer" && entrees.length > 0 && (
          <div className="mt-[16px]">
            {/*
              La planche : le moteur de flat lay de la Tenue du jour (FlatLayCapsela, contexte look-detail), pas une grille. Les
              flèches et le glissement ne changent que la pièce de l'emplacement choisi dessous (brief, 3.2).
            */}
            <div
              className="relative rounded-feuille overflow-hidden"
              style={{ aspectRatio: "100 / 100", background: "var(--color-hero-background)", touchAction: "pan-y" }}
              onTouchStart={(e) => (toucher.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
              onTouchEnd={(e) => {
                const debut = toucher.current;
                toucher.current = null;
                if (!debut) return;
                const dx = e.changedTouches[0].clientX - debut.x;
                const dy = e.changedTouches[0].clientY - debut.y;
                if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) avancerActif(dx < 0 ? 1 : -1);
              }}
            >
              <div className="absolute inset-0" role="img" aria-label={"Composition : " + piecesTenue.map((p) => p.name).join(", ")}>
                {piecesTenue.length > 0 && (
                  <FlatLayCapsela
                    items={piecesTenue}
                    context="look-detail"
                    // Graine de la capsule, pas des pièces : changer une pièce ne redistribue pas toute la planche.
                    layoutSeed={cleComposition}
                    onPiece={(it) => ouvrir(it, composees.find((e) => e.item.id === it.id)?.possedee ?? false)}
                  />
                )}
              </div>
              {emplacementActif && groupes[emplacementActif.cle].length + (emplacementActif.facultatif ? 1 : 0) > 1 && (
                <>
                  <button
                    onClick={() => avancerActif(-1)}
                    aria-label={`${emplacementActif.libelle} : pièce précédente`}
                    className="absolute left-[10px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] rounded-full bg-card text-ink flex items-center justify-center shadow-sm cursor-pointer"
                  >
                    <Fleche sens="gauche" />
                  </button>
                  <button
                    onClick={() => avancerActif(1)}
                    aria-label={`${emplacementActif.libelle} : pièce suivante`}
                    className="absolute right-[10px] top-1/2 -translate-y-1/2 w-[44px] h-[44px] rounded-full bg-card text-ink flex items-center justify-center shadow-sm cursor-pointer"
                  >
                    <Fleche sens="droite" />
                  </button>
                </>
              )}
            </div>

            {/* Les emplacements : le choisi en terracotta, sa position discrète dessous (« 3 / 11 », « Sans » pour un emplacement vide). */}
            <div className="scrollarea -mx-6 px-6 flex gap-[8px] overflow-x-auto mt-[12px] pb-[2px]" role="tablist" aria-label="Pièce à faire varier">
              {presents.map((e) => {
                const n = groupes[e.cle].length;
                const p = position(selection, e.cle, n);
                const on = emplacementActif?.cle === e.cle;
                return (
                  <button
                    key={e.cle}
                    role="tab"
                    aria-selected={on}
                    onClick={() => changerSelection(selection, e.cle)}
                    className={
                      "flex-none w-[78px] rounded-tuile border py-[9px] flex flex-col items-center gap-[3px] cursor-pointer " +
                      (on ? "border-terracotta text-terracotta-deep" : "border-border bg-card text-ink")
                    }
                    style={on ? { background: "var(--color-chip-soft-bg)" } : undefined}
                  >
                    <Glyphe cle={e.cle} />
                    <span className="text-[11px] leading-[14px]">{e.libelle}</span>
                    <span className={"text-[10px] leading-[12px] " + (on ? "text-terracotta" : "text-muted")}>{p < 0 ? `Sans · ${n}` : `${p + 1} / ${n}`}</span>
                  </button>
                );
              })}
            </div>

            {raisonsTenue.length > 0 && (
              <button
                onClick={() => setFeuille("pourquoi")}
                className="mt-[14px] w-full flex items-center gap-[12px] rounded-bloc px-4 py-[13px] text-left cursor-pointer"
                style={{ background: "var(--color-chip-soft-bg)" }}
              >
                <span aria-hidden="true" className="text-terracotta text-[16px] flex-shrink-0">✦</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] text-ink font-semibold">Pourquoi cette tenue ?</span>
                  <span className="block text-[12px] text-ink-soft leading-[1.4] mt-[2px]">{raisonsTenue[0]}</span>
                </span>
                <span aria-hidden="true" className="text-muted flex-shrink-0">
                  <Fleche sens="droite" />
                </span>
              </button>
            )}

            {piecesTenue.length >= 2 && (
              <Button
                variante={tenueEnregistree ? "contour" : "principal"}
                className="mt-[14px]"
                onClick={() => {
                  actions.basculerIdeeLook(piecesTenue.map((it) => it.id), "all");
                  setToast(tenueEnregistree ? "Tenue retirée de tes looks" : "Tenue enregistrée dans tes looks");
                }}
              >
                {tenueEnregistree ? "Enregistrée dans mes looks" : "Enregistrer cette tenue"}
              </Button>
            )}
          </div>
        )}

        {/* ====================================== EXPLORER ====================================== */}
        {onglet === "explorer" && entrees.length > 0 && (
          <div className="mt-[6px]">
            {/* Les filtres restent accessibles pendant le défilement (brief, 4.2). */}
            <div className="sticky top-0 z-10 -mx-6 px-6 pt-[10px] pb-[8px]" style={{ background: "var(--color-cream)" }}>
              <div className="flex items-center gap-[8px]">
                <button
                  onClick={() => setFeuille("categorie")}
                  className="flex-1 min-w-0 flex items-center justify-between gap-2 border border-border bg-card rounded-full px-4 h-[42px] text-[13px] text-ink cursor-pointer"
                >
                  <span className="truncate">{libelleCategorie}</span>
                  <span aria-hidden="true" className="text-muted rotate-90">
                    <Fleche sens="droite" />
                  </span>
                </button>
                <button
                  onClick={() => setFeuille("couleur")}
                  aria-label={couleurFiltre ? `Couleur : ${couleurFiltre.nom}` : "Filtrer par couleur"}
                  className={"flex-none w-[42px] h-[42px] rounded-full border bg-card flex items-center justify-center cursor-pointer " + (couleurFiltre ? "border-terracotta" : "border-border")}
                >
                  <span
                    className="w-[20px] h-[20px] rounded-full"
                    style={{
                      background: couleurFiltre?.hex ?? `conic-gradient(${couleurs.slice(0, 6).map((c) => c.hex).join(", ") || "var(--color-border)"})`,
                      boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)",
                    }}
                  />
                </button>
                <button
                  onClick={() => setFeuille("tri")}
                  aria-label={`Trier : ${LIBELLES_TRI[filtresValides.tri]}`}
                  className="flex-none w-[42px] h-[42px] rounded-full border border-border bg-card text-ink flex items-center justify-center cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                    <circle cx="16" cy="7" r="2" />
                    <circle cx="10" cy="17" r="2" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center justify-between mt-[10px]">
                <div className="text-[13px] text-ink">
                  {pieces(galerie.length)}
                  {(filtresValides.categorie !== "toutes" || couleurFiltre) && (
                    <button onClick={() => setFiltres({ ...FILTRES_PAR_DEFAUT, tri: filtresValides.tri })} className="ml-[10px] text-[12px] text-terracotta cursor-pointer">
                      Tout afficher
                    </button>
                  )}
                </div>
                <div className="flex gap-[4px]" role="group" aria-label="Présentation">
                  {[true, false].map((g) => (
                    <button
                      key={String(g)}
                      onClick={() => setGrille(g)}
                      aria-pressed={grille === g}
                      aria-label={g ? "En grille" : "En liste"}
                      className={"w-[34px] h-[34px] flex items-center justify-center rounded-[8px] cursor-pointer " + (grille === g ? "text-terracotta" : "text-muted")}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        {g ? <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {galerie.length === 0 ? (
              <div className="mt-[24px] text-center text-[13px] text-muted">
                {filtresValides.categorie === "favoris" ? "Touche le cœur d'une pièce pour la retrouver ici." : "Aucune pièce ne correspond à ces filtres."}
              </div>
            ) : grille ? (
              <div className="grid grid-cols-2 gap-x-[12px] gap-y-[18px] mt-[6px]">
                {galerie.map((e) => (
                  <div key={cleEntree(e)} className="relative min-w-0">
                    <button onClick={() => ouvrir(e.item, e.possedee)} className="block w-full text-left cursor-pointer" aria-label={`${e.item.name}, ${e.possedee ? "dans ton dressing" : "sélection Capsela"}`}>
                      <Vignette item={e.item} />
                      <div className="text-[13px] text-ink leading-[17px] mt-[8px] line-clamp-2">{e.item.name}</div>
                      <div className="text-[11px] text-muted mt-[2px]">{CATLABEL[e.item.cat]}</div>
                      <div className="mt-[6px]">
                        <Pastille possedee={e.possedee} />
                      </div>
                    </button>
                    <button
                      onClick={() => basculerFavori(e)}
                      aria-pressed={favorisSet.has(cleEntree(e))}
                      aria-label={favorisSet.has(cleEntree(e)) ? `Retirer ${e.item.name} de mes favoris` : `Ajouter ${e.item.name} à mes favoris`}
                      className={"absolute top-[6px] right-[6px] w-[40px] h-[40px] flex items-center justify-center cursor-pointer " + (favorisSet.has(cleEntree(e)) ? "text-terracotta" : "text-ink-soft")}
                    >
                      {/* Pastille claire : le cœur reste lisible sur une pièce sombre. */}
                      <span className="w-[32px] h-[32px] rounded-full flex items-center justify-center" style={{ background: "rgba(250,247,241,.88)" }}>
                        <Coeur plein={favorisSet.has(cleEntree(e))} />
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-[6px] border-t border-border">
                {galerie.map((e) => (
                  <div key={cleEntree(e)} className="flex items-center gap-[12px] border-b border-border py-[10px]">
                    <button onClick={() => ouvrir(e.item, e.possedee)} className="flex-1 min-w-0 flex items-center gap-[12px] text-left cursor-pointer">
                      <span className="w-[56px] flex-shrink-0">
                        <Vignette item={e.item} arrondi={10} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] text-ink leading-[1.3] truncate">{e.item.name}</span>
                        <span className="block text-[11px] text-muted mt-[2px]">{CATLABEL[e.item.cat]}</span>
                        <span className="block mt-[5px]">
                          <Pastille possedee={e.possedee} />
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => basculerFavori(e)}
                      aria-pressed={favorisSet.has(cleEntree(e))}
                      aria-label={favorisSet.has(cleEntree(e)) ? `Retirer ${e.item.name} de mes favoris` : `Ajouter ${e.item.name} à mes favoris`}
                      className={"flex-none w-[40px] h-[40px] flex items-center justify-center cursor-pointer " + (favorisSet.has(cleEntree(e)) ? "text-terracotta" : "text-ink-soft")}
                    >
                      <Coeur plein={favorisSet.has(cleEntree(e))} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Même action qu'avant (openAdd) : l'ajout passe après la découverte (25/09/2026). */}
            <div className="mt-[28px] text-center">
              <div className="text-[12px] text-muted">Une pièce manque dans ta capsule ?</div>
              <button onClick={actions.openAdd} className="mt-[2px] text-[13px] text-terracotta cursor-pointer py-[8px] px-2">
                + Ajouter une pièce que je possède
              </button>
            </div>
          </div>
        )}

        {/* ====================================== PIÈCES CLÉS ====================================== */}
        {onglet === "cles" && entrees.length > 0 && (
          <div className="mt-[16px]">
            <Card rayon="bloc" className="overflow-hidden flex items-stretch">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={capsuleSeason}
                src={profile.gender === "homme" ? VISUEL_SAISON_HOMME[capsuleSeason] : VISUEL_SAISON[capsuleSeason]}
                alt=""
                decoding="async"
                onError={(e) => {
                  // Visuel Homme absent : le visuel générique de la saison, une seule fois.
                  const repli = VISUEL_SAISON[capsuleSeason];
                  if (!e.currentTarget.src.endsWith(repli)) e.currentTarget.src = repli;
                }}
                className="w-[36%] flex-none object-cover block"
              />
              <div className="flex-1 min-w-0 px-4 py-[16px]">
                <div className="t-titre-carte text-ink">Les incontournables de ta capsule</div>
                <div className="text-[12px] text-ink-soft leading-[1.45] mt-[6px]">
                  Les indispensables qui s&apos;associent facilement, et les pièces signature qui donnent le ton.
                </div>
              </div>
            </Card>

            {clesFamilles.length === 0 ? (
              <div className="mt-[22px] text-center text-[13px] text-muted">
                Aucune pièce de cette capsule n&apos;est marquée indispensable ou signature.
              </div>
            ) : (
              <div className="flex flex-col gap-[10px] mt-[14px]">
                {clesFamilles.map((c) => (
                  <button
                    key={c.item.id}
                    onClick={() => ouvrir(c.item, false)}
                    className="flex items-center gap-[14px] bg-card border border-border rounded-bloc p-[10px] text-left cursor-pointer"
                  >
                    <span className="w-[86px] flex-shrink-0">
                      <Vignette item={c.item} arrondi={12} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block t-titre-vignette text-ink">{c.item.name}</span>
                      <span
                        className="inline-block mt-[6px] rounded-full px-[9px] py-[3px] text-[10px] leading-[12px] text-terracotta-deep"
                        style={{ background: "var(--color-chip-soft-bg)" }}
                      >
                        {c.famille === "signature" ? "Pièce signature" : "Indispensable"}
                      </span>
                      <span className="block text-[12px] text-ink-soft leading-[1.45] mt-[6px]">{c.explication}</span>
                    </span>
                    <span aria-hidden="true" className="text-muted flex-shrink-0">
                      <Fleche sens="droite" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================================== DÉTAILS ====================================== */}
        {onglet === "details" && entrees.length > 0 && (
          <div className="mt-[18px]">
            <div className="t-titre-carte text-ink">Ton vestiaire en un coup d&apos;œil</div>
            {/* Des chiffres COMPTÉS. Pas d'« associations possibles » : le compteur a été retiré le 22/09/2026 (faux de ×0,5 à ×1,7). */}
            <div className="grid grid-cols-3 gap-[8px] mt-[12px]">
              {[
                { n: details.pieces, l: details.pieces > 1 ? "Pièces" : "Pièce" },
                { n: details.couleurs, l: details.couleurs > 1 ? "Couleurs" : "Couleur" },
                { n: details.categories, l: details.categories > 1 ? "Catégories" : "Catégorie" },
              ].map((s) => (
                <Card key={s.l} rayon="bloc" className="py-[14px] text-center">
                  <div className="t-chiffre text-ink">{s.n}</div>
                  <div className="text-[11px] text-muted mt-[4px]">{s.l}</div>
                </Card>
              ))}
            </div>

            {details.palette.length > 0 && (
              <>
                <div className="t-titre-carte text-ink mt-[26px]">La palette de ta saison</div>
                <div className="text-[12px] text-muted mt-[4px]">Les couleurs des pièces de cette capsule, de la plus présente à la moins.</div>
                <ul className="flex flex-wrap gap-[10px] mt-[12px]">
                  {details.palette.map((c) => (
                    <li key={c.nom} className="flex flex-col items-center w-[52px]">
                      <span className="w-[34px] h-[34px] rounded-full" style={{ background: c.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)" }} />
                      <span className="text-[10px] text-muted mt-[4px] text-center leading-[12px] line-clamp-2">{c.nom}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="t-titre-carte text-ink mt-[26px]">La composition de ta capsule</div>
            <ul className="mt-[12px] flex flex-col gap-[12px]">
              {details.composition.map((c) => (
                <li key={c.cat}>
                  <div className="flex items-baseline justify-between text-[12px]">
                    <span className="text-ink">{c.libelle}</span>
                    <span className="text-muted">{pieces(c.n)}</span>
                  </div>
                  <div className="h-[6px] rounded-full mt-[5px] overflow-hidden" style={{ background: "var(--color-chip-soft-bg)" }}>
                    <div className="h-full rounded-full bg-terracotta" style={{ width: `${(100 * c.n) / maxCompo}%` }} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Les relations réelles capsule ↔ dressing : les pièces de la saison déjà à toi, les suggestions encore à découvrir. */}
            {!exploredStyleId && (
              <Card rayon="bloc" className="mt-[26px] px-4 py-[16px]">
                <div className="t-titre-carte text-ink">Ta capsule prend vie</div>
                <ul className="mt-[10px] flex flex-col gap-[6px] text-[13px] text-ink">
                  <li>
                    <span className="font-semibold">{details.dansLeDressing}</span> {details.dansLeDressing > 1 ? "pièces" : "pièce"} de ton dressing pour cette saison
                  </li>
                  <li>
                    <span className="font-semibold">{details.suggestions}</span> {details.suggestions > 1 ? "suggestions" : "suggestion"} de Capsela à découvrir
                  </li>
                </ul>
                <button onClick={actions.openAdd} className="mt-[8px] text-[13px] text-terracotta cursor-pointer py-[6px]">
                  + Ajouter une pièce que je possède
                </button>
              </Card>
            )}

            {/* Les atouts : seulement ce que les chiffres ci-dessus rendent vrai. */}
            {(details.palette.length > 0 || userStyleLabel || details.indispensables + details.signatures > 0) && (
              <div className="mt-[14px] rounded-bloc px-4 py-[16px]" style={{ background: "var(--color-chip-soft-bg)" }}>
                <div className="t-titre-carte text-ink">Les atouts de ta capsule</div>
                <ul className="mt-[10px] flex flex-col gap-[8px]">
                  {[
                    details.palette.length > 0 &&
                      `Dominée par ${enumeration(details.palette.slice(0, 3).map((c) => c.nom.toLowerCase()))}.`,
                    details.indispensables > 0 &&
                      `${details.indispensables} ${details.indispensables > 1 ? "indispensables faciles" : "indispensable facile"} à associer${details.signatures > 0 ? `, ${details.signatures} ${details.signatures > 1 ? "pièces signature" : "pièce signature"} pour le caractère` : ""}.`,
                    !details.indispensables && details.signatures > 0 && `${details.signatures} ${details.signatures > 1 ? "pièces signature" : "pièce signature"} pour le caractère.`,
                    (exploredStyleLabel || userStyleLabel) && `Pensée pour ${exploredStyleLabel ? "le style" : nbStylesProfil > 1 ? "tes styles" : "ton style"} ${exploredStyleLabel ?? userStyleLabel}.`,
                  ]
                    .filter((t): t is string => Boolean(t))
                    .map((t) => (
                      <li key={t} className="flex items-start gap-[10px] text-[13px] text-ink leading-[1.45]">
                        <span aria-hidden="true" className="text-terracotta text-[11px] mt-[2px]">✦</span>
                        {t}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {toast && (
        <div
          className="absolute inset-x-0 z-30 px-6"
          style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)" }}
          role="status"
        >
          <div className="bg-ink rounded-full py-[12px] px-4 text-[12px] text-cream text-center shadow-lg">{toast}</div>
        </div>
      )}

      {/* Les feuilles de l'écran : saison, « Pourquoi cette tenue ? » et filtres d'Explorer. Une seule ouverte à la fois. */}
      <BottomSheet
        title={
          feuille === "saison"
            ? "Choisir la saison"
            : feuille === "pourquoi"
              ? "Pourquoi cette tenue ?"
              : feuille === "categorie"
                ? "Pièces à afficher"
                : feuille === "couleur"
                  ? "Couleur"
                  : "Trier"
        }
        open={feuille !== null}
        onClose={() => setFeuille(null)}
      >
        {feuille === "saison" && (
          <div className="flex flex-col gap-[8px]">
            {CAPSULE_SEASONS.map((s) => {
              const n = piecesParSaison?.[s] ?? 0;
              return (
                <OptionRow
                  key={s}
                  label={s}
                  description={n > 0 ? pieces(n) : "Aucune pièce pour cette saison"}
                  on={s === capsuleSeason}
                  accent
                  onClick={() => {
                    if (n === 0 && s !== capsuleSeason) return;
                    actions.setCapsuleSeason(s);
                    setFeuille(null);
                  }}
                />
              );
            })}
          </div>
        )}
        {feuille === "pourquoi" && (
          <ul className="flex flex-col gap-[10px]">
            {raisonsTenue.map((r) => (
              <li key={r} className="flex items-start gap-[10px] text-[13px] text-ink leading-[1.45]">
                <span aria-hidden="true" className="text-terracotta text-[11px] mt-[2px]">✦</span>
                {r}
              </li>
            ))}
          </ul>
        )}
        {feuille === "categorie" && (
          <div className="flex flex-col gap-[8px]">
            {[
              { cle: "toutes" as const, label: "Toutes les pièces", n: entrees.length },
              { cle: "favoris" as const, label: "Mes favoris", n: entrees.filter((e) => favorisSet.has(cleEntree(e))).length },
              ...categories.map((c) => ({ cle: c.cat, label: c.libelle, n: c.n })),
            ].map((o) => (
              <OptionRow
                key={o.cle}
                label={o.label}
                description={pieces(o.n)}
                on={filtresValides.categorie === o.cle}
                accent
                onClick={() => {
                  setFiltres({ ...filtresValides, categorie: o.cle });
                  setFeuille(null);
                }}
              />
            ))}
          </div>
        )}
        {feuille === "couleur" && (
          <div className="flex flex-col gap-[8px]">
            <OptionRow
              label="Toutes les couleurs"
              on={!filtresValides.couleur}
              accent
              onClick={() => {
                setFiltres({ ...filtresValides, couleur: null });
                setFeuille(null);
              }}
            />
            {couleurs.map((c) => (
              <OptionRow
                key={c.nom}
                label={c.nom}
                description={pieces(c.n)}
                pastilles={[c.hex]}
                on={filtresValides.couleur?.toLowerCase() === c.nom.toLowerCase()}
                accent
                onClick={() => {
                  setFiltres({ ...filtresValides, couleur: c.nom });
                  setFeuille(null);
                }}
              />
            ))}
          </div>
        )}
        {feuille === "tri" && (
          <div className="flex flex-col gap-[8px]">
            {(Object.keys(LIBELLES_TRI) as TriExplorer[]).map((t) => (
              <OptionRow
                key={t}
                label={LIBELLES_TRI[t]}
                on={filtresValides.tri === t}
                accent
                onClick={() => {
                  setFiltres({ ...filtresValides, tri: t });
                  setFeuille(null);
                }}
              />
            ))}
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        title={fiche?.vue === "remplacer" ? "Remplacer cette pièce" : "Suggestion"}
        open={Boolean(fiche && pieceFiche)}
        onClose={() => setFiche(null)}
      >
        {pieceFiche && fiche?.vue === "detail" && (
          <>
            {/* Hiérarchie du polish (25/09/2026) : la pièce d'abord, puis ce
                qu'elle est, pourquoi elle est là, puis les actions. */}
            <div className="w-[148px] mx-auto">
              <Vignette item={pieceFiche} arrondi={18} marge={0.08} />
            </div>
            <div className="text-center mt-[18px]">
              <div className="flex justify-center">
                <Statut possedee={false} />
              </div>
              <div className="t-titre-section text-ink mt-[8px]">{pieceFiche.name}</div>
              {syntheseFiche && <div className="text-[12px] text-muted mt-[6px]">{syntheseFiche}</div>}
            </div>

            {/* Seulement les raisons que la sélection a réellement lues
                (raisonsSuggestion) ; aucune, et la section disparaît. */}
            {raisons.length > 0 && (
              <div className="mt-[28px]">
                <div className="t-surtitre text-muted mb-[12px]">Pourquoi Capsela te la propose ?</div>
                <ul className="flex flex-col gap-[10px]">
                  {raisons.map((r) => (
                    <li key={r.cle} className="flex items-start gap-[10px] text-[13px] text-ink leading-[1.45]">
                      <span aria-hidden="true" className="text-terracotta text-[11px] mt-[2px]">✦</span>
                      {r.texte}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/*
              « Découvrir la pièce » (brief, 7.1) : seulement quand un lien marchand est configuré (`lien_affiliation`, mappé sur
              affLink). Aucun ne l'est au 01/11/2026 : le bouton ne s'affiche donc pas encore. Le clic est mesuré, jamais compté
              comme un achat, et la mention de transparence l'accompagne.
            */}
            {pieceFiche.affLink && (
              <>
                <a
                  href={pieceFiche.affLink}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  onClick={() => suivreEvenement("clic_lien_affilie", mesure(pieceFiche.id))}
                  className="mt-[30px] block w-full text-center rounded-full py-[15px] t-bouton bg-terracotta-deep text-cream cursor-pointer"
                >
                  Découvrir la pièce
                </a>
                <div className="text-[11px] text-muted text-center mt-[6px]">Lien partenaire : Capsela peut percevoir une commission, sans surcoût pour toi.</div>
              </>
            )}
            {pieceFicheComposable && (
              <Button
                variante={pieceFiche.affLink ? "contour" : "principal"}
                className={pieceFiche.affLink ? "mt-[12px]" : "mt-[30px]"}
                onClick={() => composerAvec(pieceFiche, false)}
              >
                Composer avec cette pièce
              </Button>
            )}
            <button
              onClick={() => {
                suivreEvenement("piece_deja_possedee", mesure(pieceFiche.id));
                setFiche(null);
                actions.startReplace(pieceFiche, "capsule");
              }}
              className={(pieceFicheComposable || pieceFiche.affLink ? "mt-[12px]" : "mt-[30px]") + " w-full border border-border text-terracotta text-center rounded-full py-[13px] text-[13px] cursor-pointer"}
            >
              Je possède déjà cette pièce
            </button>
            <button
              onClick={() => {
                setFiche(null);
                actions.openItemOutfits(pieceFiche.id);
              }}
              className="mt-[6px] w-full text-center text-[13px] text-terracotta py-[11px] cursor-pointer"
            >
              Voir des tenues avec cette pièce
            </button>
            <button
              onClick={() => setFiche({ id: pieceFiche.id, vue: "remplacer" })}
              className="w-full text-center text-[13px] text-terracotta py-[11px] cursor-pointer"
            >
              Remplacer cette pièce
            </button>
            <button onClick={() => pasInteressee(pieceFiche)} className="w-full text-center text-[12px] text-muted py-[9px] cursor-pointer">
              {profile.gender === "homme" ? "Je ne suis pas intéressé" : "Je ne suis pas intéressée"}
            </button>
          </>
        )}

        {pieceFiche && fiche?.vue === "remplacer" && (
          <>
            <div className="text-[13px] text-ink leading-[1.5]">
              {alternatives.length > 0 ? (
                <>
                  À la place de <span className="font-semibold">{pieceFiche.name}</span>, voici ce que Capsela retient pour ta
                  capsule {capsuleSeason}.
                </>
              ) : (
                <>
                  Capsela n&apos;a pas d&apos;autre pièce de cette catégorie à te proposer pour ta capsule {capsuleSeason}.
                </>
              )}
            </div>
            {alternatives.length > 0 && (
              <div className="flex flex-col gap-[8px] mt-[14px]">
                {alternatives.map((a) => (
                  <button
                    key={a.piece.id}
                    onClick={() => choisirAlternative(a)}
                    className="flex items-center gap-[12px] bg-card border border-border rounded-tuile px-[12px] py-[10px] text-left cursor-pointer"
                  >
                    <div className="w-[48px] flex-shrink-0">
                      <Vignette item={a.piece} arrondi={10} marge={0.08} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-ink leading-[1.3]">{a.piece.name}</div>
                      <div className="text-[11px] text-muted mt-[2px]">
                        {[CATLABEL[a.piece.cat], a.piece.color].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <span className="text-[12px] text-terracotta flex-shrink-0">Choisir</span>
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setFiche({ id: pieceFiche.id, vue: "detail" })}
              className="mt-[14px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer"
            >
              Retour
            </button>
          </>
        )}
      </BottomSheet>
    </>
  );
}
