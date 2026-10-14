"use client";

import { useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { MosaiquePieces } from "@/components/CarteLook";
import PhotoPiece from "@/components/PhotoPiece";
import { useIdeesDressing } from "@/components/useIdeesDressing";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/auth";
import { CATLABEL, CATS, OCC_LABELS, occasionShortLabel, wornAgo } from "@/lib/data";
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
  phrasePiste,
  piecesRecentes,
  pisteAssociation,
  saisonDeLaDate,
} from "@/lib/dressingSections";
import { avecTirageDeterministe, graineIdees } from "@/lib/looks";
import { generateOutfitWithFallback, getOutfitsForItem, type ItemOutfitVariation } from "@/lib/logic";
import { clePieces } from "@/lib/outfitFeedback";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { composeWardrobePool, daysSinceWorn, wearCounts } from "@/lib/selectors";
import BottomSheet from "@/components/BottomSheet";
import { teinteDe } from "@/lib/colorimetrieMoteur";
import { participePorte, participePorteMaj } from "@/lib/logic";
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
  // MAQUETTE « DRESSING V10 » (14/10/2026) : la grille des pièces est la page. Recherche, catégorie et tri vivent ici, pas dans l'URL.
  const [recherche, setRecherche] = useState("");
  // Ouvert depuis une catégorie ou une couleur (la fiche « Voir dans mon dressing » de Tenue, « Tes dernières pièces ») : `filtrePieces` du store.
  const filtre = state.filtrePieces;
  const [groupeId, setGroupeId] = useState<string | null>(() => {
    if (!filtre?.categories) return null;
    const cle = filtre.categories.join();
    return groupesDuVestiaire(state.items, profile.gender).find((g) => g.categories.join() === cle)?.id ?? null;
  });
  // MES PIÈCES EST FUSIONNÉ ICI (14/10/2026) : la sélection par appui long, la suppression confirmée, « Porté X fois » / « Jamais porté ».
  const [selectionMode, setSelectionMode] = useState(false);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appuiLongFait = useRef(false);
  const departAppui = useRef<{ x: number; y: number } | null>(null);
  const [tri, setTri] = useState<"recent" | "az">("recent");

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
    // Tirage stable (12/10/2026) : même dressing, mêmes tenues d'inspiration à chaque rechargement (graine = occasion + pool).
    const r = avecTirageDeterministe(graineIdees(occasion.length, occasion, pool), () =>
      generateOutfitWithFallback(pool, weather, occasion, state.workMode, state.dateContext, paletteHexes(profile), profile.gender, undefined, undefined, colorimetrieMoteur(profile.colorimetrie))
    );
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
      // Tirage stable (12/10/2026) : la piste « Avec ton… » d'une pièce ne change pas au rechargement.
      const tenues = avecTirageDeterministe(graineIdees(c.piece.id, "a-redecouvrir", items), () =>
        getOutfitsForItem(c.piece.id, items, weather, hexes, { maxPerOccasion: 1, maxTotal: 4, attemptsPerOccasion: 12 }, profile.gender, null, colo)
      );
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
      <div className="t-titre-ecran text-ink mt-[18px]" style={{ textWrap: "balance" }}>
        Mon <span className="italic text-terracotta">dressing</span>
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
  // à redécouvrir. Chaque bloc se tait quand il n'a pas de donnée vraie. Le bouton d'ajout est flottant (« + », à droite) depuis le 12/10/2026 ;
  // dressing complet (gratuit), il mène à Premium au lieu d'ouvrir un formulaire qui refuserait d'enregistrer.
  const ajouter = () => (synthese.complet ? actions.goPremium() : actions.openAdd());

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

  // ── LES PIÈCES : recherche (nom, catégorie, couleur), catégorie, tri — la maquette V10 ──────────────────────────────────────────
  const normaliser = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terme = normaliser(recherche.trim());
  const correspond = (it: Item) => !terme || normaliser(`${it.name} ${CATLABEL[it.cat] ?? ""} ${it.color ?? ""}`).includes(terme);
  const baseItems = filtre?.teinte ? items.filter((i) => teinteDe(i) === filtre.teinte) : items;
  const parRecherche = baseItems.filter(correspond);
  const groupeActif = groupes.find((g) => g.id === groupeId) ?? null;
  const nbDuGroupe = (g: (typeof groupes)[number]) => parRecherche.filter((it) => g.categories.includes(it.cat)).length;
  const affichees = (groupeActif ? parRecherche.filter((it) => groupeActif.categories.includes(it.cat)) : parRecherche)
    .slice()
    .sort(tri === "recent" ? (x, y) => (y.createdAt ?? 0) - (x.createdAt ?? 0) || y.id - x.id : (x, y) => x.name.localeCompare(y.name, "fr"));
  const pl = (n: number) => `${n} ${n <= 1 ? "pièce" : "pièces"}`;
  const libelleResultats = terme
    ? `${pl(affichees.length)} pour « ${recherche.trim()} »`
    : groupeActif
      ? `${groupeActif.libelle} · ${pl(affichees.length)}`
      : `Toutes tes pièces · ${items.length}`;
  const sansFiltre = !terme && !groupeActif && !filtre?.teinte;

  const quitterSelection = () => {
    setSelectionMode(false);
    setSelection(new Set());
    setConfirmOpen(false);
  };
  const basculer = (id: number) =>
    setSelection((prec) => {
      const suivant = new Set(prec);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
  // Appui long sur une pièce = entrée dans la sélection, cette pièce cochée (le geste de la galerie du téléphone). Si le doigt bouge
  // (défilement) ou se relève avant 500 ms, rien ne se passe ; le clic qui suit un appui long est avalé, sinon il ouvrirait la pièce.
  const annulerAppui = () => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = null;
    departAppui.current = null;
  };
  const commencerAppui = (e: React.PointerEvent, id: number) => {
    if (selectionMode) return;
    appuiLongFait.current = false;
    departAppui.current = { x: e.clientX, y: e.clientY };
    minuteur.current = setTimeout(() => {
      minuteur.current = null;
      appuiLongFait.current = true;
      setSelectionMode(true);
      setSelection(new Set([id]));
    }, 500);
  };
  const bougerAppui = (e: React.PointerEvent) => {
    const d = departAppui.current;
    if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 10) annulerAppui();
  };
  const supprimerSelection = () => {
    actions.removeItems([...selection]);
    quitterSelection();
  };

  return (
    <>
    <div className="absolute inset-0 flex flex-col">
      {/* EN-TÊTE FIXE : bandeau, titre, recherche, catégories — la grille arrive juste dessous, sans bannière intercalée. */}
      <div className="flex-shrink-0 px-6 pt-[6px]">
        <AppHeader onBack={filtre?.retour === "tenue" ? actions.goTenues : undefined} backLabel="Revenir à ma tenue" />
        <div className="t-titre-ecran text-ink mt-[18px]">
          Mon <span className="italic text-terracotta">dressing</span>
        </div>
        <div className="text-[13px] text-muted-3 mt-[4px]">{pl(items.length)}</div>
        <label className="mt-3 flex items-center gap-[10px] h-[44px] pl-[14px] pr-[6px] rounded-full bg-card border" style={{ borderColor: recherche ? "var(--color-terracotta-deep)" : "var(--color-border)" }}>
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" className="flex-shrink-0 text-muted-3" style={{ display: "block" }}>
            <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="6" />
              <path d="M20 20l-4.5-4.5" />
            </g>
          </svg>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher une pièce, une couleur…"
            aria-label="Rechercher une pièce"
            className="flex-1 min-w-0 h-full bg-transparent outline-none text-[13.5px] font-medium text-ink placeholder:text-placeholder"
          />
          {recherche && (
            <button type="button" onClick={() => setRecherche("")} aria-label="Effacer la recherche" className="w-[34px] h-[34px] flex-shrink-0 rounded-full bg-warm-bg flex items-center justify-center cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="text-muted-3" style={{ display: "block" }}>
                <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </label>
        {!selectionMode && !filtre?.teinte && (
        <div role="tablist" aria-label="Catégories" className="scrollarea flex gap-2 overflow-x-auto py-3 -mx-6 px-6" style={{ scrollbarWidth: "none" }}>
          {[{ id: null as string | null, libelle: "Tout", n: parRecherche.length }, ...groupes.map((g) => ({ id: g.id as string | null, libelle: g.libelle, n: nbDuGroupe(g) }))].map((c) => {
            const actif = groupeId === c.id;
            return (
              <button
                key={c.id ?? "tout"}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => setGroupeId(c.id)}
                className={"flex-shrink-0 h-[40px] px-[15px] rounded-full border text-[12.5px] font-medium whitespace-nowrap flex items-center gap-[6px] cursor-pointer " + (actif ? "bg-terracotta-deep border-terracotta-deep text-on-terracotta" : "bg-card border-border text-ink")}
              >
                {c.libelle}
                <span className="text-[11.5px]" style={{ color: actif ? "var(--color-warm-bg)" : "var(--color-muted)" }}>{c.n}</span>
              </button>
            );
          })}
        </div>
        )}
      </div>

      <div className="scrollarea flex-1 min-h-0 overflow-y-auto px-6 border-t border-border" style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 88px)" }}>
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <span role="status" aria-live="polite" className="text-[12px] text-muted-3 min-w-0">
            {selectionMode ? (selection.size === 0 ? "Touche les pièces à retirer" : `${selection.size} ${selection.size === 1 ? "sélectionnée" : "sélectionnées"}`) : filtre?.teinte ? `${filtre.libelle} · ${pl(affichees.length)}` : libelleResultats}
          </span>
          {selectionMode ? (
            <button type="button" onClick={quitterSelection} className="h-[44px] text-[12px] text-muted flex-shrink-0 cursor-pointer">Annuler</button>
          ) : filtre?.teinte ? (
            <button type="button" onClick={() => actions.goWardrobePieces()} className="h-[44px] text-[12px] font-semibold text-terracotta-deep flex-shrink-0 cursor-pointer">Tout afficher</button>
          ) : (
            <button type="button" onClick={() => setTri(tri === "recent" ? "az" : "recent")} className="h-[44px] flex items-center gap-[5px] text-[12px] font-semibold text-ink cursor-pointer">
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className="text-muted-3" style={{ display: "block" }}>
                <path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {tri === "recent" ? "Récentes d'abord" : "A → Z"}
            </button>
          )}
        </div>
        {!selectionMode && affichees.length > 0 && <div className="text-[11px] text-placeholder -mt-[4px] mb-[6px]">Appui long sur une pièce pour la sélectionner</div>}

        {affichees.length > 0 ? (
          <div className="grid grid-cols-3 gap-x-2 gap-y-[14px]">
            {affichees.map((p) => {
              const nb = parPiece.get(p.id) || 0;
              // it.worn (jamais null si déjà porté) reste la source de « jamais porté » ; le nombre vient de l'historique réel.
              const jamais = p.worn == null;
              const jours = jamais ? null : daysSinceWorn(state.history, p.id);
              const aujourdhui = jours === 0;
              const cochee = selection.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (appuiLongFait.current) {
                      appuiLongFait.current = false;
                      return;
                    }
                    if (selectionMode) basculer(p.id);
                    else actions.openItem(p.id, false);
                  }}
                  onPointerDown={(e) => commencerAppui(e, p.id)}
                  onPointerMove={bougerAppui}
                  onPointerUp={annulerAppui}
                  onPointerCancel={annulerAppui}
                  onPointerLeave={annulerAppui}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={p.name}
                  aria-pressed={selectionMode ? cochee : undefined}
                  className="block min-w-0 text-left text-ink cursor-pointer select-none [-webkit-touch-callout:none]"
                >
                  <div className="relative">
                    <PhotoPiece piece={p} ratio={0.8} rayon={14} />
                    {selectionMode && (
                      <span
                        className="absolute top-[7px] left-[7px] w-[22px] h-[22px] rounded-full border flex items-center justify-center text-[12px]"
                        style={cochee ? { background: "rgba(166,105,80,.95)", borderColor: "rgba(166,105,80,.95)", color: "var(--color-cream)" } : { background: "rgba(243,238,229,.85)", borderColor: "rgba(29,26,22,.18)", color: "transparent" }}
                      >
                        ✓
                      </span>
                    )}
                    {aujourdhui && !selectionMode && (
                      <span className="absolute top-[6px] right-[6px] text-[9px] tracking-[.04em] text-cream rounded-full px-[7px] py-[2px]" style={{ background: "rgba(166,105,80,.92)" }}>
                        Aujourd&apos;hui
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] font-medium leading-[1.3] mt-[6px]" style={{ textWrap: "pretty", opacity: selectionMode && !cochee ? 0.45 : 1 }}>{p.name}</div>
                  <div className="text-[10px] text-placeholder mt-[1px] leading-[1.3]">
                    {/* Accordé à la pièce (participePorte) : « Jamais portées » pour des bottines. */}
                    {jamais ? "Jamais " + participePorte(p) : nb > 0 ? `${participePorteMaj(p)} ${nb} fois` : wornAgo(jours).replace(/^Porté/, participePorteMaj(p))}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="pt-9 pb-7 px-3 text-center">
            <div className="font-serif text-ink" style={{ fontSize: 18, lineHeight: 1.25 }}>
              {terme ? `Aucune pièce pour « ${recherche.trim()} »` : "Rien dans cette catégorie pour l'instant"}
            </div>
            <div className="text-[12.5px] text-muted-3 leading-[1.5] mt-2" style={{ textWrap: "pretty" }}>
              {terme ? "Essaie un autre mot, une couleur ou une catégorie. Ou ajoute-la si elle n'est pas encore dans ton dressing." : "Ajoute une pièce pour la retrouver ici."}
            </div>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              <button type="button" onClick={() => { setRecherche(""); setGroupeId(null); }} className="h-[44px] px-[18px] rounded-full border border-border bg-card text-[13px] font-semibold text-ink cursor-pointer">
                Voir tout le dressing
              </button>
              <button type="button" onClick={ajouter} className="h-[44px] px-[18px] rounded-full border border-terracotta-deep bg-card text-[13px] font-semibold text-terracotta-deep cursor-pointer">
                Ajouter une pièce
              </button>
            </div>
          </div>
        )}

        {/* Après les pièces, et seulement sans recherche ni catégorie : looks, inspiration, à redécouvrir. */}
        {sansFiltre && (
          <>
            {looksCarrousel.length > 0 && (
              <section className="mt-8" aria-label="Tes looks">
                <div className="flex items-center justify-between gap-3">
                  <TitreSerif taille={18}>Tes looks</TitreSerif>
                  <Lien onClick={actions.goLooks} label="Voir mes looks">Voir mes looks</Lien>
                </div>
                <div className="grid grid-cols-2 gap-[10px] mt-1 items-start">
                  {looksCarrousel.slice(0, 2).map(({ piece, idee }) => {
                    const pieces = idee.ids.map((id) => resolvePool.find((i) => i.id === id)).filter((i): i is Item => !!i);
                    return (
                      <button key={clePieces(idee.ids).join(",")} type="button" onClick={() => actions.viewItemOutfit(idee.ids, idee.occasion)} className="flex flex-col justify-start h-full text-left cursor-pointer active:opacity-80">
                        <div
                          className="relative overflow-hidden"
                          style={{ aspectRatio: "0.9", borderRadius: 20, background: "radial-gradient(120% 90% at 50% 28%, var(--color-flatlay-bg-clair) 0%, var(--color-flatlay-bg) 100%)", boxShadow: "inset 0 0 0 1px rgba(29,26,22,.05)" }}
                        >
                          <FlatLayCapsela items={pieces} context="look-detail" layoutSeed={clePieces(idee.ids).join(",")} ombre="marquee" />
                        </div>
                        <div className="font-serif text-ink mt-2" style={{ fontSize: 15 }}>{occasionShortLabel(idee.occasion)}</div>
                        {/* La piste sur une ligne, le nombre de pièces toujours sur la suivante (14/10/2026, demandé) : deux lignes fixes, cartes de même hauteur. */}
                        <div className="text-[11.5px] text-muted-3 mt-[2px] leading-[1.35]">
                          <div className="truncate">{phrasePiste(piece)}</div>
                          <div>{idee.ids.length} pièces</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {lookInspiration && avecIdee && phraseInspiration && (
              <button
                type="button"
                onClick={() => actions.viewItemOutfit(lookInspiration.ids, lookInspiration.occasion)}
                className="mt-[22px] w-full flex items-center gap-[14px] text-left rounded-[20px] border border-border bg-card py-3 pl-3 pr-[14px] cursor-pointer active:opacity-80"
                aria-label="L'inspiration du moment"
              >
                <span className="relative flex-none overflow-hidden" style={{ width: 76, height: 92, borderRadius: 14, background: "var(--color-hero-background)" }}>
                  <FlatLayCapsela
                    items={lookInspiration.ids.map((id) => resolvePool.find((i) => i.id === id)).filter((i): i is Item => !!i)}
                    context="look-detail"
                    layoutSeed={clePieces(lookInspiration.ids).join(",")}
                  />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="t-surtitre flex items-center gap-[6px] text-terracotta-hover">
                    <span className="text-terracotta">{ETOILE}</span>
                    L&apos;inspiration du moment
                  </span>
                  <span className="block font-serif text-ink mt-[5px]" style={{ fontSize: 16.5, lineHeight: 1.2 }}>
                    Tes nouvelles pièces, <span className="italic text-terracotta">déjà en looks</span>
                  </span>
                  <span className="block text-[12px] font-semibold mt-[6px] text-terracotta-deep">Voir ce look</span>
                </span>
              </button>
            )}

            {aRedecouvrirUne && (
              <button
                onClick={() => actions.openItemOutfits(aRedecouvrirUne.piece.id, false, idees?.get(aRedecouvrirUne.piece.id))}
                className="mt-[10px] w-full flex items-center gap-[14px] text-left rounded-[20px] py-3 pl-3 pr-[14px] cursor-pointer active:opacity-80"
                style={{ background: "var(--color-warm-bg)" }}
                aria-label="À redécouvrir"
              >
                <span className="flex-none" style={{ width: 76 }}>
                  <PhotoPiece piece={aRedecouvrirUne.piece} ratio={0.82} rayon={14} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block t-surtitre text-terracotta-hover">À redécouvrir · {weather.saisons?.length ? weather.saisons.join(" / ") : saisonDeLaDate(maintenant)}</span>
                  <span className="block font-serif text-ink mt-[5px]" style={{ fontSize: 16.5, lineHeight: 1.2 }}>
                    {`${designationPiece(aRedecouvrirUne.piece).replace(/^t(on|a|es) /, (m) => `T${m.slice(1)}`)} `}
                    <span className="italic text-terracotta">{pluriel ? "attendent leur moment" : "attend son moment"}</span>
                  </span>
                  {nbLooksRedecouvrir > 0 && (
                    <span className="block text-[12px] font-semibold mt-[6px] text-terracotta-deep">
                      {nbLooksRedecouvrir} {nbLooksRedecouvrir === 1 ? "look cette saison" : "looks cette saison"}
                    </span>
                  )}
                </span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
    {selectionMode && selection.size > 0 && (
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[480px] px-6 pb-[18px] pt-[14px] bg-gradient-to-t from-cream via-cream to-transparent">
        <Button variante="destructif" onClick={() => setConfirmOpen(true)}>
          Retirer {selection.size} {selection.size === 1 ? "pièce" : "pièces"}
        </Button>
      </div>
    )}
    <BottomSheet title={selection.size === 1 ? "Retirer cette pièce" : `Retirer ${selection.size} pièces`} open={confirmOpen} onClose={() => setConfirmOpen(false)}>
      <div className="text-[13px] text-ink leading-[1.55]">
        {selection.size === 1 ? "Cette pièce quittera" : "Ces pièces quitteront"} ton dressing et {selection.size === 1 ? "ne sera plus proposée" : "ne seront plus proposées"} dans tes tenues. Ton historique
        reste intact. <span className="text-rust">Cette action est définitive.</span>
      </div>
      <Button variante="destructif" className="mt-[22px]" onClick={supprimerSelection}>
        Retirer définitivement
      </Button>
      <button onClick={() => setConfirmOpen(false)} className="mt-[10px] w-full text-center text-[13px] text-muted py-[10px] cursor-pointer">
        Annuler
      </button>
    </BottomSheet>
    {!selectionMode && <BoutonAjoutFlottant onClick={ajouter} />}
    </>
  );
}

/**
 * LE BOUTON FLOTTANT « AJOUTER UNE PIÈCE » (12/10/2026, demandé : remplacer le bouton « Ajouter » de l'en-tête par un bouton flottant à
 * droite de l'écran, avec un « + ») : un rond de 56 px, toujours à portée du pouce, au-dessus de la barre du bas. L'étiquette qui se
 * réduisait au « + » après trois usages (maquette du 04/10/2026) disparaît : il est un « + » d'emblée, nommé pour les lecteurs d'écran.
 */
export function BoutonAjoutFlottant({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ajouter une pièce à mon dressing"
      className="absolute right-4 z-10 flex items-center justify-center rounded-full bg-terracotta-deep active:bg-terracotta-hover text-cream cursor-pointer transition-transform active:scale-[.95]"
      style={{
        bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 16px)",
        width: 56,
        height: 56,
        boxShadow: "0 4px 14px rgba(29,26,22,.22)",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
