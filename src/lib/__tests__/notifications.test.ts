import { describe, expect, it } from "vitest";
import { heureDeNotification } from "../notifications";

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
