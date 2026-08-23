import { MONTHS_FR, OCC_LABELS, OCC_SHORT } from "./data";
import type { HistoryEntry, Item, OccasionKey, SavedLook } from "./types";

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

/** Nombre de ports par pièce, dérivé exclusivement de l'historique réel. */
function wearCounts(history: HistoryEntry[]): Map<number, number> {
  const counts = new Map<number, number>();
  history.forEach((h) => h.pieceIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
  return counts;
}

export interface JournalStats {
  total: number;
  worn: number;
  never: number;
  pctWorn: number;
  hasItems: boolean;
  wornThisWeek: number;
  /** Rotation réelle du dressing (recette 23/08/2026) — remplace la mise en avant du seul "% déjà porté", qui perd tout intérêt une fois à 100 %. */
  wornOften: number;
  wornRarely: number;
}

/** Statistiques du Journal : part du dressing réel déjà portée (au moins une fois, via une tenue validée), rotation (souvent/peu portées), et tenues portées cette semaine. */
export function journalStats(items: Item[], history: HistoryEntry[]): JournalStats {
  const total = items.length;
  const counts = wearCounts(history);
  const worn = items.filter((i) => counts.has(i.id)).length;
  const never = total - worn;
  const pctWorn = total ? Math.round((worn / total) * 100) : 0;
  const wornOften = items.filter((i) => (counts.get(i.id) || 0) >= 3).length;
  const wornRarely = items.filter((i) => {
    const c = counts.get(i.id) || 0;
    return c >= 1 && c <= 2;
  }).length;
  const wornThisWeek = history.filter((h) => {
    const diffDays = (Date.now() - h.ts) / 86400000;
    return diffDays >= 0 && diffDays < 7;
  }).length;
  return { total, worn, never, pctWorn, hasItems: total > 0, wornThisWeek, wornOften, wornRarely };
}

export interface JournalInsights {
  wornThisMonth: number;
  distinctPiecesWornThisMonth: number;
  /** Libellé court de l'occasion dominante du mois (ex. "Quotidien"), null si moins de 3 tenues ce mois-ci. */
  topOccasionShort: string | null;
  /** Part (0-100) des tenues du mois relevant de l'occasion dominante. */
  topOccasionShare: number | null;
}

/**
 * "Ton mois en chiffres" (recette 23/08/2026) — toutes les statistiques de
 * ce bloc partagent la même période de référence (mois civil en cours),
 * dérivées exclusivement de l'historique réellement enregistré, jamais de
 * chiffre inventé. topOccasionShort est null s'il n'y a pas assez de
 * données pour dégager une tendance (moins de 3 tenues ce mois-ci).
 */
export function journalInsights(history: HistoryEntry[]): JournalInsights {
  const now = new Date();
  const monthHistory = history.filter((h) => {
    const d = new Date(h.ts);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  const wornThisMonth = monthHistory.length;
  const distinctPiecesWornThisMonth = new Set(monthHistory.flatMap((h) => h.pieceIds)).size;

  const occCounts = new Map<OccasionKey, number>();
  monthHistory.forEach((h) => {
    if (!h.occasion || h.occasion === "all") return;
    occCounts.set(h.occasion, (occCounts.get(h.occasion) || 0) + 1);
  });
  let topOccasionShort: string | null = null;
  let topOccasionShare: number | null = null;
  if (occCounts.size > 0 && monthHistory.length >= 3) {
    const [topKey, topCount] = [...occCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    topOccasionShort = OCC_SHORT[topKey] || OCC_LABELS[topKey].split(" / ")[0];
    topOccasionShare = Math.round((topCount / monthHistory.length) * 100);
  }

  return { wornThisMonth, distinctPiecesWornThisMonth, topOccasionShort, topOccasionShare };
}

/** Nouveaux looks enregistrés (Créer un look) ce mois-ci — distinct des tenues portées : ne compte que les looks explicitement sauvegardés. */
export function newLooksThisMonth(savedLooks: SavedLook[]): number {
  const now = new Date();
  return savedLooks.filter((l) => {
    const d = new Date(l.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}

/** Nombre de tenues portées par jour sur les `days` derniers jours (aujourd'hui inclus), du plus ancien au plus récent — pour un sparkline d'activité réelle, jamais de série inventée. */
export function dailyActivity(history: HistoryEntry[], days = 10): number[] {
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const counts = new Array(days).fill(0);
  history.forEach((h) => {
    const d = new Date(h.ts);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((todayMid.getTime() - d.getTime()) / 864e5);
    if (diff >= 0 && diff < days) counts[days - 1 - diff] += 1;
  });
  return counts;
}

export interface MostWornPiece {
  item: Item;
  count: number;
}

/** Top des pièces les plus portées (recette 23/08/2026, Top 3) — classées par fréquence réelle depuis l'historique, sans seuil minimum : sur une capsule jeune, exiger 2 ports laissait le Top vide ou clairsemé. */
export function mostWornPieces(history: HistoryEntry[], pool: Item[], limit = 3): MostWornPiece[] {
  const counts = wearCounts(history);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, count]) => {
      const item = pool.find((i) => i.id === id);
      return item ? { item, count } : null;
    })
    .filter((x): x is MostWornPiece => Boolean(x));
}

export type JournalPeriod = "today" | "yesterday" | "week" | "earlier";

export interface JournalEntry {
  id: string;
  rel: string;
  period: JournalPeriod;
  hasOccasion: boolean;
  occLabel: string;
  occasion: OccasionKey;
  summary: string;
  swatches: Item[];
  pieceIds: number[];
}

/**
 * Liste plate des tenues portées, la plus récente en premier, groupable par
 * période (today/yesterday/week/earlier — recette 23/08/2026). Les entrées
 * dont aucune pièce ne se résout dans le pool (données incomplètes, ex.
 * pièce supprimée depuis) sont exclues plutôt que d'occuper une card vide.
 */
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
      const period: JournalPeriod = diff <= 0 ? "today" : diff === 1 ? "yesterday" : diff <= 6 ? "week" : "earlier";
      const pcs = h.pieceIds.map((id) => pool.find((i) => i.id === id)).filter(Boolean) as Item[];
      const occ = h.occasion && h.occasion !== "all" ? OCC_LABELS[h.occasion] : "";
      return {
        id: h.id,
        rel,
        period,
        hasOccasion: !!occ,
        occLabel: occ,
        occasion: h.occasion || "all",
        summary: pcs.map((p) => p.name).join(" · "),
        swatches: pcs,
        pieceIds: [...h.pieceIds],
      };
    })
    .filter((e) => e.swatches.length > 0);
}
