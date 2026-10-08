import { describe, expect, it } from "vitest";
import { retoursAvecTenue, retourPrecedent, retourSuivant, tenuePassee } from "../retro";
import type { TenuePlanifiee } from "../planifier";
import type { HistoryEntry } from "../types";

const MAINTENANT = new Date(2026, 9, 4, 20, 0); // dimanche 4 octobre 2026
const ts = (jour: number, heure = 21) => new Date(2026, 9, jour, heure).getTime();
const porte = (id: string, jour: number, pieceIds = [1, 2, 3]): HistoryEntry => ({ id, ts: ts(jour), pieceIds, occasion: "soiree", temp: 18, weatherLabel: "Nuageux" });
const plan = (id: string, jour: string, pieceIds = [4, 5, 6]): TenuePlanifiee => ({
  id, jour, moment: "Soirée", occasion: "soiree", sousChoix: null, lieu: "Gagny", typeLieu: null, dressingSeul: true, pieceIds, temp: 17, weatherLabel: "Ensoleillé",
});

describe("tenuePassee — l'historique d'abord, le plan ensuite", () => {
  it("une tenue déclarée portée ce jour-là", () => {
    expect(tenuePassee([porte("a", 3)], [], "2026-10-03")).toMatchObject({ source: "porte", pieceIds: [1, 2, 3], temp: 18, weatherLabel: "Nuageux" });
  });
  it("la plus récente du jour quand il y en a plusieurs", () => {
    const h = [{ ...porte("a", 3, [1]), ts: ts(3, 9) }, { ...porte("b", 3, [2]), ts: ts(3, 20) }];
    expect(tenuePassee(h, [], "2026-10-03")?.pieceIds).toEqual([2]);
  });
  it("sans port, le plan du jour", () => {
    expect(tenuePassee([], [plan("p", "2026-10-03")], "2026-10-03")).toMatchObject({ source: "plan", pieceIds: [4, 5, 6] });
  });
  it("le port l'emporte sur le plan", () => {
    expect(tenuePassee([porte("a", 3)], [plan("p", "2026-10-03")], "2026-10-03")?.source).toBe("porte");
  });
  it("rien ce jour-là : null", () => {
    expect(tenuePassee([porte("a", 3)], [], "2026-10-02")).toBeNull();
  });
});

describe("retours — se déplacer d'une tenue passée à l'autre", () => {
  const history = [porte("a", 3), porte("b", 1), porte("c", 28)]; // hier (1), il y a 3 j (1 oct.), pas 28 oct. (futur)
  it("les retours avec une tenue, du plus récent au plus ancien", () => {
    expect(retoursAvecTenue(history, [], MAINTENANT)).toEqual([1, 3]);
  });
  it("précédent : le plus ancien suivant ; null au bout", () => {
    expect(retourPrecedent([1, 3], 0)).toBe(1);
    expect(retourPrecedent([1, 3], 1)).toBe(3);
    expect(retourPrecedent([1, 3], 3)).toBeNull();
  });
  it("suivant : le plus récent ; aujourd'hui (0) au bout", () => {
    expect(retourSuivant([1, 3], 3)).toBe(1);
    expect(retourSuivant([1, 3], 1)).toBe(0);
  });
  it("sans historique, aucun retour", () => {
    expect(retoursAvecTenue([], [], MAINTENANT)).toEqual([]);
  });
});
