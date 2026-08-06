import { CATS, MONTHS_FR, OCC_LABELS } from "./data";
import type { AppState, HistoryEntry, Item } from "./types";

export function activeCapIds(state: AppState): number[] {
  return state.capsules[state.activeSeason] || [];
}

export function itemsWithCapsuleFlag(state: AppState): (Item & { inCapsule: boolean })[] {
  const capIds = activeCapIds(state);
  return state.items.map((it) => ({ ...it, inCapsule: capIds.includes(it.id) }));
}

export interface GaugeInfo {
  capCount: number;
  frac: number;
  overCapacity: boolean;
  status: "under" | "ok" | "over";
  statusText: string;
}

export function gaugeInfo(state: AppState): GaugeInfo {
  const capCount = activeCapIds(state).length;
  const frac = Math.min(capCount, 40) / 40;
  const overCapacity = capCount > 40;
  let status: GaugeInfo["status"];
  let statusText: string;
  if (capCount < 30) {
    const miss = 30 - capCount;
    status = "under";
    statusText = "Encore " + miss + (miss === 1 ? " pièce" : " pièces") + " pour atteindre une capsule complète.";
  } else if (capCount <= 40) {
    status = "ok";
    statusText = "Capsule complète — tu es dans la fourchette idéale.";
  } else {
    status = "over";
    statusText = "Un peu trop chargée — retire " + (capCount - 40) + " pièce(s) pour rester capsule.";
  }
  return { capCount, frac, overCapacity, status, statusText };
}

export interface BreakdownRow {
  label: string;
  inCount: number;
  total: number;
  pct: number;
}

export function breakdown(state: AppState): BreakdownRow[] {
  const items = itemsWithCapsuleFlag(state);
  const inCounts = CATS.map(([key]) => items.filter((i) => i.cat === key && i.inCapsule).length);
  const maxIn = Math.max(1, ...inCounts);
  return CATS.map(([key, , plural], idx) => {
    const inC = inCounts[idx];
    const tot = items.filter((i) => i.cat === key).length;
    return { label: plural, inCount: inC, total: tot, pct: (inC / maxIn) * 100 };
  });
}

export function neverWornItems(state: AppState): Item[] {
  return state.items.filter((i) => i.worn == null);
}

const MONTHS = MONTHS_FR;
const DAYS_SHORT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

export interface Memory {
  title: string;
  dateText: string;
  summary: string;
  pieces: Item[];
  reWearIds: number[];
}

export interface HistoryDayGroup {
  key: string;
  rel: string;
  isMulti: boolean;
  countText: string;
  entries: {
    id: string;
    hasOcc: boolean;
    occLabel: string;
    summary: string;
    pieces: Item[];
  }[];
}

export interface HistoryView {
  memory: Memory | null;
  days: HistoryDayGroup[];
  weekCount: number;
}

export function historyView(state: AppState): HistoryView {
  const now = new Date();
  const todayMid = new Date();
  todayMid.setHours(0, 0, 0, 0);
  const history = state.history || [];

  const annEntry = history.find((h) => {
    const d = new Date(h.ts);
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() < now.getFullYear();
  });

  let memory: Memory | null = null;
  if (annEntry) {
    const annDate = new Date(annEntry.ts);
    const yrs = now.getFullYear() - annDate.getFullYear();
    const pcs = annEntry.pieceIds.map((id) => state.items.find((i) => i.id === id)).filter(Boolean) as Item[];
    const stillHave = annEntry.pieceIds.filter((id) => state.items.some((i) => i.id === id));
    memory = {
      title: yrs === 1 ? "Il y a un an, jour pour jour" : "Il y a " + yrs + " ans, jour pour jour",
      dateText: "Le " + annDate.getDate() + " " + MONTHS[annDate.getMonth()] + " " + annDate.getFullYear(),
      summary: pcs.map((p) => p.name).join(" · "),
      pieces: pcs,
      reWearIds: stillHave,
    };
  }

  const entries = history.filter((h) => h.id !== annEntry?.id);
  const dayOrder: string[] = [];
  const dayMap: Record<string, { rel: string; list: HistoryDayGroup["entries"] }> = {};

  entries.forEach((h: HistoryEntry) => {
    const d = new Date(h.ts);
    const key = d.getFullYear() + "-" + d.getMonth() + "-" + d.getDate();
    const dMid = new Date(d);
    dMid.setHours(0, 0, 0, 0);
    const diff = Math.round((todayMid.getTime() - dMid.getTime()) / 864e5);
    const rel = diff <= 0 ? "Aujourd'hui" : diff === 1 ? "Hier" : DAYS_SHORT[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
    if (!dayMap[key]) {
      dayMap[key] = { rel, list: [] };
      dayOrder.push(key);
    }
    const pcs = h.pieceIds.map((id) => state.items.find((i) => i.id === id)).filter(Boolean) as Item[];
    const occ = h.occasion && h.occasion !== "all" ? OCC_LABELS[h.occasion] : "";
    dayMap[key].list.push({
      id: h.id,
      hasOcc: !!occ,
      occLabel: occ || "",
      summary: pcs.map((p) => p.name).join(" · "),
      pieces: pcs,
    });
  });

  const days: HistoryDayGroup[] = dayOrder.map((k) => {
    const n = dayMap[k].list.length;
    return { key: k, rel: dayMap[k].rel, entries: dayMap[k].list, isMulti: n > 1, countText: n + " tenues" };
  });

  const weekCount = history.filter(
    (h) => (todayMid.getTime() - new Date(new Date(h.ts).setHours(0, 0, 0, 0)).getTime()) / 864e5 < 7
  ).length;

  return { memory, days, weekCount };
}
