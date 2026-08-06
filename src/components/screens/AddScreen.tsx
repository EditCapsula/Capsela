"use client";

import { CATS, PALETTE, SEASONS } from "@/lib/data";
import { useCapsela } from "@/lib/store";

function chipClass(active: boolean) {
  return `flex-none py-[9px] px-[15px] rounded-full text-[13px] whitespace-nowrap cursor-pointer transition-all font-sans border ${
    active ? "bg-ink text-cream border-ink" : "bg-card text-muted-3 border-border"
  }`;
}

export default function AddScreen() {
  const { state, actions } = useCapsela();

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[30px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.addBack}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-2xl text-ink">Ajouter une pièce</div>
      </div>

      <div className="mt-[22px] h-[190px] rounded-2xl border-[1.5px] border-dashed border-[#C9B69A] bg-card flex flex-col items-center justify-center gap-[10px]">
        <div className="w-[54px] h-[54px] rounded-full bg-ink text-cream flex items-center justify-center text-2xl">
          ▢
        </div>
        <div className="text-[13px] text-ink">Prendre la pièce en photo</div>
        <div className="text-[11px] text-muted">ou importer depuis ta galerie</div>
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted my-6 mt-6 mb-[11px]">Nom de la pièce</div>
      <input
        className="capin w-full bg-card border border-border rounded-xl px-4 py-[14px] text-[14px] text-ink font-sans"
        value={state.addName}
        onChange={(e) => actions.setAddName(e.target.value)}
        placeholder="ex. Chemise en lin écrue"
      />

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">Catégorie</div>
      <div className="flex gap-2 flex-wrap">
        {CATS.map(([key, label]) => (
          <button key={key} onClick={() => actions.setAddCat(key)} className={chipClass(state.addCat === key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-3">Couleur dominante</div>
      <div className="flex gap-[13px] flex-wrap">
        {PALETTE.map(([name, hex]) => {
          const on = state.addColor.hex === hex;
          return (
            <button
              key={name}
              onClick={() => actions.setAddColor({ name, hex })}
              className="flex flex-col items-center gap-[6px] cursor-pointer"
            >
              <div
                className="w-[38px] h-[38px] rounded-[11px]"
                style={{
                  background: hex,
                  border: on ? "2px solid #1E1A16" : "1px solid rgba(30,26,22,.12)",
                  boxShadow: on ? "0 0 0 3px #F4EEE4 inset" : "none",
                }}
              />
              <div className={`text-[9.5px] ${on ? "text-ink" : "text-muted"}`}>{name}</div>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-6 mb-[11px]">Saison</div>
      <div className="flex gap-2 flex-wrap">
        {SEASONS.map((s) => (
          <button key={s} onClick={() => actions.setAddSeason(s)} className={chipClass(state.addSeason === s)}>
            {s}
          </button>
        ))}
      </div>

      <button
        onClick={actions.saveItem}
        className="mt-7 w-full bg-ink text-cream text-center rounded-full py-4 text-[13px] tracking-[.14em] uppercase cursor-pointer"
      >
        Ajouter à ma garde-robe
      </button>
    </div>
  );
}
