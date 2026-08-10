import type { CategoryKey, Item, OccasionKey } from "./types";
import type { Weather } from "./data";

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
 * au moins 4 pièces, sinon on retombe sur l'étape précédente.
 */
export function generateOutfit(pool: Item[], weather: Weather, occasion: OccasionKey): GeneratedOutfit {
  const seasonFiltered = pool.filter((i) => weather.seasons.includes(i.season));
  const seasonPool = seasonFiltered.length >= 4 ? seasonFiltered : pool;
  const occFiltered = occasion === "all" ? seasonPool : seasonPool.filter((i) => occasionFit(i, occasion));
  const active = occFiltered.length >= 4 ? occFiltered : seasonPool;

  const pick = (cats: CategoryKey[]) => rand(active.filter((i) => cats.includes(i.cat)));
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
    const p = pick(["pull"]);
    if (p && !ids.includes(p.id)) ids.push(p.id);
  }
  if (Math.random() < 0.3) {
    const m = pick(["manteau"]);
    if (m) ids.push(m.id);
  }
  const sh = pick(["chaussures"]);
  if (sh) ids.push(sh.id);
  const sac = pick(["sac"]);
  if (sac) ids.push(sac.id);
  const bijou = pick(["bijou"]);
  if (bijou) ids.push(bijou.id);
  if (Math.random() < 0.5) {
    const ac = pick(["accessoire"]);
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

/** Remplace une pièce de la tenue par une autre de la même famille de catégorie. */
export function swapOutfitPiece(outfit: number[], pool: Item[], pieceId: number, cat: CategoryKey): number[] {
  const catGroup: CategoryKey[] =
    cat === "bas" ? ["bas", "jupe"] : cat === "accessoire" ? ["accessoire", "bijou", "sac"] : [cat];
  const alts = pool.filter((i) => catGroup.includes(i.cat) && i.id !== pieceId);
  if (!alts.length) return outfit;
  const next = rand(alts);
  if (!next) return outfit;
  return outfit.map((id) => (id === pieceId ? next.id : id));
}
