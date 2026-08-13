"use client";

import AppHeader from "@/components/AppHeader";
import { CATS, wornAgo } from "@/lib/data";
import { useCapsela } from "@/lib/store";
import { neverWornItems } from "@/lib/selectors";

export default function WardrobeScreen() {
  const { state, actions } = useCapsela();
  const items = state.items;
  const neverWorn = neverWornItems(items);

  // Le dressing n'affiche que les pièces réelles ; les suggestions de la
  // capsule par défaut vivent exclusivement sur l'écran Capsule.
  const groups = CATS.map(([key, , plural]) => {
    return { key, label: plural.toUpperCase(), items: items.filter((i) => i.cat === key) };
  }).filter((g) => g.items.length > 0);

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

      {neverWorn.length > 0 && (
        <button
          onClick={actions.goNeverWorn}
          className="mt-4 w-full flex items-center gap-[11px] bg-warm-bg border border-warm-border rounded-[14px] px-4 py-[13px] cursor-pointer text-left"
        >
          <span className="w-[30px] h-[30px] rounded-full bg-terracotta text-cream flex items-center justify-center text-[14px] flex-shrink-0">
            ↻
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] text-ink">{neverWorn.length} pièce(s) jamais portée(s)</div>
            <div className="text-[11px] text-warm-text mt-[1px]">Envisage de les revendre sur Vinted</div>
          </div>
          <span className="text-terracotta text-[16px]">›</span>
        </button>
      )}

      {items.length === 0 ? (
        <>
          <div className="mt-[26px] text-center">
            <div className="font-serif text-[22px] leading-[1.25] text-ink">
              Ton dressing est encore <span className="italic text-terracotta">vide</span>
            </div>
            <div className="text-[12.5px] text-muted leading-[1.55] mt-[9px]">
              Ajoute tes premières pièces — une photo suffit. Tes tenues se construiront à partir de ce que tu
              possèdes déjà.
            </div>
          </div>
          <button
            onClick={actions.openAdd}
            className="mt-[22px] w-full bg-ink text-cream text-center rounded-full py-4 text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
          >
            Ajouter une pièce
          </button>
          <button
            onClick={actions.goCapsule}
            className="mt-[14px] w-full text-center text-[13px] text-terracotta cursor-pointer"
          >
            Découvre ta capsule ›
          </button>
        </>
      ) : (
        groups.map((g) => (
          <div key={g.key}>
            <div className="mt-6 mb-3 text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
              {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
            </div>
            <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: "x mandatory" }}>
              {g.items.map((it) => (
                <button
                  key={it.id}
                  onClick={() => actions.openItem(it.id, false)}
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
                  <div className="text-[9.5px] mt-[1px] text-placeholder">
                    {it.worn == null ? "Jamais porté" : wornAgo(it.worn)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      <div className="flex items-center justify-between mt-6 mb-3">
        <span className="text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
          Mes looks <span className="text-placeholder font-normal">({state.savedLooks.length})</span>
        </span>
        <button onClick={actions.goCreateLook} className="text-[12.5px] text-terracotta cursor-pointer">
          + Créer un look
        </button>
      </div>
      {state.savedLooks.length === 0 ? (
        <button
          onClick={actions.goCreateLook}
          className="w-full flex items-center justify-center gap-[9px] border-[1.5px] border-dashed border-[#d6c7ae] bg-card rounded-[14px] py-4 text-[13px] tracking-[.06em] text-ink cursor-pointer"
        >
          <span className="text-[17px] text-terracotta">+</span> Compose ton premier look
        </button>
      ) : (
        <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: "x mandatory" }}>
          {state.savedLooks.map((look) => {
            const pieces = look.pieceIds
              .map((id) => items.find((i) => i.id === id))
              .filter((it): it is NonNullable<typeof it> => Boolean(it));
            return (
              <button
                key={look.id}
                onClick={() => actions.openLook(look.id)}
                className="flex-none w-[104px] cursor-pointer text-left"
                style={{ scrollSnapAlign: "start" }}
              >
                <div className="w-full rounded-[11px] border border-border overflow-hidden flex" style={{ aspectRatio: "4/5" }}>
                  {pieces.slice(0, 3).map((p, i) => (
                    <div key={p.id} className="flex-1 h-full" style={{ background: p.hex, borderLeft: i > 0 ? "1px solid rgba(243,238,229,.5)" : "none" }} />
                  ))}
                </div>
                <div className="text-[11.5px] text-ink mt-[6px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                  {look.name}
                </div>
                <div className="text-[9.5px] text-placeholder mt-[1px]">
                  {pieces.length} {pieces.length === 1 ? "pièce" : "pièces"}
                </div>
              </button>
            );
          })}
        </div>
      )}

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
