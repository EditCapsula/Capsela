import { afterEach, describe, expect, it, vi } from "vitest";
import { ecrireVotes, fusionnerVotes, lireVotes, nettoyerVotes, piecesAimees, piecesEcarteesParVotes, voter } from "../votesSuggestions";

// Les votes sur les suggestions de la capsule (02/11/2026) : quatre états distincts, jamais confondus.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("votesSuggestions", () => {
  it("un seul état par pièce ; un nouveau vote remplace le précédent, null le retire", () => {
    let t = voter({}, 101, "aimee");
    expect(t).toEqual({ "101": "aimee" });
    t = voter(t, 101, "possedee");
    expect(t).toEqual({ "101": "possedee" });
    expect(voter(t, 101, null)).toEqual({});
  });

  it("aimer n'écarte pas la pièce de la capsule ; rejeter, posséder et remplacer l'écartent", () => {
    const t = { "1": "aimee", "2": "rejetee", "3": "possedee", "4": "remplacee" } as const;
    expect(piecesEcarteesParVotes(t).sort()).toEqual([2, 3, 4]);
    expect([...piecesAimees(t)]).toEqual([1]);
  });

  it("un stockage altéré ne casse rien", () => {
    expect(nettoyerVotes({ "12": "aimee", x: "aimee", "13": "achetee", "14": 3 })).toEqual({ "12": "aimee" });
    expect(nettoyerVotes(null)).toEqual({});
  });

  it("fusion appareil / compte : le compte l'emporte, ce que seul l'appareil connaît repart vers le compte", () => {
    const { fusion, aEnvoyer } = fusionnerVotes({ "1": "aimee", "2": "rejetee" }, { "1": "possedee", "3": "aimee" });
    expect(fusion).toEqual({ "1": "possedee", "2": "rejetee", "3": "aimee" });
    expect(aEnvoyer).toEqual({ "2": "rejetee" });
  });

  it("écrit puis relit sur l'appareil, rangé par compte ; un stockage absent ne fait rien échouer", () => {
    const donnees = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (k: string) => donnees.get(k) ?? null, setItem: (k: string, v: string) => void donnees.set(k, v) } });
    ecrireVotes("u1", { "7": "rejetee" });
    expect(lireVotes("u1")).toEqual({ "7": "rejetee" });
    expect(lireVotes("u2")).toEqual({});
    vi.stubGlobal("window", { localStorage: { getItem: () => { throw new Error("x"); }, setItem: () => { throw new Error("x"); } } });
    expect(lireVotes("u1")).toEqual({});
    expect(() => ecrireVotes("u1", {})).not.toThrow();
  });
});
