import { afterEach, describe, expect, it, vi } from "vitest";
import { clePiecesEcartees, ecrirePiecesEcartees, lirePiecesEcartees, normaliserPiecesEcartees } from "../piecesEcartees";

// « J'ai déjà » sur une pièce de capsule : elle reste écartée après un rechargement (01/11/2026).

afterEach(() => {
  vi.unstubAllGlobals();
});

function stockageFactice(initial: Record<string, string> = {}) {
  const donnees = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => donnees.get(k) ?? null, setItem: (k: string, v: string) => void donnees.set(k, v) },
  });
  return donnees;
}

describe("piecesEcartees", () => {
  it("ne garde que des nombres, sans doublon", () => {
    expect(normaliserPiecesEcartees([3, "4", 3, null, 7, Number.NaN])).toEqual([3, 7]);
    expect(normaliserPiecesEcartees({ a: 1 })).toEqual([]);
  });

  it("écrit puis relit la liste, rangée par compte", () => {
    const donnees = stockageFactice();
    ecrirePiecesEcartees("u1", [12, 40, 12]);
    expect(donnees.get("capsela.piecesEcartees.u1")).toBe("[12,40]");
    expect(lirePiecesEcartees("u1")).toEqual([12, 40]);
    expect(lirePiecesEcartees("u2")).toEqual([]);
    expect(clePiecesEcartees(null)).toBe("capsela.piecesEcartees.demo");
  });

  it("un contenu illisible ou un stockage absent ne fait rien échouer", () => {
    stockageFactice({ "capsela.piecesEcartees.u1": "{pas du json" });
    expect(lirePiecesEcartees("u1")).toEqual([]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("bloqué");
        },
        setItem: () => {
          throw new Error("bloqué");
        },
      },
    });
    expect(lirePiecesEcartees("u1")).toEqual([]);
    expect(() => ecrirePiecesEcartees("u1", [1])).not.toThrow();
  });
});
