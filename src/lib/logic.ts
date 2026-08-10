import type { CategoryKey, Item, OccasionKey } from "./types";
import type { Weather } from "./data";
import { bestStyleFor } from "./capsule";

const BOTTOMS: CategoryKey[] = ["bas", "jupe"];

export function occasionFit(it: Item, occ: OccasionKey): boolean {
  // Une occasion déclarée sur la pièce prime sur les heuristiques de nom.
  if (it.occasion && it.occasion !== "all") return it.occasion === occ;
  const n = (it.name + " " + it.color).toLowerCase();
  switch (occ) {
    case "travail":
      return (
        /tailleur|chemis|blouse|escarpin|mocassin|ballerine|cabas|gilet|foulard|portefeuille|robe chemise|pull col|pull torsad|blazer|trench/.test(n) ||
        (it.cat === "robe" && !/longue|pull/.test(n))
      );
    case "chill":
      return (
        /jean|basket|sweat|t-shirt|short|sandal|débardeur|chino|chapeau|écharpe|robe longue|robe pull|top cache|coupe-vent/.test(n) ||
        it.cat === "haut"
      );
    case "dejeuner":
      return (
        /blouse|chemis|jupe|robe|ballerine|mocassin|top|combinaison|sandal|collier|boucles/.test(n) ||
        it.cat === "haut" || it.cat === "jupe"
      );
    case "date":
      return /soie|blouse|robe|escarpin|jupe|noir|bordeaux|collier|boucles|sandal/.test(n) || it.cat === "robe";
    case "sport":
      return /basket|sweat|t-shirt|short|débardeur|molleton|jogging|legging|coupe-vent/.test(n);
    case "soiree":
      return /soie|blouse|escarpin|robe|bordeaux|noir|foulard|portefeuille|longue|collier|boucles/.test(n) || it.cat === "robe";
    case "ceremonie":
      return /tailleur|soie|blouse|escarpin|robe|foulard|portefeuille|combinaison|bijou|collier|boucles/.test(n) || it.cat === "robe";
    default:
      return true;
  }
}

/**
 * Couleurs neutres : elles se combinent librement entre elles. Une fois
 * qu'une teinte affirmée (hors de cette liste) figure dans la tenue, les
 * pièces suivantes retombent sur les neutres pour éviter les accords qui
 * jurent — au plus une couleur affirmée par tenue.
 */
const NEUTRAL_COLORS = new Set([
  "Blanc", "Blanc cassé", "Crème", "Sable", "Camel", "Caramel", "Chocolat",
  "Taupe", "Kaki", "Gris clair", "Gris", "Gris anthracite", "Noir", "Marine", "Denim", "Beige rosé",
]);

function isNeutralColor(colorName: string): boolean {
  return NEUTRAL_COLORS.has(colorName);
}

/**
 * Resserre un pool de candidats pour qu'ils s'accordent avec les pièces déjà
 * retenues : couleur (au plus une teinte affirmée par tenue) puis style
 * (préférence pour le style de la pièce d'ancrage) — chaque critère ne
 * s'applique que s'il laisse au moins une option, jamais de blocage total.
 */
function harmonize(candidates: Item[], chosen: Item[], essential = true): Item[] {
  if (candidates.length <= 1 || !chosen.length) return candidates;
  let pool = candidates;
  // Le bijou est un petit accent métallique (or/argent) : il ne doit pas
  // consommer à lui seul le budget « une couleur affirmée par tenue ».
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
  /** Catégories essentielles totalement absentes du pool (pas seulement de ce tirage). */
  missingCats: CategoryKey[];
}

/**
 * Génère une tenue depuis le pool actif (dressing réel, ou capsule par
 * défaut tant qu'il est vide).
 * Contrainte produit : le pool est filtré par SAISON (météo du jour) AVANT
 * d'être filtré par occasion — chaque filtre ne s'applique que s'il laisse
 * au moins 4 pièces, sinon on retombe sur l'étape précédente. Les pièces
 * sont ensuite choisies pour s'accorder entre elles (couleur, style).
 */
export function generateOutfit(pool: Item[], weather: Weather, occasion: OccasionKey): GeneratedOutfit {
  const seasonFiltered = pool.filter((i) => weather.seasons.includes(i.season));
  const seasonPool = seasonFiltered.length >= 4 ? seasonFiltered : pool;
  const occFiltered = occasion === "all" ? seasonPool : seasonPool.filter((i) => occasionFit(i, occasion));
  const active = occFiltered.length >= 4 ? occFiltered : seasonPool;

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
  if (Math.random() < 0.35) {
    const p = pick(["pull"], false);
    if (p && !ids.includes(p.id)) ids.push(p.id);
  }
  if (Math.random() < 0.3) {
    const m = pick(["manteau"], false);
    if (m) ids.push(m.id);
  }
  const sh = pick(["chaussures"]);
  if (sh) ids.push(sh.id);
  const sac = pick(["sac"]);
  if (sac) ids.push(sac.id);
  const bijou = pick(["bijou"]);
  if (bijou) ids.push(bijou.id);
  if (Math.random() < 0.5) {
    const ac = pick(["accessoire"], false);
    if (ac && !ids.includes(ac.id)) ids.push(ac.id);
  }

  const missingCats: CategoryKey[] = [];
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
 */
export function swapOutfitPiece(outfitItems: Item[], pool: Item[], pieceId: number, cat: CategoryKey): number[] {
  const catGroup: CategoryKey[] =
    cat === "bas" ? ["bas", "jupe"] : cat === "accessoire" ? ["accessoire", "bijou", "sac"] : [cat];
  const candidates = pool.filter((i) => catGroup.includes(i.cat) && i.id !== pieceId);
  if (!candidates.length) return outfitItems.map((i) => i.id);
  const rest = outfitItems.filter((i) => i.id !== pieceId);
  const next = rand(harmonize(candidates, rest));
  if (!next) return outfitItems.map((i) => i.id);
  return outfitItems.map((i) => (i.id === pieceId ? next.id : i.id));
}
