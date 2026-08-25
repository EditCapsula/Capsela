"use client";

import { useState, type CSSProperties } from "react";
import AppHeader from "@/components/AppHeader";
import { OCC_LABELS } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { computeDefaultCapsule, currentSeasonKey } from "@/lib/capsule";
import { explainRecommendation } from "@/lib/logic";
import { useAuth } from "@/lib/auth";
import { styleLabel } from "@/lib/profile";
import { useCapsela, defaultOccasionToday } from "@/lib/store";
import type { CategoryKey, Item } from "@/lib/types";

/**
 * Mini flat-lay éditorial de la card héros Accueil (recette 20/08/2026,
 * optimisation composition) — même source que la page Tenue (state.outfit),
 * jamais un recalcul indépendant. Contrairement à l'ancienne version (rangée
 * de colonnes égales, illisible comme "5 produits alignés"), la sélection
 * suit une priorité stricte (robe/combinaison seule sinon haut+bas, puis
 * chaussures, sac, au plus un accessoire) et le placement suit un rôle par
 * pièce (grande pièce dominante en haut, bas juste en dessous, chaussures
 * en bas, sac et accessoire en petit de part et d'autre) — pensé comme un
 * teaser de la tenue complète, pas une liste.
 */
function isOnePieceCat(cat: CategoryKey) {
  return cat === "robe" || cat === "combinaison";
}
function isTopCat(cat: CategoryKey) {
  return cat === "haut" || cat === "pull";
}
function isBottomCat(cat: CategoryKey) {
  return cat === "pantalon" || cat === "jean" || cat === "jupe" || cat === "short";
}
function isAccessoryCat(cat: CategoryKey) {
  return cat === "bijou" || cat === "accessoire";
}

/** Sélectionne 3 à 5 pièces représentatives, jamais plus d'un accessoire. */
function selectHomePieces(items: Item[]): Item[] {
  const onePiece = items.find((it) => isOnePieceCat(it.cat));
  const core: Item[] = [];
  if (onePiece) {
    core.push(onePiece);
  } else {
    const top = items.find((it) => isTopCat(it.cat));
    const bottom = items.find((it) => isBottomCat(it.cat));
    if (top) core.push(top);
    if (bottom) core.push(bottom);
  }
  const shoes = items.find((it) => it.cat === "chaussures");
  if (shoes) core.push(shoes);
  const bag = items.find((it) => it.cat === "sac");
  if (bag) core.push(bag);
  const accessory = items.find((it) => isAccessoryCat(it.cat));
  if (accessory && core.length < 5) core.push(accessory);
  return core.slice(0, 5);
}

type HomeRole = "onepiece" | "haut" | "bas" | "chaussures" | "sac" | "petit";
function homeRoleOf(cat: CategoryKey): HomeRole {
  if (isOnePieceCat(cat)) return "onepiece";
  if (isTopCat(cat)) return "haut";
  if (isBottomCat(cat)) return "bas";
  if (cat === "chaussures") return "chaussures";
  if (cat === "sac") return "sac";
  return "petit";
}

// Slots en % relatifs au cluster central (lui-même à 82% de la largeur de
// la card, cf. JSX) — composition éditoriale resserrée (recette 20/08/2026,
// passe "un seul groupe visuel") : les pièces se chevauchent volontairement
// un peu à leurs coins (chemise sur le haut du pantalon, chaussures/sac/
// accessoire contre le pantalon) au lieu de flotter séparément — jamais au
// point de masquer une pièce principale. Vêtements dominants (haut/bas),
// accessoires nettement plus petits, toujours en périphérie du groupe.
const HOME_SLOTS_ONEPIECE: Record<string, [number, number, number, number]> = {
  onepiece: [22, 0, 50, 86],
  chaussures: [10, 76, 30, 24],
  sac: [64, 4, 30, 34],
  petit: [66, 56, 24, 20],
};
const HOME_SLOTS_STANDARD: Record<string, [number, number, number, number]> = {
  haut: [16, 0, 48, 46],
  bas: [30, 32, 54, 56],
  chaussures: [8, 70, 32, 26],
  sac: [60, 6, 30, 32],
  petit: [68, 58, 24, 20],
};

