import { describe, expect, it } from "vitest";
import { titreEditorialOccasion } from "../logic";
import type { OccasionKey } from "../types";

// 25/11/2026, signalé sur un profil homme : « Féminine et minimaliste » sous « Et si on changeait de style ? ». Les titres d'occasion
// décrivent la tenue, jamais la personne : aucun ne dit son genre.
describe("titres d'occasion neutres", () => {
  const occasions: OccasionKey[] = ["quotidien", "travail_formel", "date", "soiree", "sport", "cocooning", "voyage", "evenement_perso"];
  it.each(occasions)("%s ne dit pas le genre", (o) => {
    expect(titreEditorialOccasion(o)).not.toMatch(/f[ée]minin|masculin/i);
  });
  it("garde un titre pour la date et l'événement perso", () => {
    expect(titreEditorialOccasion("date")).toBe("Soignée et minimaliste");
    expect(titreEditorialOccasion("evenement_perso")).toBe("Élégante et posée");
  });
});
