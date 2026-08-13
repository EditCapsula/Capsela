"use client";

import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { CATLABEL, CITIES, DATE_CONTEXTS, DAYS_FR, MONTHS_FR, OCCASIONS, isBag } from "@/lib/data";
import { isCatalogId } from "@/lib/catalog";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { computeLookScore, violatesOuterwearRule } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";

/** US-05 — transparence du mode de recommandation : source réelle des pièces de la tenue affichée. */
const MODE_LABELS = {
  capsule_depart: "Capsule de départ",
  hybride: "Tes pièces + suggestions",
  dressing_complet: "100% ton dressing",
} as const;

const MISSING_LABELS: Record<string, string> = {
  haut: "un haut",
  bas: "un bas",
  chaussures: "des chaussures",
  accessoire: "un accessoire",
  sac: "un sac",
  bijou: "un bijou",
};

function missingSuggestionText(missingCats: string[]): string {
  const words = Array.from(new Set(missingCats.map((k) => MISSING_LABELS[k]).filter(Boolean)));
  if (words.length === 0) return "";
  if (words.length === 1) return "Il te manque " + words[0] + " pour compléter cette tenue.";
  const last = words[words.length - 1];
  const head = words.slice(0, -1).join(", ");
  return "Il te manque " + head + " et " + last + " pour compléter cette tenue.";
}

