/**
 * Exploration volontaire d'autres styles (recette 24/08/2026, "Explorer
 * d'autres styles" depuis l'état vide Tenues) — module dédié plutôt qu'un
 * ajout à logic.ts : ce calcul orchestre capsule.ts (construction d'une
 * capsule hypothétique par style) ET logic.ts (test de génération), un
 * cross-cutting concern distinct du moteur de tenue lui-même, qui ne doit
 * connaître ni le concept d'exploration ni celui de style.
 *
 * Aucun mécanisme existant n'est modifié ni contourné : chaque style
 * candidat est simplement rejoué à travers exactement le même pipeline que
 * la génération normale (computeDefaultCapsule → generateOutfitWithFallback),
 * jamais une nouvelle logique de compatibilité inventée à partir de tags.
 * N'est jamais appelé automatiquement — uniquement au clic explicite sur
 * "Explorer d'autres styles" (TenuesScreen).
 */
import type { CatalogItem } from "./catalog";
import { computeDefaultCapsule, currentSeasonKey } from "./capsule";
import type { Weather } from "./data";
import { generateOutfitWithFallback } from "./logic";
import { exposedStyleIds, paletteHexes, type Profile, type StyleId } from "./profile";
import type { CapsuleSeason, DateContext, OccasionKey, WorkMode } from "./types";

/**
 * Ne lit que ses paramètres, n'en mute aucun (profile/weather/excludedIds
 * compris) et ne touche jamais au store — un simple calcul pur rejouable à
 * volonté. Retourne uniquement les styles, autres que le style principal du
 * profil, pour lesquels le moteur produit réellement une tenue complète pour
 * cette occasion précise (jamais une correspondance déduite de tags style ×
 * occasion).
 */
export function findCompatibleStyles(
  profile: Profile,
  weather: Weather,
  occasion: OccasionKey,
  workMode: WorkMode,
  dateContext: DateContext,
  vestiairePool: CatalogItem[],
  excludedIds: number[],
  capsuleSeason: CapsuleSeason | null
): StyleId[] {
  const mainStyle = profile.styles[0];
  const season = capsuleSeason || currentSeasonKey();
  const preferredHexes = paletteHexes(profile);

  const candidates = exposedStyleIds(profile.gender).filter((id) => id !== mainStyle);

  const compatible: StyleId[] = [];
  for (const styleId of candidates) {
    const candidateCapsule = computeDefaultCapsule({ ...profile, styles: [styleId] }, weather, excludedIds, season, vestiairePool);
    // `season` sert au référentiel saisonnier de la tenue comme il sert déjà à
    // celui de la capsule ci-dessus — sans quoi la capsule et sa génération ne
    // parlent pas de la même saison (correctif 29/08/2026).
    const result = generateOutfitWithFallback(candidateCapsule, weather, occasion, workMode, dateContext, preferredHexes, profile.gender, season);
    if (!result.noCompleteOutfit) compatible.push(styleId);
  }
  return compatible;
}
