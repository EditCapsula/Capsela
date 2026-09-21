"use client";

import { useState } from "react";
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
 * DEUX BORNES CONTRAIGNENT CES VALEURS, et elles ont été vérifiées par calcul
 * sur 320 / 360 / 375 / 390 / 412 / 430 / 480 px de large, pour les DEUX
 * compositions, pas à l'œil sur une seule largeur. Mes premières valeurs
 * violaient les deux.
 *
 * À GAUCHE — le texte. Le titre est borné à 42 % de la card et la météo à
 * 38 %, donc aucune pièce ne peut commencer avant 44 % (le haut, dans la bande
 * du titre) ni 40 % (les chaussures, dans celle de la météo). C'est cette
 * contrainte qui fixe le décalage du cluster, pas l'esthétique.
 *
 * Le titre descend à 20 px sous 380 px de large : à 26 px, la colonne tombe à
 * 92 px et « Ta tenue est prête » se brisait en QUATRE lignes pour trois mots.
 *
 * EN BAS — la rangée badge + bouton, haute de 44 px et calée à 18 px du bord,
 * occupe donc les 62 derniers pixels. Aucune pièce ne descend sous 77 %. Deux
 * corrections successives ont été nécessaires : mes premières valeurs
 * faisaient descendre les chaussures à 88 %, franchement sous le bouton ; les
 * secondes laissaient encore la jupe mordre de 1,5 px sur la rangée entre 360
 * et 390 px, ce qui aurait transparu sous le badge, lui semi-opaque.
 *
 * La phrase météo la plus longue que puisse produire `explainRecommendation`
 * — « 12° aujourd'hui · confortable, une couche en plus si besoin », 59
 * caractères — va jusqu'à 6 lignes au plus étroit. Le bloc titre + météo y
 * mesure alors 177 px sur une card de 318, dont la rangée basse commence à
 * 256 : 79 px d'air. C'est le pire cas mesuré, pas une estimation.
 *
 * Largeurs conformes au brief : haut 40 %, bas 46 %, sac 24 %, chaussures 28 %.
 */
const HERO_SLOTS_ONEPIECE: Record<HomeRole, HeroSlot> = {
  onepiece: { left: 44, top: 8, w: 44, h: 68, z: 3 },
  haut: { left: 44, top: 8, w: 44, h: 68, z: 3 },
  bas: { left: 44, top: 8, w: 44, h: 68, z: 3 },
  chaussures: { left: 40, top: 50, w: 28, h: 27, z: 4 },
  sac: { left: 74, top: 9, w: 24, h: 25, z: 2 },
  petit: { left: 80, top: 52, w: 17, h: 18, z: 2 },
};
const HERO_SLOTS_STANDARD: Record<HomeRole, HeroSlot> = {
  onepiece: { left: 44, top: 12, w: 40, h: 40, z: 3 },
  haut: { left: 44, top: 12, w: 40, h: 40, z: 3 },
  bas: { left: 52, top: 30, w: 46, h: 47, z: 2 },
  chaussures: { left: 40, top: 50, w: 28, h: 27, z: 4 },
  sac: { left: 74, top: 9, w: 24, h: 25, z: 1 },
  petit: { left: 80, top: 52, w: 17, h: 18, z: 1 },
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
          Deux géométries, et c'est délibéré :
          · avec tenue, la card prend le ratio 1.28/1 de la maquette et la
            composition occupe toute sa surface ;
          · sans tenue, elle reste en hauteur automatique. Imposer le même
            ratio à un état sans image produirait 330 px de terracotta vide,
            ce qui n'est pas « éditorial » mais creux.
          Le min-height passe à 318 px sous 360 px de large pour que le titre,
          la météo, le badge et le bouton ne se rejoignent jamais : à cette
          largeur le ratio seul ne donnerait que ~212 px. */}
      <button
        onClick={actions.goTenues}
        className={
          "mx-6 mt-6 bg-terracotta active:bg-terracotta-hover rounded-[24px] cursor-pointer relative overflow-hidden text-left block " +
          (avecComposition ? "min-h-[275px] max-[359px]:min-h-[318px]" : "")
        }
        style={{
          width: "calc(100% - 48px)",
          ...(avecComposition ? { aspectRatio: "1.28 / 1", maxHeight: 330 } : { padding: 22 }),
        }}
      >
        {avecComposition && (
          <div className="absolute inset-0" aria-hidden="true">
            {heroPieces.map((it) => (
              <HeroPiece key={"hero-" + it.id} item={it} slot={heroSlots[homeRoleOf(it.cat)]} eager />
            ))}
          </div>
        )}

        {/* Aucun <br /> forcé dans le titre : il se replie seul dans sa
            colonne, ce qui reste juste quel que soit l'appareil. Un saut en
            dur donnait trois lignes au lieu de deux sous 360 px. */}
        <div className="relative z-10" style={avecComposition ? { padding: "22px 22px 0 22px" } : undefined}>
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
            {hasOutfit ? outfitQuote : "Une sélection pensée pour toi, ta journée et la météo."}
          </div>
        </div>

        {/* Badge et bouton alignés en bas. Absolus quand la card porte une
            composition (ils doivent tenir le bas de la card, pas suivre le
            texte), en flux sinon. */}
        <div
          className={
            "flex items-center gap-[10px] flex-wrap z-10 " +
            (avecComposition ? "absolute left-[22px] right-[22px] bottom-[18px]" : "mt-4")
          }
        >
          {hasOutfit && occasionLabel && (
            <div
              className="inline-flex items-center text-[10px] tracking-[.08em] uppercase"
              style={{ background: "rgba(243,238,229,.24)", color: "#F3EEE5", borderRadius: 100, padding: "0 16px", minHeight: 44 }}
            >
              {occasionLabel}
            </div>
          )}
          {/* 44 px de haut minimum — cible tactile, et le bouton principal de
              la page ne peut pas être le plus petit élément cliquable. */}
          <div
            className="inline-flex items-center justify-center bg-cream text-ink rounded-full px-5 text-[13px] tracking-[.04em]"
            style={{ minHeight: 44 }}
          >
            {hasOutfit ? "Voir ma tenue →" : "Découvrir ma tenue →"}
          </div>
        </div>
      </button>

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
            style={{ background: "linear-gradient(165deg, #F6F0E6 0%, #EEE1CE 100%)" }}
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
            style={{ background: "linear-gradient(165deg, #F0E7D9 0%, #E5D6BF 100%)" }}
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
                {capsuleStyleLabel
                  ? `Une sélection pensée pour ton style ${capsuleStyleLabel} et tes couleurs.`
                  : "Une sélection pensée pour ton style et tes couleurs."}
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
          style={{ background: "linear-gradient(120deg, #F6F0E6 0%, #EEE1CE 100%)" }}
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
