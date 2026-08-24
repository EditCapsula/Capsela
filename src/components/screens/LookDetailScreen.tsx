"use client";

import { CATLABEL, OCC_LABELS, isBag } from "@/lib/data";
import { isCatalogId } from "@/lib/catalog";
import { resolveItemImage } from "@/lib/catalogImages";
import { isWishlistLook } from "@/lib/selectors";
import { useCapsela } from "@/lib/store";

export default function LookDetailScreen() {
  const { state, actions, wardrobePool } = useCapsela();
  const look = state.savedLooks.find((l) => l.id === state.activeLookId);
  if (!look) return null;
  const wishlist = isWishlistLook(look);

  // Un look "Créer un look" ne référence que de vraies pièces du dressing ;
  // un look "Enregistrer cette tenue" peut aussi contenir des suggestions
  // capsule pas encore possédées (recette 23/08/2026) — résolution sur
  // wardrobePool dans les deux cas.
  const pieces = look.pieceIds
    .map((id) => wardrobePool.find((i) => i.id === id))
    .filter((it): it is NonNullable<typeof it> => Boolean(it));

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-[100px]">
      <div className="flex items-center gap-[14px]">
        <button
          onClick={actions.closeLookDetail}
          className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="font-serif text-[22px] text-ink">{look.name}</div>
      </div>

      <div className={"text-[10px] tracking-[.06em] uppercase mt-5 " + (wishlist ? "text-terracotta" : look.source === "saved" ? "text-terracotta" : "text-muted")}>
        {wishlist ? "✦ Suggéré (Wishlist)" : look.source === "saved" ? "♡ Enregistré" : "✦ Créé par moi"}
      </div>
      <div className="text-[11px] tracking-[.16em] uppercase text-muted mt-[6px] mb-3">
        {pieces.length} {pieces.length === 1 ? "pièce" : "pièces"}
        {look.occasion ? " · " + OCC_LABELS[look.occasion] : ""}
      </div>
      <div className="flex flex-col gap-[10px]">
        {pieces.map((it) => {
          const img = resolveItemImage(it);
          // Une pièce suggérée capsule (recette 23/08/2026, "Enregistrer
          // cette tenue") reste visuellement distincte d'une pièce possédée :
          // même traitement photo + badge que partout ailleurs dans l'app
          // (désaturée/atténuée, pastille "Suggérée"), jamais une simple
          // pastille de couleur plate — app mode, le visuel prime.
          const suggested = isCatalogId(it.id);
          return (
            <div key={it.id} className="flex items-center gap-[13px] bg-card border border-border rounded-[14px] p-[11px]">
              <div className="relative flex-shrink-0">
                <div
                  className="w-[58px] h-[70px] rounded-lg overflow-hidden"
                  style={
                    img.url
                      ? { background: "#F3EDE1", filter: suggested ? "grayscale(55%) opacity(.8)" : undefined }
                      : { background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)", filter: suggested ? "grayscale(55%) opacity(.8)" : undefined }
                  }
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
                {suggested && (
                  <span className="absolute top-[4px] left-[4px] bg-terracotta text-cream text-[7.5px] tracking-[.06em] uppercase rounded-full py-[2px] px-[6px]">
                    Suggérée
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[14.5px] text-ink">{it.name}</div>
                <div className="text-[11px] text-muted mt-[3px]">
                  {CATLABEL[isBag(it) ? "sac" : it.cat]} · {it.color}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => actions.wearLookToday(look.id)}
        className="mt-7 w-full bg-terracotta active:bg-terracotta-hover text-cream text-center rounded-full py-4 text-[13px] tracking-[.1em] uppercase cursor-pointer"
      >
        Porter aujourd&apos;hui
      </button>
      <button
        onClick={actions.deleteActiveLook}
        className="mt-[10px] w-full text-center border border-border-soft text-rust rounded-full py-[13px] text-[12.5px] cursor-pointer"
      >
        Supprimer ce look
      </button>
    </div>
  );
}
