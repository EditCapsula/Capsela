"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { MosaiquePieces } from "@/components/CarteLook";
import PhotoPiece from "@/components/PhotoPiece";
import { useIdeesDressing } from "@/components/useIdeesDressing";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/auth";
import { CATS, OCC_LABELS, occasionShortLabel } from "@/lib/data";
import {
  assezDuDressing,
  groupesDuVestiaire,
  syntheseDressing,
} from "@/lib/dressingEcran";
import {
  articlePossessif,
  candidatsARedecouvrir,
  designationPiece,
  ideeLaPlusComplete,
  ligneDressing,
  looksDistincts,
  phrasePiste,
  piecesRecentes,
  pisteAssociation,
  saisonDeLaDate,
} from "@/lib/dressingSections";
import { generateOutfitWithFallback, getOutfitsForItem, type ItemOutfitVariation } from "@/lib/logic";
import { clePieces } from "@/lib/outfitFeedback";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { composeWardrobePool, wearCounts } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item, OccasionKey } from "@/lib/types";
import Button from "@/components/Button";

/**
 * DRESSING — refonte éditoriale du 25/09/2026 (brief « Refonte UX/UI de la
 * page Dressing »). La maquette du 23/09 lisait encore comme un tableau de
 * bord : cartes, bordures, badges, quatre CTA. La page est recomposée en cinq
 * territoires : Mon dressing, À redécouvrir, Mon vestiaire, Mes looks,
 * ✦ À découvrir.
 *
 * LES DÉRIVATIONS MÉTIER SONT REPRISES À L'IDENTIQUE, y compris leurs correctifs :
 *
 *   - les pièces affichées restent `state.items` SEUL (dressing réel) ; les
 *     suggestions vivent sur l'écran Capsule ;
 *   - les looks restent résolus sur `[...items, ...vestiairePool]` et jamais
 *     sur `wardrobePool` — correctif du 20/08/2026 : un look enregistré
 *     pendant l'exploration d'un autre style référence des suggestions
 *     absentes de wardrobePool une fois revenue au style normal ;
 *   - « jamais portées » reste `neverWornItems` (worn == null), son second
 *     niveau de message reste conditionné par `inactivityInfo` ;
 *   - « porté » reste dérivé de l'historique via `lookWornCount` ;
 *   - la limite gratuite reste `premium.ts` ; `syntheseDressing` ne fait que
 *     la dire (« / 20 » seulement en gratuit vérifié, un droit inconnu
 *     n'applique aucune limite).
 *
 * CE QUI CHANGE, ET POURQUOI :
 *
 *   - Les catégories deviennent des groupes par profil, illustrés par les
 *     visuels éditoriaux livrés le 25/09 (dressingEcran.ts) — plus la photo de
 *     la première pièce. Seuls les groupes où il y a des pièces s'affichent.
 *     Toucher un groupe ouvre « Mes pièces » filtré sur lui.
 *   - « Jamais portées » passe d'une grande carte beige à une ligne légère.
 *   - Les looks passent en grille 2 colonnes (4 au plus) ; « Voir tout → »
 *     mène au nouvel écran « Mes looks ». Plus de badge par pièce : un seul
 *     indicateur « ✦ Look suggéré par Capsela » par look.
 *   - Le module « Capsela te suggère » disparaît ; son filtre (looks aux
 *     pièces suggérées) vit sur « Mes looks ». « ✦ À découvrir » le remplace,
 *     piloté par le moteur et la capsule (choisirADecouvrir).
 *   - Le gros bouton « Voir ma tenue du jour » est retiré : l'onglet Tenue est
 *     dans la barre du bas. Il ne reste qu'un lien discret, dans le seul cas
 *     où il sert (dressing proche de la limite, sans association nouvelle).
 *
 * POLISH V3 (26/09/2026) — réduire, pas ajouter ; mesuré avant/après sur les
 * mêmes données (banc de rendu), aucune donnée ni règle métier touchée :
 *   - Mes looks : carrousel horizontal (~1,5 carte visible) au lieu de la
 *     grille ; « + Créer » dans l'en-tête ; « Voir tout → » au bout du
 *     carrousel, seul chemin vers l'écran « Mes looks » ; « ✦ Suggéré » sur
 *     la ligne de la date (CarteLook compacte).
 *   - ✦ À découvrir : un encart — miniatures et « Découvrir → » sur une
 *     ligne, sans le libellé d'occasion sous chaque tenue.
 *   - À redécouvrir : deux miniatures un peu plus grandes, texte en serif.
 *   - Mon vestiaire : cartes un peu plus larges et moins hautes, légendes
 *     sur une ligne quand elles tiennent.
 */

