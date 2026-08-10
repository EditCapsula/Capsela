"use client";

import AppHeader from "@/components/AppHeader";
import { CATS, wornAgo } from "@/lib/data";
import { useCapsela } from "@/lib/store";

export default function WardrobeScreen() {
  const { state, actions } = useCapsela();
  const items = state.items;

  const groups = CATS.map(([key, , plural]) => ({
    key,
    label: plural.toUpperCase(),
    items: items.filter((i) => i.cat === key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="flex justify-between items-end mt-[18px]">
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">
            {items.length} {items.length === 1 ? "pièce" : "pièces"}
          </div>
          <div className="font-serif text-[28px] text-ink mt-1">Ton dressing</div>
        </div>
        <button
          onClick={actions.openAdd}
          className="w-[42px] h-[42px] rounded-full bg-ink text-cream flex items-center justify-center text-2xl cursor-pointer flex-shrink-0"
        >
          +
        </button>
      </div>

      {groups.map((g) => (
        <div key={g.key}>
          <div className="mt-6 mb-3 text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
            {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
          </div>
          <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: "x mandatory" }}>
            {g.items.map((it) => (
              <button
                key={it.id}
                onClick={() => actions.openItem(it.id)}
                className="flex-none w-[104px] cursor-pointer text-left"
                style={{ scrollSnapAlign: "start" }}
              >
                <div
                  className="w-full rounded-[11px] border border-border overflow-hidden"
                  style={{ aspectRatio: "4/5", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
                />
                <div className="text-[11.5px] text-ink mt-[6px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                  {it.name}
                </div>
                <div className={"text-[9.5px] mt-[1px] " + (it.worn == null ? "text-terracotta" : "text-placeholder")}>
                  {it.worn == null ? "Jamais portée" : wornAgo(it.worn)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={actions.openAdd}
        className="mt-4 w-full flex items-center justify-center gap-[9px] border-[1.5px] border-dashed border-[#d6c7ae] bg-card rounded-[14px] py-4 text-[13px] tracking-[.06em] text-ink cursor-pointer"
      >
        <span className="text-[17px] text-terracotta">+</span> Ajouter une pièce
      </button>
      <button
        onClick={actions.goTenues}
        className="mt-[22px] w-full bg-terracotta text-cream text-center rounded-full py-[15px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
      >
        Voir ma tenue du jour
      </button>
    </div>
  );
}
