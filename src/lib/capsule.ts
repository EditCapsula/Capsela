import { CATALOG, type CatalogItem } from "./catalog";
import { intensiteOf, tonsOf } from "./attributes";
import { isSunny, type Weather } from "./data";
import { paletteHexes, type Affinite, type Intensite, type Profile } from "./profile";
import type { CapsuleSeason, CategoryKey, Item, IntensiteCouleur, Season, Tons } from "./types";

/** Bascule saisonnière pilotée par la température de la ville. */
export function weatherSeasonBucket(temp: number): Season {
  return temp >= 20 ? "Printemps / Été" : "Automne / Hiver";
}

export type { CapsuleSeason };
export const CAPSULE_SEASONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];

/** Saison calendaire courante — pilote la capsule "de départ" affichée par défaut (indépendante de la météo du jour). */
export function currentSeasonKey(): CapsuleSeason {
  const m = new Date().getMonth();
  return m <= 1 || m === 11 ? "Hiver" : m <= 4 ? "Printemps" : m <= 7 ? "Été" : "Automne";
}

/** Température représentative par saison — repli neutre quand une valeur concrète est nécessaire sans dépendre de la météo du jour. */
const REPRESENTATIVE_TEMP: Record<CapsuleSeason, number> = {
  Printemps: 16,
  Été: 24,
  Automne: 14,
  Hiver: 6,
};

/**
 * Météo synthétique représentative d'une saison de capsule (recette
 * 19/08/2026, module "Comment porter cette pièce ?") — pour un contexte
 * "toutes les façons de la porter" qui doit rester valable sur toute la
 * saison, pas seulement la météo du jour (cf. weather réel, réservé à la
 * Tenue du jour).
 */
export function representativeWeatherFor(season: CapsuleSeason): Weather {
  const temp = REPRESENTATIVE_TEMP[season];
  return {
    season: weatherSeasonBucket(temp),
    temp,
    label: season === "Été" ? "Ensoleillé" : "Nuageux",
    seasons: [weatherSeasonBucket(temp), "Toutes saisons"],
  };
}

const STYLE_FIT: Record<string, RegExp> = {
  Minimaliste: /t-shirt|jean droit|chemise en lin|pull col rond|pantalon large|baskets blanches|mocassins|sac cabas|ceinture/,
  "Casual chic": /jean|chemise en lin|mocassins|cabas|pull col rond|ballerines/,
  "Classique chic": /chemis|tailleur|escarpin|gilet|pull torsad|robe chemise|ballerines|trench|manteau laine/,
  Romantique: /blouse|soie|rose poudré|jupe|robe|dentelle|foulard|ballerines/,
  "Bohème": /lin|foulard|jupe|robe portefeuille|robe longue|sandales|chapeau|écharpe|kaki|moutarde|rouille/,
  Streetwear: /sweat|baskets|jean brut|jogging|coupe-vent|débardeur|molleton/,
  Preppy: /chemise|pull col rond|gilet|mocassins|ceinture|rayé|marine|chino/,
  Glamour: /soie|escarpins|robe|doré|paillet/,
};

