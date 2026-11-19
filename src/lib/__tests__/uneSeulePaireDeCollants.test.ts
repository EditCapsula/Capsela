import { describe, expect, it } from "vitest";
import { generateOutfit } from "../logic";
import { at, item } from "./fixtures";

/**
 * UNE SEULE PAIRE DE COLLANTS (19/11/2026, signalé sur l'accueil : « pourquoi on a deux collants ici ? ») : R-B19 pose une paire par le
 * froid sous une jupe ; le tirage facultatif des accessoires en ajoutait parfois une seconde.
 */
const T = "Automne, Hiver";
const pool = [
  item({ id: 1, category: "hauts", name: "T-shirt blanc", sous_type: "T-shirt", couleur_dominante: "Blanc", saison_capsule: T }),
  item({ id: 2, category: "jupes", name: "Jupe crayon noire", sous_type: "Crayon", couleur_dominante: "Noir", saison_capsule: T, meteo_min_temp: 15 }),
  item({ id: 3, category: "chaussures", name: "Ballerines noires", sous_type: "Ballerines", couleur_dominante: "Noir", saison_capsule: T }),
  item({ id: 4, category: "accessoires", name: "Collants opaques", sous_type: "Collants", couleur_dominante: "Noir", saison_capsule: T }),
  item({ id: 5, category: "accessoires", name: "Collants semi-opaques", sous_type: "Collants", couleur_dominante: "Noir", saison_capsule: T }),
  item({ id: 6, category: "accessoires", name: "Collants fins", sous_type: "Collants", couleur_dominante: "Noir", saison_capsule: T }),
];
const collants = new Set(pool.filter((p) => p.accessoireType === "Collants").map((p) => p.id));

describe("une seule paire de collants dans une tenue", () => {
  it("sur 300 tirages à 2° avec une jupe : jamais deux paires", () => {
    let avecJupe = 0;
    for (let i = 0; i < 300; i++) {
      const ids = generateOutfit(pool, at(2), "quotidien", "Présentiel", "Verre", [], "femme").ids;
      const n = ids.filter((id) => collants.has(id)).length;
      expect(n).toBeLessThanOrEqual(1);
      if (ids.includes(pool[1].id)) {
        avecJupe++;
        expect(n).toBe(1);
      }
    }
    expect(avecJupe).toBeGreaterThan(0);
  });
});
