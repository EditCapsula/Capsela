"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import AssociationsDressing from "@/components/AssociationsDressing";
import CarteLook, { MosaiquePieces, ONGLETS_LOOKS, VisuelPiece } from "@/components/CarteLook";
import LoadingSpinner from "@/components/LoadingSpinner";
import SegmentedControl from "@/components/SegmentedControl";
import { useAuth } from "@/lib/auth";
import { CATS, OCC_LABELS } from "@/lib/data";
import {
  assezDuDressing,
  associationsNouvelles,
  categoriesManquantes,
  choisirADecouvrir,
  groupesDuVestiaire,
  enteteDressing,
  syntheseDressing,
} from "@/lib/dressingEcran";
import { generateOutfitWithFallback } from "@/lib/logic";
import { filtrerLooks, type FiltreLooks } from "@/lib/looksFiltre";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import { composeWardrobePool, inactivityInfo, isWishlistLook, lookWornCount, neverWornItems } from "@/lib/selectors";
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

/**
 * Occasions des associations de « À découvrir » — trois contextes distincts,
 * pour que les tenues proposées ne se ressemblent pas.
 */
const OCCASIONS_ASSOCIATIONS: OccasionKey[] = ["quotidien", "travail_formel", "soiree"];
/** Les deux occasions des idées d'inspiration du dressing vide. */
const OCCASIONS_INSPIRATION: OccasionKey[] = ["quotidien", "travail_formel"];
/** Looks du carrousel ; au-delà, « Voir tout → » au bout mène à l'écran « Mes looks ». */
const LOOKS_CARROUSEL = 8;

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

/**
 * Les associations de « ✦ À découvrir », en encart (polish V3) : de petites
 * mosaïques et « Découvrir → » sur une seule ligne. Chaque mosaïque ouvre sa
 * tenue ; « Découvrir → » ouvre la première. L'occasion n'est plus écrite
 * sous chaque tenue — elle reste dans le nom accessible et sur l'écran Tenue.
 */
function AssociationsCompactes({
  tenues,
  onOuvrir,
}: {
  tenues: { occasion: OccasionKey; pieces: Item[] }[];
  onOuvrir: (t: { occasion: OccasionKey; pieces: Item[] }) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-3">
      <div className="flex gap-[8px] min-w-0">
        {tenues.map((t) => (
          <button
            key={t.occasion}
            onClick={() => onOuvrir(t)}
            aria-label={`Voir la tenue ${OCC_LABELS[t.occasion]} proposée par Capsela`}
            className="flex-none grid grid-cols-2 gap-[3px] p-[4px] rounded-champ cursor-pointer active:opacity-80"
            style={{ width: 52, background: "var(--color-cream)" }}
          >
            {Array.from({ length: 4 }, (_, i) => t.pieces[i]).map((p, i) => (
              <span key={p ? p.id : `vide-${i}`} className="block" style={{ aspectRatio: "1" }}>
                {p ? <VisuelPiece piece={p} alt="" radius={6} /> : null}
              </span>
            ))}
          </button>
        ))}
      </div>
      <Lien onClick={() => onOuvrir(tenues[0])} label={`Découvrir la tenue ${OCC_LABELS[tenues[0].occasion]} proposée par Capsela`}>
        Découvrir →
      </Lien>
    </div>
  );
}

