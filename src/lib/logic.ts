import type { CategoryKey, Item, OccasionKey } from "./types";
import type { Weather } from "./data";
import { BAS_CATS, OCC_FORMALITY } from "./data";
import { bestStyleFor, morphoFit, morphoVigilance } from "./capsule";
import {
  coupeOf,
  formalityOf,
  huesHarmonious,
  isNeutralColor,
  isStatement,
  matiereOf,
  metalOf,
  rolePieceOf,
} from "./attributes";

const BOTTOMS: CategoryKey[] = [...BAS_CATS, "jupe"];
/** Catégories haut du corps concernées par le rôle base/calque (R-B8, R-S11/S12). */
const TOP_LAYER_CATS: CategoryKey[] = ["haut", "pull"];
const TOP_OR_BOTTOM_CATS: CategoryKey[] = [...TOP_LAYER_CATS, ...BAS_CATS, "jupe"];
/** Pièces qui constituent une base valide sous une veste/un manteau (R-B9) — un pull seul ne compte pas comme base. */
const BASE_GARMENT_CATS: CategoryKey[] = ["haut", "robe", "combinaison"];
const OUTERWEAR_CATS: CategoryKey[] = ["veste", "manteau"];
/** Catégories piochées ensemble comme "couche" quand le toggle superposition est actif. */
const LAYER_CATS: CategoryKey[] = ["veste", "manteau", "pull"];

/** Catégories suivies pour l'anti-répétition (R-B7) et le calcul de formalité d'une tenue. */
const CLOTHING_CATS: CategoryKey[] = [...TOP_LAYER_CATS, ...BAS_CATS, "jupe", "robe", "combinaison", "veste", "manteau"];
const ACCESSORY_CATS: CategoryKey[] = ["chaussures", "sac", "bijou", "accessoire"];

/** Une veste/un manteau seul, sans pièce de base, n'est pas une tenue complète (R-B9). */
function hasBaseGarment(items: Item[]): boolean {
  return items.some((i) => BASE_GARMENT_CATS.includes(i.cat));
}

/** R-B9 — vrai si la sélection contient une veste/un manteau sans pièce de base (haut, robe, combinaison) en dessous. */
export function violatesOuterwearRule(pieces: Item[]): boolean {
  return pieces.some((i) => OUTERWEAR_CATS.includes(i.cat)) && !hasBaseGarment(pieces);
}

function recentlyWorn(it: Item): boolean {
  return it.worn != null && it.worn <= 2;
}

function isDressy(occasion: OccasionKey): boolean {
  return (OCC_FORMALITY[occasion] || 0) >= 3;
}

export function occasionFit(it: Item, occ: OccasionKey): boolean {
  // Une occasion déclarée sur la pièce prime sur les heuristiques de nom.
  if (it.occasion && it.occasion.length) return it.occasion.includes(occ);
  const n = (it.name + " " + it.color).toLowerCase();
  switch (occ) {
    case "quotidien":
      return /baskets|jean droit|chino|t-shirt|sweat|mocassins|ballerines|cabas|kaki|sable|crème/.test(n);
    case "travail_formel":
      return /tailleur|chemis|blazer|blouse|escarpin|mocassin|gilet|robe chemise|robe droite|marine|noir/.test(n);
    case "entretien":
      return /tailleur|blazer|chemis|escarpin|robe chemise|robe droite|marine|noir/.test(n);
    case "date":
      return /soie|robe|blouse|escarpin|jupe|foulard|rose poudré|bordeaux/.test(n);
    case "soiree":
      return /soie|robe|escarpin|doré|bordeaux|noir/.test(n);
    case "evenement_pro":
      return /tailleur|blazer|chemis|escarpin|robe chemise|robe droite|marine/.test(n);
    case "evenement_perso":
      return /soie|robe longue|robe droite|escarpin|dentelle|doré|glamour|paillet|tailleur|chemis/.test(n);
    case "sport":
      return /sweat|jean brut|molleton|baskets|coupe-vent|débardeur|jogging/.test(n);
    case "voyage":
      return /baskets|jean|sweat|chino|t-shirt|coupe-vent|molleton/.test(n);
    case "cocooning":
      return /sweat|molleton|jogging|pull col rond/.test(n);
    default:
      return true;
  }
}

