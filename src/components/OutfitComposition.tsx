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
 * les variantes entre elles.
 *
 * AUCUN texte dans la composition (recette 26/08/2026, 3e passe — signalé :
 * "SUGGESTION" répété sur presque chaque vêtement, l'écran ressemblant à une
 * interface qui annote chaque élément plutôt qu'à une sélection de looks).
 * Les pastilles de provenance "Ta pièce"/"Suggestion" sont supprimées : la
 * première fait doublon avec le titre "Autour de cette pièce" et le contour
 * terracotta, la seconde avec la phrase de provenance en haut d'écran.
 *
 * La règle "badge uniquement sur tenue mixte", pourtant respectée à la
 * lettre, produisait en pratique l'inverse de son intention : il suffit
 * d'UNE pièce réelle dans un look pour le rendre mixte, et alors TOUTES ses
 * pièces capsule sont badgées. Mesuré sur un dressing d'une seule pièce
 * complémentaire réelle : 100% des tenues mixtes, 56% des vignettes badgées.
 * Le bruit était donc maximal quand le dressing est le plus vide — soit
 * exactement quand la distinction possédé/suggéré apporte le moins.
 *
 * Seul repère conservé : le contour terracotta du pivot (anchorId), qui n'a
 * aucune autre signification dans toute l'app.
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
  // Le vêtement est le contenu principal de la card (recette 26/08/2026,
  // 3e passe — signalé : vignettes trop petites pour reconnaître une pièce).
  // Rangée portée de ~39px à ~51px à 390px, soit +30% en linéaire et +70% en
  // surface : une pièce principale (2 rangées) passe de 82px à 107px de haut.
  // Mesuré sur les compositions réellement générées (4 à 6 pièces), la
  // composition occupe alors 51% (tenue à 4 pièces) à 69% (6 pièces) de la
  // card, ~62% sur le cas courant à 5 pièces — la cible de 55-60% ne peut pas
  // être tenue à la pièce près, la hauteur variant par palier d'une rangée
  // entière selon le nombre de pièces. Gouttière 4 -> 6px : l'espace gagné
  // sur les pastilles supprimées sert aussi à aérer entre les pièces.
  compact: { rowHeight: "clamp(46px, 13vw, 58px)", gap: 6, radius: 10, pad: 5 },
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
}: {
  items: Item[];
  variant?: CompositionVariant;
  /** Id de la pièce pivot à distinguer par un contour terracotta — jamais utilisé pour un autre état UI (brief design 22/08/2026, section 2). */
  anchorId?: number;
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
        // Le pivot garde son palier naturel (recette 26/08/2026, 3e passe).
        // Il était auparavant rétrogradé en "compact" pour laisser le poids
        // visuel aux compléments — mais mesuré, cette rétrogradation ne
        // gagnait AUCUNE hauteur (le remplissage dense de la grille comble
        // la place libérée : mêmes 3 rangées dans les deux cas). Elle ne
        // faisait donc que rendre la pièce de départ moins reconnaissable,
        // en l'écrasant sur une seule rangée — une robe en particulier. Son
        // contour terracotta suffit à la désigner.
        const tier = TIER_OF_ROLE[role];
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
              // Photo du dressing en retrait comme les visuels produit
              // (recette 26/08/2026, section 4) : à fond perdu, elle captait
              // le regard et devenait le point focal du look au lieu d'en
              // être une pièce parmi d'autres. Toujours recadrée en "cover"
              // (une photo n'est pas détourée), mais dans la zone de contenu.
              padding: cfg.pad,
              boxSizing: "border-box",
              background: "#F3EDE1",
              backgroundImage: hasImg ? `url(${img.url})` : undefined,
              backgroundColor: hasImg ? undefined : it.hex,
              backgroundSize: isRealPhoto ? "cover" : "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundOrigin: "content-box",
              boxShadow: shadows.length ? shadows.join(", ") : undefined,
              filter: isRealPhoto ? "brightness(.94) contrast(1.04) saturate(.9)" : undefined,
            }}
          >
          </div>
        );
      })}
    </div>
  );
}
