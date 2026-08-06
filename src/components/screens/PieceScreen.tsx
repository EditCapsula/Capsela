"use client";

import { CATLABEL, wornAgo } from "@/lib/data";
import { useCapsela } from "@/lib/store";
import { itemsWithCapsuleFlag } from "@/lib/selectors";

export default function PieceScreen() {
  const { state, actions, requirePremium } = useCapsela();
  const items = itemsWithCapsuleFlag(state);
  const active = items.find((i) => i.id === state.activeId) || items[0];
  if (!active) return null;

  const pNever = active.worn == null;
  const pToday = active.worn === 0;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto">
      <div className="relative h-[360px] flex items-start p-4" style={{ background: active.hex }}>
        <button
          onClick={actions.goWardrobe}
          className="w-[38px] h-[38px] rounded-full bg-[rgba(244,238,228,.92)] flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <span
          className="absolute top-[18px] right-4 text-[10px] tracking-[.04em] py-[6px] px-[11px] rounded-full"
          style={{
            background: pNever ? "#F6ECDD" : "rgba(244,238,228,.92)",
            color: pNever ? "#B0654A" : "#4A443C",
          }}
        >
          {pNever ? "Jamais portée" : "Portée récemment"}
        </span>
        <span className="absolute bottom-4 left-[18px] text-[10px] tracking-[.14em] uppercase text-white/80">
          {CATLABEL[active.cat]}
        </span>
      </div>

      <div className="px-6 pt-[22px] pb-[30px]">
        <div className="font-serif text-[28px] leading-[1.05] text-ink">{active.name}</div>
        <div className="text-[13px] text-muted mt-[6px]">
          {active.color} · {CATLABEL[active.cat]}
        </div>

        <div className="flex gap-[10px] mt-5">
          <div className="flex-1 bg-card border border-border rounded-[14px] p-[14px] text-center">
            <div className="text-[11px] text-muted">Dernier port</div>
            <div className={`text-[14px] mt-[5px] ${pNever ? "text-terracotta" : "text-muted-4"}`}>
              {wornAgo(active.worn)}
            </div>
          </div>
          <div className="flex-1 bg-card border border-border rounded-[14px] p-[14px] text-center">
            <div className="text-[11px] text-muted">Saison</div>
            <div className="font-serif text-[17px] text-ink mt-[6px]">{active.season}</div>
          </div>
        </div>

        <div
          className="mt-[18px] flex items-center gap-[13px] rounded-2xl px-4 py-[15px] border"
          style={{
            background: active.inCapsule ? "#1E1A16" : "#FBF8F2",
            borderColor: active.inCapsule ? "#1E1A16" : "#E8DFD2",
          }}
        >
          <span
            className="w-[34px] h-[34px] rounded-full flex-shrink-0 flex items-center justify-center text-[14px]"
            style={{
              background: active.inCapsule ? "#B0654A" : "#F0E5D4",
              color: active.inCapsule ? "#F4EEE4" : "#B0654A",
            }}
          >
            ✦
          </span>
          <div className="flex-1">
            <div className={`text-[14px] ${active.inCapsule ? "text-cream" : "text-ink"}`}>
              {active.inCapsule ? "Dans ta capsule" : "Hors de ta capsule"}
            </div>
            <div className={`text-[11.5px] mt-[2px] leading-[1.4] ${active.inCapsule ? "text-[#A99C88]" : "text-muted"}`}>
              {active.inCapsule ? "Compte parmi tes 30-40 essentiels." : "Ajoute-la pour l’inclure dans ta sélection."}
            </div>
          </div>
        </div>

        {pToday ? (
          <div className="mt-[18px] flex items-center gap-3 bg-ink rounded-2xl px-4 py-[14px]">
            <span className="w-8 h-8 rounded-full bg-terracotta text-cream flex items-center justify-center text-[15px] flex-shrink-0">
              ✓
            </span>
            <div className="flex-1">
              <div className="text-[14px] text-cream">Portée aujourd&apos;hui</div>
              <div className="text-[11px] text-[#A99C88] mt-[2px]">Ajoutée à ton journal</div>
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
              ? "mt-[10px] w-full text-center border border-ink text-ink rounded-full py-[15px] text-[13px] tracking-[.1em] uppercase cursor-pointer"
              : "mt-[10px] w-full bg-terracotta text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.1em] uppercase cursor-pointer"
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
    </div>
  );
}