export function styleFit(it: Item, style: string): boolean {
  if (it.styleTags) return it.styleTags.includes(style);
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
  if (it.morphologyTags) return it.morphologyTags.includes(morpho);
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

const INTENSITE_TAG: Record<Intensite, IntensiteCouleur> = {
  "Douces et discrètes": "douce",
  "Profondes et intenses": "intense",
  "Lumineuses": "lumineuse",
  "Un mélange": "melange",
};

/** La pièce contredit l'affinité de palette du profil — jamais si l'une des deux vaut "les deux"/pas de préférence. */
function tonsConflict(itemTons: Tons, affinite: Affinite | null): boolean {
  if (!affinite || affinite === "Les deux" || affinite === "Je ne sais pas") return false;
  if (itemTons === "les_deux") return false;
  const want: Tons = affinite === "Tons chauds" ? "chauds" : "froids";
  return itemTons !== want;
}

/** La pièce contredit l'intensité de palette du profil — jamais si l'une des deux vaut "un mélange"/pas de préférence. */
function intensiteConflict(itemIntensite: IntensiteCouleur, intensite: Intensite | null): boolean {
  if (!intensite || intensite === "Un mélange") return false;
  if (itemIntensite === "melange") return false;
  return itemIntensite !== INTENSITE_TAG[intensite];
}

/**
 * Compatibilité avec la palette personnelle du profil (recette 12/08/2026) :
 * une pièce correspond si sa teinte est l'une des couleurs choisies (base/
 * neutres/accents) OU si son ton et son intensité ne contredisent pas
 * l'affinité/intensité déclarées — jamais exclusif, une pièce sans conflit
 * connu passe toujours (esprit "préférence molle", comme R-S10).
 */
export function paletteFit(it: Item, profile: Profile): boolean {
  if (paletteHexes(profile).includes(it.hex)) return true;
  return !tonsConflict(tonsOf(it), profile.paletteAffinite) && !intensiteConflict(intensiteOf(it), profile.paletteIntensite);
}

/**
 * Capsule par défaut : sélection du catalogue personnalisée par le profil
 * (genre, météo de la ville, style, couleurs préférées) puis ordonnée par
 * compatibilité morphologique. Chaque filtre ne s'applique que s'il laisse
 * assez de pièces pour rester une capsule complète.
 */
export function computeDefaultCapsule(
  profile: Profile,
  weather: Weather,
  excludedIds: number[] = [],
  seasonKey?: CapsuleSeason,
  sourcePool: CatalogItem[] = CATALOG
): CatalogItem[] {
  const excluded = new Set(excludedIds);
  let base = sourcePool.filter((it) => !excluded.has(it.id));

  // R-B15 — symétrique du filtre appliqué à la génération de la tenue du jour
  // (logic.ts) : une pièce qui ne se justifie que par temps ensoleillé (ex.
  // lunettes de soleil) n'est jamais suggérée dans la capsule hors météo
  // ensoleillée.
  if (!isSunny(weather)) {
    base = base.filter((it) => !it.necessiteSoleil);
  }

  // Filtrage genre symétrique (recette 18/08/2026, distinction homme/femme
  // dans le catalogue) : un profil homme ne voit jamais les pièces taguées
  // femme, et réciproquement — les pièces unisexe restent visibles des deux
  // côtés. Le garde-fou "≥16" évite de trop restreindre le pool si le
  // catalogue manque encore de pièces genrées dans un sens.
  if (profile.gender === "homme") {
    const noFem = base.filter((it) => it.genre !== "femme");
    if (noFem.length >= 16) base = noFem;
  } else if (profile.gender === "femme") {
    const noHomme = base.filter((it) => it.genre !== "homme");
    if (noHomme.length >= 16) base = noHomme;
  }

  const bucket = seasonKey
    ? (["Printemps", "Été"].includes(seasonKey) ? "Printemps / Été" : "Automne / Hiver")
    : weatherSeasonBucket(weather.temp);
  const seasonFit = base.filter((it) => it.season === bucket || it.season === "Toutes saisons");
  if (seasonFit.length >= 16) base = seasonFit;

  const styles = profile.styles || [];
  let curated = styles.length ? base.filter((it) => styles.some((st) => styleFit(it, st))) : base;
  if (curated.length < 18) curated = base;

  const favColors = paletteHexes(profile);
  const hasPaletteProfile = favColors.length > 0 || !!profile.paletteAffinite || !!profile.paletteIntensite;
  if (hasPaletteProfile) {
    const pFit = curated.filter((it) => paletteFit(it, profile));
    if (pFit.length >= 12) curated = pFit;
  }

  // Priorité aux pièces indispensables (est_basique_capsule), puis tri par
  // compatibilité morphologique au sein de chaque groupe.
  const sorted = [...curated].sort((a, b) => {
    const basique = Number(!!b.estBasiqueCapsule) - Number(!!a.estBasiqueCapsule);
    if (basique !== 0) return basique;
    return Number(morphoFit(b, profile.morphology)) - Number(morphoFit(a, profile.morphology));
  });
  let out = sorted.slice(0, 34);

  // Garantit la présence d'au moins une pièce de chaque catégorie essentielle
  // dans la capsule, même si les filtres précédents les avaient toutes
  // écartées — sinon certaines tenues (superposition R-B9/R-S14, catégories
  // entières) n'auraient aucune pièce éligible pour un dressing encore vide.
  const ensure = (cat: CategoryKey) => {
    if (out.some((it) => it.cat === cat)) return;
    const pool = sourcePool.filter(
      (it) => it.cat === cat && !excluded.has(it.id) && (isSunny(weather) || !it.necessiteSoleil)
    );
    const fav = pool.filter((it) => favColors.includes(it.hex));
    const pickFrom = fav.length ? fav : pool;
    if (pickFrom.length) out = [...out, pickFrom[0]];
  };
  (["haut", "chaussures", "sac", "bijou", "veste", "manteau", "pull", "accessoire"] as CategoryKey[]).forEach(ensure);

  // Garantit au moins une paire de chaussures d'intérieur, indépendamment du
  // style — sinon un look Cocooning (R-B12) n'aurait aucune chaussure éligible.
  if (!out.some((it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur")) {
    const pool = sourcePool.filter(
      (it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur" && !excluded.has(it.id)
    );
    const fav = pool.filter((it) => favColors.includes(it.hex));
    const pickFrom = fav.length ? fav : pool;
    if (pickFrom.length) out = [...out, pickFrom[0]];
  }

  return out;
}
