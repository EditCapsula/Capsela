"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { OutfitComposition } from "@/components/OutfitComposition";
import { CATLABEL, DATE_CONTEXTS, DAYS_FR, MONTHS_FR, OCCASIONS, WEATHER_ICONS, isBag } from "@/lib/data";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { computeDefaultCapsule, currentSeasonKey } from "@/lib/capsule";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { computeLookScore, explainRecommendation, violatesOuterwearRule } from "@/lib/logic";
import { BADGE_RECOMMANDE, BADGE_REGISTRE, outfitBadges } from "@/lib/outfitBadges";
import { emptyStateCopy } from "@/lib/emptyStateCopy";
import { missingSuggestionText } from "@/lib/outfitCopy";
import { paletteHexes, styleConfigFor, type Gender, type StyleId } from "@/lib/profile";
import { findCompatibleStyles } from "@/lib/styleCoverage";
import type { Item } from "@/lib/types";

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

/** US-05 — transparence du mode de recommandation : source réelle des pièces de la tenue affichée. */
const MODE_STYLES = {
  capsule_depart: { color: "#A66950", bg: "#F0E5D6", border: "#E2CDB8", dot: "#C9966F" },
  hybride: { color: "#8A6B3F", bg: "#F3EDDD", border: "#E2D6BD", dot: "#B99A63" },
  dressing_complet: { color: "#3F5A47", bg: "#E9F0E9", border: "#CFE0D2", dot: "#6E9179" },
} as const;

