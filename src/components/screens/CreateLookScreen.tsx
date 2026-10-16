"use client";

import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import BoutonRetour, { LienRetour } from "@/components/BoutonRetour";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { BAS_CATS, CATS, OCCASIONS, occasionShortLabel } from "@/lib/data";
import { FlatLayCapsela } from "@/components/FlatLayCapsela";
import { TuileIcone, type IconePlanifier } from "@/components/PlanifierUI";
import { contexteCapsule, estDeSaison, representativeWeatherFor } from "@/lib/capsule";
import { affiniteHumeur, humeursProposees, libelleHumeur } from "@/lib/humeur";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { fondPhotoPiece, resolveItemImage } from "@/lib/catalogImages";
import {
  CLOTHING_CATS,
  TOP_LAYER_CATS,
  applySportCocooningFilter,
  chemiseAmpleSurCombinaison,
  computeLookScore,
  evaluateBlocking,
  recentlyWorn,
} from "@/lib/logic";
import { rolePieceOf } from "@/lib/attributes";
import { paletteHexes } from "@/lib/profile";
import { colorimetrieMoteur } from "@/lib/colorimetrieMoteur";
import type { CapsuleSeason, CategoryKey, Item } from "@/lib/types";
import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Input from "@/components/Input";

/*
 * « CRÉER UN LOOK » — refonte du 26/09/2026, faite avec les briques déjà en
 * place ailleurs plutôt qu'avec de nouvelles :
 *
 *   · en-tête : celui des sous-écrans du Dressing (Mes pièces, Jamais
 *     portées) — BoutonRetour cerclé + titre de section ;
 *   · occasion : le chip et la feuille de l'écran Tenue, au lieu d'une
 *     rangée de dix pastilles qui occupait toute une ligne ;
 *   · « Ton look · N pièces » : le résumé devient le centre de l'écran —
 *     les pièces choisies, en vignettes, chacune retirable ;
 *   · pièces : la carte de « Mes pièces » (photo 4/5, arrondi 14, pastille
 *     de sélection), rangées dans le carrousel de « Mon vestiaire » ;
 *     « + Ajouter une robe » devient un lien en bout de rangée au lieu d'une
 *     tuile aussi grande qu'une pièce ;
 *   · « + Ajouter une pièce » : la feuille du bas (BottomSheet), catégorie
 *     puis pièces, pour choisir sans faire défiler tout le dressing ;
 *   · bouton principal : fixé au-dessus de la barre du bas, comme celui de
 *     la Capsule.
 *
 * Rien ne change dans les règles : mêmes filtres d'occasion, mêmes
 * incompatibilités (R-B5, jamais deux pièces de base), même score, même
 * enregistrement (saveLook), même minimum de deux pièces.
 *
 * PARCOURS EN ÉTAPES (15/10/2026, brief « Optimisation du parcours de création de look ») :
 *   1. contexte — occasion, saison, intention de style, en tuiles à icône (TuileIcone de Planifier, glyphes d'occasion), sans image ;
 *      l'occasion n'est plus dans une feuille. La saison règle la météo représentative passée au score et aux règles bloquantes
 *      (representativeWeatherFor, comme « Comment porter ») ; saison et intention RANGENT les pièces (estDeSaison, affiniteHumeur),
 *      sans en retirer aucune. Ni l'une ni l'autre n'est enregistrée : saved_looks n'a pas de colonne pour elles.
 *   2. pièces — l'écran d'avant, avec le contexte rappelé et modifiable, l'aperçu (FlatLayCapsela) et le remplacement d'une pièce
 *      en touchant sa vignette ;
 *   3. confirmation — seulement après l'écriture réelle (saveLook rend « ok ») ; un échec garde le brouillon.
 */

const TOP_BOTTOM_CATS = new Set(["haut", ...BAS_CATS, "jupe"]);

/** Libellé de la tuile "Ajouter..." en fin de grille (recette 24/08/2026) — distinct de CATLABEL (parfois composé, ex. "Veste / Blazer") pour rester une phrase naturelle avec le bon article. */
const ADD_TILE_LABEL: Record<CategoryKey, string> = {
  haut: "un haut",
  pull: "un pull",
  pantalon: "un pantalon",
  jean: "un jean",
  jupe: "une jupe",
  short: "un short",
  robe: "une robe",
  combinaison: "une combinaison",
  veste: "une veste",
  manteau: "un manteau",
  chaussures: "des chaussures",
  sac: "un sac",
  bijou: "un bijou",
  accessoire: "un accessoire",
};

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/** Catégories cible pour les liens "Voir les..." des conseils proactifs (recette 24/08/2026) — miroir de la logique de suggestion de logic.ts (R-S12/R-S13/R-S14), jamais une nouvelle règle. */
const PROACTIVE_TARGET_CATS: Record<string, { cats: CategoryKey[]; label: string }> = {
  layer: { cats: ["haut", "pull"], label: "Voir les hauts →" },
  color: { cats: ["bijou", "accessoire"], label: "Voir les accessoires →" },
  veste_soir: { cats: ["veste", "manteau"], label: "Voir les vestes →" },
};

