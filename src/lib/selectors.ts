import { MONTHS_FR, OCC_LABELS } from "./data";
import type { HistoryEntry, Item } from "./types";

export function neverWornItems(pool: Item[]): Item[] {
  return pool.filter((i) => i.worn == null);
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

export interface JournalEntry {
  id: string;
  rel: string;
  hasOccasion: boolean;
  occLabel: string;
  summary: string;
  swatches: Item[];
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
      return { id: h.id, rel, hasOccasion: !!occ, occLabel: occ, summary: pcs.map((p) => p.name).join(" · "), swatches: pcs };
    });
}