export default function TenuesScreen() {
  const { state, weather, geoCity, geoLoading, geoIsLive, wardrobePool, vestiairePool, actions } = useCapsela();
  const { profile } = useAuth();
  const [layeringInfoOpen, setLayeringInfoOpen] = useState(false);
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
  const firstNameOrYou = profile.displayName || "toi";

  // Pool de résolution de la tenue affichée (recette 24/08/2026, retour
  // d'exploration) — en mode exploration, state.outfit contient des ids
  // tirés de la capsule du style exploré, jamais de wardrobePool (profil).
  // Même construction que CapsuleScreen (computeDefaultCapsule sur un profil
  // temporaire), jamais wardrobePool/profile.styles touchés ; displayPool
  // retombe sur wardrobePool à l'identique dès que exploredStyleId est null.
  const exploredCapsulePool = useMemo(() => {
    if (!state.exploredStyleId) return null;
    const exploredProfile = { ...profile, styles: [state.exploredStyleId] };
    const season = state.capsuleSeason || currentSeasonKey();
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
  const recommendationMode: keyof typeof MODE_STYLES | null =
    outfitPieces.length === 0
      ? null
      : suggestedCount === 0
        ? "dressing_complet"
        : suggestedCount === outfitPieces.length
          ? "capsule_depart"
          : "hybride";
  const modeLabel =
    recommendationMode === "capsule_depart"
      ? "Capsule " + currentSeasonKey()
      : recommendationMode === "hybride"
        ? "Tes pièces + suggestions"
        : "100% ton dressing";
  const modeStyle = recommendationMode ? MODE_STYLES[recommendationMode] : null;

  const missingText = missingSuggestionText(state.outfitMissingCats || []);
  // Repli progressif de formalité (nouveau 21/08/2026, décidé) — calculé
  // par generateOutfitWithFallback (store.tsx), jamais recalculé ici :
  // bannière + badge distincts de missingText (rien ne manque, la
  // formalité est réduite).
  const formalityDowngraded = state.outfitFormalityDowngraded;
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
        <div className="font-serif text-[30px] leading-[1.12] text-ink mt-[6px]">
          Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
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

      <div className="mt-5 text-[11px] tracking-[.16em] uppercase text-muted">
        Qu&apos;est-ce qui est prévu aujourd&apos;hui ?
      </div>
      <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[9px]">
        {OCCASIONS.map(([key, label, sub], i) => {
          const on = state.occasion === key;
          return (
            <button
              key={key}
              onClick={() => actions.setOccasion(on ? "all" : key)}
              className="flex-none text-left py-[10px] px-[15px] rounded-full cursor-pointer border"
              style={{ background: on ? "#1D1A16" : "#FBF8F3", borderColor: on ? "#1D1A16" : "#E6DCCB" }}
            >
              <div className="text-[12.5px] whitespace-nowrap" style={{ color: on ? "#F3EEE5" : "#1D1A16" }}>
                <span style={{ color: on ? "#C9966F" : "#B3AA9B" }}>{String(i + 1).padStart(2, "0")}</span> {label}
              </div>
              <div className="text-[10.5px] mt-[2px] whitespace-nowrap" style={{ color: on ? "#B98A6E" : "#7B7366" }}>
                {sub}
              </div>
            </button>
          );
        })}
      </div>

      {state.occasion === "date" && (
        <div className="flex gap-[11px] mt-3">
          <div className="w-[1.5px] flex-shrink-0 bg-border rounded-sm ml-[7px]" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[.16em] uppercase text-terracotta mb-[9px]">
              ↳ Quel type de date ?
            </div>
            <div className="flex gap-2 flex-wrap">
              {DATE_CONTEXTS.map(([m]) => (
                <button
                  key={m}
                  onClick={() => actions.setDateContext(m)}
                  className={
                    "px-[14px] py-[7px] rounded-full text-[12px] cursor-pointer font-sans border " +
                    (state.dateContext === m ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.occasion === "travail_formel" && (
        <div className="flex gap-[11px] mt-3">
          <div className="w-[1.5px] flex-shrink-0 bg-border rounded-sm ml-[7px]" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[.16em] uppercase text-terracotta mb-[9px]">
              ↳ Où travailles-tu aujourd&apos;hui ?
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["Présentiel", "Télétravail"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => actions.setWorkMode(m)}
                  className={
                    "px-[14px] py-[7px] rounded-full text-[12px] cursor-pointer font-sans border " +
                    (state.workMode === m ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.occasion === "voyage" && (
        <div className="flex gap-[11px] mt-3">
          <div className="w-[1.5px] flex-shrink-0 bg-border rounded-sm ml-[7px]" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[.16em] uppercase text-terracotta mb-[9px]">
              ↳ Quel type de trajet ?
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["Court trajet", "Longue distance"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => actions.setTravelMode(m)}
                  className={
                    "px-[14px] py-[7px] rounded-full text-[12px] cursor-pointer font-sans border " +
                    (state.travelMode === m ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {/* Badge de mode (section 1/10 du brief 22/08/2026) : décrit la
          provenance des pièces de LA tenue affichée — sans objet, donc
          masqué, quand il n'y en a pas (recommendationMode/modeStyle null
          sur une tenue vide, cf. plus haut). Ne doit jamais dire "100% ton
          dressing" à côté d'un empty state qui parle d'autre chose. */}
      {recommendationMode && modeStyle && (
        <div
          className="inline-flex items-center gap-2 mt-[14px] rounded-full"
          style={{ padding: "7px 14px 7px 11px", background: modeStyle.bg, border: `1px solid ${modeStyle.border}` }}
        >
          <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: modeStyle.dot }} />
          <span className="text-[11px] tracking-[.13em] uppercase" style={{ color: modeStyle.color }}>
            {modeLabel}
          </span>
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

      <div className="flex justify-between items-center gap-3 mt-[22px] mb-3">
        {/* flex-wrap : deux pastilles peuvent désormais coexister à côté du
            libellé, la ligne ne doit pas déborder sur un écran étroit. */}
        <div className="flex items-center flex-wrap gap-[9px]">
          <span className="text-[11px] tracking-[.16em] uppercase text-muted">La combinaison</span>
          {/* Deux axes indépendants (cf. src/lib/outfitBadges.ts) : la qualité
              vient du score, le registre vient du repli de formalité. Une
              tenue peut porter les deux — aucune exclusivité ici. Pastille
              PLEINE pour le badge principal, pastille DÉTOURÉE et muette pour
              le registre : la hiérarchie passe par le remplissage, jamais par
              une couleur d'alerte (le terracotta et bg-warm-bg de cet écran
              signalent un avertissement, ils sont réservés à ça). */}
          {badges.map((key) =>
            key === "recommande" ? (
              <span
                key={key}
                className="text-[9.5px] tracking-[.06em] uppercase text-[#5B7A5E] bg-[#E7EEDF] rounded-full px-[9px] py-[3px]"
              >
                {BADGE_RECOMMANDE}
              </span>
            ) : (
              <span
                key={key}
                className="text-[9.5px] tracking-[.06em] uppercase text-muted border border-border rounded-full px-[9px] py-[3px]"
              >
                {BADGE_REGISTRE}
              </span>
            )
          )}
        </div>
        {/* "↻ Autre tenue" (section 2) : n'a de sens que s'il y a déjà une
            tenue à régénérer — jamais affiché à côté d'un état vide. En mode
            exploration, rejoue un tirage sur la capsule explorée (jamais
            regen()/wardrobePool — recette 24/08/2026). */}
        {!noCompleteOutfit && (
          <button
            onClick={state.exploredStyleId ? actions.viewExploredOutfit : actions.regenOutfit}
            className="text-[12px] text-terracotta tracking-[.03em] cursor-pointer"
          >
            ↻ Autre tenue
          </button>
        )}
      </div>

      {/* Justification météo (section 3) : c'est la justification de LA
          tenue recommandée — jamais affichée quand il n'y en a pas. */}
      {!geoLoading && !noCompleteOutfit && (
        <div className="text-[12.5px] text-muted leading-[1.4] mb-3 -mt-1">{recommendationText}</div>
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

      {!geoLoading && outfitPieces.length > 0 && (
        <div className="mb-3" style={{ marginTop: 10 }}>
          <OutfitComposition items={outfitPieces} variant="hero" />
          {/* "Enregistrer cette tenue" (recette 23/08/2026) — persiste dans
              savedLooks, visible dans Dressing → Mes looks. À la différence
              de "Créer un look" (dressing réel uniquement), garde la tenue
              telle quelle : pièces possédées et suggestions capsule peuvent
              s'y mélanger. Toujours affiché (correctif 23/08/2026 : le
              masquer selon la composition de la tenue le faisait disparaître
              de façon déroutante après une régénération) ; simplement
              inerte, en grisé, tant que la tenue ne compte pas 2 pièces. */}
          <button
            onClick={() => canSaveOutfit && actions.toggleSaveOutfitLook()}
            disabled={!canSaveOutfit}
            title={canSaveOutfit ? undefined : "Ajoute au moins 2 pièces à cette tenue pour l'enregistrer."}
            className={"mt-3 flex items-center gap-[6px] text-[12.5px] " + (canSaveOutfit ? "cursor-pointer" : "cursor-default opacity-40")}
            style={{ color: isOutfitSaved ? "#A66950" : "#7B7366" }}
          >
            <span>{isOutfitSaved ? "♥" : "♡"}</span>
            {isOutfitSaved ? "Tenue enregistrée" : "Enregistrer cette tenue"}
          </button>
        </div>
      )}

      {!geoLoading && outfitPieces.length > 0 && (
        <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[10px]">
          Les {outfitPieces.length} pièces
        </div>
      )}

      <div className="flex flex-col gap-[9px]">
        {geoLoading
          ? [0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-[11px] bg-card border border-border rounded-[14px] p-[9px]">
                <div className="w-[52px] h-[63px] rounded-lg flex-shrink-0 animate-pulse" style={{ background: "#EFE7D8" }} />
                <div className="flex-1 min-w-0 flex flex-col gap-[8px]">
                  <div className="h-[10px] w-3/4 rounded-full animate-pulse" style={{ background: "#EFE7D8" }} />
                  <div className="h-[10px] w-1/2 rounded-full animate-pulse" style={{ background: "#EFE7D8" }} />
                </div>
              </div>
            ))
          : outfitPieces.map((it) => {
          const suggested = isCatalogId(it.id);
          const resolvedImage = resolveItemImage(it);
          return (
            <div
              key={it.id}
              onClick={() => (suggested ? actions.openItemOutfits(it.id) : actions.openItem(it.id, false))}
              className="bg-card border border-border rounded-[14px] p-[9px] cursor-pointer transition-shadow duration-[1200ms] ease-out"
              // Contour terracotta temporaire (recette 23/08/2026) — pièce
              // qui vient d'être ajoutée via "Ajouter à la tenue" (R-S13/
              // R-S14) : se remarque ~1,5s puis revient exactement à l'état
              // des autres pièces (recentlyAddedId repasse à null).
              style={{ boxShadow: recentlyAddedId === it.id ? "0 0 0 1.5px #A66950" : "0 0 0 1.5px rgba(166,105,80,0)" }}
            >
              <div className="flex items-center gap-[11px]">
                {resolvedImage.url ? (
                  <div
                    className="relative flex-shrink-0 rounded-lg overflow-hidden"
                    // Zone image fixe (recette 18/08/2026, intégration naturelle ;
                    // hauteur réduite ~10% le 19/08/2026 pour alléger la page) : un
                    // très léger fond ivoire Capsela (jamais de bordure/ombre marquée
                    // qui donnerait un effet "photo insérée dans un carré"), avec une
                    // marge interne pour que le vêtement ne touche jamais les bords.
                    // Correctif 22/08/2026 : sans objet pour une photo réelle du
                    // dressing (kind "photo") — recadrée plein cadre en "cover"
                    // comme dans la grille Dressing, même traitement que les
                    // pièces catalogue/affiliées plutôt qu'un écart visuel.
                    style={{
                      width: 99,
                      height: 119,
                      background: "#F3EDE1",
                      padding: resolvedImage.kind === "photo" ? 0 : 9,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolvedImage.url}
                      alt={it.name}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: resolvedImage.kind === "photo" ? "cover" : "contain",
                        objectPosition: "center",
                        // Même réglage d'éclairage que la composition ci-dessus.
                        filter: resolvedImage.kind === "photo" ? "brightness(.94) contrast(1.04) saturate(.9)" : undefined,
                      }}
                    />
                  </div>
                ) : (
                  <div
                    className="relative w-[52px] h-[63px] rounded-lg flex-shrink-0 overflow-hidden"
                    style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
                  >
                    {it.imageStatus === "generating" && (
                      <span
                        className="absolute inset-0 animate-pulse"
                        style={{ background: "rgba(243,238,229,.35)" }}
                      />
                    )}
                    <span
                      className="absolute left-[6px] bottom-[6px] text-[8.5px] tracking-[.05em]"
                      style={{ color: "rgba(243,238,229,.9)", textShadow: "0 1px 2px rgba(0,0,0,.35)" }}
                    >
                      {CATLABEL[it.cat].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {/* Badge "pièce suggérée" retiré de cet écran (brief design
                      section 0, correctif 22/08/2026) : exclusif à l'écran
                      Capsule — ici, le mode de recommandation global
                      (recommendationMode/modeLabel ci-dessus) suffit déjà à
                      signaler la présence de pièces de capsule dans la tenue. */}
                  <div className="text-[14.5px] text-ink">{it.name}</div>
                  <div className="text-[11px] text-muted mt-[3px]">{CATLABEL[isBag(it) ? "sac" : it.cat]}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    actions.swapPiece(it.id, it.cat);
                  }}
                  aria-label="Remplacer cette pièce"
                  className="text-[17px] text-placeholder cursor-pointer flex-shrink-0 p-[9px] flex items-center justify-center"
                >
                  ⇄
                </button>
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
              Pour cette occasion, on te propose un registre plus sobre, composé avec les pièces de {sourceLabel}.
            </div>
            <button onClick={actions.openAdd} className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer">
              Ajouter une pièce plus habillée →
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

      {!noCompleteOutfit &&
        (state.outfitValidated ? (
          <div className="mt-[22px] flex items-center gap-3 bg-ink rounded-2xl py-[15px] px-4">
            <span className="w-8 h-8 rounded-full bg-terracotta text-cream flex items-center justify-center text-base flex-shrink-0">
              ✓
            </span>
            <div className="text-[13.5px] text-cream">Bonne journée avec cette tenue !</div>
          </div>
        ) : (
          <button
            onClick={vesteWithoutBase ? undefined : actions.wearOutfitToday}
            className={
              "mt-[22px] w-full text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase " +
              (vesteWithoutBase ? "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed" : "bg-terracotta active:bg-terracotta-hover text-cream cursor-pointer")
            }
          >
            Porter cette tenue
          </button>
        ))}

      {!noCompleteOutfit && (
        <button
          onClick={actions.openOpinionShare}
          className="mt-3 w-full flex items-center justify-center gap-2 border border-border bg-card rounded-full py-[14px] text-[12.5px] text-ink cursor-pointer"
        >
          <span className="text-terracotta">✦</span> Demander un avis à un proche
        </button>
      )}

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