/** Largeur des cartes de « Mon vestiaire » (Dressing) : deux cartes entières et le bord de la troisième. */
const LARGEUR_CARTE = "clamp(142px, calc((100% + 6px) / 2.35), 152px)";

/** Lien d'action discret du Dressing : terracotta, sans fond ni contour, cible de 44 px. */
const CLASSE_LIEN = "inline-flex items-center gap-[6px] text-[12px] text-terracotta cursor-pointer flex-shrink-0 py-[13px] -my-[13px] whitespace-nowrap";

/** Le visuel d'une pièce tel que « Mes pièces » le montre : sa photo en plein cadre, ou l'aplat de sa couleur. */
function PhotoPiece({ item, arrondi = 14, children }: { item: Item; arrondi?: number; children?: React.ReactNode }) {
  const image = resolveItemImage(item);
  return (
    <div
      className="relative w-full border border-border overflow-hidden"
      style={
        image.url
          ? { aspectRatio: "4/5", borderRadius: arrondi, ...fondPhotoPiece(image.url, image.kind === "detouree") }
          : { aspectRatio: "4/5", borderRadius: arrondi, background: item.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
      }
    >
      {children}
    </div>
  );
}

/** Pastille de sélection de « Mes pièces » : cercle vide, coche terracotta une fois choisie. */
function PastilleSelection({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-[8px] left-[8px] w-[22px] h-[22px] rounded-full border flex items-center justify-center text-[12px]"
      style={
        on
          ? { background: "rgba(166,105,80,.95)", borderColor: "rgba(166,105,80,.95)", color: "var(--color-cream)" }
          : { background: "rgba(243,238,229,.85)", borderColor: "rgba(29,26,22,.18)", color: "transparent" }
      }
    >
      ✓
    </span>
  );
}

/** Les quatre saisons du sélecteur, avec leur pictogramme (PlanifierUI) — la notion de saison du moteur (CapsuleSeason), aucune nouvelle. */
const SAISONS: { key: CapsuleSeason; icone: IconePlanifier }[] = [
  { key: "Printemps", icone: "printemps" },
  { key: "Été", icone: "ete" },
  { key: "Automne", icone: "automne" },
  { key: "Hiver", icone: "hiver" },
];

export default function CreateLookScreen() {
  const { state, actions } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const groupRefs = useRef<Partial<Record<CategoryKey, HTMLDivElement | null>>>({});
  const [feuille, setFeuille] = useState<null | "ajout">(null);
  const [categorieFeuille, setCategorieFeuille] = useState<CategoryKey | null>(null);
  const [nommer, setNommer] = useState(false);
  // LE PARCOURS (15/10/2026, brief « Optimisation du parcours de création de look ») : le contexte (occasion, saison, intention),
  // puis les pièces, puis la confirmation — sur le même écran, sans perdre le brouillon d'une étape à l'autre (il vit dans le store).
  const [etape, setEtape] = useState<"contexte" | "pieces" | "enregistre">("contexte");
  const [enregistrement, setEnregistrement] = useState<"repos" | "en_cours" | "erreur">("repos");
  const [apercu, setApercu] = useState(false);
  // La saison choisie, transmise au moteur comme le fait déjà « Comment porter » (representativeWeatherFor) : le score et les règles
  // bloquantes jugent le look pour CETTE saison, pas pour la météo du jour.
  const weather = representativeWeatherFor(state.lookDraftSaison);
  const contexteSaison = contexteCapsule(state.lookDraftSaison);
  const humeur = state.lookDraftHumeur;

  const draftPieces = state.lookDraftIds
    .map((id) => items.find((i) => i.id === id))
    .filter((it): it is Item => Boolean(it));
  const hasRobeOrCombi = draftPieces.some((i) => i.cat === "robe" || i.cat === "combinaison");
  const hasTopBottom = draftPieces.some((i) => TOP_BOTTOM_CATS.has(i.cat));
  const occasionDraft = OCCASIONS.find(([key]) => key === state.lookDraftOccasion);
  const occFormality = (occasionDraft || [])[3] || 0;
  const dressy = occFormality >= 3;

  // Brief design section 4 — "jamais 2 pièces base ensemble" : une 2e pièce
  // haut/pull n'est permise que si base+calque (ex. t-shirt + cardigan
  // oversize), jamais 2 pièces base (ex. 2 t-shirts). Repli si le dressing
  // ne contient aucune pièce calque dans ce groupe : bloquer indéfiniment
  // rendrait le layering totalement impossible pour cette utilisatrice.
  const topDraftBaseSelected = draftPieces.some((i) => TOP_LAYER_CATS.includes(i.cat) && rolePieceOf(i) === "base");
  const hasCalqueOption = items.some((i) => TOP_LAYER_CATS.includes(i.cat) && rolePieceOf(i) === "calque");

  // Brief design section 4 (correctif 22/08/2026) : liste blanche Sport
  // (R-B11) et exclusions Cocooning (R-B12/B13/B14) étendues au picker
  // manuel — jusqu'ici réservées au moteur de génération automatique.
  // Jamais relâchées, y compris si ça vide entièrement une catégorie (même
  // philosophie que côté génération auto : "jamais relâchée, même si le
  // pool résultant est restreint") — contrairement à l'anti-répétition et
  // aux baskets ci-dessous, qui ont un repli parce que ce sont des
  // préférences, pas des incompatibilités structurelles.
  const groups = CATS.map(([key, , plural]) => {
    const catItems = items.filter((i) => i.cat === key);
    const occasionOk = applySportCocooningFilter(catItems, state.lookDraftOccasion);
    let visible = CLOTHING_CATS.includes(key) ? occasionOk.filter((i) => !recentlyWorn(i)) : occasionOk;
    if (!visible.length) visible = occasionOk;
    if (key === "chaussures" && dressy) {
      const withoutBaskets = visible.filter((i) => i.shoeType !== "Baskets");
      if (withoutBaskets.length) visible = withoutBaskets;
    }
    // Rangement, jamais un filtre (15/10/2026) : d'abord les pièces de la saison choisie (estDeSaison, la règle de la capsule), puis,
    // à saison égale, celles qui répondent à l'intention (affiniteHumeur, la règle de Planifier). Aucune pièce n'est retirée.
    const rang = (i: Item) => (estDeSaison(i, contexteSaison) ? 0 : 2) + (humeur && affiniteHumeur([i], humeur) > 0 ? 0 : 1);
    visible = visible.map((i, n) => ({ i, n })).sort((a, b) => rang(a.i) - rang(b.i) || a.n - b.n).map(({ i }) => i);
    return { key, label: plural, items: visible };
  }).filter((g) => g.items.length > 0);

  // R-B5 — une robe/combinaison exclut haut/bas et réciproquement :
  // structurellement incompatibles, jamais juste une préférence de style —
  // retiré du picker. Brief design section 4 — "jamais 2 pièces base
  // ensemble" : une fois une pièce base du haut/pull sélectionnée, toute
  // autre pièce base du même groupe devient indisponible (repli si aucune
  // pièce calque n'existe dans le dressing, cf. ci-dessus).
  const estBloquee = (it: Item) => {
    if (state.lookDraftIds.includes(it.id)) return false;
    // Exception (16/10/2026) : une chemise ample se pose sur une combinaison sans manches, et réciproquement (chemiseAmpleSurCombinaison).
    const piecesUniques = draftPieces.filter((i) => i.cat === "robe" || i.cat === "combinaison");
    const hautsBas = draftPieces.filter((i) => TOP_BOTTOM_CATS.has(i.cat));
    const robeConflict =
      (TOP_BOTTOM_CATS.has(it.cat) && hasRobeOrCombi && !piecesUniques.every((u) => chemiseAmpleSurCombinaison(it, u))) ||
      ((it.cat === "robe" || it.cat === "combinaison") && hasTopBottom && !hautsBas.every((h) => chemiseAmpleSurCombinaison(h, it)));
    const baseLayerConflict = TOP_LAYER_CATS.includes(it.cat) && rolePieceOf(it) === "base" && topDraftBaseSelected && hasCalqueOption;
    return robeConflict || baseLayerConflict;
  };

  const dismissed = new Set(state.lookDraftDismissed || []);
  const lookScore = computeLookScore(
    draftPieces,
    state.lookDraftOccasion,
    paletteHexes(profile),
    profile.morphology,
    dismissed,
    weather,
    undefined,
    undefined,
    undefined,
    colorimetrieMoteur(profile.colorimetrie)
  );
  // R-B1 dit « pas de saison aujourd'hui » : ici, le look est jugé pour la saison CHOISIE — même règle, phrase qui la nomme.
  const blockingHits = evaluateBlocking(draftPieces, state.lookDraftOccasion, weather).map((h) =>
    h.id === "R-B1" ? { ...h, message: `Une pièce n'est pas vraiment de saison pour ${state.lookDraftSaison === "Été" ? "l'été" : state.lookDraftSaison === "Hiver" ? "l'hiver" : state.lookDraftSaison === "Automne" ? "l'automne" : "le printemps"}.` } : h
  );
  const hardBlocked = blockingHits.some((h) => h.hard);

  const count = state.lookDraftIds.length;
  const canSave = count >= 2 && !hardBlocked;
  const messageCta = count === 1 ? "Choisis au moins 2 pièces pour enregistrer ce look." : count >= 2 ? blockingHits.find((h) => h.hard)?.message : undefined;

  // "Voir les X →" (recette 24/08/2026, point 5) : scrolle vers la
  // catégorie déjà visible dans le picker si le dressing en contient, sinon
  // ouvre directement l'ajout pré-rempli sur cette catégorie (rien à
  // montrer sinon) — jamais une nouvelle destination, toujours ce même écran.
  const goToCategory = (cats: CategoryKey[]) => {
    for (const c of cats) {
      const el = groupRefs.current[c];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    actions.openAddForCategory(cats[0]);
  };

  const ouvrirAjout = () => {
    setCategorieFeuille(null);
    setFeuille("ajout");
  };
  const groupeFeuille = groups.find((g) => g.key === categorieFeuille) ?? null;
  // Dans la feuille, choisir une pièce la place dans le look et referme :
  // la pièce apparaît aussitôt dans « Ton look ». La retirer d'ici laisse la
  // feuille ouverte, pour en choisir une autre.
  const basculerDepuisFeuille = (id: number) => {
    const ajout = !state.lookDraftIds.includes(id);
    actions.toggleLookDraftPiece(id);
    if (ajout) setFeuille(null);
  };

  const humeurs = humeursProposees(profile.gender);
  const recapContexte = [
    occasionDraft ? occasionShortLabel(occasionDraft[0]) : "Sans occasion précise",
    state.lookDraftSaison,
    humeur ? libelleHumeur(humeur, profile.gender) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const ouvrirRemplacement = (cat: CategoryKey) => {
    setApercu(false);
    setCategorieFeuille(cat);
    setFeuille("ajout");
  };
  // L'enregistrement attend la base (saveLook) : jamais de confirmation avant, et un échec garde le brouillon tel quel.
  const enregistrer = async () => {
    setEnregistrement("en_cours");
    const r = await actions.saveLook();
    if (r === "ok") {
      setEnregistrement("repos");
      setEtape("enregistre");
    } else setEnregistrement(r === "erreur" ? "erreur" : "repos");
  };
  const paddingBas = { paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 112px)" };
  const piedFixe = {
    bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))",
    paddingBottom: 12,
    background: "linear-gradient(to top, var(--color-cream) 70%, rgba(243,238,229,0))",
  };

  // ── ÉTAPE 1 · LE CONTEXTE ─ occasion, saison, intention : les tuiles à icône de Planifier (TuileIcone), sans aucune image. Un dressing
  // vide n'a pas de contexte à régler : l'écran des pièces dit quoi faire.
  if (etape === "contexte" && items.length > 0) {
    return (
      <>
        <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]" style={paddingBas}>
          <div className="flex items-center gap-[14px] mt-[10px]">
            <BoutonRetour onClick={actions.cancelCreateLook} label="Annuler et revenir au dressing" className="flex-shrink-0" />
            <div className="t-titre-section text-ink">Créer un look</div>
          </div>
          <div className="t-chapeau text-muted mt-4">Pour quelle occasion, quelle saison, et avec quelle envie ?</div>

          <section aria-labelledby="look-occasion" className="mt-6">
            <div id="look-occasion" className="t-surtitre text-muted">
              1. Occasion <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {OCCASIONS.map(([key]) => (
                <TuileIcone
                  key={key}
                  glyphe={<GlypheOccasion occasion={key} taille={22} />}
                  label={occasionShortLabel(key)}
                  actif={state.lookDraftOccasion === key}
                  onClick={() => actions.setLookDraftOccasion(key)}
                  hauteur={76}
                />
              ))}
            </div>
          </section>

          <section aria-labelledby="look-saison" className="mt-7">
            <div id="look-saison" className="t-surtitre text-muted">2. Saison</div>
            <div className="text-[12.5px] text-ink-soft mt-[6px]">À quelle saison souhaites-tu porter ce look ?</div>
            <div role="group" aria-labelledby="look-saison" className="grid grid-cols-4 gap-2 mt-3">
              {SAISONS.map(({ key, icone }) => (
                <TuileIcone key={key} icone={icone} label={key} actif={state.lookDraftSaison === key} onClick={() => actions.setLookDraftSaison(key)} hauteur={76} />
              ))}
            </div>
          </section>

          <section aria-labelledby="look-intention" className="mt-7">
            <div id="look-intention" className="t-surtitre text-muted">
              3. Intention de style <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {humeurs.map(({ key, label }) => (
                <TuileIcone key={key} icone={key} label={label} actif={humeur === key} onClick={() => actions.setLookDraftHumeur(key)} hauteur={72} />
              ))}
            </div>
          </section>
        </div>
        <div className="absolute inset-x-0 z-10 px-6 pt-[14px] pointer-events-none" style={piedFixe}>
          <Button className="pointer-events-auto" onClick={() => setEtape("pieces")}>
            Commencer mon look
          </Button>
        </div>
      </>
    );
  }

  // ── ÉTAPE 5 · LA CONFIRMATION ─ seulement après l'écriture réelle (saveLook a rendu « ok »). Le look vient de la liste « Mes looks ».
  if (etape === "enregistre") {
    const look = state.savedLooks[0];
    const piecesLook = look ? look.pieceIds.map((id) => items.find((i) => i.id === id)).filter((it): it is Item => Boolean(it)) : [];
    return (
      <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]" style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 24px)" }}>
        <div className="flex items-center gap-[14px] mt-[10px]">
          <BoutonRetour onClick={actions.cancelCreateLook} label="Revenir au dressing" className="flex-shrink-0" />
          <div className="t-titre-section text-ink">Créer un look</div>
        </div>
        <div role="status" className="mt-6">
          <div className="t-titre-ecran text-ink">
            Ton look est <span className="italic text-terracotta">enregistré</span>
          </div>
          {look && <div className="t-chapeau text-muted mt-2">« {look.name} » t&apos;attend dans Mes looks.</div>}
        </div>
        {piecesLook.length > 0 && (
          // Le cadre de la carte d'idée de look (CarteIdeeLook) : la planche se pose dans une hauteur fixée, jamais au-dessus des boutons.
          <div className="relative mt-5 rounded-bloc bg-warm-bg overflow-hidden" style={{ height: "clamp(230px, 68vw, 290px)" }}>
            <FlatLayCapsela items={piecesLook} context="look-detail" layoutSeed={piecesLook.map((p) => p.id).join(",")} />
          </div>
        )}
        <Button className="mt-6" onClick={actions.goLooks}>
          Voir mes looks
        </Button>
        <Button
          variante="secondaire"
          className="mt-3"
          onClick={() => {
            actions.goCreateLook();
            setEtape("contexte");
          }}
        >
          Créer un autre look
        </Button>
        <button onClick={actions.cancelCreateLook} className="mt-2 w-full text-center text-[12px] text-muted min-h-[44px] cursor-pointer">
          Revenir au dressing
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]"
        // Réserve la barre du bas ET le bouton principal qui flotte au-dessus (même calcul que la Capsule).
        style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 112px)" }}
      >
        <div className="flex items-center gap-[14px] mt-[10px]">
          <BoutonRetour
            onClick={items.length > 0 ? () => setEtape("contexte") : actions.cancelCreateLook}
            label={items.length > 0 ? "Revenir au contexte du look" : "Annuler et revenir au dressing"}
            className="flex-shrink-0"
          />
          <div className="t-titre-section text-ink">Créer un look</div>
        </div>
        <div className="t-chapeau text-muted mt-4">Choisis les pièces de ton dressing à combiner.</div>

        {items.length === 0 ? (
          <Card rayon="tuile" className="mt-6 px-4 py-[18px] text-center text-[13px] text-muted leading-[1.5]">
            Ton dressing est encore vide — ajoute quelques pièces réelles pour pouvoir composer un look.
          </Card>
        ) : (
          <>
            {/* ── LE CONTEXTE ─ rappelé en une ligne, modifiable à tout moment (15/10/2026) : le brouillon de pièces est gardé. */}
            <div className="mt-5 flex items-center justify-between gap-3 bg-warm-bg border border-warm-border rounded-bloc pl-4 pr-3 py-[10px]">
              <div className="flex items-center gap-[8px] min-w-0 text-[12.5px] text-ink">
                {occasionDraft && (
                  <span className="text-terracotta flex-shrink-0">
                    <GlypheOccasion occasion={occasionDraft[0]} />
                  </span>
                )}
                <span className="truncate">{recapContexte}</span>
              </div>
              <button onClick={() => setEtape("contexte")} className={CLASSE_LIEN} aria-label={`Modifier le contexte du look : ${recapContexte}`}>
                Modifier
              </button>
            </div>

            {/* ── TON LOOK ─ les pièces choisies, en vignettes : le look tel
                   qu'il sera enregistré. Chacune se retire d'un tap. */}
            <div className="flex items-baseline justify-between gap-[10px] mt-8">
              <div className="t-surtitre text-muted whitespace-nowrap">
                Ton look{count > 0 && ` · ${count} ${count > 1 ? "pièces" : "pièce"}`}
              </div>
              <div className="flex items-center gap-4">
                {count > 0 && (
                  <button onClick={() => setApercu(true)} aria-haspopup="dialog" className={CLASSE_LIEN}>
                    Aperçu
                  </button>
                )}
                <button onClick={ouvrirAjout} aria-haspopup="dialog" className={CLASSE_LIEN}>
                  + Ajouter une pièce
                </button>
              </div>
            </div>
            <div className="scrollarea flex items-start gap-[10px] overflow-x-auto mt-3 -mx-6 px-6 pt-[2px] pb-[2px]" aria-label="Pièces de ton look">
              {draftPieces.map((it) => (
                <div key={it.id} className="flex-none w-[84px] motion-safe:animate-[capsule-apparition_220ms_ease-out_both]">
                  <div className="relative">
                    {/* Toucher la pièce la remplace : la feuille s'ouvre sur sa catégorie, le reste du look ne bouge pas. */}
                    <button onClick={() => ouvrirRemplacement(it.cat)} aria-haspopup="dialog" aria-label={`Remplacer ${it.name}`} className="block w-full cursor-pointer">
                      <PhotoPiece item={it} arrondi={12} />
                    </button>
                    <button
                      onClick={() => actions.toggleLookDraftPiece(it.id)}
                      aria-label={`Retirer ${it.name} du look`}
                      className="absolute -top-[6px] -right-[6px] w-11 h-11 flex items-start justify-end p-[10px] cursor-pointer"
                    >
                      <span
                        aria-hidden="true"
                        className="w-[22px] h-[22px] rounded-full border flex items-center justify-center text-[10px] text-ink"
                        style={{ background: "rgba(243,238,229,.92)", borderColor: "rgba(29,26,22,.18)" }}
                      >
                        ✕
                      </span>
                    </button>
                  </div>
                  <div className="text-[11px] text-muted mt-[6px] leading-[1.25] truncate">{it.name}</div>
                </div>
              ))}
              <button onClick={ouvrirAjout} aria-label="Ajouter une pièce au look" aria-haspopup="dialog" className="flex-none w-[84px] text-left cursor-pointer">
                <span
                  className="flex items-center justify-center rounded-champ border-[1.5px] border-dashed border-[#d6c7ae] bg-card"
                  style={{ aspectRatio: "4/5" }}
                >
                  <span className="w-9 h-9 rounded-full bg-cream border border-border text-terracotta flex items-center justify-center">
                    <PlusIcon />
                  </span>
                </span>
              </button>
              {count === 0 && (
                <div className="flex-1 min-w-[140px] self-center text-[12px] text-muted leading-[1.5] pr-2">
                  Choisis une première pièce, ici ou dans les rangées ci-dessous.
                </div>
              )}
            </div>

            {/* Sous les vignettes plutôt que dans l'en-tête : à côté du
                compte et de « + Ajouter une pièce », la ligne débordait. */}
            {count >= 2 && lookScore.badge === "recommande" && (
              <div className="mt-3">
                <Badge tone="succes" taille="s">Recommandé</Badge>
              </div>
            )}

            {/* Conseils Capsela (recette 24/08/2026, points 4/5) — jamais avant 2
                pièces sélectionnées (rien de pertinent à évaluer avant), et
                actionnables via un lien "Voir les...". Placés sous le look
                qu'ils commentent, en retrait : ils ne passent jamais devant. */}
            {count >= 2 && lookScore.badge === "ajuster" && lookScore.adjustMessage && (
              <div className="mt-4 bg-warm-bg border border-warm-border rounded-bloc px-4 py-[13px]">
                <div className="text-[12px] text-ink-soft leading-[1.45]">{lookScore.adjustMessage}</div>
              </div>
            )}

            {count >= 2 &&
              lookScore.proactives.map((p) => {
                const target = PROACTIVE_TARGET_CATS[p.key];
                return (
                  <Card rayon="bloc" className="relative mt-3 flex items-start gap-[11px] px-4 py-[14px]" key={p.key}>
                    <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
                    <div className="flex-1 min-w-0 pr-[18px]">
                      {p.key === "layer" && <div className="t-label text-terracotta mb-[6px]">Layering</div>}
                      <div className="text-[12px] text-ink-soft leading-[1.45]">{p.text}</div>
                      {target && (
                        <button onClick={() => goToCategory(target.cats)} className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer">
                          {target.label}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => actions.dismissLookDraftSuggestion(p.key)}
                      aria-label="Ignorer ce conseil"
                      className="absolute top-[10px] right-[10px] w-5 h-5 rounded-full flex items-center justify-center text-[12px] text-placeholder cursor-pointer"
                    >
                      ✕
                    </button>
                  </Card>
                );
              })}

            {blockingHits.length > 0 && (
              <div className="mt-3 bg-warm-bg border border-warm-border rounded-bloc px-4 py-[13px]">
                <div className="text-[12px] text-ink-soft leading-[1.45]">{blockingHits[0].message}</div>
              </div>
            )}

            {/* ── LES PIÈCES DU DRESSING ─ une rangée par catégorie, les
                   cartes de « Mes pièces » ; l'ajout d'une nouvelle pièce en
                   bout de rangée, en lien. */}
            {groups.map((g) => (
              <div key={g.key} ref={(el) => { groupRefs.current[g.key] = el; }} className="mt-8" style={{ scrollMarginTop: 12 }}>
                <div className="t-groupe text-ink">
                  {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
                </div>
                <div className="scrollarea flex items-start gap-[12px] overflow-x-auto mt-3 -mx-6 px-6 pb-[2px]" style={{ scrollPaddingInline: 24, scrollSnapType: "x proximity" }}>
                  {g.items.map((it) => {
                    const on = state.lookDraftIds.includes(it.id);
                    const blocked = estBloquee(it);
                    return (
                      <button
                        key={it.id}
                        onClick={() => !blocked && actions.toggleLookDraftPiece(it.id)}
                        disabled={blocked}
                        aria-pressed={on}
                        className={"flex-none text-left " + (blocked ? "cursor-not-allowed" : "cursor-pointer")}
                        style={{ width: LARGEUR_CARTE, scrollSnapAlign: "start", opacity: blocked ? 0.3 : 1 }}
                      >
                        <PhotoPiece item={it}>
                          <PastilleSelection on={on} />
                        </PhotoPiece>
                        <div className="text-[13px] text-ink mt-[8px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">{it.name}</div>
                      </button>
                    );
                  })}
                  <div className="flex-none flex items-center pr-2" style={{ minHeight: 120, alignSelf: "stretch" }}>
                    <button onClick={() => actions.openAddForCategory(g.key)} className={CLASSE_LIEN}>
                      + Ajouter {ADD_TILE_LABEL[g.key]}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {/* ── NOM DU LOOK ─ facultatif : un lien, puis le champ d'origine.
                   Sans nom, saveLook garde « Look du JJ/MM ». */}
            <div className="flex items-baseline justify-between gap-[10px] mt-10">
              <div className="t-surtitre text-muted">
                Nom du look <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
              </div>
              {!nommer && !state.lookDraftName && (
                <button onClick={() => setNommer(true)} className={CLASSE_LIEN}>
                  Donner un nom →
                </button>
              )}
            </div>
            {(nommer || state.lookDraftName) && (
              <Input
                className="mt-3"
                value={state.lookDraftName}
                onChange={(e) => actions.setLookDraftName(e.target.value)}
                placeholder="ex. Look bureau"
                aria-label="Nom du look"
                // Ouvert à la demande : le champ prend la main tout de suite.
                autoFocus={nommer && !state.lookDraftName}
              />
            )}
          </>
        )}
      </div>

      {/* Bouton principal, fixe au-dessus de la barre du bas (celui de la
          Capsule). Le dégradé crème empêche les cartes qui défilent dessous
          de se lire à travers. */}
      {items.length > 0 && (
        <div
          className="absolute inset-x-0 z-10 px-6 pt-[14px] pointer-events-none"
          style={{
            bottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))",
            paddingBottom: 12,
            background: "linear-gradient(to top, var(--color-cream) 70%, rgba(243,238,229,0))",
          }}
        >
          {enregistrement === "erreur" ? (
            <div className="text-center text-[11px] text-rust mb-[8px]" role="alert">
              L&apos;enregistrement n&apos;a pas abouti. Ton look est toujours là : réessaie.
            </div>
          ) : (
            messageCta && (
              <div className="text-center text-[11px] text-terracotta mb-[8px]" role="status">
                {messageCta}
              </div>
            )
          )}
          <Button className="pointer-events-auto" onClick={() => void enregistrer()} disabled={!canSave || enregistrement === "en_cours"} aria-busy={enregistrement === "en_cours"}>
            {enregistrement === "en_cours" ? "Enregistrement…" : `Enregistrer ce look ${count > 0 ? `(${count})` : ""}`}
          </Button>
        </div>
      )}

      {/* ── L'APERÇU ─ la planche des pièces choisies (FlatLayCapsela, celle des looks), à jour à chaque sélection. Toucher une pièce la
             remplace ; fermer ramène à la sélection, rien n'est perdu. */}
      <BottomSheet title="Aperçu du look" open={apercu} onClose={() => setApercu(false)}>
        {draftPieces.length > 0 ? (
          <div className="relative rounded-bloc bg-warm-bg overflow-hidden" style={{ height: "clamp(230px, 68vw, 290px)" }}>
            <FlatLayCapsela items={draftPieces} context="look-detail" layoutSeed={draftPieces.map((p) => p.id).join(",")} onPiece={(it) => ouvrirRemplacement(it.cat)} />
          </div>
        ) : (
          <div className="text-[12.5px] text-muted py-6 text-center">Aucune pièce pour l&apos;instant.</div>
        )}
        <div className="text-[11.5px] text-muted text-center mt-2">Touche une pièce pour la remplacer.</div>
        <Button
          variante="secondaire"
          className="mt-4"
          onClick={() => {
            setApercu(false);
            ouvrirAjout();
          }}
        >
          Ajouter une pièce
        </Button>
      </BottomSheet>

      <BottomSheet title={groupeFeuille ? groupeFeuille.label : "Ajouter une pièce"} open={feuille === "ajout"} onClose={() => setFeuille(null)}>
        {groupeFeuille ? (
          <>
            <LienRetour onClick={() => setCategorieFeuille(null)} label="Revenir aux catégories" texte="Catégories" />
            <div className="grid grid-cols-3 gap-x-[10px] gap-y-[14px] mt-2">
              {groupeFeuille.items.map((it) => {
                const on = state.lookDraftIds.includes(it.id);
                const blocked = estBloquee(it);
                return (
                  <button
                    key={it.id}
                    onClick={() => !blocked && basculerDepuisFeuille(it.id)}
                    disabled={blocked}
                    aria-pressed={on}
                    className={"text-left min-w-0 " + (blocked ? "cursor-not-allowed" : "cursor-pointer")}
                    style={{ opacity: blocked ? 0.3 : 1 }}
                  >
                    <PhotoPiece item={it} arrondi={12}>
                      <PastilleSelection on={on} />
                    </PhotoPiece>
                    <div className="text-[11px] text-ink mt-[6px] leading-[1.25] truncate">{it.name}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex flex-col">
            {groups.map((g) => {
              const choisies = draftPieces.filter((p) => p.cat === g.key).length;
              return (
                <button
                  key={g.key}
                  onClick={() => setCategorieFeuille(g.key)}
                  className="flex items-center gap-3 text-left px-1 py-[10px] cursor-pointer border-b border-divider last:border-b-0"
                  style={{ minHeight: 52 }}
                >
                  <span className="flex -space-x-[10px] flex-shrink-0" aria-hidden="true">
                    {g.items.slice(0, 2).map((it) => (
                      <span key={it.id} className="block w-[30px]">
                        <PhotoPiece item={it} arrondi={8} />
                      </span>
                    ))}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] text-ink">{g.label}</span>
                    <span className="block text-[11px] text-muted mt-[2px]">
                      {g.items.length} {g.items.length > 1 ? "pièces" : "pièce"}
                      {choisies > 0 && ` · ${choisies} dans ton look`}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-placeholder text-[15px] flex-shrink-0">
                    ›
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
