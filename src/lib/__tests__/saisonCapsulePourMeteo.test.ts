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

  // Réglage du 21/09 : Printemps 14 · Été 24 · Automne 12 · Hiver 7.
  // Les quatre plages qui en découlent, aux frontières près.
  it("suit le thermomètre sur toute la plage", () => {
    expect(saisonCapsulePourMeteo(40)).toBe("Été");
    expect(saisonCapsulePourMeteo(30)).toBe("Été");
    expect(saisonCapsulePourMeteo(21)).toBe("Été");
    expect(saisonCapsulePourMeteo(18)).toBe("Printemps");
    expect(saisonCapsulePourMeteo(13)).toBe("Printemps");
    expect(saisonCapsulePourMeteo(11)).toBe("Automne");
    expect(saisonCapsulePourMeteo(9)).toBe("Hiver");
    expect(saisonCapsulePourMeteo(-5)).toBe("Hiver");
  });

  // Le titre précédent — « vers la saison la plus chaude » — était faux, et ne
  // passait que parce que les deux égalités d'alors allaient dans ce sens par
  // hasard. La règle réelle est l'ORDRE de CAPSULE_SEASONS : `reduce` ne
  // remplace que sur une distance STRICTEMENT plus petite, donc à égalité la
  // saison rencontrée la première l'emporte, chaude ou froide.
  //
  // Ce n'est pas un détail de rédaction : c'est cette règle qui rend l'Automne
  // inatteignable si on lui donne un jour la même valeur qu'au Printemps
  // (mesuré le 20/09 sur le bras « Aut14·Hiv5 », 63 pièces nues).
  it("tranche les égalités par l'ordre des saisons, pas par la température", () => {
    // 13 ° est à 1 ° du Printemps (14) comme de l'Automne (12).
    // L'ordre donne le Printemps — ici, c'est aussi la plus chaude.
    expect(saisonCapsulePourMeteo(13)).toBe("Printemps");
    // 19 ° est à 5 ° du Printemps (14) comme de l'Été (24).
    // L'ordre donne le Printemps — ici, c'est la plus FROIDE des deux.
    expect(saisonCapsulePourMeteo(19)).toBe("Printemps");
  });

  // La frontière Automne/Hiver tombe à 9,5°, et c'est délibéré : à 8,5° (ce que
  // donnerait Hiver 5) une journée à 9° recevrait un vivier d'automne, mesuré à
  // 50 pièces portées sous leur minimum pour cette seule température.
  it("garde 9 ° du côté de l'Hiver", () => {
    expect(saisonCapsulePourMeteo(9)).toBe("Hiver");
    expect(saisonCapsulePourMeteo(10)).toBe("Automne");
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
      // Réglage courant (Printemps 14, Automne 12) : 13 ° est à égale distance
      // des deux, et l'ordre des saisons donne le Printemps.
      expect(saisonCapsulePourMeteo(13)).toBe("Printemps");
      // Le réglage d'avant le 21/09 (Printemps 16, Automne 14) mettait 13 ° à
      // 1 ° de l'Automne et 3 ° du Printemps : la frontière était ailleurs.
      const avant = { Printemps: 16, Été: 24, Automne: 14, Hiver: 6 };
      expect(saisonCapsulePourMeteo(13, avant)).toBe("Automne");
    });

    it("rend 9 ° à l'Automne dès que l'Hiver descend à 5 — la falaise écartée le 21/09", () => {
      // Le réglage candidat qui avait été mesuré puis refusé : Hiver 5 met la
      // frontière à 8,5°, donc 9 ° bascule sur un vivier d'automne. C'est
      // exactement ce que le réglage retenu évite, et ce test le rend visible
      // plutôt que de le laisser dans un commentaire.
      expect(saisonCapsulePourMeteo(9)).toBe("Hiver");
      expect(saisonCapsulePourMeteo(9, { Hiver: 5 })).toBe("Automne");
    });

    it("rend l'Automne inatteignable s'il partage la valeur du Printemps", () => {
      // La contrainte structurelle démontrée le 20/09. À égalité, l'ordre de
      // CAPSULE_SEASONS donne toujours le Printemps : l'Automne ne peut alors
      // JAMAIS être servi comme vivier du jour, à aucune température.
      const collision = { Printemps: 14, Été: 24, Automne: 14, Hiver: 7 };
      const saisons = new Set<string>();
      for (let t = -30; t <= 55; t += 1) saisons.add(saisonCapsulePourMeteo(t, collision));
      expect([...saisons]).not.toContain("Automne");
    });

    it("accepte un réglage partiel, les saisons absentes gardant leur valeur", () => {
      // Seul l'Hiver bouge : 10 ° reste à 2 ° de l'Automne (12) et s'éloigne
      // de l'Hiver descendu à 3 — l'Automne l'emporte toujours.
      expect(saisonCapsulePourMeteo(10, { Hiver: 3 })).toBe("Automne");
      // Éloigner l'Automne seul suffit en revanche à donner 10 ° à l'Hiver :
      // 3 ° de l'Hiver (7) contre 5 ° de l'Automne repoussé à 15.
      expect(saisonCapsulePourMeteo(10, { Automne: 15 })).toBe("Hiver");
    });
  });
});