/** Les deux occasions des idées d'inspiration du dressing vide. */
const OCCASIONS_INSPIRATION: OccasionKey[] = ["quotidien", "travail_formel"];
/** Pièces dont les idées sont calculées pour l'écran : au-delà, le total de looks est annoncé « N+ ». */
const NB_PIECES_AVEC_IDEES = 16;

/** L'étoile de « L'inspiration du moment » : le dessin de l'onglet `sparkle` (TabBar), en SVG plutôt que le glyphe ✦ (09/10/2026). */
const ETOILE = (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ display: "block" }}>
    <path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3z" />
  </svg>
);

const PLUS = (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** Surtitre de section, avec son action facultative à droite. */
function TitreSection({ children, action, className = "mt-10" }: { children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-[10px] ${className}`}>
      <div className="t-surtitre text-muted">{children}</div>
      {action}
    </div>
  );
}

/** Lien d'action discret : terracotta, sans fond ni contour, cible de 44 px. Demi-gras et terracotta-deep (maquette V9 finale, 09/10/2026). */
function Lien({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-[6px] text-[12px] font-semibold text-terracotta-deep cursor-pointer flex-shrink-0 py-[13px] -my-[13px] whitespace-nowrap"
    >
      {children}
    </button>
  );
}

/** Tenues composées par le moteur, en vignettes cliquables vers l'écran Tenue. */
function Associations({
  tenues,
  onOuvrir,
}: {
  tenues: { occasion: OccasionKey; pieces: Item[] }[];
  onOuvrir: (t: { occasion: OccasionKey; pieces: Item[] }) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-[10px] mt-4">
      {tenues.map((t) => (
        <button
          key={t.occasion}
          onClick={() => onOuvrir(t)}
          aria-label={`Voir la tenue ${OCC_LABELS[t.occasion]} proposée par Capsela`}
          className="text-left cursor-pointer active:opacity-80 min-w-0"
        >
          <MosaiquePieces pieces={t.pieces} />
          <div className="text-[11px] text-muted leading-[1.35] mt-[7px] px-[2px] line-clamp-2">
            {OCC_LABELS[t.occasion]}
          </div>
        </button>
      ))}
    </div>
  );
}

/** Titre de section en Fraunces, sous son surtitre. */
function TitreSerif({ children, taille = 18 }: { children: React.ReactNode; taille?: number }) {
  return (
    <div className="font-serif text-ink mt-[6px]" style={{ fontSize: taille, lineHeight: 1.25 }}>
      {children}
    </div>
  );
}

export default function WardrobeScreen() {
  const { state, actions, vestiairePool, defaultCapsule, weather, dressingLoaded, etatPremium } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const [maintenant] = useState(() => Date.now());

  // Pool de résolution stable des looks — cf. l'en-tête, correctif 20/08/2026.
  const resolvePool = useMemo(() => [...items, ...vestiairePool], [items, vestiairePool]);
  const groupes = useMemo(() => groupesDuVestiaire(items, profile.gender), [items, profile.gender]);
  const synthese = syntheseDressing(etatPremium, items.length, groupes.length);

  /**
   * Une tenue du moteur pour une occasion. Dressing rempli (01/10/2026,
   * demandé : « si une tenue n'est pas complètement complète avec les éléments
   * du dressing, on ajoute des suggestions de la capsule ») : le pool est celui
   * de la tenue du jour — `composeWardrobePool`, les pièces réelles d'abord, la
   * capsule seulement là où une catégorie n'a aucune pièce réelle utilisable
   * pour l'occasion et la saison. Elle doit garder au moins
   * MIN_PIECES_DRESSING_ASSOCIATION pièces du dressing, sinon elle n'est pas
   * « avec tes pièces ». Dressing vide : la capsule, comme avant. Le moteur
   * n'est pas modifié, seulement appelé avec les mêmes arguments.
   */
  const composerTenue = (occasion: OccasionKey) => {
    const vide = items.length === 0;
    const pool = vide
      ? defaultCapsule
      : composeWardrobePool(items, defaultCapsule, CATS.map(([k]) => k), { completerPourOccasion: occasion, saison: weather, exclureHorsOccasion: true });
    if (pool.length === 0) return null;
    const r = generateOutfitWithFallback(pool, weather, occasion, state.workMode, state.dateContext, paletteHexes(profile), profile.gender, undefined, undefined, colorimetrieMoteur(profile.colorimetrie));
    const pieces = r.ids.map((id) => pool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
    if (pieces.length === 0) return null;
    if (!vide && !assezDuDressing(pieces.map((p) => p.id), items)) return null;
    return { occasion, ids: pieces.map((p) => p.id), pieces };
  };

  /**
   * Tenues composées par le moteur, TIRÉES UNE SEULE FOIS par mémo :
   * `generateOutfitWithFallback` tire au hasard à chaque appel, et des
   * vignettes qui changeraient au moindre re-rendu se liraient comme un bug.
   *
   * Dressing rempli : voir composerTenue — les pièces du dressing d'abord,
   * complétées par la capsule là où il manque une catégorie (01/10/2026) ;
   * « avec tes pièces » reste vrai parce qu'au moins
   * MIN_PIECES_DRESSING_ASSOCIATION pièces sont les siennes, et la carte dit
   * combien de suggestions s'y ajoutent. Seules les
   * associations NOUVELLES sont gardées (ni un look enregistré, ni une tenue
   * déjà portée). Dressing vide : la capsule par défaut, comme avant (idées
   * d'inspiration). Le moteur n'est pas modifié, seulement appelé, avec les
   * mêmes arguments que l'écran Tenue.
   */
  const tenuesMoteur = useMemo(() => {
    // Dressing rempli : plus d'associations ici (écran V6, 08/10/2026) — « À redécouvrir » et la recommandation ont leur propre calcul.
    if (items.length > 0 || defaultCapsule.length === 0) return [];
    return OCCASIONS_INSPIRATION.map((occasion) => composerTenue(occasion)).filter((t): t is NonNullable<typeof t> => t !== null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, defaultCapsule, weather, state.workMode, state.dateContext, profile]);

  const parPiece = useMemo(() => wearCounts(state.history), [state.history]);

  /**
   * « À REDÉCOUVRIR » : des pièces de la saison courante, peu ou jamais portées, ET dont le moteur sait faire un look avec d'autres
   * pièces du dressing (la piste « Avec ton… » est une tenue réellement composée). Aucune pièce éligible : la section n'existe pas.
   */
  const aRedecouvrir = useMemo(() => {
    if (items.length === 0) return [];
    const hexes = paletteHexes(profile);
    const colo = colorimetrieMoteur(profile.colorimetrie);
    const sortie: { piece: Item; etiquette: string; piste: string }[] = [];
    for (const c of candidatsARedecouvrir(items, weather, parPiece, 8)) {
      if (sortie.length >= 6) break;
      const tenues = getOutfitsForItem(c.piece.id, items, weather, hexes, { maxPerOccasion: 1, maxTotal: 4, attemptsPerOccasion: 12 }, profile.gender, null, colo);
      const piste = pisteAssociation(c.piece, tenues.map((t) => t.ids), items);
      if (piste) sortie.push({ piece: c.piece, etiquette: c.etiquette, piste });
    }
    return sortie;
  }, [items, weather, parPiece, profile]);

  /**
   * LES IDÉES DE LOOKS DU DRESSING (V9, 08/10/2026) : les seize pièces les plus récentes (+ celle de « À redécouvrir »), calculées après
   * le premier rendu avec le moteur de « Comment porter … ? ». Tout ce que l'écran annonce — « N looks possibles », l'inspiration, les
   * looks du carrousel — en est dérivé ; tant que le calcul n'est pas là, ces blocs n'existent pas.
   */
  const recentes = useMemo(() => piecesRecentes(items, 8, maintenant), [items, maintenant]);
  const pourIdees = useMemo(() => {
    const ordre = [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, NB_PIECES_AVEC_IDEES);
    const redecouvrir = aRedecouvrir[0]?.piece;
    return redecouvrir && !ordre.some((p) => p.id === redecouvrir.id) ? [...ordre, redecouvrir] : ordre;
  }, [items, aRedecouvrir]);
  const idees = useIdeesDressing(pourIdees);

  const ouvrirTenue = (t: { occasion: OccasionKey; pieces: Item[] }) => actions.viewItemOutfit(t.pieces.map((p) => p.id), t.occasion);

  // ── MON DRESSING ─────────────────────────────────────────────────────
  const enTete = (
    <>
      <AppHeader />
      <div className="t-surtitre text-muted mt-[14px]">Mon dressing</div>
      <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
        Ton dressing, <span className="italic text-terracotta">à ton image</span>
      </div>
      {/* Une seule ligne : le nombre de pièces et de catégories, calculés. Plus de « places restantes » (08/10/2026). */}
      <div className="text-[13px] text-muted mt-[8px]">
        {!dressingLoaded ? " " : items.length > 0 ? ligneDressing(items.length, groupes.length) : synthese.texte}
      </div>
    </>
  );

  // ── CHARGEMENT ───────────────────────────────────────────────────────
  // Sans cet état, une utilisatrice qui possède des pièces voit l'empty
  // state et son « Ajoute ta première pièce » le temps du fetch.
  if (!dressingLoaded) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        {enTete}
        <div className="flex justify-center mt-16" aria-live="polite">
          <LoadingSpinner size={56} />
          <span className="sr-only">Chargement de ton dressing…</span>
        </div>
      </div>
    );
  }

  // ── DRESSING VIDE ────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
        {enTete}

        {/* UNE SEULE action dominante. Visuel d'accueil livré le 23/09 : ratio
            tenu par aspect-ratio, dimensions déclarées pour que rien ne saute
            à l'arrivée de l'image. */}
        <div className="mt-6 rounded-hero overflow-hidden" style={{ aspectRatio: "1.548", background: "var(--color-warm-bg)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/editorial/capsela_dressing_empty.webp"
            alt="Un chapeau de paille, une maille écrue, un collier fin et un sac posés à plat sur du lin"
            width={864}
            height={558}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        </div>
        <div className="t-titre-section text-ink mt-5">
          Ton dressing <span className="italic text-terracotta">commence ici</span>
        </div>
        <div className="text-[13px] leading-[1.55] mt-2" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
          Ajoute quelques pièces que tu portes vraiment. Une photo suffit pour commencer. Pas besoin d&apos;ajouter toute ta
          garde-robe : commence avec 5 à 10 pièces que tu portes souvent.
        </div>
        <Button variante="principal" className="mt-5"
          onClick={actions.openAdd}
        >
          {PLUS}
          Ajouter ma première pièce
        </Button>

        {/* ✦ À DÉCOUVRIR, version dressing vide : la capsule et de vraies
            tenues du moteur tirées de la capsule par défaut. Le clic passe
            par viewItemOutfit : l'écran Tenue affiche CETTE tenue, marquée
            comme choisie à la main (brief du 25/09, point 6). */}
        <TitreSection>✦ À découvrir</TitreSection>
        <div className="t-titre-section text-ink mt-3">
          Déjà envie <span className="italic text-terracotta">d&apos;inspiration ?</span>
        </div>
        <div className="text-[13px] leading-[1.55] mt-[6px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
          Découvre ta capsule personnalisée et quelques idées de looks, même sans pièces dans ton dressing.
        </div>
        {tenuesMoteur.length > 0 && <Associations tenues={tenuesMoteur} onOuvrir={ouvrirTenue} />}
        <div className="mt-5">
          <Lien onClick={actions.goCapsule}>Découvrir ma capsule →</Lien>
        </div>
      </div>
    );
  }

  // ── DRESSING REMPLI (V9, 08/10/2026) ─────────────────────────────────
  // Ordre de la maquette : en-tête avec « + Ajouter », récemment ajoutées (miniatures), l'inspiration du moment, tes looks, par catégorie,
  // à redécouvrir. Chaque bloc se tait quand il n'a pas de donnée vraie. Le bouton d'ajout est dans l'en-tête, plus de bouton flottant ;
  // dressing complet (gratuit), il mène à Premium au lieu d'ouvrir un formulaire qui refuserait d'enregistrer.
  const ajouter = () => (synthese.complet ? actions.goPremium() : actions.openAdd());
  const dejaCalcule = idees !== null;
  const tousLesLooks = idees ? looksDistincts(pourIdees.map((p) => (idees.get(p.id) ?? []).map((v) => v.ids))) : 0;
  const plusDe = items.length > NB_PIECES_AVEC_IDEES ? "+" : "";

  // L'inspiration : les deux pièces les plus récentes (30 jours) et un look que le moteur compose avec la première qui en a un.
  const nouvelles = recentes.slice(0, 2);
  const avecIdee = nouvelles.find((p) => (idees?.get(p.id) ?? []).length > 0);
  const lookInspiration = avecIdee ? idees?.get(avecIdee.id)?.[0] : undefined;
  const piecesAccordees = idees
    ? new Set(nouvelles.flatMap((p) => (idees.get(p.id) ?? []).flatMap((v) => v.ids)).filter((id) => items.some((i) => i.id === id) && !nouvelles.some((n) => n.id === id))).size
    : 0;
  const designations = nouvelles.map((p) => designationPiece(p));
  const phraseInspiration =
    piecesAccordees > 0 && designations.length > 0
      ? `${designations.length === 1 ? designations[0].charAt(0).toUpperCase() + designations[0].slice(1) : `${designations[0].charAt(0).toUpperCase()}${designations[0].slice(1)} et ${designations[1]}`} ${
          designations.length === 1 && !designations[0].startsWith("tes ") ? "s'accorde" : "s'accordent"
        } avec ${piecesAccordees} ${piecesAccordees === 1 ? "pièce" : "pièces"} que tu as déjà.`
      : "";

  // Tes looks : le premier look de chacune des pièces les plus récentes, sans doublon.
  const looksCarrousel = (() => {
    if (!idees) return [] as { piece: Item; idee: ItemOutfitVariation }[];
    const vus = new Set<string>();
    const sortie: { piece: Item; idee: ItemOutfitVariation }[] = [];
    for (const piece of pourIdees) {
      const idee = ideeLaPlusComplete(idees.get(piece.id));
      if (!idee) continue;
      const cle = clePieces(idee.ids).join(",");
      if (vus.has(cle)) continue;
      vus.add(cle);
      sortie.push({ piece, idee });
      if (sortie.length >= 6) break;
    }
    return sortie;
  })();

  const aRedecouvrirUne = aRedecouvrir[0];
  const nbLooksRedecouvrir = aRedecouvrirUne ? (idees?.get(aRedecouvrirUne.piece.id)?.length ?? 0) : 0;
  // Accord sur le nom, comme l'article (« Tes baskets attendent », « Ta basket attend ») — plus sur la catégorie (09/10/2026).
  const pluriel = aRedecouvrirUne ? articlePossessif(aRedecouvrirUne.piece) === "tes" : false;

  return (
    <div
      className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]"
      style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 32px)" }}
    >
      <AppHeader />
      <div className="t-surtitre text-muted mt-[14px]">Mon dressing</div>
      <div className="flex items-end justify-between gap-3 mt-[6px]">
        <div className="t-titre-ecran text-ink" style={{ textWrap: "balance" }}>
          Ton dressing, <span className="italic text-terracotta">à ton image</span>
        </div>
        {/* Pilule à contour, 44 px (09/10/2026, demandé : le bouton plein était « trop imposant », le simple lien « trop peu voyant »).
            Terracotta-deep et non terracotta : 4,5:1 sur le fond carte, comme le bouton principal. */}
        <Button
          variante="contour"
          pleine={false}
          onClick={ajouter}
          className="flex-shrink-0 !min-h-[44px] !gap-[7px] pl-[14px] pr-[18px] bg-card hover:bg-warm-bg !border-terracotta-deep !text-terracotta-deep font-semibold normal-case tracking-normal"
        >
          {PLUS}
          Ajouter
        </Button>
      </div>
      <div className="text-[13px] text-muted mt-[8px]">
        {items.length} {items.length <= 1 ? "pièce" : "pièces"}
        {dejaCalcule && tousLesLooks > 0 ? ` · ${tousLesLooks}${plusDe} ${tousLesLooks === 1 ? "look possible" : "looks possibles"}` : ""}
      </div>

      {/* ── RÉCEMMENT AJOUTÉES ─ des miniatures et un chevron vers « Tes dernières pièces » (30 jours). */}
      {recentes.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          {/* Deux lignes imposées : sans le saut, « Récemment » se coupait par un tiret à 320 px (vérification de la maquette V9). */}
          <div className="t-surtitre text-muted flex-shrink-0" style={{ lineHeight: 1.4 }}>
            Récemment
            <br />
            ajoutées
          </div>
          <div className="flex gap-[6px] flex-1 min-w-0 overflow-hidden">
            {recentes.slice(0, 4).map((p) => (
              <button key={p.id} onClick={() => actions.openItem(p.id)} aria-label={p.name} className="flex-1 min-w-0 cursor-pointer" style={{ maxWidth: 56 }}>
                <PhotoPiece piece={p} ratio={0.84} rayon={12} />
              </button>
            ))}
          </div>
          <button
            onClick={actions.goDernieresPieces}
            aria-label="Voir mes dernières pièces"
            className="flex-shrink-0 flex items-center justify-center rounded-full border border-border bg-card text-terracotta-deep cursor-pointer"
            style={{ width: 44, height: 44 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9.5 6l6 6-6 6" /></svg>
          </button>
        </div>
      )}

      {/* ── L'INSPIRATION DU MOMENT ─ un look que le moteur compose avec les pièces récentes. */}
      {lookInspiration && avecIdee && phraseInspiration && (
        // Hero légèrement réduit (V9 de finition) : photo 1,85 au lieu de 1,6, titre 20 px, marges resserrées — le premier écran garde
        // l'en-tête, « Récemment ajoutées » et le hero entiers.
        <section className="mt-4 overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 24 }} aria-label="L'inspiration du moment">
          <div className="relative" style={{ aspectRatio: "1.85", background: "var(--color-photo-bg)" }}>
            <FlatLayCapsela
              items={lookInspiration.ids.map((id) => resolvePool.find((i) => i.id === id)).filter((i): i is Item => !!i)}
              context="look-detail"
              layoutSeed={clePieces(lookInspiration.ids).join(",")}
            />
          </div>
          <div className="px-4 pt-3 pb-1">
            <div className="t-surtitre flex items-center gap-[6px] text-terracotta-hover">
              <span className="text-terracotta">{ETOILE}</span>
              L&apos;inspiration du moment
            </div>
            <div className="font-serif text-ink mt-[5px]" style={{ fontSize: 20, lineHeight: 1.15 }}>
              Tes nouvelles pièces, <span className="italic text-terracotta">déjà en looks</span>
            </div>
            <div className="text-[12.5px] leading-[1.45] mt-[5px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>{phraseInspiration}</div>
            <button
              onClick={() => actions.viewItemOutfit(lookInspiration.ids, lookInspiration.occasion)}
              className="flex items-center gap-[6px] min-h-[44px] text-[12.5px] font-semibold text-terracotta-deep cursor-pointer"
            >
              Voir ce look →
            </button>
          </div>
        </section>
      )}

      {/* ── TES LOOKS ─ un look par pièce récente, avec la pièce qui l'a fait naître. */}
      {looksCarrousel.length > 0 && (
        <section className="mt-6" aria-label="Tes looks">
          <div className="flex items-baseline justify-between gap-3">
            <TitreSerif taille={18}>Tes looks</TitreSerif>
            <Lien onClick={actions.goLooks} label="Voir mes looks">Voir mes looks →</Lien>
          </div>
          <div className="scrollarea flex gap-[12px] overflow-x-auto mt-4 -mx-6 px-6" style={{ scrollPaddingInline: 24, scrollSnapType: "x proximity" }}>
            {looksCarrousel.map(({ piece, idee }) => {
              const pieces = idee.ids.map((id) => resolvePool.find((i) => i.id === id)).filter((i): i is Item => !!i);
              return (
                <button
                  key={clePieces(idee.ids).join(",")}
                  onClick={() => actions.viewItemOutfit(idee.ids, idee.occasion)}
                  className="flex-none text-left cursor-pointer active:opacity-80"
                  style={{ width: "min(78%, 300px)", scrollSnapAlign: "start" }}
                >
                  {/* La planche « look-detail » est une zone portrait (100 × 126) : dans une carte à l'italienne (1,25) elle ne remplissait que
                      les deux tiers de la largeur et les pièces restaient petites. Le ratio de la carte la suit (0,9), sa largeur et son aperçu de
                      la carte suivante ne changent pas. Fond grège plus soutenu et ombre marquée : les pièces blanches et beiges se détachent. */}
                  <div
                    className="relative overflow-hidden"
                    style={{
                      aspectRatio: "0.9",
                      borderRadius: 20,
                      background: "radial-gradient(120% 90% at 50% 28%, var(--color-flatlay-bg-clair) 0%, var(--color-flatlay-bg) 100%)",
                      boxShadow: "inset 0 0 0 1px rgba(29,26,22,.05)",
                    }}
                  >
                    <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(idee.ids).join(",")} ombre="marquee" />
                  </div>
                  <div className="font-serif text-ink mt-[10px] px-[2px]" style={{ fontSize: 16 }}>{occasionShortLabel(idee.occasion)}</div>
                  <div className="text-[12px] px-[2px] line-clamp-1" style={{ color: "var(--color-muted-3)" }}>
                    {phrasePiste(piece)} · {idee.ids.length} pièces
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── PAR CATÉGORIE ─ une carte par catégorie réellement présente (visuel éditorial, libellé et nombre en pastille). */}
      <section className="mt-7" aria-label="Par catégorie">
        <div className="flex items-baseline justify-between gap-3">
          <TitreSerif taille={18}>Par catégorie</TitreSerif>
          <Lien onClick={() => actions.goWardrobePieces()} label="Voir toutes mes pièces">Toutes mes pièces →</Lien>
        </div>
        <div className="grid grid-cols-2 gap-[10px] mt-4">
          {groupes.map((g) => (
            <button
              key={g.id}
              onClick={() => actions.goWardrobePieces({ libelle: g.libelle, categories: g.categories })}
              aria-label={`${g.libelle} : ${g.nbPieces} ${g.nbPieces <= 1 ? "pièce" : "pièces"}`}
              className="relative block w-full overflow-hidden cursor-pointer active:opacity-80 text-left"
              style={{ aspectRatio: "0.92", borderRadius: 20, background: "var(--color-warm-bg)" }}
            >
              {g.propres.length > 0 ? (
                <span
                  className="absolute inset-0 block"
                  style={{ background: "radial-gradient(120% 90% at 50% 28%, var(--color-flatlay-bg-clair) 0%, var(--color-flatlay-bg) 100%)" }}
                >
                  {g.propres.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.id}
                      src={p.url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      style={{
                        position: "absolute",
                        left: `${p.l}%`,
                        top: `${p.t}%`,
                        width: `${p.w}%`,
                        height: `${p.h}%`,
                        objectFit: "contain",
                        filter: "drop-shadow(0 3px 5px rgba(29,26,22,.22))",
                      }}
                    />
                  ))}
                </span>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.visuel} alt="" width={480} height={640} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              )}
              <span
                className="absolute left-[8px] right-[8px] bottom-[8px] flex flex-col gap-[1px] px-[14px] py-[8px]"
                style={{ background: "var(--color-card)", borderRadius: 14 }}
              >
                <span className="font-serif text-ink line-clamp-2" style={{ fontSize: 14, lineHeight: 1.2 }}>{g.libelle.replace(/ & /g, " &\u00a0")}</span>
                <span className="text-[11px] text-muted">{g.nbPieces} {g.nbPieces <= 1 ? "pièce" : "pièces"}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* ── À REDÉCOUVRIR ─ une seule pièce de saison, peu portée, avec un look possible. */}
      {aRedecouvrirUne && (
        <button
          onClick={() => actions.openItemOutfits(aRedecouvrirUne.piece.id, false, idees?.get(aRedecouvrirUne.piece.id))}
          className="mt-7 w-full flex items-center gap-[14px] text-left rounded-carte py-3 pl-3 pr-[14px] cursor-pointer active:opacity-80"
          style={{ background: "var(--color-warm-bg)" }}
          aria-label="À redécouvrir"
        >
          <span className="flex-none" style={{ width: 76 }}>
            <PhotoPiece piece={aRedecouvrirUne.piece} ratio={0.82} rayon={14} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block t-surtitre text-terracotta-hover">À redécouvrir · {weather.saisons?.length ? weather.saisons.join(" / ") : saisonDeLaDate(maintenant)}</span>
            <span className="block font-serif text-ink mt-[6px]" style={{ fontSize: 17, lineHeight: 1.2 }}>
              {`${designationPiece(aRedecouvrirUne.piece).replace(/^t(on|a|es) /, (m) => `T${m.slice(1)}`)} `}
              <span className="italic text-terracotta">{pluriel ? "attendent leur moment" : "attend son moment"}</span>
            </span>
            {nbLooksRedecouvrir > 0 && (
              <span className="block text-[12px] font-semibold mt-[6px]" style={{ color: "var(--color-terracotta-deep)" }}>
                {nbLooksRedecouvrir} {nbLooksRedecouvrir === 1 ? "look cette saison" : "looks cette saison"} →
              </span>
            )}
          </span>
        </button>
      )}
    </div>
  );
}

/**
 * LE BOUTON FLOTTANT « AJOUTER UNE PIÈCE » (maquette du 04/10/2026) : toujours à portée du pouce, au-dessus de la barre
 * du bas. Étiqueté d'abord ; après trois usages, il se réduit au « + » — la personne sait ce qu'il fait. Le compte est
 * gardé sur l'appareil (aucune donnée de compte) ; sans stockage, il reste étiqueté.
 */
const CLE_USAGES_AJOUT = "capsela.boutonAjout.usages";
const USAGES_AVANT_REDUCTION = 3;

export function BoutonAjoutFlottant({ onClick }: { onClick: () => void }) {
  const [reduit, setReduit] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduit(Number(localStorage.getItem(CLE_USAGES_AJOUT) ?? 0) >= USAGES_AVANT_REDUCTION);
    } catch {
      // stockage indisponible : le bouton reste étiqueté
    }
  }, []);
  return (
    <button
      onClick={() => {
        try {
          localStorage.setItem(CLE_USAGES_AJOUT, String(Number(localStorage.getItem(CLE_USAGES_AJOUT) ?? 0) + 1));
        } catch {
          // idem
        }
        onClick();
      }}
      aria-label="Ajouter une pièce à mon dressing"
      className="absolute right-4 z-10 flex items-center gap-[10px] rounded-full bg-terracotta-deep text-cream cursor-pointer transition-transform active:scale-[.97]"
      style={{
        bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 12px)",
        minHeight: 52,
        minWidth: 52,
        padding: reduit ? "0 16px" : "0 20px 0 16px",
        boxShadow: "0 4px 14px rgba(29,26,22,.18)",
      }}
    >
      <span aria-hidden="true" className="flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      {!reduit && <span className="text-[13px] leading-[1.15] text-left">Ajouter<br />une pièce</span>}
    </button>
  );
}
