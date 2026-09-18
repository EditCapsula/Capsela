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

  // La couture d'audit du 18/09. Elle n'existe que pour pouvoir soumettre un
  // autre réglage à CETTE fonction plutôt qu'à une copie — donc ce qu'il faut
  // verrouiller, c'est qu'omise elle ne change rien, et que renseignée elle
  // déplace bien les frontières.
  describe("couture tempRepresentative", () => {
    it("omise ou vide, reproduit exactement la production", () => {
      for (let t = -30; t <= 55; t += 1) {
        expect(saisonCapsulePourMeteo(t, undefined), `${t} °`).toBe(saisonCapsulePourMeteo(t));
        expect(saisonCapsulePourMeteo(t, {}), `${t} °`).toBe(saisonCapsulePourMeteo(t));
      }
    });

    it("déplace la frontière quand le réglage change", () => {
      // Production : 13 ° est à 1 ° de l'Automne (14) et à 3 ° du Printemps (16).
      expect(saisonCapsulePourMeteo(13)).toBe("Automne");
      // Réglage mesuré (Printemps 14, Automne 12) : 13 ° est à égale distance
      // des deux, et l'égalité se tranche vers la saison la plus chaude.
      const mesure = { Printemps: 14, Été: 24, Automne: 12, Hiver: 5 };
      expect(saisonCapsulePourMeteo(13, mesure)).toBe("Printemps");
    });

    it("accepte un réglage partiel, les saisons absentes gardant leur valeur", () => {
      // Seul l'Hiver bouge : 10 ° reste à 4 ° de l'Automne (14) mais n'est plus
      // qu'à 7 ° de l'Hiver descendu à 3 — l'Automne l'emporte toujours.
      expect(saisonCapsulePourMeteo(10, { Hiver: 3 })).toBe("Automne");
      // Descendre l'Automne seul suffit en revanche à donner 10 ° à l'Hiver :
      // 4 ° de l'Hiver (6) contre 5 ° de l'Automne ramené à 15.
      expect(saisonCapsulePourMeteo(10, { Automne: 15 })).toBe("Hiver");
    });
  });
});
