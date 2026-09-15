import { describe, expect, it } from "vitest";
import { representativeWeatherFor, saisonCapsulePourMeteo } from "../capsule";
import type { CapsuleSeason } from "../types";

/**
 * LA SAISON DU VIVIER DE LA TENUE DU JOUR — arbitré le 15/09/2026.
 *
 * Avant, la capsule suivait le CALENDRIER : en septembre elle était bâtie pour
 * l'automne, à 14°. À 28°, plus rien n'y passait le filtre de température,
 * l'échelle de `poolFor` descendait au barreau qui abandonne la météo, et
 * l'application proposait un blazer de laine sous un trench.
 *
 * La règle n'invente aucune constante : elle se sert des quatre températures
 * représentatives déjà en place. Ces tests verrouillent ce qu'elle rend, y
 * compris aux égalités — où le hasard de l'ordre de `CAPSULE_SEASONS` déciderait
 * sans eux.
 */
describe("saisonCapsulePourMeteo", () => {
  it("rend sa propre saison à chaque température représentative", () => {
    for (const s of ["Printemps", "Été", "Automne", "Hiver"] as CapsuleSeason[]) {
      expect(saisonCapsulePourMeteo(representativeWeatherFor(s).temp), s).toBe(s);
    }
  });

  it("rend l'Été au cas signalé — 28 °", () => {
    expect(saisonCapsulePourMeteo(28)).toBe("Été");
  });

  it("suit le thermomètre sur toute la plage", () => {
    expect(saisonCapsulePourMeteo(40)).toBe("Été");
    expect(saisonCapsulePourMeteo(30)).toBe("Été");
    expect(saisonCapsulePourMeteo(21)).toBe("Été");
    expect(saisonCapsulePourMeteo(18)).toBe("Printemps");
    expect(saisonCapsulePourMeteo(13)).toBe("Automne");
    expect(saisonCapsulePourMeteo(11)).toBe("Automne");
    expect(saisonCapsulePourMeteo(9)).toBe("Hiver");
    expect(saisonCapsulePourMeteo(-5)).toBe("Hiver");
  });

  it("tranche les égalités vers la saison la plus chaude", () => {
    // 15 ° est à 1 ° du Printemps (16) comme de l'Automne (14).
    expect(saisonCapsulePourMeteo(15)).toBe("Printemps");
    // 10 ° est à 4 ° de l'Automne (14) comme de l'Hiver (6).
    expect(saisonCapsulePourMeteo(10)).toBe("Automne");
    // 20 ° est à 4 ° de l'Été (24) comme du Printemps (16).
    expect(saisonCapsulePourMeteo(20)).toBe("Printemps");
  });

  it("ne rend jamais autre chose qu'une saison de capsule, aux extrêmes compris", () => {
    for (let t = -30; t <= 55; t += 1) {
      expect(["Printemps", "Été", "Automne", "Hiver"], `${t} °`).toContain(saisonCapsulePourMeteo(t));
    }
  });
});
