import { describe, expect, it } from "vitest";
import { messageCadrage } from "../cadragePhoto";

describe("messageCadrage — dit seulement ce que l'analyse a vu", () => {
  it("pièce seule, ou analyse pas sûre : rien", () => {
    expect(messageCadrage("seule")).toBeNull();
    expect(messageCadrage(null)).toBeNull();
  });
  it("pièce portée : le dit, en parlant de la photo", () => {
    const m = messageCadrage("portee")!;
    expect(m.titre).toBe("Cette photo montre la pièce portée");
    expect(m.texte).toContain("pièce seule");
  });
  it("plusieurs pièces : le dit", () => {
    expect(messageCadrage("plusieurs")!.titre).toBe("Cette photo montre plusieurs pièces");
  });
  it("aucun mot interdit (vocabulaire morphologique, négatif)", () => {
    for (const c of ["portee", "plusieurs"] as const) {
      const t = JSON.stringify(messageCadrage(c)).toLowerCase();
      for (const mot of ["cacher", "dissimul", "camoufl", "corriger", "défaut", "grossir", "amincir", "flatteur"]) expect(t).not.toContain(mot);
    }
  });
});
