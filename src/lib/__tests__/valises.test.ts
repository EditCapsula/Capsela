import { describe, expect, it } from "vitest";
import { avecValise, estIdLocal, normaliserValise, repartirPlanifications, rowToValise, valiseToRow, type ValiseGardee } from "../valises";
import type { TenuePlanifiee } from "../planifier";

const V2: ValiseGardee = {
  version: 2,
  id: "12",
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
  it("une valise du lot 1 ou à valise unique est reprise sans rien perdre, avec un identifiant local", () => {
    const { id: _id, ...sansId } = V2;
    void _id;
    const reprise = normaliserValise({ ...sansId, version: 1 })!;
    expect({ ...reprise, id: "12" }).toEqual(V2);
    expect(estIdLocal(reprise.id)).toBe(true);
    expect(normaliserValise(V2)).toEqual(V2);
    expect(normaliserValise(null)).toBeNull();
  });

  it("aller-retour avec la ligne de la base, ids bigint en chaînes compris", () => {
    const row = { id: 12, ...valiseToRow(V2) };
    expect(rowToValise(row)).toEqual(V2);
    expect(rowToValise({ ...row, piece_ids: ["1", "4"] }).pieceIds).toEqual([1, 4]);
  });

  it("ajoute une valise en tête, ou remplace celle de même identifiant", () => {
    const autre = { ...V2, id: "local-a", destination: "Rome" };
    expect(avecValise([V2], autre).map((v) => v.id)).toEqual(["local-a", "12"]);
    expect(avecValise([V2, autre], { ...V2, destination: "Porto" }).map((v) => v.destination)).toEqual(["Porto", "Rome"]);
  });
});

describe("repartirPlanifications — tenues et valises dans « Mes planifications »", () => {
  const tenue = (id: string, jour: string): TenuePlanifiee => ({
    id, jour, moment: "Soirée", occasion: "festive", sousChoix: null, lieu: "Gagny", typeLieu: null, dressingSeul: false, pieceIds: [1], temp: null, weatherLabel: null,
  });
  const valise = (id: string, depart: string, retour: string): ValiseGardee => ({ ...V2, id, depart, retour });

  it("une valise reste à venir jusqu'à son retour, puis passe", () => {
    const r = repartirPlanifications([], [valise("a", "2026-09-25", "2026-09-28"), valise("b", "2026-09-20", "2026-09-26")], "2026-09-27");
    expect(r.aVenir.map((p) => p.type === "valise" && p.valise.id)).toEqual(["a"]);
    expect(r.passees.map((p) => p.type === "valise" && p.valise.id)).toEqual(["b"]);
  });

  it("à venir : la plus proche d'abord, tenues et valises mêlées ; passées : la plus récente d'abord", () => {
    const r = repartirPlanifications(
      [tenue("t1", "2026-10-11"), tenue("t2", "2026-09-30"), tenue("t3", "2026-09-10")],
      [valise("v1", "2026-10-02", "2026-10-06"), valise("v2", "2026-09-01", "2026-09-15")],
      "2026-09-27"
    );
    const cle = (p: (typeof r.aVenir)[number]) => (p.type === "tenue" ? p.tenue.id : p.valise.id);
    expect(r.aVenir.map(cle)).toEqual(["t2", "v1", "t1"]);
    expect(r.passees.map(cle)).toEqual(["v2", "t3"]);
  });
});