export default function TenuesScreen() {
  const { state, weather, wardrobePool, actions } = useCapsela();
  const { profile } = useAuth();
  const [layeringInfoOpen, setLayeringInfoOpen] = useState(false);
  const [suggestionInfoId, setSuggestionInfoId] = useState<number | null>(null);

  const now = new Date();
  const dateText = DAYS_FR[now.getDay()] + " " + now.getDate() + " " + MONTHS_FR[now.getMonth()];
  const firstNameOrYou = profile.displayName || "toi";
  const geoCity = CITIES[(state.geoIndex || 0) % CITIES.length];

  const outfitPieces = (state.outfit || [])
    .map((id) => wardrobePool.find((i) => i.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));

  const suggestedCount = outfitPieces.filter((it) => isCatalogId(it.id)).length;
  const recommendationMode: keyof typeof MODE_LABELS =
    suggestedCount === 0
      ? "dressing_complet"
      : suggestedCount === outfitPieces.length
        ? "capsule_depart"
        : "hybride";

  const missingText = missingSuggestionText(state.outfitMissingCats || []);
  // Sans objet en Cocooning (R-B12) : veste/manteau déjà exclus du pool de génération.
  const vesteWithoutBase = state.occasion !== "cocooning" && violatesOuterwearRule(outfitPieces);

  const dismissed = new Set(state.dismissedSuggestions || []);
  const lookScore = computeLookScore(
    outfitPieces,
    state.occasion || "all",
    paletteHexes(profile),
    profile.morphology,
    dismissed,
    weather,
    state.workMode,
    state.dateContext
  );

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.goWardrobe}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">{dateText}</div>
          <div className="font-serif text-[30px] leading-[1.12] text-ink mt-[2px]">
            Bonjour, <span className="italic text-terracotta">{firstNameOrYou}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-[9px] bg-card border border-border rounded-full py-[10px] px-[15px] mt-5">
        <span
          className="w-[9px] h-[9px] rounded-full bg-terracotta flex-shrink-0"
          style={{ boxShadow: "0 0 0 4px rgba(166,105,80,.16)" }}
        />
        <div className="flex-1 min-w-0 text-[13px] text-ink whitespace-nowrap overflow-hidden text-ellipsis">
          {geoCity.city}
        </div>
        <span className="text-[12px] text-[#3F3B34] whitespace-nowrap flex-shrink-0">
          {geoCity.temp}° · {geoCity.label}
        </span>
        <span className="w-px h-[14px] bg-[#E2D5C0] flex-shrink-0" />
        <button onClick={actions.cycleGeo} className="text-[11px] text-terracotta tracking-[.03em] cursor-pointer flex-shrink-0">
          Modifier
        </button>
      </div>

      <div className="mt-5 text-[11px] tracking-[.16em] uppercase text-muted">
        Qu&apos;est-ce qui est prévu aujourd&apos;hui ?
      </div>
      <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[9px]">
        {OCCASIONS.map(([key, label, sub], i) => {
          const on = state.occasion === key;
          return (
            <button
              key={key}
              onClick={() => actions.setOccasion(on ? "all" : key)}
              className="flex-none text-left py-[10px] px-[15px] rounded-full cursor-pointer border"
              style={{ background: on ? "#1D1A16" : "#FBF8F3", borderColor: on ? "#1D1A16" : "#E6DCCB" }}
            >
              <div className="text-[12.5px] whitespace-nowrap" style={{ color: on ? "#F3EEE5" : "#1D1A16" }}>
                <span style={{ color: on ? "#C9966F" : "#B3AA9B" }}>{String(i + 1).padStart(2, "0")}</span> {label}
              </div>
              <div className="text-[10.5px] mt-[2px] whitespace-nowrap" style={{ color: on ? "#B98A6E" : "#7B7366" }}>
                {sub}
              </div>
            </button>
          );
        })}
      </div>

      {state.occasion === "date" && (
        <div className="flex gap-[11px] mt-3">
          <div className="w-[1.5px] flex-shrink-0 bg-border rounded-sm ml-[7px]" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[.16em] uppercase text-terracotta mb-[9px]">
              ↳ Quel type de date ?
            </div>
            <div className="flex gap-2 flex-wrap">
              {DATE_CONTEXTS.map(([m]) => (
                <button
                  key={m}
                  onClick={() => actions.setDateContext(m)}
                  className={
                    "px-[14px] py-[7px] rounded-full text-[12px] cursor-pointer font-sans border " +
                    (state.dateContext === m ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.occasion === "travail_formel" && (
        <div className="flex gap-[11px] mt-3">
          <div className="w-[1.5px] flex-shrink-0 bg-border rounded-sm ml-[7px]" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[.16em] uppercase text-terracotta mb-[9px]">
              ↳ Où travailles-tu aujourd&apos;hui ?
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["Présentiel", "Télétravail"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => actions.setWorkMode(m)}
                  className={
                    "px-[14px] py-[7px] rounded-full text-[12px] cursor-pointer font-sans border " +
                    (state.workMode === m ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.occasion === "voyage" && (
        <div className="flex gap-[11px] mt-3">
          <div className="w-[1.5px] flex-shrink-0 bg-border rounded-sm ml-[7px]" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] tracking-[.16em] uppercase text-terracotta mb-[9px]">
              ↳ Quel type de trajet ?
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["Court trajet", "Longue distance"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => actions.setTravelMode(m)}
                  className={
                    "px-[14px] py-[7px] rounded-full text-[12px] cursor-pointer font-sans border " +
                    (state.travelMode === m ? "bg-ink text-cream border-ink" : "bg-card text-ink border-border")
                  }
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {state.occasion === "voyage" && state.travelMode === "Longue distance" && !state.travelTipDismissed && (
        <div className="mt-[14px] flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">
              En voyage longue distance ? Pense aux bas de contention pour limiter les jambes lourdes.
            </div>
          </div>
          <button
            onClick={actions.dismissTravelTip}
            className="flex-shrink-0 text-[14px] text-placeholder cursor-pointer px-[2px]"
          >
            ×
          </button>
        </div>
      )}

      <span className="inline-block mt-[14px] text-[10.5px] tracking-[.06em] uppercase text-terracotta bg-[#F0E5D6] rounded-full py-1 px-[11px]">
        {MODE_LABELS[recommendationMode]}
      </span>

      <div className="flex justify-between items-center mt-[22px] mb-3">
        <div className="flex items-center gap-[9px]">
          <span className="text-[11px] tracking-[.16em] uppercase text-muted">La combinaison</span>
          {lookScore.badge === "recommande" && (
            <span className="text-[9.5px] tracking-[.06em] uppercase text-[#5B7A5E] bg-[#E7EEDF] rounded-full px-[9px] py-[3px]">
              Recommandé
            </span>
          )}
        </div>
        <button onClick={actions.regenOutfit} className="text-[12px] text-terracotta tracking-[.03em] cursor-pointer">
          ↻ Régénérer
        </button>
      </div>
      <div className="flex flex-col gap-[10px]">
        {outfitPieces.map((it) => {
          const suggested = isCatalogId(it.id);
          const infoOpen = suggestionInfoId === it.id;
          return (
            <div key={it.id} className="bg-card border border-border rounded-[14px] p-[11px]">
              <div className="flex items-center gap-[13px]">
                <div
                  className="relative w-[58px] h-[70px] rounded-lg flex-shrink-0"
                  style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
                >
                  <span
                    className="absolute left-[6px] bottom-[6px] text-[8.5px] tracking-[.05em]"
                    style={{ color: "rgba(243,238,229,.9)", textShadow: "0 1px 2px rgba(0,0,0,.35)" }}
                  >
                    {CATLABEL[it.cat].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  {suggested && (
                    <button
                      onClick={() => setSuggestionInfoId(infoOpen ? null : it.id)}
                      className="inline-block text-[9px] tracking-[.08em] uppercase text-terracotta bg-[#F0E5D6] rounded-full py-1 px-[10px] mb-[6px] cursor-pointer"
                    >
                      Suggestion
                    </button>
                  )}
                  <div className="text-[14.5px] text-ink">{it.name}</div>
                  <div className="text-[11px] text-muted mt-[3px]">{CATLABEL[isBag(it) ? "sac" : it.cat]}</div>
                </div>
                <button
                  onClick={() => actions.swapPiece(it.id, it.cat)}
                  className="text-[17px] text-placeholder cursor-pointer flex-shrink-0 p-[6px]"
                >
                  ⇄
                </button>
              </div>
              {suggested && infoOpen && (
                <div className="text-[11.5px] text-muted mt-[10px] leading-[1.4]">
                  Cette pièce vient de ta capsule de départ : tu n&apos;as pas encore ajouté de pièce de cette
                  catégorie à ton dressing. Ajoute-la si tu l&apos;as déjà, ou remplace-la par une des tiennes.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {lookScore.badge === "ajuster" && lookScore.adjustMessage && (
        <div className="mt-4 bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px]">
          <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{lookScore.adjustMessage}</div>
        </div>
      )}

      {lookScore.proactives.map((p) => (
        <div key={p.key} className="mt-4 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta flex-shrink-0">✦</span>
          <div className="flex-1 min-w-0">
            {p.key === "layer" && (
              <div className="flex items-center gap-[6px] mb-[6px]">
                <span className="text-[10px] tracking-[.14em] uppercase text-terracotta">Layering</span>
                <button
                  onClick={() => setLayeringInfoOpen((v) => !v)}
                  aria-label="Qu'est-ce que le layering ?"
                  className="w-[17px] h-[17px] flex-shrink-0 rounded-full border border-[#C9966F] text-[10.5px] text-terracotta flex items-center justify-center cursor-pointer"
                >
                  i
                </button>
              </div>
            )}
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{p.text}</div>
            {p.key === "layer" && layeringInfoOpen && (
              <div className="text-[11.5px] text-muted mt-[6px] leading-[1.4]">
                Le layering, c&apos;est superposer plusieurs pièces pour un effet stylé — par exemple un débardeur
                sous une chemise oversize ouverte.
              </div>
            )}
            <button
              onClick={() => actions.dismissOutfitSuggestion(p.key)}
              className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer"
            >
              Ignorer
            </button>
          </div>
        </div>
      ))}

      {missingText && (
        <div className="mt-4 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta">✦</span>
          <div className="flex-1">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{missingText}</div>
            <button onClick={actions.openAdd} className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer">
              Ajouter une pièce →
            </button>
          </div>
        </div>
      )}

      {vesteWithoutBase && (
        <div className="mt-4 flex items-start gap-[11px] bg-warm-bg border-[1.5px] border-terracotta rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta">!</span>
          <div className="flex-1">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">
              Ajoute un haut, une robe ou une combinaison sous ta veste pour compléter la tenue.
            </div>
            <button onClick={actions.openAdd} className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer">
              Choisir une pièce →
            </button>
          </div>
        </div>
      )}

      {state.outfitValidated ? (
        <div className="mt-[22px] flex items-center gap-3 bg-ink rounded-2xl py-[15px] px-4">
          <span className="w-8 h-8 rounded-full bg-terracotta text-cream flex items-center justify-center text-base flex-shrink-0">
            ✓
          </span>
          <div className="text-[13.5px] text-cream">Bonne journée avec cette tenue !</div>
        </div>
      ) : (
        <button
          onClick={vesteWithoutBase ? undefined : actions.wearOutfitToday}
          className={
            "mt-[22px] w-full text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase " +
            (vesteWithoutBase ? "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed" : "bg-terracotta text-cream cursor-pointer")
          }
        >
          Porter cette tenue
        </button>
      )}

      <button
        onClick={actions.openOpinionShare}
        className="mt-3 w-full flex items-center justify-center gap-2 border border-border bg-card rounded-full py-[14px] text-[12.5px] text-ink cursor-pointer"
      >
        <span className="text-terracotta">✦</span> Demander un avis à un proche
      </button>
    </div>
  );
}
