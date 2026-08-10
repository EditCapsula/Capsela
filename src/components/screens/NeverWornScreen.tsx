"use client";

import { CATLABEL } from "@/lib/data";
import { useCapsela } from "@/lib/store";
import { neverWornItems } from "@/lib/selectors";

/**
 * Pièces jamais portées de ton dressing réel — les suggestions de la
 * capsule par défaut n'y figurent pas (elles ne sont pas encore à toi).
 */
export default function NeverWornScreen() {
  const { state, actions } = useCapsela();
  const neverWorn = neverWornItems(state.items);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.goTenues}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">✦ Premium</div>
          <div className="font-serif text-[25px] text-ink mt-[2px]">Jamais portées</div>
        </div>
      </div>

      <div className="mt-[18px] flex items-start gap-[11px] bg-warm-bg border border-warm-border rounded-2xl px-4 py-[15px]">
        <span className="font-serif text-[30px] leading-[.9] text-terracotta">{neverWorn.length}</span>
        <div className="text-[12.5px] text-warm-text-2 leading-[1.45] pt-[2px]">
          pièces attendent leur tour. Mets-en une en avant aujourd&apos;hui, ou envisage de la sortir de ta capsule.
        </div>
      </div>

      {neverWorn.length === 0 && (
        <div className="text-[12.5px] text-muted mt-4 leading-[1.5]">
          Aucune pièce de ton dressing n&apos;attend son tour pour l&apos;instant.
        </div>
      )}

      <div className="flex flex-col gap-[9px] mt-4">
        {neverWorn.map((it) => (
          <div key={it.id} className="flex items-center gap-[13px] bg-card border border-border rounded-[14px] py-[11px] px-3">
            <div
              role="button"
              tabIndex={0}
              onClick={() => actions.openItem(it.id)}
              onKeyDown={(e) => e.key === "Enter" && actions.openItem(it.id)}
              className="flex items-center gap-[13px] flex-1 min-w-0 cursor-pointer"
            >
              <div
                className="w-[52px] h-[63px] rounded-lg flex-shrink-0"
                style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }}
              />
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[14px] text-ink">{it.name}</div>
                <div className="text-[11px] text-muted mt-[2px]">
                  {CATLABEL[it.cat]} · {it.color}
                </div>
              </div>
            </div>
            <button
              onClick={() => actions.wearPieceToday(it.id)}
              className="text-[11px] text-cream bg-terracotta rounded-full py-[9px] px-[15px] cursor-pointer flex-shrink-0"
            >
              Porter
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
