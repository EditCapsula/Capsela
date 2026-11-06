import { describe, expect, it } from "vitest";
import { CHALEUR_HORS_SAISON, saisonCalendairePour, weatherForDay } from "../capsule";
import { groupesMeteo } from "../valise";

/**
 * LA SAISON D'UN JOUR DU SÉJOUR SUIT SA TEMPÉRATURE (06/11/2026, valise pour Pékin fin novembre). Mesuré dans la même exécution :
 * avant (saison du calendrier, la règle d'origine reconstituée ici) et après (groupesMeteo).
 */
const avant = (temp: number, jour: string) => weatherForDay(temp, "Nuageux", saisonCalendairePour(new Date(`${jour}T12:00:00`)), CHALEUR_HORS_SAISON).saisons;
const apres = (temp: number, jour: string) => groupesMeteo([{ jour, temp, label: "Nuageux", prevue: false }])[0].meteo.saisons;

describe("saisons admises d'un jour de valise", () => {
  it("Pékin fin novembre (2° en moyenne) : l'Hiver seul, plus l'Automne", () => {
    expect(avant(2, "2026-11-25")).toEqual(["Automne", "Hiver"]);
    expect(apres(2, "2026-11-25")).toEqual(["Hiver"]);
  });

  it("une plage à 28° en janvier : l'Été seul, plus l'Hiver", () => {
    expect(avant(28, "2026-01-15")).toContain("Hiver");
    expect(apres(28, "2026-01-15")).toEqual(["Été"]);
  });

  it("un jour qui s'accorde au calendrier est inchangé", () => {
    expect(apres(12, "2026-11-10")).toEqual(avant(12, "2026-11-10"));
    expect(apres(24, "2026-07-10")).toEqual(avant(24, "2026-07-10"));
  });
});
