"use client";

import { useRef, useState } from "react";
import BottomSheet from "@/components/BottomSheet";
import BoutonRetour, { LienRetour } from "@/components/BoutonRetour";
import { GlypheOccasion } from "@/components/GlyphesOccasion";
import { BAS_CATS, CATS, OCCASIONS } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { resolveItemImage } from "@/lib/catalogImages";
import {
  CLOTHING_CATS,
  TOP_LAYER_CATS,
  applySportCocooningFilter,
  computeLookScore,
  evaluateBlocking,
  recentlyWorn,
} from "@/lib/logic";
import { rolePieceOf } from "@/lib/attributes";
import { paletteHexes } from "@/lib/profile";
import type { CategoryKey, Item, OccasionKey } from "@/lib/types";

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
          ? { aspectRatio: "4/5", borderRadius: arrondi, backgroundImage: `url(${image.url})`, backgroundSize: "cover", backgroundPosition: "center" }
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
          ? { background: "rgba(166,105,80,.95)", borderColor: "rgba(166,105,80,.95)", color: "#F3EEE5" }
          : { background: "rgba(243,238,229,.85)", borderColor: "rgba(29,26,22,.18)", color: "transparent" }
      }
    >
      ✓
    </span>
  );
}

export default function CreateLookScreen() {
  const { state, weather, actions } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const groupRefs = useRef<Partial<Record<CategoryKey, HTMLDivElement | null>>>({});
  const [feuille, setFeuille] = useState<null | "occasion" | "ajout">(null);
  const [categorieFeuille, setCategorieFeuille] = useState<CategoryKey | null>(null);
  const [nommer, setNommer] = useState(false);

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
    const robeConflict =
      (TOP_BOTTOM_CATS.has(it.cat) && hasRobeOrCombi) || ((it.cat === "robe" || it.cat === "combinaison") && hasTopBottom);
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
    weather
  );
  const blockingHits = evaluateBlocking(draftPieces, state.lookDraftOccasion, weather);
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
  const choisirOccasion = (key: OccasionKey) => {
    // setLookDraftOccasion bascule : repasser l'occasion active la retirerait.
    if (key !== state.lookDraftOccasion) actions.setLookDraftOccasion(key);
    setFeuille(null);
  };

  return (
    <>
      <div
        className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px]"
        // Réserve la barre du bas ET le bouton principal qui flotte au-dessus (même calcul que la Capsule).
        style={{ paddingBottom: "calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 112px)" }}
      >
        <div className="flex items-center gap-[14px] mt-[10px]">
          <BoutonRetour onClick={actions.cancelCreateLook} label="Annuler et revenir au dressing" className="flex-shrink-0" />
          <div className="t-titre-section text-ink">Créer un look</div>
        </div>
        <div className="t-chapeau text-muted mt-4">
          Choisis les pièces de ton dressing à combiner.
          <br />
          Tu pourras le reporter d&apos;un tap.
        </div>

        {items.length === 0 ? (
          <div className="mt-6 bg-card border border-border rounded-2xl px-4 py-[18px] text-center text-[13px] text-muted leading-[1.5]">
            Ton dressing est encore vide — ajoute quelques pièces réelles pour pouvoir composer un look.
          </div>
        ) : (
          <>
            {/* ── OCCASION ─ le chip de l'écran Tenue : l'occasion choisie,
                   ou l'invitation à en choisir une ; la feuille liste les dix. */}
            <div className="mt-6 t-surtitre text-muted">
              Occasion <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
            </div>
            <button
              onClick={() => setFeuille("occasion")}
              aria-haspopup="dialog"
              aria-label={occasionDraft ? `Occasion : ${occasionDraft[1]}. Changer d'occasion` : "Choisir une occasion"}
              className={
                "mt-[9px] inline-flex items-center gap-[8px] rounded-full px-[16px] text-[12px] cursor-pointer " +
                (occasionDraft ? "bg-terracotta-deep text-cream" : "bg-warm-bg text-sand-text border border-sand-border")
              }
              style={{ minHeight: 46 }}
            >
              {occasionDraft && <GlypheOccasion occasion={occasionDraft[0]} />}
              <span className="whitespace-nowrap">{occasionDraft ? occasionDraft[1] : "Choisir une occasion"}</span>
              <span aria-hidden="true" className="text-[9px] opacity-70">
                ▾
              </span>
            </button>

            {/* ── TON LOOK ─ les pièces choisies, en vignettes : le look tel
                   qu'il sera enregistré. Chacune se retire d'un tap. */}
            <div className="flex items-baseline justify-between gap-[10px] mt-8">
              <div className="t-surtitre text-muted whitespace-nowrap">
                Ton look{count > 0 && ` · ${count} ${count > 1 ? "pièces" : "pièce"}`}
              </div>
              <button onClick={ouvrirAjout} aria-haspopup="dialog" className={CLASSE_LIEN}>
                + Ajouter une pièce
              </button>
            </div>
            <div className="scrollarea flex items-start gap-[10px] overflow-x-auto mt-3 -mx-6 px-6 pt-[2px] pb-[2px]" aria-label="Pièces de ton look">
              {draftPieces.map((it) => (
                <div key={it.id} className="flex-none w-[84px] motion-safe:animate-[capsule-apparition_220ms_ease-out_both]">
                  <div className="relative">
                    <PhotoPiece item={it} arrondi={12} />
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
                  className="flex items-center justify-center rounded-[12px] border-[1.5px] border-dashed border-[#d6c7ae] bg-card"
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
                <span className="t-pastille text-[#5B7A5E] bg-[#E7EEDF] rounded-full px-[9px] py-[3px]">Recommandé</span>
              </div>
            )}

            {/* Conseils Capsela (recette 24/08/2026, points 4/5) — jamais avant 2
                pièces sélectionnées (rien de pertinent à évaluer avant), et
                actionnables via un lien "Voir les...". Placés sous le look
                qu'ils commentent, en retrait : ils ne passent jamais devant. */}
            {count >= 2 && lookScore.badge === "ajuster" && lookScore.adjustMessage && (
              <div className="mt-4 bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px]">
                <div className="text-[12px] text-[#3F3B34] leading-[1.45]">{lookScore.adjustMessage}</div>
              </div>
            )}

            {count >= 2 &&
              lookScore.proactives.map((p) => {
                const target = PROACTIVE_TARGET_CATS[p.key];
                return (
                  <div key={p.key} className="relative mt-3 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
                    <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
                    <div className="flex-1 min-w-0 pr-[18px]">
                      {p.key === "layer" && <div className="t-label text-terracotta mb-[6px]">Layering</div>}
                      <div className="text-[12px] text-[#3F3B34] leading-[1.45]">{p.text}</div>
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
                  </div>
                );
              })}

            {blockingHits.length > 0 && (
              <div className="mt-3 bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px]">
                <div className="text-[12px] text-[#3F3B34] leading-[1.45]">{blockingHits[0].message}</div>
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
              <input
                className="capin mt-3 w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
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
          {messageCta && (
            <div className="text-center text-[11px] text-terracotta mb-[8px]" role="status">
              {messageCta}
            </div>
          )}
          <button
            onClick={actions.saveLook}
            disabled={!canSave}
            className={
              "pointer-events-auto w-full text-center rounded-full py-4 t-bouton " +
              (canSave ? "bg-terracotta-deep active:bg-terracotta-hover text-cream cursor-pointer" : "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed")
            }
          >
            Enregistrer ce look {count > 0 ? `(${count})` : ""}
          </button>
        </div>
      )}

      <BottomSheet title="Pour quelle occasion ?" open={feuille === "occasion"} onClose={() => setFeuille(null)}>
        <div className="flex flex-col">
          {OCCASIONS.map(([key, label, sub]) => {
            const actif = state.lookDraftOccasion === key;
            return (
              <button
                key={key}
                onClick={() => choisirOccasion(key)}
                aria-pressed={actif}
                className="flex items-center gap-3 text-left px-1 py-[10px] cursor-pointer border-b border-[#EFE7DA] last:border-b-0"
                style={{ minHeight: 52 }}
              >
                <span className={actif ? "text-terracotta" : "text-muted"}>
                  <GlypheOccasion occasion={key} taille={19} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className={"text-[13px] " + (actif ? "text-terracotta" : "text-ink")}>{label}</div>
                  <div className="text-[11px] text-muted mt-[2px]">{sub}</div>
                </div>
                <span aria-hidden="true" className={"text-[13px] flex-shrink-0 " + (actif ? "text-terracotta" : "text-transparent")}>
                  ✓
                </span>
              </button>
            );
          })}
        </div>
        {occasionDraft && (
          <button
            onClick={() => {
              actions.setLookDraftOccasion(state.lookDraftOccasion);
              setFeuille(null);
            }}
            className="mt-2 w-full text-center text-[12px] text-muted min-h-[44px] cursor-pointer"
          >
            Sans occasion précise
          </button>
        )}
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
                  className="flex items-center gap-3 text-left px-1 py-[10px] cursor-pointer border-b border-[#EFE7DA] last:border-b-0"
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
