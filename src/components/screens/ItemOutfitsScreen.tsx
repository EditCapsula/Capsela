"use client";

import { useMemo, useState } from "react";
import { CATLABEL, OCC_LABELS } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { currentSeasonKey, representativeWeatherFor } from "@/lib/capsule";
import { describeOutfitVariation, getOutfitsForItem, type ItemOutfitVariation } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import type { OccasionKey } from "@/lib/types";

/**
 * Module "Comment porter cette pièce ?" (recette 19/08/2026) — P0 : clic
 * sur un article de Capsule, pièce pivot, combinaisons regroupées par
 * occasion, filtre, images existantes, CTA "Voir cette tenue". Réutilise
 * getOutfitsForItem (lui-même une réutilisation de generateOutfit) —
 * jamais un second moteur, jamais d'appel OpenAI à l'ouverture.
 */
export default function ItemOutfitsScreen() {
  const { state, wardrobePool, vestiairePool, actions } = useCapsela();
  const { profile } = useAuth();
  const [occasionFilter, setOccasionFilter] = useState<OccasionKey | "all">("all");

  const pivot = wardrobePool.find((i) => i.id === state.activeId) || vestiairePool.find((i) => i.id === state.activeId);

  // La pièce pivot doit toujours être présente, même si sa catégorie est
  // par ailleurs pourvue par une pièce réelle dans wardrobePool (auquel
  // cas ce n'est pas exactement la même ligne que celle cliquée). Hooks
  // toujours appelés (jamais après un retour conditionnel) : le garde-fou
  // "pivot manquant" est interne, le retour null n'intervient qu'au rendu.
  const pool = useMemo(
    () => (!pivot ? [] : wardrobePool.some((i) => i.id === pivot.id) ? wardrobePool : [...wardrobePool, pivot]),
    [wardrobePool, pivot]
  );

  const capsuleSeason = state.capsuleSeason || currentSeasonKey();
  const weather = useMemo(() => representativeWeatherFor(capsuleSeason), [capsuleSeason]);
  const preferredHexes = useMemo(() => paletteHexes(profile), [profile]);

  const variations = useMemo(
    () => (!pivot ? [] : getOutfitsForItem(pivot.id, pool, weather, preferredHexes)),
    [pivot, pool, weather, preferredHexes]
  );

  if (!pivot) return null;

  const occasionsCovered = Array.from(new Set(variations.map((v) => v.occasion)));
  const filteredVariations = occasionFilter === "all" ? variations : variations.filter((v) => v.occasion === occasionFilter);

  // Groupe par occasion en conservant l'ordre d'apparition (déjà celui de
  // la taxonomie, cf. getOutfitsForItem), pour l'affichage en sections.
  const grouped: { occasion: OccasionKey; items: ItemOutfitVariation[] }[] = [];
  filteredVariations.forEach((v) => {
    const group = grouped.find((g) => g.occasion === v.occasion);
    if (group) group.items.push(v);
    else grouped.push({ occasion: v.occasion, items: [v] });
  });

  const pivotImage = resolveItemImage(pivot);
  const metaParts = [pivot.color, pivot.matiere].filter(Boolean);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <button
        onClick={() => actions.go(state.itemOutfitsReturn)}
        className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
      >
        ←
      </button>

      <div className="mt-[18px] text-[11px] tracking-[.16em] uppercase text-muted">Comment porter cette pièce ?</div>

      <div className="flex items-center gap-[13px] mt-[10px]">
        <div
          className="relative flex-shrink-0 rounded-[14px] overflow-hidden"
          style={
            pivotImage.url
              ? { width: 84, height: 100, background: "#F3EDE1", padding: 8 }
              : { width: 84, height: 100, background: pivot.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
          }
        >
          {pivotImage.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pivotImage.url}
              alt={pivot.name}
              style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[20px] text-ink leading-[1.2]">{pivot.name}</div>
          <div className="text-[12px] text-muted mt-[4px]">
            {CATLABEL[pivot.cat]}
            {metaParts.length ? " · " + metaParts.join(" · ") : ""}
          </div>
        </div>
      </div>

      <div className="mt-[16px] text-[12.5px] text-terracotta">
        {occasionsCovered.length === 0
          ? "Pas encore assez de combinaisons"
          : `${occasionsCovered.length} occasion${occasionsCovered.length > 1 ? "s" : ""} couverte${occasionsCovered.length > 1 ? "s" : ""} · ${variations.length} look${variations.length > 1 ? "s" : ""} possible${variations.length > 1 ? "s" : ""}`}
      </div>

      {occasionsCovered.length > 0 && (
        <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[14px]">
          <button
            onClick={() => setOccasionFilter("all")}
            className="flex-none py-[9px] px-4 rounded-full text-[12.5px] cursor-pointer border whitespace-nowrap"
            style={{
              background: occasionFilter === "all" ? "#1D1A16" : "#FBF8F3",
              borderColor: occasionFilter === "all" ? "#1D1A16" : "#E6DCCB",
              color: occasionFilter === "all" ? "#F3EEE5" : "#1D1A16",
            }}
          >
            Tout
          </button>
          {occasionsCovered.map((occ) => {
            const on = occasionFilter === occ;
            return (
              <button
                key={occ}
                onClick={() => setOccasionFilter(occ)}
                className="flex-none py-[9px] px-4 rounded-full text-[12.5px] cursor-pointer border whitespace-nowrap"
                style={{ background: on ? "#1D1A16" : "#FBF8F3", borderColor: on ? "#1D1A16" : "#E6DCCB", color: on ? "#F3EEE5" : "#1D1A16" }}
              >
                {OCC_LABELS[occ]}
              </button>
            );
          })}
        </div>
      )}

      {occasionsCovered.length === 0 ? (
        <div className="mt-[22px] bg-card border border-border rounded-[14px] px-4 py-[18px]">
          <div className="text-[13px] text-[#3F3B34] leading-[1.5]">
            Pas encore assez de pièces compatibles pour créer plusieurs looks avec cet article.
          </div>
          <button onClick={actions.openAdd} className="mt-[12px] inline-block text-[12.5px] text-terracotta cursor-pointer">
            Compléter mon dressing →
          </button>
        </div>
      ) : (
        grouped.map((group) => (
          <div key={group.occasion} className="mt-[22px]">
            <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[10px]">{OCC_LABELS[group.occasion]}</div>
            <div className="flex flex-col gap-[12px]">
              {group.items.map((variation, idx) => {
                const pieces = variation.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
                return (
                  <div key={variation.ids.join("-")} className="bg-card border border-border rounded-[14px] p-[13px]">
                    <div className="flex gap-[7px] overflow-x-auto pb-[2px]">
                      {pieces.map((p) => {
                        const img = resolveItemImage(p);
                        const isPivot = p.id === pivot.id;
                        return (
                          <div
                            key={p.id}
                            className="flex-none rounded-[9px] overflow-hidden"
                            style={
                              img.url
                                ? { width: 46, height: 56, background: "#F3EDE1", padding: 6, boxShadow: isPivot ? "0 0 0 1.5px #A66950" : undefined }
                                : { width: 46, height: 56, background: p.hex, boxShadow: isPivot ? "0 0 0 1.5px #A66950" : "inset 0 0 0 1px rgba(29,26,22,.06)" }
                            }
                          >
                            {img.url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={img.url}
                                alt=""
                                style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="text-[12.5px] text-[#3F3B34] mt-[10px] leading-[1.4]">
                      {describeOutfitVariation(variation, idx === 0)}
                    </div>
                    <button
                      onClick={() => actions.viewItemOutfit(variation.ids, variation.occasion)}
                      className="mt-[9px] inline-block text-[12.5px] text-terracotta cursor-pointer"
                    >
                      Voir cette tenue →
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
