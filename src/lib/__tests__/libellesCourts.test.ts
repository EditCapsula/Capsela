import { describe, expect, it } from "vitest";
import { OCCASIONS, OCC_LABELS, OCC_SHORT, occasionShortLabel } from "@/lib/data";
import type { OccasionKey } from "@/lib/types";

// Reproduit les TROIS replis d'origine, tels qu'ils étaient avant unification.
const ANCIEN_PARTIAL: Partial<Record<OccasionKey, string>> = {
  quotidien: "Quotidien", travail_formel: "Travail", entretien: "Rendez-vous",
  date: "Date", soiree: "Sortie", festive: "Sortie festive", evenement_perso: "Cérémonie",
};
const ancienSelectors = (k: OccasionKey) => ANCIEN_PARTIAL[k] || OCC_LABELS[k].split(" / ")[0];
const ancienAddSheet = (k: OccasionKey) => ANCIEN_PARTIAL[k] || OCC_LABELS[k];
const ancienAddChip = (k: OccasionKey) => ANCIEN_PARTIAL[k] || k;

describe("équivalence des libellés courts", () => {
  const cles: OccasionKey[] = [...OCCASIONS.map(([k]) => k), "all"];
  it("selectors : sortie inchangée sur les onze clés", () => {
    for (const k of cles) expect(occasionShortLabel(k), k).toBe(ancienSelectors(k));
  });
  it("écran d'ajout : la feuille change seulement là où le repli était le libellé long", () => {
    const differents = cles.filter((k) => occasionShortLabel(k) !== ancienAddSheet(k));
    expect(differents.sort()).toEqual(["cocooning", "voyage"]);
    expect(occasionShortLabel("cocooning")).toBe("Cocooning");
    expect(ancienAddSheet("cocooning")).toBe("Cocooning / Maison");
  });
  it("écran d'ajout : le chip ne rend plus jamais une clé brute", () => {
    const brutes = cles.filter((k) => ancienAddChip(k) === k);
    expect(brutes.sort()).toEqual(["all", "cocooning", "sport", "voyage"]);
    for (const k of brutes) expect(occasionShortLabel(k), k).not.toBe(k);
  });
  it("aucun libellé court vide, et OCC_SHORT couvre les dix occasions", () => {
    for (const [k, label] of OCCASIONS) {
      expect(OCC_SHORT[k as Exclude<OccasionKey, "all">], label).toBeTruthy();
    }
  });
});
