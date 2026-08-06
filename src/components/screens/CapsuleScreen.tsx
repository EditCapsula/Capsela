"use client";

import { CATLABEL } from "@/lib/data";
import { useCapsela, CAP_SEASONS } from "@/lib/store";
import { breakdown, gaugeInfo, itemsWithCapsuleFlag } from "@/lib/selectors";

export default function CapsuleScreen() {
  const { state, actions } = useCapsela();
  const items = itemsWithCapsuleFlag(state);
  const gauge = gaugeInfo(state);
  const rows = breakdown(state);

  const statusBg =
    gauge.status === "under" ? "rgba(217,165,126,.14)" : gauge.status === "ok" ? "rgba(124,154,110,.18)" : "rgba(158,75,46,.20)";
  const statusDot = gauge.status === "under" ? "#D9A57E" : gauge.status === "ok" ? "#8FB27A" : "#D98A6E";

  const dupSources = CAP_SEASONS.filter(
    (name) => name !== state.activeSeason && (state.capsules[name] || []).length > 0
  );

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex justify-between items-start gap-3">
        <div>
          <button
            onClick={actions.toggleSeasonPicker}
            className="inline-flex items-center gap-[6px] cursor-pointer"
          >
            <span className="text-[11px] tracking-[.18em] uppercase text-muted">
              Ta sélection · {state.activeSeason}
            </span>
            <span className="text-[9px] text-terracotta">▼</span>
          </button>
          <div className="font-serif text-[29px] text-ink mt-1">Ma capsule</div>
          <div className="text-[12.5px] text-muted-2 mt-[6px] leading-[1.45]">Tes 30-40 essentiels qui vont ensemble.</div>
        </div>
        <button
          onClick={actions.toggleCapInfo}
          className="w-7 h-7 rounded-full flex items-center justify-center font-serif italic text-[16px] cursor-pointer flex-shrink-0 border"
          style={{
            background: state.capInfoOpen ? "#1E1A16" : "#FBF8F2",
            color: state.capInfoOpen ? "#F4EEE4" : "#6E6557",
            borderColor: state.capInfoOpen ? "#1E1A16" : "#E8DFD2",
          }}
        >
          ?
        </button>
      </div>

      {state.seasonPickerOpen && (
        <div className="mt-[14px] bg-cream border border-border rounded-2xl p-4">
          <div className="text-[11px] tracking-[.16em] uppercase text-muted mb-[11px]">Capsule de la saison</div>
          <div className="flex flex-col gap-2">
            {CAP_SEASONS.map((name) => {
              const n = (state.capsules[name] || []).length;
              const active = name === state.activeSeason;
              return (
                <button
                  key={name}
                  onClick={() => actions.setSeason(name)}
                  className="flex items-center gap-[11px] py-[13px] px-[14px] rounded-[13px] cursor-pointer border w-full"
                  style={{ background: active ? "#1E1A16" : "#FBF8F2", borderColor: active ? "#1E1A16" : "#E8DFD2" }}
                >
                  <span
                    className="flex-1 font-serif text-[16px] text-left"
                    style={{ color: active ? "#F4EEE4" : "#1E1A16" }}
                  >
                    {name}
                  </span>
                  <span className="text-[12px]" style={{ color: active ? "#A99C88" : "#9C8E78" }}>
                    {n + (n > 1 ? " pièces" : " pièce")}
                  </span>
                  <span
                    className="w-5 h-5 rounded-full flex-shrink-0 text-[11px] flex items-center justify-center border"
                    style={{
                      background: active ? "#B0654A" : "transparent",
                      color: active ? "#F4EEE4" : "transparent",
                      borderColor: active ? "#B0654A" : "#D8CBB6",
                    }}
                  >
                    {active ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {dupSources.length > 0 && (
            <>
              <div className="h-px bg-border my-[15px] mt-[15px] mb-[13px]" />
              <div className="text-[11px] tracking-[.14em] uppercase text-muted mb-[10px]">Repartir d&apos;une autre saison</div>
              <div className="flex flex-col gap-2">
                {dupSources.map((name) => (
                  <button
                    key={name}
                    onClick={() => actions.duplicateFrom(name)}
                    className="flex items-center gap-[9px] bg-card border border-border rounded-full py-3 px-4 text-[12.5px] text-ink cursor-pointer w-full"
                  >
                    <span className="text-terracotta">⧉</span>Dupliquer « {name} » ici
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {state.capInfoOpen && (
        <div className="mt-[14px] bg-warm-bg border border-warm-border rounded-2xl px-[17px] py-4">
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-[15px] text-terracotta">✦</span>
            <span className="text-[11px] tracking-[.16em] uppercase text-terracotta">Qu&apos;est-ce qu&apos;une capsule ?</span>
          </div>
          <p className="mt-[11px] text-[13px] leading-[1.55] text-[#5A5145]">
            Une capsule, ce sont <b className="font-medium text-ink">30 à 40 pièces choisies pour toutes aller ensemble</b>.
            Tu piges dedans chaque jour : moins de « rien à me mettre », des décisions plus rapides, et tu portes enfin
            tout ce que tu as.
          </p>
          <div className="flex flex-col gap-[9px] mt-[13px]">
            <div className="flex items-start gap-[9px] text-[12.5px] text-[#5A5145] leading-[1.4]">
              <span className="text-terracotta mt-px">·</span>Ta <b className="font-medium text-ink">garde-robe</b> = tout ce
              que tu possèdes.
            </div>
            <div className="flex items-start gap-[9px] text-[12.5px] text-[#5A5145] leading-[1.4]">
              <span className="text-terracotta mt-px">·</span>Ta <b className="font-medium text-ink">capsule</b> = la sélection
              resserrée du moment.
            </div>
            <div className="flex items-start gap-[9px] text-[12.5px] text-[#5A5145] leading-[1.4]">
              <span className="text-terracotta mt-px">·</span>L&apos;app génère tes{" "}
              <b className="font-medium text-ink">tenues du jour</b> à partir d&apos;elle.
            </div>
          </div>
        </div>
      )}

      <div className="mt-[18px] bg-ink rounded-[22px] p-6">
        <div className="flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[64px] leading-[.8] text-cream">{gauge.capCount}</span>
            <span className="text-[14px] text-[#A99C88]">/ 40 pièces</span>
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-[.16em] uppercase text-[#A99C88]">Cible idéale</div>
            <div className="font-serif italic text-[20px] text-gold mt-[2px]">30 – 40</div>
          </div>
        </div>

        <div className="h-3 bg-[#3A342B] rounded-full mt-[18px] relative overflow-hidden">
          <div className="absolute left-[75%] right-0 top-0 bottom-0 bg-[rgba(217,165,126,.20)]" />
          <div
            className="absolute left-0 top-0 bottom-0 rounded-full transition-[width] duration-300"
            style={{ width: gauge.frac * 100 + "%", background: gauge.overCapacity ? "#9E4B2E" : "#B0654A" }}
          />
          <div className="absolute left-[75%] top-0 bottom-0 w-[1.5px] bg-[rgba(217,165,126,.6)]" />
        </div>
        <div className="flex justify-between mt-2 text-[10px] text-[#7C7264] tracking-[.04em]">
          <span>0</span>
          <span className="text-gold">30 · seuil capsule</span>
          <span>40</span>
        </div>

        <div className="flex items-center gap-[9px] mt-4 rounded-xl py-3 px-[14px]" style={{ background: statusBg }}>
          <span className="w-[9px] h-[9px] rounded-full flex-shrink-0" style={{ background: statusDot }} />
          <span className="text-[12.5px] text-cream leading-[1.4]">{gauge.statusText}</span>
        </div>
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[14px]">Répartition par catégorie</div>
      <div className="flex flex-col gap-[14px] bg-card border border-border rounded-2xl px-4 py-[18px]">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3">
            <span className="w-[84px] text-[12px] text-muted-4 flex-shrink-0">{r.label}</span>
            <div className="flex-1 h-2 bg-[#EADFCF] rounded-full overflow-hidden">
              <div
                className="h-full bg-terracotta rounded-full transition-[width] duration-300"
                style={{ width: r.pct + "%" }}
              />
            </div>
            <span className="text-[12px] text-ink w-[38px] text-right flex-shrink-0">
              {r.inCount} / {r.total}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between items-center mt-6 mb-3">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Tes pièces</span>
        <span className="text-[11px] text-muted">Appuie pour ajouter / retirer</span>
      </div>
      <div className="flex flex-col gap-[9px]">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => actions.toggleCapsule(it.id)}
            className="flex items-center gap-[13px] py-[10px] px-3 rounded-[14px] cursor-pointer border w-full text-left"
            style={{
              background: it.inCapsule ? "#FBF8F2" : "#F1EADD",
              borderColor: it.inCapsule ? "#E8DFD2" : "#E6DCC9",
              opacity: it.inCapsule ? 1 : 0.72,
            }}
          >
            <div
              className="w-11 h-[54px] rounded-lg flex-shrink-0"
              style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-ink whitespace-nowrap overflow-hidden text-ellipsis">{it.name}</div>
              <div className="text-[11px] text-muted mt-[2px]">
                {CATLABEL[it.cat]} · {it.color}
              </div>
            </div>
            <span
              className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-medium border"
              style={{
                background: it.inCapsule ? "#B0654A" : "transparent",
                color: it.inCapsule ? "#F4EEE4" : "transparent",
                borderColor: it.inCapsule ? "#B0654A" : "#C9B69A",
              }}
            >
              {it.inCapsule ? "✓" : ""}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
