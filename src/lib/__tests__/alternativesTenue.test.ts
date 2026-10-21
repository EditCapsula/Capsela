import { describe, expect, it } from "vitest";
import { autresIdees } from "../alternativesTenue";
import { item } from "./fixtures";

/** LES AUTRES TENUES D'UN MOMENT PLANIFIÉ (20/10/2026) : de vraies autres tenues, et la fin dite quand il n'y en a plus. */

const robe = item({ id: 1, category: "robes", name: "Robe midi bordeaux", sous_type: "Robe" });
const robe2 = item({ id: 2, category: "robes", name: "Robe noire", sous_type: "Robe" });
const mocassins = item({ id: 3, category: "chaussures", name: "Mocassins", sous_type: "Mocassins" });
const escarpins = item({ id: 4, category: "chaussures", name: "Escarpins", sous_type: "Escarpins" });
const sac = item({ id: 5, category: "sac", name: "Sac cuir", sous_type: "Sac à main" });
const boucles = item({ id: 6, category: "bijou", name: "Boucles dorées", sous_type: "Boucles d'oreilles" });
const pool = [robe, robe2, mocassins, escarpins, sac, boucles];
const ids = (...p: { id: number }[]) => p.map((x) => x.id);
const suite = (tirages: number[][]) => {
  let i = 0;
  return () => tirages[i++ % tirages.length];
};

describe("autresIdees", () => {
  const actuelle = ids(robe, mocassins, sac);

  it("un accessoire de plus n'est pas une autre idée ; une autre robe l'est", () => {
    const r = autresIdees(suite([ids(robe, mocassins, sac, boucles), ids(robe2, mocassins, sac)]), [actuelle], pool, 3, 10);
    expect(r.idees).toEqual([ids(robe2, mocassins, sac)]);
  });

  it("moins de n idées trouvées : la série est épuisée", () => {
    expect(autresIdees(suite([ids(robe, mocassins, sac, boucles)]), [actuelle], pool, 3, 10)).toEqual({ idees: [], epuise: true });
  });

  it("jamais une idée déjà montrée dans une série précédente", () => {
    const deja = [actuelle, ids(robe2, mocassins, sac)];
    const r = autresIdees(suite([ids(robe2, mocassins, sac), ids(robe2, escarpins, sac, boucles)]), deja, pool, 3, 10);
    expect(r.idees).toEqual([]);
  });
});
