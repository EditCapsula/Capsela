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
 *
 * "hero" N'A PLUS DE TUILE (23/09/2026, demandé : « le flat lay de tenue doit
 * ressembler à celui de la home, enlève l'aplat de beige sous les articles »).
 * Les pièces reposent directement sur le fond de la card, comme HeroPiece sur
 * l'accueil : un <img> détouré, une ombre portée par la silhouette et non par
 * une boîte, et pour une pièce sans visuel l'aplat de sa couleur dominante —
 * exactement le repli de l'accueil, pour qu'elle ne laisse pas un trou.
 * L'ombre de boîte (drop-shadow sur l'image) remplace le cadre beige : c'est
 * elle qui détache désormais la pièce de son fond. "compact" est inchangé :
 * ses cards reposent sur le fond de page, pas sur un aplat coloré, et rien
 * n'a été signalé dessus.
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

/**
 * Empan de grille par palier, PAR VARIANTE (recette 26/08/2026, 4e passe).
 *
 * "hero" est inchangé : 4 colonnes, pièce principale sur 2x2.
 *
 * "compact" passe à 3 colonnes avec une principale sur 1x2. Motif : un visuel
 * produit est portrait (~3:4) et se pose en "contain" ; sur 4 colonnes, une
 * cellule 2x2 mesure 158x107, soit un format paysage dans lequel le vêtement
 * ne remplit que 42% — d'où le "grand rectangle vide" signalé autour du
 * pivot. Sur 3 colonnes, une cellule 1x2 mesure ~103x138, presque le format
 * de l'image : mesuré, le remplissage passe à 78% et le vêtement rendu gagne
 * 28% en linéaire (73x97 -> 93x124). La cellule chaussures, pire cas à 16% de
 * remplissage dans son format 2x1, rejoint le palier des petites pièces.
 *
 * Effet de bord favorable : la hauteur de card devient identique à 5 et à 6
 * pièces, ce qui rend les propositions bien plus comparables au défilement.
 *
 * La bande des accessoires démarre toujours sur une rangée neuve (cf.
 * gridColumnStart plus bas) : sans cela, les vêtements occupant deux rangées,
 * les accessoires se glissaient un par un dans la colonne restante puis
 * débordaient sur une rangée supplémentaire — un bijou seul en bas de card à
 * côté de deux cellules vides. Avec la rupture, la composition se lit en deux
 * bandes, vêtements puis accessoires, et une même catégorie garde la même
 * place d'une card à l'autre.
 *
 * Contrepartie assumée : le rapport de surface entre une pièce structurante
 * et un accessoire passe de 4,4x à 2,1x. Les vêtements restent nettement les
 * plus grands, mais le contraste est moins marqué qu'avant.
 */
const TIER_SPAN: Record<CompositionVariant, Record<CompositionTier, { col: number; row: number }>> = {
  // "hero" compte en TIERS DE RANGÉE depuis le 23/09/2026 (6/4/3 au lieu de
  // 2/1/1) : cf. le commentaire d'échelle sous VARIANT_CONFIG. Le vêtement
  // occupe exactement la même cellule qu'avant — 6 tiers valent les 2
  // rangées d'origine — seuls les accessoires changent de palier.
  hero: {
    principal: { col: 2, row: 6 },
    chaussures: { col: 2, row: 4 },
    petit: { col: 1, row: 4 },
  },
  compact: {
    principal: { col: 1, row: 2 },
    chaussures: { col: 1, row: 1 },
    petit: { col: 1, row: 1 },
  },
};

/**
 * ÉCHELLE DES ACCESSOIRES — corrigée le 23/09/2026, signalée après le retrait
 * des tuiles beiges qui la masquaient. Le rapport n'avait pas bougé ; c'est le
 * cadre de chaque pièce qui le rendait lisible.
 *
 * Mesuré en rendu réel, l'accueil et l'écran Tenue dans la MÊME exécution, sur
 * les MÊMES quatre pièces, à 320/360/390/430 px, en relevant le pixel
 * réellement affiché et non la boîte : avec object-fit "contain" la boîte
 * surestime les petites cellules, soit exactement le défaut à quantifier.
 *
 *   écart vêtement -> pièce   accueil (réf.)   avant           après
 *   chaussures                ×1,64 à ×1,69    ×2,39 à ×2,49   ×1,51 à ×1,57
 *   sac / bijou               ×1,91 à ×1,92    ×2,39 à ×2,52   ×1,87 à ×2,00
 *                                                              (×2,17 à 320 px)
 *
 * Le levier est l'UNITÉ DE RANGÉE, divisée par trois, avec des empans de 6/4/4
 * au lieu de 2/1/1. Elle est calée (u = R/3 - 4px) pour que six tiers valent
 * exactement les deux rangées d'origine : la cellule du vêtement est
 * INCHANGÉE (139 px à 390 px, comme avant), et la card ne grandit que de la
 * bande des accessoires — +24 px, et seulement à six pièces ; à quatre et cinq
 * pièces, sa hauteur ne bouge pas.
 *
 * À 320 px le sac reste à ×2,17 : là, et là seulement, il n'est plus limité
 * par sa hauteur mais par la LARGEUR de sa colonne (56 px). Aucun empan de
 * rangée ne peut le corriger ; il faudrait une colonne plus large, donc une
 * autre grille. Non instruit, donc non fait — et écrit ici pour que ce chiffre
 * ne passe pas pour un oubli.
 *
 * Quatre pistes mesurées et écartées, dans la même exécution : chaussures sur
 * deux rangées pleines les met à ×1,00, aussi grandes qu'une robe, et coûte
 * 72 px ; une petite pièce sur deux colonnes atteint ×1,41 mais fait passer la
 * card de 279 à 424 px à six pièces ; forcer l'image à remplir sa cellule
 * (width 100%) ne change RIEN, les visuels du catalogue étant carrés, la
 * hauteur reste le facteur limitant ; une unité non calée corrige les rapports
 * mais grossit tout le flat-lay de 37 px au lieu de 24.
 *
 * "compact" est intouché : ses cellules n'ont jamais été signalées, et rien
 * n'autorise à transporter une mesure prise sur l'écran Tenue vers un écran
 * qui empile plusieurs compositions par page.
 */
