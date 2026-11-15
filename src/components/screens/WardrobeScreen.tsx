"use client";

import { masquerMenuActions } from "@/lib/menuActions";
import { useEffect, useMemo, useRef, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { useContexteRepris, useDefilementRepris, useGarderContexte } from "@/lib/memoireEcrans";
import { MosaiquePieces } from "@/components/CarteLook";
import PhotoPiece from "@/components/PhotoPiece";
import { useIdeesDressing } from "@/components/useIdeesDressing";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useAuth } from "@/lib/auth";
import { CATLABEL, CATS, OCC_LABELS, wornAgo } from "@/lib/data";
import {
  assezDuDressing,
  categoriesHorsPuces,
  groupesDuVestiaire,
  syntheseDressing,
} from "@/lib/dressingEcran";
import {
  articlePossessif,
  candidatsARedecouvrir,
  designationPiece,
  pisteAssociation,
  saisonDeLaDate,
} from "@/lib/dressingSections";
import { avecTirageDeterministe, graineIdees } from "@/lib/looks";
import { generateOutfitWithFallback, getOutfitsForItem } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { composeWardrobePool, daysSinceWorn, wearCounts } from "@/lib/selectors";
import BottomSheet from "@/components/BottomSheet";
import { teinteDe } from "@/lib/colorimetrieMoteur";
import { participePorte, participePorteMaj } from "@/lib/logic";
import { useCapsela } from "@/lib/store";
import type { Item, OccasionKey } from "@/lib/types";
import Button from "@/components/Button";
import { BarreRecherche, BoutonTri, CarteSynthese, OngletsDressing, Puces, type Tri } from "@/components/DressingUI";
import { PanneauLooks } from "@/components/screens/LooksScreen";
import { definirActionContextuelle } from "@/lib/menuActions";

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

interface ContexteDressing {
  recherche: string;
  groupeId: string | null;
  tri: Tri;
  couleurs: string[];
  jamaisPortees: boolean;
  defilement: number;
}

/**
 * L'ONGLET « MON DRESSING » (15/11/2026, brief « Refonte UX/UI – Page Dressing ») : exclusivement les pièces. La synthèse compacte
 * (nombre, « + Ajouter une pièce »), la recherche et ses filtres avancés (couleurs réellement présentes, pièces jamais portées), les
 * catégories en puces avec leur nombre, puis la grille. Les idées de looks du moteur qui suivaient la grille (« Tes looks »,
 * « L'inspiration du moment ») n'y sont plus : l'onglet est réservé aux vêtements ; elles restent sur la fiche de chaque pièce
 * (« Comment porter… »). « À redécouvrir », qui parle d'une pièce, reste sous la grille.
 */
