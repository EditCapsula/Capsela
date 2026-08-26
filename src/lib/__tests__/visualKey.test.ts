import { describe, expect, it } from "vitest";
import { computeVisualKey, normalizeVisualColor, normalizeVisualSubtype } from "../visualKey";
import { item } from "./fixtures";

describe("normalizeVisualColor", () => {
  it("regroupe les variantes visuellement équivalentes", () => {
    expect(normalizeVisualColor("Écru")).toBe("ecru");
    expect(normalizeVisualColor("Ivoire")).toBe("ecru");
    expect(normalizeVisualColor("Blanc cassé")).toBe("ecru");
    expect(normalizeVisualColor("Gris clair")).toBe("gris");
    expect(normalizeVisualColor("Rose poudré")).toBe("rose");
  });

  it("retombe sur le slug plutôt que de perdre une couleur inconnue", () => {
    expect(normalizeVisualColor("Bleu paon")).toBe("bleu_paon");
  });
});

describe("normalizeVisualSubtype", () => {
  it("regroupe les variantes d'un même sous-type", () => {
    expect(normalizeVisualSubtype("Ballerines plates")).toBe("ballerines");
    expect(normalizeVisualSubtype("Cardigan")).toBe("gilet");
  });

  it("distingue un sous-type enrichi d'un sous-type générique (cas 1043)", () => {
    // "Écharpe oversize" n'est pas un bucket : la correspondance est exacte,
    // donc le slug complet est conservé et la pièce obtient son propre
    // visuel au lieu de mutualiser celui d'une écharpe fine.
    expect(normalizeVisualSubtype("Écharpe")).toBe("echarpe");
    expect(normalizeVisualSubtype("Écharpe oversize")).toBe("echarpe_oversize");
  });
});

describe("computeVisualKey", () => {
  const base = { id: 1, category: "hauts", name: "Chemise", sous_type: "Chemise", couleur_dominante: "Blanc" } as const;

  it("compose genre_categorie_soustype_couleur", () => {
    expect(computeVisualKey(item({ ...base }))).toBe("femme_haut_chemise_blanc");
  });

  it("ajoute oversize pour une coupe Ample, jamais pour une autre", () => {
    expect(computeVisualKey(item({ ...base, coupe: "Ample" }))).toBe("femme_haut_chemise_blanc_oversize");
    expect(computeVisualKey(item({ ...base, coupe: "Ajusté" }))).toBe("femme_haut_chemise_blanc");
  });

  it("n'ajoute la matière que si elle change l'apparence", () => {
    expect(computeVisualKey(item({ id: 2, category: "sacs", name: "Cabas", sous_type: "Cabas", couleur_dominante: "Camel", matiere: "Cuir" })))
      .toBe("femme_sac_cabas_camel_cuir");
    expect(computeVisualKey(item({ ...base, matiere: "Coton" }))).toBe("femme_haut_chemise_blanc");
  });

  it("ignore style, saison et formalité — ils ne changent jamais le produit", () => {
    const a = item({ ...base, styles: "Glamour", saison_capsule: "Hiver", niveau_formalite: "habille" });
    const b = item({ ...base, styles: "Bohème", saison_capsule: "Été", niveau_formalite: "decontracte" });
    expect(computeVisualKey(a)).toBe(computeVisualKey(b));
  });
});
