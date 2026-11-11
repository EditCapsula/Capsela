import { describe, expect, it } from "vitest";
import { PAYS } from "../paysData";
import { libelleVille, paysDeLaSaisie } from "../weather";

// UN PAYS SAISI À LA PLACE D'UNE VILLE (14/10/2026 ; liste de l'app depuis le 11/11/2026, paysData.ts).
describe("paysDeLaSaisie", () => {
  it("reconnaît un pays par son nom français ou anglais, sans accent ni casse", () => {
    expect(paysDeLaSaisie("Thaïlande")[0]).toMatchObject({ code: "TH", capitale: "Bangkok" });
    expect(paysDeLaSaisie("thailande")[0].code).toBe("TH");
    expect(paysDeLaSaisie("THAILAND")[0].code).toBe("TH");
    expect(paysDeLaSaisie("Inde")[0]).toMatchObject({ code: "IN", capitale: "New Delhi" });
  });
  it("le nom exact passe devant ceux qui commencent pareil : « Niger » avant le Nigéria", () => {
    const r = paysDeLaSaisie("Niger").map((p) => p.code);
    expect(r[0]).toBe("NE");
    expect(r).toContain("NG");
  });
  it("dès trois lettres, les pays qui commencent par la saisie", () => {
    const r = paysDeLaSaisie("Ind").map((p) => p.nom);
    expect(r).toEqual(expect.arrayContaining(["Inde", "Indonésie"]));
  });
  it("rien sous deux lettres, rien pour une ville", () => {
    expect(paysDeLaSaisie("I")).toEqual([]);
    expect(paysDeLaSaisie("Lisbonne")).toEqual([]);
  });
  it("chaque pays de la liste a un code, un nom et une capitale", () => {
    expect(PAYS.length).toBeGreaterThan(200);
    expect(PAYS.every((p) => /^[A-Z]{2}$/.test(p.code) && p.nom && p.capitale)).toBe(true);
  });
  it("l'affichage dit que c'est la capitale", () => {
    expect(libelleVille({ name: "Bangkok", country: "TH", state: "", lat: 13.75, lon: 100.51, capitaleDe: "Thaïlande" })).toBe("Bangkok, Thaïlande (capitale)");
  });
});
