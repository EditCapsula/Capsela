import { describe, expect, it } from "vitest";
import { lireOccasionLocale, normaliser } from "../occasionSaisie";

// L'OCCASION SAISIE LIBREMENT DANS PLANIFIER (22/11/2026) : la lecture locale, par mots-clés.
const o = (t: string) => lireOccasionLocale(t);

describe("lireOccasionLocale", () => {
  it("normalise accents, majuscules et ponctuation", () => {
    expect(normaliser("  Dîner d'AFFAIRES ! ")).toBe("diner d affaires");
  });
  it("les occasions courantes", () => {
    expect(o("Mariage de ma cousine")).toEqual({ occasion: "evenement_perso" });
    expect(o("Baptême")).toEqual({ occasion: "evenement_perso" });
    expect(o("Entretien d'embauche")).toEqual({ occasion: "travail_formel", sousChoix: "Entretien" });
    expect(o("journée en télétravail")).toEqual({ occasion: "travail_formel", sousChoix: "Télétravail" });
    expect(o("Réunion avec un client")).toEqual({ occasion: "travail_formel", sousChoix: "Présentiel" });
    expect(o("Anniversaire de Julie")).toEqual({ occasion: "soiree" });
    expect(o("afterwork")).toEqual({ occasion: "soiree" });
    expect(o("Pot de départ de Marc")).toEqual({ occasion: "soiree" });
    expect(o("cours de yoga")).toEqual({ occasion: "sport" });
    expect(o("Rando en forêt")).toEqual({ occasion: "sport" });
    expect(o("Train pour Lyon")).toEqual({ occasion: "voyage" });
    expect(o("brunch du dimanche")).toEqual({ occasion: "quotidien" });
    expect(o("journée cocooning")).toEqual({ occasion: "cocooning" });
  });
  it("la règle la plus spécifique d'abord", () => {
    expect(o("Dîner d'affaires")).toEqual({ occasion: "travail_formel", sousChoix: "Présentiel" });
    expect(o("dîner romantique")).toEqual({ occasion: "date", sousChoix: "Restaurant / date romantique" });
    expect(o("anniversaire de mariage au resto")).toEqual({ occasion: "date", sousChoix: "Restaurant / date romantique" });
    expect(o("premier rendez-vous, un verre")).toEqual({ occasion: "date", sousChoix: "Verre" });
  });
  it("rien de reconnu, ou rien saisi : null (aucune occasion inventée)", () => {
    expect(o("")).toBeNull();
    expect(o("   ")).toBeNull();
    expect(o("chez Paul")).toBeNull();
    expect(o("obsèques de mon oncle")).toBeNull();
  });
  it("un mot n'est reconnu qu'entier : « professeur » n'est pas « pro », « débarquement » n'est pas « bar »", () => {
    expect(o("rencontre parents professeurs")).toBeNull();
    expect(o("débarquement")).toBeNull();
  });
});

describe("pistesLocales (22/11/2026)", () => {
  it("des pistes quand le texte oriente sans trancher", async () => {
    const { pistesLocales } = await import("../occasionSaisie");
    expect(o("Signature notaire")).toBeNull();
    expect(pistesLocales("Signature notaire")).toEqual(["travail_formel", "quotidien"]);
    // La belle-famille : Quotidien d'abord depuis le 23/11/2026 (arbitré : la rencontre a le plus souvent lieu de jour).
    expect(pistesLocales("Déjeuner chez les beaux-parents")).toEqual(["quotidien", "soiree"]);
    expect(pistesLocales("chez Paul")).toEqual([]);
    expect(pistesLocales("obsèques")).toEqual([]);
  });
});

