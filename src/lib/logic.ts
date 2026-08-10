import type { AppState, CategoryKey, Item, OccasionKey } from "./types";
import { isBag } from "./data";
import type { Weather } from "./data";

const ONE_PIECE: CategoryKey[] = ["robe", "combinaison"];
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

/**
 * Génère une tenue depuis la capsule active.
 * Contrainte produit : le pool est filtré par SAISON (météo du jour) AVANT
 * d'être filtré par occasion. Le sac est toujours inclus quand il en existe un.
 */
export function generateOutfitIds(state: AppState, weather: Weather): number[] {
  const capIds = state.capsules[state.activeSeason] || [];
  const cap = state.items.filter((i) => capIds.includes(i.id));
  const occasion = state.isPremium ? state.occasion || "all" : "all";
  const locked = (state.lockedPieces || []).filter((id) => capIds.includes(id) && state.isPremium);
  const lockedItems = cap.filter((i) => locked.includes(i.id));
  const hasLocked = (pred: (i: Item) => boolean) => lockedItems.some(pred);

  const pool = (pred: (i: Item) => boolean) => {
    let base = cap.filter(pred);
    // 1. Saison d'abord — une pièce hors saison ne doit jamais être proposée
    //    tant qu'il existe des pièces de saison.
    const w = base.filter((i) => weather.seasons.includes(i.season));
    if (w.length) base = w;
    // 2. Puis l'occasion, sur le pool déjà réduit à la saison.
    if (occasion !== "all") {
      const o = base.filter((i) => occasionFit(i, occasion));
      if (o.length) base = o;
    }
    return base;
  };

  const ids: number[] = [...lockedItems.map((i) => i.id)];
  const hasLockedOnePiece = hasLocked((i) => ONE_PIECE.includes(i.cat));
  const hasLockedTop = hasLocked((i) => i.cat === "haut");
  const hasLockedBottom = hasLocked((i) => BOTTOMS.includes(i.cat));

  if (!hasLockedOnePiece && !hasLockedTop && !hasLockedBottom) {
    const onePieces = pool((i) => ONE_PIECE.includes(i.cat));
    const useOnePiece = Math.random() < 0.4 && onePieces.length > 0;
    if (useOnePiece) {
      const r = rand(onePieces);
      if (r) ids.push(r.id);
    } else {
      const h = rand(pool((i) => i.cat === "haut"));
      const b = rand(pool((i) => BOTTOMS.includes(i.cat)));
      if (h) ids.push(h.id);
      if (b) ids.push(b.id);
    }
  } else if (!hasLockedOnePiece) {
    if (!hasLockedTop) {
      const h = rand(pool((i) => i.cat === "haut"));
      if (h) ids.push(h.id);
    }
    if (!hasLockedBottom) {
      const b = rand(pool((i) => BOTTOMS.includes(i.cat)));
      if (b) ids.push(b.id);
    }
  }

  // Couches froides : pull et manteau quand la météo est Automne / Hiver.
  if (weather.season === "Automne / Hiver") {
    if (!hasLocked((i) => i.cat === "pull") && Math.random() < 0.6) {
      const p = rand(pool((i) => i.cat === "pull"));
      if (p) ids.push(p.id);
    }
    if (!hasLocked((i) => i.cat === "manteau") && Math.random() < 0.7) {
      const m = rand(pool((i) => i.cat === "manteau"));
      if (m) ids.push(m.id);
    }
  }

  if (!hasLocked((i) => i.cat === "chaussures")) {
    const sh = rand(pool((i) => i.cat === "chaussures"));
    if (sh) ids.push(sh.id);
  }

  if (!hasLocked(isBag)) {
    const capBags = pool(isBag);
    const allBags = state.items.filter(isBag);
    const bagPool = capBags.length ? capBags : allBags;
    if (bagPool.length) {
      const b = rand(bagPool);
      if (b) ids.push(b.id);
    }
  }

  const extras = pool((i) => (i.cat === "accessoire" || i.cat === "bijou") && !isBag(i));
  if (
    extras.length &&
    Math.random() < 0.5 &&
    !hasLocked((i) => (i.cat === "accessoire" || i.cat === "bijou") && !isBag(i))
  ) {
    const a = rand(extras);
    if (a) ids.push(a.id);
  }
  return Array.from(new Set(ids));
}