/** Unité de rangée de "hero" — exportée pour que l'écran Tenue dimensionne sa zone fixe sur la même mesure. */
export const UNITE_HERO = "clamp(15.33px, calc(5.667vw - 4px), 20.67px)";

const VARIANT_CONFIG: Record<CompositionVariant, { cols: number; rowHeight: string; gap: number; radius: number; pad: number }> = {
  // Unité en tiers de rangée, calée sur l'ancienne (cf. ci-dessus). Retrait
  // intérieur ramené de 8 à 2 px : il servait à détacher la pièce de sa tuile
  // beige, qui n'existe plus — la gouttière de 6 px sépare désormais seule.
  hero: { cols: 4, rowHeight: UNITE_HERO, gap: 6, radius: 14, pad: 2 },
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
  // Rangée calée pour qu'une principale (1x2 sur 3 colonnes) approche le
  // format portrait du visuel produit : ~103x138 à 390px de large.
  compact: { cols: 3, rowHeight: "clamp(58px, 17vw, 76px)", gap: 6, radius: 10, pad: 5 },
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
  ajustee = false,
}: {
  items: Item[];
  variant?: CompositionVariant;
  /** Id de la pièce pivot à distinguer par un contour terracotta — jamais utilisé pour un autre état UI (brief design 22/08/2026, section 2). */
  anchorId?: number;
  /**
   * La composition remplit la hauteur de son parent au lieu de la dicter
   * (brief du 25/09, point 5 — hero de l'écran Tenue). Chaque rangée garde sa
   * taille naturelle AU PLUS (minmax(0, unité)) : une tenue courte est
   * centrée, jamais agrandie ; une tenue longue voit toutes ses rangées
   * réduites d'autant, les proportions entre pièces restant celles calibrées
   * ci-dessus. Le parent doit avoir une hauteur définie.
   */
  ajustee?: boolean;
}) {
  const cfg = VARIANT_CONFIG[variant];
  // "hero" repose sur le terracotta de la card Tenue, pas sur le fond de
  // page : aucune tuile sous les pièces (cf. en-tête).
  const sansTuile = variant === "hero";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cfg.cols}, 1fr)`,
        gridAutoRows: ajustee ? `minmax(0, ${cfg.rowHeight})` : cfg.rowHeight,
        height: ajustee ? "100%" : undefined,
        // « safe center » et non « center » (recette du 26/09/2026, pièce
        // coupée en haut) : si la composition dépasse la hauteur de la zone,
        // un centrage simple la fait déborder VERS LE HAUT aussi, et le haut
        // de la première pièce devient inatteignable. « safe » retombe alors
        // sur un alignement en haut. Navigateur trop ancien : la valeur est
        // ignorée, l'alignement par défaut (en haut) ne coupe rien non plus.
        alignContent: ajustee ? "safe center" : undefined,
        // Flux normal, jamais "dense" (recette 26/08/2026) : le remplissage
        // dense remonte les petites pièces dans les trous laissés par les
        // grandes, si bien qu'une même catégorie changeait de place d'une
        // card à l'autre selon le contenu — impossible de comparer deux
        // propositions d'un coup d'œil. En flux normal, l'ordre de
        // ROLE_ORDER (inchangé) se traduit directement en positions.
        gap: cfg.gap,
      }}
    >
      {orderedCompositionPieces(items).map(({ item: it, role }, index, ordered) => {
        // Première pièce non structurante : force le début d'une rangée, pour
        // que vêtements et accessoires forment deux bandes distinctes (cf.
        // commentaire de TIER_SPAN). "hero" garde son flux libre.
        const startsAccessoryBand =
          variant === "compact" &&
          TIER_OF_ROLE[role] !== "principal" &&
          ordered.findIndex((o) => TIER_OF_ROLE[o.role] !== "principal") === index &&
          index > 0;
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
        const span = TIER_SPAN[variant][tier];
        // Le contour du pivot doit épouser le VÊTEMENT, pas la cellule
        // (recette 26/08/2026, signalé : "grand rectangle vide"). Un visuel
        // produit portrait posé en "contain" dans une cellule paysage ne
        // remplit que ~42% de celle-ci : le contour encadrait donc une
        // majorité de vide. Il est désormais porté par un <img> dimensionné
        // en height:100%/width:auto, dont la boîte vaut exactement l'image
        // affichée. Une photo réelle, elle, est recadrée en "cover" et
        // remplit déjà la cellule : le contour y reste sur la cellule.
        const ringOnCell = isAnchor && (isRealPhoto || !hasImg);
        const ringOnImage = isAnchor && hasImg && !isRealPhoto;
        // "hero" : plus de tuile du tout. Le filet intérieur des pièces sans
        // visuel disparaît avec elle — un trait sombre à 6 % d'opacité était
        // calculé pour se poser sur le beige ; sur le terracotta il ne
        // délimite plus rien.
        const shadows = [
          ringOnCell && "0 0 0 1.5px #A66950",
          !sansTuile && !hasImg && "inset 0 0 0 1px rgba(29,26,22,.06)",
        ].filter(Boolean) as string[];
        return (
          <div
            key={"comp-" + it.id}
            style={{
              position: "relative",
              gridColumn: startsAccessoryBand ? `1 / span ${span.col}` : `span ${span.col}`,
              gridRow: `span ${span.row}`,
              borderRadius: cfg.radius,
              // Photo du dressing en retrait comme les visuels produit
              // (recette 26/08/2026, section 4) : à fond perdu, elle captait
              // le regard et devenait le point focal du look au lieu d'en
              // être une pièce parmi d'autres. Contenue dans la zone de contenu
              // (plus recadrée en "cover" depuis le 26/09/2026).
              padding: cfg.pad,
              boxSizing: "border-box",
              background: sansTuile ? undefined : "#F3EDE1",
              // Photo réelle : en fond contenu (jamais détourée, jamais coupée).
              // Visuel produit : rendu par un <img> ci-dessous, pour que le
              // contour du pivot puisse épouser l'image elle-même.
              // Sans tuile, TOUT passe par un <img> ou par l'aplat de repli :
              // un fond de cellule se peint jusqu'au bord de la boîte, donc
              // il ne peut porter ni coins arrondis propres ni ombre douce.
              backgroundImage: !sansTuile && isRealPhoto && hasImg ? `url(${img.url})` : undefined,
              backgroundColor: sansTuile || hasImg ? undefined : it.hex,
              // "contain" depuis la recette du 26/09/2026 : une pièce principale
              // ne doit jamais être tronquée, photo comprise.
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundOrigin: "content-box",
              boxShadow: shadows.length ? shadows.join(", ") : undefined,
              filter: !sansTuile && isRealPhoto ? "brightness(.94) contrast(1.04) saturate(.9)" : undefined,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {sansTuile ? (
              hasImg ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img loading="lazy"
                  src={img.url}
                  alt=""
                  style={{
                    height: "100%",
                    // Une photo du dressing est désormais CONTENUE, comme un
                    // visuel produit (recette du 26/09/2026) : en "cover",
                    // une robe longue photographiée en portrait, posée dans
                    // une cellule paysage, perdait son haut et son bas. La
                    // photo garde son cadre (arrondi) mais la pièce reste
                    // entière. width:auto : la boîte vaut l'image affichée,
                    // l'ombre en épouse le contour.
                    width: "auto",
                    maxWidth: "100%",
                    objectFit: "contain",
                    display: "block",
                    borderRadius: Math.max(2, cfg.radius - 4),
                    // Même ombre que HeroPiece sur l'accueil — c'est elle qui
                    // remplace le cadre beige.
                    filter: isRealPhoto
                      ? "brightness(.94) contrast(1.04) saturate(.9) drop-shadow(0 6px 14px rgba(29,26,22,.18))"
                      : "drop-shadow(0 6px 14px rgba(29,26,22,.18))",
                    boxShadow: ringOnImage ? "0 0 0 1.5px #A66950" : undefined,
                  }}
                />
              ) : (
                // Repli identique à celui de l'accueil : un aplat de la
                // couleur dominante, pour que la pièce reste présente.
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: Math.max(2, cfg.radius - 4),
                    background: it.hex,
                    opacity: 0.9,
                  }}
                />
              )
            ) : (
              hasImg && !isRealPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img loading="lazy"
                  src={img.url}
                  alt=""
                  style={{
                    height: "100%",
                    width: "auto",
                    maxWidth: "100%",
                    objectFit: "contain",
                    display: "block",
                    borderRadius: Math.max(2, cfg.radius - 4),
                    boxShadow: ringOnImage ? "0 0 0 1.5px #A66950" : undefined,
                  }}
                />
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
