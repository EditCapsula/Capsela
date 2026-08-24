"use client";

import { useEffect, useMemo, useState } from "react";
import { OutfitComposition } from "@/components/OutfitComposition";
import { isCatalogId } from "@/lib/catalog";
import { CATLABEL, OCC_LABELS } from "@/lib/data";
import { resolveItemImage } from "@/lib/catalogImages";
import { currentSeasonKey, representativeWeatherFor } from "@/lib/capsule";
import { describeOutfitVariation, getOutfitsForItem, outfitFormality, type ItemOutfitVariation } from "@/lib/logic";
import { paletteHexes } from "@/lib/profile";
import { useAuth } from "@/lib/auth";
import { useCapsela } from "@/lib/store";
import type { OccasionKey } from "@/lib/types";

/**
 * Module "Les idées de tenues" (recette 19/08/2026, refonte UX/UI 22/08/2026,
 * renommage + saison/statut de possession 23/08/2026) — P0 : clic sur un
 * article de Capsule, pièce pivot ("anchor piece", identifiée par son
 * contour terracotta — jamais utilisé pour un autre état UI), combinaisons
 * regroupées par occasion, filtre, images existantes, CTA "Voir cette
 * tenue". Réutilise getOutfitsForItem (lui-même une réutilisation de
 * generateOutfit) — jamais un second moteur, jamais d'appel OpenAI à
 * l'ouverture — et OutfitComposition (variante "compact"), le même
 * composant de composition visuelle que la page Tenue ("hero") : un seul
 * moteur de layout, jamais deux qui divergent. Statut de possession dérivé
 * d'isCatalogId + suggestedExcluded (jamais du wardrobePool, qui masque une
 * pièce suggérée non possédée comblant une catégorie vide de la capsule par
 * défaut) ; badge saison strictement lu depuis capsuleSeasons (colonne
 * saison_capsule de vestiaire_universel), jamais déduit du type de pièce.
 */