function PanneauDressing() {
  const { state, actions, defaultCapsule, weather, dressingLoaded, etatPremium } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const [maintenant] = useState(() => Date.now());
  // MAQUETTE « DRESSING V10 » (14/10/2026) : la grille des pièces est la page. Recherche, catégorie et tri vivent ici, pas dans l'URL.
  // Ouvert depuis une catégorie ou une couleur (la fiche « Voir dans mon dressing » de Tenue, « Tes dernières pièces ») : `filtrePieces` du store.
  const filtre = state.filtrePieces;
  // AU RETOUR D'UNE FICHE (22/10/2026, memoireEcrans.ts) : la catégorie, la recherche, le tri et le défilement d'avant. Un filtre demandé
  // par un autre écran prime ; un onglet de la barre du bas ouvre le Dressing à neuf.
  const repris = useContexteRepris<ContexteDressing>("wardrobe", !!filtre);
  const [recherche, setRecherche] = useState(repris?.recherche ?? "");
  const [groupeId, setGroupeId] = useState<string | null>(() => {
    if (repris) return repris.groupeId;
    if (!filtre?.categories) return null;
    const cle = filtre.categories.join();
    return groupesDuVestiaire(state.items, profile.gender).find((g) => g.categories.join() === cle)?.id ?? null;
  });
  // MES PIÈCES EST FUSIONNÉ ICI (14/10/2026) : la sélection par appui long, la suppression confirmée, « Porté X fois » / « Jamais porté ».
  const [selectionMode, setSelectionMode] = useState(false);
  // La sélection pose sa barre « Retirer » en bas de l'écran : le menu d'actions flottant (menuActions.ts) s'efface le temps qu'elle dure.
  useEffect(() => {
    masquerMenuActions("selection-dressing", selectionMode);
    return () => masquerMenuActions("selection-dressing", false);
  }, [selectionMode]);
  const [selection, setSelection] = useState<Set<number>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appuiLongFait = useRef(false);
  const departAppui = useRef<{ x: number; y: number } | null>(null);
  const [tri, setTri] = useState<Tri>(repris?.tri ?? "recent");
  // LES FILTRES AVANCÉS (15/11/2026) : les couleurs réellement présentes dans le dressing, et « jamais portées » — rien d'inventé.
  const [couleurs, setCouleurs] = useState<string[]>(repris?.couleurs ?? []);
  const [jamaisPortees, setJamaisPortees] = useState(repris?.jamaisPortees ?? false);
  const [avancesOuverts, setAvancesOuverts] = useState(false);
  const zoneGrille = useRef<HTMLDivElement | null>(null);
  const defilement = useDefilementRepris(zoneGrille, repris?.defilement);
  useGarderContexte("wardrobe", (): ContexteDressing => ({ recherche, groupeId, tri, couleurs, jamaisPortees, defilement: defilement.position.current }));

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
      : composeWardrobePool(items, defaultCapsule, CATS.map(([k]) => k), { completerPourOccasion: occasion, saison: weather, exclureHorsOccasion: true, pieceAdaptee: true, genre: profile.gender });
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
  const pourIdees = useMemo(() => {
    const ordre = [...items].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, NB_PIECES_AVEC_IDEES);
    const redecouvrir = aRedecouvrir[0]?.piece;
    return redecouvrir && !ordre.some((p) => p.id === redecouvrir.id) ? [...ordre, redecouvrir] : ordre;
  }, [items, aRedecouvrir]);
  const idees = useIdeesDressing(pourIdees);

  const ouvrirTenue = (t: { occasion: OccasionKey; pieces: Item[] }) => actions.viewItemOutfit(t.pieces.map((p) => p.id), t.occasion);

  // ── CHARGEMENT ───────────────────────────────────────────────────────
  // Sans cet état, une utilisatrice qui possède des pièces voit l'empty
  // state et son « Ajoute ta première pièce » le temps du fetch.
  if (!dressingLoaded) {
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pb-safe-nav">
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
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pb-safe-nav">
        {/* UNE SEULE action dominante. Visuel d'accueil livré le 23/09 : ratio
            tenu par aspect-ratio, dimensions déclarées pour que rien ne saute
            à l'arrivée de l'image. */}
        <div className="mt-4 rounded-hero overflow-hidden" style={{ aspectRatio: "1.548", background: "var(--color-warm-bg)" }}>
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
        <Button variante="principal" className="mt-5" data-tour="dressing-ajouter"
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

  const aRedecouvrirUne = aRedecouvrir[0];
  const nbLooksRedecouvrir = aRedecouvrirUne ? (idees?.get(aRedecouvrirUne.piece.id)?.length ?? 0) : 0;
  // Accord sur le nom, comme l'article (« Tes baskets attendent », « Ta basket attend ») — plus sur la catégorie (09/10/2026).
  const pluriel = aRedecouvrirUne ? articlePossessif(aRedecouvrirUne.piece) === "tes" : false;

  // ── LES PIÈCES : recherche (nom, catégorie, couleur), catégorie, tri — la maquette V10 ──────────────────────────────────────────
  const normaliser = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const terme = normaliser(recherche.trim());
  const correspond = (it: Item) => !terme || normaliser(`${it.name} ${CATLABEL[it.cat] ?? ""} ${it.color ?? ""} ${it.brand ?? ""}`).includes(terme);
  // Les couleurs proposées par les filtres avancés : celles des pièces du dressing, avec leur pastille et leur nombre.
  const couleursPresentes = (() => {
    const m = new Map<string, { hex: string; n: number }>();
    for (const it of items) if (it.color) m.set(it.color, { hex: m.get(it.color)?.hex ?? it.hex, n: (m.get(it.color)?.n ?? 0) + 1 });
    return [...m.entries()].sort((x, y) => y[1].n - x[1].n || x[0].localeCompare(y[0], "fr"));
  })();
  const couleursActives = couleurs.filter((c) => couleursPresentes.some(([nom]) => nom === c));
  const nbAvances = couleursActives.length + (jamaisPortees ? 1 : 0);
  // « Jamais portée » au sens de la grille : sans date de port, ou sans aucun port au Journal (la grille dit alors « Jamais porté »).
  const jamaisPortee = (it: Item) => it.worn == null || ((parPiece.get(it.id) || 0) === 0 && daysSinceWorn(state.history, it.id) == null);
  const passeAvances = (it: Item) => (!couleursActives.length || (it.color != null && couleursActives.includes(it.color))) && (!jamaisPortees || jamaisPortee(it));
  // Une catégorie qu'aucune puce ne porte (« Haut » seul, venu du Journal, 15/10/2026) s'applique comme le filtre par teinte.
  const horsPuces = categoriesHorsPuces(filtre, groupes);
  const filtreExact = Boolean(filtre?.teinte || horsPuces);
  const baseItems = filtre?.teinte
    ? items.filter((i) => teinteDe(i) === filtre.teinte)
    : horsPuces
      ? items.filter((i) => horsPuces.includes(i.cat))
      : items;
  const parRecherche = baseItems.filter((it) => correspond(it) && passeAvances(it));
  const groupeActif = groupes.find((g) => g.id === groupeId) ?? null;
  const nbDuGroupe = (g: (typeof groupes)[number]) => parRecherche.filter((it) => g.categories.includes(it.cat)).length;
  const affichees = (groupeActif ? parRecherche.filter((it) => groupeActif.categories.includes(it.cat)) : parRecherche)
    .slice()
    .sort(
      tri === "az"
        ? (x, y) => x.name.localeCompare(y.name, "fr")
        : tri === "ancien"
          ? (x, y) => (x.createdAt ?? 0) - (y.createdAt ?? 0) || x.id - y.id
          : (x, y) => (y.createdAt ?? 0) - (x.createdAt ?? 0) || y.id - x.id
    );
  const pl = (n: number) => `${n} ${n <= 1 ? "pièce" : "pièces"}`;
  const libelleResultats = terme
    ? `${pl(affichees.length)} pour « ${recherche.trim()} »`
    : groupeActif
      ? `${groupeActif.libelle} · ${pl(affichees.length)}`
      : nbAvances
        ? `${pl(affichees.length)} filtrées`
        : `Toutes tes pièces · ${items.length}`;
  const sansFiltre = !terme && !groupeActif && !filtreExact && !nbAvances;

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
      {/* EN-TÊTE FIXE DE L'ONGLET : synthèse compacte, recherche et filtres avancés, catégories — la grille arrive juste dessous. */}
      <div className="flex-shrink-0 px-6">
        <CarteSynthese
          nombre={items.length /* Le nombre seul (15/11/2026, demandé : « supprime le /50 ») — la limite gratuite se dit ailleurs (Premium). */}
          libelle={items.length <= 1 ? "pièce" : "pièces"}
          action="Ajouter une pièce"
          onAction={ajouter}
        />
        {/* data-tour : la recherche et les catégories, cible de la visite guidée « Dressing » (lib/visites.ts). */}
        <div data-tour="dressing-filtres">
          <BarreRecherche
            valeur={recherche}
            onChange={setRecherche}
            placeholder="Rechercher une pièce, une couleur, une marque…"
            ariaLabel="Rechercher une pièce"
            filtres={{ actifs: nbAvances, onOuvrir: () => setAvancesOuverts(true) }}
          />
          {!selectionMode && !filtreExact && (
            <Puces
              ariaLabel="Catégories"
              puces={[{ id: null as string | null, libelle: "Tout", n: parRecherche.length }, ...groupes.map((g) => ({ id: g.id as string | null, libelle: g.libelle, n: nbDuGroupe(g) }))]}
              actif={groupeId}
              onChange={setGroupeId}
            />
          )}
          {(selectionMode || filtreExact) && <div className="h-3" />}
        </div>
      </div>

      <div ref={zoneGrille} onScroll={defilement.onScroll} className="scrollarea flex-1 min-h-0 overflow-y-auto px-6 border-t border-border" style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 88px)" }}>
        <div className="flex items-center justify-between gap-3 min-h-[44px]">
          <span role="status" aria-live="polite" className="text-[12px] text-muted-3 min-w-0">
            {selectionMode ? (selection.size === 0 ? "Touche les pièces à retirer" : `${selection.size} ${selection.size === 1 ? "sélectionnée" : "sélectionnées"}`) : filtreExact && filtre ? `${filtre.libelle} · ${pl(affichees.length)}` : libelleResultats}
          </span>
          {selectionMode ? (
            <button type="button" onClick={quitterSelection} className="h-[44px] text-[12px] text-muted flex-shrink-0 cursor-pointer">Annuler</button>
          ) : filtreExact ? (
            <button type="button" onClick={() => actions.goWardrobePieces()} className="h-[44px] text-[12px] font-semibold text-terracotta-deep flex-shrink-0 cursor-pointer">Tout afficher</button>
          ) : (
            <BoutonTri tri={tri} onChange={setTri} />
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
            <div className="t-titre-carte text-ink">
              {terme ? `Aucune pièce pour « ${recherche.trim()} »` : "Rien dans cette catégorie pour l'instant"}
            </div>
            <div className="text-[12.5px] text-muted-3 leading-[1.5] mt-2" style={{ textWrap: "pretty" }}>
              {terme ? "Essaie un autre mot, une couleur ou une catégorie. Ou ajoute-la si elle n'est pas encore dans ton dressing." : "Ajoute une pièce pour la retrouver ici."}
            </div>
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
              <button type="button" onClick={() => { setRecherche(""); setGroupeId(null); setCouleurs([]); setJamaisPortees(false); }} className="h-[44px] px-[18px] rounded-full border border-border bg-card text-[13px] font-semibold text-ink cursor-pointer">
                Voir tout le dressing
              </button>
              <button type="button" onClick={ajouter} className="h-[44px] px-[18px] rounded-full border border-terracotta-deep bg-card text-[13px] font-semibold text-terracotta-deep cursor-pointer">
                Ajouter une pièce
              </button>
            </div>
          </div>
        )}

        {/* Après les pièces, et seulement sans recherche ni filtre : la pièce à redécouvrir. */}
        {sansFiltre && (
          <>
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
                  <span className="block t-surtitre text-terracotta-hover">À redécouvrir · {weather.saisons?.length ? weather.saisons.join(" · ") : saisonDeLaDate(maintenant)}</span>
                  <span className="block t-titre-carte text-ink mt-[5px]">
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
    <BottomSheet title="Filtres avancés" open={avancesOuverts} onClose={() => setAvancesOuverts(false)}>
      {couleursPresentes.length > 0 && (
        <>
          <div className="t-surtitre text-muted">Couleurs</div>
          <div className="flex flex-wrap gap-2 mt-3">
            {couleursPresentes.map(([nom, { hex, n }]) => {
              const on = couleursActives.includes(nom);
              return (
                <button
                  key={nom}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCouleurs(on ? couleurs.filter((c) => c !== nom) : [...couleurs, nom])}
                  className={"h-[40px] pl-[8px] pr-[13px] rounded-full border text-[12.5px] font-medium flex items-center gap-[7px] cursor-pointer " + (on ? "bg-terracotta-deep border-terracotta-deep text-on-terracotta" : "bg-card border-border text-ink")}
                >
                  <span className="w-[22px] h-[22px] rounded-full border border-border flex-shrink-0" style={{ background: hex }} aria-hidden="true" />
                  {nom}
                  <span className="text-[11.5px]" style={{ color: on ? "var(--color-warm-bg)" : "var(--color-muted)" }}>{n}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="t-surtitre text-muted mt-6">Port</div>
      <button
        type="button"
        aria-pressed={jamaisPortees}
        onClick={() => setJamaisPortees(!jamaisPortees)}
        className={"mt-3 h-[40px] px-[15px] rounded-full border text-[12.5px] font-medium cursor-pointer " + (jamaisPortees ? "bg-terracotta-deep border-terracotta-deep text-on-terracotta" : "bg-card border-border text-ink")}
      >
        Jamais portées · {items.filter(jamaisPortee).length}
      </button>
      <div className="flex gap-2 mt-7 pb-2">
        <Button variante="secondaire" onClick={() => { setCouleurs([]); setJamaisPortees(false); }}>
          Effacer
        </Button>
        <Button variante="principal" onClick={() => setAvancesOuverts(false)}>
          Voir {pl(affichees.length)}
        </Button>
      </div>
    </BottomSheet>
    </>
  );
}

/**
 * LE DRESSING EN DEUX ONGLETS (15/11/2026, brief « Refonte UX/UI – Page Dressing »). L'en-tête commun — titre « Mon dressing », cloche,
 * avatar — puis les onglets Mon dressing et Mes looks, qui remplacent la carte « Mes looks » (14/11/2026) posée au-dessus des pièces.
 *
 * Un seul composant pour les deux écrans du store (`wardrobe`, `looks`), monté à la même place par App.tsx : changer d'onglet change
 * l'écran (le retour d'un look revient sur Mes looks, comme avant) sans rien démonter — les deux onglets restent montés, l'inactif
 * caché et inerte ; chacun garde sa recherche, ses filtres et son défilement, aucune donnée n'est rechargée.
 *
 * Le « + » flottant devient contextuel (menuActions.ts) : ajouter une pièce sur Mon dressing (le parcours d'ajout, ou Premium quand le
 * dressing gratuit est complet), créer un look sur Mes looks.
 */
export default function WardrobeScreen() {
  const { state, actions, etatPremium } = useCapsela();
  const onglet = state.screen === "looks" ? "looks" : "wardrobe";
  const filtre = state.filtrePieces;
  const complet = syntheseDressing(etatPremium, state.items.length, 0).complet;
  useEffect(() => {
    definirActionContextuelle(
      onglet === "looks"
        ? { libelle: "Créer un look", onClick: () => actions.goCreateLook() }
        : { libelle: "Ajouter une pièce", onClick: () => (complet ? actions.goPremium() : actions.openAdd()) }
    );
  }, [onglet, complet, actions]);
  useEffect(() => () => definirActionContextuelle(null), []);

  const panneau = (actif: boolean, contenu: React.ReactNode) => (
    <div className="absolute inset-0" aria-hidden={!actif} inert={!actif} style={actif ? undefined : { visibility: "hidden" }}>
      {contenu}
    </div>
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex-shrink-0 px-6 pt-[6px]">
        <AppHeader
          onBack={onglet === "wardrobe" ? (filtre?.retour === "tenue" ? actions.goTenues : filtre?.retour === "journal" ? actions.goHistory : undefined) : undefined}
          backLabel={filtre?.retour === "journal" ? "Revenir au Journal" : "Revenir à ma tenue"}
          titre={<>Mon <span className="italic">dressing</span></>}
        />
        <OngletsDressing actif={onglet} onChange={actions.ongletDressing} />
      </div>
      <div className="relative flex-1 min-h-0">
        {panneau(onglet === "wardrobe", <PanneauDressing />)}
        {panneau(onglet === "looks", <PanneauLooks />)}
      </div>
    </div>
  );
}