function homeCompositionPiecesOf(items: Item[]): { id: number; style: CSSProperties }[] {
  const main = selectHomePieces(items);
  const roles = main.map((it) => homeRoleOf(it.cat));
  const hasOnePiece = roles.includes("onepiece");
  const slots = hasOnePiece ? HOME_SLOTS_ONEPIECE : HOME_SLOTS_STANDARD;
  return main.map((it, i) => {
    const rk = roles[i];
    const [left, top, w, h] = slots[rk] || slots.petit;
    const img = resolveItemImage(it);
    const hasImg = Boolean(img.url);
    return {
      id: it.id,
      style: {
        position: "absolute",
        left: left + "%",
        top: top + "%",
        width: w + "%",
        height: h + "%",
        // Aucun fond propre par pièce quand une image existe (recette
        // 20/08/2026, passe éditoriale) — un aplat CSS derrière chaque photo
        // (même semi-transparent) créait un effet "collage de vignettes
        // e-commerce" : chaque fichier produit porte déjà son propre fond
        // (blanc/beige) s'il en a un, jamais besoin d'en superposer un
        // second. Le seul vrai contenant visuel est le cadre global (cf.
        // JSX, rgba(243,238,229,.14)). La couleur de la pièce ne sert de
        // repli que quand il n'y a vraiment aucune image, pour ne jamais
        // rendre une pièce invisible.
        backgroundColor: hasImg ? undefined : it.hex,
        backgroundImage: hasImg ? `url(${img.url})` : undefined,
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        borderRadius: hasImg ? 0 : 8,
        // Le haut/la pièce unique reste au-dessus du bas à leur zone de
        // chevauchement (recette 20/08/2026) — jamais l'inverse, une chemise
        // dissimulée sous un pantalon ne se lirait plus comme un chevauchement volontaire.
        zIndex: rk === "haut" || rk === "onepiece" ? 3 : rk === "bas" || rk === "chaussures" ? 2 : 1,
      },
    };
  });
}

/**
 * Section "Explore L'édit Capsela" (refonte éditoriale 26/08/2026) — remplace
 * les 3 cards horizontales identiques (icône + texte + flèche, lisibles comme
 * un menu générique) par une composition mode : Dressing/Capsule en vis-à-vis
 * (chacune illustrée par une petite planche de stylisme faite de vraies pièces),
 * Journal en pleine largeur avec des visuels éditoriaux. Priorité de catégories
 * pour choisir des pièces visuellement variées sur une planche, jamais 3 fois
 * la même famille de vêtement côte à côte.
 */
const BOARD_PRIORITY: CategoryKey[] = [
  "robe", "combinaison", "manteau", "veste", "haut", "pull", "jupe", "pantalon", "jean", "short",
  "chaussures", "sac", "bijou", "accessoire",
];

function selectBoardPieces(items: Item[], max: number): Item[] {
  const picked: Item[] = [];
  const usedCats = new Set<CategoryKey>();
  for (const cat of BOARD_PRIORITY) {
    if (picked.length >= max) break;
    const found = items.find((it) => it.cat === cat && !usedCats.has(it.cat));
    if (found) {
      picked.push(found);
      usedCats.add(cat);
    }
  }
  // Repli si le dressing/la capsule n'a pas assez de catégories distinctes —
  // complète avec les pièces restantes plutôt que de laisser la planche vide.
  for (const it of items) {
    if (picked.length >= max) break;
    if (!picked.includes(it)) picked.push(it);
  }
  return picked;
}

