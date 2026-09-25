"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { jourLocal, memeTenue } from "@/lib/outfitFeedback";
import { OCC_LABELS, WEATHER_ICONS } from "@/lib/data";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { computeDefaultCapsule, currentSeasonKey } from "@/lib/capsule";
import { explainRecommendation } from "@/lib/logic";
import { useAuth } from "@/lib/auth";
import { styleLabel } from "@/lib/profile";
import { useCapsela, defaultOccasionToday } from "@/lib/store";
import type { CategoryKey, Item, SavedLook } from "@/lib/types";

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
          <div className="font-serif text-[18px] text-ink leading-[1.18]">{titre}</div>
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
              background: "#FBF8F3",
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
    <div style={{ borderRadius: 3, overflow: "hidden", background: showImg ? "#F3EDE1" : piece.hex }}>
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
  /**
   * Avis du jour — local, et volontairement non persisté pour l'instant :
   * la table `outfit_feedback` est proposée et attend validation. Dès qu'elle
   * existera, cet état sera alimenté par elle au montage plutôt que remis à
   * zéro à chaque visite.
   */
  const { state, geoCity, geoLoading, vestiairePool, weather, actions } = useCapsela();

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
    // Même règle que l'écran Tenue : une source unique s'énonce, deux
    // sources se comptent. Les deux écrans disent la même chose du même
    // calcul, il serait absurde qu'ils ne la disent pas pareil.
    if (!capsule) return `Une sélection de ${pieces(dressing)} de ton dressing`;
    if (!dressing) return `Une sélection de ${pieces(capsule)} de ta capsule`;
    return `${pieces(dressing)} de ton dressing + ${pieces(capsule)} de ta capsule`;
  })();

  /*
   * `tenueEnregistree` est retiré le 22/09 au soir : « J'adore » n'appelle
   * plus toggleSaveOutfitLook. Enregistrer une tenue et l'aimer sont deux
   * gestes différents — le premier la range dans Mes looks, le second donne
   * un avis. Les confondre aurait rempli Mes looks de tenues qu'on a
   * seulement trouvées jolies. L'avis ira dans `outfit_feedback` une fois la
   * migration passée.
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
        <div className="text-[11px] tracking-[.16em] uppercase text-muted">Aujourd&apos;hui</div>
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
            className="font-serif text-[21px] min-[380px]:text-[26px] text-cream leading-[1.14]"
            style={avecComposition ? { maxWidth: "42%" } : undefined}
          >
            {hasOutfit
              ? "Ta tenue est prête"
              : aucuneTenuePossible
                ? "On prépare ta première tenue"
                : "Découvre ta tenue du jour"}
          </div>
          <div
            className="text-[12px] mt-[8px] leading-[1.35]"
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
            {hasOutfit
              ? outfitQuote
              : aucuneTenuePossible
                ? dressingVide
                  ? "Ajoute quelques pièces à ton dressing, et on compose ta tenue du jour."
                  : "Ton dressing et ta capsule ne couvrent pas encore cette occasion. Quelques pièces de plus suffiront."
                : "Une sélection pensée pour toi, ta journée et la météo."}
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
          {/* L'OCCASION SUR SA PROPRE LIGNE, à gauche (demandé le 22/09 au
              soir). Elle partageait sa ligne avec le CTA, qui se retrouvait
              donc poussé à droite sur une demi-largeur : le bouton principal
              de la page était le plus étroit de ses éléments. Elle redevient
              ce qu'elle est — une étiquette de contexte — et cesse de
              disputer la place à l'action. */}
          {hasOutfit && occasionLabel && (
            <div className="pt-[14px]">
              {/* Le glyphe de l'occasion, comme sur l'écran Tenue. Ce n'est
                  pas un sélecteur mais une étiquette de contexte : il est
                  posé à 13 px, plus petit qu'ailleurs, pour rester en
                  dessous du poids du libellé. */}
              <span
                className="inline-flex items-center gap-[6px] uppercase whitespace-nowrap"
                style={{
                  fontSize: 9.5,
                  letterSpacing: ".08em",
                  background: "rgba(243,238,229,.22)",
                  color: "#FBF3EA",
                  borderRadius: 100,
                  padding: "8px 14px",
                }}
              >
                <GlypheOccasion occasion={occasionKey} taille={13} />
                {occasionLabel}
              </span>
            </div>
          )}

          {/* LE CTA PREND TOUTE LA LARGEUR, 50 px. C'est la seule action
              pleine de la card ; tout le reste y est translucide ou discret,
              et la hiérarchie passe par là plutôt que par une couleur. */}
          {/* PAS DE CTA MORT (§9.3). Quand le moteur n'a rien produit,
              « Voir ma tenue » mènerait à un écran vide : le bouton conduit
              alors au dressing, qui est l'endroit où la situation se
              débloque. Vers l'ajout direct si le dressing est vide, vers sa
              liste sinon — un même libellé pour deux situations en rendrait
              une des deux fausse. */}
          <button
            onClick={aucuneTenuePossible ? (dressingVide ? actions.openAdd : actions.goWardrobe) : actions.goTenues}
            // 13 px / .1em / capitales : la convention des 20 CTA principaux
            // de l'app (23/09/2026). Ce bouton en était l'exception.
            className="mt-[12px] w-full flex items-center justify-center bg-cream text-ink rounded-full text-[13px] tracking-[.1em] uppercase cursor-pointer"
            style={{ minHeight: 50 }}
          >
            {hasOutfit
              ? "Voir ma tenue"
              : aucuneTenuePossible
                ? dressingVide
                  ? "Ajouter mes pièces"
                  : "Voir mon dressing"
                : "Découvrir ma tenue"}
          </button>

          {/* FEEDBACK — deux boutons DISCRETS, jamais concurrents du CTA :
              translucides, sous lui, mais à 44 px comme toute cible
              tactile (§7). Ils étaient à 38 : la discrétion doit venir de la
              couleur et du poids, jamais d'une cible trop petite pour le
              pouce.

              Ils n'écrivent rien pour l'instant. Le brief interdit de créer
              une table sans validation ; la table `outfit_feedback` est
              proposée et attend son exécution. Tant qu'elle n'existe pas,
              brancher une écriture ferait échouer l'appel en production —
              donc la réponse est locale, et la persistance viendra quand la
              migration sera passée. C'est dit ici pour que personne ne prenne
              ce silence pour un oubli.

              « Pas pour moi » ne régénère PAS la tenue : le brief l'exige, et
              c'est l'inverse de ce que j'avais branché quelques heures plus
              tôt. Régénérer ferait de ce bouton une action, pas un avis. */}
          {hasOutfit && (
            <div className="mt-[13px]" aria-live="polite">
              {avisDuJour ? (
                // Cliquable : repasser le même verdict le retire. Sans ce
                // geste, un tap involontaire serait définitif pour la journée.
                <button
                  onClick={() => actions.setOutfitFeedback(avisDuJour)}
                  aria-label="Revenir sur mon avis"
                  className="font-serif italic text-[13px] text-left cursor-pointer"
                  style={{ color: "#F0DDCF", minHeight: 44 }}
                >
                  {avisDuJour === "adore"
                    ? "Noté — on garde cette direction."
                    : "Pas de souci, on t'en propose une autre demain."}
                </button>
              ) : (
                <div className="flex items-center gap-[8px] flex-wrap">
                  <button
                    onClick={() => actions.setOutfitFeedback("adore")}
                    className="inline-flex items-center gap-[6px] rounded-full text-[11px] cursor-pointer px-[13px]"
                    style={{ minHeight: 44, background: "rgba(243,238,229,.12)", border: "1px solid rgba(243,238,229,.26)", color: "#F0DDCF" }}
                  >
                    <span aria-hidden="true">♡</span> J&apos;adore cette tenue
                  </button>
                  <button
                    onClick={() => actions.setOutfitFeedback("pas_aujourdhui")}
                    className="inline-flex items-center gap-[6px] rounded-full text-[11px] cursor-pointer px-[13px]"
                    style={{ minHeight: 44, background: "rgba(243,238,229,.12)", border: "1px solid rgba(243,238,229,.26)", color: "#F0DDCF" }}
                  >
                    <span aria-hidden="true">✕</span> Pas pour moi
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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
        <div className="font-serif text-[21px] leading-[1.18] text-ink">Ton dressing, autrement</div>
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
          titre="Ton dressing"
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
          titre="Ton style évolue"
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
              <div className="font-serif text-[18px] text-ink leading-[1.2]" style={{ textWrap: "balance" }}>
                Et si on préparait la suite ?
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
              <span className="inline-flex items-center gap-[4px] rounded-full bg-card px-[9px] py-[4px] text-[9px] tracking-[.1em] uppercase text-terracotta whitespace-nowrap">
                <span aria-hidden="true">✦</span> Premium
              </span>
            </button>
          </div>
          {/* Deux actions VISUELLEMENT DISTINCTES (demandé) : chacune porte son
              propre glyphe au trait — un calendrier, une valise — là où les
              deux précédentes partageaient un carré plein indistinct. */}
          <div className="grid grid-cols-2 gap-[10px] mt-[13px]" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <ActionSuite onClick={actions.goPlanifier} label="Planifier une tenue" glyphe={GLYPHE_CALENDRIER} />
            {/* « Préparer une valise » MÈNE À PREMIUM (24/09/2026, arbitré).
                Elle menait jusqu'ici à un écran d'attente dont le seul rôle
                déclaré était « que l'entrée ne mène pas dans le vide » — un
                écran qui ne lit rien, n'appelle rien, et renvoyait vers la
                capsule. Premium dit la même chose en la vendant, et l'écran
                d'attente est supprimé plutôt que laissé inaccessible.

                Planifier n'est PAS passée derrière ce mur : elle fonctionne,
                et personne ne peut encore s'abonner — la mettre derrière un
                paywall qui n'encaisse pas reviendrait à la retirer à tout le
                monde. */}
            <ActionSuite onClick={() => actions.goPremium("valise")} label="Préparer une valise" glyphe={GLYPHE_VALISE} />
          </div>
        </div>
      </div>
    </div>
  );
}
