"use client";

import { CATLABEL, addedAgo } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { suggestName } from "@/lib/attributes";
import { useCapsela } from "@/lib/store";
import { neverWornItems, inactivityInfo } from "@/lib/selectors";
import type { Item } from "@/lib/types";

/**
 * Nom affiché sur la card (recette 25/08/2026) — un nom trop générique
 * (juste le libellé de catégorie, ex. "Robe") est remplacé par le nom
 * descriptif recomposé (suggestName), jamais par le nom brut s'il n'apporte
 * aucune information au-delà de la catégorie déjà affichée juste en dessous.
 */
function displayName(it: Item): string {
  const trimmed = it.name?.trim() ?? "";
  if (trimmed && trimmed.toLowerCase() !== CATLABEL[it.cat].toLowerCase()) return trimmed;
  return suggestName(it.cat, it.subtype, it.matiere, it.color);
}

export default function NeverWornScreen() {
  const { state, actions } = useCapsela();
  const neverWorn = neverWornItems(state.items);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-24">
      <div className="flex items-center gap-[14px]">
        <button onClick={actions.goTenues} className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer">←</button>
        <div className="font-serif text-[25px] text-ink">Jamais portées</div>
      </div>

      <div className="mt-4 flex items-center gap-[11px] bg-warm-bg border border-warm-border rounded-2xl px-4 py-[12px]">
        <span className="font-serif text-[26px] leading-[.9] text-terracotta flex-shrink-0">{neverWorn.length}</span>
        <div className="min-w-0">
          <div className="text-[13.5px] text-ink leading-[1.3]">{neverWorn.length === 1 ? "pièce à redécouvrir" : "pièces à redécouvrir"}</div>
          <div className="text-[11.5px] text-warm-text-2 leading-[1.4] mt-[2px]">
            {neverWorn.length === 1 ? "Elle n'a" : "Elles n'ont"} encore jamais été {neverWorn.length === 1 ? "portée" : "portées"}. Découvre de nouvelles façons de {neverWorn.length === 1 ? "l'intégrer" : "les intégrer"} à tes tenues.
          </div>
        </div>
      </div>

      {neverWorn.length === 0 && (
        <div className="text-[12.5px] text-muted mt-4 leading-[1.5]">
          Aucune pièce de ton dressing n&apos;attend son tour pour l&apos;instant.
        </div>
      )}

      <div className="flex flex-col gap-[10px] mt-4">
        {neverWorn.map((it) => {
          const img = resolveItemImage(it);
          const info = inactivityInfo(it);
          const ago = addedAgo(it.createdAt);

          return (
            <div key={it.id} className="bg-card border border-border rounded-[16px] overflow-hidden">
              <div
                role="button"
                tabIndex={0}
                onClick={() => actions.openItem(it.id, false)}
                onKeyDown={(e) => e.key === "Enter" && actions.openItem(it.id, false)}
                className="flex items-center gap-[13px] py-[11px] px-3 cursor-pointer"
              >
                <div
                  className="w-[52px] h-[63px] rounded-lg flex-shrink-0 overflow-hidden"
                  style={img.url ? { background: "#F3EDE1", padding: 4 } : { background: it.hex, boxShadow: "inset 0 0 0 1px rgba(30,26,22,.06)" }}
                >
                  {img.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img.url}
                      alt={it.name}
                      style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[14px] text-ink truncate">{displayName(it)}</div>
                  <div className="text-[11px] text-muted mt-[2px]">{CATLABEL[it.cat]} · {it.color}</div>
                  {ago && <div className="text-[10.5px] text-placeholder mt-[3px]">{ago} · Jamais portée</div>}
                </div>
              </div>

              {info.inactive ? (
                <div className="mx-3 mb-3 bg-[#F6EBE2] border border-warm-border rounded-xl px-[13px] py-[11px]">
                  <div className="text-[12px] text-ink leading-[1.4]">
                    Cette pièce dort dans ton dressing.
                    {info.periodLabel && <> Tu ne l&apos;as pas portée {info.periodLabel}.</>}
                  </div>
                  <div className="flex items-center gap-[14px] mt-[9px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.openItemOutfits(it.id, false);
                      }}
                      className="text-[11.5px] text-cream bg-terracotta active:bg-terracotta-hover rounded-full py-[8px] px-[14px] cursor-pointer"
                    >
                      Voir des tenues
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.openItem(it.id, false);
                      }}
                      className="text-[11.5px] text-muted underline cursor-pointer"
                    >
                      Envisager de la revendre
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-3 pb-[11px] -mt-[2px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      actions.openItemOutfits(it.id, false);
                    }}
                    className="text-[11.5px] text-terracotta cursor-pointer"
                  >
                    Voir des tenues ›
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