/** Emplacements en % (asymétriques, légèrement pivotés) selon le nombre de pièces — jamais une grille régulière. */
type BoardSlot = { left: number; top: number; w: number; h: number; rotate: number; z: number };
const BOARD_SLOTS: Record<number, BoardSlot[]> = {
  1: [{ left: 24, top: 6, w: 54, h: 88, rotate: -2, z: 1 }],
  // Dressing (2-3 pièces) — chevauchement réduit (recette 26/08/2026) pour
  // que chaque pièce du dressing réel reste bien distincte à l'œil.
  2: [
    { left: 0, top: 6, w: 50, h: 82, rotate: -3, z: 2 },
    { left: 52, top: 26, w: 46, h: 64, rotate: 4, z: 1 },
  ],
  3: [
    { left: 0, top: 8, w: 44, h: 80, rotate: -3, z: 2 },
    { left: 46, top: 0, w: 40, h: 44, rotate: 4, z: 1 },
    { left: 50, top: 50, w: 38, h: 46, rotate: -2, z: 3 },
  ],
  // Capsule (4 pièces) — pièces ~10% plus grandes (recette 26/08/2026) pour
  // renforcer l'aspect sélection de styliste ; léger débord accepté sur les
  // bords, absorbé par le rayon de la card (overflow-hidden), jamais hors
  // de son container.
  4: [
    { left: 0, top: 12, w: 48, h: 81, rotate: -4, z: 2 },
    { left: 40, top: 0, w: 37, h: 44, rotate: 6, z: 1 },
    { left: 62, top: 32, w: 40, h: 46, rotate: -5, z: 3 },
    { left: 38, top: 50, w: 35, h: 44, rotate: 4, z: 1 },
  ],
};

