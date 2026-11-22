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
    expect(pistesLocales("Déjeuner chez les beaux-parents")).toEqual(["soiree", "quotidien"]);
    expect(pistesLocales("chez Paul")).toEqual([]);
    expect(pistesLocales("obsèques")).toEqual([]);
  });
});
