"use client";

import { CATLABEL, CITIES, DAYS_FR, MONTHS_FR, OCCASIONS, isBag } from "@/lib/data";
import { useCapsela } from "@/lib/store";
import { neverWornItems } from "@/lib/selectors";

export default function TenuesScreen() {
  const { state, weather, actions, requirePremium } = useCapsela();

  const now = new Date();
  const dateText = DAYS_FR[now.getDay()] + " " + now.getDate() + " " + MONTHS_FR[now.getMonth()];
  const geoCity = CITIES[(state.geoIndex || 0) % CITIES.length];
  const neverWorn = neverWornItems(state);
  const neverWornPreview = neverWorn.slice(0, 3);

  const outfitPieces = (state.outfit || [])
    .map((id) => state.items.find((i) => i.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));

  const bagMissing = !state.items.some(isBag);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex justify-between items-start gap-3">
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">{dateText}</div>
          <div className="font-serif text-[29px] text-ink mt-1">Ta tenue du jour</div>
        </div>
        <button
          onClick={requirePremium(actions.goHistory)}
          className="flex items-center gap-[6px] bg-card border border-border rounded-full py-[9px] px-[13px] cursor-pointer flex-shrink-0"
        >
          <span className="text-[12px] text-ink">Journal</span>
          {!state.isPremium && <span className="font-serif text-[11px] text-terracotta">✦</span>}
        </button>
      </div>
      <div className="text-[13px] text-muted-2 mt-2 leading-[1.5]">Une combinaison composée à partir de ta capsule.</div>

      <div className="flex items-center gap-[9px] bg-card border border-border rounded-full py-[10px] px-[15px] mt-[14px]">
        <span
          className="w-[9px] h-[9px] rounded-full bg-terracotta flex-shrink-0"
          style={{ boxShadow: "0 0 0 4px rgba(176,101,74,.16)" }}
        />
        <div className="flex-1 min-w-0 text-[13px] text-ink whitespace-nowrap overflow-hidden text-ellipsis">
          Autour de toi · {geoCity.city}
        </div>
        <span className="text-[12px] text-muted-4 whitespace-nowrap flex-shrink-0">
          {geoCity.temp}° · {geoCity.label}
        </span>
        <span className="w-px h-[14px] bg-border-soft flex-shrink-0" />
        <button onClick={actions.cycleGeo} className="text-[11px] text-terracotta tracking-[.04em] cursor-pointer flex-shrink-0">
          Modifier
        </button>
      </div>

      <div className="flex gap-3 mt-4">
        <div className="flex-1 bg-card border border-border rounded-2xl p-[15px]">
          <div className="font-serif text-[26px] text-ink">{state.lookCount}</div>
          <div className="text-[12px] text-muted-2 mt-[2px]">looks portés</div>
        </div>
        <div className="flex-1 bg-warm-bg border border-warm-border rounded-2xl p-[15px]">
          <div className="font-serif text-[26px] text-terracotta">{neverWorn.length}</div>
          <div className="text-[12px] text-warm-text mt-[2px]">jamais portées</div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-[22px] mb-[10px]">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">Occasion</span>
        {!state.isPremium && (
          <button onClick={actions.goPremium} className="flex items-center gap-[5px] text-[10.5px] tracking-[.03em] text-terracotta cursor-pointer">
            <span className="font-serif">✦</span> Premium
          </button>
        )}
      </div>
      <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px]">
        {OCCASIONS.map(([key, label]) => {
          const on = (state.occasion || "all") === key && state.isPremium;
          return (
            <button
              key={key}
              onClick={requirePremium(() => actions.setOccasion(key))}
              className="flex-none text-center py-[9px] px-4 rounded-full text-[12.5px] cursor-pointer whitespace-nowrap font-sans transition-all border"
              style={{
                background: on ? "#1E1A16" : "transparent",
                color: on ? "#F4EEE4" : "#6E6557",
                borderColor: on ? "#1E1A16" : "#E2D9CC",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center mt-6 mb-3">
        <span className="text-[11px] tracking-[.16em] uppercase text-muted">La combinaison</span>
        <button onClick={actions.regenOutfit} className="text-[12px] text-terracotta tracking-[.03em] cursor-pointer">
          ↻ Régénérer
        </button>
      </div>
      <div className="flex items-start gap-[9px] mb-3 bg-card border border-border rounded-[14px] py-[11px] px-[14px]">
        <span className="w-[7px] h-[7px] rounded-full bg-terracotta mt-1 flex-shrink-0" />
        <div className="text-[12px] text-muted-3 leading-[1.45]">
          Météo à {geoCity.city} : {geoCity.temp}° ({geoCity.label.toLowerCase()}) — priorité aux tenues de{" "}
          {weather.season.toLowerCase()} et toutes saisons.
        </div>
      </div>
      <div className="flex flex-col gap-[10px]">
        {outfitPieces.map((it) => {
          const isLocked = (state.lockedPieces || []).includes(it.id);
          const activeLock = state.isPremium && isLocked;
          return (
            <div key={it.id} className="flex items-center gap-[13px] bg-card border border-border rounded-[14px] p-[11px]">
              <div
                className="w-[58px] h-[70px] rounded-lg flex-shrink-0"
                style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] text-ink">{it.name}</div>
                <div className="flex items-center gap-2 mt-[3px]">
                  <span className="text-[11px] text-muted">
                    {it.color} · {it.season}
                  </span>
                  <span className="text-[9px] tracking-[.1em] uppercase text-[#C7BBA8]">
                    · {isBag(it) ? "Sac" : CATLABEL[it.cat]}
                  </span>
                </div>
              </div>
              <button
                onClick={requirePremium(() => actions.toggleLock(it.id))}
                className="w-[30px] h-[30px] rounded-full flex-shrink-0 cursor-pointer text-[13px] flex items-center justify-center border"
                style={{
                  background: activeLock ? "#1E1A16" : "#F1EADD",
                  color: activeLock ? "#F4EEE4" : "#B6AB99",
                  borderColor: activeLock ? "#1E1A16" : "#E4D8C2",
                }}
              >
                {activeLock ? "🔒" : "🔓"}
              </button>
            </div>
          );
        })}
      </div>

      {bagMissing && (
        <div className="mt-[10px] bg-warm-bg border border-warm-border rounded-2xl p-[15px]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-[52px] rounded-[10px] border-[1.5px] border-dashed border-[#C9966F] bg-[#F0E4D2] flex items-center justify-center text-xl text-terracotta flex-shrink-0">
              ▢
            </div>
            <div className="flex-1">
              <div className="text-[14px] text-ink">Il manque un sac à ta garde-robe</div>
              <div className="text-[11.5px] text-warm-text-2 mt-[3px] leading-[1.4]">
                Une tenue n&apos;est vraiment complète qu&apos;avec le bon sac. Ajoute les tiens pour qu&apos;ils entrent
                dans tes tenues du jour.
              </div>
            </div>
          </div>
          <button
            onClick={actions.openAddBag}
            className="mt-[13px] w-full bg-terracotta text-cream text-center rounded-full py-[13px] text-[12.5px] tracking-[.1em] uppercase cursor-pointer"
          >
            Ajouter un sac
          </button>
        </div>
      )}

      {state.outfitValidated ? (
        <div className="mt-[18px] flex items-center gap-3 bg-ink rounded-2xl py-[15px] px-[17px]">
          <span className="w-[34px] h-[34px] rounded-full bg-terracotta text-cream flex items-center justify-center text-base flex-shrink-0">
            ✓
          </span>
          <div className="flex-1">
            <div className="text-[14px] text-cream">Porté aujourd&apos;hui</div>
            <div className="text-[11px] text-[#A99C88] mt-[2px]">Compté dans tes stats · pièces mises à jour</div>
          </div>
          <button onClick={actions.regenOutfit} className="text-[11px] text-gold cursor-pointer">
            Autre
          </button>
        </div>
      ) : (
        <div className="flex gap-[10px] mt-[18px]">
          <button
            onClick={actions.regenOutfit}
            className="flex-1 border border-ink text-ink text-center rounded-full py-[15px] text-[12.5px] tracking-[.06em] cursor-pointer"
          >
            Proposer autre chose
          </button>
          <button
            onClick={actions.wearOutfitToday}
            className="flex-[1.3] bg-terracotta text-cream text-center rounded-full py-[15px] text-[12.5px] tracking-[.06em] cursor-pointer"
          >
            Porté aujourd&apos;hui ✓
          </button>
        </div>
      )}

      {neverWorn.length > 0 && (
        <>
          <div className="flex justify-between items-center mt-[26px] mb-[10px]">
            <span className="text-[11px] tracking-[.16em] uppercase text-muted">Jamais portées · {neverWorn.length}</span>
            <button
              onClick={requirePremium(actions.goNeverWorn)}
              className="flex items-center gap-[5px] text-[12px] text-terracotta cursor-pointer"
            >
              Tout voir {!state.isPremium && <span className="font-serif">✦</span>}
            </button>
          </div>
          <div className="flex items-start gap-[10px] bg-warm-bg border border-warm-border rounded-[14px] py-[13px] px-[15px]">
            <span className="text-[15px] text-terracotta mt-px">⌛</span>
            <div className="text-[12px] text-warm-text-2 leading-[1.45]">
              Ces pièces n&apos;ont jamais été portées. Mets-en une en avant aujourd&apos;hui.
            </div>
          </div>
          <div className="flex flex-col gap-[9px] mt-3">
            {neverWornPreview.map((it) => (
              <div key={it.id} className="flex items-center gap-[13px] bg-card border border-border rounded-[14px] py-[10px] px-3">
                <div
                  className="w-[46px] h-[56px] rounded-lg flex-shrink-0"
                  style={{ background: it.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-ink">{it.name}</div>
                  <div className="text-[11px] text-muted mt-[2px]">
                    {CATLABEL[it.cat]} · {it.color}
                  </div>
                </div>
                <button
                  onClick={() => actions.wearPieceToday(it.id)}
                  className="text-[11px] text-terracotta border border-warm-border rounded-full py-2 px-[13px] cursor-pointer flex-shrink-0"
                >
                  Porter
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
