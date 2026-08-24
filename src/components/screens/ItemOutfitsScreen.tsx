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

  return (
    <div className="scrollarea absolute inset-0 overflow-y-auto px-6 pt-[6px] pb-safe-nav">
      <button
        onClick={() => actions.go(state.itemOutfitsReturn)}
        className="w-[38px] h-[38px] rounded-full bg-card border border-border flex items-center justify-center text-[17px] text-ink cursor-pointer"
      >
        ←
      </button>

      <div className="mt-[18px] text-[11px] tracking-[.16em] uppercase text-muted">Les idées de tenues</div>

      {/* "Autour de cette pièce" (brief design 22/08/2026, section 2) — rend
          explicite le rôle de la pièce mise en avant ci-dessous : celle
          autour de laquelle toutes les combinaisons de cette page sont
          construites. Son contour terracotta dans chaque composition plus
          bas n'a pas d'autre signification dans toute l'app. */}
      <div className="mt-[18px] text-[10px] tracking-[.16em] uppercase text-terracotta">Autour de cette pièce</div>

      <div className="flex items-center gap-[13px] mt-[10px]">
        <div
          className="relative flex-shrink-0 rounded-[14px] overflow-hidden"
          style={
            pivotImage.url
              ? { width: 84, height: 100, background: "#F3EDE1", padding: 8 }
              : { width: 84, height: 100, background: pivot.hex, boxShadow: "inset 0 0 0 1px rgba(29,26,22,.06)" }
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
          <div className="font-serif text-[20px] text-ink leading-[1.2]">{pivot.name}</div>
          <div className="text-[12px] text-muted mt-[4px]">
            {CATLABEL[pivot.cat]}
            {metaParts.length ? " · " + metaParts.join(" · ") : ""}
          </div>
        </div>
      </div>

      {/* Légende unique de provenance (brief 26/08/2026, section 2 —
          remplace un ✦ répété sur chaque pièce complémentaire suggérée,
          trop de bruit visuel). N'apparaît que s'il existe au moins une
          pièce suggérée par la capsule parmi toutes les propositions ;
          jamais affichée si le dressing couvre déjà tout. */}
      {hasSuggestedPieces && (
        <div className="text-[10.5px] text-placeholder mt-[8px] leading-[1.4]">
          ✦ Les autres pièces sont suggérées par ta capsule
        </div>
      )}

      {/* Statut "déjà possédée" (brief 26/08/2026, section 1) — remplace le
          gros bloc plein écran par un statut compact, discret, directement
          sous les informations de la pièce. */}
      {alreadyOwned && (
        <div
          className="inline-flex items-center gap-[6px] mt-[10px] rounded-full"
          style={{ padding: "5px 12px", background: "#F0E5D6", border: "1px solid #E2CDB8" }}
        >
          <span className="text-[10px] text-terracotta">✓</span>
          <span className="text-[11px] text-ink">Dans mon dressing</span>
        </div>
      )}

      {/* Badge saison capsule (brief 23/08/2026, section 2) — même style pastille
          + libellé tracké que le badge de mode de la page Tenue (MODE_STYLES),
          jamais répété par carte plus bas : une seule vérité pour toute la page. */}
      {seasonLabel && (
        <div
          className="inline-flex items-center gap-2 mt-[12px] rounded-full"
          style={{ padding: "7px 14px 7px 11px", background: "#F0E5D6", border: "1px solid #E2CDB8" }}
        >
          <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: "#C9966F" }} />
          <span className="text-[11px] tracking-[.13em] uppercase" style={{ color: "#A66950" }}>
            {seasonLabel}
          </span>
        </div>
      )}

      {/* CTA / lien affilié (brief 23/08/2026, section 3) — deux états
          exclusifs restants : pas encore possédée avec un vrai lien affilié
          (Acheter + Je l'ai déjà), pas encore possédée sans lien (Je l'ai
          déjà seule). Jamais "Acheter" sans affLink réel. */}
      {!alreadyOwned &&
        (pivot.affLink ? (
          <>
            <a
              href={pivot.affLink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-[14px] block w-full bg-terracotta text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.08em] uppercase cursor-pointer"
            >
              Acheter cette pièce ↗
            </a>
            <button
              onClick={() => actions.startReplace(pivot)}
              className="mt-[10px] w-full text-center border border-border-soft text-terracotta rounded-full py-[13px] text-[12.5px] cursor-pointer"
            >
              J&apos;ai déjà
            </button>
          </>
        ) : (
          <button
            onClick={() => actions.startReplace(pivot)}
            className="mt-[14px] w-full bg-terracotta text-cream text-center rounded-full py-[15px] text-[13px] tracking-[.08em] uppercase cursor-pointer"
          >
            J&apos;ai déjà
          </button>
        ))}

      {occasionsCovered.length > 0 && (
        <div className="scrollarea flex gap-2 overflow-x-auto pb-[2px] mt-[22px]">
          <button
            onClick={() => setOccasionFilter("all")}
            className="flex-none py-[9px] px-4 rounded-full text-[12.5px] cursor-pointer border whitespace-nowrap"
            style={{
              background: occasionFilter === "all" ? "#1D1A16" : "#FBF8F3",
              borderColor: occasionFilter === "all" ? "#1D1A16" : "#E6DCCB",
              color: occasionFilter === "all" ? "#F3EEE5" : "#1D1A16",
            }}
          >
            Tout
          </button>
          {occasionsCovered.map((occ) => {
            const on = occasionFilter === occ;
            return (
              <button
                key={occ}
                onClick={() => setOccasionFilter(occ)}
                className="flex-none py-[9px] px-4 rounded-full text-[12.5px] cursor-pointer border whitespace-nowrap"
                style={{ background: on ? "#1D1A16" : "#FBF8F3", borderColor: on ? "#1D1A16" : "#E6DCCB", color: on ? "#F3EEE5" : "#1D1A16" }}
              >
                {OCC_LABELS[occ]}
              </button>
            );
          })}
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
                  // Marqueurs ✓/✦ (brief section 3) — seulement pour une
                  // tenue MIXTE (pièces complémentaires possédées ET
                  // suggérées à la fois) : c'est le seul cas où distinguer
                  // vraiment la provenance aide à comprendre le look. Une
                  // tenue homogène (tout possédé ou tout suggéré) n'a besoin
                  // d'aucun marqueur — la légende générale plus haut suffit.
                  const complementary = pieces.filter((p) => p.id !== pivot.id);
                  const mixed = complementary.some((p) => pieceOwned(p.id)) && complementary.some((p) => !pieceOwned(p.id));
                  const pieceMarkers = mixed
                    ? Object.fromEntries(complementary.map((p) => [p.id, pieceOwned(p.id) ? "owned" : "suggested"] as const))
                    : undefined;
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
                      className="w-full text-left bg-card border border-border rounded-[14px] p-[11px] cursor-pointer outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
                    >
                      <OutfitComposition items={pieces} variant="compact" anchorId={pivot.id} pieceMarkers={pieceMarkers} />
                      <div className="mt-[9px]">
                        <div className="font-serif text-[14px] text-ink leading-[1.25]">{insight.title}</div>
                        <div className="text-[12px] text-[#3F3B34] mt-[3px] leading-[1.4]">{insight.sentence}</div>
                      </div>
                      <span className="mt-[8px] inline-block text-[12px] text-terracotta">Voir cette tenue →</span>
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
