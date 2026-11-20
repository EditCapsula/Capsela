import { describe, expect, it } from "vitest";
import { ajouterLookAValise, valisesAVenir } from "../lookEnValise";
import type { ValiseGardee } from "../valises";

// AJOUTER UN LOOK À UNE VALISE (20/11/2026, demandé depuis le détail d'un look).
const valise = (autre: Partial<ValiseGardee> = {}): ValiseGardee =>
  ({
    version: 2, id: "v1", destination: "Bali", depart: "2026-11-23", retour: "2026-11-30", bagage: "M", sejour: null, occasions: [], meteos: [],
    situations: [{ occasion: "quotidien", jours: [] }, { occasion: "soiree", jours: [] }],
    looks: [{ ids: [1, 2], situations: [0], elargie: false }], situationsSansLook: [1], pieceIds: [1, 2], ...autre,
  }) as unknown as ValiseGardee;

describe("ajouterLookAValise", () => {
  it("ses pièces rejoignent la valise sans doublon, et il répond à l'occasion qui est la sienne", () => {
    const r = ajouterLookAValise(valise(), [2, 3, 4], "soiree");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.valise.pieceIds).toEqual([1, 2, 3, 4]);
    expect(r.valise.looks.at(-1)).toEqual({ ids: [2, 3, 4], situations: [1], elargie: false });
    expect(r.valise.situationsSansLook).toEqual([]);
  });
  it("aucune occasion inventée : un look sans occasion, ou d'une occasion que la valise n'a pas, n'en couvre aucune", () => {
    const sans = ajouterLookAValise(valise(), [3, 4], undefined);
    const autre = ajouterLookAValise(valise(), [3, 4], "sport");
    for (const r of [sans, autre]) {
      expect(r.ok && r.valise.looks.at(-1)?.situations).toEqual([]);
      expect(r.ok && r.valise.situationsSansLook).toEqual([1]);
    }
  });
  it("une pièce de la capsule y entre comme suggestion", () => {
    const r = ajouterLookAValise(valise(), [3, 5001], "quotidien");
    expect(r.ok && r.valise.suggestionIds).toEqual([5001]);
  });
  it("refusé : un look déjà dans la valise (mêmes pièces, dans n'importe quel ordre)", () => {
    expect(ajouterLookAValise(valise(), [2, 1], "quotidien")).toEqual({ ok: false, raison: "deja" });
  });
  it("refusé : des pièces de la capsule dans une valise « uniquement mon dressing » ; accepté sans elles", () => {
    expect(ajouterLookAValise(valise({ uniquementDressing: true }), [3, 5001], "quotidien")).toEqual({ ok: false, raison: "dressing_seul" });
    expect(ajouterLookAValise(valise({ uniquementDressing: true }), [3, 4], "quotidien").ok).toBe(true);
  });
  it("la valise d'origine n'est pas modifiée", () => {
    const v = valise();
    ajouterLookAValise(v, [3, 4], "soiree");
    expect(v.pieceIds).toEqual([1, 2]);
    expect(v.looks).toHaveLength(1);
  });
});

describe("valisesAVenir", () => {
  it("celles dont le retour n'est pas passé, la plus proche d'abord", () => {
    const a = valise({ id: "a", depart: "2026-12-20", retour: "2026-12-27" });
    const b = valise({ id: "b", depart: "2026-11-18", retour: "2026-11-21" });
    const c = valise({ id: "c", depart: "2026-10-01", retour: "2026-10-05" });
    expect(valisesAVenir([a, b, c], "2026-11-20").map((v) => v.id)).toEqual(["b", "a"]);
  });
});
