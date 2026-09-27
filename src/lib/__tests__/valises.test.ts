import { describe, expect, it } from "vitest";
import { normaliserValise, rowToValise, valiseEnCours, valiseToRow, type ValiseGardee } from "../valises";

const V2: ValiseGardee = {
  version: 2,
  destination: "Lisbonne",
  depart: "2026-10-16",
  retour: "2026-10-20",
  bagage: "M",
  sejour: "city_break",
  occasions: ["quotidien", "soiree"],
  meteos: [{ jour: "2026-10-16", temp: 20, label: "Ensoleillé", prevue: false }],
  situations: [],
  pieceIds: [1, 4, 7, 10],
  looks: [{ ids: [1, 4, 7], situations: [0], elargie: false }],
  situationsSansLook: [],
};

describe("valises — la valise enregistrée", () => {
  it("une valise du lot 1 est reprise sans rien perdre", () => {
    const v1 = {
      version: 1 as const,
      destination: V2.destination,
      depart: V2.depart,
      retour: V2.retour,
      bagage: V2.bagage,
      sejour: V2.sejour,
      occasions: V2.occasions,
      meteos: V2.meteos,
      situations: V2.situations,
      pieceIds: V2.pieceIds,
      looks: V2.looks,
      situationsSansLook: V2.situationsSansLook,
    };
    expect(normaliserValise(v1)).toEqual(V2);
    expect(normaliserValise(null)).toBeNull();
  });

  it("aller-retour avec la ligne de la base, ids bigint en chaînes compris", () => {
    const row = valiseToRow(V2);
    expect(rowToValise(row)).toEqual(V2);
    expect(rowToValise({ ...row, piece_ids: ["1", "4"] }).pieceIds).toEqual([1, 4]);
  });

  it("un séjour terminé ne se rouvre pas", () => {
    expect(valiseEnCours(V2, "2026-10-20")).toBe(V2);
    expect(valiseEnCours(V2, "2026-10-21")).toBeNull();
  });
});
