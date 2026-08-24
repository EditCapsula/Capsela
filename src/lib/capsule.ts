import { CATALOG, type CatalogItem } from "./catalog";
import { formalityOf, intensiteOf, isStatement, suggestOccasions, tonsOf } from "./attributes";
import { isSunny, type Weather } from "./data";
import {
  STYLE_ID_TO_CATALOG_LABEL,
  paletteHexes,
  type Affinite,
  type Intensite,
  type Profile,
  type StyleId,
} from "./profile";
import type { CapsuleSeason, CategoryKey, Item, IntensiteCouleur, OccasionKey, Season, Tons } from "./types";

/** Bascule saisonnière pilotée par la température de la ville. */
export function weatherSeasonBucket(temp: number): Season {
  return temp >= 20 ? "Printemps / Été" : "Automne / Hiver";
}

/** Bucket météo (2 valeurs) correspondant à une saison calendaire de capsule (4 valeurs). */
export function capsuleSeasonBucket(s: CapsuleSeason): Season {
  return s === "Printemps" || s === "Été" ? "Printemps / Été" : "Automne / Hiver";
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
 * Macro-catégories de la sélection qualitative de capsule (recette
 * 24/08/2026, plafonds + tri qualitatif — remplace le tri basique/morpho +
 * slice(50) qui laissait passer 49 pièces sur une capsule Minimaliste,
 * certaines catégories à 12 pièces quand Vestes plafonnait à 1 seule).
 * Regroupe les 14 CategoryKey en 7 blocs pour répartir le plafond de 35
 * pièces hors Sport (le Sport est isolé avant ce calcul, cf. isSportPiece).
 */
const CAPSULE_GROUPS: { name: string; cats: CategoryKey[]; quota: number }[] = [
  { name: "hauts", cats: ["haut", "pull"], quota: 8 },
  { name: "bas", cats: ["pantalon", "jean", "jupe", "short"], quota: 7 },
  { name: "robes-combinaisons", cats: ["robe", "combinaison"], quota: 4 },
  { name: "vestes-manteaux", cats: ["veste", "manteau"], quota: 5 },
  { name: "chaussures", cats: ["chaussures"], quota: 4 },
  { name: "accessoires", cats: ["sac", "accessoire"], quota: 4 },
  { name: "bijoux", cats: ["bijou"], quota: 3 },
];

/** Catégories structurantes (étape 3, garde-fou formalité) — celles dont dépend le palier de formalité d'une tenue complète. */
const STRUCTURING_GROUPS = new Set(["hauts", "bas", "robes-combinaisons"]);

/** Occasions couvertes par une pièce — déclarées si présentes, sinon repli sur la déduction existante (jamais une pièce sans donnée qui compte pour zéro par accident). */
function occasionsOf(it: Item): OccasionKey[] {
  return it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType);
}

/**
 * Pièce qui débloque le plus d'occasions pas encore couvertes par la
 * capsule en cours de construction — marginale, pas brute (une pièce qui
 * ne fait que redécouvrir une occasion déjà acquise n'apporte rien).
 * Égalité tranchée par est_basique_capsule, puis compatibilité
 * morphologique (cf. morphoFit, préservé de l'ancien tri), puis id
 * (déterministe).
 */
function pickBestMarginal(candidates: CatalogItem[], covered: Set<OccasionKey>, morphology: string | null): CatalogItem | null {
  const scoreKey = (it: CatalogItem): number[] => [
    occasionsOf(it).filter((o) => !covered.has(o)).length,
    it.estBasiqueCapsule ? 1 : 0,
    morphoFit(it, morphology) ? 1 : 0,
    -it.id,
  ];
  // Comparaison lexicographique : le premier critère qui diffère tranche
  // (couverture marginale > basique > morphologie > id, dans cet ordre).
  const isBetter = (a: number[], b: number[]) => {
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return a[i] > b[i];
    }
    return false;
  };
  let best: CatalogItem | null = null;
  let bestKey: number[] | null = null;
  for (const it of candidates) {
    const key = scoreKey(it);
    if (!best || !bestKey || isBetter(key, bestKey)) {
      best = it;
      bestKey = key;
    }
  }
  return best;
}

/**
 * Sélection qualitative d'un bloc macro-catégorie (étapes 2.1/2.2) : 1
 * place réservée à la meilleure pièce statement=true du pool si au moins
 * une existe (sautée sinon — styles sobres type Minimaliste), puis le
 * reste du quota rempli par couverture d'occasion marginale décroissante
 * contre l'ensemble de la capsule en construction (pas juste cette
 * catégorie, cf. paramètre `covered` partagé entre tous les appels).
 */
