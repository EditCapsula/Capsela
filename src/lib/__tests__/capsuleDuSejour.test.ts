import { describe, expect, it } from "vitest";
import { capsuleDuSejour, type SituationValise } from "../valise";
import type { Weather } from "../data";
import type { CapsuleSeason, Item } from "../types";

/** LA CAPSULE DU SÉJOUR SUIT LA CHALEUR DU SÉJOUR (22/10/2026). */

const meteo = (temp: number) => ({ temp, label: "Ensoleillé" }) as Weather;
const sit = (temp: number, jour: string): SituationValise => ({ occasion: "quotidien", meteo: meteo(temp), jours: [jour] });
const piece = (id: number) => ({ id }) as Item;

describe("capsuleDuSejour", () => {
  it("une destination chaude en octobre : la capsule d'été, pas celle d'automne", () => {
    const saisons: CapsuleSeason[] = [];
    capsuleDuSejour([sit(29, "2026-10-25")], (_, s) => (saisons.push(s), []));
    expect(saisons).toEqual(["Été"]);
  });

  it("un séjour frais en octobre reste en automne ; un séjour mixte réunit les deux capsules, sans doublon", () => {
    const saisons: CapsuleSeason[] = [];
    const capsule = capsuleDuSejour([sit(12, "2026-10-25"), sit(29, "2026-10-26"), sit(13, "2026-10-27")], (_, s) => {
      saisons.push(s);
      return s === "Été" ? [piece(1), piece(2)] : [piece(2), piece(3)];
    });
    expect(saisons.sort()).toEqual(["Automne", "Été"]);
    expect(capsule.map((p) => p.id).sort()).toEqual([1, 2, 3]);
  });

  it("pour une même saison, la situation la plus chaude donne la météo de référence", () => {
    const temps: number[] = [];
    capsuleDuSejour([sit(25, "2026-07-10"), sit(31, "2026-07-11")], (m) => (temps.push(m.temp), []));
    expect(temps).toEqual([31]);
  });
});
