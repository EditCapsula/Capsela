import { describe, expect, it } from "vitest";
import { FAMILLES_COULEURS, PALETTE } from "../data";

describe("FAMILLES_COULEURS — le rangement du sélecteur de couleur", () => {
  const tous = FAMILLES_COULEURS.flatMap((f) => f.noms);
  it("chaque teinte de PALETTE figure dans une seule famille, et rien d'autre", () => {
    expect(new Set(tous).size).toBe(tous.length);
    expect([...tous].sort()).toEqual(PALETTE.map(([n]) => n).sort());
  });
  it("chaque famille est nommée et n'est pas vide", () => {
    for (const f of FAMILLES_COULEURS) {
      expect(f.libelle).toBeTruthy();
      expect(f.noms.length).toBeGreaterThan(0);
    }
  });
});
