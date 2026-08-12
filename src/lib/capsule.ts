import { CATALOG, type CatalogItem } from "./catalog";
import type { Profile } from "./profile";
import type { Item, Season } from "./types";

/** Bascule saisonnière pilotée par la température de la ville. */
export function weatherSeasonBucket(temp: number): Season {
  return temp >= 20 ? "Printemps / Été" : "Automne / Hiver";
}

const STYLE_FIT: Record<string, RegExp> = {
  Minimaliste: /t-shirt|jean droit|chemise en lin|pull col rond|pantalon large|baskets blanches|mocassins|sac cabas|ceinture/,
  "Bohème": /lin|foulard|jupe|robe portefeuille|robe longue|sandales|chapeau|écharpe|kaki|moutarde|rouille/,
  "Classique chic": /chemis|tailleur|escarpin|gilet|pull torsad|robe chemise|ballerines|trench|manteau laine/,
  "Working girl": /tailleur|chemisier|blazer|escarpin|trench|robe droite|sac cabas/,
  Romantique: /blouse|soie|rose poudré|jupe|robe|dentelle|foulard|ballerines/,
  Streetwear: /sweat|baskets|jean brut|jogging|coupe-vent|débardeur|molleton/,
  "Casual chic": /jean|chemise en lin|mocassins|cabas|pull col rond|ballerines/,
  Sportswear: /baskets|sweat|jogging|molleton|coupe-vent|débardeur/,
  Preppy: /chemise|pull col rond|gilet|mocassins|ceinture|rayé|marine|chino/,
  Rock: /noir|bottines|bottes|jean brut|débardeur|cuir|escarpins|bordeaux|clouté/,
  "Vintage / rétro": /soie|dentelle|robe longue|foulard|chapeau|moutarde|bordeaux/,
  Glamour: /soie|escarpins|robe|doré|paillet/,
  "Éclectique": /imprimé|foulard|moutarde|rouille|kaki/,
  "Nature / éco": /lin|coton|kaki|olive|crème|blanc cassé|taupe/,
};

export function styleFit(it: Item, style: string): boolean {
  const rx = STYLE_FIT[style];
  return rx ? rx.test((it.name + " " + it.color).toLowerCase()) : false;
}

export function bestStyleFor(it: Item): string {
  return Object.keys(STYLE_FIT).find((st) => styleFit(it, st)) || "Casual chic";
}

/**
 * Coupes à privilégier par morphologie — sert à ordonner la sélection
 * (les pièces les plus flatteuses d'abord), jamais à exclure.
 */
const MORPHO_FIT: Record<string, RegExp> = {
  "Taille bien marquée": /portefeuille|cache-cœur|robe|jupe|ceinture|blazer/,
  "Épaules plus larges que les hanches": /jupe|pantalon large|jean|chino|robe longue|évasé/,
  "Hanches plus marquées que les épaules": /blouse|chemis|blazer|top|collier|boucles|foulard|épaul/,
  "Silhouette plutôt fine et droite": /pull|gilet|combinaison|trench|blazer|torsad/,
  "Silhouette plutôt ronde et régulière": /fluide|longue|portefeuille|lin|large|oversize/,
};

export function morphoFit(it: Item, morpho: string | null): boolean {
  if (!morpho) return false;
  const rx = MORPHO_FIT[morpho];
  return rx ? rx.test((it.name + " " + it.color).toLowerCase()) : false;
}

/** Points de vigilance par morphologie (scoring négatif R-S9) — jamais bloquant. */
const MORPHO_AVOID: Record<string, RegExp> = {
  "Taille bien marquée": /oversize|large|ample/,
  "Épaules plus larges que les hanches": /épaul|structuré haut|blazer|manches bouffantes/,
  "Hanches plus marquées que les épaules": /moulant|ceinture serrée/,
  "Silhouette plutôt fine et droite": /^(?!.*(pull|gilet|combinaison|trench|blazer|torsad)).*coupe droite.*$/,
  "Silhouette plutôt ronde et régulière": /moulant|ceinture serrée|col montant/,
};

export function morphoVigilance(it: Item, morpho: string | null): boolean {
  if (!morpho) return false;
  const rx = MORPHO_AVOID[morpho];
  return rx ? rx.test((it.name + " " + it.color).toLowerCase()) : false;
}

/**
 * Capsule par défaut : sélection du catalogue personnalisée par le profil
 * (genre, météo de la ville, style, couleurs préférées) puis ordonnée par
 * compatibilité morphologique. Chaque filtre ne s'applique que s'il laisse
 * assez de pièces pour rester une capsule complète.
 */
export function computeDefaultCapsule(
  profile: Profile,
  cityTemp: number,
  excludedIds: number[] = []
): CatalogItem[] {
  const excluded = new Set(excludedIds);
  let base = CATALOG.filter((it) => !excluded.has(it.id));

  if (profile.gender === "homme") {
    const noFem = base.filter((it) => it.genre !== "femme");
    if (noFem.length >= 16) base = noFem;
  }

  const bucket = weatherSeasonBucket(cityTemp);
  const seasonFit = base.filter((it) => it.season === bucket || it.season === "Toutes saisons");
  if (seasonFit.length >= 16) base = seasonFit;

  const styles = profile.styles || [];
  let curated = styles.length ? base.filter((it) => styles.some((st) => styleFit(it, st))) : base;
  if (curated.length < 18) curated = base;

  const favColors = profile.favoriteColors || [];
  if (favColors.length) {
    const cFit = curated.filter((it) => favColors.includes(it.hex));
    if (cFit.length >= 12) curated = cFit;
  }

  const sorted = [...curated].sort(
    (a, b) => Number(morphoFit(b, profile.morphology)) - Number(morphoFit(a, profile.morphology))
  );
  let out = sorted.slice(0, 34);

  // Garantit la présence d'au moins une veste et un pull dans la capsule,
  // même si les filtres précédents les avaient tous écartés — ces catégories
  // sont nécessaires à la superposition (R-B9, R-S14 suggestion veste météo).
  const ensure = (cat: "veste" | "pull") => {
    if (out.some((it) => it.cat === cat)) return;
    const pool = CATALOG.filter((it) => it.cat === cat && !excluded.has(it.id));
    const fav = pool.filter((it) => favColors.includes(it.hex));
    const pickFrom = fav.length ? fav : pool;
    if (pickFrom.length) out = [...out, pickFrom[0]];
  };
  ensure("veste");
  ensure("pull");

  // Garantit au moins une paire de chaussures d'intérieur, indépendamment du
  // style — sinon un look Cocooning (R-B12) n'aurait aucune chaussure éligible.
  if (!out.some((it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur")) {
    const pool = CATALOG.filter(
      (it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur" && !excluded.has(it.id)
    );
    const fav = pool.filter((it) => favColors.includes(it.hex));
    const pickFrom = fav.length ? fav : pool;
    if (pickFrom.length) out = [...out, pickFrom[0]];
  }

  return out;
}
