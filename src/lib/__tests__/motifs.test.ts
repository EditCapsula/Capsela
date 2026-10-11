import { describe, expect, it } from "vitest";
import { MOTIFS, aUnMotif, libelleMotif, motifDepuis } from "../motifs";
import { MOTIFS as MOTIFS_EDGE, aUnMotif as aUnMotifEdge } from "../../../supabase/functions/_shared/enumsPiece.ts";
import { assainerObjets } from "../../../supabase/functions/_shared/analyseTenue.ts";
import { brouillonsDepuis, changerCategorie, pieceDepuis, type ObjetRepere } from "../importTenue";

// MOTIF D'UNE PIÈCE (11/10/2026) — phase 1 : lecture, affichage, correction. Le moteur ne le lit pas.

const objetEdge = (o: Record<string, unknown> = {}) => ({
  nom: "Chemise",
  cat: "haut",
  sous_type: "Chemise",
  matiere: "Coton",
  manches: "longues",
  color_hex: "#C9846A",
  boite: [0.1, 0.1, 0.4, 0.8],
  ...o,
});

const repere = (o: Partial<ObjetRepere> = {}): ObjetRepere => ({
  nom: "Chemise",
  cat: "haut",
  couleur: { nom: "Terracotta", hex: "#C9846A" },
  couleurLue: true,
  photo_url: "u",
  ...o,
});

describe("liste des motifs", () => {
  it("est identique côté app et côté fonctions Edge", () => {
    expect(MOTIFS.map((m) => m.valeur)).toEqual([...MOTIFS_EDGE]);
  });
  it("aUnMotif : tout sauf le bijou, des deux côtés", () => {
    for (const cat of ["haut", "robe", "sac", "chaussures", "accessoire", "bijou"] as const) {
      expect(aUnMotif(cat)).toBe(cat !== "bijou");
      expect(aUnMotifEdge(cat)).toBe(aUnMotif(cat));
    }
  });
  it("motifDepuis ne garde qu'une des huit valeurs", () => {
    expect(motifDepuis("rayures")).toBe("rayures");
    expect(motifDepuis("tartan")).toBeUndefined();
    expect(motifDepuis(null)).toBeUndefined();
    expect(libelleMotif("pois")).toBe("Pois");
  });
});

describe("analyse d'une tenue — motif", () => {
  it("un motif de la liste est gardé, hors liste ignoré", () => {
    expect(assainerObjets({ objets: [objetEdge({ motif: "carreaux" })] })[0].motif).toBe("carreaux");
    expect(assainerObjets({ objets: [objetEdge({ motif: "tartan" })] })[0].motif).toBeUndefined();
  });
  it("un bijou n'a pas de motif", () => {
    const [b] = assainerObjets({ objets: [objetEdge({ cat: "bijou", sous_type: null, bijou_type: "Collier", manches: null, motif: "pois" })] });
    expect(b?.motif).toBeUndefined();
  });
});

describe("importer une tenue — motif", () => {
  it("le motif lu devient celui du brouillon puis de la pièce", () => {
    const [b] = brouillonsDepuis([repere({ motif: "fleurs" })]);
    expect(b.motif).toBe("fleurs");
    expect(pieceDepuis({ ...b, saisons: ["Été"] }).motif).toBe("fleurs");
  });
  it("sans motif lu, rien n'est inventé", () => {
    const [b] = brouillonsDepuis([repere()]);
    expect(b.motif).toBeNull();
    expect(pieceDepuis(b).motif).toBeUndefined();
  });
  it("changer pour un bijou efface le motif", () => {
    const [b] = brouillonsDepuis([repere({ motif: "pois" })]);
    expect(changerCategorie(b, "bijou").motif).toBeNull();
    expect(changerCategorie(b, "sac").motif).toBe("pois");
  });
});
