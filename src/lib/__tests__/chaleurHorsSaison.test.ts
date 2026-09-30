import { describe, expect, it } from "vitest";
import {
  CHALEUR_HORS_SAISON,
  saisonCapsuleDuJour,
  saisonCapsulePourMeteo,
  weatherForDay,
} from "../capsule";

/**
 * « VRAIE CHALEUR » — arbitré le 30/09/2026 (option 2 : le calendrier d'abord,
 * sauf vraie chaleur), seuil 24° mesuré par chaleur-hors-saison.audit.ts.
 *
 * Signalé ce jour-là : à 21° fin septembre, un haut sans manches et des
 * sandales. Ces tests verrouillent les deux leviers au seuil de production ;
 * les leviers eux-mêmes, omis, gardent la règle d'origine.
 */
describe("seuil de vraie chaleur", () => {
  it("vaut 24°", () => {
    expect(CHALEUR_HORS_SAISON).toBe(24);
  });

  describe("saisonCapsuleDuJour", () => {
    it("reste dans l'automne-hiver en automne calendaire, de 20° à 23° — le cas signalé", () => {
      for (const t of [20, 21, 22, 23]) {
        expect(saisonCapsulePourMeteo(t), `origine ${t}°`).toBe("Été");
        expect(["Automne", "Hiver"], `${t}°`).toContain(saisonCapsuleDuJour(t, "Automne"));
      }
    });

    it("rend l'Été dès le seuil, y compris en automne calendaire", () => {
      expect(saisonCapsuleDuJour(24, "Automne")).toBe("Été");
      expect(saisonCapsuleDuJour(28, "Automne")).toBe("Été");
      expect(saisonCapsuleDuJour(28, "Hiver")).toBe("Été");
    });

    it("ne change rien au printemps ni à l'été calendaires", () => {
      for (let t = -10; t <= 34; t++) {
        for (const c of ["Printemps", "Été"] as const) {
          expect(saisonCapsuleDuJour(t, c), `${c} ${t}°`).toBe(saisonCapsulePourMeteo(t));
        }
      }
    });

    it("ne change rien aux températures où la règle d'origine donnait déjà l'automne-hiver", () => {
      for (let t = -10; t <= 40; t++) {
        const origine = saisonCapsulePourMeteo(t);
        if (origine !== "Automne" && origine !== "Hiver") continue;
        for (const c of ["Automne", "Hiver"] as const) expect(saisonCapsuleDuJour(t, c), `${c} ${t}°`).toBe(origine);
      }
    });

    it("retire le Printemps du vivier en automne calendaire, à 17° (règle d'origine : Printemps)", () => {
      expect(saisonCapsulePourMeteo(17)).toBe("Printemps");
      expect(["Automne", "Hiver"]).toContain(saisonCapsuleDuJour(17, "Automne"));
    });
  });

  describe("weatherForDay au seuil", () => {
    it("n'admet pas la moitié printemps-été à 21° en automne calendaire", () => {
      const w = weatherForDay(21, "Ensoleillé", "Automne", CHALEUR_HORS_SAISON);
      expect(w.seasons).not.toContain("Printemps / Été");
      expect(w.saisons).not.toContain("Été");
      // La température, elle, ne ment pas.
      expect(w.season).toBe("Printemps / Été");
    });

    it("l'admet dès 24°", () => {
      const w = weatherForDay(24, "Ensoleillé", "Automne", CHALEUR_HORS_SAISON);
      expect(w.seasons).toContain("Printemps / Été");
      expect(w.saisons).toContain("Été");
    });

    it("omis, le levier laisse la règle d'origine", () => {
      const w = weatherForDay(21, "Ensoleillé", "Automne");
      expect(w.seasons).toContain("Printemps / Été");
    });

    it("ne touche pas une journée d'été calendaire", () => {
      expect(weatherForDay(21, "Ensoleillé", "Été", CHALEUR_HORS_SAISON)).toEqual(weatherForDay(21, "Ensoleillé", "Été"));
    });
  });
});
