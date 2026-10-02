"use client";

import { OutfitComposition } from "@/components/OutfitComposition";
import { resolveItemImage } from "@/lib/catalogImages";
import { sourcePiece, texteProvenance, type LookNumerote } from "@/lib/ideesLooks";
import type { OutfitStyleInsight } from "@/lib/logic";
import { nomCourtPiece } from "@/lib/selectors";
import type { Item } from "@/lib/types";

/**
 * CARTE ÉDITORIALE D'UNE IDÉE DE LOOK (27/09/2026) — « Comment porter … ? »
 * et « D'autres idées avec cette pièce » sur le détail du look : un seul
 * composant pour les deux.
 *
 * La composition est la variante "hero" d'OutfitComposition (celle de
 * l'écran Tenue), posée sur un aplat chaud : aucun texte dans l'image.
 * La provenance est dite une fois, sous le titre, puis pièce par pièce sur
 * les miniatures : « À découvrir » ne marque que les pièces absentes du
 * dressing (sourcePiece), jamais déduites du nom ou de l'image.
 *
 * Toute la carte est un seul bouton : les miniatures ne sont pas
 * interactives et ne défilent pas (elles se répartissent sur la largeur),
 * donc rien d'imbriqué.
 */
export function CarteIdeeLook({
  look,
  pieces,
  insight,
  dressing,
  onOpen,
}: {
  look: LookNumerote;
  pieces: Item[];
  insight: OutfitStyleInsight | undefined;
  dressing: Item[];
  onOpen: () => void;
}) {
  const { provenance } = look;
  const colonnes = pieces.length > 6 ? Math.ceil(pieces.length / 2) : Math.max(pieces.length, 4);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Voir le look ${look.numero}${insight ? " : " + insight.title : ""}`}
      className="w-full text-left bg-card border border-border rounded-[20px] p-[12px] cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
    >
      {/* Hauteur bornée (ajustee) : à hauteur naturelle, une tenue de cinq
          pièces faisait ~370 px à 390 px de large, et une seule carte
          dépassait l'écran. Les proportions entre pièces restent celles de
          la variante. */}
      <div className="rounded-[14px] bg-warm-bg px-[14px] py-[14px]" style={{ height: "clamp(230px, 68vw, 290px)" }}>
        <OutfitComposition items={pieces} variant="hero" ajustee />
      </div>

      <div className="px-[4px]">
        <div className="t-label text-terracotta mt-[14px]">Look {look.numero}</div>
        {insight && (
          <>
            <div className="t-titre-carte text-ink mt-[5px]">{insight.title}</div>
            <div className="text-[13px] text-ink-soft leading-[1.45] mt-[5px] line-clamp-3">{insight.sentence}</div>
          </>
        )}

        <div className="flex items-baseline justify-between gap-3 mt-[12px] text-[12px]">
          <span className={provenance.suggestions === 0 ? "text-ink" : "text-muted"}>
            {provenance.suggestions === 0 && (
              <span className="text-terracotta mr-[5px]" aria-hidden="true">
                ✓
              </span>
            )}
            {texteProvenance(provenance)}
          </span>
          {provenance.suggestions === 0 && (
            <span className="text-muted whitespace-nowrap flex-shrink-0">
              {provenance.dressing}/{provenance.total} pièces
            </span>
          )}
        </div>

        <div className="grid gap-[8px] mt-[10px]" style={{ gridTemplateColumns: `repeat(${colonnes}, minmax(0, 1fr))` }}>
          {pieces.map((it) => {
            const img = resolveItemImage(it);
            const catalogue = sourcePiece(it.id, dressing) === "catalog";
            return (
              <div key={it.id} className="min-w-0">
                <div
                  className="w-full rounded-[10px] overflow-hidden"
                  style={
                    img.url
                      ? { aspectRatio: "1", background: "var(--color-photo-bg)", padding: img.kind === "photo" ? 0 : 4 }
                      : { aspectRatio: "1", background: it.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
                  }
                >
                  {img.url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      loading="lazy"
                      src={img.url}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: img.kind === "photo" ? "cover" : "contain" }}
                    />
                  )}
                </div>
                <div className="text-[10px] text-ink leading-[1.25] mt-[5px] line-clamp-2 hyphens-auto">{nomCourtPiece(it.name)}</div>
                {catalogue && <div className="text-[9px] text-terracotta leading-[1.2] mt-[2px] whitespace-nowrap">À découvrir</div>}
              </div>
            );
          })}
        </div>

        <span className="mt-[14px] mb-[2px] inline-block t-cta text-terracotta">Voir le look →</span>
      </div>
    </button>
  );
}
