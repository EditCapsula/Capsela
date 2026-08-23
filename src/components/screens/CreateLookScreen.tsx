"use client";

import { useRef } from "react";
import { BAS_CATS, CATS, CATLABEL, OCCASIONS } from "@/lib/data";
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
import type { CategoryKey, Item } from "@/lib/types";

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

function HangerIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.2a1.9 1.9 0 00-.6 3.7v1.1L4.6 12.9a1.4 1.4 0 00.8 2.55h13.2a1.4 1.4 0 00.8-2.55L12.6 8V6.9A1.9 1.9 0 0012 3.2z" />
      <line x1="4.8" y1="18.6" x2="19.2" y2="18.6" />
    </svg>
  );
}
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

export default function CreateLookScreen() {
  const { state, weather, actions } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;
  const groupRefs = useRef<Partial<Record<CategoryKey, HTMLDivElement | null>>>({});

  const draftPieces = state.lookDraftIds
    .map((id) => items.find((i) => i.id === id))
    .filter((it): it is Item => Boolean(it));
  const hasRobeOrCombi = draftPieces.some((i) => i.cat === "robe" || i.cat === "combinaison");
  const hasTopBottom = draftPieces.some((i) => TOP_BOTTOM_CATS.has(i.cat));
  const occFormality = (OCCASIONS.find(([key]) => key === state.lookDraftOccasion) || [])[3] || 0;
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
    return { key, label: plural.toUpperCase(), items: visible };
  }).filter((g) => g.items.length > 0);

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

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.cancelCreateLook}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[22px] text-ink">Créer un look</div>
      </div>
      <div className="text-[13px] text-muted mt-4 leading-[1.5]">
        Choisis les pièces de ton dressing à combiner.
        <br />
        Tu pourras le reporter d&apos;un tap.
      </div>

      {items.length === 0 && (
        <div className="mt-6 bg-card border border-border rounded-2xl px-4 py-[18px] text-center text-[13px] text-muted leading-[1.5]">
          Ton dressing est encore vide — ajoute quelques pièces réelles pour pouvoir composer un look.
        </div>
      )}

      <div className="mt-6 text-[11px] tracking-[.16em] uppercase text-muted">
        Occasion <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
      </div>
      <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[9px]">
        {OCCASIONS.map(([key, label, sub]) => {
          const on = state.lookDraftOccasion === key;
          return (
            <button
              key={key}
              onClick={() => actions.setLookDraftOccasion(key)}
              className="flex-none text-left py-[10px] px-[15px] rounded-full cursor-pointer border"
              style={{ background: on ? "#1D1A16" : "#FBF8F3", borderColor: on ? "#1D1A16" : "#E6DCCB" }}
            >
              <div className="text-[12.5px] whitespace-nowrap" style={{ color: on ? "#F3EEE5" : "#1D1A16" }}>
                {label}
              </div>
              <div className="text-[10.5px] mt-[2px] whitespace-nowrap" style={{ color: on ? "#B98A6E" : "#7B7366" }}>
                {sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Résumé compact (recette 24/08/2026, point 3) — remplace le gros
          bloc "Ce look" par une ligne courte + vignettes, placée sous
          l'occasion plutôt qu'après les grilles : la sélection en cours
          reste visible sans avoir à scroller. "Modifier" scrolle simplement
          vers la première catégorie du picker, déjà juste en dessous — rien
          d'autre à "modifier" que ce qui est déjà affiché sur cet écran. */}
      {count > 0 && (
        <button
          onClick={() => groups[0] && groupRefs.current[groups[0].key]?.scrollIntoView({ behavior: "smooth", block: "start" })}
          className="w-full flex items-center gap-3 mt-4 bg-card border border-border rounded-[14px] px-4 py-[13px] cursor-pointer text-left"
        >
          <span className="w-8 h-8 rounded-full bg-warm-bg text-warm-text flex items-center justify-center flex-shrink-0">
            <HangerIcon />
          </span>
          <span className="text-[13px] text-ink flex-shrink-0">
            {count} {count > 1 ? "pièces sélectionnées" : "pièce sélectionnée"}
          </span>
          <span className="flex items-center -space-x-[6px] flex-shrink-0">
            {draftPieces.slice(0, 4).map((it) => {
              const img = resolveItemImage(it);
              return (
                <span
                  key={it.id}
                  className="w-7 h-7 rounded-[8px] border-2 border-cream overflow-hidden flex-shrink-0"
                  style={img.url ? { background: "#F3EDE1" } : { background: it.hex }}
                >
                  {img.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={img.url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }} />
                  )}
                </span>
              );
            })}
          </span>
          {count > 4 && <span className="text-[10.5px] text-placeholder flex-shrink-0">+{count - 4}</span>}
          <span className="flex-1" />
          <span className="text-[12px] text-terracotta flex-shrink-0">Modifier ›</span>
        </button>
      )}

      {groups.map((g) => (
        <div key={g.key} ref={(el) => { groupRefs.current[g.key] = el; }}>
          <div className="mt-6 mb-3 text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
            {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
          </div>
          <div className="grid grid-cols-2 gap-x-[10px] gap-y-4">
            {g.items.map((it) => {
              const on = state.lookDraftIds.includes(it.id);
              // R-B5 — une robe/combinaison exclut haut/bas et réciproquement :
              // structurellement incompatibles, jamais juste une préférence de
              // style (contrairement à R-B6 ci-dessous) — retiré du picker.
              const robeConflict =
                !on &&
                ((TOP_BOTTOM_CATS.has(it.cat) && hasRobeOrCombi) ||
                  ((it.cat === "robe" || it.cat === "combinaison") && hasTopBottom));
              // Brief design section 4 — "jamais 2 pièces base ensemble" : une
              // fois une pièce base du haut/pull sélectionnée, toute autre
              // pièce base du même groupe devient indisponible (repli si
              // aucune pièce calque n'existe dans le dressing, cf. ci-dessus).
              const baseLayerConflict =
                !on &&
                TOP_LAYER_CATS.includes(it.cat) &&
                rolePieceOf(it) === "base" &&
                topDraftBaseSelected &&
                hasCalqueOption;
              const blocked = robeConflict || baseLayerConflict;
              const img = resolveItemImage(it);
              return (
                <button
                  key={it.id}
                  onClick={() => !blocked && actions.toggleLookDraftPiece(it.id)}
                  disabled={blocked}
                  className={"text-left " + (blocked ? "cursor-not-allowed" : "cursor-pointer")}
                  style={{ opacity: blocked ? 0.3 : 1 }}
                >
                  <div
                    className="relative w-full rounded-[11px] overflow-hidden"
                    style={{
                      aspectRatio: "4/5",
                      background: img.url ? "#F3EDE1" : it.hex,
                      border: on ? "2px solid #A66950" : "1px solid #E6DCCB",
                      boxShadow: on ? "0 0 0 2px #F3EEE5 inset" : "inset 0 0 0 1px rgba(29,26,22,.06)",
                    }}
                  >
                    {img.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt={it.name}
                        style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center", padding: 10, boxSizing: "border-box" }}
                      />
                    )}
                    {on && (
                      <span className="absolute top-[7px] right-[7px] w-5 h-5 rounded-full bg-terracotta text-cream flex items-center justify-center text-[11px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-ink mt-[6px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                    {it.name}
                  </div>
                  <div className="text-[9.5px] text-placeholder mt-[1px]">{CATLABEL[it.cat]}</div>
                </button>
              );
            })}
            <button
              onClick={() => actions.openAddForCategory(g.key)}
              className="flex flex-col items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-dashed border-[#d6c7ae] bg-card cursor-pointer text-center px-2"
              style={{ aspectRatio: "0.72" }}
            >
              <span className="w-9 h-9 rounded-full bg-cream border border-border text-terracotta flex items-center justify-center flex-shrink-0">
                <PlusIcon />
              </span>
              <span className="text-[11.5px] text-ink leading-[1.25]">Ajouter {ADD_TILE_LABEL[g.key]}</span>
            </button>
          </div>
        </div>
      ))}

      {count >= 2 && (
        <div className="flex items-center gap-[9px] mt-6">
          <span className="text-[11px] tracking-[.16em] uppercase text-muted">Ce look</span>
          {lookScore.badge === "recommande" && (
            <span className="text-[9.5px] tracking-[.06em] uppercase text-[#5B7A5E] bg-[#E7EEDF] rounded-full px-[9px] py-[3px]">
              Recommandé
            </span>
          )}
        </div>
      )}

      {/* Conseils Capsela (recette 24/08/2026, points 4/5) — jamais avant 2
          pièces sélectionnées (rien de pertinent à évaluer avant), et
          désormais actionnables via un lien "Voir les..." plutôt qu'un
          simple texte, en plus du bouton de fermeture. */}
      {count >= 2 && lookScore.badge === "ajuster" && lookScore.adjustMessage && (
        <div className="mt-3 bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px]">
          <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{lookScore.adjustMessage}</div>
        </div>
      )}

      {count >= 2 &&
        lookScore.proactives.map((p) => {
          const target = PROACTIVE_TARGET_CATS[p.key];
          return (
            <div key={p.key} className="relative mt-3 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
              <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
              <div className="flex-1 min-w-0 pr-[18px]">
                {p.key === "layer" && (
                  <div className="text-[10px] tracking-[.14em] uppercase text-terracotta mb-[6px]">Layering</div>
                )}
                <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{p.text}</div>
                {target && (
                  <button
                    onClick={() => goToCategory(target.cats)}
                    className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer"
                  >
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
          <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{blockingHits[0].message}</div>
        </div>
      )}

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-3">
        Nom du look <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
      </div>
      <input
        className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
        value={state.lookDraftName}
        onChange={(e) => actions.setLookDraftName(e.target.value)}
        placeholder="ex. Look bureau"
      />

      <button
        onClick={actions.saveLook}
        className={
          "mt-7 w-full text-center rounded-full py-4 text-[13px] tracking-[.14em] uppercase " +
          (canSave ? "bg-terracotta text-cream cursor-pointer" : "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed")
        }
      >
        Enregistrer ce look {count > 0 ? `(${count})` : ""}
      </button>
      {!canSave && (
        <div className="text-center text-[11.5px] text-terracotta mt-[10px]">
          {count < 2 ? "Choisis au moins 2 pièces pour enregistrer ce look." : blockingHits.find((h) => h.hard)?.message}
        </div>
      )}
    </div>
  );
}
