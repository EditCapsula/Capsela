"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { OCC_LABELS, WEATHER_ICONS } from "@/lib/data";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { computeDefaultCapsule, currentSeasonKey } from "@/lib/capsule";
import { explainRecommendation } from "@/lib/logic";
import { useAuth } from "@/lib/auth";
import { styleLabel } from "@/lib/profile";
import { useCapsela, defaultOccasionToday } from "@/lib/store";
import type { CategoryKey, Item } from "@/lib/types";

/**
 * Flat-lay éditorial de la card héros (refonte 21/09/2026, maquette V3) —
 * même source que la page Tenue (state.outfit), jamais un recalcul.
 *
 * Ce qui change par rapport à la version du 20/08 : la composition ne vit plus
 * dans une boîte de 148 px intercalée entre le texte et les boutons, elle
 * occupe TOUTE la card, texte et actions passant par-dessus. C'est ce qui fait
 * basculer la page d'une card informative à un vrai moment visuel — le teaser
 * ne pouvait pas tenir ce rôle tant qu'il était un bandeau au milieu.
 *
 * La sélection reste inchangée : priorité stricte (robe/combinaison seule
 * sinon haut + bas, puis chaussures, sac, au plus un accessoire) et un rôle
 * par pièce.
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

type HeroSlot = { left: number; top: number; w: number; h: number; z: number };

/**
 * Emplacements en % de la CARD ENTIÈRE, et non plus d'un cluster interne à
 * 82 % : c'est la condition pour que les pièces atteignent la taille de la
 * maquette, sur une card deux fois plus haute qu'avant. Les chevauchements
 * sont volontaires et faibles — le haut mord sur le bas, les chaussures sur
 * le bas, le sac sur le coin haut du bas — jamais au point de masquer une
 * pièce principale, d'où les z-index.
 *
 * LES % SONT RELATIFS À LA ZONE DE COMPOSITION, pas à la card : cette zone
 * s'arrête 66 px avant le bas (22 de padding + 44 de rangée badge/bouton).
 * Aucune pièce ne peut donc atteindre les boutons, quelle que soit la hauteur
 * de la card — c'est une borne structurelle, elle ne se recalcule pas.
 *
 * Elle remplace deux tentatives arithmétiques qui ont échoué l'une après
 * l'autre : d'abord des chaussures descendant à 88 % de la card, franchement
 * sous le bouton ; puis une jupe mordant encore 1,5 px sur la rangée entre 360
 * et 390 px. La leçon est que la hauteur disponible dépend de la hauteur de la
 * card, laquelle dépend du contenu : la calculer revenait à poursuivre une
 * cible mobile.
 *
 * LA SEULE CONTRAINTE QUI RESTE ARITHMÉTIQUE est horizontale, et elle a été
 * vérifiée sur 320 / 360 / 375 / 390 / 412 / 430 / 480 px, pour les deux
 * compositions. Le titre est borné à 42 % de la card et la météo à 38 %, donc
 * aucune pièce ne commence avant 44 % (le haut, dans la bande du titre) ni
 * 40 % (les chaussures, dans celle de la météo). C'est cette contrainte qui
 * fixe le décalage du cluster vers la droite, pas l'esthétique.
 *
 * Le titre descend à 20 px sous 380 px de large : à 26 px, la colonne tombe à
 * 92 px et « Ta tenue est prête » se brisait en QUATRE lignes pour trois mots.
 *
 * Largeurs conformes au brief : haut 40 %, bas 46 %, sac 24 %, chaussures 28 %.
 */
