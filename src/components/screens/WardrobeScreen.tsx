"use client";

import { useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import LoadingSpinner from "@/components/LoadingSpinner";
import SegmentedControl, { type Segment } from "@/components/SegmentedControl";
import { useAuth } from "@/lib/auth";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { CATS, OCC_LABELS } from "@/lib/data";
import { generateOutfitWithFallback } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";
import { inactivityInfo, isWishlistLook, lookWornCount, neverWornItems } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";
import type { Item, OccasionKey, SavedLook } from "@/lib/types";
import { placesRestantes } from "@/lib/premium";

/**
 * DRESSING — refonte de présentation, maquette du 23/09/2026.
 *
 * L'écran répond maintenant à quatre questions dans cet ordre, et c'est tout
 * ce qui a changé : voici ce que je possède, voici mes looks, voici ce que
 * Capsela me suggère, voici ce que je peux faire maintenant.
 *
 * AUCUNE LOGIQUE MÉTIER N'EST TOUCHÉE. Les six dérivations de cet écran sont
 * reprises à l'identique de la version précédente, y compris leurs correctifs :
 *
 *   - les pièces affichées restent `state.items` SEUL (dressing réel) ; les
 *     suggestions vivent sur l'écran Capsule ;
 *   - les looks restent résolus sur `[...items, ...vestiairePool]` et jamais
 *     sur `wardrobePool` — correctif du 20/08/2026 : un look enregistré
 *     pendant l'exploration d'un autre style référence des suggestions
 *     absentes de wardrobePool une fois revenue au style normal, d'où le
 *     « 0 pièces » constaté ;
 *   - « jamais portées » reste `neverWornItems` (worn == null), et son second
 *     niveau de message reste conditionné par `inactivityInfo` ;
 *   - « porté / non porté » reste dérivé de l'historique via `lookWornCount`,
 *     jamais d'un compteur séparé et désynchronisable ;
 *   - une pièce suggérée reste reconnue par `isCatalogId`.
 *
 * CE QUI CHANGE, ET POURQUOI :
 *
 *   Les catégories et les looks passent en défilement horizontal. La page
 *   tenait sur une grille à deux colonnes qui s'allongeait avec le dressing :
 *   « Mes looks » finissait sous une liste de catégories, et le CTA final
 *   hors d'atteinte. Chaque carrousel est borné à son conteneur (cf. la note
 *   sur `-mx-6` plus bas).
 *
 *   Les filtres de looks deviennent de vrais onglets (SegmentedControl) au
 *   lieu de quatre pastilles défilantes. Le QUATRIÈME filtre, « Wishlist »,
 *   quitte la barre — la maquette en a trois — mais RESTE ATTEIGNABLE par le
 *   module « Capsela te suggère », exactement comme avant : aucune
 *   fonctionnalité perdue, une barre lisible en échange.
 *
 *   Les vignettes de pièces d'un look passent de quatre colonnes minuscules à
 *   une grille 2×2 : demandé, et c'est ce qui rend une pièce reconnaissable.
 *
 * TROIS POINTS DE LA MAQUETTE NON REPRIS, arbitrés avant écriture :
 *
 *   1. Le cœur sur chaque carte de look. Aucune action ne permet de
 *      dé-enregistrer un look quelconque — `toggleSaveOutfitLook` ne porte que
 *      sur la tenue du jour, `deleteActiveLook` exige le look ouvert. Ce cœur
 *      serait donc une suppression définitive, sans annulation, à un tap dans
 *      une zone de défilement. Le badge reste en LECTURE SEULE ; supprimer un
 *      look reste dans son écran de détail, où c'est délibéré.
 *   2. Le menu « ⋯ » de la carte : aucune destination existante, et la carte
 *      ouvre déjà le détail du look, qui porte ces actions.
 *   3. « Mes looks · Voir tout → » : il n'existe pas d'écran « tous mes
 *      looks ». Plutôt qu'un lien mort, le carrousel porte TOUS les looks
 *      filtrés — la page reste courte, aucun look n'est inaccessible.
 *
 * Les deux CTA que la maquette met en #9E5B43 restent en
 * --color-terracotta : 27 boutons de l'application y sont, terracotta-deep
 * ne sert qu'à deux grandes surfaces (même arbitrage que l'écran « Demander
 * un avis »).
 */

type LookFilter = "all" | "saved" | "created" | "wishlist";

/** Les deux occasions des idées d'inspiration — distinctes, pour que les deux cartes ne se ressemblent pas. */
const OCCASIONS_INSPIRATION: OccasionKey[] = ["quotidien", "travail_formel"];

const PLUS = (
  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const ETINCELLE = (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path
      d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>
);
const COEUR = (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block" }}>
    <path
      d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
const AMPOULE = (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ display: "block", flexShrink: 0 }}>
    <path
      d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Surtitre de section, avec son action facultative à droite. */
function TitreSection({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-[10px] mt-7">
      <div className="text-[11px] tracking-[.16em] uppercase text-muted">{children}</div>
      {action}
    </div>
  );
}

/**
 * Visuel d'une pièce, ou l'aplat de sa couleur dominante quand elle n'en a
 * pas — même repli que partout ailleurs, jamais un trou.
 *
 * `alt` est OBLIGATOIRE et non vide pour un vêtement : ces images portent
 * l'information (c'est la pièce). Les cas réellement décoratifs passent une
 * chaîne vide explicitement.
 */
function VisuelPiece({ piece, alt, radius }: { piece: Item; alt: string; radius: number }) {
  const img = resolveItemImage(piece);
  return (
    <div
      className="w-full h-full overflow-hidden"
      style={{ borderRadius: radius, background: img.url ? "var(--color-cream)" : piece.hex }}
    >
      {img.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          loading="lazy"
          src={img.url}
          alt={alt}
          style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
        />
      )}
    </div>
  );
}

/**
 * Pilule d'action pleine largeur — celle des modules de la maquette.
 *
 * `sur` n'est pas une coquetterie : la pilule doit contraster avec la surface
 * qui la porte, et les deux surfaces diffèrent. Capturé avant correction, une
 * pilule `card` posée sur un module `card` était littéralement invisible —
 * seul son texte et sa flèche se voyaient, comme un lien flottant.
 */
function PiluleAction({
  onClick,
  children,
  sur,
}: {
  onClick: () => void;
  children: React.ReactNode;
  sur: "warm" | "card";
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 rounded-full px-4 text-[12.5px] font-semibold text-ink cursor-pointer active:opacity-80"
      style={{ minHeight: 44, background: sur === "warm" ? "var(--color-card)" : "var(--color-cream)" }}
    >
      {children}
      <span aria-hidden="true">→</span>
    </button>
  );
}

export default function WardrobeScreen() {
  const { state, actions, vestiairePool, defaultCapsule, weather, dressingLoaded, etatPremium } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const [lookFilter, setLookFilter] = useState<LookFilter>("all");

  // Pool de résolution stable des looks — cf. l'en-tête, correctif 20/08/2026.
  const resolvePool = useMemo(() => [...items, ...vestiairePool], [items, vestiairePool]);
  const neverWorn = useMemo(() => neverWornItems(items), [items]);

  // Le dressing n'affiche que les pièces réelles ; les suggestions de la
  // capsule par défaut vivent exclusivement sur l'écran Capsule.
  const groups = useMemo(
    () =>
      CATS.map(([key, , plural]) => ({ key, label: plural, items: items.filter((i) => i.cat === key) })).filter(
        (g) => g.items.length > 0
      ),
    [items]
  );

  const { savedCount, createdCount, wishlistCount } = useMemo(
    () => ({
      savedCount: state.savedLooks.filter((l) => l.source === "saved").length,
      createdCount: state.savedLooks.filter((l) => l.source === "created").length,
      wishlistCount: state.savedLooks.filter(isWishlistLook).length,
    }),
    [state.savedLooks]
  );

  const filteredLooks = useMemo(() => {
    const matches = (l: SavedLook) =>
      lookFilter === "all" ||
      (lookFilter === "saved" && l.source === "saved") ||
      (lookFilter === "created" && l.source === "created") ||
      (lookFilter === "wishlist" && isWishlistLook(l));
    return state.savedLooks.filter(matches);
  }, [state.savedLooks, lookFilter]);

  /**
   * Deux idées de tenues pour le dressing vide.
   *
   * TIRÉES UNE SEULE FOIS, et c'est le point : `generateOutfitWithFallback`
   * tire au hasard à CHAQUE appel — appelées au fil du rendu, les deux cartes
   * changeraient au moindre re-rendu, ce qui se lit comme un bug. Le mémo est
   * clé sur la capsule, la météo et le profil : elles ne bougent donc que si
   * leur source bouge réellement.
   *
   * Le moteur n'est pas modifié, seulement appelé — avec exactement les mêmes
   * arguments que l'écran Tenue. Et seulement quand le dressing est vide :
   * `enabled` court-circuite le calcul dès qu'il y a une pièce.
   */
  const inspirations = useMemo(() => {
    if (items.length > 0 || defaultCapsule.length === 0) return [];
    return OCCASIONS_INSPIRATION.map((occasion) => {
      const r = generateOutfitWithFallback(
        defaultCapsule,
        weather,
        occasion,
        state.workMode,
        state.dateContext,
        paletteHexes(profile),
        profile.gender
      );
      const pieces = r.ids
        .map((id) => defaultCapsule.find((i) => i.id === id))
        .filter((it): it is Item => Boolean(it));
      return { occasion, pieces };
    }).filter((i) => i.pieces.length > 0);
  }, [items.length, defaultCapsule, weather, state.workMode, state.dateContext, profile]);

  const nbCat = groups.length;
  /**
   * Le compteur annonce les places restantes UNIQUEMENT quand une limite
   * s'applique réellement — jamais en Premium, jamais tant que le droit n'a
   * pas pu être vérifié. `placesRestantes` rend null dans ces deux cas, et
   * c'est ce null qui décide, pas un test refait ici.
   *
   * À zéro place, le compteur ne dit pas « 0 restante » : un zéro annoncé
   * comme un résultat est le défaut déjà corrigé deux fois cette semaine. Il
   * dit ce qui est vrai — le dressing est complet.
   */
  const restantes = placesRestantes(etatPremium, items.length);
  const dressingPlein = restantes === 0;
  const compteur =
    `${nbCat} ${nbCat <= 1 ? "catégorie" : "catégories"} · ${items.length} ${items.length <= 1 ? "pièce" : "pièces"}` +
    (restantes == null ? "" : dressingPlein ? " · dressing complet" : ` · ${restantes} de libre`);

  const enTete = (
    <>
      <AppHeader />
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[14px]">Ton dressing</div>
      {/* Une seule ligne (24/09/2026, demandé), taille inchangée : le <br />
          forcé est retiré, le titre coule. S'il ne tient pas sur un écran
          très étroit, il se coupe de lui-même là où la ligne le demande —
          c'est un repli, pas une mise en page imposée. */}
      <div className="font-serif text-[27px] leading-[1.12] text-ink mt-[6px]" style={{ textWrap: "balance" }}>
        Ton vestiaire, <span className="italic text-terracotta">tes looks</span>
      </div>
      <div className="flex items-center justify-between gap-[10px] mt-3">
        <div className="text-[12px] text-muted">{dressingLoaded ? compteur : " "}</div>
        {/* Libellé explicite plutôt qu'un « + » nu : demandé, et un bouton
            d'ajout sans mot ne dit pas ce qu'il ajoute sur un écran qui
            contient aussi des looks. Plein quand le dressing existe,
            détouré quand l'écran a déjà un CTA d'ajout dominant plus bas —
            deux boutons pleins de même intention se concurrenceraient. */}
        {/* Plein : le bouton mène à Premium au lieu d'ouvrir un formulaire
            qui refuserait d'enregistrer à la fin. Un refus à la sauvegarde,
            après avoir photographié et renseigné une pièce, coûte bien plus
            qu'un détour annoncé d'avance. */}
        <button
          onClick={dressingPlein ? actions.goPremium : actions.openAdd}
          aria-label={dressingPlein ? "Dressing complet — découvrir Premium" : "Ajouter une pièce à mon dressing"}
          className={
            "flex items-center gap-[6px] rounded-full px-[14px] text-[12.5px] whitespace-nowrap flex-shrink-0 cursor-pointer " +
            (items.length > 0
              ? "bg-terracotta active:bg-terracotta-hover text-cream"
              : "bg-card border border-border text-terracotta")
          }
          style={{ minHeight: 40 }}
        >
          {!dressingPlein && PLUS}
          {dressingPlein ? "Dressing complet" : "Ajouter une pièce"}
        </button>
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

        {/* UNE SEULE action dominante : demandé, et c'est ce qui manquait —
            l'écran proposait « Ajouter une pièce », « Découvre ta capsule »
            et le bouton d'en-tête au même niveau de poids. */}
        <div className="mt-[18px] bg-card border border-border rounded-[24px] overflow-hidden">
          {/* Visuel d'accueil, livré le 23/09 — la maquette le prévoyait, il
              manquait. Ratio 1,548 tenu par aspect-ratio plutôt que par une
              hauteur fixe : la card étant pleine largeur, l'image n'est JAMAIS
              rognée, elle se met à l'échelle. Dimensions déclarées pour que la
              card ne saute pas à l'arrivée de l'image. */}
          <div style={{ aspectRatio: "1.548", background: "var(--color-warm-bg)" }}>
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
          <div className="p-[18px]">
          <div className="font-serif text-[24px] leading-[1.15] text-ink">
            Ton dressing <span className="italic text-terracotta">commence ici</span>
          </div>
          <div className="text-[13px] leading-[1.55] mt-2" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
            Ajoute quelques pièces que tu portes vraiment. Une photo suffit pour commencer.
          </div>
          <button
            onClick={actions.openAdd}
            className="w-full flex items-center justify-center gap-2 mt-4 rounded-full bg-terracotta active:bg-terracotta-hover text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer"
            style={{ minHeight: 52 }}
          >
            {PLUS}
            Ajouter ma première pièce
          </button>
          <div className="flex gap-[10px] items-start mt-[14px] bg-cream rounded-[14px] px-[13px] py-[11px]">
            <span className="text-terracotta">{AMPOULE}</span>
            <div className="text-[12px] leading-[1.5]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
              Pas besoin d&apos;ajouter toute ta garde-robe. Commence avec 5 à 10 pièces que tu portes souvent.
            </div>
          </div>
          </div>
        </div>

        {/* Secondaire, et visiblement secondaire : bord pointillé, pas de
            remplissage — le même trait qui signale partout ce qui vient de
            Capsela plutôt que du dressing. */}
        <div
          className="mt-[14px] bg-card rounded-[20px] p-4"
          style={{ border: "1px dashed var(--color-sand-border)" }}
        >
          <div className="flex items-center gap-2 text-terracotta">
            {ETINCELLE}
            <div className="font-serif text-[18px] text-ink">Déjà envie d&apos;inspiration ?</div>
          </div>
          <div className="text-[12.5px] leading-[1.5] mt-[6px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
            Découvre ta capsule personnalisée et quelques idées de looks, même sans pièces dans ton dressing.
          </div>
          <div className="mt-[10px]">
            <PiluleAction onClick={actions.goCapsule} sur="card">Découvrir ma capsule</PiluleAction>
          </div>
        </div>

        {inspirations.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-[26px] text-terracotta">
              {ETINCELLE}
              <div className="font-serif text-[18px] text-ink">Pour commencer</div>
            </div>
            <div className="text-[12px] text-muted mt-1">Quelques idées de tenues inspirées de ton style.</div>
            <div className="grid grid-cols-2 gap-[10px] mt-3">
              {inspirations.map(({ occasion, pieces }) => (
                <div
                  key={occasion}
                  className="bg-card rounded-[20px] overflow-hidden"
                  style={{ border: "1px dashed var(--color-sand-border)" }}
                >
                  <div className="grid grid-cols-2 gap-[2px] p-[6px]" style={{ background: "var(--color-warm-bg)" }}>
                    {pieces.slice(0, 4).map((p) => (
                      <div key={p.id} style={{ aspectRatio: "1" }}>
                        <VisuelPiece piece={p} alt={p.name} radius={10} />
                      </div>
                    ))}
                  </div>
                  <div className="px-3 pt-[10px] pb-3">
                    <div className="font-serif text-[14px] leading-[1.25] text-ink">{OCC_LABELS[occasion]}</div>
                    <div className="text-[10.5px] text-terracotta mt-1">Idée Capsela</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── DRESSING REMPLI ──────────────────────────────────────────────────
  const onglets: Segment<LookFilter>[] = [
    { key: "all", label: `Tous (${state.savedLooks.length})` },
    { key: "saved", label: `Enregistrés (${savedCount})`, icone: COEUR },
    { key: "created", label: `Créés (${createdCount})`, icone: ETINCELLE },
  ];

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {enTete}

      {/* ── JAMAIS PORTÉES ─ affiché SEULEMENT s'il y en a réellement. ─── */}
      {neverWorn.length > 0 &&
        (() => {
          // Deux niveaux, repris tels quels : par défaut une invitation à les
          // essayer ; seulement lorsque TOUTES sont aussi détectées inactives
          // (saisonnièrement significatif) le message devient plus pressant.
          const allInactive = neverWorn.every((it) => inactivityInfo(it).inactive);
          const pluriel = neverWorn.length > 1;
          const apercu = neverWorn.slice(0, 3);
          return (
            <div
              className="mt-[18px] rounded-[24px] p-4"
              style={{ background: "var(--color-warm-bg)", border: "1px solid var(--color-sand-border)" }}
            >
              <div className="flex gap-3 items-center">
                {/* Vraies images des pièces concernées, en éventail. */}
                <div className="flex flex-shrink-0">
                  {apercu.map((p, i) => (
                    <div
                      key={p.id}
                      style={{
                        width: 56,
                        height: 68,
                        marginLeft: i === 0 ? 0 : -14,
                        borderRadius: 12,
                        border: "2px solid var(--color-warm-bg)",
                        background: "var(--color-card)",
                        overflow: "hidden",
                      }}
                    >
                      <VisuelPiece piece={p} alt={p.name} radius={10} />
                    </div>
                  ))}
                </div>
                <div className="min-w-0">
                  <div className="font-serif text-[18px] leading-[1.2] text-ink">
                    {neverWorn.length}{" "}
                    {pluriel
                      ? allInactive
                        ? "pièces à redécouvrir"
                        : "pièces jamais portées"
                      : allInactive
                        ? "pièce à redécouvrir"
                        : "pièce jamais portée"}
                  </div>
                  <div
                    className="text-[12px] leading-[1.45] mt-1"
                    style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}
                  >
                    {allInactive
                      ? pluriel
                        ? "Tu ne les as pas portées pendant leur dernière saison."
                        : "Tu ne l'as pas portée pendant sa dernière saison."
                      : pluriel
                        ? "Et si c'était l'occasion de les essayer ?"
                        : "Et si c'était l'occasion de l'essayer ?"}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <PiluleAction onClick={actions.goNeverWorn} sur="warm">
                  {allInactive ? "Que faire avec ?" : "Voir les pièces"}
                </PiluleAction>
              </div>
            </div>
          );
        })()}

      {/* ── MES PIÈCES ─ un aperçu par catégorie, jamais la liste des pièces. */}
      <TitreSection
        action={
          <button
            onClick={actions.goWardrobePieces}
            aria-label="Voir toutes mes pièces"
            /* py/-my : la cible passe de 18 à 44 px sans déplacer la ligne de
               base du texte, donc sans désaligner le surtitre. Mesuré : 18 px
               était la plus petite cible de l'écran. */
            className="text-[12px] text-terracotta cursor-pointer flex-shrink-0 py-[13px] -my-[13px]"
          >
            Voir tout →
          </button>
        }
      >
        Mes pièces
      </TitreSection>
      {/* `-mx-6 px-6` : le carrousel touche les bords de l'écran, mais son
          débordement reste DANS son conteneur — la marge négative annule le
          rembourrage de page, le rembourrage interne rend la première et la
          dernière carte alignées sur le texte. Aucune barre horizontale
          globale ; vérifié en rendu aux quatre largeurs. */}
      <div className="scrollarea flex gap-[9px] overflow-x-auto mt-3 -mx-6 px-6">
        {groups.map((g) => (
          <button
            key={g.key}
            onClick={actions.goWardrobePieces}
            aria-label={`${g.label} : ${g.items.length} ${g.items.length <= 1 ? "pièce" : "pièces"}. Voir mes pièces`}
            className="flex-none bg-card border border-border rounded-[20px] text-left cursor-pointer active:opacity-80"
            style={{ width: 104, padding: "6px 6px 10px" }}
          >
            <div style={{ aspectRatio: "1", background: "var(--color-cream)", borderRadius: 15, overflow: "hidden" }}>
              <VisuelPiece piece={g.items[0]} alt="" radius={15} />
            </div>
            {/* Hauteur fixée à deux lignes : les libellés de CATS vont de
                « Sacs » à « Manteaux & extérieurs », et à 104 px de large les
                longs passent à la ligne. Sans cette hauteur, une carte sur
                deux dépassait ses voisines — vu en capture. */}
            <div
              className="font-serif text-[14px] text-ink mt-2 mx-1 leading-[1.2]"
              style={{ minHeight: "2.4em" }}
            >
              {g.label}
            </div>
            <div className="text-[10.5px] text-muted mt-[2px] mx-1">
              {g.items.length} {g.items.length <= 1 ? "pièce" : "pièces"}
            </div>
          </button>
        ))}
      </div>

      {/* ── MES LOOKS ───────────────────────────────────────────────────── */}
      <TitreSection
        action={
          state.savedLooks.length > 0 ? (
            <button
              onClick={() => actions.goCreateLook()}
              aria-label="Créer un nouveau look"
              className="text-[12px] text-terracotta cursor-pointer flex-shrink-0 py-[13px] -my-[13px]"
            >
              + Créer
            </button>
          ) : undefined
        }
      >
        Mes looks
      </TitreSection>
      <div className="text-[12px] text-muted mt-1">Tes looks enregistrés et créés par toi.</div>

      {state.savedLooks.length === 0 ? (
        <button
          onClick={() => actions.goCreateLook()}
          className="mt-3 w-full flex items-center justify-center gap-[9px] bg-card rounded-[20px] py-4 text-[13px] text-ink cursor-pointer active:opacity-80"
          style={{ border: "1.5px dashed var(--color-warm-border)" }}
        >
          <span className="text-terracotta">{PLUS}</span> Composer mon premier look
        </button>
      ) : (
        <>
          <div className="mt-3">
            <SegmentedControl
              segments={onglets}
              actif={lookFilter === "wishlist" ? "all" : lookFilter}
              onChange={setLookFilter}
              ariaLabel="Filtrer mes looks"
            />
          </div>

          {/* Le filtre « wishlist » n'a pas d'onglet — il est posé par le
              module « Capsela te suggère » ci-dessous. On le dit, sinon la
              liste paraîtrait filtrée sans raison visible. */}
          {lookFilter === "wishlist" && (
            <div className="flex items-center justify-between gap-2 mt-3 text-[12px]">
              <span className="text-muted">Looks contenant des pièces suggérées.</span>
              <button
                onClick={() => setLookFilter("all")}
                className="text-terracotta cursor-pointer flex-shrink-0 py-[13px] -my-[13px]"
              >
                Tout afficher
              </button>
            </div>
          )}

          {filteredLooks.length === 0 ? (
            <div className="text-[12.5px] text-muted leading-[1.5] mt-3">
              Aucun look dans cette catégorie pour l&apos;instant.
            </div>
          ) : (
            <div
              className="scrollarea flex gap-[10px] overflow-x-auto mt-3 -mx-6 px-6"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {filteredLooks.map((look) => {
                const pieces = look.pieceIds
                  .map((id) => resolvePool.find((i) => i.id === id))
                  .filter((it): it is Item => Boolean(it));
                const worn = lookWornCount(look, state.history);
                const date = new Date(look.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
                return (
                  <button
                    key={look.id}
                    onClick={() => actions.openLook(look.id)}
                    aria-label={`Look ${look.name}, ${pieces.length} ${pieces.length <= 1 ? "pièce" : "pièces"}, ${worn > 0 ? `porté ${worn} fois` : "non porté"}`}
                    className="flex-none bg-card border border-border rounded-[20px] p-2 text-left cursor-pointer active:opacity-80"
                    style={{ width: 250, scrollSnapAlign: "start" }}
                  >
                    {/* 2×2 plutôt que 4 colonnes : demandé, et c'est ce qui
                        rend une pièce reconnaissable. Quatre cases fixes —
                        une tenue de deux pièces garde la même hauteur de
                        carte qu'une tenue de quatre. */}
                    <div className="grid grid-cols-2 gap-[6px]">
                      {pieces.slice(0, 4).map((p) => {
                        const suggeree = isCatalogId(p.id);
                        return (
                          <div
                            key={p.id}
                            className="relative overflow-hidden"
                            style={{
                              aspectRatio: "1",
                              borderRadius: 13,
                              background: "var(--color-cream)",
                              // Une pièce suggérée n'est JAMAIS confondue avec
                              // une pièce possédée : trait pointillé + mention.
                              border: suggeree
                                ? "1.5px dashed var(--color-sand-border)"
                                : "1px solid var(--color-border)",
                            }}
                          >
                            <VisuelPiece piece={p} alt={p.name} radius={11} />
                            {suggeree && (
                              <span
                                className="absolute text-[9px] font-semibold tracking-[.04em] rounded-full"
                                style={{
                                  left: 6,
                                  bottom: 6,
                                  padding: "3px 7px",
                                  color: "var(--color-terracotta)",
                                  background: "var(--color-card)",
                                }}
                              >
                                Suggérée
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="px-1 pt-[10px] pb-[2px]">
                      <div className="font-serif text-[15px] text-ink leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap">
                        {look.name}
                      </div>
                      <div className="text-[11px] text-muted mt-[2px]">
                        {date} · {pieces.length} {pieces.length <= 1 ? "pièce" : "pièces"} ·{" "}
                        {worn > 0 ? `Porté ${worn} fois` : "Non porté"}
                      </div>
                      <div className="text-[10px] text-terracotta mt-[3px]">
                        {look.source === "saved" ? "♡ Enregistré" : "✦ Créé par moi"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── CAPSELA TE SUGGÈRE ─ affiché seulement s'il y a vraiment des
             looks concernés. Le module porte le filtre « wishlist ». ────── */}
      {wishlistCount > 0 && (
        <div
          className="mt-[22px] bg-card rounded-[20px] p-4"
          style={{ border: "1px dashed var(--color-sand-border)" }}
        >
          <div className="flex items-center gap-2 text-terracotta">
            {ETINCELLE}
            <div className="text-[11px] tracking-[.16em] uppercase">Capsela te suggère</div>
          </div>
          <div className="font-serif text-[18px] leading-[1.25] text-ink mt-2">
            {wishlistCount} {wishlistCount === 1 ? "look contient" : "looks contiennent"} des pièces suggérées
          </div>
          <div className="text-[12.5px] leading-[1.5] mt-[5px]" style={{ color: "var(--color-muted-3)", textWrap: "pretty" }}>
            Découvre des alternatives ou ajoute-les à ton dressing.
          </div>
          <div className="mt-3">
            <PiluleAction onClick={() => setLookFilter("wishlist")} sur="card">Voir les alternatives</PiluleAction>
          </div>
        </div>
      )}

      {/* ── CE QUE JE PEUX FAIRE MAINTENANT ─────────────────────────────── */}
      <button
        onClick={actions.goTenues}
        className="mt-[22px] w-full flex items-center justify-center rounded-full bg-terracotta active:bg-terracotta-hover text-cream text-[13px] tracking-[.1em] uppercase cursor-pointer"
        style={{ minHeight: 50 }}
      >
        Voir ma tenue du jour
      </button>
    </div>
  );
}
