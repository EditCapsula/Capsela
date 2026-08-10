"use client";

import { CATLABEL, OCC_LABELS, isBag } from "@/lib/data";
import { useCapsela } from "@/lib/store";

export default function LookDetailScreen() {
  const { state, actions } = useCapsela();
  const look = state.savedLooks.find((l) => l.id === state.activeLookId);
  if (!look) return null;

  // Un look ne référence que de vraies pièces du dressing, jamais des suggestions.
  const pieces = look.pieceIds
    .map((id) => state.items.find((i) => i.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[30px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.closeLookDetail}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[22px] text-ink">{look.name}</div>
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-3">
        {pieces.length} {pieces.length === 1 ? "pièce" : "pièces"}
        {look.occasion ? " · " + OCC_LABELS[look.occasion] : ""}
      </div>
      <div className="flex flex-col gap-[10px]">
        {pieces.map((it) => (
          <div key={it.id} className="flex items-center gap-[13px] bg-card border border-border rounded-[14px] p-[11px]">
            <div
              className="w-[58px] h-[70px] rounded-lg flex-shrink-0"
              style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] text-ink">{it.name}</div>
              <div className="text-[11px] text-muted mt-[3px]">
                {CATLABEL[isBag(it) ? "sac" : it.cat]} · {it.color}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => actions.wearLookToday(look.id)}
        className="mt-7 w-full bg-terracotta text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
      >
        Porter aujourd&apos;hui
      </button>
      <button
        onClick={actions.deleteActiveLook}
        className="mt-[10px] w-full text-center border border-border-soft text-rust rounded-full py-[13px] text-[12.5px] cursor-pointer"
      >
        Supprimer ce look
      </button>
    </div>
  );
}
