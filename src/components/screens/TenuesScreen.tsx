"use client";

import AppHeader from "@/components/AppHeader";
import { CATLABEL, CITIES, DAYS_FR, MONTHS_FR, OCCASIONS, isBag } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { computeLookScore } from "@/lib/logic";

const MISSING_LABELS: Record<string, string> = {
  haut: "haut",
  bas: "bas",
  chaussures: "chaussures",
  accessoire: "accessoires",
  sac: "sac",
  bijou: "bijou",
};

function missingSuggestionText(missingCats: string[]): string {
  const words = missingCats.map((k) => MISSING_LABELS[k] || k);
  if (words.length === 0) return "";
  if (words.length === 1) {
    const w = words[0];
    return w === "chaussures" || w === "accessoires"
      ? "Il te manque des " + w + " pour compléter cette tenue."
      : "Il te manque un " + w + " pour compléter cette tenue.";
  }
  const last = words[words.length - 1];
  const head = words.slice(0, -1).join(", ");
  return "Il te manque des " + head + " et " + last + " pour compléter cette tenue.";
}

export default function TenuesScreen() {
  const { state, wardrobePool, outfitFromDressing, actions } = useCapsela();
  const { profile } = useAuth();

  const now = new Date();
  const dateText = DAYS_FR[now.getDay()] + " " + now.getDate() + " " + MONTHS_FR[now.getMonth()];
  const firstNameOrYou = profile.displayName || "toi";
  const geoCity = CITIES[(state.geoIndex || 0) % CITIES.length];

  const outfitPieces = (state.outfit || [])
    .map((id) => wardrobePool.find((i) => i.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));

  const tenueSourceText = outfitFromDressing
    ? "Depuis ton dressing"
    : "Depuis ton profil style · " + (profile.styles[0] || "");

  const missingText = missingSuggestionText(state.outfitMissingCats || []);

  const dismissed = new Set(state.dismissedSuggestions || []);
  const lookScore = computeLookScore(
    outfitPieces,
    state.occasion || "all",
    profile.favoriteColors || [],
    profile.morphology,
    dismissed
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

      <div className="mt-5 text-[11px] tracking-[.16em] uppercase text-muted">Occasion</div>
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

      <div className="mt-[14px] text-[11.5px] text-muted">{tenueSourceText}</div>

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
        {outfitPieces.map((it) => (
          <div key={it.id} className="flex items-center gap-[13px] bg-card border border-border rounded-[14px] p-[11px]">
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
              <div className="text-[14.5px] text-ink">{it.name}</div>
              <div className="text-[11px] text-muted mt-[3px]">
                {CATLABEL[isBag(it) ? "sac" : it.cat]} · {it.worn ? "porté récemment" : "neuf"}
              </div>
            </div>
            <button
              onClick={() => actions.swapPiece(it.id, it.cat)}
              className="text-[17px] text-placeholder cursor-pointer flex-shrink-0 p-[6px]"
            >
              ⇄
            </button>
          </div>
        ))}
      </div>

      {lookScore.badge === "ajuster" && lookScore.adjustMessage && (
        <div className="mt-4 bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px]">
          <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{lookScore.adjustMessage}</div>
        </div>
      )}

      {lookScore.proactive && (
        <div className="mt-4 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta">✦</span>
          <div className="flex-1">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{lookScore.proactive.text}</div>
            <button
              onClick={() => actions.dismissOutfitSuggestion(lookScore.proactive!.key)}
              className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

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

      {state.outfitValidated ? (
        <div className="mt-[22px] flex items-center gap-3 bg-ink rounded-2xl py-[15px] px-4">
          <span className="w-8 h-8 rounded-full bg-terracotta text-cream flex items-center justify-center text-base flex-shrink-0">
            ✓
          </span>
          <div className="text-[13.5px] text-cream">Bonne journée avec cette tenue !</div>
        </div>
      ) : (
        <button
          onClick={actions.wearOutfitToday}
          className="mt-[22px] w-full bg-terracotta text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
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
