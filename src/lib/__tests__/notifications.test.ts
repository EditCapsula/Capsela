import { describe, expect, it } from "vitest";
import { heureDeNotification, JOURS_PROGRAMMES, prochainsMoments } from "../notifications";

describe("heure de la notification de la tenue du jour", () => {
  it("lit l'heure des Préférences", () => {
    expect(heureDeNotification("08:00")).toEqual({ hour: 8, minute: 0 });
    expect(heureDeNotification("7:30")).toEqual({ hour: 7, minute: 30 });
    expect(heureDeNotification(" 23:59 ")).toEqual({ hour: 23, minute: 59 });
  });
  it("refuse une heure vide ou abîmée : rien n'est programmé", () => {
    for (const v of ["", null, undefined, "24:00", "08:60", "8h", "08:00:00"]) expect(heureDeNotification(v)).toBeNull();
  });
});

describe("prochainsMoments", () => {
  it("aujourd'hui si l'heure n'est pas passée, puis un jour après l'autre", () => {
    const m = prochainsMoments({ hour: 8, minute: 0 }, new Date(2026, 10, 5, 7, 30));
    expect(m).toHaveLength(JOURS_PROGRAMMES);
    expect(m[0]).toEqual(new Date(2026, 10, 5, 8, 0));
    expect(m[1]).toEqual(new Date(2026, 10, 6, 8, 0));
    expect(m[13]).toEqual(new Date(2026, 10, 18, 8, 0));
  });
  it("demain si l'heure est passée ou à moins d'une minute", () => {
    expect(prochainsMoments({ hour: 8, minute: 0 }, new Date(2026, 10, 5, 9, 0), 1)[0]).toEqual(new Date(2026, 10, 6, 8, 0));
    expect(prochainsMoments({ hour: 8, minute: 0 }, new Date(2026, 10, 5, 7, 59, 30), 1)[0]).toEqual(new Date(2026, 10, 6, 8, 0));
  });
  it("garde l'heure locale au changement d'heure et au changement de mois", () => {
    const m = prochainsMoments({ hour: 8, minute: 15 }, new Date(2026, 9, 24, 12, 0), 3);
    expect(m.map((d) => [d.getDate(), d.getHours(), d.getMinutes()])).toEqual([[25, 8, 15], [26, 8, 15], [27, 8, 15]]);
    expect(prochainsMoments({ hour: 8, minute: 0 }, new Date(2026, 10, 30, 9, 0), 1)[0]).toEqual(new Date(2026, 11, 1, 8, 0));
  });
});
