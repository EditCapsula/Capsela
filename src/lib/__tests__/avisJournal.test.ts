import { describe, expect, it } from "vitest";
import { estTableAbsente, ligneVersAvis } from "../avisJournal";

const resultat = {
  overallAssessment: "Une tenue équilibrée.",
  strengths: ["Les couleurs s'accordent."],
  mainAdvice: "Ajoute une ceinture fine.",
  suggestions: ["Essaie des mocassins."],
};

const ligne = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  created_at: "2026-09-25T10:00:00Z",
  analyse_id: "an-1",
  resultat,
  pieces_dressing: [{ id: 12, lien: "Pour le conseil" }],
  photo_path: "u1/p.jpg",
  ...over,
});

describe("ligneVersAvis — lecture d'un avis enregistré", () => {
  it("ligne complète : avis, pièces, photo et date", () => {
    const a = ligneVersAvis(ligne(), "https://signee");
    expect(a).toEqual({
      id: "a1",
      creeLe: Date.parse("2026-09-25T10:00:00Z"),
      analyseId: "an-1",
      avis: resultat,
      pieces: [{ id: 12, lien: "Pour le conseil" }],
      photoPath: "u1/p.jpg",
      photoUrl: "https://signee",
    });
  });

  it("résultat mal formé : ignoré, jamais affiché tel quel", () => {
    expect(ligneVersAvis(ligne({ resultat: { overallAssessment: "x" } }))).toBeNull();
    expect(ligneVersAvis(ligne({ resultat: null }))).toBeNull();
  });

  it("pièces mal formées filtrées, 3 au plus ; sans photo : chemin null", () => {
    const pieces = [{ id: "12", lien: "x" }, { id: 1, lien: "a" }, { id: 2, lien: "b" }, { id: 3, lien: "c" }, { id: 4, lien: "d" }];
    const a = ligneVersAvis(ligne({ pieces_dressing: pieces, photo_path: null }));
    expect(a?.pieces.map((p) => p.id)).toEqual([1, 2, 3]);
    expect(a?.photoPath).toBeNull();
    expect(a?.photoUrl).toBeNull();
  });

  it("date illisible : 0, pas d'exception", () => {
    expect(ligneVersAvis(ligne({ created_at: "n'importe quoi" }))?.creeLe).toBe(0);
  });
});

describe("estTableAbsente — migration 0036 non exécutée", () => {
  it("reconnaît les codes Postgres et PostgREST de relation absente", () => {
    expect(estTableAbsente({ code: "42P01" })).toBe(true);
    expect(estTableAbsente({ code: "PGRST205" })).toBe(true);
  });

  it("une autre erreur reste une vraie panne", () => {
    expect(estTableAbsente({ code: "42501" })).toBe(false);
    expect(estTableAbsente(null)).toBe(false);
    expect(estTableAbsente(undefined)).toBe(false);
  });
});
