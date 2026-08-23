"use client";

import { CATS, wornAgo } from "@/lib/data";
import { useCapsela } from "@/lib/store";

/** Détail complet du dressing par catégorie (recette 23/08/2026) — déplacé depuis l'écran Dressing pour lui laisser sa mise en avant sur Mes looks, accessible via "Mes pièces → Voir tout". */
export default function WardrobePiecesScreen() {
  const { state, actions } = useCapsela();
  const items = state.items;

  const groups = CATS.map(([key, , plural]) => {
    return { key, label: plural.toUpperCase(), items: items.filter((i) => i.cat === key) };
  }).filter((g) => g.items.length > 0);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex items-center gap-[14px] mt-[10px]">
        <button
          onClick={actions.goWardrobe}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div>
          <div className="text-[11px] tracking-[.18em] uppercase text-muted">
            {items.length} {items.length === 1 ? "pièce" : "pièces"}
          </div>
          <div className="font-serif text-[22px] text-ink mt-[2px]">Mes pièces</div>
        </div>
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
                onClick={() => actions.openItem(it.id, false)}
                className="flex-none w-[104px] cursor-pointer text-left"
                style={{ scrollSnapAlign: "start" }}
              >
                <div
                  className="w-full rounded-[11px] border border-border overflow-hidden"
                  style={
                    it.photoUrl
                      ? { aspectRatio: "4/5", backgroundImage: `url(${it.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { aspectRatio: "4/5", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                  }
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
      ))}
    </div>
  );
}