const HERO_SLOTS_ONEPIECE: Record<HomeRole, HeroSlot> = {
  onepiece: { left: 44, top: 4, w: 44, h: 86, z: 3 },
  haut: { left: 44, top: 4, w: 44, h: 86, z: 3 },
  bas: { left: 44, top: 4, w: 44, h: 86, z: 3 },
  chaussures: { left: 40, top: 62, w: 28, h: 34, z: 4 },
  sac: { left: 74, top: 4, w: 24, h: 32, z: 2 },
  petit: { left: 80, top: 66, w: 17, h: 24, z: 2 },
};
const HERO_SLOTS_STANDARD: Record<HomeRole, HeroSlot> = {
  onepiece: { left: 44, top: 8, w: 40, h: 52, z: 3 },
  haut: { left: 44, top: 8, w: 40, h: 52, z: 3 },
  bas: { left: 52, top: 26, w: 46, h: 62, z: 2 },
  chaussures: { left: 40, top: 50, w: 28, h: 35, z: 4 },
  sac: { left: 74, top: 4, w: 24, h: 32, z: 1 },
  petit: { left: 80, top: 54, w: 17, h: 24, z: 1 },
};

/**
 * Une pièce du flat-lay. `<img>` plutôt que `background-image` (brief V3) :
 * `object-fit: contain` garantit la même absence de déformation qu'un
 * `background-size: contain`, mais l'élément devient chargeable en différé et
 * remplaçable par un repli visible quand le fichier manque.
 *
 * `alt=""` est ici le bon alt, pas un oubli : ces images vivent DANS un bouton
 * qui porte déjà son intitulé (« Voir ma tenue »). Leur donner un nom
 * allongerait le nom accessible du bouton de quatre ou cinq libellés produit
 * sans rien apprendre à qui l'écoute.
 */
function HeroPiece({ item, slot, eager }: { item: Item; slot: HeroSlot; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  const img = resolveItemImage(item);
  const showImg = Boolean(img.url) && !failed;
  return (
    <div
      style={{
        position: "absolute",
        left: slot.left + "%",
        top: slot.top + "%",
        width: slot.w + "%",
        height: slot.h + "%",
        zIndex: slot.z,
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img.url}
          alt=""
          decoding="async"
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            // Ombre très douce, portée par la silhouette détourée et non par
            // une boîte : un box-shadow dessinerait le rectangle de l'image.
            filter: "drop-shadow(0 6px 14px rgba(29,26,22,.18))",
          }}
        />
      ) : (
        // Repli quand la pièce n'a aucun visuel : un aplat de sa couleur
        // dominante, pour qu'elle reste présente dans la composition plutôt
        // que de laisser un trou.
        <div style={{ width: "100%", height: "100%", borderRadius: 10, background: item.hex, opacity: 0.9 }} />
      )}
    </div>
  );
}

/**
 * Section « Explore L'édit Capsela » — Dressing et Capsule en vis-à-vis,
 * Journal en pleine largeur. Priorité de catégories pour que la planche montre
 * des familles de vêtements variées, jamais trois fois la même.
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
  // Repli si le dressing/la capsule n'a pas assez de catégories distinctes.
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
  2: [
    { left: 0, top: 6, w: 50, h: 82, rotate: -3, z: 2 },
    { left: 52, top: 26, w: 46, h: 64, rotate: 4, z: 1 },
  ],
  3: [
    { left: 0, top: 8, w: 44, h: 80, rotate: -3, z: 2 },
    { left: 46, top: 0, w: 40, h: 44, rotate: 4, z: 1 },
    { left: 50, top: 50, w: 38, h: 46, rotate: -2, z: 3 },
  ],
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
    <div style={{ position: "relative", height }} aria-hidden="true">
      {items.map((it, i) => {
        const slot = slots[i];
        if (!slot) return null;
        return <BoardPiece key={"board-" + it.id} item={it} slot={slot} />;
      })}
    </div>
  );
}

function BoardPiece({ item, slot }: { item: Item; slot: BoardSlot }) {
  const [failed, setFailed] = useState(false);
  const img = resolveItemImage(item);
  const showImg = Boolean(img.url) && !failed;
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
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img.url}
          alt=""
          decoding="async"
          loading="lazy"
          onError={() => setFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 4px 9px rgba(29,26,22,.15))",
          }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", borderRadius: 8, background: item.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }} />
      )}
    </div>
  );
}

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
 * Composition en trois photos SÉPARÉES. Ce point ne se négocie pas, et la
 * maquette V3 ne le remet pas en cause : elle propose des tirages
 * partiellement superposés, mais le chevauchement a été SIGNALÉ CINQ FOIS par
 * l'utilisatrice avant d'être éliminé le 26/08/2026. Les quatre passes
 * précédentes l'avaient réduit sans jamais le supprimer. On ne le réintroduit
 * pas au nom d'une direction artistique.
 *
 * Géométrie vérifiée par calcul sur 320/360/390/412/430 px de large, ROTATION
 * COMPRISE (une boîte tournée déborde de sa boîte CSS : 3° sur ~55 px ajoutent
 * ~1,5 px de chaque côté, ce qui suffit à faire se toucher deux photos calées
 * au pixel près) : 0 px² de recouvrement. Au plus étroit (320 px, colonne
 * photo à 50 %), l'écart horizontal minimal est de ~9,3 px pour ~3,7 px
 * repris par les rotations. Toute retouche de left/top/w/h/rotate doit être
 * revérifiée sur ces cinq largeurs, pas seulement à l'œil sur une seule.
 */
