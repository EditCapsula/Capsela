import { describe, expect, it } from "vitest";
import {
  ajouterPeriode,
  dansUnePeriode,
  libellePeriode,
  momentRappelReprise,
  periodesAVenir,
  periodesDe,
  retirerPeriode,
} from "../conges";
import { occasionParDefaut } from "../jourConsulte";
import { DEFAULT_PREFS } from "../profile";

const NOEL = { debut: "2026-12-20", fin: "2027-01-03" };
const midi = (j: string) => new Date(`${j}T12:00:00`);

describe("périodes de congés", () => {
  it("ignore ce qui est abîmé en base et trie", () => {
    expect(periodesDe(undefined)).toEqual([]);
    expect(periodesDe([{ debut: "2027-07-01", fin: "2027-07-15" }, NOEL, { debut: "x" }, { debut: "2026-05-02", fin: "2026-05-01" }, null])).toEqual([
      NOEL,
      { debut: "2027-07-01", fin: "2027-07-15" },
    ]);
  });

  it("un jour est en congés du premier au dernier jour inclus", () => {
    expect(dansUnePeriode([NOEL], midi("2026-12-19"))).toBe(false);
    expect(dansUnePeriode([NOEL], midi("2026-12-20"))).toBe(true);
    expect(dansUnePeriode([NOEL], midi("2027-01-03"))).toBe(true);
    expect(dansUnePeriode([NOEL], midi("2027-01-04"))).toBe(false);
  });

  it("ajouter sans doublon, retirer", () => {
    const l = ajouterPeriode([NOEL], NOEL);
    expect(l).toEqual([NOEL]);
    expect(ajouterPeriode([], { debut: "2026-12-05", fin: "2026-12-01" })).toEqual([]);
    expect(retirerPeriode(l, NOEL)).toEqual([]);
  });

  it("seules les périodes pas encore finies restent à venir", () => {
    expect(periodesAVenir([NOEL, { debut: "2026-08-01", fin: "2026-08-15" }], midi("2026-11-04"))).toEqual([NOEL]);
    expect(periodesAVenir([NOEL], midi("2027-01-03"))).toEqual([NOEL]);
    expect(periodesAVenir([NOEL], midi("2027-01-04"))).toEqual([]);
  });

  it("libellé court", () => {
    expect(libellePeriode(NOEL)).toBe("20 déc. → 3 janv.");
    expect(libellePeriode({ debut: "2027-07-14", fin: "2027-07-14" })).toBe("14 juil.");
  });

  it("le rappel de reprise : le dernier jour à 18 h, jamais dans le passé", () => {
    const m = momentRappelReprise(NOEL, midi("2026-11-04"))!;
    expect([m.getFullYear(), m.getMonth(), m.getDate(), m.getHours()]).toEqual([2027, 0, 3, 18]);
    expect(momentRappelReprise(NOEL, new Date("2027-01-03T19:00:00"))).toBeNull();
  });
});

describe("occasion par défaut d'un jour de congés daté", () => {
  it("Cocooning pendant la période, la règle des jours travaillés autour", () => {
    const prefs = { ...DEFAULT_PREFS, conges: [NOEL] };
    expect(occasionParDefaut(prefs, midi("2026-12-21"))).toBe("cocooning"); // lundi, en congés
    expect(occasionParDefaut(prefs, midi("2027-01-04"))).toBe("travail_formel"); // lundi de reprise
  });
});
