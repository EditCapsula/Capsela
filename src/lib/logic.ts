import type { AppState, Item, OccasionKey } from "./types";
import { isBag } from "./data";
import type { Weather } from "./data";

export function occasionFit(it: Item, occ: OccasionKey): boolean {
  const n = (it.name + " " + it.color).toLowerCase();
  const rx: Partial<Record<OccasionKey, RegExp>> = {
    travail:
      /tailleur|chemis|blouse|escarpin|mocassin|ballerine|cabas|gilet|foulard|portefeuille|robe chemise|pull col|pull torsad/,
    weekend:
      /jean|basket|sweat|t-shirt|short|sandal|débardeur|chino|chapeau|écharpe|robe longue|robe pull|top cache/,
    sport: /basket|sweat|t-shirt|short|débardeur|molleton|jogging|legging/,
    soiree: /soie|blouse|escarpin|robe|bordeaux|noir|foulard|portefeuille|longue/,
    ceremonie: /tailleur|soie|blouse|escarpin|robe|foulard|portefeuille/,
    voyage: /jean|basket|t-shirt|chino|pantalon large|cabas|sweat|mocassin|foulard/,
  };
  if (occ === "travail") return rx.travail!.test(n) || (it.cat === "robe" && !/longue|pull/.test(n));
  if (occ === "weekend") return rx.weekend!.test(n) || it.cat === "haut";
  if (occ === "sport") return rx.sport!.test(n) || (it.cat === "chaussures" && /basket/.test(n));
  if (occ === "soiree") return rx.soiree!.test(n) || it.cat === "robe";
  if (occ === "ceremonie") return rx.ceremonie!.test(n) || it.cat === "robe";
  if (occ === "voyage") return rx.voyage!.test(n) || it.cat === "haut";
  return true;
}

function rand<T>(arr: T[]): T | null {
  return arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;
}

/** Pure port of Component#generateOutfit — picks a weather/occasion/lock-aware outfit, always including a bag when one is available. */
export function generateOutfitIds(state: AppState, weather: Weather): number[] {
  const capIds = state.capsules[state.activeSeason] || [];
  const cap = state.items.filter((i) => capIds.includes(i.id));
  const occasion = state.isPremium ? state.occasion || "all" : "all";
  const locked = (state.lockedPieces || []).filter((id) => capIds.includes(id) && state.isPremium);
  const lockedItems = cap.filter((i) => locked.includes(i.id));
  const hasLockedRobe = lockedItems.some((i) => i.cat === "robe");
  const hasLockedTop = lockedItems.some((i) => i.cat === "haut");
  const hasLockedBottom = lockedItems.some((i) => i.cat === "bas");
  const hasLockedShoes = lockedItems.some((i) => i.cat === "chaussures");
  const hasLockedBag = lockedItems.some(isBag);

  const pool = (pred: (i: Item) => boolean) => {
    let base = cap.filter(pred);
    const w = base.filter((i) => weather.seasons.includes(i.season));
    if (w.length) base = w;
    if (occasion !== "all") {
      const o = base.filter((i) => occasionFit(i, occasion));
      if (o.length) base = o;
    }
    return base;
  };

  const ids: number[] = [...lockedItems.map((i) => i.id)];
  if (!hasLockedRobe && !hasLockedTop && !hasLockedBottom) {
    const useRobe = Math.random() < 0.4 && pool((i) => i.cat === "robe").length > 0;
    if (useRobe) {
      const r = rand(pool((i) => i.cat === "robe"));
      if (r) ids.push(r.id);
    } else {
      const h = rand(pool((i) => i.cat === "haut"));
      const b = rand(pool((i) => i.cat === "bas"));
      if (h) ids.push(h.id);
      if (b) ids.push(b.id);
    }
  } else if (!hasLockedRobe) {
    if (!hasLockedTop) {
      const h = rand(pool((i) => i.cat === "haut"));
      if (h) ids.push(h.id);
    }
    if (!hasLockedBottom) {
      const b = rand(pool((i) => i.cat === "bas"));
      if (b) ids.push(b.id);
    }
  }
  if (!hasLockedShoes) {
    const sh = rand(pool((i) => i.cat === "chaussures"));
    if (sh) ids.push(sh.id);
  }
  if (!hasLockedBag) {
    const capBags = pool(isBag);
    const allBags = state.items.filter(isBag);
    const bagPool = capBags.length ? capBags : allBags;
    if (bagPool.length) {
      const b = rand(bagPool);
      if (b) ids.push(b.id);
    }
  }
  const otherAcc = pool((i) => i.cat === "accessoire" && !isBag(i));
  if (
    otherAcc.length &&
    Math.random() < 0.5 &&
    !lockedItems.some((i) => i.cat === "accessoire" && !isBag(i))
  ) {
    const a = rand(otherAcc);
    if (a) ids.push(a.id);
  }
  return Array.from(new Set(ids));
}
