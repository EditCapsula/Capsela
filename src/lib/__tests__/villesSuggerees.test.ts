import { describe, expect, it } from "vitest";
import { libelleVille, lireVillesSuggerees, type VilleSuggeree } from "../weather";

/**
 * L'autocomplétion de ville se juge sur sa lecture de réponse, pas sur
 * l'appel réseau : `lireVillesSuggerees` est la seule partie qui décide
 * quelque chose, et elle est pure.
 */
describe("lireVillesSuggerees", () => {
  it("distingue « pas d'autocomplétion » de « aucune ville »", () => {
    // Réponse d'une fonction Edge ANTÉRIEURE à mode=geo : elle ignore le
    // paramètre et rend la météo actuelle. Aucun champ `places`, donc null —
    // l'écran n'affiche alors rien plutôt qu'une liste vide trompeuse.
    expect(lireVillesSuggerees({ city: "Paris", temp: 18, label: "Nuageux" })).toBeNull();
    expect(lireVillesSuggerees(null)).toBeNull();
    expect(lireVillesSuggerees({ places: "pas un tableau" })).toBeNull();
    // Répondu, et rien de tel : un tableau vide, qui est une information.
    expect(lireVillesSuggerees({ places: [] })).toEqual([]);
  });

  it("garde les homonymes et supprime les vrais doublons", () => {
    const out = lireVillesSuggerees({
      places: [
        { name: "Paris", country: "FR", state: "", lat: 48.85, lon: 2.35 },
        { name: "Paris", country: "US", state: "Texas", lat: 33.66, lon: -95.55 },
        // Même ville, autre point : OpenWeather rend souvent ces doublons.
        { name: "Paris", country: "FR", state: "", lat: 48.86, lon: 2.34 },
      ],
    });
    expect(out?.map((v) => `${v.name}/${v.country}/${v.state}`)).toEqual(["Paris/FR/", "Paris/US/Texas"]);
  });

  it("écarte les entrées sans coordonnées — elles ne servent à rien ici", () => {
    const out = lireVillesSuggerees({
      places: [
        { name: "Parme", country: "IT", lat: 44.8, lon: 10.33 },
        { name: "Sans point", country: "FR" },
        { name: "", country: "FR", lat: 1, lon: 2 },
      ],
    });
    expect(out).toHaveLength(1);
    expect(out?.[0].name).toBe("Parme");
  });

  it("conserve l'ordre de pertinence rendu par OpenWeather", () => {
    const out = lireVillesSuggerees({
      places: [
        { name: "Paros", country: "GR", lat: 37.08, lon: 25.15 },
        { name: "Parme", country: "IT", lat: 44.8, lon: 10.33 },
      ],
    });
    expect(out?.map((v) => v.name)).toEqual(["Paros", "Parme"]);
  });
});

describe("libelleVille", () => {
  const v = (p: Partial<VilleSuggeree>): VilleSuggeree =>
    ({ name: "X", country: "FR", state: "", lat: 0, lon: 0, ...p });

  it("traduit le code pays et n'affiche la région que si elle existe", () => {
    expect(libelleVille(v({ name: "Paris", country: "FR" }))).toBe("Paris, France");
    expect(libelleVille(v({ name: "Paris", country: "US", state: "Texas" }))).toBe("Paris, Texas, États-Unis");
  });

  it("garde le code brut plutôt que de rendre une chaîne vide", () => {
    expect(libelleVille(v({ name: "Nulle part", country: "ZZ" }))).toContain("Nulle part");
  });
});
