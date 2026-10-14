import { describe, expect, it } from "vitest";
import { libelleVille, lirePaysCommeCapitale } from "../weather";

const thailande = [{ name: { common: "Thailand", official: "Kingdom of Thailand" }, translations: { fra: { common: "Thaïlande", official: "Royaume de Thaïlande" } }, capital: ["Bangkok"], capitalInfo: { latlng: [13.75, 100.51] }, cca2: "TH" }];

describe("un pays saisi à la place d'une ville (14/10/2026)", () => {
  it("rend sa capitale, avec ses coordonnées", () => {
    const r = lirePaysCommeCapitale(thailande, "Thaïlande");
    expect(r).toEqual([{ name: "Bangkok", country: "TH", state: "", lat: 13.75, lon: 100.51, capitaleDe: "Thaïlande" }]);
  });
  it("accepte la saisie sans accent ni casse, et le nom anglais", () => {
    expect(lirePaysCommeCapitale(thailande, "thailande")).toHaveLength(1);
    expect(lirePaysCommeCapitale(thailande, "THAILAND")).toHaveLength(1);
  });
  it("ne retient qu'un nom exact : « Niger » ne rend pas le Nigéria", () => {
    const nigeria = [{ name: { common: "Nigeria" }, translations: { fra: { common: "Nigéria" } }, capital: ["Abuja"], capitalInfo: { latlng: [9.08, 7.4] }, cca2: "NG" }];
    expect(lirePaysCommeCapitale(nigeria, "Niger")).toEqual([]);
  });
  it("sans capitale ou sans coordonnées, rien — jamais une position inventée", () => {
    expect(lirePaysCommeCapitale([{ ...thailande[0], capitalInfo: {} }], "Thaïlande")).toEqual([]);
    expect(lirePaysCommeCapitale([{ ...thailande[0], capital: [] }], "Thaïlande")).toEqual([]);
    expect(lirePaysCommeCapitale({ status: 404 }, "Thaïlande")).toEqual([]);
  });
  it("l'affichage dit que c'est la capitale", () => {
    const [v] = lirePaysCommeCapitale(thailande, "Thaïlande");
    expect(libelleVille(v)).toBe("Bangkok, Thaïlande (capitale)");
  });
});
