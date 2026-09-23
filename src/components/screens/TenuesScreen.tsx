"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import BottomSheet from "@/components/BottomSheet";
import { OutfitComposition } from "@/components/OutfitComposition";
import { CATLABEL, DATE_CONTEXTS, DAYS_FR, MONTHS_FR, OCCASIONS, WEATHER_ICONS, isBag } from "@/lib/data";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { computeDefaultCapsule, saisonCapsulePourMeteo } from "@/lib/capsule";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { computeLookScore, explainRecommendation, violatesOuterwearRule } from "@/lib/logic";
import { BADGE_RECOMMANDE, BADGE_REGISTRE, outfitBadges } from "@/lib/outfitBadges";
import { emptyStateCopy } from "@/lib/emptyStateCopy";
import { missingSuggestionText, occasionElargieText } from "@/lib/outfitCopy";
import { paletteHexes, styleConfigFor, type Gender, type StyleId } from "@/lib/profile";
import { findCompatibleStyles } from "@/lib/styleCoverage";
import type { DateContext, Item, TravelMode, WorkMode } from "@/lib/types";

/** Icônes des CTA de pièce suggérée (recette 23/08/2026) — trait fin, même style que TabBar, jamais d'emoji. */
function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  );
}
function BagIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 016 0v2" />
    </svg>
  );
}

/**
 * Card style "Explorer d'autres styles" (recette 24/08/2026, direction adaptée
 * d'une proposition externe) — même construction que la card de sélection de
 * style de ProfileSetupScreen (visuel STYLE_CONFIG, badge coché terracotta,
 * label + desc en dessous, bordure terracotta + fond teinté à la sélection) :
 * aucun nouveau pattern visuel, seulement redimensionnée pour un défilement
 * horizontal compact. Repli gracieux si le visuel Storage ne charge pas, même
 * principe que MoodboardCard (OnboardingScreen.tsx).
 */
function ExploreStyleCard({
  id,
  gender,
  selected,
  onClick,
}: {
  id: StyleId;
  gender: Gender | null;
  selected: boolean;
  onClick: () => void;
}) {
  const cfg = styleConfigFor(gender)[id];
  const [failed, setFailed] = useState(false);
  return (
    <button
      onClick={onClick}
      className={"relative flex-none w-[124px] text-left rounded-[14px] overflow-hidden border-[1.5px] cursor-pointer " + (selected ? "border-terracotta" : "border-border")}
      style={{ background: selected ? "#F6EBE2" : "#FBF8F3" }}
    >
      <div className="w-full aspect-[4/5] relative" style={{ background: "#E6DCCB" }}>
        {cfg.asset && !failed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfg.asset} alt="" onError={() => setFailed(true)} className="absolute inset-0 w-full h-full object-cover" />
        )}
        {selected && (
          <span className="absolute top-[7px] right-[7px] w-[19px] h-[19px] rounded-full bg-terracotta flex items-center justify-center">
            <svg width="10" height="8" viewBox="0 0 11 9" fill="none">
              <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
      </div>
      <div className="px-[10px] py-[9px]">
        <div className="font-serif text-[13px] text-ink leading-[1.2]">{cfg.label}</div>
        <div className="text-[10px] text-muted mt-[3px] leading-[1.3]">{cfg.desc}</div>
      </div>
    </button>
  );
}