function selectGroup(
  pool: CatalogItem[],
  quota: number,
  covered: Set<OccasionKey>,
  morphology: string | null
): CatalogItem[] {
  const picked: CatalogItem[] = [];
  let remaining = quota;

  const statementCandidates = pool.filter((it) => isStatement(it));
  if (statementCandidates.length && remaining > 0) {
    const best = pickBestMarginal(statementCandidates, covered, morphology);
    if (best) {
      picked.push(best);
      occasionsOf(best).forEach((o) => covered.add(o));
      remaining -= 1;
    }
  }

  let candidates = pool.filter((it) => !picked.some((p) => p.id === it.id));
  while (remaining > 0 && candidates.length) {
    const best = pickBestMarginal(candidates, covered, morphology);
    if (!best) break;
    picked.push(best);
    occasionsOf(best).forEach((o) => covered.add(o));
    candidates = candidates.filter((it) => it.id !== best.id);
    remaining -= 1;
  }

  return picked;
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

  const bucket = seasonKey ? capsuleSeasonBucket(seasonKey) : weatherSeasonBucket(weather.temp);
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
  // La gourde et le sac de sport sont purement fonctionnels (recette
  // 22/08/2026, signalé : "la gourde doit s'afficher pour tous les styles
  // dans la catégorie sport") — aucun style esthétique n'a de sens à leur
  // appliquer, donc ils échappent au filtre de curation par style plutôt que
  // de risquer d'être exclus faute de correspondre à la garde-robe stylée du
  // profil (ex. Bohème, Classique chic...).
  const isSportEssential = (it: Item) =>
    (it.cat === "accessoire" && it.accessoireType === "Gourde") || (it.cat === "sac" && it.sacType === "Sac de sport");
  let curated = styles.length ? base.filter((it) => isSportEssential(it) || styles.some((st) => styleFit(it, st))) : base;
  if (curated.length < 18) curated = base;

  const favColors = paletteHexes(profile);
  const hasPaletteProfile = favColors.length > 0 || !!profile.paletteAffinite || !!profile.paletteIntensite;
  if (hasPaletteProfile) {
    const pFit = curated.filter((it) => paletteFit(it, profile));
    if (pFit.length >= 12) curated = pFit;
  }

  // Bloc Sport isolé avant le calcul du plafond (étape 0, recette
  // 24/08/2026, plafonds + tri qualitatif) : formalité 0 traité à part —
  // jamais soumis au même tri qualitatif que le reste (cf. bloc Sport
  // ci-dessous), pour ne jamais faire concurrence aux pièces non-Sport sur
  // la couverture d'occasion (les deux restent des populations distinctes
  // même si le total est partagé).
  const isSportPiece = (it: Item) => formalityOf(it) === 0;
  const sportPool = curated.filter(isSportPiece);
  const nonSportPool = curated.filter((it) => !isSportPiece(it));

  // Sélection qualitative par macro-catégorie (étapes 1-2) : remplace
  // l'ancien tri basique/morpho + slice(50) qui laissait passer des
  // capsules à 49 pièces (12 hauts, 6 chaussures) quand Vestes plafonnait à
  // 1 seule — la requête catalogue (style × saison × genre) n'avait aucun
  // plafond par catégorie. Plafond de 35 pièces hors Sport, réparti par
  // quota indicatif (cf. CAPSULE_GROUPS), rempli par couverture d'occasion
  // marginale décroissante plutôt qu'un plafond arbitraire.
  const covered = new Set<OccasionKey>();
  const poolByGroup = new Map<string, CatalogItem[]>();
  let out: CatalogItem[] = [];
  for (const group of CAPSULE_GROUPS) {
    const groupPool = nonSportPool.filter((it) => group.cats.includes(it.cat));
    poolByGroup.set(group.name, groupPool);
    out = [...out, ...selectGroup(groupPool, group.quota, covered, profile.morphology)];
  }

  // Garde-fou formalité (étape 3) : dans les catégories structurantes, si
  // un palier de formalité existe dans le pool mais n'est représenté par
  // aucune pièce sélectionnée (le tri par couverture l'a évincé), on le
  // réintègre de force — même à faible score de couverture. Distinct de la
  // réservation "statement" ci-dessus (selectGroup) : une pièce habillée
  // peut être parfaitement sobre et non-statement (ex. pantalon de costume
  // marine uni), donc pas garantie de survivre par ce seul mécanisme.
  for (const group of CAPSULE_GROUPS) {
    if (!STRUCTURING_GROUPS.has(group.name)) continue;
    const groupPool = poolByGroup.get(group.name) || [];
    const tiersPresent = new Set(groupPool.map((it) => formalityOf(it)));
    tiersPresent.forEach((tier) => {
      const alreadyCovered = out.some((it) => group.cats.includes(it.cat) && formalityOf(it) === tier);
      if (alreadyCovered) return;
      const forced = groupPool.filter((it) => formalityOf(it) === tier).sort((a, b) => a.id - b.id)[0];
      if (forced) out = [...out, forced];
    });
  }

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

  // Bloc Sport (étape 4) : toutes les pièces Sport du pool (déjà filtrées
  // par saison/température/genre/style comme le reste, cf. curated)
  // s'ajoutent telles quelles par-dessus le bloc non-Sport — comptées dans
  // le total global de la capsule, mais toujours présentes, jamais
  // soumises au tri qualitatif ci-dessus (même logique que la garantie
  // chaussures d'intérieur juste au-dessus pour le Cocooning).
  out = [...out, ...sportPool];

  return out;
}
