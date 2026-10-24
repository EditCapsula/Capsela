import { describe, expect, it } from "vitest";
import { invite, nomPropre, occasionLue, OCCASIONS_EVENEMENT } from "../../../supabase/functions/_shared/lectureEvenement";
import { OCCASIONS_LISIBLES } from "../lectureEvenement";
import { occasionDeLEvenement, situationsDesEvenements, type EvenementValise } from "../evenementsValise";
import type { MeteoJour } from "../valise";

/** LA LECTURE DU NOM D'UN ÉVÉNEMENT « AUTRE » (22/10/2026). */

describe("lecture côté serveur (partie pure)", () => {
  it("le nom part propre : sans saut de ligne ni guillemet, borné à 40 caractères", () => {
    expect(nomPropre('  Gala "de"\ncharité  ')).toBe("Gala de charité");
    expect(nomPropre("x".repeat(80))).toHaveLength(40);
    expect(nomPropre(undefined)).toBe("");
  });

  it("seule une occasion de la liste est retenue ; un doute ou une réponse hors liste donne null", () => {
    expect(occasionLue({ occasion: "evenement_perso" })).toBe("evenement_perso");
    expect(occasionLue({ occasion: null })).toBeNull();
    expect(occasionLue({ occasion: "voyage" })).toBeNull();
    expect(occasionLue({ occasion: "robe longue" })).toBeNull();
    expect(occasionLue("n'importe quoi")).toBeNull();
  });

  it("l'invite nomme chaque occasion permise, et rien qu'elles", () => {
    const texte = invite("Brunch");
    for (const o of OCCASIONS_EVENEMENT) expect(texte).toContain(`${o} (`);
    expect(texte).not.toContain("voyage (");
  });

  it("la liste de l'app est le miroir exact de celle du serveur", () => {
    expect([...OCCASIONS_LISIBLES]).toEqual([...OCCASIONS_EVENEMENT]);
  });
});

describe("l'occasion lue ne vaut que pour un « Autre »", () => {
  const meteos: MeteoJour[] = [{ jour: "2026-10-25", temp: 20, label: "Ensoleillé", prevue: false }];
  it("un « Autre » nommé et lu reçoit l'occasion lue ; sans lecture, Quotidien", () => {
    const gala: EvenementValise = { id: "g", type: "quotidien", jour: "2026-10-25", moment: "soir", nom: "Gala", occasionLue: "evenement_perso" };
    expect(occasionDeLEvenement(gala)).toBe("evenement_perso");
    expect(situationsDesEvenements([gala], meteos)[0].occasion).toBe("evenement_perso");
    expect(occasionDeLEvenement({ type: "quotidien" })).toBe("quotidien");
  });
  it("un type explicite garde son occasion, même avec une lecture enregistrée", () => {
    expect(occasionDeLEvenement({ type: "diner", occasionLue: "evenement_perso" })).toBe("soiree");
  });
});
