import type { CategoryKey, DateContext, Item, OccasionKey, WorkMode } from "./types";
import type { Weather } from "./data";
import { BAS_CATS, effectiveFormality } from "./data";
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

/** Catégories suivies pour l'anti-répétition (R-B7) et le calcul de formalité d'une tenue. */
const CLOTHING_CATS: CategoryKey[] = [...TOP_LAYER_CATS, ...BAS_CATS, "jupe", "robe", "combinaison", "veste", "manteau"];
const ACCESSORY_CATS: CategoryKey[] = ["chaussures", "sac", "bijou", "accessoire"];

/** Météo ensoleillée — R-B16 (lunettes de soleil et pièces similaires). */
function isSunny(weather: Weather): boolean {
  return /soleil/i.test(weather.label);
}

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

function isDressy(occasion: OccasionKey, workMode: WorkMode = "Présentiel", dateContext: DateContext = "Verre"): boolean {
  return effectiveFormality(occasion, workMode, dateContext) >= 3;
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
    case "festive":
      return /soie|robe|escarpin|doré|paillet|bordeaux|noir|glamour/.test(n);
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
  /** Catégories essentielles totalement absentes du pool (pas seulement de ce tirage). "bas" regroupe pantalon/jean/short. */
  missingCats: (CategoryKey | "bas")[];
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
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre",
  preferredHexes: string[] = []
): GeneratedOutfit {
  const seasonPool = pool.filter((i) => weather.seasons.includes(i.season));
  const seasonBase = seasonPool.length >= 4 ? seasonPool : pool;

  const antiRepPool = seasonBase.filter((i) => !(CLOTHING_CATS.includes(i.cat) && recentlyWorn(i)));
  const antiRepClothingCount = antiRepPool.filter((i) => CLOTHING_CATS.includes(i.cat)).length;
  const antiRepBase = antiRepClothingCount >= 2 ? antiRepPool : seasonBase;

  // Compatibilité catégorie × occasion (R-B11 Sport, R-B12/R-B13 Cocooning ↔
  // chaussures d'intérieur) — jamais relâchée, même si le pool résultant est
  // restreint ; appliquée à toute source de pool, y compris aux catégories
  // qui bypassent par ailleurs le simple filtre heuristique d'occasion (chaussures/sac).
  const hardCategoryFilter = (items: Item[]): Item[] => {
    let r = items;
    if (occasion === "sport") {
      // R-B11 — correspondance stricte, pas un seuil minimum : liste blanche
      // explicite par catégorie (section 22 du moteur de règles), avec une
      // exception pour le sac cabas (compatible Sport bien que non technique).
      r = r.filter((i) => {
        if (i.cat === "chaussures") return formalityOf(i) === 0;
        if (i.cat === "sac") return formalityOf(i) === 0 || i.sacType === "Cabas";
        if (i.cat === "bijou") return false;
        if (i.cat === "accessoire") return true;
        return formalityOf(i) === 0;
      });
    }
    // Contexte "à la maison" — Cocooning, ou Télétravail (sous-contexte de
    // travail_formel) : partagé par plusieurs règles (R-B13/R-B14/R-B17),
    // jamais en Présentiel.
    const isHomeContext = occasion === "cocooning" || (occasion === "travail_formel" && workMode === "Télétravail");
    if (occasion === "cocooning") {
      // R-B12 — pas de veste/manteau chez soi (Cocooning uniquement — en
      // Télétravail on peut porter un gilet/une veste, rien ne l'interdit).
      r = r.filter((i) => !OUTERWEAR_CATS.includes(i.cat));
    }
    if (isHomeContext) {
      // R-B13/R-B17 — chaussures d'intérieur uniquement à la maison
      // (Cocooning et Télétravail).
      r = r.filter((i) => i.cat !== "chaussures" || i.shoeType === "Chaussures d'intérieur");
    } else {
      // R-B13 — symétrique : une chaussure d'intérieur n'apparaît jamais hors de ce contexte.
      r = r.filter((i) => i.cat !== "chaussures" || i.shoeType !== "Chaussures d'intérieur");
    }
    // R-B14 — aucun sac n'a de fonction chez soi.
    if (isHomeContext) {
      r = r.filter((i) => i.cat !== "sac");
    }
    // R-B18 — aucun accessoire n'a de fonction en Télétravail (bijou/sac déjà
    // couverts ailleurs ; concerne ceinture, foulard, lunettes...).
    if (occasion === "travail_formel" && workMode === "Télétravail") {
      r = r.filter((i) => i.cat !== "accessoire");
    }
    // R-B15 — symétrique de R-B11 : un vêtement de sport (formalité 0) est
    // réservé à l'occasion Sport, jamais réutilisé ailleurs. Ne concerne que
    // les catégories vêtement (CLOTHING_CATS) — baskets, sac cabas et
    // accessoires sport restent des basiques réutilisables hors Sport,
    // couverts par les heuristiques d'occasion existantes (occasionFit).
    if (occasion !== "all" && occasion !== "sport") {
      r = r.filter((i) => !CLOTHING_CATS.includes(i.cat) || formalityOf(i) !== 0);
    }
    // R-B16 — une pièce qui ne se justifie que par temps ensoleillé (ex.
    // lunettes de soleil) n'est jamais suggérée hors météo ensoleillée.
    if (!isSunny(weather)) {
      r = r.filter((i) => !i.necessiteSoleil);
    }
    return r;
  };

  const occFiltered = occasion === "all" ? antiRepBase : antiRepBase.filter((i) => occasionFit(i, occasion));
  let active = occFiltered.length >= 4 ? occFiltered : antiRepBase;
  active = hardCategoryFilter(active);

  // Chaussures/sacs/bijoux/accessoires restent toujours éligibles vis-à-vis du
  // simple filtre heuristique d'occasion (occFiltered, la saison reste
  // respectée) — conçus pour être reportés souvent, contrairement aux
  // vêtements filtrés plus strictement ci-dessus. Les règles dures (R-B11/
  // R-B12/R-B13, jamais relâchées) s'appliquent en revanche toujours, via hardCategoryFilter.
  const poolFor = (cats: CategoryKey[]): Item[] => {
    if (!cats.every((c) => ACCESSORY_CATS.includes(c))) return active;
    const basis = hardCategoryFilter(seasonPool);
    const inSeason = basis.filter((i) => cats.includes(i.cat));
    return inSeason.length ? basis : hardCategoryFilter(pool);
  };

  const chosen: Item[] = [];
  const pick = (cats: CategoryKey[], essential = true) => {
    const base = poolFor(cats).filter((i) => cats.includes(i.cat));
    // Préférence pour la palette personnelle — n'écarte rien, juste une inclination
    // quand elle laisse assez d'options (R-S10, esprit "préférence molle, jamais exclusive").
    const preferred = preferredHexes.length ? base.filter((i) => preferredHexes.includes(i.hex)) : [];
    const candidates = harmonize(preferred.length ? preferred : base, chosen, essential);
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
    const dressy = isDressy(occasion, workMode, dateContext);
    const layerCandidates = active.filter((i) => {
      if (i.cat !== "haut" || chosen.some((c) => c.id === i.id)) return false;
      if (rolePieceOf(i) !== "calque") return true;
      const hasCalqueAlready = chosen.some((c) => c.cat === "haut" && rolePieceOf(c) === "calque");
      return !hasCalqueAlready && !dressy;
    });
    const layer = rand(harmonize(layerCandidates, chosen, false));
    if (layer) { chosen.push(layer); ids.push(layer.id); }
  }
  // Le pull ne se superpose que sur une base fine (t-shirt/débardeur/top/col
  // roulé) — jamais par-dessus un haut déjà volumineux ou habillé.
  const firstTop = chosen.find((i) => i.cat === "haut" || i.cat === "pull");
  const canStackTop = !!firstTop && /t-shirt|débardeur|top|body|col roulé/i.test(firstTop.name + " " + (firstTop.subtype || ""));
  if (canStackTop && Math.random() < 0.35) {
    const p = pick(["pull"], false);
    if (p && !ids.includes(p.id)) ids.push(p.id);
  }
  if (Math.random() < 0.3) {
    const v = pick(["veste"], false);
    if (v && !ids.includes(v.id)) ids.push(v.id);
  }
  const sh = (() => {
    const shoePool = poolFor(["chaussures"]).filter((i) => i.cat === "chaussures");
    const nonBasket = shoePool.filter((i) => i.shoeType !== "Baskets");
    const finalPool = isDressy(occasion, workMode, dateContext) && nonBasket.length ? nonBasket : shoePool;
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

  const missingCats: (CategoryKey | "bas")[] = [];
  if (!useRobe) {
    if (!hasCat(["haut"])) missingCats.push("haut");
    if (!hasCat(BOTTOMS)) missingCats.push("bas");
  }
  if (!hasCat(["chaussures"])) missingCats.push("chaussures");
  if (!hasCat(["sac"])) missingCats.push("sac");
  if (!hasCat(["bijou"])) missingCats.push("bijou");

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
  occasion: OccasionKey = "all",
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre",
  weather?: Weather
): number[] {
  const catGroup: CategoryKey[] =
    BAS_CATS.includes(cat) ? BOTTOMS : cat === "accessoire" ? ["accessoire", "bijou", "sac"] : [cat];
  let candidates = pool.filter((i) => catGroup.includes(i.cat) && i.id !== pieceId);
  // R-B11/R-B12/R-B13 — jamais relâchées, y compris sur un échange manuel.
  if (occasion === "sport") {
    candidates = candidates.filter((i) => {
      if (i.cat === "chaussures") return formalityOf(i) === 0;
      if (i.cat === "sac") return formalityOf(i) === 0 || i.sacType === "Cabas";
      if (i.cat === "bijou") return false;
      if (i.cat === "accessoire") return true;
      return formalityOf(i) === 0;
    });
  }
  const isHomeContext = occasion === "cocooning" || (occasion === "travail_formel" && workMode === "Télétravail");
  if (occasion === "cocooning") {
    candidates = candidates.filter((i) => !OUTERWEAR_CATS.includes(i.cat));
  }
  if (isHomeContext) {
    candidates = candidates.filter((i) => i.cat !== "chaussures" || i.shoeType === "Chaussures d'intérieur");
  } else {
    candidates = candidates.filter((i) => i.cat !== "chaussures" || i.shoeType !== "Chaussures d'intérieur");
  }
  // R-B14 — symétrique du filtre appliqué dans generateOutfit.
  if (isHomeContext) {
    candidates = candidates.filter((i) => i.cat !== "sac");
  }
  // R-B18 — symétrique du filtre appliqué dans generateOutfit.
  if (occasion === "travail_formel" && workMode === "Télétravail") {
    candidates = candidates.filter((i) => i.cat !== "accessoire");
  }
  // R-B15 — symétrique du filtre appliqué dans generateOutfit.
  if (occasion !== "all" && occasion !== "sport") {
    candidates = candidates.filter((i) => !CLOTHING_CATS.includes(i.cat) || formalityOf(i) !== 0);
  }
  // R-B16 — symétrique du filtre appliqué dans generateOutfit.
  if (weather && !isSunny(weather)) {
    candidates = candidates.filter((i) => !i.necessiteSoleil);
  }
  if (cat === "chaussures" && isDressy(occasion, workMode, dateContext)) {
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
 * Évalue les 10 règles bloquantes (R-B1 à R-B10) sur un ensemble de pièces.
 * Sauf R-B9, aucune n'empêche la sauvegarde : sert uniquement à afficher un
 * bandeau doux, non alarmant, quand une règle est contournée manuellement
 * (Création de looks). La génération automatique, elle, évite ces
 * combinaisons en amont via generateOutfit/harmonize.
 */
export function evaluateBlocking(
  pieces: Item[],
  occasion: OccasionKey,
  weather: Weather,
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre"
): BlockingHit[] {
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
    if (minFormality < effectiveFormality(occasion, workMode, dateContext)) {
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

  const dressy = isDressy(occasion, workMode, dateContext);
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

  // R-B10 — deux chemises/chemisiers en même temps, quel que soit leur rôle.
  const shirtLike = pieces.filter((i) => i.subtype === "Chemise" || i.subtype === "Chemisier");
  if (shirtLike.length >= 2) {
    hits.push({ id: "R-B10", message: "Deux chemises dans la même tenue, essaie d'en retirer une." });
  }

  return hits;
}

/** Résultat du scoring d'une tenue complète (R-S1 à R-S11, plus suggestions proactives R-S12 à R-S14). */
export interface LookScore {
  score: number;
  badge: "recommande" | "neutre" | "ajuster";
  /** Message ciblé sur la règle de scoring la plus pénalisante, seulement si badge === "ajuster". */
  adjustMessage: string;
  /** Suggestions proactives dismissibles (R-S12/R-S13/R-S14) — indépendantes, plusieurs peuvent s'afficher à la fois. */
  proactives: { key: string; text: string }[];
}

/**
 * Calcule le score d'une tenue complète (R-S1 à R-S11). Non bloquant :
 * une tenue reste toujours proposable quel que soit son score. Seuils :
 * ≥80 recommandé, 50-79 neutre, <50 bandeau d'ajustement ciblé sur la
 * règle la plus pénalisante (jamais cumulé, jamais le nom technique).
 */
export function computeLookScore(
  pieces: Item[],
  occasion: OccasionKey,
  paletteHexList: string[],
  morphology: string | null,
  dismissed: Set<string>,
  weather: Weather,
  workMode: WorkMode = "Présentiel",
  dateContext: DateContext = "Verre"
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

  // R-S10 — palette personnelle du profil (préférence molle, jamais exclusive)
  if (paletteHexList.length && pieces.some((i) => paletteHexList.includes(i.hex))) bonuses.push(10);

  // R-S11 — layering réussi (base + calque en contexte décontracté)
  const tops = pieces.filter((i) => TOP_LAYER_CATS.includes(i.cat));
  const roles = tops.map(rolePieceOf);
  const dressy = isDressy(occasion, workMode, dateContext);
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

  // R-S12/R-S13/R-S14 — suggestions proactives, indépendantes les unes des
  // autres (plusieurs peuvent s'afficher en même temps, chacune dismissible séparément).
  const proactives: { key: string; text: string }[] = [];

  // R-S12 — layering : un seul haut, oversize/ample ou une chemise, contexte décontracté.
  if (
    tops.length === 1 &&
    dressy === false &&
    /oversize|ample|chemise/i.test(tops[0].name + " " + (tops[0].subtype || "")) &&
    !dismissed.has("layer")
  ) {
    proactives.push({
      key: "layer",
      text: "Il te manque un débardeur ou un t-shirt pour compléter cette tenue.",
    });
  }

  // R-S13 — contraste : total look noir sans accessoire coloré.
  const allBlack = clothing.length > 0 && clothing.every((i) => /noir/i.test(i.color));
  const hasColorAccessory = accessories.some((i) => !isNeutralColor(i.color));
  if (allBlack && !hasColorAccessory && !dismissed.has("color")) {
    proactives.push({
      key: "color",
      text: "Il te manque une touche de couleur pour compléter cette tenue.",
    });
  }

  // R-S14 — soirée fraîche : exclue en Cocooning (R-B12), pas de sens à suggérer une veste chez soi.
  const hasOuterwear = pieces.some((i) => i.cat === "veste" || i.cat === "manteau");
  if (occasion !== "cocooning" && weather.temp <= 21 && !hasOuterwear && !dismissed.has("veste_soir")) {
    proactives.push({
      key: "veste_soir",
      text: "N'hésite pas à compléter cette tenue avec une veste, il va faire frais ce soir.",
    });
  }

  return { score, badge, adjustMessage, proactives };
}
