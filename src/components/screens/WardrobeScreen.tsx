"use client";

import { CATS, CATLABEL, wornAgo } from "@/lib/data";
import { useCapsela } from "@/lib/store";
import { itemsWithCapsuleFlag } from "@/lib/selectors";
import type { CategoryKey, Season } from "@/lib/types";

const SEASON_OPTIONS: Season[] = ["Printemps", "Été", "Automne", "Hiver"];

export default function WardrobeScreen() {
  const { state, actions } = useCapsela();
  const items = itemsWithCapsuleFlag(state);

  const catChips: { key: CategoryKey | "all"; label: string; count: number }[] = [
    { key: "all", label: "Tout", count: items.length },
    ...CATS.map(([key, , plural]) => ({ key, label: plural, count: items.filter((i) => i.cat === key).length })),
  ];

  const seasonChips: { key: Season | "all"; label: string }[] = [
    { key: "all", label: "Toutes saisons" },
    ...SEASON_OPTIONS.map((s) => ({ key: s, label: s })),
  ];

  const filtered = items.filter(
    (it) =>
      (state.catFilter === "all" || it.cat === state.catFilter) &&
      (state.seasonFilter === "all" || it.season === state.seasonFilter || it.season === "Toutes saisons")
  );

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex justify-between items-end">
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">{items.length} pièces</div>
          <div className="font-serif text-[29px] text-ink mt-1">Ma garde-robe</div>
        </div>
        <button
          onClick={actions.openAdd}
          className="w-[42px] h-[42px] rounded-full bg-ink text-cream flex items-center justify-center text-2xl cursor-pointer"
        >
          +
        </button>
      </div>

      <div className="scrollarea flex gap-2 mt-[18px] overflow-x-auto pb-[2px]">
        {catChips.map((c) => {
          const active = state.catFilter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => actions.setCatFilter(c.key)}
              className={`flex-none py-[9px] px-[15px] rounded-full text-[13px] whitespace-nowrap cursor-pointer transition-all font-sans border ${
                active ? "bg-ink text-cream border-ink" : "bg-card text-muted-3 border-border"
              }`}
            >
              {c.label} <span className="opacity-50">{c.count}</span>
            </button>
          );
        })}
      </div>

      <div className="scrollarea flex gap-2 mt-[11px] overflow-x-auto pb-[2px]">
        {seasonChips.map((c) => {
          const active = state.seasonFilter === c.key;
          return (
            <button
              key={c.key}
              onClick={() => actions.setSeasonFilter(c.key)}
              className={`flex-none py-[7px] px-[13px] rounded-full text-[12px] whitespace-nowrap cursor-pointer transition-all font-sans border ${
                active ? "bg-chip-soft-bg text-chip-soft-text border-chip-soft-border" : "bg-transparent text-muted border-[#EADFCF]"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col mt-4 bg-card border border-border rounded-2xl overflow-hidden">
        {filtered.map((it) => (
          <button
            key={it.id}
            onClick={() => actions.openItem(it.id)}
            className="flex items-center gap-[14px] px-[15px] py-[13px] border-b border-[#EFE7DA] last:border-b-0 cursor-pointer text-left w-full"
          >
            <div
              className="relative w-[50px] h-[62px] rounded-[9px] flex-shrink-0"
              style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }}
            >
              {it.inCapsule && (
                <span className="absolute top-[5px] right-[5px] w-4 h-4 rounded-full bg-terracotta text-cream flex items-center justify-center text-[9px]">
                  ✦
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14.5px] text-ink whitespace-nowrap overflow-hidden text-ellipsis">{it.name}</div>
              <div className="flex items-center gap-[7px] mt-1">
                <span
                  className="w-[9px] h-[9px] rounded-full flex-shrink-0"
                  style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.12)" }}
                />
                <span className="text-[11.5px] text-muted">
                  {CATLABEL[it.cat]} · {it.color} · {it.season}
                </span>
              </div>
              <div className={`text-[11px] mt-1 tracking-[.02em] ${it.worn == null ? "text-terracotta" : "text-muted"}`}>
                {wornAgo(it.worn)}
              </div>
            </div>
            <span className="text-[18px] text-[#C7BBA8] flex-shrink-0">›</span>
          </button>
        ))}
      </div>

      <button
        onClick={actions.openAdd}
        className="mt-4 flex items-center justify-center gap-[9px] border-[1.5px] border-dashed border-[#C9B69A] bg-card rounded-[14px] py-4 text-[13px] tracking-[.06em] text-ink cursor-pointer w-full"
      >
        <span className="text-[17px] text-terracotta">+</span> Ajouter une pièce
      </button>
    </div>
  );
}
