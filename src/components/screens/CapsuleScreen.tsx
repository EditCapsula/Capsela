"use client";

import TitrePage from "@/components/TitrePage";
import { useEffect, useMemo, useRef, useState } from "react";
import { useContexteRepris, useDefilementRepris, useGarderContexte } from "@/lib/memoireEcrans";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import OptionRow from "@/components/OptionRow";
import SegmentedControl, { type Segment } from "@/components/SegmentedControl";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import GlyphePiece from "@/components/GlyphePiece";
import SelectionPenseePourToi, { DetailSelection } from "@/components/SelectionPenseePourToi";
import Vignette from "@/components/VignettePiece";
import FicheSuggestion, { type AssociationFiche } from "@/components/FicheSuggestion";
import { calculerIdeesTenues, poolPourIdees } from "@/components/screens/ItemOutfitsScreen";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { isSupabaseConfigured } from "@/lib/supabase";
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
  piecesCles,
  phraseSuggestion,
  piecesDuDressingPourSaison,
  type AlternativeRemplacement,
} from "@/lib/capsuleEcran";
import {
  avancerOuChanger,
  emplacementFacultatif,
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
  criteresDeSelection,
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
import { libelleStyles, paletteHexes, silhouetteForme, styleLabel, stylesLabels } from "@/lib/profile";
import { useCapsela } from "@/lib/store";
import { resolvePhotoCatalogue } from "@/lib/catalogImages";
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


/*
 * Les visuels de saison (public/images/saisons/, fournis les 25/09 et 01/10/2026) illustraient le bandeau de Pièces clés jusqu'au
 * 05/11/2026 : la maquette y met la pièce clé en avant. Les fichiers restent en place, inchangés.
 */

/** « 1 pièce » / « 12 pièces ». */
function pieces(n: number): string {
  return `${n} ${n > 1 ? "pièces" : "pièce"}`;
}

/** « a », « a et b », « a, b et c ». */
function enumeration(parties: string[]): string {
  if (parties.length <= 1) return parties.join("");
  return parties.slice(0, -1).join(", ") + " et " + parties[parties.length - 1];
}


type Fiche = { id: number; vue: "detail" | "remplacer" };
type Parcours = { ids: number[]; index: number; rouvrir?: boolean };

/** Ce que l'écran garde du parcours à son départ (relu au démontage par useGarderContexte), posé par les actions qui quittent l'écran. */
function useParcoursAGarder() {
  const valeur = useRef<Parcours | null>(null);
  return {
    lire: () => valeur.current,
    poser: (p: Parcours | null) => {
      valeur.current = p;
    },
  };
}
type Onglet = "composer" | "explorer" | "cles" | "details";
type Feuille = "saison" | "selection" | "couleur" | "tri" | null;

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

/**
 * L'anneau de « Composition de ta capsule » (maquette du 05/11/2026) : dressing en encre, sélection Capsela en terracotta, le total
 * compté au centre. Une part nulle ne trace rien.
 */
function Anneau({ parts, total }: { parts: [number, number]; total: number }) {
  const r = 38;
  const tour = 2 * Math.PI * r;
  const somme = Math.max(1, parts[0] + parts[1]);
  const couleurs = ["var(--color-ink)", "var(--color-terracotta)"];
  // Deux parts au plus : la seconde commence où finit la première.
  const longueurs = parts.map((n) => (tour * Math.max(0, n)) / somme);
  return (
    <span className="relative flex-none w-[104px] h-[104px] block">
      <svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true" className="-rotate-90">
        <circle cx="52" cy="52" r={r} fill="none" stroke="var(--color-chip-soft-bg)" strokeWidth="11" />
        {longueurs.map((long, i) =>
          long > 0 ? (
            <circle key={i} cx="52" cy="52" r={r} fill="none" stroke={couleurs[i]} strokeWidth="11" strokeDasharray={`${long} ${tour - long}`} strokeDashoffset={i === 0 ? 0 : -longueurs[0]} />
          ) : null
        )}
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="t-chiffre text-ink">{total}</span>
        <span className="text-[10.5px] text-muted mt-[2px]">{total > 1 ? "pièces" : "pièce"}</span>
      </span>
    </span>
  );
}

/** Le signet de « Enregistrer cette tenue » (maquette du 05/11/2026) : plein une fois la tenue enregistrée. */
function Signet({ plein }: { plein: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={plein ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 4h12v16l-6-4.2L6 20z" />
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
  const { state, weather, actions, vestiairePool, votesSuggestions } = useCapsela();
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
    /** Le parcours des suggestions en cours ; `rouvrir` : la fiche se rouvre au retour (après « J'aime », « Je possède déjà »…). */
    parcours: Parcours | null;
  };
  const repris = useContexteRepris<ContexteCapsule>("capsule");
  // Ce qui est gardé au départ de l'écran : le parcours, et s'il faut rouvrir la fiche au retour.
  const parcoursAGarder = useParcoursAGarder();
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
  // « Une sélection pensée pour toi » (05/11/2026) : ce qui a réellement orienté la capsule, avec les chiffres des pièces montrées.
  const criteresSelection = useMemo(
    () =>
      criteresDeSelection({
        profile,
        styleExplore: exploredStyleId,
        saison: capsuleSeason,
        possedees: entrees.filter((e) => e.possedee).length,
        suggestions: entrees.filter((e) => !e.possedee).length,
      }),
    [profile, exploredStyleId, capsuleSeason, entrees]
  );
  const cleTenue = clePieces(piecesTenue.map((it) => it.id)).join(",");
  const tenueEnregistree = state.savedLooks.some((l) => clePieces(l.pieceIds).join(",") === cleTenue);

  useGarderContexte("capsule", (): ContexteCapsule => ({ onglet, filtres, grille, composition, defilement: defilement.position.current, parcours: parcoursAGarder.lire() }));

  const avancerActif = (pas: 1 | -1) => {
    if (!emplacementActif) return;
    // Au bout des pièces de l'emplacement, la flèche passe à l'emplacement voisin (05/11/2026, avancerOuChanger).
    const r = avancerOuChanger(selection, emplacementActif.cle, presents.map((e) => e.cle), groupes, pas);
    changerSelection(r.sel, r.actif);
  };
  // Le glissement horizontal sur la planche change la pièce de l'emplacement actif ; un geste surtout vertical reste un défilement.
  const toucher = useRef<{ x: number; y: number } | null>(null);
  // La tuile de l'emplacement actif reste visible dans la rangée qui défile (05/11/2026) : choisi depuis la planche, un emplacement
  // pouvait devenir actif hors de l'écran.
  const cleActive = emplacementActif?.cle;
  const cleVue = useRef(cleActive);
  useEffect(() => {
    // Seulement quand l'emplacement CHANGE : au premier affichage, la page ne doit pas sauter jusqu'aux tuiles.
    if (!cleActive || cleVue.current === cleActive) return;
    cleVue.current = cleActive;
    document.querySelector(`[data-emplacement="${cleActive}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [cleActive]);

  const composerAvec = (it: Item, possedee: boolean) => {
    const cle = emplacementDe(it.cat);
    if (!cle) return;
    const index = groupes[cle].findIndex((e) => e.item.id === it.id && e.possedee === possedee);
    if (index < 0) return;
    changerSelection(choisir(selection, cle, index, groupes), cle);
    setFiche(null);
    setOnglet("composer");
    zone.current?.scrollTo({ top: 0 });
  };

  // ----- EXPLORER -----
  // UN SEUL ÉTAT « AIMÉE » (arbitré le 02/11/2026) : le cœur d'une suggestion EST son vote « J'aime » (votesSuggestions.ts, gardé dans le
  // compte) ; seules les pièces du dressing gardent leurs cœurs sur l'appareil (favorisPieces.ts). Les cœurs de suggestions posés avant
  // sur l'appareil deviennent des votes au premier passage.
  const [favorisDressing, setFavorisDressing] = useState<string[]>(() => lireFavorisPieces(userId).filter((k) => k.startsWith("d")));
  useEffect(() => {
    const anciens = lireFavorisPieces(userId).filter((k) => k.startsWith("c"));
    if (!anciens.length) return;
    for (const k of anciens) if (!votesSuggestions[k.slice(1)]) void actions.voterSuggestion(Number(k.slice(1)), "aimee");
    ecrireFavorisPieces(userId, lireFavorisPieces(userId).filter((k) => k.startsWith("d")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  const favorisSet = useMemo(
    () => new Set([...favorisDressing, ...Object.entries(votesSuggestions).filter(([, v]) => v === "aimee").map(([id]) => `c${id}`)]),
    [favorisDressing, votesSuggestions]
  );
  const basculerFavori = (e: EntreeCapsule) => {
    const cle = cleEntree(e);
    if (!e.possedee) {
      void actions.voterSuggestion(e.item.id, favorisSet.has(cle) ? null : "aimee").then(signalerSiNonSynchronise);
      return;
    }
    const suivants = favorisSet.has(cle) ? favorisDressing.filter((k) => k !== cle) : [...favorisDressing, cle];
    setFavorisDressing(suivants);
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
  // Les tuiles d'Explorer : une pièce de la catégorie en aperçu (la première, dans l'ordre de la capsule), et le nombre compté.
  const nbFavoris = entrees.filter((e) => favorisSet.has(cleEntree(e))).length;
  const tuilesExplorer: { cle: FiltresExplorer["categorie"]; libelle: string; n: number; apercu: Item | null }[] = [
    { cle: "toutes", libelle: "Tout", n: entrees.length, apercu: entrees[0]?.item ?? null },
    ...(nbFavoris > 0 || filtresValides.categorie === "favoris" ? [{ cle: "favoris" as const, libelle: "Favoris", n: nbFavoris, apercu: null }] : []),
    ...categories.map((c) => ({ cle: c.cat, libelle: c.libelle, n: c.n, apercu: entrees.find((e) => e.item.cat === c.cat)?.item ?? null })),
  ];
  const couleurFiltre = filtresValides.couleur ? couleurs.find((c) => c.nom.toLowerCase() === filtresValides.couleur!.toLowerCase()) : null;

  // ----- PIÈCES CLÉS et DÉTAILS -----
  const clesSaison = useMemo(() => piecesCles(capsule, 3, capsuleSeason), [capsule, capsuleSeason]);
  const clesFamilles = useMemo(() => piecesClesParFamille(capsule, clesSaison, capsuleProfile), [capsule, clesSaison, capsuleProfile]);
  const details = useMemo(() => detailsCapsule(entrees), [entrees]);
  const maxCompo = Math.max(1, ...details.composition.map((c) => c.n));
  // La pièce clé mise en avant (maquette du 05/11/2026) : un index borné, la liste pouvant raccourcir (autre saison, pièce retirée).
  const [indexCle, setIndexCle] = useState(0);
  const indexCleValide = clesFamilles.length ? Math.min(indexCle, clesFamilles.length - 1) : 0;
  const cleVedette = clesFamilles[indexCleValide] ?? null;
  const avancerCle = (pas: 1 | -1) => setIndexCle((indexCleValide + pas + clesFamilles.length) % clesFamilles.length);
  const toucherCle = useRef<{ x: number; y: number } | null>(null);

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

  // LE PARCOURS DES SUGGESTIONS (fiche refondue le 02/11/2026) : la liste est FIGÉE à l'ouverture — l'ordre de l'onglet d'où l'on vient —,
  // pour que « 3 / 10 » reste vrai pendant que la capsule se recompose (une pièce rejetée en fait entrer une autre). Une pièce sortie de
  // la capsule entre-temps est sautée. Rouvert au retour d'un écran ouvert depuis la fiche (associations, ajout au dressing).
  const premiereDisponible = (p: Parcours, depuis: number): number => {
    for (let i = depuis; i < p.ids.length; i++) if (!state.suggestedExcluded.includes(p.ids[i])) return i;
    return -1;
  };
  const [parcours, setParcours] = useState<Parcours | null>(() => {
    const p = repris?.parcours;
    if (!p?.rouvrir) return null;
    const i = premiereDisponible(p, p.index);
    return i < 0 ? null : { ids: p.ids, index: i };
  });
  const [fiche, setFiche] = useState<Fiche | null>(() => (parcours ? { id: parcours.ids[parcours.index], vue: "detail" } : null));
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

  // COMMENT LE PORTER ? Les idées du moteur pour la pièce (calculerIdeesTenues, celles de l'écran « Comment porter »), sur le même pool
  // (dressing d'abord, la capsule pour compléter) ; trois au plus, et seulement celles qui posent la pièce. Calculées quand la fiche est
  // ouverte ; un échec ne bloque jamais la fiche : la section disparaît.
  const idees = useMemo(() => {
    if (!pieceFiche || fiche?.vue !== "detail") return { variations: [], cartes: [] as AssociationFiche[] };
    try {
      const variations = calculerIdeesTenues(
        pieceFiche,
        poolPourIdees(state.items, capsule, capsuleSeason),
        state.items,
        capsuleSeason,
        paletteHexes(profile),
        profile.gender,
        colorimetrieMoteur(profile.colorimetrie)
      );
      const connues = [...state.items, ...vestiairePool];
      const cartes = variations
        .filter((v) => v.ids.includes(pieceFiche.id))
        .slice(0, 3)
        .map((v) => ({ ids: v.ids, pieces: v.ids.map((id) => connues.find((i) => i.id === id)).filter((i): i is Item => Boolean(i)) }))
        .filter((c) => c.pieces.length >= 2);
      return { variations, cartes };
    } catch {
      return { variations: [], cartes: [] as AssociationFiche[] };
    }
  }, [pieceFiche, fiche?.vue, state.items, capsule, capsuleSeason, profile, vestiairePool]);

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

  // Un vote que le compte n'a pas pu enregistrer reste sur l'appareil et repart à la visite suivante : on le dit une fois par visite.
  const syncSignalee = useRef(false);
  const signalerSiNonSynchronise = (ok: boolean) => {
    if (ok || syncSignalee.current || !isSupabaseConfigured || !userId) return;
    syncSignalee.current = true;
    setToast("Ton choix est gardé sur cet appareil ; il rejoindra ton compte plus tard.");
  };

  // Les suggestions dans l'ordre de l'onglet d'où l'on ouvre la fiche.
  const suggestionsDeLOnglet = (): number[] => {
    const source = onglet === "explorer" ? galerie : onglet === "cles" ? clesFamilles.map((c) => ({ item: c.item, possedee: false })) : entrees;
    return source.filter((e) => !e.possedee).map((e) => e.item.id);
  };

  const ouvrir = (item: Item, possedee: boolean) => {
    if (possedee) {
      actions.openItem(item.id, false);
      return;
    }
    const ids = suggestionsDeLOnglet();
    const liste = ids.includes(item.id) ? ids : [item.id, ...ids];
    setParcours({ ids: liste, index: liste.indexOf(item.id) });
    setFiche({ id: item.id, vue: "detail" });
    suivreEvenement("fiche_piece_capsule", mesure(item.id));
  };

  const fermerFiche = () => {
    setFiche(null);
    setParcours(null);
    parcoursAGarder.poser(null);
  };

  /** La suggestion suivante du parcours ; aucune : la fiche se ferme et le dit. */
  const suivante = (exclue?: number) => {
    if (!parcours) return fermerFiche();
    let i = parcours.index + 1;
    while (i < parcours.ids.length && (state.suggestedExcluded.includes(parcours.ids[i]) || parcours.ids[i] === exclue)) i++;
    if (i >= parcours.ids.length) {
      fermerFiche();
      setToast("Tu as vu toutes les suggestions de ta capsule.");
      return;
    }
    setParcours({ ...parcours, index: i });
    setFiche({ id: parcours.ids[i], vue: "detail" });
  };

  /** Quitter l'écran depuis la fiche : elle se rouvrira au retour, sur la suggestion `index`. */
  const reprendreAuRetour = (index: number) => {
    if (parcours) parcoursAGarder.poser({ ids: parcours.ids, index, rouvrir: true });
  };

  // Un vote en cours de transition : pas de second vote (double appui, glissement suivi d'un appui).
  const [occupe, setOccupe] = useState(false);

  const aimer = (piece: Item) => {
    if (occupe) return;
    setOccupe(true);
    if (votesSuggestions[String(piece.id)] !== "aimee") void actions.voterSuggestion(piece.id, "aimee").then(signalerSiNonSynchronise);
    // « Découvrir les associations » : l'écran « Comment porter » de la pièce ; au retour, la fiche reprend à la suggestion suivante.
    setTimeout(() => {
      setOccupe(false);
      if (parcours) reprendreAuRetour(parcours.index + 1);
      setFiche(null);
      actions.openItemOutfits(piece.id);
    }, 260);
  };

  const rejeter = (piece: Item) => {
    if (occupe) return;
    setOccupe(true);
    void actions.voterSuggestion(piece.id, "rejetee").then(signalerSiNonSynchronise);
    setToast("Retirée de ta capsule");
    setTimeout(() => {
      setOccupe(false);
      suivante(piece.id);
    }, 260);
  };

  const possede = (piece: Item) => {
    if (occupe) return;
    suivreEvenement("piece_deja_possedee", mesure(piece.id));
    // La possession n'est enregistrée qu'une fois la pièce du dressing sauvée (store, saveItem) : annuler l'ajout n'écrit rien.
    if (parcours) reprendreAuRetour(parcours.index + 1);
    setFiche(null);
    actions.startReplace(piece, "capsule");
  };

  const choisirAlternative = (a: AlternativeRemplacement) => {
    for (const id of a.exclusions) if (!state.suggestedExcluded.includes(id)) void actions.voterSuggestion(id, "remplacee").then(signalerSiNonSynchronise);
    setToast("Ta capsule est mise à jour");
    suivante(a.exclusions[a.exclusions.length - 1]);
  };

  const enregistrerTenue = () => {
    actions.basculerIdeeLook(piecesTenue.map((it) => it.id), "all");
    setToast(tenueEnregistree ? "Tenue retirée de tes looks" : "Tenue enregistrée dans tes looks");
  };

  const syntheseFiche = pieceFiche ? [CATLABEL[pieceFiche.cat], pieceFiche.color, pieceFiche.matiere].filter(Boolean).join(" · ") : "";

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
        <TitrePage
          chapeau={
            <>
              {pieces(capsule.length)} {capsule.length > 1 ? "sélectionnées" : "sélectionnée"}{" "}
              {exploredStyleLabel ? "dans ce style" : "pour composer ton style"}
              {possedees.length > 0 && <>, et {pieces(possedees.length)} de ton dressing.</>}
              {!possedees.length && "."}
            </>
          }
        >
            Ma Capsule{" "}
            <button
              type="button"
              onClick={() => setFeuille("saison")}
              data-tour="capsule-saison"
              className="italic text-terracotta cursor-pointer"
              aria-label={`Saison ${capsuleSeason}, changer de saison`}
            >
              {capsuleSeason}
            </button>
        </TitrePage>
        <div>
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

        <div className="mt-[16px]" data-tour="capsule-onglets">
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
                    afficherCouche
                    transitionDouce
                    // Toucher une pièce (05/11/2026, demandé : « au clic sur une autre pièce on devrait basculer sur la catégorie concernée ») :
                    // une pièce d'un autre emplacement le rend actif, et ses flèches la font varier ; une pièce de l'emplacement déjà actif
                    // ouvre sa fiche, comme avant.
                    onPiece={(it) => {
                      const cle = emplacementDe(it.cat);
                      if (cle && cle !== emplacementActif?.cle && groupes[cle].length) changerSelection(selection, cle);
                      else ouvrir(it, composees.find((e) => e.item.id === it.id)?.possedee ?? false);
                    }}
                  />
                )}
              </div>
              {/*
                L'EN-TÊTE DE LA PLANCHE (maquette du 05/11/2026) : « Ta sélection du moment », le nombre de pièces posées, et le cœur
                qui enregistre la tenue dans « Mes looks » — la même action que le bouton dessous (basculerIdeeLook), pas un second état.
              */}
              <div className="absolute inset-x-0 top-0 flex items-start justify-between px-[14px] pt-[12px] pointer-events-none">
                <div>
                  <div className="text-[12px] font-semibold text-ink leading-[16px]">
                    <span aria-hidden="true" className="text-terracotta mr-[5px]">✦</span>Ta sélection du moment
                  </div>
                  {piecesTenue.length > 0 && <div className="text-[11px] text-muted leading-[14px] mt-[2px]">{pieces(piecesTenue.length)}</div>}
                </div>
                {piecesTenue.length >= 2 && (
                  <button
                    type="button"
                    onClick={enregistrerTenue}
                    aria-pressed={tenueEnregistree}
                    aria-label={tenueEnregistree ? "Retirer cette tenue de mes looks" : "Enregistrer cette tenue dans mes looks"}
                    className={"pointer-events-auto -mt-[4px] -mr-[4px] w-[40px] h-[40px] flex items-center justify-center cursor-pointer " + (tenueEnregistree ? "text-terracotta" : "text-ink-soft")}
                  >
                    <span className="w-[32px] h-[32px] rounded-full flex items-center justify-center" style={{ background: "rgba(250,247,241,.88)" }}>
                      <Coeur plein={tenueEnregistree} />
                    </span>
                  </button>
                )}
              </div>
              {emplacementActif && (presents.length > 1 || groupes[emplacementActif.cle].length + (emplacementFacultatif(emplacementActif.cle, groupes, selection) ? 1 : 0) > 1) && (
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
            {/* data-tour : la 3e étape de la visite guidée de la Capsule (lib/visites.ts). */}
            <div
              data-tour="capsule-categories"
              className="scrollarea -mx-6 px-6 flex gap-[8px] overflow-x-auto mt-[12px] pb-[2px]"
              role="tablist"
              aria-label="Pièce à faire varier"
            >
              {presents.map((e) => {
                const n = groupes[e.cle].length;
                const p = position(selection, e.cle, n);
                const on = emplacementActif?.cle === e.cle;
                return (
                  <button
                    key={e.cle}
                    role="tab"
                    aria-selected={on}
                    data-emplacement={e.cle}
                    onClick={() => changerSelection(selection, e.cle)}
                    className={
                      "flex-none w-[66px] rounded-tuile border py-[7px] flex flex-col items-center gap-[2px] cursor-pointer motion-safe:transition-colors motion-safe:duration-200 motion-safe:active:scale-[.97] " +
                      (on ? "border-terracotta text-terracotta-deep" : "border-border bg-card text-ink")
                    }
                    style={on ? { background: "var(--color-chip-soft-bg)" } : undefined}
                  >
                    <GlyphePiece cle={e.cle} taille={22} />
                    <span className="text-[11px] leading-[14px]">{e.libelle}</span>
                    <span className={"text-[10px] leading-[12px] " + (on ? "text-terracotta" : "text-muted")}>{p < 0 ? `Sans · ${n}` : `${p + 1} / ${n}`}</span>
                  </button>
                );
              })}
            </div>

            <SelectionPenseePourToi criteres={criteresSelection} onOuvrir={() => setFeuille("selection")} />

            {piecesTenue.length >= 2 && (
              <Button variante={tenueEnregistree ? "contour" : "principal"} className="mt-[14px]" onClick={enregistrerTenue}>
                <Signet plein={tenueEnregistree} />
                {tenueEnregistree ? "Enregistrée dans mes looks" : "Enregistrer cette tenue"}
              </Button>
            )}
          </div>
        )}

        {/* ====================================== EXPLORER ====================================== */}
        {onglet === "explorer" && entrees.length > 0 && (
          <div className="mt-[6px]">
            {/*
              LES CATÉGORIES EN TUILES (maquette du 05/11/2026), à la place de la liste déroulante : chacune montre une de ses pièces et
              son nombre. « Favoris » n'apparaît qu'une fois un cœur posé (jamais une tuile vide, brief, 4.2).
            */}
            <div className="scrollarea -mx-6 px-6 flex gap-[8px] overflow-x-auto pt-[10px] pb-[2px]" role="tablist" aria-label="Pièces à afficher">
              {tuilesExplorer.map((t) => {
                const on = filtresValides.categorie === t.cle;
                return (
                  <button
                    key={t.cle}
                    role="tab"
                    aria-selected={on}
                    onClick={() => setFiltres({ ...filtresValides, categorie: t.cle })}
                    className={
                      "flex-none w-[78px] rounded-tuile border p-[5px] pb-[7px] flex flex-col items-center cursor-pointer motion-safe:transition-colors motion-safe:duration-200 " +
                      (on ? "border-terracotta text-terracotta-deep" : "border-border bg-card text-ink")
                    }
                    style={on ? { background: "var(--color-chip-soft-bg)" } : undefined}
                  >
                    <span className="block w-full">
                      {t.apercu ? (
                        <Vignette item={t.apercu} arrondi={9} />
                      ) : (
                        <span className="w-full flex items-center justify-center text-terracotta rounded-[9px] border border-border" style={{ aspectRatio: "4/5", background: "var(--color-photo-bg)" }}>
                          <Coeur plein />
                        </span>
                      )}
                    </span>
                    <span className="text-[11px] leading-[14px] mt-[5px] truncate max-w-full">{t.libelle}</span>
                    <span className={"text-[10px] leading-[12px] " + (on ? "text-terracotta" : "text-muted")}>{t.n}</span>
                  </button>
                );
              })}
            </div>

            {/* Le titre et les outils restent accessibles pendant le défilement (brief, 4.2). */}
            <div className="sticky top-0 z-10 -mx-6 px-6 pt-[12px] pb-[8px]" style={{ background: "var(--color-cream)" }}>
              <div className="flex items-center gap-[6px]">
                <h2 className="flex-1 min-w-0 t-titre-carte text-ink truncate">
                  {libelleCategorie} ({galerie.length})
                </h2>
                <button
                  onClick={() => setFeuille("couleur")}
                  aria-label={couleurFiltre ? `Couleur : ${couleurFiltre.nom}` : "Filtrer par couleur"}
                  className={"flex-none w-[38px] h-[38px] rounded-full border bg-card flex items-center justify-center cursor-pointer " + (couleurFiltre ? "border-terracotta" : "border-border")}
                >
                  <span
                    className="w-[18px] h-[18px] rounded-full"
                    style={{
                      background: couleurFiltre?.hex ?? `conic-gradient(${couleurs.slice(0, 6).map((c) => c.hex).join(", ") || "var(--color-border)"})`,
                      boxShadow: "inset 0 0 0 1px rgba(29,26,22,.12)",
                    }}
                  />
                </button>
                <button
                  onClick={() => setFeuille("tri")}
                  aria-label={`Filtres et tri : ${LIBELLES_TRI[filtresValides.tri]}`}
                  className="flex-none w-[38px] h-[38px] rounded-full border border-border bg-card text-ink flex items-center justify-center cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
                    <circle cx="16" cy="7" r="2" />
                    <circle cx="10" cy="17" r="2" />
                  </svg>
                </button>
                <div className="flex" role="group" aria-label="Présentation">
                  {[true, false].map((g) => (
                    <button
                      key={String(g)}
                      onClick={() => setGrille(g)}
                      aria-pressed={grille === g}
                      aria-label={g ? "En grille" : "En liste"}
                      className={"w-[32px] h-[38px] flex items-center justify-center cursor-pointer " + (grille === g ? "text-terracotta" : "text-muted")}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        {g ? <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
              {couleurFiltre && (
                <button onClick={() => setFiltres({ ...filtresValides, couleur: null })} className="mt-[4px] text-[12px] text-terracotta cursor-pointer">
                  Toutes les couleurs
                </button>
              )}
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
            {/* Le bandeau (maquette du 05/11/2026) : une icône et deux lignes, sans visuel de saison — la pièce mise en avant tient la place. */}
            <Card rayon="bloc" className="px-4 py-[14px] flex items-center gap-[12px]">
              <span className="flex-none w-[38px] h-[38px] rounded-full flex items-center justify-center text-terracotta-deep" style={{ background: "var(--color-chip-soft-bg)" }} aria-hidden="true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
                  <path d="M12 3.5l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L12 15.9l-5 2.8 1.2-5.6L4 9.3l5.6-.6z" />
                </svg>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block t-titre-ligne text-ink">Les indispensables de ta capsule</span>
                <span className="block text-[12px] text-ink-soft leading-[1.45] mt-[3px]">
                  Les pièces qui s&apos;associent facilement, et les pièces signature qui donnent le ton.
                </span>
              </span>
            </Card>

            {clesFamilles.length === 0 ? (
              <div className="mt-[22px] text-center text-[13px] text-muted">
                Aucune pièce de cette capsule n&apos;est marquée indispensable ou signature.
              </div>
            ) : (
              cleVedette && (
                <>
                  {/* LA PIÈCE MISE EN AVANT : les flèches, le glissement et les points parcourent les pièces clés ; la toucher ouvre sa fiche. */}
                  <div className="mt-[14px] bg-card border border-border rounded-feuille overflow-hidden">
                    <div
                      className="relative"
                      style={{ touchAction: "pan-y" }}
                      onTouchStart={(e) => (toucherCle.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
                      onTouchEnd={(e) => {
                        const debut = toucherCle.current;
                        toucherCle.current = null;
                        if (!debut) return;
                        const dx = e.changedTouches[0].clientX - debut.x;
                        const dy = e.changedTouches[0].clientY - debut.y;
                        if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) avancerCle(dx < 0 ? 1 : -1);
                      }}
                    >
                      <button onClick={() => ouvrir(cleVedette.item, false)} className="block w-full cursor-pointer" aria-label={`Ouvrir ${cleVedette.item.name}`}>
                        <span className="block mx-auto w-[54%] pt-[18px] pb-[6px]">
                          <Vignette item={cleVedette.item} arrondi={14} />
                        </span>
                      </button>
                      <button
                        onClick={() => basculerFavori({ item: cleVedette.item, possedee: false })}
                        aria-pressed={favorisSet.has(cleEntree({ item: cleVedette.item, possedee: false }))}
                        aria-label={favorisSet.has(cleEntree({ item: cleVedette.item, possedee: false })) ? `Retirer ${cleVedette.item.name} de mes favoris` : `Ajouter ${cleVedette.item.name} à mes favoris`}
                        className={
                          "absolute top-[8px] right-[8px] w-[40px] h-[40px] flex items-center justify-center cursor-pointer " +
                          (favorisSet.has(cleEntree({ item: cleVedette.item, possedee: false })) ? "text-terracotta" : "text-ink-soft")
                        }
                      >
                        <Coeur plein={favorisSet.has(cleEntree({ item: cleVedette.item, possedee: false }))} />
                      </button>
                      {clesFamilles.length > 1 && (
                        <>
                          <button
                            onClick={() => avancerCle(-1)}
                            aria-label="Pièce clé précédente"
                            className="absolute left-[10px] top-1/2 -translate-y-1/2 w-[40px] h-[40px] rounded-full bg-cream text-ink flex items-center justify-center shadow-sm cursor-pointer"
                          >
                            <Fleche sens="gauche" />
                          </button>
                          <button
                            onClick={() => avancerCle(1)}
                            aria-label="Pièce clé suivante"
                            className="absolute right-[10px] top-1/2 -translate-y-1/2 w-[40px] h-[40px] rounded-full bg-cream text-ink flex items-center justify-center shadow-sm cursor-pointer"
                          >
                            <Fleche sens="droite" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="px-4 pt-[8px] pb-[16px] text-center">
                      <span
                        className="inline-block rounded-full px-[9px] py-[3px] text-[10px] leading-[12px] text-terracotta-deep"
                        style={{ background: "var(--color-chip-soft-bg)" }}
                      >
                        {cleVedette.famille === "signature" ? "Pièce signature" : "Indispensable"}
                      </span>
                      <div className="t-titre-carte text-ink mt-[8px]">{cleVedette.item.name}</div>
                      <p className="text-[12.5px] text-ink-soft leading-[1.5] mt-[6px]" style={{ textWrap: "pretty" }}>
                        {cleVedette.explication}
                      </p>
                      {clesFamilles.length > 1 && (
                        <div className="flex justify-center gap-[6px] mt-[12px]" aria-label={`Pièce ${indexCleValide + 1} sur ${clesFamilles.length}`}>
                          {clesFamilles.map((c, i) => (
                            <span
                              key={c.item.id}
                              aria-hidden="true"
                              className="h-[6px] rounded-full motion-safe:transition-all"
                              style={{ width: i === indexCleValide ? 16 : 6, background: i === indexCleValide ? "var(--color-terracotta)" : "var(--color-dots)" }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {clesFamilles.length > 1 && (
                    <>
                      <div className="t-titre-ligne text-ink mt-[22px]">Tes autres pièces clés</div>
                      <div className="scrollarea -mx-6 px-6 flex items-start gap-[10px] overflow-x-auto mt-[10px] pb-[2px]">
                        {clesFamilles.map((c, i) =>
                          i === indexCleValide ? null : (
                            <button
                              key={c.item.id}
                              onClick={() => setIndexCle(i)}
                              className="flex-none w-[96px] flex flex-col text-left cursor-pointer"
                              aria-label={`Mettre en avant ${c.item.name}`}
                            >
                              <Vignette item={c.item} arrondi={12} />
                              <span className="block text-[12px] text-ink leading-[15px] mt-[6px] line-clamp-2">{c.item.name}</span>
                              <span className="block text-[10.5px] text-muted mt-[2px]">{c.famille === "signature" ? "Signature" : "Indispensable"}</span>
                            </button>
                          )
                        )}
                      </div>
                    </>
                  )}
                </>
              )
            )}
          </div>
        )}

        {/* ====================================== DÉTAILS ====================================== */}
        {onglet === "details" && entrees.length > 0 && (
          <div className="mt-[18px]">
            {/*
              COMPOSITION DE TA CAPSULE (maquette du 05/11/2026) : l'anneau des pièces COMPTÉES, dressing et sélection Capsela. Pas
              d'« associations possibles » : le compteur a été retiré le 22/09/2026 (faux de ×0,5 à ×1,7).
            */}
            <Card rayon="bloc" className="px-4 py-[16px]">
              <div className="t-titre-carte text-ink">Composition de ta capsule</div>
              <div className="flex items-center gap-[18px] mt-[12px]">
                <Anneau parts={[details.dansLeDressing, details.suggestions]} total={details.pieces} />
                <ul className="flex-1 min-w-0 flex flex-col gap-[10px]">
                  {!exploredStyleId && (
                    <li className="flex items-center gap-[9px] text-[13px] text-ink">
                      <span aria-hidden="true" className="w-[10px] h-[10px] rounded-full flex-none" style={{ background: "var(--color-ink)" }} />
                      <span className="flex-1">Dressing</span>
                      <span className="font-semibold">{details.dansLeDressing}</span>
                    </li>
                  )}
                  <li className="flex items-center gap-[9px] text-[13px] text-ink">
                    <span aria-hidden="true" className="w-[10px] h-[10px] rounded-full flex-none" style={{ background: "var(--color-terracotta)" }} />
                    <span className="flex-1">Sélection Capsela</span>
                    <span className="font-semibold">{details.suggestions}</span>
                  </li>
                </ul>
              </div>
              {!exploredStyleId && (
                <button onClick={actions.openAdd} className="mt-[10px] text-[13px] text-terracotta cursor-pointer py-[6px]">
                  + Ajouter une pièce que je possède
                </button>
              )}
            </Card>

            <div className="t-titre-carte text-ink mt-[26px]">Répartition par catégorie</div>
            <ul className="mt-[12px] flex flex-col gap-[12px]">
              {details.composition.map((c) => {
                const cle = emplacementDe(c.cat);
                return (
                  <li key={c.cat} className="flex items-center gap-[12px]">
                    <span className="flex-none w-[34px] h-[34px] rounded-full flex items-center justify-center text-ink-soft bg-card border border-border">
                      {cle && <GlyphePiece cle={cle} taille={20} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline justify-between text-[12.5px]">
                        <span className="text-ink">{c.libelle}</span>
                        <span className="text-muted">{c.n}</span>
                      </span>
                      <span className="block h-[6px] rounded-full mt-[5px] overflow-hidden" style={{ background: "var(--color-chip-soft-bg)" }}>
                        <span className="block h-full rounded-full bg-terracotta" style={{ width: `${(100 * c.n) / maxCompo}%` }} />
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>

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

            {/* L'équilibre (ex-« Les atouts ») : seulement ce que les chiffres ci-dessus rendent vrai. */}
            {(details.palette.length > 0 || userStyleLabel || details.indispensables + details.signatures > 0) && (
              <div className="mt-[26px] rounded-bloc px-4 py-[16px]" style={{ background: "var(--color-chip-soft-bg)" }}>
                <div className="t-titre-carte text-ink">L&apos;équilibre de ton vestiaire</div>
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

      {/* Les feuilles de l'écran : saison, « Une sélection pensée pour toi » et filtres d'Explorer. Une seule ouverte à la fois. */}
      <BottomSheet
        title={
          feuille === "saison"
            ? "Choisir la saison"
            : feuille === "selection"
              ? "Une sélection pensée pour toi"
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
        {feuille === "selection" && <DetailSelection criteres={criteresSelection} />}
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

      {pieceFiche && fiche?.vue === "detail" && (
        <FicheSuggestion
          piece={pieceFiche}
          position={(parcours?.index ?? 0) + 1}
          total={parcours?.ids.length ?? 1}
          etat={votesSuggestions[String(pieceFiche.id)]}
          phrase={phraseSuggestion(pieceFiche, capsuleProfile)}
          synthese={syntheseFiche}
          associations={idees.cartes}
          occupe={occupe}
          onFermer={fermerFiche}
          onAimer={() => aimer(pieceFiche)}
          onRejeter={() => rejeter(pieceFiche)}
          onPossede={() => possede(pieceFiche)}
          onRemplacer={() => setFiche({ id: pieceFiche.id, vue: "remplacer" })}
          onComposer={
            emplacementDe(pieceFiche.cat) && groupes[emplacementDe(pieceFiche.cat)!].some((e) => !e.possedee && e.item.id === pieceFiche.id)
              ? () => {
                  setParcours(null);
                  composerAvec(pieceFiche, false);
                }
              : undefined
          }
          onVoirTenues={() => {
            if (parcours) reprendreAuRetour(parcours.index);
            setFiche(null);
            actions.openItemOutfits(pieceFiche.id);
          }}
          onOuvrirAssociation={(i) => {
            const carte = idees.cartes[i];
            const v = idees.variations.find((x) => clePieces(x.ids).join(",") === clePieces(carte.ids).join(","));
            if (!v) return;
            if (parcours) reprendreAuRetour(parcours.index);
            setFiche(null);
            actions.openIdeeLook(pieceFiche.id, idees.variations, null, { ids: v.ids, occasion: v.occasion, numero: i + 1 });
          }}
          onClicAffilie={() => suivreEvenement("clic_lien_affilie", mesure(pieceFiche.id))}
        />
      )}

      <BottomSheet title="Remplacer cette pièce" open={Boolean(fiche?.vue === "remplacer" && pieceFiche)} onClose={() => setFiche(pieceFiche ? { id: pieceFiche.id, vue: "detail" } : null)}>
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
