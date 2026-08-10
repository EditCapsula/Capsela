"use client";

import AppHeader from "@/components/AppHeader";
import { CATS } from "@/lib/data";
import { CATALOG } from "@/lib/catalog";
import { GENDERS } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import { capsuleBreakdown, neverWornItems } from "@/lib/selectors";

export default function CapsuleScreen() {
  const { defaultCapsule, wardrobePool, actions } = useCapsela();
  const { profile } = useAuth();

  const total = CATALOG.length;
  const neverWorn = neverWornItems(wardrobePool);
  const wornCount = wardrobePool.length - neverWorn.length;
  const neverWornPct = wardrobePool.length ? Math.round((neverWorn.length / wardrobePool.length) * 100) : 0;
  const rows = capsuleBreakdown(defaultCapsule);
  const styleLabel = profile.styles[0] || GENDERS.find((g) => g.key === profile.gender)?.label || "ton profil";

  const groups = CATS.map(([key, , plural]) => ({
    key,
    label: plural.toUpperCase(),
    items: defaultCapsule.filter((i) => i.cat === key),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <AppHeader />

      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.goWardrobe}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">Proposée pour toi</div>
          <div className="font-serif text-[24px] text-ink mt-[2px]">Ta capsule</div>
        </div>
      </div>

      <div className="mt-[18px] flex items-start gap-[11px] bg-card border border-border rounded-[14px] px-4 py-[14px]">
        <span className="font-serif italic text-[15px] text-terracotta">✦</span>
        <div className="text-[12.5px] text-muted-3 leading-[1.5]">
          Composée à partir de ton style{" "}
          <span className="text-terracotta">{styleLabel}</span>{" "}
          et de tes couleurs préférées — le temps que tu remplisses ton dressing. Elle s&apos;ajustera
          automatiquement dès que tu ajouteras tes propres pièces.
        </div>
      </div>

      <div className="mt-[22px] bg-ink rounded-[20px] p-[22px]">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-[46px] leading-[.85] text-cream">{defaultCapsule.length}</span>
          <span className="text-[13px] text-cream-dark-muted">pièces sélectionnées sur {total}</span>
        </div>
      </div>

      <div className="flex gap-[10px] mt-3">
        <button
          onClick={actions.goNeverWorn}
          className="flex-1 bg-card border border-border rounded-2xl p-[14px] text-left cursor-pointer"
        >
          <div className="font-serif text-[24px] text-ink">{neverWorn.length}</div>
          <div className="text-[11px] text-muted mt-[2px] leading-[1.3]">jamais portées ›</div>
        </button>
        <div className="flex-1 bg-card border border-border rounded-2xl p-[14px]">
          <div className="font-serif text-[24px] text-ink">{wornCount}</div>
          <div className="text-[11px] text-muted mt-[2px] leading-[1.3]">déjà portées</div>
        </div>
        <div className="flex-1 bg-card border border-border rounded-2xl p-[14px]">
          <div className="font-serif text-[24px] text-terracotta">{neverWornPct}%</div>
          <div className="text-[11px] text-muted mt-[2px] leading-[1.3]">non portées</div>
        </div>
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[22px] mb-3">Répartition</div>
      <div className="flex flex-col gap-3 bg-card border border-border rounded-2xl p-4">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-[11px]">
            <span className="w-24 text-[12px] text-[#3F3B34] flex-shrink-0">{r.label}</span>
            <div className="flex-1 h-2 bg-[#EFE7DA] rounded-full overflow-hidden">
              <div className="h-full bg-terracotta rounded-full" style={{ width: r.pct + "%" }} />
            </div>
            <span className="text-[12px] text-ink w-4 text-right flex-shrink-0">{r.count}</span>
          </div>
        ))}
      </div>

      {groups.map((g) => (
        <div key={g.key}>
          <div className="mt-6 mb-3 text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
            {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
          </div>
          <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: "x mandatory" }}>
            {g.items.map((it) => (
              <div key={it.id} className="flex-none w-[104px]" style={{ scrollSnapAlign: "start" }}>
                <div
                  className="w-full rounded-[11px] border border-border"
                  style={{ aspectRatio: "4/5", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }}
                />
                <div className="text-[11.5px] text-ink mt-[6px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                  {it.name}
                </div>
                <div className="text-[9.5px] text-terracotta mt-[1px]">Suggestion</div>
                <button
                  onClick={() => actions.startReplace(it.id, it.cat)}
                  className="mt-[6px] w-full text-center text-[10.5px] text-muted border border-border rounded-full py-[6px] px-2 cursor-pointer"
                >
                  Remplacer
                </button>
                <button
                  onClick={() => actions.dismissSuggested(it.id)}
                  className="mt-[6px] w-full text-center text-[10.5px] text-[#9C6B5A] border border-border rounded-full py-[6px] px-2 cursor-pointer"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={actions.goTenues}
        className="mt-[22px] w-full bg-terracotta text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
      >
        Voir ma tenue du jour
      </button>
    </div>
  );
}
