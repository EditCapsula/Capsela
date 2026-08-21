import { CATALOG, type CatalogItem } from "./catalog";
import { formalityOf, intensiteOf, tonsOf } from "./attributes";
import { isSunny, type Weather } from "./data";
import {
  STYLE_ID_TO_CATALOG_LABEL,
  paletteHexes,
  type Affinite,
  type Intensite,
  type Profile,
  type StyleId,
} from "./profile";
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
  f_sablier: /portefeuille|cache-cœur|robe|jupe|ceinture|blazer/,
  f_triangle_inverse: /jupe|pantalon large|jean|chino|robe longue|évasé/,
  f_poire: /blouse|chemis|blazer|top|collier|boucles|foulard|épaul/,
  f_rectangle: /pull|gilet|combinaison|trench|blazer|torsad/,
  f_pomme: /fluide|longue|portefeuille|lin|large|oversize/,
};

export function morphoFit(it: Item, morpho: string | null): boolean {
  if (!morpho) return false;
  if (it.morphologyTags) return it.morphologyTags.includes(morpho);
  const rx = MORPHO_FIT[morpho];
  return rx ? rx.test((it.name + " " + it.color).toLowerCase()) : false;
}

/** Points de vigilance par morphologie (scoring négatif R-S9) — jamais bloquant. */
const MORPHO_AVOID: Record<string, RegExp> = {
  f_sablier: /oversize|large|ample/,
  f_triangle_inverse: /épaul|structuré haut|blazer|manches bouffantes/,
  f_poire: /moulant|ceinture serrée/,
  f_rectangle: /^(?!.*(pull|gilet|combinaison|trench|blazer|torsad)).*coupe droite.*$/,
  f_pomme: /moulant|ceinture serrée|col montant/,
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
  // oppositeGenre réutilisé plus bas par les filets de sécurité ensure()
  // (correctif 21/08/2026, signalé — cabas femme visible sur un profil
  // homme) : ces filets retombent volontairement sur sourcePool (non
  // filtré par genre à ce stade) pour ne jamais laisser une catégorie
  // essentielle totalement vide, mais oubliaient le genre, réintroduisant
  // ainsi une pièce de l'autre genre dès qu'aucune pièce genrée ne passait
  // les filtres précédents (température/style/palette).
  const oppositeGenre = profile.gender === "homme" ? "femme" : profile.gender === "femme" ? "homme" : null;
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

  // Plage de température (correctif 20/08/2026) — jamais appliquée ici
  // jusque-là, contrairement à generateOutfit/swapOutfitPiece (logic.ts) :
  // un article dont le season_capsule touche à la fois Printemps et Automne
  // (mais ni Été ni Hiver, ex. des collants mi-saison) retombe sur le bucket
  // "Toutes saisons" faute d'un modèle de saison plus fin (cf. Season,
  // 3 valeurs seulement) — il n'était donc jamais exclu de la capsule Été
  // malgré des bornes meteo_min_temp/meteo_max_temp explicites qui
  // l'excluent clairement. Utilise la température représentative de la
  // saison demandée plutôt que la météo du jour, cohérent avec l'esprit
  // "valable sur toute la saison" de la capsule (cf. representativeWeatherFor).
  const capsuleTemp = seasonKey ? REPRESENTATIVE_TEMP[seasonKey] : weather.temp;
  const tempFit = base.filter(
    (it) => (it.meteoMinTemp == null || capsuleTemp >= it.meteoMinTemp) && (it.meteoMaxTemp == null || capsuleTemp <= it.meteoMaxTemp)
  );
  if (tempFit.length >= 16) base = tempFit;

  // profile.styles porte des ids (StyleId) depuis la Tâche 7 — traduits en
  // libellé catalogue avant de matcher styleFit()/it.styleTags, qui restent
  // eux au format libellé français (colonne `styles` de vestiaire_universel).
  const styles = (profile.styles || [])
    .map((id) => STYLE_ID_TO_CATALOG_LABEL[id as StyleId])
    .filter((label): label is string => Boolean(label));
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
  // Plafond relevé de 34 à 50 (recette 20/08/2026, suite à "Mules à talons"
  // jamais visible) : le tri basique-d'abord poussait systématiquement hors
  // du plafond toute pièce non basique d'une catégorie déjà pourvue en
  // basiques (une seule pièce basique de la catégorie suffisait à satisfaire
  // le filet de sécurité ensure() ci-dessous, sans jamais garantir qu'une
  // pièce précise y figure) — jamais un vrai bug de règle, mais une capsule
  // qui ne laissait aucune place aux pièces plus habillées/statement.
  let out = sorted.slice(0, 50);

  // Garantit la présence d'au moins une pièce de chaque catégorie essentielle
  // dans la capsule, même si les filtres précédents les avaient toutes
  // écartées — sinon certaines tenues (superposition R-B9/R-S14, catégories
  // entières) n'auraient aucune pièce éligible pour un dressing encore vide.
  const ensure = (cat: CategoryKey) => {
    if (out.some((it) => it.cat === cat)) return;
    // meteo_min_temp/meteo_max_temp respectés ici aussi (correctif 20/08/2026)
    // — sinon ce filet de sécurité pouvait réintroduire une pièce que le
    // filtre de température venait tout juste d'exclure (constaté : des
    // collants mi-saison réapparaissant dans une capsule Été/Hiver dès que
    // plus aucun autre accessoire ne passait le filtre).
    const pool = sourcePool.filter(
      (it) =>
        it.cat === cat &&
        !excluded.has(it.id) &&
        it.genre !== oppositeGenre &&
        (isSunny(weather) || !it.necessiteSoleil) &&
        (it.meteoMinTemp == null || capsuleTemp >= it.meteoMinTemp) &&
        (it.meteoMaxTemp == null || capsuleTemp <= it.meteoMaxTemp)
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
      (it) =>
        it.cat === "chaussures" &&
        it.shoeType === "Chaussures d'intérieur" &&
        !excluded.has(it.id) &&
        it.genre !== oppositeGenre
    );
    const fav = pool.filter((it) => favColors.includes(it.hex));
    const pickFrom = fav.length ? fav : pool;
    if (pickFrom.length) out = [...out, pickFrom[0]];
  }

  // Garantit une base Sport complète — haut, bas et chaussures de
  // formalité 0 (recette 20/08/2026) : le plafond de 34 pièces + le tri par
  // "basique"/morphologie pouvait exclure les pièces sport (rarement taguées
  // est_basique_capsule) alors que ensure() ci-dessus se contente d'"au
  // moins un haut/une chaussure", sans exiger qu'ils soient sport-compatibles
  // — un haut habillé suffisait à satisfaire cette garde, laissant l'occasion
  // Sport sans aucune tenue complète possible (R-B11, formalité stricte).
  const ensureSport = (cats: CategoryKey[]) => {
    if (out.some((it) => cats.includes(it.cat) && formalityOf(it) === 0)) return;
    const pool = sourcePool.filter(
      (it) => cats.includes(it.cat) && formalityOf(it) === 0 && !excluded.has(it.id) && (isSunny(weather) || !it.necessiteSoleil)
    );
    const fav = pool.filter((it) => favColors.includes(it.hex));
    const pickFrom = fav.length ? fav : pool;
    if (pickFrom.length) out = [...out, pickFrom[0]];
  };
  ensureSport(["haut", "pull"]);
  ensureSport(["pantalon", "jean", "short"]);
  ensureSport(["chaussures"]);

  return out;
}