const POLAROID_SLOTS: BoardSlot[] = [
  { left: 6, top: 10, w: 46, h: 62, rotate: -2, z: 3 },
  { left: 60, top: 6, w: 33, h: 40, rotate: 3, z: 2 },
  { left: 60, top: 54, w: 33, h: 40, rotate: -2, z: 1 },
];

/**
 * Collage d'attente de la card Dressing, quand aucune pièce n'a encore été
 * saisie (brief 28/08/2026). Réutilise les photos éditoriales du Journal dans
 * la géométrie des planches, pas celle du Journal : même hauteur que
 * StyleBoard, donc aucun décalage au passage vide → rempli.
 *
 * Ces images sont purement décoratives. Elles ne sont jamais comptées,
 * n'entrent ni dans wardrobePool ni dans le moteur.
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
        <div style={{ width: "100%", height: "100%", borderRadius: 2, background: "#EFE7DA" }} />
      )}
    </div>
  );
}

export default function HomeScreen() {
  const { state, geoCity, geoLoading, vestiairePool, weather, actions } = useCapsela();
  const { profile } = useAuth();
  const firstNameOrYou = profile.displayName || "toi";

  // Lecture seule des données déjà disponibles ailleurs dans l'app
  // (météo/localisation, occasion auto-sélectionnée, tenue déjà déterminée) —
  // jamais de génération de tenue ni d'appel image depuis cet écran.
  const hasOutfit = state.outfit.length > 0;
  const occasionKey = state.occasion && state.occasion !== "all" ? state.occasion : defaultOccasionToday(profile.prefs);
  const occasionLabel = OCC_LABELS[occasionKey];

  // Pool de résolution stable : wardrobePool ne contient, par catégorie, que
  // les pièces réelles ou les suggestions de la capsule du profil courant,
  // alors que state.outfit peut venir d'un style exploré ou d'une entrée
  // d'historique rejouée.
  const resolvePool = [...state.items, ...vestiairePool];
  const outfitPieces = hasOutfit
    ? state.outfit.map((id) => resolvePool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it))
    : [];

  // Même phrase d'explication que la page Tenue (explainRecommendation) — pas
  // de température affichée tant que la géolocalisation n'a pas résolu la
  // météo réelle du jour.
  const outfitQuote = explainRecommendation(occasionKey, state.workMode, state.dateContext, geoLoading ? null : geoCity.temp);

  // Capsule calculée avec le même moteur que CapsuleScreen, jamais un second
  // calcul : saison/style/effectif affichés ici correspondent toujours
  // exactement à l'écran Capsule.
  const capsuleSeason = state.capsuleSeason || currentSeasonKey();
  const capsule = computeDefaultCapsule(profile, weather, state.suggestedExcluded, capsuleSeason, vestiairePool);
  const capsuleStyleLabel = styleLabel(profile.styles[0], profile.gender);

  /**
   * Icône météo — lue en UN point, depuis la seule table de l'app
   * (WEATHER_ICONS). Arbitré le 22/09 : on garde les emoji pour l'instant, et
   * ce point unique est ce qui rendra un passage aux glyphes dessinés
   * réversible en une table plutôt qu'en une chasse à travers l'écran.
   * La source est `geoCity.label`, la condition COURANTE rendue par
   * l'endpoint /weather d'OpenWeather — pas une prévision, pas une moyenne.
   */
  const iconeMeteo = WEATHER_ICONS[geoCity.label];

  /**
   * PROVENANCE DES PIÈCES — d'où vient la tenue du jour.
   *
   * `isCatalogId` sépare une pièce réellement possédée d'une suggestion de
   * la capsule : la même séparation que l'écran Tenue, jamais un second
   * calcul. Le dressing passe toujours en premier, même quand il n'apporte
   * qu'une pièce — c'est la hiérarchie du produit, pas un tri par quantité.
   *
   * Rien n'est dit quand il n'y a pas de tenue, et jamais « 0 pièce ».
   */
  const provenanceTexte = (() => {
    const total = outfitPieces.length;
    if (!total) return null;
    const capsule = outfitPieces.filter((it) => isCatalogId(it.id)).length;
    const dressing = total - capsule;
    const pieces = (n: number) => `${n} ${n <= 1 ? "pièce" : "pièces"}`;
    if (!capsule) return `${pieces(dressing)} de ton dressing`;
    if (!dressing) return `${pieces(capsule)} de ta capsule`;
    return `${pieces(dressing)} de ton dressing + ${pieces(capsule)} de ta capsule`;
  })();

  /** Même clé que toggleSaveOutfitLook (store.tsx) — jamais une autre définition de « déjà enregistrée ». */
  const tenueEnregistree = (() => {
    if (!hasOutfit) return false;
    const cle = [...state.outfit].sort((a, b) => a - b).join(",");
    return state.savedLooks.some(
      (l) => l.source === "saved" && [...l.pieceIds].sort((a, b) => a - b).join(",") === cle
    );
  })();

  const dressingCount = state.items.length;
  const dressingVide = dressingCount === 0;
  const dressingPieces = selectBoardPieces(state.items, 3);
  const capsulePieces = selectBoardPieces(capsule, 4);

  const journalGender: "femme" | "homme" = profile.gender === "homme" ? "homme" : "femme";
  const journalVisuals = JOURNAL_VISUALS[journalGender];
  // Ordre inversé pour la planche d'attente du Dressing : le stock ne compte
  // que trois photos par genre, donc les deux cards montrent les mêmes
  // fichiers. Changer la dominante évite l'effet de copie exacte.
  const emptyBoardVisuals = [...journalVisuals].slice().reverse();

  const heroSlots = outfitPieces.some((it) => isOnePieceCat(it.cat)) ? HERO_SLOTS_ONEPIECE : HERO_SLOTS_STANDARD;
  const heroPieces = selectHomePieces(outfitPieces);
  /**
   * LA ZONE DE COMPOSITION S'ARRÊTE OÙ LES PIÈCES S'ARRÊTENT.
   *
   * Les emplacements sont des pourcentages, et le plus bas d'entre eux ne
   * descend pas jusqu'en bas : sur la table standard, le bas s'achève à 88 %.
   * Les 12 % restants étaient invisibles tant que la rangée d'actions les
   * recouvrait. Depuis qu'elle a sa propre rangée (22/09), ils forment une
   * bande de terracotta vide sous la composition — signalé le soir même.
   *
   * L'étendue est LUE dans la table active, jamais écrite en dur : la zone
   * est raccourcie d'autant, et les emplacements renormalisés du même
   * facteur. Les pièces gardent donc exactement leur taille et leurs
   * positions relatives ; seule la zone cesse de dépasser sous elles. Si une
   * table d'emplacements change un jour, le calcul suit.
   */
  const etenduePct = Math.max(...Object.values(heroSlots).map((s) => s.top + s.h));
  const facteurZone = 100 / etenduePct;
  const heroSlotsAjustes = Object.fromEntries(
    Object.entries(heroSlots).map(([role, s]) => [role, { ...s, top: s.top * facteurZone, h: s.h * facteurZone }])
  ) as typeof heroSlots;
  /** Le ratio 1/1.28 de la maquette, ramené à l'étendue réelle des pièces. */
  const zoneRatioPct = 78.125 * (etenduePct / 100);


  /** La card ne prend la géométrie de la maquette que si elle a vraiment une composition à montrer. */
  const avecComposition = hasOutfit && heroPieces.length > 0;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto pt-[6px] pb-[100px]">
      <div className="px-6">
        <AppHeader />
      </div>

      {/* Salutation — présence renforcée (30 → 34 px) sans gonfler la hauteur
          de l'en-tête : le gain vient de la taille du serif, pas d'un
          interlignage ou d'une marge supplémentaires. */}
      <div className="px-6 mt-[18px]">
        <div className="text-[11px] tracking-[.18em] uppercase text-muted">Aujourd&apos;hui</div>
        <div className="font-serif text-[34px] leading-[1.08] text-ink mt-[6px]">
          Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
        </div>
      </div>

      {/* ══ Card héros — le moment visuel de la page ══════════════════════
          LA HAUTEUR EST LE MAXIMUM ENTRE LE RATIO ET LE CONTENU, et c'est une
          correction, pas un raffinement. La première version calait le ratio
          1.28/1 en hauteur ferme et posait la rangée badge + bouton en absolu
          à 18 px du bas. À 320 px de large, cette rangée ne tenait plus sur
          une ligne : elle passait à deux, grandissait vers le HAUT et
          recouvrait la phrase météo. Aucun calcul de slots n'aurait rattrapé
          cela — il fallait supprimer la contrainte, pas l'ajuster.
          Deux cellules de grille superposées : un cale-ratio qui ne contient
          rien, et le contenu. La ligne prend la plus haute des deux, donc le
          texte et les boutons ne peuvent PLUS se rencontrer, par construction
          et non par arithmétique.
          Sans tenue, la card reste en hauteur automatique : imposer le ratio à
          un état sans image produirait 330 px de terracotta vide, ce qui n'est
          pas éditorial mais creux. */}
      {/* LA CARD N'EST PLUS UN BOUTON (22/09/2026). Elle en était un, donc
          tout y était cliquable — pratique tant qu'elle ne portait qu'une
          action. Y loger le feedback imposait d'imbriquer des boutons dans un
          bouton, ce que le HTML interdit. La card devient un conteneur, et
          « Voir ma tenue » un vrai bouton.

          Gain accessoire : le nom accessible de l'ancien bouton concaténait
          tout le texte de la card — titre, météo, occasion, libellé — et se
          lisait d'un bloc. Chaque action porte maintenant le sien. */}
      <div
        className="mx-6 mt-6 bg-terracotta rounded-[24px] relative overflow-hidden text-left grid"
        style={{
          width: "calc(100% - 48px)",
          // DEUX RANGÉES, et c'est un correctif (22/09/2026). La card n'en
          // avait qu'une : la couche des pièces s'y arrêtait à une distance
          // ÉCRITE EN DUR du bas (66 px = 22 de padding + 44 de bouton).
          // Ajouter la ligne de feedback a fait grandir la zone basse, la
          // borne est devenue fausse, et à 320 px les chaussons repassaient
          // par-dessus le badge « Travail / Bureau » — exactement le défaut
          // corrigé le 21/09, revenu par une autre porte.
          // Les pièces vivent maintenant dans la rangée « pile », les actions
          // dans « actions » : aucune distance à tenir à jour, et les deux ne
          // peuvent plus se rencontrer.
          gridTemplateAreas: '"pile" "actions"',
          gridTemplateColumns: "1fr",
          gridTemplateRows: "1fr auto",
        }}
      >
        {avecComposition && (
          <>
            {/* LA ZONE DE COMPOSITION GARDE SON RATIO, quoi qu'il arrive au
                texte. Cale-ratio et couche des pièces sont le MÊME élément :
                1 / 1.28 = 78,125 % de la largeur, plafonné à 330 px, jamais
                sous 275.

                Signalé le 22/09 au soir, et c'est moi qui l'avais cassé le
                jour même. En passant la card à deux rangées, la couche des
                pièces est devenue `inset-0` de la rangée haute — laquelle
                grandit avec le texte. Les emplacements étant définis en
                POURCENTAGES de cette zone, une phrase météo de quatre lignes
                étirait toute la composition : chaussures descendues sur la
                jupe, sac remonté, terracotta vide en bas à gauche. Le ratio
                de la maquette n'était plus respecté dès que le texte
                dépassait.

                Les lier rend la chose impossible : la zone des pièces ne
                dépend plus que de la largeur de la card. Si le texte a besoin
                de plus de place, la rangée grandit SOUS la composition, qui
                ne bouge pas.

                `zIndex: 0` explicite : les enfants s'empilent entre 1 et 4 et
                doivent rester sous le texte, en z-10. */}
            <div
              aria-hidden="true"
              className="relative self-start w-full"
              style={{
                gridArea: "pile",
                paddingTop: `${zoneRatioPct}%`,
                minHeight: 275 * (etenduePct / 100),
                maxHeight: 330 * (etenduePct / 100),
                zIndex: 0,
              }}
            >
              <div className="absolute inset-0">
                {heroPieces.map((it) => (
                  <HeroPiece key={"hero-" + it.id} item={it} slot={heroSlotsAjustes[homeRoleOf(it.cat)]} eager />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Aucun <br /> forcé dans le titre : il se replie seul dans sa
            colonne, ce qui reste juste quel que soit l'appareil. Un saut en
            dur donnait trois lignes au lieu de deux sous 360 px. */}
        <div className="relative z-10 flex flex-col" style={{ gridArea: "pile", padding: 22 }}>
          <div
            className="font-serif text-[20px] min-[380px]:text-[26px] text-cream leading-[1.14]"
            style={avecComposition ? { maxWidth: "42%" } : undefined}
          >
            {hasOutfit ? "Ta tenue est prête" : "Découvre ta tenue du jour"}
          </div>
          <div
            className="text-[12.5px] mt-[8px] leading-[1.35]"
            style={{ color: "rgba(243,238,229,.84)", maxWidth: avecComposition ? "38%" : 230 }}
          >
            {/* L'icône vient de WEATHER_ICONS, la seule table de l'app, lue
                en UN point pour qu'un passage aux glyphes dessinés reste un
                changement de table et non une chasse à travers l'écran.
                Jamais affichée tant que la météo n'est pas résolue : une
                icône par défaut serait une condition inventée. */}
            {hasOutfit && !geoLoading && iconeMeteo && (
              <span aria-hidden="true" className="mr-[5px]">
                {iconeMeteo}
              </span>
            )}
            {hasOutfit ? outfitQuote : "Une sélection pensée pour toi, ta journée et la météo."}
          </div>

          {/* PROVENANCE — la fonction pédagogique du brief : faire comprendre
              que Capsela part de ce qu'on possède et complète si nécessaire.
              Comptée depuis la tenue réelle (isCatalogId), jamais écrite en
              dur, et absente quand il n'y a pas de tenue. Volontairement plus
              discrète que la phrase météo : elle explique, elle n'annonce
              pas. */}
          {provenanceTexte && (
            <div
              className="text-[11px] mt-[6px] leading-[1.35]"
              style={{ color: "rgba(243,238,229,.62)", maxWidth: avecComposition ? "42%" : 240 }}
            >
              {provenanceTexte}
            </div>
          )}

          {/* Le carton décoratif « Le look du jour » est retiré le
              22/09/2026, sur arbitrage. Il occupait la place où vient la
              ligne de feedback, et il aurait formé un troisième élément
              d'allure cliquable dans une card censée n'en porter qu'une. Il
              n'existait ni comme donnée ni comme visuel : rien ne se perd
              qu'un ornement. */}

        </div>

        {/* LA BANDE D'ACTIONS — sa propre rangée de grille. Elle prend la
            hauteur qu'il lui faut, badge et bouton sur une ou deux lignes
            selon la largeur, et la composition au-dessus s'ajuste d'elle-même
            puisque la première rangée vaut 1fr. Plus aucune distance au bas de
            la card n'est écrite quelque part. */}
        <div className="relative z-10 flex flex-col" style={{ gridArea: "actions", padding: "0 22px 22px" }}>
          <div className="flex items-center gap-[10px] flex-wrap pt-4">
            {hasOutfit && occasionLabel && (
              <div
                className="inline-flex items-center text-[10px] tracking-[.08em] uppercase"
                style={{ background: "rgba(243,238,229,.24)", color: "#F3EEE5", borderRadius: 100, padding: "0 16px", minHeight: 44 }}
              >
                {occasionLabel}
              </div>
            )}
            {/* 44 px de haut minimum — cible tactile, et le bouton principal
                de la page ne peut pas être le plus petit élément cliquable. */}
            <button
              onClick={actions.goTenues}
              className="inline-flex items-center justify-center bg-cream text-ink rounded-full px-5 text-[13px] tracking-[.04em] cursor-pointer"
              style={{ minHeight: 44 }}
            >
              {hasOutfit ? "Voir ma tenue →" : "Découvrir ma tenue →"}
            </button>
          </div>

          {/* FEEDBACK — deux signaux, aucune table nouvelle.
              « J'adore » appelle toggleSaveOutfitLook (saved_looks, migration
              0025) et « Pas aujourd'hui » la régénération : les deux
              existaient déjà dans l'écran Tenue sous les noms « Enregistrer »
              et « Autre tenue ». Rien n'est créé en base, et le signal capté
              est exactement celui que l'app savait déjà capter.

              Sous le CTA et en petit : le brief demande qu'il ne pousse pas à
              agir avant « Voir ma tenue ». */}
          {hasOutfit && (
            <div className="flex items-center gap-[14px] flex-wrap mt-[12px]">
              <span className="text-[11px]" style={{ color: "rgba(243,238,229,.6)" }}>
                Cette tenue te plaît ?
              </span>
              <button
                onClick={actions.toggleSaveOutfitLook}
                aria-pressed={tenueEnregistree}
                className="inline-flex items-center gap-[5px] text-[11.5px] cursor-pointer"
                style={{ color: "rgba(243,238,229,.86)", minHeight: 32 }}
              >
                <span aria-hidden="true">{tenueEnregistree ? "♥" : "♡"}</span>
                {tenueEnregistree ? "Enregistrée" : "J'adore"}
              </button>
              <button
                onClick={actions.regenOutfit}
                className="inline-flex items-center gap-[5px] text-[11.5px] cursor-pointer"
                style={{ color: "rgba(243,238,229,.86)", minHeight: 32 }}
              >
                <span aria-hidden="true">×</span> Pas aujourd&apos;hui
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mx-6 mt-6 mb-3">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Explore L&apos;édit Capsela</span>
      </div>

      <div className="flex flex-col gap-3 px-6">
        {/* Grille à deux colonnes explicite (et non deux flex-1) : minmax(0,1fr)
            empêche une planche large de pousser sa colonne au-delà de la
            moitié, ce qui arrivait en flex dès qu'une image était plus large
            que prévu. */}
        <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          {/* Dressing — ce que je possède : planche faite de vraies pièces du
              dressing, effectif réel dynamique. */}
          <button
            onClick={dressingVide ? actions.openAdd : actions.goWardrobe}
            className="min-w-0 text-left cursor-pointer rounded-[22px] border border-border overflow-hidden flex flex-col box-border min-h-[300px]"
            style={{ background: "#F2E9DA" }}
          >
            {/* Zone visuelle ≈ 55 % de la hauteur de la card (165 px sur 300).
                Même hauteur dans les deux états : le passage de la planche
                d'attente aux vraies pièces ne déplace rien. */}
            <div className="px-[14px] pt-[14px]">
              {dressingVide ? (
                <EmptyDressingBoard visuals={emptyBoardVisuals} height={165} />
              ) : (
                <StyleBoard items={dressingPieces} height={165} />
              )}
            </div>
            <div className="px-[14px] pt-[12px] pb-[14px]">
              <div className="font-serif text-[19px] text-ink leading-[1.18]">Dressing</div>
              <div className="text-[11.5px] text-muted leading-[1.4] mt-[6px]">
                {dressingVide ? "Ajoute tes pièces pour créer tes premiers looks." : "Tes pièces, tes looks, ton vestiaire."}
              </div>
              <div className="text-[12px] text-terracotta mt-[9px]">
                {dressingVide
                  ? "Ajouter mes pièces →"
                  : dressingCount === 1
                    ? "Voir ma pièce →"
                    : `Voir mes ${dressingCount} pièces →`}
              </div>
            </div>
          </button>

          {/* Capsule — la sélection proposée par L'édit Capsela : mini planche
              de styliste (tailles et rotations variées, léger chevauchement),
              jamais une grille e-commerce. */}
          <button
            onClick={actions.goCapsule}
            className="min-w-0 text-left cursor-pointer rounded-[22px] border border-border overflow-hidden flex flex-col box-border min-h-[300px]"
            style={{ background: "#EBDFCC" }}
          >
            <div className="px-[14px] pt-[14px]">
              <StyleBoard items={capsulePieces} height={165} />
            </div>
            <div className="px-[14px] pt-[12px] pb-[14px]">
              <div className="font-serif text-[19px] text-ink leading-[1.18]">
                Capsule <span className="italic text-terracotta">{capsuleSeason}</span>
              </div>
              {/* Effectif toujours lu depuis la capsule calculée, jamais écrit
                  en dur — c'est la même valeur qu'affiche l'écran Capsule. */}
              <div className="text-[11.5px] text-muted mt-[5px]">
                Actuellement {capsule.length} {capsule.length <= 1 ? "pièce" : "pièces"}
              </div>
              <div className="text-[11.5px] text-muted leading-[1.4] mt-[5px]">
                {/* Le rôle de la capsule, dit sans jamais laisser entendre
                    qu'elle est la source des tenues : le dressing est
                    prioritaire, elle complète. */}
                {capsuleStyleLabel
                  ? `Une sélection virtuelle pensée pour ton style ${capsuleStyleLabel}, pour compléter ton dressing quand il en a besoin.`
                  : "Une sélection virtuelle pensée pour ton style, pour compléter ton dressing quand il en a besoin."}
              </div>
              <div className="text-[12px] text-terracotta mt-[9px]">Découvrir →</div>
            </div>
          </button>
        </div>

        {/* Journal des tenues — carte horizontale pleine largeur.
            54 % photos / 46 % texte, ramenés à 50/50 sous 360 px pour que le
            texte garde une largeur lisible plutôt que de rétrécir la police.
            Visuels éditoriaux génériques, jamais les photos personnelles. */}
        <button
          onClick={actions.goHistory}
          className="w-full text-left cursor-pointer rounded-[22px] border border-border overflow-hidden grid box-border min-h-[190px] grid-cols-[54%_46%] max-[359px]:grid-cols-[50%_50%]"
          style={{ background: "#F2E9DA" }}
        >
          <div className="relative box-border min-w-0" style={{ padding: "10px 10px" }}>
            <div className="relative w-full h-full">
              {journalVisuals.map((photo, i) => (
                <PolaroidPhoto key={photo.src} photo={photo} slot={POLAROID_SLOTS[i]} />
              ))}
            </div>
          </div>
          <div className="min-w-0 flex flex-col justify-center" style={{ padding: "18px 18px 18px 10px" }}>
            <div className="font-serif text-[19px] text-ink leading-[1.18]">Journal des tenues</div>
            <div className="text-[11.5px] text-muted leading-[1.4] mt-[6px]">Garde une trace de tes tenues au fil des jours.</div>
            <div className="text-[12px] text-terracotta mt-[8px]">Voir le journal →</div>
          </div>
        </button>
      </div>
    </div>
  );
}