export default function WardrobeScreen() {
  const { state, actions, vestiairePool, defaultCapsule, weather, dressingLoaded, etatPremium } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const [filtreLooks, setFiltreLooks] = useState<FiltreLooks>("all");

  // Pool de résolution stable des looks — cf. l'en-tête, correctif 20/08/2026.
  const resolvePool = useMemo(() => [...items, ...vestiairePool], [items, vestiairePool]);
  const neverWorn = useMemo(() => neverWornItems(items), [items]);
  const groupes = useMemo(() => groupesDuVestiaire(items, profile.gender), [items, profile.gender]);
  const synthese = syntheseDressing(etatPremium, items.length, groupes.length);
  const resume = enteteDressing(etatPremium, items.length, groupes.length);
  const libellesLongs = groupes.some((g) => g.libelle.length > 21);

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
    const vide = items.length === 0;
    if (vide && defaultCapsule.length === 0) return [];
    const tenues = (vide ? OCCASIONS_INSPIRATION : OCCASIONS_ASSOCIATIONS)
      .map((occasion) => composerTenue(occasion))
      .filter((t): t is NonNullable<typeof t> => t !== null);
    if (vide) return tenues;
    return associationsNouvelles(tenues, [...state.savedLooks.map((l) => l.pieceIds), ...state.history.map((h) => h.pieceIds)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, defaultCapsule, weather, state.workMode, state.dateContext, profile, state.savedLooks, state.history]);

  const aDecouvrir = choisirADecouvrir({
    etat: etatPremium,
    nbPieces: items.length,
    nbAssociations: items.length > 0 ? tenuesMoteur.length : 0,
    nbManques: categoriesManquantes(defaultCapsule, items).length,
  });
  const ouvrirTenue = (t: { occasion: OccasionKey; pieces: Item[] }) => actions.viewItemOutfit(t.pieces.map((p) => p.id), t.occasion);

  // ── MON DRESSING ─────────────────────────────────────────────────────
  const enTete = (
    <>
      <AppHeader />
      <div className="t-surtitre text-muted mt-[14px]">Mon dressing</div>
      <div className="t-titre-ecran text-ink mt-[6px]" style={{ textWrap: "balance" }}>
        Ton vestiaire, <span className="italic text-terracotta">à ton image</span>
      </div>
      {/* Le total, comme la Capsule : une ligne en serif, puis le détail en petit. */}
      {dressingLoaded && items.length > 0 && (
        <div className="font-serif text-[17px] text-ink leading-[1.3] mt-[10px]">{resume.titre}</div>
      )}
      <div className="flex items-baseline justify-between gap-[10px] mt-[2px]">
        <div className="text-[12px] text-muted">{!dressingLoaded ? " " : items.length > 0 ? resume.detail : synthese.texte}</div>
        {/* Un lien, plus un bouton plein : le brief demande des CTA moins
            présents. Retiré au dressing complet — il ouvrirait un formulaire
            qui ne peut plus enregistrer ; le bloc Premium ci-dessous le
            remplace. Dressing vide : l'action dominante est plus bas. */}
        {dressingLoaded && items.length > 0 && !synthese.complet && (
          <Lien onClick={actions.openAdd} label="Ajouter une pièce à mon dressing">
            {PLUS}
            Ajouter une pièce
          </Lien>
        )}
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

  // ── DRESSING REMPLI ──────────────────────────────────────────────────
  const looks = filtrerLooks(state.savedLooks, filtreLooks);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {enTete}

      {/* DRESSING COMPLET (gratuit, 20 pièces) : présenté seulement quand la
          limite est atteinte — jamais avant. L'ajout mène à Premium au lieu
          d'ouvrir un formulaire qui refuserait d'enregistrer à la fin. */}
      {synthese.complet && (
        <div className="mt-6">
          <div className="t-titre-section text-ink">Dressing complet</div>
          <div className="text-[13px] leading-[1.55] mt-[6px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
            {`Ton vestiaire contient déjà ${items.length} pièces. Passe à Premium pour continuer à l'enrichir.`}
          </div>
          <Button variante="contour" pleine={false} className="mt-4" onClick={() => actions.goPremium()}>
            Découvrir Premium
          </Button>
        </div>
      )}

      {/* ── À REDÉCOUVRIR ─ une ligne légère, seulement s'il y a des pièces jamais portées. */}
      {neverWorn.length > 0 &&
        (() => {
          // Second niveau repris tel quel : quand TOUTES sont aussi inactives
          // (saisonnièrement significatif), la phrase le dit.
          const toutesInactives = neverWorn.every((it) => inactivityInfo(it).inactive);
          const pluriel = neverWorn.length > 1;
          return (
            <>
              <TitreSection>À redécouvrir</TitreSection>
              <button
                onClick={actions.goNeverWorn}
                aria-label={`${neverWorn.length} ${pluriel ? "pièces jamais portées" : "pièce jamais portée"}. Voir`}
                className="w-full flex items-center gap-[14px] mt-3 text-left cursor-pointer active:opacity-80"
              >
                {/* Deux miniatures, de même taille et au même ratio qu'avant
                    (42 × 54 → 50 × 64) : une respiration, pas une carte. */}
                <span className="flex gap-[8px] flex-shrink-0">
                  {neverWorn.slice(0, 2).map((p) => (
                    <span key={p.id} className="block" style={{ width: 50, height: 64 }}>
                      <VisuelPiece piece={p} alt={p.name} radius={12} />
                    </span>
                  ))}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block t-titre-vignette text-ink">
                    {neverWorn.length} {pluriel ? "pièces jamais portées" : "pièce jamais portée"}
                  </span>
                  {toutesInactives && (
                    <span className="block text-[12px] leading-[1.4] mt-[3px]" style={{ color: "var(--color-muted-3)" }}>
                      {pluriel ? "Tu ne les as pas portées pendant leur dernière saison." : "Tu ne l'as pas portée pendant sa dernière saison."}
                    </span>
                  )}
                </span>
                <span className="text-[12px] text-terracotta flex-shrink-0">Voir →</span>
              </button>
            </>
          );
        })()}

      {/* ── MON VESTIAIRE ─ le cœur de la page : un visuel éditorial par groupe. */}
      <TitreSection action={<Lien onClick={() => actions.goWardrobePieces()} label="Voir toutes mes pièces">Voir tout →</Lien>}>
        Mon vestiaire
      </TitreSection>
      {/* `-mx-6 px-6` : le carrousel touche les bords de l'écran, son
          débordement reste DANS son conteneur ; première et dernière carte
          alignées sur le texte. */}
      {/* Largeur : deux cartes entières et le bord de la troisième, qui dit
          qu'il y en a d'autres (148 px à 390 px de large, 142 au plus étroit).
          Hauteur : 5/6 au lieu de 3/4 — l'image reste le sujet. */}
      <div className="scrollarea flex gap-[12px] overflow-x-auto mt-4 -mx-6 px-6" style={{ scrollPaddingInline: 24, scrollSnapType: "x proximity" }}>
        {groupes.map((g) => (
          <button
            key={g.id}
            onClick={() => actions.goWardrobePieces({ libelle: g.libelle, categories: g.categories })}
            aria-label={`${g.libelle} : ${g.nbPieces} ${g.nbPieces <= 1 ? "pièce" : "pièces"}`}
            className="flex-none text-left cursor-pointer active:opacity-80"
            style={{ width: "clamp(142px, calc((100% + 6px) / 2.35), 152px)", scrollSnapAlign: "start" }}
          >
            <div className="overflow-hidden rounded-carte" style={{ aspectRatio: "5 / 6", background: "var(--color-warm-bg)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={g.visuel}
                alt=""
                width={480}
                height={640}
                loading="lazy"
                decoding="async"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            {/* Légende éditoriale : 13 px pour que « Robes & combinaisons »
                tienne sur une ligne dès 360 px de large (mesuré : 138 px pour
                une carte de 142, marges comprises). Seul « Pantalons, jeans & shorts » (153 px)
                passe à la ligne, après la virgule — l'espace
                insécable après « & » l'empêche de finir une ligne. La seconde
                ligne n'est réservée que si ce libellé est dans le carrousel :
                les compteurs restent alignés sans vide inutile ailleurs. */}
            <div
              className="font-serif text-ink mt-[10px] px-[2px]"
              style={{ fontSize: 13, lineHeight: 1.25, minHeight: libellesLongs ? "2.5em" : undefined, textWrap: "balance" }}
            >
              {g.libelle.replace(/ & /g, " &\u00a0")}
            </div>
            <div className="text-[11px] text-muted mt-[2px] px-[2px]">
              {g.nbPieces} {g.nbPieces <= 1 ? "pièce" : "pièces"}
            </div>
          </button>
        ))}
      </div>

      {/* ── MES LOOKS ─ « + Créer » dans l'en-tête, puis un carrousel. */}
      <TitreSection
        action={
          <Lien onClick={() => actions.goCreateLook()} label="Créer un nouveau look">
            {PLUS}
            Créer
          </Lien>
        }
      >
        Mes looks
      </TitreSection>

      {state.savedLooks.length === 0 ? (
        <div className="text-[13px] leading-[1.55] mt-3" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
          Compose tes tenues préférées et retrouve-les ici.
        </div>
      ) : (
        <>
          <div className="mt-4">
            <SegmentedControl segments={ONGLETS_LOOKS} actif={filtreLooks} onChange={setFiltreLooks} ariaLabel="Filtrer mes looks" />
          </div>
          {looks.length === 0 ? (
            <div className="text-[12px] text-muted leading-[1.5] mt-4">Aucun look dans cette catégorie pour l&apos;instant.</div>
          ) : (
            /* ~1,5 carte visible : (largeur + 10 px) / 1,5 — la moitié de la
               suivante suggère le geste. Seul ce conteneur défile en largeur. */
            <div
              data-carrousel="looks"
              className="scrollarea flex gap-[14px] overflow-x-auto mt-5 -mx-6 px-6 pb-[2px]"
              style={{ scrollPaddingInline: 24, scrollSnapType: "x proximity" }}
            >
              {looks.slice(0, LOOKS_CARROUSEL).map((look) => {
                const pieces = look.pieceIds
                  .map((id) => resolvePool.find((i) => i.id === id))
                  .filter((it): it is Item => Boolean(it));
                return (
                  <div key={look.id} className="flex-none flex" style={{ width: "calc((100% + 10px) / 1.5)", scrollSnapAlign: "start" }}>
                    <CarteLook
                      look={look}
                      pieces={pieces}
                      porte={lookWornCount(look, state.history)}
                      suggere={isWishlistLook(look)}
                      onOuvrir={() => actions.openLook(look.id)}
                      compacte
                    />
                  </div>
                );
              })}
              {/* « Voir tout → » au bout du carrousel : le même lien qu'avant,
                  déplacé — l'écran « Mes looks » garde tous les looks et le
                  filtre des looks suggérés. */}
              <div className="flex-none flex items-center pr-2" style={{ minHeight: 120 }}>
                <Lien onClick={actions.goLooks} label="Voir tous mes looks">
                  Voir tout →
                </Lien>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ✦ À DÉCOUVRIR ─ le pont vers ce que Capsela peut faire avec ce
             dressing. Jamais une vitrine : aucune pièce à acheter ici. */}
      {aDecouvrir && (
        <div className="mt-10 rounded-hero px-5 py-[18px]" style={{ background: "var(--color-warm-bg)" }}>
          <div className="t-surtitre text-terracotta">{aDecouvrir.cas === "associations" ? "✦ Une idée pour ton dressing" : "✦ À découvrir"}</div>
          {aDecouvrir.cas === "associations" && (
            <>
              <div className="t-titre-section text-ink mt-2">
                Ton dressing peut <span className="italic text-terracotta">déjà faire plus</span>
              </div>
              {/* « avec tes pièces » revient (27/09/2026) : c'est ce qui dit
                  que l'association est faite de SES pièces — vrai, le pool
                  est le dressing seul (cf. tenuesMoteur). */}
              <div className="text-[13px] leading-[1.55] mt-1" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
                Capsela a trouvé {aDecouvrir.nombre === 1 ? "une nouvelle association" : `${aDecouvrir.nombre} nouvelles associations`} avec
                tes pièces.
              </div>
              <AssociationsDressing tenues={tenuesMoteur} dressing={items} onOuvrir={ouvrirTenue} />
            </>
          )}
          {aDecouvrir.cas === "proche_limite" && (
            <>
              <div className="t-titre-section text-ink mt-3">
                Tu as déjà {aDecouvrir.nbPieces} <span className="italic text-terracotta">pièces</span>
              </div>
              <div className="text-[13px] leading-[1.55] mt-[6px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
                Découvre de nouvelles façons de les porter.
              </div>
              {tenuesMoteur.length > 0 ? (
                <AssociationsCompactes tenues={tenuesMoteur} onOuvrir={ouvrirTenue} />
              ) : (
                <div className="mt-4">
                  <Lien onClick={actions.goTenues}>Découvrir ma tenue du jour →</Lien>
                </div>
              )}
            </>
          )}
          {aDecouvrir.cas === "manque" && (
            <>
              <div className="t-titre-section text-ink mt-3">
                Une pièce pourrait ouvrir <span className="italic text-terracotta">de nouveaux looks</span>
              </div>
              <div className="text-[13px] leading-[1.55] mt-[6px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
                Découvre les essentiels qui compléteraient ton vestiaire.
              </div>
              <div className="mt-4">
                <Lien onClick={actions.goCapsule}>Découvrir ma capsule →</Lien>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
