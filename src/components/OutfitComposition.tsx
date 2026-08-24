"use client";

import { resolveItemImage } from "@/lib/catalogImages";
import type { CategoryKey, Item } from "@/lib/types";

/**
 * Grille non chevauchante et hiérarchisée d'une tenue (mutualisée 22/08/2026,
 * brief design "Comment porter cette pièce ?" section 13 — évite deux
 * moteurs de layout qui finiraient par diverger). Chaque pièce occupe sa
 * propre cellule (jamais recouverte par une autre), avec une taille dérivée
 * de son rôle plutôt que de sa position dans le tableau : pièces principales
 * (haut/bas/robe/veste) grandes, chaussures intermédiaires, sac/bijou/
 * accessoire petits. Grille CSS à spans (jamais de position absolue
 * dépendante du nombre de pièces) — s'adapte à toute combinaison générée.
 * L'ordre est fixe (même rôle → même position relative à chaque rendu).
 *
 * Deux variantes : "hero" (page Tenue, grande, une seule tenue à la fois) et
 * "compact" (page "Comment porter cette pièce ?", plusieurs cards par page).
 * `anchorId`, propre à "compact" : entoure la pièce pivot d'un contour
 * terracotta — jamais utilisé par "hero", qui n'a pas de notion de pivot.
 *
 * En "compact", la pièce pivot est déjà connue de l'utilisatrice (recette
 * 26/08/2026, "Idées de tenues" section 5) : elle occupe une cellule plus
 * petite (palier "chaussures" plutôt que "principal") pour laisser le poids
 * visuel aux pièces complémentaires, qui sont ce qui distingue réellement
 * les variantes entre elles. `suggestedIds`, propre à "compact" également :
 * petit marqueur ✦ sur les pièces suggérées par Capsela (jamais un badge
 * plein, la provenance reste secondaire à la lecture de la tenue).
 */
export type CompositionVariant = "hero" | "compact";
type CompositionRole = "outerwear" | "onepiece" | "haut" | "pantalon" | "chaussures" | "sac" | "petit";
type CompositionTier = "principal" | "chaussures" | "petit";

const ROLE_ORDER: CompositionRole[] = ["outerwear", "onepiece", "haut", "pantalon", "chaussures", "sac", "petit"];

const TIER_OF_ROLE: Record<CompositionRole, CompositionTier> = {
  outerwear: "principal",
  onepiece: "principal",
  haut: "principal",
  pantalon: "principal",
  chaussures: "chaussures",
  sac: "petit",
  petit: "petit",
};

/** Empan de grille par palier de taille — 4 colonnes, "dense" comble les trous laissés par les petites pièces. */
const TIER_SPAN: Record<CompositionTier, { col: number; row: number }> = {
  principal: { col: 2, row: 2 },
  chaussures: { col: 2, row: 1 },
  petit: { col: 1, row: 1 },
};

const VARIANT_CONFIG: Record<CompositionVariant, { rowHeight: string; gap: number; radius: number; pad: number }> = {
  hero: { rowHeight: "clamp(58px, 17vw, 74px)", gap: 6, radius: 14, pad: 8 },
  // Réduit (recette 26/08/2026, section 8 : "l'écran devient très long") —
  // cards plus compactes, plusieurs variantes visibles simultanément.
  compact: { rowHeight: "clamp(36px, 10vw, 46px)", gap: 4, radius: 10, pad: 5 },
};

function compositionRoleOf(cat: CategoryKey): CompositionRole {
  if (cat === "pantalon" || cat === "jean" || cat === "jupe" || cat === "short") return "pantalon";
  if (cat === "veste" || cat === "manteau") return "outerwear";
  if (cat === "robe" || cat === "combinaison") return "onepiece";
  if (cat === "bijou" || cat === "accessoire") return "petit";
  if (cat === "haut" || cat === "chaussures" || cat === "sac") return cat;
  return "petit"; // pull et tout le reste
}

/** Ordre fixe par rôle (jamais l'ordre de tirage, qui varie à chaque régénération) + rôle pour la taille de cellule. */
function orderedCompositionPieces(items: Item[]): { item: Item; role: CompositionRole }[] {
  return items
    .map((it, i) => ({ item: it, role: compositionRoleOf(it.cat), i }))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.i - b.i)
    .map(({ item, role }) => ({ item, role }));
}

export function OutfitComposition({
  items,
  variant = "hero",
  anchorId,
  suggestedIds,
}: {
  items: Item[];
  variant?: CompositionVariant;
  /** Id de la pièce pivot à distinguer par un contour terracotta — jamais utilisé pour un autre état UI (brief design 22/08/2026, section 2). */
  anchorId?: number;
  /** Ids des pièces suggérées par Capsela (non possédées) à marquer d'un ✦ discret — propre à "compact" (recette 26/08/2026, section 6). */
  suggestedIds?: number[];
}) {
  const cfg = VARIANT_CONFIG[variant];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gridAutoRows: cfg.rowHeight,
        gridAutoFlow: "dense",
        gap: cfg.gap,
      }}
    >
      {orderedCompositionPieces(items).map(({ item: it, role }) => {
        const img = resolveItemImage(it);
        const hasImg = Boolean(img.url);
        // Une photo réelle du dressing (kind "photo") n'est jamais détourée
        // comme une image produit catalogue/affiliée — recadrée en "cover"
        // plein cadre plutôt qu'en "contain" (cf. TenuesScreen, correctif
        // 22/08/2026), avec un léger ajustement d'éclairage pour se
        // rapprocher du rendu plat des photos produit.
        const isRealPhoto = img.kind === "photo";
        const isAnchor = anchorId != null && it.id === anchorId;
        const isSuggested = variant === "compact" && suggestedIds?.includes(it.id);
        // Pivot déjà connu : palier réduit en "compact" pour ne pas
        // occuper la majorité de la card (section 5) — seulement pour les
        // rôles "principal" (haut/bas/robe/veste), jamais un agrandissement
        // pour un pivot déjà petit (sac/bijou/accessoire). Inchangé en "hero".
        const naturalTier = TIER_OF_ROLE[role];
        const tier = variant === "compact" && isAnchor && naturalTier === "principal" ? "chaussures" : naturalTier;
        const span = TIER_SPAN[tier];
        const shadows = [
          isAnchor && "0 0 0 1.5px #A66950",
          !hasImg && "inset 0 0 0 1px rgba(29,26,22,.06)",
        ].filter(Boolean) as string[];
        return (
          <div
            key={"comp-" + it.id}
            style={{
              position: "relative",
              gridColumn: `span ${span.col}`,
              gridRow: `span ${span.row}`,
              borderRadius: cfg.radius,
              padding: isRealPhoto ? 0 : cfg.pad,
              boxSizing: "border-box",
              background: "#F3EDE1",
              backgroundImage: hasImg ? `url(${img.url})` : undefined,
              backgroundColor: hasImg ? undefined : it.hex,
              backgroundSize: isRealPhoto ? "cover" : "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundOrigin: isRealPhoto ? "border-box" : "content-box",
              boxShadow: shadows.length ? shadows.join(", ") : undefined,
              filter: isRealPhoto ? "brightness(.94) contrast(1.04) saturate(.9)" : undefined,
            }}
          >
            {isSuggested && (
              <span
                className="absolute top-[3px] right-[3px] flex items-center justify-center rounded-full text-terracotta"
                style={{ width: 14, height: 14, fontSize: 8, background: "rgba(251,248,243,.92)", boxShadow: "0 1px 2px rgba(29,26,22,.18)" }}
              >
                ✦
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
