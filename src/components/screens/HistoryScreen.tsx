"use client";

import AppHeader from "@/components/AppHeader";
import { useCapsela } from "@/lib/store";
import { journalEntries, journalStats } from "@/lib/selectors";

export default function HistoryScreen() {
  const { state, wardrobePool, actions } = useCapsela();
  const stats = journalStats(state.items, state.history);
  const entries = journalEntries(state.history, wardrobePool);
  const countText = entries.length + (entries.length <= 1 ? " tenue portée" : " tenues portées");

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="text-[11px] tracking-[.18em] uppercase text-muted">{countText}</div>
      <div className="font-serif text-[28px] text-ink mt-1">Ton journal</div>

      {stats.hasItems && (
        <>
          <div className="mt-5 bg-ink rounded-2xl p-5">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-[38px] leading-[.85] text-cream">{stats.pctWorn}%</span>
              <span className="text-[12.5px] text-[#B3AA9B]">de ton dressing déjà porté</span>
            </div>
            <div className="h-[7px] bg-[#3A352D] rounded-full overflow-hidden mt-[14px]">
              <div className="h-full bg-terracotta rounded-full" style={{ width: stats.pctWorn + "%" }} />
            </div>
            <div className="text-[11.5px] text-[#B3AA9B] mt-[10px] leading-[1.5]">
              {stats.worn} portées · {stats.never} pas encore — sur {stats.total} pièces.
            </div>
          </div>
          <button
            onClick={actions.goNeverWorn}
            className="mt-[10px] w-full text-center text-[12.5px] text-terracotta cursor-pointer"
          >
            Voir les pièces jamais portées ›
          </button>
        </>
      )}

      {entries.length > 0 ? (
        <div className="flex flex-col gap-[11px] mt-[22px]">
          {entries.map((h) => (
            <div key={h.id} className="bg-card border border-border rounded-2xl px-[15px] py-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink">{h.rel}</span>
                {h.hasOccasion && (
                  <span className="text-[10px] tracking-[.08em] uppercase text-terracotta bg-[#F0E5D6] rounded-full py-1 px-[10px]">
                    {h.occLabel}
                  </span>
                )}
              </div>
              <div className="flex gap-[7px] mt-[11px]">
                {h.swatches.map((p) => (
                  <div
                    key={p.id}
                    className="w-[34px] h-[42px] rounded-md flex-shrink-0"
                    style={{ background: p.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }}
                  />
                ))}
              </div>
              <div className="text-[11px] text-muted mt-[9px] leading-[1.4]">{h.summary}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-[34px] flex flex-col items-center text-center px-4 py-9">
          <span className="w-14 h-14 rounded-full bg-[#F0E5D6] text-terracotta flex items-center justify-center text-[24px] mb-4">
            ✦
          </span>
          <div className="font-serif text-[19px] leading-[1.3] text-ink">Rien à raconter pour l&apos;instant</div>
          <div className="text-[13px] text-muted mt-2 leading-[1.5] max-w-[250px]">
            Porte une tenue pour commencer ton journal.
          </div>
          <button
            onClick={actions.goTenues}
            className="mt-5 bg-ink text-cream rounded-full py-[15px] px-[26px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
          >
            Choisir ma tenue du jour
          </button>
        </div>
      )}
    </div>
  );
}
