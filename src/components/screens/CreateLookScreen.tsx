"use client";

import { BAS_CATS, CATS, CATLABEL, OCCASIONS } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { computeLookScore, evaluateBlocking } from "@/lib/logic";
import type { Item } from "@/lib/types";

const TOP_BOTTOM_CATS = new Set(["haut", ...BAS_CATS, "jupe"]);

export default function CreateLookScreen() {
  const { state, weather, actions } = useCapsela();
  const { profile } = useAuth();
  const items = state.items;

  const draftPieces = state.lookDraftIds
    .map((id) => items.find((i) => i.id === id))
    .filter((it): it is Item => Boolean(it));
  const hasRobeOrCombi = draftPieces.some((i) => i.cat === "robe" || i.cat === "combinaison");
  const hasTopBottom = draftPieces.some((i) => TOP_BOTTOM_CATS.has(i.cat));
  const occFormality = (OCCASIONS.find(([key]) => key === state.lookDraftOccasion) || [])[3] || 0;
  const dressy = occFormality >= 3;

  const groups = CATS.map(([key, , plural]) => ({
    key,
    label: plural.toUpperCase(),
    items: items.filter((i) => i.cat === key),
  })).filter((g) => g.items.length > 0);

  const count = state.lookDraftIds.length;
  const canSave = count >= 2;

  const dismissed = new Set(state.lookDraftDismissed || []);
  const lookScore = computeLookScore(
    draftPieces,
    state.lookDraftOccasion,
    profile.favoriteColors || [],
    profile.morphology,
    dismissed
  );
  const blockingHits = evaluateBlocking(draftPieces, state.lookDraftOccasion, weather);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[30px]">
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
        Choisis les pièces de ton dressing à combiner, tu pourras la reporter d&apos;un tap.
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

      {groups.map((g) => (
        <div key={g.key}>
          <div className="mt-6 mb-3 text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
            {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
          </div>
          <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: "x mandatory" }}>
            {g.items.map((it) => {
              const on = state.lookDraftIds.includes(it.id);
              // Filtrage dynamique doux (R-B5 : robe/combinaison exclut haut/bas ;
              // R-B6 : baskets reléguées en contexte habillé) — jamais désactivé,
              // juste atténué visuellement ; le bandeau ci-dessous couvre le reste.
              const dimmed =
                !on &&
                ((TOP_BOTTOM_CATS.has(it.cat) && hasRobeOrCombi) ||
                  ((it.cat === "robe" || it.cat === "combinaison") && hasTopBottom) ||
                  (it.cat === "chaussures" && it.shoeType === "Basket / sneaker" && dressy));
              return (
                <button
                  key={it.id}
                  onClick={() => actions.toggleLookDraftPiece(it.id)}
                  className="flex-none w-[104px] cursor-pointer text-left"
                  style={{ scrollSnapAlign: "start", opacity: dimmed ? 0.4 : 1 }}
                >
                  <div
                    className="relative w-full rounded-[11px] overflow-hidden"
                    style={{
                      aspectRatio: "4/5",
                      background: it.hex,
                      border: on ? "2px solid #1D1A16" : "1px solid #E6DCCB",
                      boxShadow: on ? "0 0 0 2px #F3EEE5 inset" : "inset 0 0 0 1px rgba(29,26,22,.06)",
                    }}
                  >
                    {on && (
                      <span className="absolute top-[7px] right-[7px] w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center text-[11px]">
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

      {lookScore.badge === "ajuster" && lookScore.adjustMessage && (
        <div className="mt-3 bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px]">
          <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{lookScore.adjustMessage}</div>
        </div>
      )}

      {lookScore.proactive && (
        <div className="mt-3 flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
          <span className="font-serif italic text-[15px] text-terracotta">✦</span>
          <div className="flex-1">
            <div className="text-[12.5px] text-[#3F3B34] leading-[1.45]">{lookScore.proactive.text}</div>
            <button
              onClick={() => actions.dismissLookDraftSuggestion(lookScore.proactive!.key)}
              className="mt-[10px] inline-block text-[12px] text-terracotta cursor-pointer"
            >
              Ignorer
            </button>
          </div>
        </div>
      )}

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
          Choisis au moins 2 pièces pour enregistrer ce look.
        </div>
      )}
    </div>
  );
}