/** Petite planche de stylisme (Dressing/Capsule) — pièces réelles, tailles et rotations variées, léger chevauchement. */
function StyleBoard({ items, height }: { items: Item[]; height: number }) {
  const slots = BOARD_SLOTS[items.length] || [];
  if (!items.length) return null;
  return (
    <div style={{ position: "relative", height }}>
      {items.map((it, i) => {
        const slot = slots[i];
        if (!slot) return null;
        const img = resolveItemImage(it);
        const hasImg = Boolean(img.url);
        return (
          <div
            key={"board-" + it.id}
            style={{
              position: "absolute",
              left: slot.left + "%",
              top: slot.top + "%",
              width: slot.w + "%",
              height: slot.h + "%",
              transform: `rotate(${slot.rotate}deg)`,
              zIndex: slot.z,
              backgroundColor: hasImg ? undefined : it.hex,
              backgroundImage: hasImg ? `url(${img.url})` : undefined,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              borderRadius: hasImg ? 0 : 8,
              boxShadow: hasImg ? "0 4px 10px rgba(29,26,22,.14)" : "inset 0 0 0 1px rgba(29,26,22,.06)",
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Visuels éditoriaux génériques Capsela pour la card Journal (brief
 * 26/08/2026, fichiers fournis le 26/08/2026) — JAMAIS les photos
 * personnelles de l'utilisatrice (Dressing/Journal réels) : le rôle de ces
 * images est purement d'illustrer le concept "tenues portées au quotidien",
 * adapté uniquement au genre du profil. L'appel gracieux plus bas
 * (PolaroidPhoto, onError) reste en place si l'un de ces fichiers venait à
 * manquer, mais les 6 existent déjà dans /public/editorial.
 */
// Ordre = priorité visuelle (recette 26/08/2026) : la photo la plus
// lumineuse, à la silhouette entière la plus lisible, vient en premier —
// POLAROID_SLOTS[0] (le plus grand emplacement, devant) lui est toujours
// assignée. femme2/homme3 (lumière du jour / studio clair) passent devant
// femme1/homme1 (plus chaudes/contrastées) et femme3/homme2 (les plus
// sombres, les plus éditoriales), reléguées en second plan.
const JOURNAL_VISUALS: Record<"femme" | "homme", string[]> = {
  femme: ["/editorial/editcapsela-femme2-hp.jpg", "/editorial/editcapsela-femme1-hp.jpg", "/editorial/editcapsela-femme3-hp.jpg"],
  homme: ["/editorial/editcapsela-homme3-hp.jpg", "/editorial/editcapsela-homme1-hp.jpg", "/editorial/editcapsela-homme2-hp.jpg"],
};

// Composition en trois photos SÉPARÉES (recette 26/08/2026, 5e correctif —
// signalé une nouvelle fois : "les polaroids se chevauchent toujours"). Les
// quatre passes précédentes ont réduit le recouvrement sans jamais le
// supprimer, la dernière l'assumant même à ≈35-40% de la surface des
// secondaires au nom d'un effet "carnet de souvenirs" : mesuré sur la
// composition déployée, cela représentait ~1350 à 1660 px² de recouvrement
// par paire. L'objectif n'est donc plus de doser le chevauchement mais de
// l'éliminer : une principale dominante à gauche (≈2x la surface d'une
// secondaire), deux secondaires empilées à droite, aucune ne mordant sur
// une autre.
//
// Géométrie vérifiée par calcul sur 360/390/412/430px de large, ROTATION
// COMPRISE (une boîte tournée déborde de sa boîte CSS : une rotation de 3°
// sur ~55px ajoute ~1,5px de chaque côté, ce qui suffit à faire se toucher
// deux photos calées au pixel près) : 0 px² de recouvrement, écarts min.
// ~9px à l'horizontale et ~11px à la verticale, et aucun débordement de la
// zone photo. Les rotations restent volontairement faibles (2-3°) : au-delà,
// les coins mangent ces écarts. Toute retouche de left/top/w/h/rotate doit
// donc être revérifiée sur ces quatre largeurs, pas seulement à l'œil sur
// une seule.
//
// Les 3 boîtes restent comprises dans [0,100] (jamais de left/top négatif ni
// de right/bottom > 100) ; la marge intérieure est gérée par le padding du
// conteneur (JSX), pas par des coordonnées négatives. Les z-index, désormais
// sans effet puisqu'il n'y a plus de superposition, sont conservés comme
// garde-fou si une future retouche réintroduisait un contact.
const POLAROID_SLOTS: { left: number; top: number; w: number; h: number; rotate: number; z: number }[] = [
  { left: 2, top: 15, w: 48, h: 64, rotate: -2, z: 3 },
  { left: 60, top: 8, w: 35, h: 38, rotate: 3, z: 2 },
  { left: 60, top: 55, w: 35, h: 38, rotate: -2, z: 1 },
];

function PolaroidPhoto({ src, alt, slot }: { src: string; alt: string; slot: (typeof POLAROID_SLOTS)[number] }) {
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
        background: "#FBF8F3",
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
          src={src}
          alt={alt}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 2, display: "block" }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", borderRadius: 2, background: "#EFE7DA" }} />
      )}
    </div>
  );
}

export default function HomeScreen() {
  const { state, geoCity, geoLoading, vestiairePool, weather, actions } = useCapsela();
  const { profile } = useAuth();
  const firstNameOrYou = profile.displayName || "toi";

  // Bloc principal (brief design Homepage, 19/08/2026 ; alignement proto
  // 20/08/2026) : lecture seule des données déjà disponibles ailleurs dans
  // l'app (météo/localisation, occasion auto-sélectionnée, tenue déjà
  // déterminée) — jamais de génération de tenue ni d'appel image depuis cet
  // écran. hasOutfit distingue "tenue déjà déterminée" (visitée au moins
  // une fois cette session) de "pas encore choisie".
  const hasOutfit = state.outfit.length > 0;
  const occasionKey = state.occasion && state.occasion !== "all" ? state.occasion : defaultOccasionToday(profile.prefs);
  const occasionLabel = OCC_LABELS[occasionKey];

  // Pool de résolution stable (même correctif que HistoryScreen, 20/08/2026) :
  // wardrobePool ne contient, par catégorie, que les pièces réelles ou les
  // suggestions de la capsule du profil courant, alors que state.outfit peut
  // venir de la capsule d'un style exploré (viewExploredOutfit) ou d'une
  // entrée d'historique rejouée — la card "tenue du jour" se vidait alors ici
  // alors que la page Tenue, elle, l'affichait.
  const resolvePool = [...state.items, ...vestiairePool];
  const outfitPieces = hasOutfit
    ? state.outfit.map((id) => resolvePool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it))
    : [];

  // Même phrase d'explication que la page Tenue (explainRecommendation,
  // jamais un second template) — pas de température affichée tant que la
  // géolocalisation n'a pas résolu la météo réelle du jour.
  const outfitQuote = explainRecommendation(occasionKey, state.workMode, state.dateContext, geoLoading ? null : geoCity.temp);

  // Section "Explore L'édit Capsela" (refonte éditoriale 26/08/2026) —
  // capsule calculée avec le même moteur que CapsuleScreen
  // (computeDefaultCapsule), jamais un second calcul : saison/style/effectif
  // affichés ici doivent toujours correspondre exactement à l'écran Capsule.
  const capsuleSeason = state.capsuleSeason || currentSeasonKey();
  const capsule = computeDefaultCapsule(profile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool);
  const capsuleStyleLabel = styleLabel(profile.styles[0], profile.gender);

  const dressingCount = state.items.length;
  const dressingPieces = selectBoardPieces(state.items, 3);
  const capsulePieces = selectBoardPieces(capsule, 4);

  const journalGender: "femme" | "homme" = profile.gender === "homme" ? "homme" : "femme";
  const journalVisuals = JOURNAL_VISUALS[journalGender];

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-[100px]">
      <div className="px-6">
        <AppHeader />
      </div>

      <div className="px-6 mt-[18px]">
        <div className="text-[11px] tracking-[.18em] uppercase text-muted">Aujourd&apos;hui</div>
        <div className="font-serif text-[30px] leading-[1.12] text-ink mt-[6px]">
          Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
        </div>
      </div>

      <button
        onClick={actions.goTenues}
        className="mx-6 mt-5 bg-terracotta active:bg-terracotta-hover rounded-[22px] p-[22px] cursor-pointer relative overflow-hidden text-left block"
        style={{ width: "calc(100% - 48px)" }}
      >
        <div className="font-serif text-[22px] text-cream leading-[1.25]">
          {hasOutfit ? (
            "Ta tenue est prête"
          ) : (
            <>
              Découvre ta
              <br />
              tenue du jour
            </>
          )}
        </div>
        <div className="text-[12.5px] mt-[7px]" style={{ color: hasOutfit ? "rgba(243,238,229,.82)" : "rgba(243,238,229,.8)", maxWidth: 230 }}>
          {hasOutfit ? outfitQuote : "Une sélection pensée pour toi, ta journée et la météo."}
        </div>
        {hasOutfit && outfitPieces.length > 0 && (
          <div
            style={{
              marginTop: 14,
              position: "relative",
              borderRadius: 14,
              overflow: "hidden",
              background: "rgba(243,238,229,.14)",
              height: 148,
            }}
          >
            {/* Cluster central à 82% de largeur (brief composition 20/08/2026,
                passe éditoriale) — utilise davantage la largeur disponible
                que la première passe (76%), tout en gardant un peu d'air de
                part et d'autre plutôt que de remplir toute la card. */}
            <div style={{ position: "relative", width: "82%", height: "100%", margin: "0 auto" }}>
              {homeCompositionPiecesOf(outfitPieces).map((p) => (
                <div key={"home-comp-" + p.id} style={p.style} />
              ))}
            </div>
          </div>
        )}
        <div className="flex items-center gap-[10px] flex-wrap" style={{ marginTop: hasOutfit ? 14 : 16 }}>
          {hasOutfit && occasionLabel && (
            <div
              className="inline-flex items-center gap-[7px] text-[10px] tracking-[.08em] uppercase"
              style={{ background: "rgba(243,238,229,.16)", color: "#F3EEE5", borderRadius: 100, padding: "7px 14px" }}
            >
              {occasionLabel}
            </div>
          )}
          <div className="inline-flex items-center gap-[7px] bg-cream text-ink rounded-full py-[10px] px-4 text-[12px] tracking-[.04em]">
            {hasOutfit ? "Voir ma tenue →" : "Découvrir ma tenue →"}
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between mx-6 mt-[26px] mb-3">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Explore L&apos;édit Capsela</span>
      </div>

      <div className="flex flex-col gap-3 px-6">
        <div className="flex gap-3">
          {/* Dressing — ce que je possède : planche de stylisme faite de
              vraies pièces du dressing, effectif réel dynamique. */}
          <button
            onClick={actions.goWardrobe}
            className="flex-1 min-w-0 text-left cursor-pointer rounded-[20px] border border-border overflow-hidden flex flex-col box-border"
            style={{ background: "linear-gradient(165deg, #F6F0E6 0%, #EEE1CE 100%)" }}
          >
            <div className="px-[14px] pt-[14px]">
              <StyleBoard items={dressingPieces} height={122} />
            </div>
            <div className="px-[14px] pt-[10px] pb-[14px]">
              <div className="font-serif text-[17px] text-ink leading-[1.2]">Dressing</div>
              <div className="text-[11px] text-muted leading-[1.4] mt-[6px]">Tes pièces, tes looks, ton vestiaire.</div>
              <div className="text-[12px] text-terracotta mt-[9px]">
                {dressingCount} {dressingCount <= 1 ? "pièce" : "pièces"} →
              </div>
            </div>
          </button>

          {/* Capsule — la sélection mode proposée par L'édit Capsela : mini
              sélection de styliste (tailles/rotation variées, léger
              chevauchement), jamais une grille e-commerce. */}
          <button
            onClick={actions.goCapsule}
            className="flex-1 min-w-0 text-left cursor-pointer rounded-[20px] border border-border overflow-hidden flex flex-col box-border"
            style={{ background: "linear-gradient(165deg, #F0E7D9 0%, #E5D6BF 100%)" }}
          >
            <div className="px-[14px] pt-[14px]">
              <StyleBoard items={capsulePieces} height={122} />
            </div>
            <div className="px-[14px] pt-[10px] pb-[14px]">
              <div className="font-serif text-[17px] text-ink leading-[1.2]">
                Capsule <span className="italic text-terracotta">{capsuleSeason}</span>
              </div>
              <div className="text-[10.5px] text-muted mt-[3px]">
                {capsuleStyleLabel ? capsuleStyleLabel + " · " : ""}
                {capsule.length} {capsule.length <= 1 ? "pièce" : "pièces"}
              </div>
              <div className="text-[11px] text-muted leading-[1.4] mt-[6px]">
                Une sélection pensée pour ton style et ta palette.
              </div>
              <div className="text-[12px] text-terracotta mt-[9px]">Découvrir →</div>
            </div>
          </button>
        </div>

        {/* Journal des tenues — les tenues portées au fil du temps. Deux
            zones au poids visuel comparable (46% photos / 54% contenu,
            recette 26/08/2026, 5e passe) : les polaroids, agrandis et
            désormais entièrement séparés (cf. POLAROID_SLOTS),
            dominent la hauteur de la card au même titre que le bloc texte —
            jamais un texte principal accompagné d'une pile décorative
            secondaire. Padding vertical symétrique (14px) = le mécanisme de
            centrage de la composition photo, cohérent avec justify-center
            côté texte. Visuels éditoriaux génériques (PolaroidPhoto), jamais
            les photos personnelles du dressing/journal réels. */}
        <button
          onClick={actions.goHistory}
          className="w-full text-left cursor-pointer rounded-[20px] border border-border overflow-hidden flex box-border"
          style={{ background: "linear-gradient(120deg, #F6F0E6 0%, #EEE1CE 100%)" }}
        >
          <div className="relative flex-shrink-0 box-border" style={{ width: "46%", height: 176, padding: "14px 12px" }}>
            <div className="relative w-full h-full">
              {journalVisuals.map((src, i) => (
                <PolaroidPhoto key={src} src={src} alt="" slot={POLAROID_SLOTS[i]} />
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center" style={{ padding: "18px 18px 18px 8px" }}>
            <div className="font-serif text-[17px] text-ink leading-[1.2]">Journal des tenues</div>
            <div className="text-[11.5px] text-muted leading-[1.4] mt-[4px]">Garde une trace de tes tenues au fil des jours.</div>
            <div className="text-[12px] text-terracotta mt-[7px]">Voir le journal →</div>
          </div>
        </button>
      </div>
    </div>
  );
}
