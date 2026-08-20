import { MONTHS_FR, OCC_LABELS } from "./data";
import type { HistoryEntry, Item, OccasionKey } from "./types";

export function neverWornItems(pool: Item[]): Item[] {
  return pool.filter((i) => i.worn == null);
}

/**
 * Pièces de la capsule active jamais portées (recette 20/08/2026, "À
 * redécouvrir" du Journal) — distinct de neverWornItems (dressing réel
 * uniquement) : porte sur le pool effectif affiché (réel + suggestions),
 * jamais présentes dans l'historique des tenues portées.
 */
export function neverWornInPool(pool: Item[], history: HistoryEntry[]): Item[] {
  return pool.filter((i) => !wornFromHistory(history, i.id));
}

const MONTHS = MONTHS_FR;
const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** "Porté récemment" est déclaré uniquement via l'action explicite "marquer comme porté" (Journal), jamais déduit d'une simple suggestion ou tenue générée. */
export function wornFromHistory(history: HistoryEntry[], id: number): boolean {
  return history.some((h) => h.pieceIds.includes(id));
}

export interface JournalStats {
  total: number;
  worn: number;
  never: number;
  pctWorn: number;
  hasItems: boolean;
  wornThisWeek: number;
}

/** Statistiques du Journal : part du dressing réel déjà portée (au moins une fois, via une tenue validée), et tenues portées cette semaine. */
export function journalStats(items: Item[], history: HistoryEntry[]): JournalStats {
  const total = items.length;
  const worn = items.filter((i) => wornFromHistory(history, i.id)).length;
  const never = total - worn;
  const pctWorn = total ? Math.round((worn / total) * 100) : 0;
  const wornThisWeek = history.filter((h) => {
    const diffDays = (Date.now() - h.ts) / 86400000;
    return diffDays >= 0 && diffDays < 7;
  }).length;
  return { total, worn, never, pctWorn, hasItems: total > 0, wornThisWeek };
}

export interface JournalInsights {
  wornThisMonth: number;
  distinctPiecesWorn: number;
  topOccasionLabel: string | null;
}

/**
 * "Ton dressing en chiffres" (recette 20/08/2026) — insights dérivés
 * exclusivement de l'historique réellement enregistré, jamais de chiffre
 * inventé. topOccasionLabel est null s'il n'y a pas assez de données pour
 * dégager une tendance (une seule entrée ne fait pas une "occasion la plus
 * fréquente").
 */
export function journalInsights(history: HistoryEntry[]): JournalInsights {
  const now = new Date();
  const wornThisMonth = history.filter((h) => {
    const d = new Date(h.ts);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const distinctPiecesWorn = new Set(history.flatMap((h) => h.pieceIds)).size;

  const occCounts = new Map<OccasionKey, number>();
  history.forEach((h) => {
    if (!h.occasion || h.occasion === "all") return;
    occCounts.set(h.occasion, (occCounts.get(h.occasion) || 0) + 1);
  });
  let topOccasionLabel: string | null = null;
  if (occCounts.size > 0 && history.length >= 3) {
    const [topKey] = [...occCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    topOccasionLabel = OCC_LABELS[topKey];
  }

  return { wornThisMonth, distinctPiecesWorn, topOccasionLabel };
}

export interface MostWornPiece {
  item: Item;
  count: number;
}

/** Pièces les plus portées (recette 20/08/2026) — fréquence réelle depuis l'historique, jamais moins de 2 ports pour apparaître (sinon "la plus portée" n'a pas de sens). */
export function mostWornPieces(history: HistoryEntry[], pool: Item[], limit = 5): MostWornPiece[] {
  const counts = new Map<number, number>();
  history.forEach((h) => h.pieceIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => {
      const item = pool.find((i) => i.id === id);
      return item ? { item, count } : null;
    })
    .filter((x): x is MostWornPiece => Boolean(x));
}

export interface JournalEntry {
  id: string;
  rel: string;
  hasOccasion: boolean;
  occLabel: string;
  occasion: OccasionKey;
  summary: string;
  swatches: Item[];
  pieceIds: number[];
}

/** Liste plate des tenues portées, la plus récente en premier. */
export function journalEntries(history: HistoryEntry[], pool: Item[]): JournalEntry[] {
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  return [...history]
    .sort((a, b) => b.ts - a.ts)
    .map((h) => {
      const d = new Date(h.ts);
      const dMid = new Date(d);
      dMid.setHours(0, 0, 0, 0);
      const diff = Math.round((todayMid.getTime() - dMid.getTime()) / 864e5);
      const rel = diff <= 0 ? "Aujourd'hui" : diff === 1 ? "Hier" : DAYS_SHORT[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
      const pcs = h.pieceIds.map((id) => pool.find((i) => i.id === id)).filter(Boolean) as Item[];
      const occ = h.occasion && h.occasion !== "all" ? OCC_LABELS[h.occasion] : "";
      return {
        id: h.id,
        rel,
        hasOccasion: !!occ,
        occLabel: occ,
        occasion: h.occasion || "all",
        summary: pcs.map((p) => p.name).join(" · "),
        swatches: pcs,
        pieceIds: [...h.pieceIds],
      };
    });
}
