import { describe, expect, it } from "vitest";
import { repartirParEcheance, type TenuePlanifiee } from "../planifier";

const t = (jour: string, moment: TenuePlanifiee["moment"] = "Matin"): TenuePlanifiee => ({
  id: jour + moment,
  jour,
  moment,
  occasion: "travail_formel",
  sousChoix: "Présentiel",
  lieu: "Clichy",
  typeLieu: null,
  dressingSeul: false,
  pieceIds: [1, 2],
  temp: 14,
  weatherLabel: "Nuageux",
});

describe("tenues planifiées — répartition entre les deux onglets", () => {
  it("le jour même reste à venir, quel que soit le moment", () => {
    // La bascule se fait sur le JOUR : `moment` nomme un moment, il ne le
    // date pas. Une tenue du matin consultée l'après-midi reste à venir.
    const r = repartirParEcheance([t("2026-09-24", "Matin"), t("2026-09-24", "Soirée")], "2026-09-24");
    expect(r.aVenir).toHaveLength(2);
    expect(r.passees).toHaveLength(0);
  });

  it("la veille est passée, le lendemain est à venir", () => {
    const r = repartirParEcheance([t("2026-09-23"), t("2026-09-25")], "2026-09-24");
    expect(r.aVenir.map((x) => x.jour)).toEqual(["2026-09-25"]);
    expect(r.passees.map((x) => x.jour)).toEqual(["2026-09-23"]);
  });

  it("les à-venir vont du plus proche au plus lointain", () => {
    const r = repartirParEcheance([t("2026-10-02"), t("2026-09-26"), t("2026-09-30")], "2026-09-24");
    expect(r.aVenir.map((x) => x.jour)).toEqual(["2026-09-26", "2026-09-30", "2026-10-02"]);
  });

  it("les passées vont de la plus récente à la plus ancienne", () => {
    const r = repartirParEcheance([t("2026-09-01"), t("2026-09-20"), t("2026-09-10")], "2026-09-24");
    expect(r.passees.map((x) => x.jour)).toEqual(["2026-09-20", "2026-09-10", "2026-09-01"]);
  });

  it("le tri est lexicographique sur AAAA-MM-JJ, donc chronologique par-dessus un changement d'année", () => {
    // Le format ISO est le seul qui rende ces deux tris équivalents : en
    // « 02/01 » et « 28/12 », la comparaison de chaînes se tromperait.
    const r = repartirParEcheance([t("2027-01-02"), t("2026-12-28")], "2026-09-24");
    expect(r.aVenir.map((x) => x.jour)).toEqual(["2026-12-28", "2027-01-02"]);
  });

  it("une liste vide ne rend pas d'onglet peuplé", () => {
    const r = repartirParEcheance([], "2026-09-24");
    expect(r.aVenir).toEqual([]);
    expect(r.passees).toEqual([]);
  });
});
