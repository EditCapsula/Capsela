"use client";

import { CATS, CATLABEL } from "@/lib/data";
import { useCapsela } from "@/lib/store";

export default function CreateLookScreen() {
  const { state, actions } = useCapsela();
  const items = state.items;

  const groups = CATS.map(([key, , plural]) => ({
    key,
    label: plural.toUpperCase(),
    items: items.filter((i) => i.cat === key),
  })).filter((g) => g.items.length > 0);

  const count = state.lookDraftIds.length;
  const canSave = count >= 2;

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[30px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.cancelCreateLook}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[22px] text-ink">Créer un look</div>
      </div>
      <div className="text-[13px] text-muted mt-4 leading-[1.5]">
        Choisis les pièces de ton dressing à combiner, tu pourras la reporter d&apos;un tap.
      </div>

      {items.length === 0 && (
        <div className="mt-6 bg-card border border-border rounded-2xl px-4 py-[18px] text-center text-[13px] text-muted leading-[1.5]">
          Ton dressing est encore vide — ajoute quelques pièces réelles pour pouvoir composer un look.
        </div>
      )}

      {groups.map((g) => (
        <div key={g.key}>
          <div className="mt-6 mb-3 text-[12px] tracking-[.1em] uppercase text-ink font-semibold">
            {g.label} <span className="text-placeholder font-normal">({g.items.length})</span>
          </div>
          <div className="scrollarea flex gap-[9px] overflow-x-auto pb-[2px]" style={{ scrollSnapType: "x mandatory" }}>
            {g.items.map((it) => {
              const on = state.lookDraftIds.includes(it.id);
              return (
                <button
                  key={it.id}
                  onClick={() => actions.toggleLookDraftPiece(it.id)}
                  className="flex-none w-[104px] cursor-pointer text-left"
                  style={{ scrollSnapAlign: "start" }}
                >
                  <div
                    className="relative w-full rounded-[11px] overflow-hidden"
                    style={{
                      aspectRatio: "4/5",
                      background: it.hex,
                      border: on ? "2px solid #1D1A16" : "1px solid #E6DCCB",
                      boxShadow: on ? "0 0 0 2px #F3EEE5 inset" : "inset 0 0 0 1px rgba(29,26,22,.06)",
                    }}
                  >
                    {on && (
                      <span className="absolute top-[7px] right-[7px] w-5 h-5 rounded-full bg-ink text-cream flex items-center justify-center text-[11px]">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-ink mt-[6px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                    {it.name}
                  </div>
                  <div className="text-[9.5px] text-placeholder mt-[1px]">{CATLABEL[it.cat]}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-3">
        Nom du look <span className="opacity-60 normal-case tracking-normal">(optionnel)</span>
      </div>
      <input
        className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
        value={state.lookDraftName}
        onChange={(e) => actions.setLookDraftName(e.target.value)}
        placeholder="ex. Look bureau"
      />

      <button
        onClick={actions.saveLook}
        className={
          "mt-7 w-full text-center rounded-full py-4 text-[13px] tracking-[.14em] uppercase " +
          (canSave ? "bg-terracotta text-cream cursor-pointer" : "bg-[#dccfbc] text-[#8a7c68] cursor-not-allowed")
        }
      >
        Enregistrer ce look {count > 0 ? `(${count})` : ""}
      </button>
      {!canSave && (
        <div className="text-center text-[11.5px] text-terracotta mt-[10px]">
          Choisis au moins 2 pièces pour enregistrer ce look.
        </div>
      )}
    </div>
  );
}