export default function ItemOutfitsScreen() {
  const { state, wardrobePool, vestiairePool, actions } = useCapsela();
  const { profile } = useAuth();
  const [occasionFilter, setOccasionFilter] = useState<OccasionKey | "all">("all");

  const pivot = wardrobePool.find((i) => i.id === state.activeId) || vestiairePool.find((i) => i.id === state.activeId);

  // La pièce pivot doit toujours être présente, même si sa catégorie est
  // par ailleurs pourvue par une pièce réelle dans wardrobePool (auquel
  // cas ce n'est pas exactement la même ligne que celle cliquée). Hooks
  // toujours appelés (jamais après un retour conditionnel) : le garde-fou
  // "pivot manquant" est interne, le retour null n'intervient qu'au rendu.
  const pool = useMemo(
    () => (!pivot ? [] : wardrobePool.some((i) => i.id === pivot.id) ? wardrobePool : [...wardrobePool, pivot]),
    [wardrobePool, pivot]
  );

  const capsuleSeason = state.capsuleSeason || currentSeasonKey();
  const weather = useMemo(() => representativeWeatherFor(capsuleSeason), [capsuleSeason]);
  const preferredHexes = useMemo(() => paletteHexes(profile), [profile]);

  const variations = useMemo(
    () => (!pivot ? [] : getOutfitsForItem(pivot.id, pool, weather, preferredHexes, {}, profile.gender)),
    [pivot, pool, weather, preferredHexes, profile.gender]
  );

  // Génération à la demande du visuel de la pièce pivot (correctif 23/08/2026,
  // signalé : "Bomber oversize" resté sans photo sur cette page) — cet écran
  // n'avait jamais ce déclenchement, contrairement à PieceScreen/TenuesScreen,
  // qui l'ont déjà pour la même raison (aucune ligne vestiaire_universel pour
  // une pièce réelle du dressing, donc jamais de génération pour elle).
  useEffect(() => {
    if (!pivot || !isCatalogId(pivot.id)) return;
    if (
      resolveItemImage(pivot).kind === "placeholder" &&
      pivot.imageStatus !== "generating" &&
      pivot.imageStatus !== "error" &&
      pivot.imageStatus !== "invalid"
    ) {
      actions.requestCatalogImage(pivot.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pivot?.id]);

  if (!pivot) return null;

  // Déjà au dressing = pas un id de catalogue (statique 1001+ ou
  // vestiaire_universel 100000+, cf. isCatalogId), ou déjà remplacée via
  // "J'ai déjà" (suggestedExcluded, alimenté par startReplace + saveItem).
  // Plus fiable que l'ancien !wardrobePool.some(...) : wardrobePool contient
  // aussi les pièces de la capsule par défaut qui comblent une catégorie
  // vide, où une pièce suggérée non possédée lirait alors à tort comme
  // "déjà au dressing".
  const alreadyOwned = !isCatalogId(pivot.id) || state.suggestedExcluded.includes(pivot.id);

  // Saison capsule (recette 23/08/2026) — strictement la colonne saison_capsule
  // (vestiaire.ts), jamais déduite du type de vêtement ; absente pour une
  // pièce du dressing réel ou du catalogue statique de secours.
  const seasonLabel = !pivot.capsuleSeasons?.length
    ? null
    : pivot.capsuleSeasons.length === 1
      ? `Capsule ${pivot.capsuleSeasons[0]}`
      : pivot.capsuleSeasons.join(" · ");

  const occasionsCovered = Array.from(new Set(variations.map((v) => v.occasion)));
  const filteredVariations = occasionFilter === "all" ? variations : variations.filter((v) => v.occasion === occasionFilter);

  // Groupe par occasion en conservant l'ordre d'apparition (déjà celui de
  // la taxonomie, cf. getOutfitsForItem), pour l'affichage en sections.
  const grouped: { occasion: OccasionKey; items: ItemOutfitVariation[] }[] = [];
  filteredVariations.forEach((v) => {
    const group = grouped.find((g) => g.occasion === v.occasion);
    if (group) group.items.push(v);
    else grouped.push({ occasion: v.occasion, items: [v] });
  });

  const pivotImage = resolveItemImage(pivot);
  const metaParts = [pivot.color, pivot.matiere].filter(Boolean);

  // Statut Dressing/Capsule d'une pièce (brief 26/08/2026, sections 2-3) —
  // même règle que alreadyOwned pour le pivot : un id de catalogue non
  // exclu par "J'ai déjà" est une suggestion, jamais une pièce possédée.
  const pieceOwned = (id: number) => !isCatalogId(id) || state.suggestedExcluded.includes(id);
  const hasSuggestedPieces = variations.some((v) => v.ids.some((id) => id !== pivot.id && !pieceOwned(id)));

  // Saison citée dans la phrase de provenance — currentSeasonKey() et NON la
  // variable capsuleSeason ci-dessus. Les deux diffèrent : capsuleSeason suit
  // la saison parcourue sur l'écran Capsule (state.capsuleSeason) et ne sert
  // ici qu'à calculer la météo de génération, alors que les pièces
  // complémentaires viennent de wardrobePool, dont la part capsule est
  // construite dans le store avec currentSeasonKey(). Citer capsuleSeason
  // rendrait la phrase fausse dès qu'une autre saison a été parcourue.
  const suggestionSeason = currentSeasonKey();
  // Badge saison masqué quand il ferait doublon avec cette phrase (arbitrage
  // 26/08/2026) : il ne décrit pas la même chose (les saisons déclarées de la
  // PIÈCE, pas la provenance des compléments), mais se lit à l'identique quand
  // il annonce la même saison. Conservé seulement s'il ajoute une information.
  const pivotSeasons = pivot.capsuleSeasons ?? [];
  const seasonAddsInfo = pivotSeasons.length > 1 || (pivotSeasons.length === 1 && pivotSeasons[0] !== suggestionSeason);
  const showSeasonBadge = Boolean(seasonLabel) && (!hasSuggestedPieces || seasonAddsInfo);

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      {/* En-tête compacté (recette 26/08/2026, refonte densité) : retour et
          surtitre sur une même ligne — même motif que LookDetailScreen — au
          lieu de deux blocs empilés, pour faire remonter les idées de tenues
          dans le viewport. */}
      <div className="flex items-center gap-[14px]">
        <button
          onClick={() => actions.go(state.itemOutfitsReturn)}
          className="w-[38px] h-[38px] flex-shrink-0 rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
        >
          ←
        </button>
        <div className="text-[11px] tracking-[.16em] uppercase text-muted">Les idées de tenues</div>
      </div>

      {/* Fiche compacte de la pièce. "Autour de cette pièce" (brief design
          22/08/2026, section 2) est devenu le surtitre DANS la colonne texte
          plutôt qu'une ligne autonome : même information, une trentaine de
          pixels de moins. Le contour terracotta de cette pièce dans chaque
          composition plus bas n'a pas d'autre signification dans toute l'app. */}
      <div className="flex items-center gap-[13px] mt-[14px]">
        <div
          className="relative flex-shrink-0 rounded-[14px] overflow-hidden"
          style={
            pivotImage.url
              ? { width: 72, height: 86, background: "#F3EDE1", padding: 7 }
              : { width: 72, height: 86, background: pivot.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
          }
        >
          {pivotImage.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={pivotImage.url}
              alt={pivot.name}
              style={{ width: "100%", height: "100%", objectFit: "contain", objectPosition: "center" }}
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-[.16em] uppercase text-terracotta">Autour de cette pièce</div>
          <div className="font-serif text-[19px] text-ink leading-[1.2] mt-[3px]">{pivot.name}</div>
          <div className="text-[12px] text-muted mt-[3px]">
            {CATLABEL[pivot.cat]}
            {metaParts.length ? " · " + metaParts.join(" · ") : ""}
          </div>
          {/* Badge saison capsule — masqué quand il ferait doublon avec la
              phrase de provenance ci-dessous (arbitrage 26/08/2026) : il ne
              s'affiche que s'il ajoute une information, c'est-à-dire quand la
              pièce couvre plusieurs saisons ou une saison autre que la capsule
              courante, ou quand la phrase elle-même est absente. Logé dans la
              colonne texte : la vignette étant plus haute, il ne rallonge pas
              la fiche. */}
          {showSeasonBadge && (
            <div className="inline-flex items-center gap-2 mt-[7px] rounded-full bg-warm-bg border border-warm-border" style={{ padding: "5px 11px 5px 9px" }}>
              <span className="w-[6px] h-[6px] rounded-full flex-shrink-0 bg-gold" />
              <span className="text-[10px] tracking-[.13em] uppercase text-terracotta">{seasonLabel}</span>
            </div>
          )}
        </div>
      </div>

      {/* Provenance des compléments + action secondaire sur une seule ligne
          (brief 26/08/2026, hiérarchie cible). La saison citée est celle de la
          capsule qui alimente RÉELLEMENT ces suggestions, cf. suggestionSeason.
          "J'ai déjà" est passé en secondaire (outline) et en largeur
          automatique : l'objectif de cet écran est de parcourir des idées de
          tenues, pas de déclarer une possession — comportement et conditions
          d'affichage strictement inchangés. */}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-[10px] mt-[12px]">
          {hasSuggestedPieces && (
            <div className="flex-1 min-w-[150px] text-[11.5px] text-muted leading-[1.4]">
              Les pièces complémentaires viennent de ta capsule {suggestionSeason}.
            </div>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {alreadyOwned ? (
              <span className="inline-flex items-center gap-[6px] rounded-full bg-warm-bg border border-warm-border" style={{ padding: "6px 12px" }}>
                <span className="text-[10px] text-terracotta">✓</span>
                <span className="text-[11px] text-ink">Dans mon dressing</span>
              </span>
            ) : (
              <>
                {pivot.affLink && (
                  <a
                    href={pivot.affLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block bg-terracotta active:bg-terracotta-hover text-cream rounded-full py-[10px] px-[16px] text-[12px] tracking-[.06em] uppercase cursor-pointer whitespace-nowrap"
                  >
                    Acheter ↗
                  </a>
                )}
                <button
                  onClick={() => actions.startReplace(pivot)}
                  className="inline-block border border-border-soft text-terracotta rounded-full py-[10px] px-[16px] text-[12.5px] cursor-pointer whitespace-nowrap"
                >
                  J&apos;ai déjà
                </button>
              </>
          )}
        </div>
      </div>

      {occasionsCovered.length > 0 && (
        // Chip canonique du Design System (identique à WardrobeScreen) plutôt
        // que des hex inline : l'état sélectionné était en `ink`, divergence
        // introduite ici seulement. Débord `-mx-6 px-6` pour que la liste se
        // coupe au bord de l'ÉCRAN et non au bord du contenu — la chip
        // tronquée devient l'affordance naturelle du scroll horizontal.
        <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[18px] -mx-6 px-6">
          <button
            onClick={() => setOccasionFilter("all")}
            className={
              "flex-none rounded-full px-4 py-[9px] text-[12px] whitespace-nowrap cursor-pointer " +
              (occasionFilter === "all" ? "bg-terracotta active:bg-terracotta-hover text-cream" : "bg-card border border-border text-ink")
            }
          >
            Tout
          </button>
          {occasionsCovered.map((occ) => (
            <button
              key={occ}
              onClick={() => setOccasionFilter(occ)}
              className={
                "flex-none rounded-full px-4 py-[9px] text-[12px] whitespace-nowrap cursor-pointer " +
                (occasionFilter === occ ? "bg-terracotta active:bg-terracotta-hover text-cream" : "bg-card border border-border text-ink")
              }
            >
              {OCC_LABELS[occ]}
            </button>
          ))}
        </div>
      )}

      {occasionsCovered.length === 0 ? (
        <div className="mt-[22px] bg-card border border-border rounded-[14px] px-4 py-[18px]">
          <div className="text-[13px] text-[#3F3B34] leading-[1.5]">
            Pas encore assez de pièces compatibles pour créer plusieurs looks avec cet article.
          </div>
          <button onClick={actions.openAdd} className="mt-[12px] inline-block text-[12.5px] text-terracotta cursor-pointer">
            Compléter mon dressing →
          </button>
        </div>
      ) : (
        grouped.map((group) => {
          // Rang de formalité au sein de la section occasion (brief
          // 26/08/2026, section 4) — 0 = variante la plus décontractée,
          // groupSize - 1 = la plus habillée. Calculé une fois par section
          // pour que describeOutfitVariation choisisse un titre réellement
          // différenciant plutôt qu'un même titre générique répété.
          const withPieces = group.items.map((variation) => ({
            variation,
            pieces: variation.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => Boolean(p)),
          }));
          const rankOf = new Map(
            [...withPieces]
              .sort((a, b) => outfitFormality(a.pieces, pivot.id) - outfitFormality(b.pieces, pivot.id))
              .map((x, rank) => [x.variation, rank])
          );

          return (
            <div key={group.occasion} className="mt-[20px]">
              {/* Compteur local plutôt qu'un total global (brief 26/08/2026,
                  section 4 — "7 IDÉES DE TENUES" supprimé, redondant avec les
                  sections par occasion) : le nombre reste secondaire visuellement
                  par rapport au nom de l'occasion. */}
              <div className="flex items-baseline gap-[6px] mb-[9px]">
                <span className="text-[11px] tracking-[.16em] uppercase text-muted">{OCC_LABELS[group.occasion]}</span>
                <span className="text-[10px] text-placeholder">
                  · {withPieces.length} idée{withPieces.length > 1 ? "s" : ""}
                </span>
              </div>
              <div className="flex flex-col gap-[10px]">
                {withPieces.map(({ variation, pieces }) => {
                  const styleRank = rankOf.get(variation)!;
                  const insight = describeOutfitVariation(variation, pieces, pivot.id, styleRank, withPieces.length);
                  return (
                    // Card entièrement cliquable (section 8) : un seul vrai
                    // élément interactif (button), jamais de bouton imbriqué —
                    // "Voir cette tenue →" reste visible mais n'est qu'un span
                    // stylé, l'action est portée par la card entière. Focus
                    // visible au clavier via focus-visible:outline.
                    <button
                      key={variation.ids.join("-")}
                      type="button"
                      onClick={() => actions.viewItemOutfit(variation.ids, variation.occasion)}
                      aria-label={`Voir la tenue : ${insight.title}`}
                      className="w-full text-left bg-card border border-border rounded-[14px] p-[10px] cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                    >
                      <OutfitComposition items={pieces} variant="compact" anchorId={pivot.id} />
                      {/* Card en trois niveaux (recette 26/08/2026, 3e passe,
                          section 6) : composition, titre, puis description et
                          action. Aucun autre badge ni métadonnée — la
                          provenance est portée une seule fois, par la phrase
                          en haut d'écran. La description est
                          bornée à 3 lignes : describeOutfitVariation produit
                          parfois une phrase de 4-5 lignes qui à elle seule
                          rendait les cards nettement plus hautes que la tenue
                          affichée. Borne à 3 et non à 2 : une description
                          courante ("Le blazer structuré structure la robe,
                          tandis que...") tient en 2 lignes à 390px mais passe
                          à 3 dès 360px — la borner à 2 la tronquerait sur les
                          petits écrans, ce que le brief exclut.
                          "Voir cette tenue →" reste sur sa propre ligne : le
                          remonter sur celle du titre ferait passer les titres
                          les plus longs ("Prête à sortir de l'ordinaire") sur
                          deux lignes dès 390px, sans rien gagner. */}
                      <div className="mt-[8px]">
                        <div className="font-serif text-[14px] text-ink leading-[1.25]">{insight.title}</div>
                        <div className="text-[12px] text-[#3F3B34] mt-[2px] leading-[1.4] line-clamp-3">{insight.sentence}</div>
                      </div>
                      <span className="mt-[6px] inline-block text-[12px] text-terracotta">Voir cette tenue →</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