/**
 * Resserre un pool de candidats pour qu'ils s'accordent avec les pièces déjà
 * retenues : couleur (au plus une teinte affirmée par tenue), formalité
 * (écart limité avec les pièces déjà choisies, esprit R-B2), coupe (évite le
 * double ajusté/double oversize haut+bas, esprit R-B4), puis style —
 * chaque critère ne s'applique que s'il laisse au moins une option, jamais
 * de blocage total pour une pièce essentielle.
 */
function harmonize(candidates: Item[], chosen: Item[], essential = true): Item[] {
  if (candidates.length <= 1 || !chosen.length) return candidates;
  let pool = candidates;

  // Couleur — au plus une teinte affirmée par tenue. Le bijou est un petit
  // accent métallique (or/argent) : il ne doit pas consommer à lui seul le
  // budget « une couleur affirmée par tenue ».
  const colorRelevant = chosen.filter((i) => i.cat !== "bijou");
  const accentPiece = colorRelevant.find((i) => !isNeutralColor(i.color));
  if (accentPiece) {
    const neutrals = pool.filter((i) => isNeutralColor(i.color));
    if (neutrals.length) {
      pool = neutrals;
    } else {
      // Aucune option neutre ici (ex. accessoires souvent tous colorés) :
      // on reprend la même teinte affirmée plutôt que d'en ajouter une autre.
      const echo = pool.filter((i) => i.color === accentPiece.color);
      if (echo.length) pool = echo;
      // Sinon, pour une pièce facultative on préfère l'omettre plutôt que
      // jurer avec la couleur déjà choisie ; les pièces essentielles, elles,
      // ne doivent jamais se retrouver bloquées à zéro option.
      else if (!essential) pool = [];
    }
  }
  if (!pool.length) return pool;

  // Formalité — écart limité avec la formalité moyenne déjà choisie (R-B2).
  if (pool.length > 1) {
    const formalities = chosen.map(formalityOf);
    const avg = formalities.reduce((a, b) => a + b, 0) / formalities.length;
    const close = pool.filter((i) => Math.abs(formalityOf(i) - avg) <= 2);
    if (close.length) pool = close;
  }

  // Coupe — évite un double ajusté ou double oversize sur haut+bas (R-B4).
  if (pool.length > 1) {
    const anchor = chosen.find((i) => TOP_OR_BOTTOM_CATS.includes(i.cat));
    if (anchor) {
      const anchorCoupe = coupeOf(anchor);
      if (anchorCoupe !== "regular") {
        const nonClashing = pool.filter(
          (i) => !(TOP_OR_BOTTOM_CATS.includes(i.cat) && coupeOf(i) === anchorCoupe)
        );
        if (nonClashing.length) pool = nonClashing;
      }
    }
  }

  const anchorStyle = bestStyleFor(chosen[0]);
  const styleMatches = pool.filter((i) => bestStyleFor(i) === anchorStyle);
  if (styleMatches.length) pool = styleMatches;
  return pool;
}

