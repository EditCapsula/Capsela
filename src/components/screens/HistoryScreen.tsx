"use client";

import AppHeader from "@/components/AppHeader";
import { useCapsela } from "@/lib/store";
import { historyView } from "@/lib/selectors";

export default function HistoryScreen() {
  const { state, wardrobePool, actions } = useCapsela();
  const { memory, days, weekCount } = historyView(state.history, wardrobePool);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.goTenues}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[25px] text-ink mt-[2px]">Ton journal</div>
      </div>

      <div className="mt-[18px] bg-ink rounded-2xl p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[44px] leading-[.9] text-cream">{weekCount}</span>
          <span className="text-[13px] text-[#A99C88]">tenues cette semaine</span>
        </div>
        <div className="text-[12px] text-[#A99C88] mt-2 leading-[1.4]">Ce que tu as réellement porté, jour après jour.</div>
      </div>

      {memory && (
        <div className="mt-[14px] bg-ink rounded-2xl p-[18px] border border-[rgba(217,165,126,.3)]">
          <div className="flex items-center gap-[7px]">
            <span className="font-serif italic text-[15px] text-gold">✦</span>
            <span className="text-[11px] tracking-[.14em] uppercase text-gold">{memory.title}</span>
          </div>
          <div className="text-[12px] text-[#A99C88] mt-[6px]">{memory.dateText}</div>
          <div className="flex gap-2 mt-[14px]">
            {memory.pieces.map((p) => (
              <div
                key={p.id}
                className="w-[46px] h-[56px] rounded-[7px] flex-shrink-0"
                style={{ background: p.hex, boxShadow: "inset 0 0 0 1px rgba(255,255,255,.14)" }}
              />
            ))}
          </div>
          <div className="text-[12px] text-[#C7B9A2] mt-3 leading-[1.4]">{memory.summary}</div>
          <button
            onClick={() => actions.reWear(memory.reWearIds)}
            className="mt-[15px] w-full bg-terracotta text-cream text-center rounded-full py-[14px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
          >
            Reporter cette tenue
          </button>
        </div>
      )}

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-3">Historique</div>
      <div className="flex flex-col gap-5">
        {days.map((d) => (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-[10px]">
              <span className="text-[13px] text-ink font-medium">{d.rel}</span>
              {d.isMulti && <span className="text-[11px] text-muted">{d.countText}</span>}
            </div>
            <div className="flex flex-col gap-[9px]">
              {d.entries.map((h) => (
                <div key={h.id} className="bg-card border border-border rounded-2xl px-[15px] py-[14px]">
                  {h.hasOcc && (
                    <span className="inline-block text-[10px] tracking-[.06em] uppercase text-warm-text bg-[#F0E5D4] rounded-full py-1 px-[11px]">
                      {h.occLabel}
                    </span>
                  )}
                  <div className="flex gap-[7px] mt-[11px]">
                    {h.pieces.map((p) => (
                      <div
                        key={p.id}
                        className="w-[34px] h-[42px] rounded-md flex-shrink-0"
                        style={{ background: p.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }}
                      />
                    ))}
                  </div>
                  <div className="text-[11px] text-muted mt-[10px] leading-[1.4]">{h.summary}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