export default function TenuesScreen() {
  const { state, weather, geoCity, geoLoading, geoIsLive, wardrobePool, vestiairePool, actions } = useCapsela();
  const { profile } = useAuth();
  const [layeringInfoOpen, setLayeringInfoOpen] = useState(false);
  /** Feuille ouverte, ou aucune. Une seule à la fois : les deux se répondent. */
  const [feuille, setFeuille] = useState<null | "occasion" | "sous">(null);
  // "Explorer d'autres styles" (recette 24/08/2026, état vide Tenues) —
  // calcul déclenché uniquement au clic, jamais automatiquement (coûteux :
  // rejoue le moteur pour chaque style candidat). Réinitialisé dès que
  // l'occasion/le sous-choix change (ajustement pendant le rendu, pattern
  // React officiel — pas un effet), pour ne jamais afficher un résultat
  // devenu obsolète à côté d'un état vide différent.
  const [exploring, setExploring] = useState(false);
  const [compatibleStyles, setCompatibleStyles] = useState<StyleId[]>([]);
  /** Chip sélectionnée dans la grille — locale, tant que "Explorer la capsule" n'a pas été validé, exploredStyleId (store) n'est pas touché. */
  const [selectedExploreStyle, setSelectedExploreStyle] = useState<StyleId | null>(null);
  const exploreQueryKey = `${state.occasion}|${state.workMode}|${state.dateContext}`;
  const [lastExploreQueryKey, setLastExploreQueryKey] = useState(exploreQueryKey);
  if (exploreQueryKey !== lastExploreQueryKey) {
    setLastExploreQueryKey(exploreQueryKey);
    setExploring(false);
    setCompatibleStyles([]);
    setSelectedExploreStyle(null);
  }
  function handleExploreStyles() {
    setCompatibleStyles(
      findCompatibleStyles(
        profile,
        weather,
        state.occasion || "all",
        state.workMode,
        state.dateContext,
        vestiairePool,
        state.suggestedExcluded,
        state.capsuleSeason
      )
    );
    setSelectedExploreStyle(null);
    setExploring(true);
  }
  function handleConfirmExploredStyle() {
    if (!selectedExploreStyle) return;
    actions.setExploredStyle(selectedExploreStyle);
    actions.goCapsule();
  }
  // "Ajouter à la tenue" (recette 23/08/2026, extension du mécanisme d'achat
  // aux suggestions R-S13/R-S14, révisé le même jour : plus de grande card
  // de confirmation permanente, remplacée par une petite transition de
  // sortie + un toast temporaire) — l'ajout fait sortir la suggestion de
  // lookScore.proactives dès le prochain rendu (sa condition de
  // déclenchement n'est plus vraie), donc son dernier contenu connu reste
  // conservé dans cet état le temps de sa transition de sortie, même une
  // fois disparue de lookScore.proactives. Aucune ref nulle part ici (règle
  // react-hooks/refs — interdit d'en lire une pendant le rendu, y compris
  // indirectement via une fonction appelée depuis un gestionnaire défini au
  // fil du JSX) : les setTimeout ci-dessous s'auto-annulent par comparaison
  // de valeur dans un updater fonctionnel plutôt que via clearTimeout+ref.
  type ProactiveEntry = (typeof lookScore.proactives)[number];
  const [dismissingEntries, setDismissingEntries] = useState<Record<string, { p: ProactiveEntry; suggested?: Item }>>({});
  /** Pièce dont la carte de composition ci-dessous garde un contour terracotta ~1,5s après un ajout, pour la faire remarquer sans rester un état permanent. */
  const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ text: string; onUndo: () => void } | null>(null);

  function showToast(text: string, onUndo: () => void) {
    const entry = { text, onUndo };
    setToast(entry);
    setTimeout(() => setToast((current) => (current === entry ? null : current)), 2600);
  }

  function handleAddSuggestedPiece(p: ProactiveEntry, piece: Item) {
    actions.addPieceToOutfit(piece.id);
    setDismissingEntries((m) => ({ ...m, [p.key]: { p, suggested: piece } }));
    setTimeout(() => {
      setDismissingEntries((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== p.key)));
    }, 320);
    setRecentlyAddedId(piece.id);
    setTimeout(() => setRecentlyAddedId((current) => (current === piece.id ? null : current)), 1500);
    // "Ajouté à la tenue : {nom}" plutôt que "{nom} ajouté(e)" — le nom d'une
    // pièce catalogue est un texte libre dont le genre/nombre n'est jamais
    // fiable à deviner (contrairement à agreeColor/nounInfoOf, qui n'accordent
    // que la couleur d'après la catégorie/le sous-type structurés, jamais un
    // nom entier) ; cette forme reste grammaticalement correcte quel que soit
    // le nom de la pièce, sans jamais inventer un accord.
    showToast(`✓ Ajouté à la tenue : ${piece.name}`, () => {
      actions.removePieceFromOutfit(piece.id);
      setToast(null);
    });
  }
  const now = new Date();
  const dateText = DAYS_FR[now.getDay()] + " " + now.getDate() + " " + MONTHS_FR[now.getMonth()];

  // Pool de résolution de la tenue affichée (recette 24/08/2026, retour
  // d'exploration) — en mode exploration, state.outfit contient des ids
  // tirés de la capsule du style exploré, jamais de wardrobePool (profil).
  // Même construction que CapsuleScreen (computeDefaultCapsule sur un profil
  // temporaire), jamais wardrobePool/profile.styles touchés ; displayPool
  // retombe sur wardrobePool à l'identique dès que exploredStyleId est null.
  const exploredCapsulePool = useMemo(() => {
    if (!state.exploredStyleId) return null;
    const exploredProfile = { ...profile, styles: [state.exploredStyleId] };
    // Doit rester identique au repli de `viewExploredOutfit` (store.tsx) : ce
    // pool ne sert qu'à RÉSOUDRE les ids que le store a tirés, les deux
    // doivent donc désigner la même capsule. Météo à défaut de choix explicite.
    const season = state.capsuleSeason || saisonCapsulePourMeteo(weather.temp);
    return computeDefaultCapsule(exploredProfile, weather, state.suggestedExcluded, season, vestiairePool);
  }, [state.exploredStyleId, profile, weather, state.suggestedExcluded, state.capsuleSeason, vestiairePool]);
  const displayPool = exploredCapsulePool ?? wardrobePool;
  // Repli de résolution stable (même correctif que HistoryScreen, 20/08/2026)
  // — state.outfit peut porter des ids qu'aucun des deux pools ne connaît :
  // "Voir cette tenue" depuis le Journal (viewItemOutfit) rejoue une entrée
  // d'historique enregistrée pendant l'exploration d'un autre style, dont les
  // pièces viennent de la capsule de ce style-là ; une fois exploredStyleId
  // retombé à null, displayPool vaut wardrobePool et n'en trouve aucune, d'où
  // une tenue affichée vide. Repli seulement : displayPool reste prioritaire,
  // et le pool de suggestions (computeLookScore) n'est pas élargi pour autant.
  const resolveFallback = [...state.items, ...vestiairePool];

  const outfitPieces = (state.outfit || [])
    .map((id) => displayPool.find((i) => i.id === id) ?? resolveFallback.find((i) => i.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));
  // "Enregistrer cette tenue" (recette 23/08/2026) — atterrit dans Dressing →
  // Mes looks, mais à la différence de "Créer un look" (dressing réel
  // uniquement), garde la tenue du jour telle quelle : pièces possédées et
  // suggestions capsule peuvent s'y mélanger.
  const outfitIds = outfitPieces.map((it) => it.id);
  const canSaveOutfit = outfitIds.length >= 2;
  const outfitKey = [...outfitIds].sort((a, b) => a - b).join(",");
  const isOutfitSaved =
    canSaveOutfit &&
    state.savedLooks.some((l) => l.source === "saved" && [...l.pieceIds].sort((a, b) => a - b).join(",") === outfitKey);

  // Génération automatique des visuels manquants (recette 18/08/2026) : dès
  // qu'une pièce du catalogue est affichée dans "La combinaison" sans photo
  // réelle/affiliée/générée, on déclenche sa génération — jamais pour une
  // pièce déjà pourvue (cf. requestCatalogImage, garde côté store) ni pour
  // le catalogue statique de secours (cf. ensureCatalogImage).
  useEffect(() => {
    outfitPieces.forEach((it) => {
      if (
        resolveItemImage(it).kind === "placeholder" &&
        it.imageStatus !== "generating" &&
        it.imageStatus !== "error" &&
        it.imageStatus !== "invalid"
      ) {
        actions.requestCatalogImage(it.id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.outfit]);

  // Correctif 23/08/2026 (signalé : "100% ton dressing" affiché alors que
  // l'empty state parle de capsule juste en dessous) — suggestedCount === 0
  // est trivialement vrai sur une tenue VIDE (0 pièce suggérée sur 0 pièce
  // au total), donc l'ancien calcul retombait sur "dressing_complet" par
  // défaut plutôt que de refléter l'absence réelle de tenue. Le badge n'a
  // plus aucun sens à afficher quand il n'y a rien à décrire : recomputed
  // à null explicitement, et le bloc entier est masqué au rendu (cf. plus
  // bas, section "état vide" du brief design).
  const suggestedCount = outfitPieces.filter((it) => isCatalogId(it.id)).length;
  /*
   * Le badge de mode (« Tes pièces + suggestions », « 100% ton dressing »,
   * « Capsule <saison> ») est retiré le 22/09/2026 — remplacé, pas oublié.
   * Il disait la même chose que les badges de provenance posés sur le look,
   * en moins précis : un mode global là où l'on peut compter les pièces. Sa
   * séparation dressing/capsule, elle, survit intacte — `suggestedCount`
   * ci-dessus alimente désormais `provenance`.
   */

  /**
   * Ce que les deux chips affichent, et ce que la feuille des sous-choix
   * contient. `occasion` vaut "all" tant que rien n'est choisi (store.tsx) —
   * c'est un état légitime, pas une absence de donnée, et le chip le dit
   * plutôt que de rester vide.
   *
   * `choisir` est typé sur `string` et recasté à l'appel : les trois setters
   * attendent trois types distincts (WorkMode, DateContext, TravelMode) et
   * les réunir ici évite trois branches de rendu identiques. Les valeurs
   * proposées viennent toujours de la source — DATE_CONTEXTS pour la date,
   * les littéraux du type pour les deux autres, comme avant.
   */
  const libelleOccasion =
    OCCASIONS.find(([k]) => k === state.occasion)?.[1] ?? "Choisir une occasion";
  const sousChoix: { titre: string; valeurs: readonly string[]; courant: string; choisir: (v: string) => void } | null =
    state.occasion === "travail_formel"
      ? {
          titre: "Où travailles-tu aujourd'hui ?",
          valeurs: ["Présentiel", "Télétravail"] as const,
          courant: state.workMode,
          choisir: (v) => actions.setWorkMode(v as WorkMode),
        }
      : state.occasion === "date"
        ? {
            titre: "Quel type de date ?",
            valeurs: DATE_CONTEXTS.map(([m]) => m),
            courant: state.dateContext,
            choisir: (v) => actions.setDateContext(v as DateContext),
          }
        : state.occasion === "voyage"
          ? {
              titre: "Quel type de trajet ?",
              valeurs: ["Court trajet", "Longue distance"] as const,
              courant: state.travelMode,
              choisir: (v) => actions.setTravelMode(v as TravelMode),
            }
          : null;

  /**
   * PROVENANCE DES PIÈCES — d'où vient vraiment cette tenue.
   *
   * Même séparation que le badge de mode ci-dessus : `isCatalogId` distingue
   * une pièce réellement possédée d'une suggestion de la capsule. Rien de
   * nouveau n'est calculé, seule la formulation change — de « Tes pièces +
   * suggestions », qui décrit un mode, à un décompte qui dit ce que
   * l'utilisatrice possède.
   *
   * Le dressing passe toujours en premier, y compris quand il n'apporte
   * qu'une pièce : c'est la hiérarchie du produit, pas un tri par quantité.
   * Aucune tenue affichée = aucune provenance, jamais un « 0 pièce ».
   */
  const provenance = (() => {
    const total = outfitPieces.length;
    if (!total) return null;
    const capsule = suggestedCount;
    const dressing = total - capsule;
    const pieces = (n: number) => `${n} ${n <= 1 ? "pièce" : "pièces"}`;
    const lignes: { cle: string; glyphe: string; texte: string }[] = [];
    if (dressing > 0) lignes.push({ cle: "dressing", glyphe: "◔", texte: `${pieces(dressing)} de ton dressing` });
    if (capsule > 0) lignes.push({ cle: "capsule", glyphe: "⬚", texte: `${pieces(capsule)} de ta capsule` });
    if (!lignes.length) return null;
    /*
     * UNE SEULE SOURCE : la phrase s'ouvre (22/09/2026). « Une sélection de
     * 5 pièces de ta capsule » vaut mieux qu'un décompte sec quand le
     * dressing est vide — la capsule est une porte d'entrée dans la valeur du
     * produit, pas un pis-aller. Deux sources : on garde les deux lignes
     * nues, « une sélection de » répété deux fois se lirait comme un bégaiement.
     */
    if (lignes.length === 1) lignes[0] = { ...lignes[0], texte: `Une sélection de ${lignes[0].texte}` };
    return lignes;
  })();

  const missingText = missingSuggestionText(state.outfitMissingCats || []);
  // Repli progressif de formalité (nouveau 21/08/2026, décidé) — calculé
  // par generateOutfitWithFallback (store.tsx), jamais recalculé ici :
  // bannière + badge distincts de missingText (rien ne manque, la
  // formalité est réduite).
  const formalityDowngraded = state.outfitFormalityDowngraded;
  // Repli d'occasion déclarée (22/09/2026, signalé : une robe déclarée pour
  // une occasion habillée proposée en Cocooning) — distinct du repli de
  // formalité : là, le registre baisse ; ici, c'est une règle posée par
  // l'utilisatrice elle-même qui a été élargie. Jamais les deux dans la même
  // phrase. Le libellé vient d'OCCASIONS, jamais réécrit ici.
  const occasionElargie = state.outfitOccasionRelachee;
  const occasionLabelCourant = (OCCASIONS.find(([k]) => k === state.occasion)?.[1] ?? "").toLowerCase();
  const noCompleteOutfit = state.outfitNoCompleteOutfit;
  // Sans objet en Cocooning (R-B12) : veste/manteau déjà exclus du pool de génération.
  const vesteWithoutBase = state.occasion !== "cocooning" && violatesOuterwearRule(outfitPieces);

  // État vide (brief design 22/08/2026, "corriger l'état aucune tenue
  // trouvée") — wardrobePool ne connaît pas de "source" globale unique
  // (chaque catégorie utilise déjà tes pièces réelles si tu en as, sinon la
  // capsule, cf. store.tsx), donc "dressing" vs "capsule" ne peut pas être
  // un simple drapeau existant à relire tel quel. Heuristique honnête et
  // bon marché : si state.items contient au moins une pièce vêtement
  // réelle, le message parle de "ton dressing" (elle a de vraies pièces qui
  // ne suffisent pas encore pour cette occasion) ; sinon de "cette capsule"
  // (aucune pièce réelle, les suggestions par défaut ne couvrent pas cette
  // occasion). Jamais utilisée pour le badge de mode ci-dessus, qui décrit
  // la tenue affichée — sans objet ici puisqu'il n'y en a pas.
  const CLOTHING_LIKE_CATS = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];
  const usesRealClothing = state.items.some((i) => CLOTHING_LIKE_CATS.includes(i.cat));
  const sourceLabel = usesRealClothing ? "ton dressing" : "cette capsule";

  // Raison structurée déjà calculée par le moteur (generateOutfitWithFallback,
  // logic.ts) — jamais un diagnostic recalculé/inventé ici, seulement mis en
  // mots. Cf. types.ts (OutfitFailureReason) pour ce que chaque valeur
  // garantit réellement.
  // Les textes sont sortis dans emptyStateCopy (src/lib/emptyStateCopy.ts) :
  // wording seul, testable hors rendu React. Les CONDITIONS de déclenchement
  // sont strictement inchangées — même raison du moteur, mêmes trois branches,
  // même repli sur "no_match" quand outfitFailureReason est null.
  const emptyStateBase = !noCompleteOutfit
    ? null
    : emptyStateCopy(state.outfitFailureReason ?? "no_match", sourceLabel);
  const emptyState = emptyStateBase && {
    ...emptyStateBase,
    onCta: emptyStateBase.ctaLabel ? actions.openAdd : null,
  };

  // Phrase d'explication de la recommandation (recette 19/08/2026) — par
  // template, jamais d'IA ; pas de température affichée tant que la
  // géolocalisation n'a pas résolu la météo réelle du jour.
  const recommendationText = explainRecommendation(
    state.occasion || "all",
    state.workMode,
    state.dateContext,
    geoLoading ? null : geoCity.temp
  );


  const dismissed = new Set(state.dismissedSuggestions || []);
  const lookScore = computeLookScore(
    outfitPieces,
    state.occasion || "all",
    paletteHexes(profile),
    profile.morphology,
    dismissed,
    weather,
    state.workMode,
    state.dateContext,
    displayPool
  );

  // Union clés vivantes (lookScore.proactives) + clés en cours de
  // transition de sortie (dismissingEntries) — une suggestion qui vient
  // d'être résolue par un ajout sort de lookScore.proactives dès ce rendu ;
  // son dernier contenu connu (figé dans l'état au moment du clic, cf.
  // handleAddSuggestedPiece) reste affiché le temps de la transition
  // plutôt que de disparaître net. La donnée vivante prime toujours quand
  // elle existe encore. Calculé ici (pas dans une IIFE au fil du JSX) pour
  // rester une donnée de rendu ordinaire.
  const badges = outfitBadges({
    scoreBadge: lookScore.badge,
    formalityDowngraded,
    noCompleteOutfit,
  });

  const liveProactiveByKey = new Map(lookScore.proactives.map((p) => [p.key, p]));
  const proactiveKeys = Array.from(new Set([...lookScore.proactives.map((p) => p.key), ...Object.keys(dismissingEntries)]));

  // pb-safe-nav (correctif 20/08/2026) remplace pb-24 : réserve la hauteur
  // réelle de la navigation basse + safe-area-inset-bottom + marge de
  // confort (globals.css), jamais une valeur arbitraire — pour que "Porter
  // cette tenue"/"Demander un avis à un proche" restent toujours
  // entièrement visibles au-dessus de TabBar, quel que soit l'écran/
  // l'encoche/la barre de gestes.
  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <AppHeader />

      <div className="mt-[18px]">
        <div className="text-[11px] tracking-[.18em] uppercase text-muted">{dateText}</div>
        {/* « Bonjour, <prénom> » appartient à l'accueil et à lui seul
            (23/09/2026) : répété ici, il salue une deuxième fois dans la même
            session et ne dit rien de l'écran. Le titre annonce désormais ce
            qu'on vient y chercher. La mention « Le look du jour » qui vivait
            DANS la card terracotta est supprimée du même coup — elle ferait
            doublon à deux cents pixels d'écart. */}
        <div className="font-serif text-[30px] leading-[1.12] text-ink mt-[6px]">
          Ton <span className="italic text-terracotta">look du jour</span>
        </div>
      </div>

      {geoLoading ? (
        <div className="flex items-center gap-[9px] bg-card border border-border rounded-full py-[10px] px-[15px] mt-5">
          <span className="w-[9px] h-[9px] rounded-full flex-shrink-0 animate-pulse" style={{ background: "#B3AA9B" }} />
          <div className="flex-1 min-w-0 text-[13px] text-muted">Localisation en cours…</div>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-[9px] bg-card border border-border rounded-full py-[10px] px-[15px] mt-5">
            <span
              className="w-[9px] h-[9px] rounded-full bg-terracotta flex-shrink-0"
              style={{ boxShadow: "0 0 0 4px rgba(166,105,80,.16)" }}
            />
            <div className="flex-1 min-w-0 text-[13px] text-ink whitespace-nowrap overflow-hidden text-ellipsis">
              {geoCity.city}
            </div>
            <span className="text-[13px] flex-shrink-0">{WEATHER_ICONS[geoCity.label] || "🌤️"}</span>
            <span className="text-[12px] text-[#3F3B34] whitespace-nowrap flex-shrink-0">
              {geoCity.temp}° · {geoCity.label}
            </span>
          </div>
          {!geoIsLive && (
            <div className="text-[10.5px] text-placeholder mt-[6px] px-[5px]">
              Position par défaut — active la géolocalisation pour ta météo du jour exacte.
            </div>
          )}
        </>
      )}

      {/* SÉLECTEUR COMPACT (brief 22/09/2026).
          Les dix occasions défilaient ici en cartes de deux lignes, plus
          jusqu'à cinq boutons de sous-choix en dessous : le look n'apparaissait
          qu'après un tiers d'écran. Elles vivent désormais dans une feuille
          ouverte à la demande — une seule occasion visible, toutes
          accessibles en un tap.

          Aucune taxonomie locale : OCCASIONS et DATE_CONTEXTS restent les
          sources. Et TROIS sous-choix, pas deux — le voyage garde le sien
          (arbitré 22/09), sans quoi « Longue distance » deviendrait
          inatteignable et le conseil qui en dépend ne s'afficherait plus
          jamais. */}
      {/* La question reste au-dessus des chips (demandé le 22/09) : sans
          elle, deux pastilles posées sous la météo ne disent pas ce qu'elles
          gouvernent — on les lit comme un filtre, pas comme le contexte qui
          produit la tenue. */}
      <div className="mt-5 text-[11px] tracking-[.16em] uppercase text-muted">
        Qu&apos;est-ce qui est prévu aujourd&apos;hui ?
      </div>
      <div className="flex items-center gap-2 mt-[9px] flex-wrap">
        <button
          onClick={() => setFeuille("occasion")}
          aria-haspopup="dialog"
          aria-label={`Occasion : ${libelleOccasion}. Changer d'occasion`}
          className="inline-flex items-center gap-[8px] rounded-full px-[16px] text-[12.5px] cursor-pointer bg-terracotta-deep text-cream"
          style={{ minHeight: 46 }}
        >
          <span aria-hidden="true" className="opacity-70">❑</span>
          <span className="whitespace-nowrap">{libelleOccasion}</span>
          <span aria-hidden="true" className="text-[9px] opacity-70">▾</span>
        </button>

        {/* Le second chip n'existe que pour les occasions qui ont réellement
            un sous-choix — jamais un chip vide pour l'alignement. */}
        {sousChoix && (
          <button
            onClick={() => setFeuille("sous")}
            aria-haspopup="dialog"
            aria-label={`${sousChoix.titre} ${sousChoix.courant}. Changer`}
            className="inline-flex items-center gap-[8px] rounded-full px-[16px] text-[12.5px] cursor-pointer bg-warm-bg text-sand-text border border-sand-border"
            style={{ minHeight: 46 }}
          >
            <span aria-hidden="true" className="opacity-70">❑</span>
            <span className="whitespace-nowrap">{sousChoix.courant}</span>
            <span aria-hidden="true" className="text-[9px] opacity-70">▾</span>
          </button>
        )}
      </div>

      {state.occasion === "voyage" && state.travelMode === "Longue distance" && !state.travelTipDismissed && (
        <div className="mt-[14px] flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">
              En voyage longue distance ? Pense aux bas de contention pour limiter les jambes lourdes.
            </div>
          </div>
          <button
            onClick={actions.dismissTravelTip}
            className="flex-shrink-0 text-[14px] text-placeholder cursor-pointer px-[2px]"
          >
            ×
          </button>
        </div>
      )}


      {/* Retour d'exploration (recette 24/08/2026) : la tenue affichée vient
          de la capsule du style exploré, pas de wardrobePool/profil — info
          secondaire discrète, jamais confondue avec le badge de mode
          ci-dessus (qui décrit dressing vs capsule DU style du profil). */}
      {state.exploredStyleId && (
        <div className="flex items-center justify-between gap-3 mt-[14px]">
          <div className="text-[12px] text-muted leading-[1.4]">
            Tenue issue du style {styleConfigFor(profile.gender)[state.exploredStyleId].label}.
            <br />
            Ton style personnel reste inchangé.
          </div>
          <button
            onClick={actions.clearExploredStyle}
            className="flex-shrink-0 text-[12px] text-terracotta cursor-pointer whitespace-nowrap"
          >
            Revenir à mon style
          </button>
        </div>
      )}

      {/* ══ LE LOOK DU JOUR — LE HÉROS DE L'ÉCRAN ════════════════════════
          « La combinaison » renommé (brief 22/09/2026) : le mot collidait
          avec la catégorie vêtement « combinaison », qui peut précisément
          figurer dans la tenue affichée juste en dessous.

          Tout ce qui décide de la tenue vit maintenant DANS la card, dans
          l'ordre où on le lit : ce que c'est, pourquoi, à quoi ça ressemble,
          et l'action. « Porter cette tenue » et « Demander un avis » vivaient
          quatre cents lignes plus bas, APRÈS sept bannières conditionnelles —
          leur position à l'écran dépendait donc du nombre d'avertissements du
          jour, ce qui est exactement ce qu'un bouton principal ne doit pas
          faire.

          LE PANNEAU CRÈME EST RETIRÉ (23/09/2026, demandé : « le flat lay de
          tenue doit ressembler à celui de la home, enlève l'aplat de beige
          sous les articles »). Il datait de la veille, où la consigne était
          l'inverse — ne pas toucher au fond de la composition. Ce qui a été
          vu depuis : sur l'accueil les pièces flottent sur le terracotta, ici
          elles étaient posées sur un panneau crème rempli de tuiles beiges,
          soit deux traitements pour le même objet à un onglet d'écart. Les
          deux couches partent ensemble — le panneau ici, les tuiles dans
          OutfitComposition — sinon le fond beige des tuiles resterait visible
          en damier sur le terracotta. */}
      {!geoLoading && outfitPieces.length > 0 && (
        <div className="mt-[22px] rounded-[24px] bg-terracotta-deep text-cream" style={{ padding: 16 }}>
          {/* Ligne conditionnelle depuis que le titre est parti : sans elle,
              une tenue sans badge ouvrirait la card sur une rangée vide. */}
          {badges.length > 0 && (
          <div className="flex items-center flex-wrap gap-[9px]">
            {/* Deux axes indépendants (cf. src/lib/outfitBadges.ts) : la
                qualité vient du score, le registre du repli de formalité. Sur
                fond terracotta, la hiérarchie passe par le remplissage —
                pastille pleine pour le principal, détourée pour le registre. */}
            {badges.map((key) =>
              key === "recommande" ? (
                <span
                  key={key}
                  className="text-[9.5px] tracking-[.06em] uppercase rounded-full px-[9px] py-[3px]"
                  style={{ background: "rgba(243,238,229,.22)", color: "#FBF3EA" }}
                >
                  {BADGE_RECOMMANDE}
                </span>
              ) : (
                <span
                  key={key}
                  className="text-[9.5px] tracking-[.06em] uppercase rounded-full px-[9px] py-[3px]"
                  style={{ border: "1px solid rgba(243,238,229,.38)", color: "#F0DDCF" }}
                >
                  {BADGE_REGISTRE}
                </span>
              )
            )}
          </div>
          )}

          {/* Justification météo — celle de CETTE tenue, jamais un bulletin. */}
          {recommendationText && (
            <div
              className={"text-[12.5px] leading-[1.4] " + (badges.length > 0 ? "mt-[6px]" : "")}
              style={{ color: "#F0DDCF" }}
            >
              {recommendationText}
            </div>
          )}

          <div className="mt-[13px]">
            <OutfitComposition items={outfitPieces} variant="hero" />
            {/* PROVENANCE — sur sa propre ligne sous le look, jamais PAR-DESSUS.
                La maquette les pose en surimpression en bas à gauche du
                flat-lay. Essayé, capturé : à 390 px, les ballerines
                disparaissent derrière « 3 pièces de ton dressing » et le sac
                est à moitié couvert. Une composition n'a pas de zone vide
                garantie — ses pièces se placent selon leur nombre et leur
                catégorie, donc aucun coin n'est sûr. Les badges prennent leur
                propre ligne sous la composition : ils se lisent toujours en
                même temps que le look, sans jamais en cacher une pièce. (Le
                panneau crème qui les entourait est parti le 23/09 ; la
                contrainte, elle, tient toujours — elle porte sur la
                superposition, pas sur la surface.) Corrigé en supprimant la contrainte, pas en
                déplaçant les badges vers un autre coin — le coin suivant
                aurait été couvert par une autre tenue.

                Comptée depuis la composition réelle (isCatalogId, la même
                séparation qu'utilisait déjà le badge de mode), jamais écrite
                en dur. Le badge capsule ne s'affiche que s'il y a vraiment une
                pièce de capsule : une tenue entièrement issue du dressing n'en
                montre qu'un. */}
            {provenance && (
              <div className="flex flex-wrap gap-[5px] mt-[8px] px-[6px] pb-[2px]">
                {provenance.map((p) => (
                  <span
                    key={p.cle}
                    className="inline-flex items-center gap-[7px] rounded-full pl-[6px] pr-[11px] py-[4px] text-[11px] leading-[1.25]"
                    style={{ background: "rgba(74,36,24,.72)", color: "#FBF3EA" }}
                  >
                    <span
                      aria-hidden="true"
                      className="w-[17px] h-[17px] rounded-full flex items-center justify-center text-[9px] flex-shrink-0"
                      style={{ background: "rgba(251,243,234,.2)" }}
                    >
                      {p.glyphe}
                    </span>
                    {p.texte}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ACTION PRINCIPALE. Elle reste dans la card, au-dessus de tout
              avertissement — un bouton dont la position dépend du nombre de
              bannières n'est pas un bouton principal. 52 px : cible tactile
              du brief, et le plus grand élément cliquable de l'écran. */}
          {state.outfitValidated ? (
            <div className="mt-[14px] flex items-center gap-3 rounded-full py-[13px] px-4" style={{ background: "rgba(29,26,22,.28)" }}>
              <span className="w-8 h-8 rounded-full bg-cream text-terracotta flex items-center justify-center text-base flex-shrink-0">
                ✓
              </span>
              <div className="text-[13.5px] text-cream">Bonne journée avec cette tenue !</div>
            </div>
          ) : (
            <button
              onClick={vesteWithoutBase ? undefined : actions.wearOutfitToday}
              disabled={vesteWithoutBase}
              title={vesteWithoutBase ? "Ajoute un haut, une robe ou une combinaison sous ta veste." : undefined}
              // MÊME BOUTON QUE « Voir ma tenue » SUR L'ACCUEIL (23/09/2026,
              // signalé). L'un menait à l'autre en changeant de forme au
              // passage : capitales et interlettrage à .1em ici, casse de
              // phrase et .04em là-bas, 52 px contre 50. Trois écarts pour
              // deux boutons qui sont la même action à une étape près. C'est
              // l'accueil qui fait référence : son libellé se lit en casse de
              // phrase, ce qui est aussi le registre du reste de l'app.
              className={
                "mt-[14px] w-full flex items-center justify-center rounded-full text-[13.5px] tracking-[.04em] " +
                (vesteWithoutBase ? "cursor-not-allowed" : "bg-cream text-ink cursor-pointer")
              }
              style={{
                minHeight: 50,
                background: vesteWithoutBase ? "rgba(243,238,229,.38)" : undefined,
                color: vesteWithoutBase ? "rgba(29,26,22,.5)" : undefined,
              }}
            >
              Porter cette tenue →
            </button>
          )}

          {/* Deux actions secondaires côte à côte, translucides : elles ne
              peuvent pas être confondues avec le CTA, qui est le seul élément
              plein de la card. « Enregistrer » reste inerte sous deux pièces
              (correctif 23/08 : le masquer le faisait disparaître de façon
              déroutante après une régénération). */}
          <div className="grid grid-cols-2 gap-[9px] mt-[9px]">
            <button
              onClick={() => canSaveOutfit && actions.toggleSaveOutfitLook()}
              disabled={!canSaveOutfit}
              title={canSaveOutfit ? undefined : "Ajoute au moins 2 pièces à cette tenue pour l'enregistrer."}
              aria-pressed={isOutfitSaved}
              className={"flex items-center justify-center gap-[6px] rounded-full text-[12.5px] " + (canSaveOutfit ? "cursor-pointer" : "cursor-default opacity-45")}
              style={{
                minHeight: 46,
                background: isOutfitSaved ? "rgba(243,238,229,.3)" : "rgba(243,238,229,.14)",
                border: "1px solid rgba(243,238,229,.3)",
                color: "#FBF3EA",
              }}
            >
              <span aria-hidden="true">{isOutfitSaved ? "♥" : "♡"}</span>
              {isOutfitSaved ? "Enregistrée" : "Enregistrer"}
            </button>
            <button
              onClick={actions.openOpinionShare}
              className="flex items-center justify-center gap-[6px] rounded-full text-[12.5px] cursor-pointer"
              style={{
                minHeight: 46,
                background: "rgba(243,238,229,.14)",
                border: "1px solid rgba(243,238,229,.3)",
                color: "#FBF3EA",
              }}
            >
              <span aria-hidden="true">✦</span> Avis d&apos;un proche
            </button>
          </div>
        </div>
      )}

      {/* État vide (section 5/6/7/9) : microcopy neutre et orientée
          solution, correspondant à la source réellement interrogée
          (dressing/capsule) et à la raison structurée déjà connue du
          moteur (state.outfitFailureReason) — jamais un diagnostic
          recalculé/inventé ici. Sobre, typographique, sans illustration. */}
      {!geoLoading && emptyState && (
        <div className="mt-2 mb-4 bg-card border border-border rounded-[14px] px-4 py-[26px] text-center">
          <div className="font-serif text-[16px] text-ink leading-[1.3]">{emptyState.title}</div>
          <div className="text-[13px] text-[#3F3B34] leading-[1.5] mt-[8px]">{emptyState.body}</div>
          {emptyState.ctaLabel && emptyState.onCta && (
            <button onClick={emptyState.onCta} className="mt-[14px] inline-block text-[12.5px] text-terracotta cursor-pointer">
              {emptyState.ctaLabel}
            </button>
          )}

          {!exploring ? (
            <button onClick={handleExploreStyles} className="mt-[10px] block mx-auto text-[12.5px] text-terracotta cursor-pointer">
              Explorer d&apos;autres styles →
            </button>
          ) : compatibleStyles.length > 0 ? (
            <div className="mt-[18px] text-left">
              <div className="text-[10.5px] tracking-[.14em] uppercase text-terracotta">✦ Une autre piste</div>
              <div className="font-serif text-[16px] text-ink leading-[1.25] mt-[4px]">Explore un autre univers</div>
              <div className="text-[12.5px] text-muted leading-[1.5] mt-[6px]">
                Découvre les capsules qui peuvent compléter ton dressing pour cette occasion. Ton style personnel reste
                inchangé.
              </div>
              <div className="scrollarea flex gap-[10px] overflow-x-auto mt-[14px] pb-[2px]">
                {compatibleStyles.map((id) => (
                  <ExploreStyleCard
                    key={id}
                    id={id}
                    gender={profile.gender}
                    selected={selectedExploreStyle === id}
                    onClick={() => setSelectedExploreStyle(selectedExploreStyle === id ? null : id)}
                  />
                ))}
              </div>
              {selectedExploreStyle && (
                <button
                  onClick={handleConfirmExploredStyle}
                  className="mt-[16px] w-full text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase bg-terracotta active:bg-terracotta-hover text-cream cursor-pointer"
                >
                  Explorer la capsule {styleConfigFor(profile.gender)[selectedExploreStyle].label} →
                </button>
              )}
            </div>
          ) : (
            <div className="mt-[14px] text-[12.5px] text-muted leading-[1.5]">
              Aucun autre style ne permet encore de couvrir cette occasion avec ta capsule actuelle.
            </div>
          )}
        </div>
      )}

      {/* Signalé le 22/09 : l'intitulé collait au bas de la card terracotta.
          Il n'avait aucune marge haute — invisible tant que la card se
          terminait par un bouton crème détaché de son bord, criant depuis
          qu'elle descend jusqu'au sien. */}
      {!geoLoading && outfitPieces.length > 0 && (
        <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[26px] mb-[10px]">
          Les {outfitPieces.length} pièces
        </div>
      )}

      {/* RAIL DES PIÈCES — la liste verticale de cartes de 81 px de haut
          poussait les bannières et l'alternative très bas : quatre pièces
          occupaient à elles seules un écran entier. Le rail les met sur une
          ligne, à hauteur constante quel que soit leur nombre.

          Rien ne disparaît : le tap ouvre la même fiche qu'avant (la fiche
          détail pour une pièce du dressing, « comment porter » pour une
          suggestion), le bouton ⇄ échange toujours la pièce, et le contour
          terracotta d'une pièce fraîchement ajoutée (R-S13/R-S14) est
          conservé. Pas de lien « Voir les détails » : il n'existe pas d'écran
          de détail de LA tenue, chaque pièce ouvre le sien, et inventer une
          destination serait pire que de s'en passer. */}
      <div className="scrollarea flex gap-[10px] overflow-x-auto pb-[4px]" style={{ scrollSnapType: "x mandatory" }}>
        {geoLoading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="flex-none w-[112px]">
                <div className="w-[112px] h-[112px] rounded-[13px] animate-pulse" style={{ background: "#EFE7D8" }} />
                <div className="h-[10px] w-3/4 rounded-full animate-pulse mt-[8px]" style={{ background: "#EFE7D8" }} />
                <div className="h-[10px] w-1/2 rounded-full animate-pulse mt-[5px]" style={{ background: "#EFE7D8" }} />
              </div>
            ))
          : outfitPieces.map((it) => {
              const suggested = isCatalogId(it.id);
              const resolvedImage = resolveItemImage(it);
              return (
                <div key={it.id} className="flex-none w-[112px]" style={{ scrollSnapAlign: "start" }}>
                  <div className="relative">
                    <button
                      onClick={() => (suggested ? actions.openItemOutfits(it.id) : actions.openItem(it.id, false))}
                      aria-label={`${it.name} — ${CATLABEL[isBag(it) ? "sac" : it.cat]}. Voir le détail`}
                      className="block w-[112px] h-[112px] rounded-[13px] overflow-hidden cursor-pointer transition-shadow duration-[1200ms] ease-out"
                      style={{
                        background: resolvedImage.url ? "#F3EDE1" : it.hex,
                        boxShadow: recentlyAddedId === it.id ? "0 0 0 1.5px #A66950" : "0 0 0 1.5px rgba(166,105,80,0)",
                      }}
                    >
                      {resolvedImage.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolvedImage.url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: resolvedImage.kind === "photo" ? "cover" : "contain",
                            objectPosition: "center",
                            padding: resolvedImage.kind === "photo" ? 0 : 9,
                            boxSizing: "border-box",
                            // Même réglage d'éclairage que la composition ci-dessus.
                            filter: resolvedImage.kind === "photo" ? "brightness(.94) contrast(1.04) saturate(.9)" : undefined,
                          }}
                        />
                      ) : (
                        <span
                          className="absolute left-[7px] bottom-[6px] text-[8.5px] tracking-[.05em]"
                          style={{ color: "rgba(243,238,229,.9)", textShadow: "0 1px 2px rgba(0,0,0,.35)" }}
                        >
                          {CATLABEL[it.cat].toUpperCase()}
                        </span>
                      )}
                      {it.imageStatus === "generating" && (
                        <span className="absolute inset-0 animate-pulse" style={{ background: "rgba(243,238,229,.35)" }} />
                      )}
                    </button>
                    {/* ⇄ posé sur la vignette, 34 px : la cible reste
                        confortable alors que la ligne entière a disparu. */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.swapPiece(it.id, it.cat);
                      }}
                      aria-label={`Remplacer ${it.name}`}
                      className="absolute top-[5px] right-[5px] w-[26px] h-[26px] rounded-full flex items-center justify-center text-[13px] cursor-pointer"
                      style={{ background: "rgba(251,248,243,.92)", color: "#7B7366", boxShadow: "0 1px 4px rgba(29,26,22,.14)" }}
                    >
                      ⇄
                    </button>
                  </div>
                  <div className="text-[11.5px] text-ink leading-[1.25] mt-[8px]">{it.name}</div>
                  <div className="text-[10.5px] text-muted mt-[2px]">{CATLABEL[isBag(it) ? "sac" : it.cat]}</div>
                  {/* Provenance à la pièce — la même séparation que les badges
                      du héros, jamais un second calcul. */}
                  <div className="text-[10.5px] mt-[1px]" style={{ color: suggested ? "#8C5540" : "#7B7366" }}>
                    {suggested ? "Capsule" : "Ton dressing"}
                  </div>
                </div>
              );
            })}
      </div>

      {!noCompleteOutfit && lookScore.badge === "ajuster" && lookScore.adjustMessage && (
        <div className="mt-4 bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px]">
          <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{lookScore.adjustMessage}</div>
        </div>
      )}

      {!noCompleteOutfit && lookScore.proactives.length > 0 && (
        <div className="mt-4 flex items-center gap-[7px]">
          <span className="font-serif italic text-[13px] text-terracotta">✦</span>
          <span className="text-[10.5px] tracking-[.14em] uppercase text-terracotta">Nos conseils pour sublimer cette tenue</span>
        </div>
      )}

      {!noCompleteOutfit &&
        proactiveKeys.map((key) => {
            const frozen = dismissingEntries[key];
            const p = liveProactiveByKey.get(key) ?? frozen?.p;
            if (!p) return null;
            const suggested = frozen?.suggested ?? (p.suggestedId != null ? displayPool.find((i) => i.id === p.suggestedId) : undefined);
            const closing = Boolean(frozen);
            return (
              <div
                key={key}
                className="overflow-hidden transition-all duration-300 ease-out"
                style={closing ? { opacity: 0, maxHeight: 0, marginTop: 0 } : { opacity: 1, maxHeight: 600, marginTop: 16 }}
              >
                <div className="flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
                  <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
                  <div className="flex-1 min-w-0">
                    {/* "Ignorer" au même niveau que le conseil (correctif
                        23/08/2026, signalé : détaché et créant du vide en bas
                        de card) — retiré de son ancienne position en pied de
                        card. */}
                    <div className="flex items-start justify-between gap-[10px]">
                      <div className="flex-1 min-w-0">
                        {key === "layer" && (
                          <div className="flex items-center gap-[6px] mb-[6px]">
                            <span className="text-[10px] tracking-[.14em] uppercase text-terracotta">Layering</span>
                            <button
                              onClick={() => setLayeringInfoOpen((v) => !v)}
                              aria-label="Qu'est-ce que le layering ?"
                              className="w-[17px] h-[17px] flex-shrink-0 rounded-full border border-[#C9966F] text-[10.5px] text-terracotta flex items-center justify-center cursor-pointer"
                            >
                              i
                            </button>
                          </div>
                        )}
                        <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{p.text}</div>
                        {key === "layer" && layeringInfoOpen && (
                          <div className="text-[11.5px] text-muted mt-[6px] leading-[1.4]">
                            Le layering, c&apos;est superposer plusieurs pièces pour un effet stylé — par exemple un
                            débardeur sous une chemise oversize ouverte.
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => actions.dismissOutfitSuggestion(key)}
                        className="flex-shrink-0 text-[12px] text-terracotta cursor-pointer"
                      >
                        Ignorer
                      </button>
                    </div>
                    {suggested && (
                      // Visuel "fantôme" agrandi (recette 23/08/2026) — pièce
                      // de la capsule pas encore ajoutée à la tenue :
                      // désaturée + atténuée pour se lire comme un aperçu,
                      // jamais confondue avec une pièce réelle de la
                      // composition ci-dessus. Badge "Suggérée" superposé
                      // plutôt qu'une simple mention textuelle, pour rester
                      // lisible même si le nom de la pièce est long.
                      <div className="flex items-start gap-[13px] mt-[13px]">
                        <div className="relative flex-shrink-0">
                          <div
                            className="w-[92px] h-[110px] rounded-[11px]"
                            style={{
                              background: resolveItemImage(suggested).url ? "#F3EDE1" : suggested.hex,
                              backgroundImage: resolveItemImage(suggested).url ? `url(${resolveItemImage(suggested).url})` : undefined,
                              backgroundSize: "contain",
                              backgroundRepeat: "no-repeat",
                              backgroundPosition: "center",
                              filter: "grayscale(55%) opacity(.8)",
                            }}
                          />
                          <span className="absolute top-[7px] left-[7px] bg-terracotta text-cream text-[8.5px] tracking-[.08em] uppercase rounded-full py-[3px] px-[8px]">
                            Suggérée
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 pt-[2px]">
                          <div className="text-[13px] text-ink leading-[1.25]">{suggested.name}</div>
                          <div className="text-[11px] text-muted mt-[2px]">{CATLABEL[suggested.cat]}</div>
                          <div className="flex flex-col gap-[8px] mt-[11px]">
                            <button
                              onClick={() => handleAddSuggestedPiece(p, suggested)}
                              className="inline-flex items-center justify-center gap-[6px] bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-[10px] text-[12px] cursor-pointer"
                            >
                              <PlusIcon />
                              Ajouter à la tenue
                            </button>
                            {suggested.affLink && (
                              <a
                                href={suggested.affLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-[6px] border border-border-soft text-terracotta rounded-full py-[10px] text-[12px] cursor-pointer"
                              >
                                <BagIcon />
                                <span className="underline underline-offset-2">Acheter cette pièce</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

      {!noCompleteOutfit && missingText && (
        <div className="mt-4 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta">✦</span>
          <div className="flex-1">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{missingText}</div>
            <button onClick={actions.openAdd} className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer">
              Ajouter une pièce →
            </button>
          </div>
        </div>
      )}

      {formalityDowngraded && !noCompleteOutfit && (
        <div className="mt-4 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta">✦</span>
          <div className="flex-1">
            {/* Ancien texte : « Ta capsule n\'a pas de tenue suffisamment
                habillée pour cette occasion. On te propose l\'alternative la
                plus adaptée avec tes pièces. » Retiré : « n\'a pas » et
                « suffisamment » faisaient porter un manque sur le vestiaire de
                l\'utilisatrice, et « la plus adaptée » est un superlatif jamais
                démontré. Le bandeau porte maintenant ce que la pastille ne peut
                pas dire — la DIMENSION du repli — au lieu de répéter le mot du
                badge. */}
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">
              Pour cette occasion, Capsela privilégie un registre plus sobre, composé avec les pièces de {sourceLabel}.
            </div>
            {/* Le lien ouvre le formulaire d'ajout — il dit donc ce qu'il
                fait. « Voir une version plus habillée » décrirait une action
                que l'app ne sait pas faire : rejouer un tirage à un palier
                imposé est possible (formalityOverride existe) mais n'existe
                pas comme fonctionnalité, et le repli a précisément eu lieu
                parce qu'aucune tenue de ce palier n'était disponible.
                « Ajouter une pièce plus habillée » suggérait par ailleurs un
                achat ; « compléter » décrit le geste réel sans le sous-entendre. */}
            <button onClick={actions.openAdd} className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer">
              Compléter mon dressing →
            </button>
          </div>
        </div>
      )}

      {occasionElargie && !noCompleteOutfit && occasionLabelCourant && (
        <div className="mt-4 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta">✦</span>
          <div className="flex-1">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">
              {occasionElargieText(occasionLabelCourant)}
            </div>
            <button onClick={actions.openAdd} className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer">
              Ajouter une pièce pour cette occasion →
            </button>
          </div>
        </div>
      )}

      {!noCompleteOutfit && vesteWithoutBase && (
        <div className="mt-4 flex items-start gap-[11px] bg-warm-bg border-[1.5px] border-terracotta rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta">!</span>
          <div className="flex-1">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">
              Ajoute un haut, une robe ou une combinaison sous ta veste pour compléter la tenue.
            </div>
            <button onClick={actions.openAdd} className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer">
              Choisir une pièce →
            </button>
          </div>
        </div>
      )}

      {/* ALTERNATIVE — en bas, jamais à hauteur du look recommandé.
          « ↻ Autre tenue » était un lien de 12 px posé à droite du titre, donc
          à égalité visuelle avec la recommandation elle-même. Ici, la
          proposition est claire sur son rang : on la lit après avoir vu la
          tenue et ses pièces.

          En mode exploration, rejoue un tirage sur la capsule explorée —
          jamais regen()/wardrobePool (recette 24/08/2026). Comportement
          inchangé, seule la place et la formulation bougent. */}
      {!noCompleteOutfit && (
        <button
          onClick={state.exploredStyleId ? actions.viewExploredOutfit : actions.regenOutfit}
          className="mt-[18px] w-full flex items-center gap-3 text-left bg-card border border-border rounded-[18px] px-4 py-[14px] cursor-pointer"
        >
          <span aria-hidden="true" className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] text-[#3F3B34] leading-[1.4]">Pas complètement convaincue ?</span>
            <span className="block text-[13px] text-ink mt-[2px]">Voir une autre tenue</span>
          </span>
          <span
            aria-hidden="true"
            className="w-9 h-9 rounded-full bg-terracotta text-cream flex items-center justify-center text-[14px] flex-shrink-0"
          >
            →
          </span>
        </button>
      )}

      {/* LES DEUX FEUILLES. BottomSheet existe depuis le 24/08 (écran Ajouter)
          — overlay cliquable, hauteur plafonnée à 85 %, largeur alignée sur
          la coquille : rien à réinventer ici, et le comportement au clavier
          comme au tactile reste celui déjà éprouvé ailleurs.

          `aria-pressed` porte la sélection active plutôt qu'un simple ✓
          visuel : une lectrice d'écran doit savoir laquelle est choisie, pas
          seulement voir une coche. */}
      <BottomSheet title="Qu'est-ce qui est prévu aujourd'hui ?" open={feuille === "occasion"} onClose={() => setFeuille(null)}>
        <div className="flex flex-col">
          {OCCASIONS.map(([key, label, sub]) => {
            const actif = state.occasion === key;
            return (
              <button
                key={key}
                onClick={() => {
                  actions.setOccasion(key);
                  setFeuille(null);
                }}
                aria-pressed={actif}
                className="flex items-center gap-3 text-left px-1 py-[10px] cursor-pointer border-b border-[#EFE7DA] last:border-b-0"
                style={{ minHeight: 52 }}
              >
                <div className="flex-1 min-w-0">
                  <div className={"text-[13.5px] " + (actif ? "text-terracotta" : "text-ink")}>{label}</div>
                  <div className="text-[11.5px] text-muted mt-[2px]">{sub}</div>
                </div>
                <span aria-hidden="true" className={"text-[13px] flex-shrink-0 " + (actif ? "text-terracotta" : "text-transparent")}>
                  ✓
                </span>
              </button>
            );
          })}
          {/* « Peu importe » n'est pas un ajout de taxonomie : "all" est la
              valeur initiale du store, et l'ancien sélecteur permettait d'y
              revenir en recliquant l'occasion active. La feuille n'ayant pas
              ce geste, l'entrée rend ce retour possible plutôt que de le
              supprimer en silence. */}
          <button
            onClick={() => {
              actions.setOccasion("all");
              setFeuille(null);
            }}
            aria-pressed={state.occasion === "all"}
            className="flex items-center gap-3 text-left px-1 py-[10px] cursor-pointer border-t border-[#EFE7DA]"
            style={{ minHeight: 52 }}
          >
            <div className="flex-1 min-w-0">
              <div className={"text-[13.5px] " + (state.occasion === "all" ? "text-terracotta" : "text-ink")}>Peu importe</div>
              <div className="text-[11.5px] text-muted mt-[2px]">Sans occasion particulière</div>
            </div>
            <span aria-hidden="true" className={"text-[13px] flex-shrink-0 " + (state.occasion === "all" ? "text-terracotta" : "text-transparent")}>
              ✓
            </span>
          </button>
        </div>
      </BottomSheet>

      <BottomSheet title={sousChoix?.titre ?? ""} open={feuille === "sous" && Boolean(sousChoix)} onClose={() => setFeuille(null)}>
        <div className="flex flex-col">
          {sousChoix?.valeurs.map((v) => {
            const actif = sousChoix.courant === v;
            return (
              <button
                key={v}
                onClick={() => {
                  sousChoix.choisir(v);
                  setFeuille(null);
                }}
                aria-pressed={actif}
                className="flex items-center gap-3 text-left px-1 py-[10px] cursor-pointer border-b border-[#EFE7DA] last:border-b-0"
                style={{ minHeight: 52 }}
              >
                <div className={"flex-1 min-w-0 text-[13.5px] " + (actif ? "text-terracotta" : "text-ink")}>{v}</div>
                <span aria-hidden="true" className={"text-[13px] flex-shrink-0 " + (actif ? "text-terracotta" : "text-transparent")}>
                  ✓
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>

      {/* Toast "Ajouter à la tenue" (recette 23/08/2026) — remplace l'ancienne
          carte de confirmation permanente : disparaît seule après ~2,6s,
          "Annuler" retire immédiatement la pièce (removePieceFromOutfit) et
          referme le toast. fixed plutôt qu'absolute pour rester visible quel
          que soit le défilement de cet écran, contraint à la largeur du
          cadre mobile (max-w-[480px] mx-auto) comme TabBar juste en dessous. */}
      {toast && (
        <div
          className="fixed inset-x-0 mx-auto max-w-[480px] px-6 z-30"
          style={{ bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 14px)" }}
        >
          <div className="flex items-center gap-3 bg-ink rounded-full py-[12px] pl-4 pr-[6px] shadow-lg">
            <span className="flex-1 min-w-0 text-[12.5px] text-cream truncate">{toast.text}</span>
            <button
              onClick={toast.onUndo}
              className="flex-shrink-0 text-[12px] text-terracotta tracking-[.02em] cursor-pointer py-[7px] px-[11px]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