function rand<T>(arr: T[]): T | null {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

export interface GeneratedOutfit {
  ids: number[];
  /** Catégories essentielles totalement absentes du pool (pas seulement de ce tirage). "bas" regroupe pantalon/jean/short, "couche" = veste/manteau/pull (superposition). */
  missingCats: (CategoryKey | "bas" | "couche")[];
}

/**
 * Génère une tenue depuis le pool actif (dressing réel, ou capsule par
 * défaut tant qu'il est vide).
 * Pipeline de filtrage (ordre imposé) : saison (a) → anti-répétition ≤2j
 * sur haut/bas/jupe/robe/combinaison/manteau/pull (b, R-B7) → occasion (c).
 * Si le pool résultant est trop restreint (< 4 pièces), on relâche dans
 * l'ordre inverse : d'abord l'occasion, puis l'anti-répétition, la saison
 * en tout dernier recours. Les baskets sont ensuite reléguées si l'occasion
 * est habillée (R-B6), et les pièces choisies pour s'accorder entre elles
 * (couleur, formalité, coupe, style).
 */
export function generateOutfit(
  pool: Item[],
  weather: Weather,
  occasion: OccasionKey,
  layerable = false
): GeneratedOutfit {
  const seasonPool = pool.filter((i) => weather.seasons.includes(i.season));
  const seasonBase = seasonPool.length >= 4 ? seasonPool : pool;

  const antiRepPool = seasonBase.filter((i) => !(CLOTHING_CATS.includes(i.cat) && recentlyWorn(i)));
  const antiRepClothingCount = antiRepPool.filter((i) => CLOTHING_CATS.includes(i.cat)).length;
  const antiRepBase = antiRepClothingCount >= 2 ? antiRepPool : seasonBase;

  const occFiltered = occasion === "all" ? antiRepBase : antiRepBase.filter((i) => occasionFit(i, occasion));
  const active = occFiltered.length >= 4 ? occFiltered : antiRepBase;

  const chosen: Item[] = [];
  const pick = (cats: CategoryKey[], essential = true) => {
    const candidates = harmonize(active.filter((i) => cats.includes(i.cat)), chosen, essential);
    const picked = rand(candidates);
    if (picked) chosen.push(picked);
    return picked;
  };
  const hasCat = (cats: CategoryKey[]) => pool.some((i) => cats.includes(i.cat));

  const ids: number[] = [];
  const useRobe = Math.random() < 0.4 && active.some((i) => i.cat === "robe");
  if (useRobe) {
    const r = pick(["robe"]);
    if (r) ids.push(r.id);
  } else {
    const h = pick(["haut"]);
    const b = pick(BOTTOMS);
    if (h) ids.push(h.id);
    if (b) ids.push(b.id);
  }
  // Superposition (R-S11/R-S12/R-B8) : une pièce haut supplémentaire (ex. gilet,
  // cardigan) — jamais deux calques simultanés, jamais de calque seul en
  // contexte habillé sans validation manuelle. Une robe/combinaison se suffit
  // à elle-même (R-B5) : pas de haut en plus dans ce cas.
  if (!useRobe && Math.random() < 0.35) {
    const dressy = isDressy(occasion);
    const layerCandidates = active.filter((i) => {
      if (i.cat !== "haut" || chosen.some((c) => c.id === i.id)) return false;
      if (rolePieceOf(i) !== "calque") return true;
      const hasCalqueAlready = chosen.some((c) => c.cat === "haut" && rolePieceOf(c) === "calque");
      return !hasCalqueAlready && !dressy;
    });
    const layer = rand(harmonize(layerCandidates, chosen, false));
    if (layer) { chosen.push(layer); ids.push(layer.id); }
  }
  // "Je veux pouvoir superposer" : une seule pièce veste/manteau/pull piochée
  // dans tout le dressing (pas seulement le pool filtré) plutôt que veste et
  // pull séparément — sinon veste et pull restent des ajouts ponctuels.
  if (layerable) {
    const layerPool = pool.filter((i) => LAYER_CATS.includes(i.cat));
    const v = rand(layerPool);
    if (v && !ids.includes(v.id)) ids.push(v.id);
  } else {
    if (Math.random() < 0.35) {
      const p = pick(["pull"], false);
      if (p && !ids.includes(p.id)) ids.push(p.id);
    }
    if (Math.random() < 0.3) {
      const v = pick(["veste"], false);
      if (v && !ids.includes(v.id)) ids.push(v.id);
    }
  }
  const sh = (() => {
    const shoePool = active.filter((i) => i.cat === "chaussures");
    const nonBasket = shoePool.filter((i) => i.shoeType !== "Baskets");
    const finalPool = isDressy(occasion) && nonBasket.length ? nonBasket : shoePool;
    const picked = rand(harmonize(finalPool, chosen, true));
    if (picked) chosen.push(picked);
    return picked;
  })();
  if (sh) ids.push(sh.id);
  const sac = pick(["sac"]);
  if (sac) ids.push(sac.id);
  const bijou = pick(["bijou"]);
  if (bijou) ids.push(bijou.id);
  if (Math.random() < 0.5) {
    const ac = pick(["accessoire"], false);
    if (ac && !ids.includes(ac.id)) ids.push(ac.id);
  }

  const missingCats: (CategoryKey | "bas" | "couche")[] = [];
  if (!useRobe) {
    if (!hasCat(["haut"])) missingCats.push("haut");
    if (!hasCat(BOTTOMS)) missingCats.push("bas");
  }
  if (!hasCat(["chaussures"])) missingCats.push("chaussures");
  if (!hasCat(["sac"])) missingCats.push("sac");
  if (!hasCat(["bijou"])) missingCats.push("bijou");
  if (layerable && !pool.some((i) => LAYER_CATS.includes(i.cat))) missingCats.push("couche");

  return { ids: Array.from(new Set(ids)), missingCats };
}

/**
 * Remplace une pièce de la tenue par une autre de la même famille de
 * catégorie, en priorité une qui s'accorde avec le reste de la tenue.
 * Les baskets sont écartées du tirage si l'occasion est habillée (R-B6).
 */
export function swapOutfitPiece(
  outfitItems: Item[],
  pool: Item[],
  pieceId: number,
  cat: CategoryKey,
  occasion: OccasionKey = "all"
): number[] {
  const catGroup: CategoryKey[] =
    BAS_CATS.includes(cat) ? BOTTOMS : cat === "accessoire" ? ["accessoire", "bijou", "sac"] : [cat];
  let candidates = pool.filter((i) => catGroup.includes(i.cat) && i.id !== pieceId);
  if (cat === "chaussures" && isDressy(occasion)) {
    const nonBasket = candidates.filter((i) => i.shoeType !== "Baskets");
    if (nonBasket.length) candidates = nonBasket;
  }
  if (!candidates.length) return outfitItems.map((i) => i.id);
  const rest = outfitItems.filter((i) => i.id !== pieceId);
  const next = rand(harmonize(candidates, rest));
  if (!next) return outfitItems.map((i) => i.id);
  return outfitItems.map((i) => (i.id === pieceId ? next.id : i.id));
}

/** Une règle bloquante déclenchée, avec son message en langage simple (jamais le nom technique côté UI). */
export interface BlockingHit {
  id: string;
  message: string;
  /** R-B9 uniquement : bloque réellement la sauvegarde (contrairement aux autres règles, juste signalées). */
  hard?: boolean;
}

/**
 * Évalue les 9 règles bloquantes (R-B1 à R-B9) sur un ensemble de pièces.
 * Sauf R-B9, aucune n'empêche la sauvegarde : sert uniquement à afficher un
 * bandeau doux, non alarmant, quand une règle est contournée manuellement
 * (Création de looks). La génération automatique, elle, évite ces
 * combinaisons en amont via generateOutfit/harmonize.
 */
export function evaluateBlocking(pieces: Item[], occasion: OccasionKey, weather: Weather): BlockingHit[] {
  const hits: BlockingHit[] = [];
  const clothing = pieces.filter((i) => CLOTHING_CATS.includes(i.cat));

  if (pieces.some((i) => i.season !== "Toutes saisons" && !weather.seasons.includes(i.season))) {
    hits.push({ id: "R-B1", message: "Une pièce n'est pas vraiment de saison aujourd'hui." });
  }

  if (clothing.length >= 2) {
    const formalities = clothing.map(formalityOf);
    if (Math.max(...formalities) - Math.min(...formalities) > 2) {
      hits.push({ id: "R-B2", message: "Le niveau habillé de cette tenue est assez contrasté d'une pièce à l'autre." });
    }
  }

  if (occasion !== "all" && clothing.length) {
    const minFormality = Math.min(...clothing.map(formalityOf));
    if (minFormality < (OCC_FORMALITY[occasion] || 0)) {
      hits.push({ id: "R-B3", message: "Cette tenue est peut-être un peu trop décontractée pour l'occasion choisie." });
    }
  }

  const hasRobeOrCombi = pieces.some((i) => i.cat === "robe" || i.cat === "combinaison");
  const topBottom = clothing.filter((i) => TOP_OR_BOTTOM_CATS.includes(i.cat));
  if (!hasRobeOrCombi && topBottom.length === 2) {
    const [a, b] = topBottom;
    const ca = coupeOf(a);
    const cb = coupeOf(b);
    if (ca === cb && ca !== "regular") {
      hits.push({
        id: "R-B4",
        message:
          ca === "oversize"
            ? "Haut et bas très amples ensemble, essaie d'équilibrer avec une pièce plus près du corps."
            : "Haut et bas très ajustés ensemble, essaie d'apporter un peu de volume.",
      });
    }
  }

  if (hasRobeOrCombi && pieces.some((i) => TOP_OR_BOTTOM_CATS.includes(i.cat))) {
    hits.push({ id: "R-B5", message: "Une robe ou une combinaison se suffit à elle-même, sans haut ni bas en plus." });
  }

  const dressy = isDressy(occasion);
  if (dressy && pieces.some((i) => i.cat === "chaussures" && i.shoeType === "Baskets")) {
    hits.push({ id: "R-B6", message: "Les baskets sont peut-être trop décontractées pour cette occasion." });
  }

  if (clothing.some(recentlyWorn)) {
    hits.push({ id: "R-B7", message: "Une pièce de cette tenue a déjà été portée il y a moins de 2 jours." });
  }

  const tops = pieces.filter((i) => TOP_LAYER_CATS.includes(i.cat));
  if (tops.length) {
    const roles = tops.map(rolePieceOf);
    const calqueCount = roles.filter((r) => r === "calque").length;
    if (calqueCount >= 2) {
      hits.push({ id: "R-B8", message: "Deux pièces amples superposées en même temps, essaie d'en retirer une." });
    } else if (calqueCount === 1 && dressy) {
      hits.push({ id: "R-B8", message: "Une pièce ample en superposition dans un contexte habillé, à valider toi-même." });
    }
  }

  // R-B9 — une veste ou un manteau seul ne fait pas une tenue complète.
  // Seule règle qui bloque réellement la sauvegarde (cf. section 6 du brief).
  if (violatesOuterwearRule(pieces)) {
    hits.push({
      id: "R-B9",
      message: "Ajoute un haut, une robe ou une combinaison sous ta veste pour compléter la tenue.",
      hard: true,
    });
  }

  return hits;
}

/** Résultat du scoring d'une tenue complète (R-S1 à R-S13). */
export interface LookScore {
  score: number;
  badge: "recommande" | "neutre" | "ajuster";
  /** Message ciblé sur la règle de scoring la plus pénalisante, seulement si badge === "ajuster". */
  adjustMessage: string;
  /** Suggestion proactive dismissible (R-S12/R-S13), au plus une à la fois. */
  proactive: { key: string; text: string } | null;
}

/**
 * Calcule le score d'une tenue complète (R-S1 à R-S13). Non bloquant :
 * une tenue reste toujours proposable quel que soit son score. Seuils :
 * ≥80 recommandé, 50-79 neutre, <50 bandeau d'ajustement ciblé sur la
 * règle la plus pénalisante (jamais cumulé, jamais le nom technique).
 */
export function computeLookScore(
  pieces: Item[],
  occasion: OccasionKey,
  favoriteColors: string[],
  morphology: string | null,
  dismissed: Set<string>
): LookScore {
  const clothing = pieces.filter((i) => CLOTHING_CATS.includes(i.cat));
  const accessories = pieces.filter((i) => ACCESSORY_CATS.includes(i.cat));
  const penalties: [number, string][] = [];
  const bonuses: number[] = [];

  // R-S1 — sobriété chromatique
  const nonNeutralClothingHex = new Set(clothing.filter((i) => !isNeutralColor(i.color)).map((i) => i.hex));
  if (nonNeutralClothingHex.size > 3) {
    penalties.push([10, "Cette tenue a beaucoup de couleurs, essaie d'en retirer une."]);
  }

  // R-S2 — harmonie cercle chromatique (bijou exclu, simple accent métallique)
  const nonNeutralAll = pieces.filter((i) => i.cat !== "bijou" && !isNeutralColor(i.color));
  let harmonious = false;
  for (let i = 0; i < nonNeutralAll.length && !harmonious; i++) {
    for (let j = i + 1; j < nonNeutralAll.length; j++) {
      if (nonNeutralAll[i].hex !== nonNeutralAll[j].hex && huesHarmonious(nonNeutralAll[i].hex, nonNeutralAll[j].hex)) {
        harmonious = true;
        break;
      }
    }
  }
  if (harmonious) bonuses.push(15);

  // R-S3 — règle 60/30/10 (approximation sur poids par catégorie, pas de vraie surface)
  const WEIGHT: Partial<Record<CategoryKey, number>> = {
    haut: 3, pantalon: 3, jean: 3, short: 3, robe: 3, combinaison: 3, jupe: 3, pull: 3, veste: 3, manteau: 3,
    chaussures: 1, sac: 1, bijou: 1, accessoire: 1,
  };
  const colorWeights = new Map<string, number>();
  pieces.forEach((i) => colorWeights.set(i.hex, (colorWeights.get(i.hex) || 0) + (WEIGHT[i.cat] || 1)));
  const totalW = [...colorWeights.values()].reduce((a, b) => a + b, 0);
  const sortedW = [...colorWeights.values()].sort((a, b) => b - a);
  const topShare = totalW ? sortedW[0] / totalW : 0;
  const secondShare = totalW && sortedW[1] ? sortedW[1] / totalW : 0;
  if (topShare >= 0.5 && secondShare <= 0.35) bonuses.push(10);

  // R-S4 — mélange de métaux
  const metals = new Set(pieces.map(metalOf).filter((m) => m !== "aucun"));
  if (metals.size > 1) penalties.push([5, "Tes bijoux mélangent or et argent."]);

  // R-S5 — une seule pièce statement
  const statementCount = pieces.filter(isStatement).length;
  if (statementCount >= 2) {
    penalties.push([15, "Deux pièces qui attirent l'œil en même temps, essaie d'en adoucir une."]);
  }

  // R-S6 — cohérence chaussures/tenue
  const shoe = pieces.find((i) => i.cat === "chaussures");
  if (shoe && (isNeutralColor(shoe.color) || clothing.some((i) => i.hex === shoe.hex))) {
    bonuses.push(10);
  }

  // R-S7 — compétition sac/chaussures
  const bag = pieces.find((i) => i.cat === "sac");
  if (bag && shoe && isStatement(bag) && isStatement(shoe)) {
    penalties.push([10, "Ton sac et tes chaussures sont tous les deux très affirmés."]);
  }

  // R-S8 — variété de matières (bijou exclu, pas de "matière" tissu pertinente)
  const matieres = new Set(pieces.filter((i) => i.cat !== "bijou").map(matiereOf));
  if (matieres.size > 1) bonuses.push(5);

  // R-S9 — cohérence morphologique (jamais bloquant, neutre si non renseignée)
  if (morphology) {
    if (clothing.some((i) => morphoFit(i, morphology))) bonuses.push(10);
    else if (clothing.some((i) => morphoVigilance(i, morphology))) {
      penalties.push([5, "Une pièce n'est peut-être pas la plus flatteuse pour ta silhouette déclarée."]);
    }
  }

  // R-S10 — couleurs privilégiées du profil
  if (favoriteColors.length && pieces.some((i) => favoriteColors.includes(i.hex))) bonuses.push(10);

  // R-S11 — layering réussi (base + calque en contexte décontracté)
  const tops = pieces.filter((i) => TOP_LAYER_CATS.includes(i.cat));
  const roles = tops.map(rolePieceOf);
  const dressy = isDressy(occasion);
  const hasBase = roles.includes("base");
  const hasCalque = roles.includes("calque");
  if (hasBase && hasCalque && !dressy) bonuses.push(10);

  let score = 100;
  penalties.forEach(([w]) => { score -= w; });
  bonuses.forEach((w) => { score += w; });
  score = Math.max(0, Math.min(120, score));

  penalties.sort((a, b) => b[0] - a[0]);
  const badge: LookScore["badge"] = score >= 80 ? "recommande" : score < 50 ? "ajuster" : "neutre";
  const adjustMessage = badge === "ajuster" && penalties.length ? penalties[0][1] : "";

  // R-S12 — suggestion layering (calque seul, sans base, contexte décontracté)
  // R-S13 — suggestion contraste (total look noir sans accessoire coloré)
  const proactiveCandidates: { key: string; text: string }[] = [];
  if (tops.length === 1 && roles[0] === "calque" && !dressy && !dismissed.has("layer")) {
    proactiveCandidates.push({
      key: "layer",
      text: "Essaie avec un débardeur ou un top fin en dessous, pour structurer un peu la silhouette.",
    });
  }
  const allBlack = clothing.length > 0 && clothing.every((i) => /noir/i.test(i.color));
  const hasColorAccessory = accessories.some((i) => !isNeutralColor(i.color));
  if (allBlack && !hasColorAccessory && !dismissed.has("color")) {
    proactiveCandidates.push({
      key: "color",
      text: "Une touche de couleur sur les accessoires pourrait casser ce total look noir.",
    });
  }

  return { score, badge, adjustMessage, proactive: proactiveCandidates[0] || null };
}
