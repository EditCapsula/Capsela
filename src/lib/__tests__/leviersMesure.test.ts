import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { generateOutfit } from "../logic";
import { MILD, item } from "./fixtures";
import type { CatalogItem } from "../catalog";

/**
 * LEVIERS DE MESURE — 31/08/2026.
 *
 * `generateOutfit` accepte trois leviers facultatifs (LeviersMesure) qui
 * n'existent que pour instruire un arbitrage : ils permettent à un audit de
 * comparer un avant et un après dans la MÊME exécution, sans dupliquer le
 * pipeline — même raison d'être que `capsuleSeason`.
 *
 * Ces tests verrouillent les deux propriétés qui rendent ce mécanisme sûr :
 *  1. non renseignés, les leviers sont INERTES ;
 *  2. aucun appelant de PRODUCTION ne les passe.
 *
 * Sans la seconde, le premier ne garantirait rien : un appelant qui les
 * passerait ferait entrer en production un comportement encore non arbitré.
 */

const SRC = join(__dirname, "..", "..");

/**
 * Pool sans aucun `haut` : le seul dessus possible est un pull.
 *
 * Les ids sont relus SUR LES PIÈCES MAPPÉES, jamais sur les lignes brutes —
 * rowToCatalogItem applique VESTIAIRE_ID_OFFSET (100 000), et comparer un id
 * de ligne à un id de catalogue produit un test qui passe pour une mauvaise
 * raison, ou échoue pour une raison qui n'existe pas.
 */
function poolSansHaut(): CatalogItem[] {
  return [
    item({ id: 1, category: "pull", name: "Pull col rond fin", sous_type: "Pull" }),
    item({ id: 2, category: "pull", name: "Pull col roulé fin", sous_type: "Col roulé" }),
    item({ id: 3, category: "pantalon", name: "Pantalon droit" }),
    item({ id: 4, category: "chaussures", name: "Mocassins", sous_type: "Mocassins" }),
  ];
}
const idsDesPulls = (pool: CatalogItem[]) => pool.filter((p) => p.cat === "pull").map((p) => p.id);

const tire = (pool: CatalogItem[], leviers?: Parameters<typeof generateOutfit>[10]) => {
  const vus = new Set<number>();
  for (let k = 0; k < 60; k++) {
    for (const id of generateOutfit(pool, MILD, "quotidien", "Présentiel", "Verre", [], "femme", undefined, undefined, null, leviers).ids) {
      vus.add(id);
    }
  }
  return vus;
};

describe("leviers de mesure — inertes par défaut", () => {
  // C'est la propriété centrale : le comportement livré ne change pas.
  it("sans levier, aucun pull n'est tiré comme haut principal", () => {
    const pool = poolSansHaut();
    const vus = tire(pool);
    expect(idsDesPulls(pool).filter((id) => vus.has(id))).toEqual([]);
  });

  it("un objet de leviers sans P1 est aussi inerte", () => {
    const pool = poolSansHaut();
    const vus = tire(pool, { superpositionMaillesFermees: true });
    expect(idsDesPulls(pool).filter((id) => vus.has(id))).toEqual([]);
  });

  // Contre-épreuve : le levier fait bien ce qu'il annonce, sinon la mesure
  // qu'il sert à produire ne vaudrait rien.
  it("avec pullCommeHautPrincipal, un pull devient haut principal", () => {
    const pool = poolSansHaut();
    const vus = tire(pool, { pullCommeHautPrincipal: "tous" });
    expect(idsDesPulls(pool).some((id) => vus.has(id))).toBe(true);
  });

  // Le mode "base" est la traduction technique de l'arbitrage éditorial du
  // 31/08/2026 (« un pull peut être le dessus principal, ou être porté sous
  // une veste ») : c'est exactement le rôle que `hasBaseGarment` exige sous
  // une veste au titre de R-B9. Un cardigan ne doit donc pas y entrer.
  it("en mode base, un pull calque ne devient jamais haut principal", () => {
    const pool: CatalogItem[] = [
      item({ id: 1, category: "pull", name: "Cardigan long", sous_type: "Cardigan", role_piece: "calque" }),
      item({ id: 2, category: "pantalon", name: "Pantalon droit" }),
      item({ id: 3, category: "chaussures", name: "Mocassins", sous_type: "Mocassins" }),
    ];
    const [cardigan] = idsDesPulls(pool);
    for (let k = 0; k < 120; k++) {
      const ids = generateOutfit(pool, MILD, "quotidien", "Présentiel", "Verre", [], "femme", undefined, undefined, null, {
        pullCommeHautPrincipal: "base",
      }).ids;
      expect(ids.includes(cardigan)).toBe(false);
    }
  });
});

describe("mailles fermées — deux d'entre elles ne se superposent jamais", () => {
  // Règle arbitrée le 31/08/2026, parallèle exact de R-B10 : elle vise les
  // SOUS-TYPES, pas la catégorie. Gilet et cardigan restent des calques
  // légitimes par-dessus une maille fermée.
  it("un pull ample ne se pose pas sur un pull fin", () => {
    const pool: CatalogItem[] = [
      item({ id: 1, category: "haut", name: "Chemise blanche", sous_type: "Chemise" }),
      item({ id: 2, category: "pull", name: "Pull fin", sous_type: "Pull", role_piece: "base" }),
      item({ id: 3, category: "pull", name: "Pull ample", sous_type: "Pull", role_piece: "calque" }),
      item({ id: 4, category: "pantalon", name: "Pantalon droit" }),
      item({ id: 5, category: "chaussures", name: "Mocassins", sous_type: "Mocassins" }),
    ];
    // Le pull fin n'étant tirable comme base qu'avec P1, on l'active pour
    // créer précisément la situation que la règle doit interdire.
    const [fin, ample] = idsDesPulls(pool);
    for (let k = 0; k < 120; k++) {
      const ids = generateOutfit(pool, MILD, "quotidien", "Présentiel", "Verre", [], "femme", undefined, undefined, null, {
        pullCommeHautPrincipal: "tous",
      }).ids;
      expect(ids.includes(fin) && ids.includes(ample)).toBe(false);
    }
  });

  it("le levier de mesure permet de retrouver le comportement d'avant la règle", () => {
    // Sans ce levier, impossible de chiffrer ce que la règle coûte : la
    // ligne de base n'existerait plus dans la même exécution.
    const leviers = { pullCommeHautPrincipal: true, superpositionMaillesFermees: true } as const;
    expect(leviers.superpositionMaillesFermees).toBe(true);
  });
});

describe("garde-fou — aucun appelant de production ne passe de levier", () => {
  function fichiersProduction(dir: string, acc: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "__tests__") fichiersProduction(p, acc);
      } else if (/\.tsx?$/.test(e.name)) acc.push(p);
    }
    return acc;
  }

  it("LeviersMesure n'est nommé nulle part hors de logic.ts", () => {
    const coupables = fichiersProduction(SRC)
      .filter((f) => !f.endsWith(join("lib", "logic.ts")))
      .filter((f) => /LeviersMesure|pullCommeHautPrincipal|pullNonSuperposable|superpositionMaillesFermees/.test(readFileSync(f, "utf8")));
    expect(coupables.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });
});