describe("la belle-famille (23/11/2026, capture « Rencontre belle-mère » non reconnue)", () => {
  it("une rencontre ne se tranche pas : pistes Quotidien puis Soirée, nuance Élégant", async () => {
    const { pistesLocales, lireNuances } = await import("../occasionSaisie");
    for (const t of ["Rencontre belle-mère", "Rencontrer mes beaux-parents", "Présentation à la belle-famille", "Première fois chez mon beau-père", "Rencontre avec la belle-sœur"]) {
      expect(o(t), t).toBeNull();
      expect(pistesLocales(t), t).toEqual(["quotidien", "soiree"]);
      expect(lireNuances(t).humeur, t).toBe("elegant");
    }
    // Les parents (sans alliance) : les pistes de la famille, et la même nuance pour une rencontre.
    expect(o("Rencontrer les parents de mon copain")).toBeNull();
    expect(pistesLocales("Rencontrer les parents de mon copain")).toEqual(["soiree", "quotidien"]);
    expect(lireNuances("Rencontrer les parents de mon copain").humeur).toBe("elegant");
  });
  it("sans rencontre, aucune nuance ; l'allure dite l'emporte ; les parents d'élèves restent du travail", async () => {
    const { lireNuances } = await import("../occasionSaisie");
    expect(o("Déjeuner chez ma belle-mère")).toEqual({ occasion: "quotidien" });
    expect(o("Dîner chez mon beau-frère")).toEqual({ occasion: "soiree" });
    expect(lireNuances("Rencontre décontractée avec mes beaux-parents").humeur).toBe("decontracte");
    expect(o("Réunion de présentation aux parents d'élèves")).toEqual({ occasion: "travail_formel", sousChoix: "Présentiel" });
    expect(o("Rencontre client")).toEqual({ occasion: "travail_formel", sousChoix: "Présentiel" });
  });
});

describe("plus intelligente (22/11/2026) : nuances, exemples", () => {
  it("les nuances explicites préremplissent la préférence ; rien n'est déduit de l'occasion seule", async () => {
    expect(o("Mariage chic")).toEqual({ occasion: "evenement_perso", humeur: "elegant" });
    expect(o("anniversaire décontracté")).toEqual({ occasion: "soiree", humeur: "decontracte" });
    expect(o("Mariage")).toEqual({ occasion: "evenement_perso" });
  });
  it("le cadre donne l'allure (23/11/2026) ; l'allure dite l'emporte", () => {
    expect(o("Mariage à la campagne")).toEqual({ occasion: "evenement_perso", humeur: "decontracte" });
    expect(o("Baptême au jardin")).toEqual({ occasion: "evenement_perso", humeur: "decontracte" });
    expect(o("anniversaire à la plage")).toEqual({ occasion: "soiree", humeur: "leger" });
    expect(o("Mariage chic à la campagne")).toEqual({ occasion: "evenement_perso", humeur: "elegant" });
  });
  it("le rooftop vaut pour la Soirée seulement", () => {
    expect(o("soirée sur un rooftop")).toEqual({ occasion: "soiree", typeLieu: "Bar / Rooftop" });
  });
  it("les exemples en tapant : un mot qui commence comme la saisie", async () => {
    const { exemplesPour, EXEMPLES_VEDETTES, EXEMPLES_OCCASION } = await import("../occasionSaisie");
    expect(exemplesPour("mari").map((e) => e.libelle)).toEqual(["Mariage"]);
    expect(exemplesPour("diner aff").map((e) => e.libelle)).toEqual(["Dîner d'affaires"]);
    expect(exemplesPour("d").length).toBe(0);
    expect(exemplesPour("ver").map((e) => e.libelle)).toEqual(["Verre en amoureux", "Verre en rooftop"]);
    for (const v of EXEMPLES_VEDETTES) expect(EXEMPLES_OCCASION.some((e) => e.libelle === v)).toBe(true);
  });
  it("chaque exemple saisi tel quel est lu comme son occasion, ou la propose en piste (la liste et les mots-clés disent la même chose)", async () => {
    const { EXEMPLES_OCCASION, pistesLocales } = await import("../occasionSaisie");
    const lu = (l: string, occ: string) => {
      const r = lireOccasionLocale(l);
      return r ? r.occasion === occ : pistesLocales(l).includes(occ as never);
    };
    const ecarts = EXEMPLES_OCCASION.filter((e) => !lu(e.libelle, e.occasion)).map((e) => e.libelle);
    expect(ecarts).toEqual([]);
  });
});

describe("titrePourSaisie (23/11/2026)", () => {
  it("un exemple prend son article ; un texte libre reste tel quel", async () => {
    const { titrePourSaisie, EXEMPLES_OCCASION } = await import("../occasionSaisie");
    expect(titrePourSaisie("Entretien d'embauche")).toBe("ton entretien d'embauche");
    expect(titrePourSaisie("afterwork")).toBe("l'afterwork");
    expect(titrePourSaisie("Mariage")).toBe("le mariage");
    expect(titrePourSaisie("Mariage à la campagne.")).toBe("mariage à la campagne");
    for (const e of EXEMPLES_OCCASION) expect(e.titre.length).toBeGreaterThan(e.libelle.length);
  });
});
