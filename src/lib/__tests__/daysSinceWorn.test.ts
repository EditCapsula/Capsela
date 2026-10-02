import { describe, expect, it } from "vitest";
import { daysSinceWorn } from "../selectors";
import type { HistoryEntry } from "../types";

const entree = (ts: number): HistoryEntry => ({ id: "h" + ts, ts, pieceIds: [7], occasion: "all" });
/** Date locale (le test ne dépend pas du fuseau : tout est construit en heure locale). */
const local = (j: number, h: number, m = 0) => new Date(2026, 9, j, h, m).getTime();

describe("daysSinceWorn — jours calendaires", () => {
  it("jamais porté : null", () => {
    expect(daysSinceWorn([], 7, local(2, 12))).toBeNull();
    expect(daysSinceWorn([entree(local(1, 10))], 8, local(2, 12))).toBeNull();
  });
  it("porté ce matin : 0", () => {
    expect(daysSinceWorn([entree(local(2, 8))], 7, local(2, 21))).toBe(0);
  });
  it("porté hier à 20 h, regardé aujourd'hui à 12 h : 1 (l'ancien calcul rendait 0)", () => {
    expect(daysSinceWorn([entree(local(1, 20))], 7, local(2, 12))).toBe(1);
  });
  it("porté hier à 23 h 59, regardé à 00 h 01 : 1", () => {
    expect(daysSinceWorn([entree(local(1, 23, 59))], 7, local(2, 0, 1))).toBe(1);
  });
  it("trois jours plus tôt : 3 ; l'entrée la plus récente l'emporte", () => {
    expect(daysSinceWorn([entree(local(5, 9)), entree(local(8, 9))], 7, local(10, 15))).toBe(2);
    expect(daysSinceWorn([entree(local(1, 9))], 7, local(4, 8))).toBe(3);
  });
  it("une entrée dans le futur ne rend jamais un nombre négatif", () => {
    expect(daysSinceWorn([entree(local(5, 9))], 7, local(2, 9))).toBe(0);
  });
});
