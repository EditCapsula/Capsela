"use client";

import { CATLABEL, OCC_LABELS, wornAgo } from "@/lib/data";
import { useCapsela } from "@/lib/store";
import { itemsWithCapsuleFlag } from "@/lib/selectors";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[11px] tracking-[.08em] uppercase text-placeholder">{label}</span>
      <span className="text-[13px] text-ink">{value}</span>
    </div>
  );
}

export default function PieceScreen() {
  const { state, actions, requirePremium } = useCapsela();
  const items = itemsWithCapsuleFlag(state);
  const active = items.find((i) => i.id === state.activeId) || items[0];
  if (!active) return null;

  const pNever = active.worn == null;
  const pToday = active.worn === 0;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[30px]">
      <button
        onClick={actions.goWardrobe}
        className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
      >
        ←
      </button>

      <div
        className="w-full rounded-[18px] border border-border overflow-hidden mt-[18px]"
        style={{ aspectRatio: "4/5", background: active.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
      />

      <div className="text-[11px] tracking-[.14em] uppercase text-muted mt-[14px]">
        {CATLABEL[active.cat].toUpperCase()}
      </div>
      <div className="font-serif text-[24px] text-ink mt-1">{active.name}</div>
      <div className="text-[13px] text-muted mt-[6px]">{active.color}</div>

      <div className="flex items-center gap-[9px] mt-5 bg-card border border-border rounded-[14px] px-4 py-[14px]">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: pNever ? "#A66950" : "#7B7366" }}
        />
        <span className="text-[13px]" style={{ color: pNever ? "#A66950" : "#7B7366" }}>
          {pNever ? "Jamais portée" : wornAgo(active.worn)}
        </span>
      </div>

      <div className="flex flex-col gap-[9px] mt-3 bg-card border border-border rounded-[14px] px-4 py-[14px]">
        {active.brand && <InfoRow label="Marque" value={active.brand} />}
        <InfoRow label="Taille" value={active.size || "—"} />
        <InfoRow label="Occasion" value={active.occasion ? OCC_LABELS[active.occasion] : "—"} />
        <InfoRow label="Saison" value={active.season} />
      </div>

      {pToday ? (
        <div className="mt-[18px] flex items-center gap-3 bg-ink rounded-2xl px-4 py-[14px]">
          <span className="w-8 h-8 rounded-full bg-terracotta text-cream flex items-center justify-center text-[15px] flex-shrink-0">
            ✓
          </span>
          <div className="flex-1">
            <div className="text-[14px] text-cream">Portée aujourd&apos;hui</div>
            <div className="text-[11px] text-cream-dark-muted mt-[2px]">Ajoutée à ton journal</div>
          </div>
          <button
            onClick={requirePremium(actions.correctActive)}
            className="flex items-center gap-1 text-[11px] text-gold cursor-pointer"
          >
            Corriger {!state.isPremium && <span className="font-serif">✦</span>}
          </button>
        </div>
      ) : (
        <button
          onClick={actions.wearActiveToday}
          className="mt-[18px] w-full bg-ink text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.1em] uppercase cursor-pointer"
        >
          Porter aujourd&apos;hui
        </button>
      )}

      <button
        onClick={actions.toggleActiveCapsule}
        className={
          active.inCapsule
            ? "mt-[18px] w-full text-center border border-terracotta text-terracotta rounded-full py-[15px] text-[13px] tracking-[.08em] uppercase cursor-pointer bg-transparent"
            : "mt-[18px] w-full bg-terracotta text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.08em] uppercase cursor-pointer"
        }
      >
        {active.inCapsule ? "Retirer de ma capsule" : "Ajouter à ma capsule"}
      </button>

      <div className="flex gap-[10px] mt-[10px]">
        <div className="flex-1 text-center border border-border-soft text-muted-3 rounded-full py-[13px] text-[12.5px] cursor-pointer">
          Modifier
        </div>
        <button
          onClick={actions.removeActive}
          className="flex-1 text-center border border-border-soft text-rust rounded-full py-[13px] text-[12.5px] cursor-pointer"
        >
          Retirer
        </button>
      </div>
    </div>
  );
}
