"use client";

import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { MosaiquePieces } from "@/components/CarteLook";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/auth";
import { fondPhotoPiece } from "@/lib/catalogImages";
import { resolveItemImage } from "@/lib/catalogImages";
import { CATLABEL, CATS, OCC_LABELS } from "@/lib/data";
import {
  SEUIL_PROCHE_LIMITE,
  assezDuDressing,
  groupesDuVestiaire,
  syntheseDressing,
} from "@/lib/dressingEcran";
import {
  candidatsARedecouvrir,
  dateRelativeAjout,
  ligneDressing,
  looksRecents,
  piecesRecentes,
  pisteAssociation,
  recommandationPiece,
  saisonDeLaDate,
} from "@/lib/dressingSections";
import { generateOutfitWithFallback, getOutfitsForItem } from "@/lib/logic";
import { clePieces } from "@/lib/outfitFeedback";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { composeWardrobePool, wearCounts } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { CategoryKey, Item, OccasionKey } from "@/lib/types";
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

/** Lien d'action discret : terracotta, sans fond ni contour, cible de 44 px. */
function Lien({ onClick, children, label }: { onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="inline-flex items-center gap-[6px] text-[12px] text-terracotta cursor-pointer flex-shrink-0 py-[13px] -my-[13px] whitespace-nowrap"
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

/** Une pièce montrée par sa vraie photo (cadrée), ou son fond doux et l'icône de sa catégorie quand elle n'en a pas — jamais une image de stock. */
function PhotoPiece({ piece, ratio, rayon, className = "" }: { piece: Item; ratio: number; rayon: number; className?: string }) {
  const img = resolveItemImage(piece);
  return (
    <div
      role={img.url ? "img" : undefined}
      aria-label={img.url ? piece.name : undefined}
      className={`relative w-full overflow-hidden flex items-center justify-center ${className}`}
      style={{ aspectRatio: String(ratio), borderRadius: rayon, background: "var(--color-warm-bg)", ...(img.url ? fondPhotoPiece(img.url, img.kind === "detouree") : null) }}
    >
      {!img.url && <IconeCategorie cat={piece.cat} />}
    </div>
  );
}

/** Icône linéaire (trait 1.6) de la catégorie — le repli d'une photo absente. */
function IconeCategorie({ cat }: { cat: CategoryKey }) {
  const chemin: Partial<Record<CategoryKey, string>> = {
    haut: "M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3a4 4 0 01-8 0z",
    pull: "M8 4l-4 3 2 4 2-1v10h8V10l2 1 2-4-4-3a4 4 0 01-8 0z",
    pantalon: "M7 3h10l1 18h-4l-2-9-2 9H6z",
    jean: "M7 3h10l1 18h-4l-2-9-2 9H6z",
    short: "M7 5h10l1 9h-5l-1-3-1 3H6z",
    jupe: "M9 4h6l4 16H5z",
    robe: "M9 3h6l-1 6 4 12H6l4-12z",
    combinaison: "M9 3h6l-1 6 4 12H6l4-12z",
    veste: "M8 4l-4 3v13h5V9l3 3 3-3v11h5V7l-4-3-4 4z",
    manteau: "M8 4l-4 3v14h5V9l3 3 3-3v12h5V7l-4-3-4 4z",
    chaussures: "M4 16c4 0 5-3 6-7l3 2c1 3 3 4 7 4v3H4z",
    sac: "M6 9h12l1 11H5zM9 9a3 3 0 016 0",
  };
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--color-terracotta)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={chemin[cat] ?? "M12 4a2 2 0 011 3.7L12 9l8 6H4l8-6"} />
    </svg>
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

const COEUR = (plein: boolean) => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill={plein ? "var(--color-terracotta-deep)" : "none"} stroke={plein ? "var(--color-terracotta-deep)" : "currentColor"} strokeWidth="1.6" strokeLinejoin="round">
    <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
  </svg>
);

export default function WardrobeScreen() {
  const { state, actions, vestiairePool, defaultCapsule, weather, dressingLoaded, etatPremium } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const { savedLooks, history } = state;
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
   * LA RECOMMANDATION : une pièce de la capsule dont le dressing n'a encore aucune catégorie, et le nombre d'associations NOUVELLES
   * (ni un look enregistré, ni une tenue déjà portée) que le moteur compose avec au moins deux pièces du dressing. Rien de
   * calculable : pas de carte. Près de la limite gratuite : jamais d'incitation à ajouter (règle du 25/09/2026, SEUIL_PROCHE_LIMITE).
   */
  const reco = useMemo(() => {
    if (etatPremium === "gratuit" && items.length >= SEUIL_PROCHE_LIMITE) return null;
    return recommandationPiece({
      items,
      capsule: defaultCapsule,
      weather,
      hexes: paletteHexes(profile),
      gender: profile.gender,
      colorimetrie: colorimetrieMoteur(profile.colorimetrie),
      dejaVues: [...savedLooks.map((l) => l.pieceIds), ...history.map((h) => h.pieceIds)],
    });
  }, [items, defaultCapsule, weather, profile, etatPremium, savedLooks, history]);

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

  // ── DRESSING REMPLI (V6, 08/10/2026) ─────────────────────────────────
  // Ordre imposé : intro, ajoutées récemment, tes pièces, à redécouvrir, tes looks, recommandation. Chaque section se tait
  // quand elle n'a pas de donnée vraie.
  const recentes = piecesRecentes(items);
  const looks = looksRecents(state.history, state.savedLooks, resolvePool, 2);
  const sectionHaute = "mt-[34px]";

  return (
    <>
    <div
      className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]"
      // Au-dessus de la barre du bas, plus la place du bouton flottant : il ne masque jamais la fin de la page (≥ 96 px).
      style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 100px)" }}
    >
      {enTete}

      {/* ── AJOUTÉES RÉCEMMENT ─ tri par date d'ajout, rien d'autre. */}
      {recentes.length > 0 && (
        <section className={sectionHaute} aria-label="Ajoutées récemment">
          <TitreSection className="" action={<Lien onClick={() => actions.goWardrobePieces()} label="Voir toutes mes pièces">Voir tout</Lien>}>
            Ajoutées récemment
          </TitreSection>
          <TitreSerif>Tes dernières pièces</TitreSerif>
          <div className="scrollarea flex gap-[12px] overflow-x-auto mt-4 -mx-6 px-6" style={{ scrollPaddingInline: 18, scrollSnapType: "x mandatory" }}>
            {recentes.map((p) => (
              <button
                key={p.id}
                onClick={() => actions.openItem(p.id)}
                className="flex-none text-left cursor-pointer active:opacity-80"
                style={{ width: 146, scrollSnapAlign: "start" }}
              >
                <PhotoPiece piece={p} ratio={0.96} rayon={18} />
                <div className="font-serif text-ink mt-[9px] px-[2px] line-clamp-2" style={{ fontSize: 14, lineHeight: 1.25 }}>{p.name}</div>
                <div className="text-[11px] text-muted mt-[2px] px-[2px]">{CATLABEL[p.cat]}</div>
                <div className="text-[11px] mt-[1px] px-[2px]" style={{ color: "var(--color-muted-3)" }}>{dateRelativeAjout(p.createdAt as number, maintenant)}</div>
              </button>
            ))}
          </div>
          {/* Un lien secondaire : il ne concurrence jamais le bouton flottant. */}
          <div className="mt-4 flex items-center gap-[12px] rounded-carte px-[12px] py-[10px]" style={{ background: "var(--color-warm-bg)" }}>
            <div className="flex-none" style={{ width: 52 }} aria-hidden="true">
              <MosaiquePieces pieces={recentes.slice(0, 4)} />
            </div>
            <span aria-hidden="true" className="flex-none self-stretch" style={{ width: 1, background: "var(--color-sand-border)" }} />
            <div className="flex-1 min-w-0">
              <div className="text-[12px] leading-[1.45] text-ink" style={{ textWrap: "pretty" }}>
                Tes nouvelles pièces peuvent déjà ouvrir de nouveaux looks.
              </div>
              <Lien onClick={actions.goLooks}>Découvrir mes looks</Lien>
            </div>
          </div>
        </section>
      )}

      {/* ── TES PIÈCES ─ une carte par catégorie réellement présente. */}
      <section className={sectionHaute} aria-label="Tes pièces">
        <TitreSection className="" action={<Lien onClick={() => actions.goWardrobePieces()} label="Voir toutes mes pièces">Voir tout</Lien>}>
          Tes pièces
        </TitreSection>
        <div className="scrollarea flex gap-[12px] overflow-x-auto mt-4 -mx-6 px-6" style={{ scrollPaddingInline: 24, scrollSnapType: "x proximity" }}>
          {groupes.map((g) => (
            <button
              key={g.id}
              onClick={() => actions.goWardrobePieces({ libelle: g.libelle, categories: g.categories })}
              aria-label={`${g.libelle} : ${g.nbPieces} ${g.nbPieces <= 1 ? "pièce" : "pièces"}`}
              className="flex-none text-left cursor-pointer active:opacity-80 overflow-hidden"
              style={{ width: 118, scrollSnapAlign: "start", background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 18 }}
            >
              {/* Le visuel éditorial de la catégorie (arbitré le 08/10/2026 : on le garde). */}
              <div style={{ aspectRatio: "0.84", background: "var(--color-warm-bg)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.visuel} alt="" width={480} height={640} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
              <div className="px-[10px] pt-[8px] pb-[10px]">
                <div className="font-serif text-ink" style={{ fontSize: 13, lineHeight: 1.25, textWrap: "balance" }}>
                  {g.libelle.replace(/ & /g, " &\u00a0")}
                </div>
                <div className="text-[11px] text-muted mt-[2px]">
                  {g.nbPieces} {g.nbPieces <= 1 ? "pièce" : "pièces"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* DRESSING COMPLET (gratuit, 20 pièces) : présenté seulement quand la limite est atteinte — jamais avant. */}
      {synthese.complet && (
        <div className="mt-6">
          <div className="t-titre-section text-ink">Dressing complet</div>
          <div className="text-[13px] leading-[1.55] mt-[6px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
            {`Ton dressing contient déjà ${items.length} pièces. Passe à Premium pour continuer à l'enrichir.`}
          </div>
          <Button variante="contour" pleine={false} className="mt-4" onClick={() => actions.goPremium()}>
            Découvrir Premium
          </Button>
        </div>
      )}

      {/* ── À REDÉCOUVRIR ─ de saison, peu portées, avec un look possible. Plus compacte. */}
      {aRedecouvrir.length > 0 && (
        <section className={sectionHaute} aria-label="À redécouvrir">
          <TitreSection className="" action={<Lien onClick={actions.goNeverWorn} label="Voir les pièces à redécouvrir">Voir tout</Lien>}>
            À redécouvrir · {weather.saisons?.length ? weather.saisons.join(" / ") : saisonDeLaDate(maintenant)}
          </TitreSection>
          <TitreSerif taille={16}>Des pièces de saison à remettre en jeu</TitreSerif>
          <div className="scrollarea flex gap-[12px] overflow-x-auto mt-3 -mx-6 px-6" style={{ scrollPaddingInline: 24, scrollSnapType: "x proximity" }}>
            {aRedecouvrir.map(({ piece, etiquette, piste }) => (
              <button
                key={piece.id}
                onClick={() => actions.openItem(piece.id)}
                className="flex-none text-left cursor-pointer active:opacity-80"
                style={{ width: 132, scrollSnapAlign: "start" }}
              >
                <div className="relative">
                  <PhotoPiece piece={piece} ratio={1.12} rayon={16} />
                  <span
                    className="absolute left-[7px] bottom-[7px] rounded-full px-[8px] py-[3px] text-[10px] leading-none text-ink"
                    style={{ background: "var(--color-cream)" }}
                  >
                    {etiquette}
                  </span>
                </div>
                <div className="font-serif text-ink mt-[8px] px-[2px] line-clamp-1" style={{ fontSize: 13, lineHeight: 1.25 }}>{piece.name}</div>
                <div className="text-[11px] mt-[1px] px-[2px] line-clamp-2" style={{ color: "var(--color-muted-3)" }}>{piste}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ── TES LOOKS ─ deux cartes de même taille ; « Enregistrer » se défait d'un second geste. */}
      {looks.length > 0 && (
        <section className={sectionHaute} aria-label="Tes looks">
          <TitreSection
            className=""
            action={
              <Lien onClick={actions.goLooks} label="Voir tous mes looks">
                {state.savedLooks.length > 0 ? `Voir tout · ${state.savedLooks.length}` : "Voir tout"}
              </Lien>
            }
          >
            Tes looks
          </TitreSection>
          <div className="grid gap-[12px] mt-4" style={{ gridTemplateColumns: "1fr 1fr", gridAutoRows: "1fr" }}>
            {looks.map((l) => {
              const pieces = l.ids.map((id) => resolvePool.find((i) => i.id === id)).filter((it): it is Item => Boolean(it));
              const enregistre = l.enregistre !== null;
              return (
                <div key={l.cle} className="flex flex-col min-w-0 overflow-hidden" style={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 20 }}>
                  <button
                    onClick={() => (l.enregistre ? actions.openLook(l.enregistre.id) : actions.viewItemOutfit(l.ids, l.occasion ?? "quotidien"))}
                    aria-label={`Ouvrir ${l.titre}`}
                    className="relative block w-full cursor-pointer active:opacity-80"
                    style={{ aspectRatio: "1.18", background: "var(--color-photo-bg)" }}
                  >
                    <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(l.ids).join(",")} />
                  </button>
                  <div className="flex items-start justify-between gap-[6px] px-[10px] pt-[8px] pb-[6px] flex-1">
                    <div className="min-w-0">
                      <div className="font-serif text-ink" style={{ fontSize: 13, lineHeight: 1.25 }}>{l.titre}</div>
                      <div className="text-[11px] mt-[2px] line-clamp-2" style={{ color: "var(--color-muted-3)" }}>{l.meta}</div>
                    </div>
                    <button
                      onClick={() => actions.basculerLookDeTenue(l.ids, l.occasion, l.ts)}
                      aria-pressed={enregistre}
                      className="flex-none flex flex-col items-center justify-center cursor-pointer text-terracotta-deep"
                      style={{ minWidth: 44, minHeight: 44, marginTop: -4 }}
                    >
                      {COEUR(enregistre)}
                      <span className="text-[10px] leading-none mt-[2px]">{enregistre ? "Enregistré" : "Enregistrer"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── RECOMMANDATION ─ en dernier, secondaire. Le nombre vient du moteur ; sans lui, pas de carte. Pas de « Ignorer » (retiré le 08/10/2026). */}
      {reco && (
        <section className={`${sectionHaute} rounded-hero px-5 py-[18px] flex items-center gap-[14px]`} style={{ background: "var(--color-warm-bg)" }} aria-label="À découvrir">
          <div className="flex-1 min-w-0">
            <div className="t-surtitre text-muted">
              <span className="font-serif italic text-terracotta" aria-hidden="true">✦</span> À découvrir
            </div>
            <div className="t-titre-section text-ink mt-2">
              Une pièce pourrait ouvrir <span className="italic text-terracotta">de nouveaux looks</span>
            </div>
            <div className="text-[13px] leading-[1.55] mt-[6px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
              {`Cette pièce pourrait créer ${reco.nombre} ${reco.nombre === 1 ? "nouvelle association" : "nouvelles associations"} avec ce que tu possèdes déjà.`}
            </div>
            <div className="mt-3">
              <Lien onClick={actions.goCapsule}>Découvrir ma sélection</Lien>
            </div>
          </div>
          <div className="flex-none" style={{ width: 112 }}>
            <PhotoPiece piece={reco.pivot} ratio={0.9} rayon={16} />
          </div>
        </section>
      )}
    </div>
    {!synthese.complet && <BoutonAjoutFlottant onClick={actions.openAdd} />}
    </>
  );
}

/**
 * LE BOUTON FLOTTANT « AJOUTER UNE PIÈCE » (maquette du 04/10/2026) : toujours à portée du pouce, au-dessus de la barre
 * du bas. Étiqueté d'abord ; après trois usages, il se réduit au « + » — la personne sait ce qu'il fait. Le compte est
 * gardé sur l'appareil (aucune donnée de compte) ; sans stockage, il reste étiqueté.
 */
const CLE_USAGES_AJOUT = "capsela.boutonAjout.usages";
const USAGES_AVANT_REDUCTION = 3;

function BoutonAjoutFlottant({ onClick }: { onClick: () => void }) {
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
