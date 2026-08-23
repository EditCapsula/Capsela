"use client";

import { useCapsela } from "@/lib/store";
import { wearCounts } from "@/lib/selectors";

/**
 * "Mes pièces" (recette 24/08/2026, mockup fourni) — grille plate 2 colonnes
 * remplaçant le regroupement par catégorie en scroll horizontal : plus
 * lisible pour parcourir tout le dressing d'un coup. Statut "Portée X fois"
 * dérivé de l'historique réel (wearCounts, jamais un compteur séparé
 * désynchronisable) plutôt que de active.worn (jours depuis le dernier
 * port, impropre à un total) ; "Aujourd'hui" affiché en plus quand
 * worn === 0, jamais à la place du total.
 */
export default function WardrobePiecesScreen() {
  const { state, actions } = useCapsela();
  const items = state.items;
  const counts = wearCounts(state.history);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex items-center justify-between gap-3 mt-[10px]">
        <div className="flex items-center gap-[14px] min-w-0">
          <button
            onClick={actions.goWardrobe}
            className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer flex-shrink-0"
          >
            ←
          </button>
          <div className="font-serif text-[20px] text-ink truncate">Mes pièces</div>
        </div>
        <button onClick={actions.openAdd} className="flex items-center gap-[7px] flex-shrink-0 cursor-pointer">
          <span className="w-[30px] h-[30px] rounded-full bg-terracotta text-cream flex items-center justify-center text-[16px] flex-shrink-0">
            +
          </span>
          <span className="text-[11.5px] text-ink">Ajouter</span>
        </button>
      </div>

      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-4">
        {items.length} {items.length === 1 ? "pièce" : "pièces"}
      </div>

      {items.length === 0 ? (
        <div className="text-[12.5px] text-muted leading-[1.5] mt-3">
          Tes pièces apparaîtront ici au fur et à mesure que tu les ajoutes à ton dressing.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-[12px] gap-y-[22px] mt-4">
          {items.map((it) => {
            const count = counts.get(it.id) || 0;
            const isToday = it.worn === 0;
            return (
              <button key={it.id} onClick={() => actions.openItem(it.id, false)} className="text-left cursor-pointer">
                <div
                  className="w-full rounded-[14px] border border-border overflow-hidden"
                  style={
                    it.photoUrl
                      ? { aspectRatio: "4/5", backgroundImage: `url(${it.photoUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { aspectRatio: "4/5", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                  }
                />
                <div className="text-[13px] text-ink mt-[8px] leading-[1.25] overflow-hidden text-ellipsis whitespace-nowrap">
                  {it.name}
                </div>
                <div className="text-[11px] text-placeholder mt-[2px]">
                  {count === 0 ? "Jamais porté" : `Porté ${count} fois`}
                </div>
                {isToday && <div className="text-[11px] text-terracotta mt-[1px]">Aujourd&apos;hui</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
