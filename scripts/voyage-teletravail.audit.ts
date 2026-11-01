import { it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { fermetureMaille, vetementDeSport } from "../src/lib/attributes";
import { profilAudit } from "./harnaisAudit";
import { exposedStyleIds } from "../src/lib/profile";
import { enLigne, lireCsv } from "./catalogueCsv";

// R-S26 (Voyage : tenue de sport avant la pièce unique) et R-B12 étendue + R-S27 (Télétravail : un gilet, ni veste ni manteau),
// 01/11/2026. Mêmes capsules (2 genres × styles × 4 saisons), même exécution, avec et sans leviers.
// Usage : CATALOGUE_CSV=<export.csv> npx vitest run --config vitest.audit.config.mts scripts/voyage-teletravail.audit.ts
const N = 20;
it("voyage et télétravail", () => {
  const pool = lireCsv(readFileSync(process.env.CATALOGUE_CSV!, "utf8")).map(enLigne).map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
  const v = { tirages: 0, sportAvant: 0, sportApres: 0, completesAvant: 0, completesApres: 0 };
  const t = { tirages: 0, dessusAvant: 0, dessusApres: 0, giletApres: 0, completesAvant: 0, completesApres: 0 };
  for (const g of ["femme", "homme"] as const)
    for (const s of ["Printemps", "Été", "Automne", "Hiver"] as const)
      for (const st of exposedStyleIds(g)) {
        const capsule = computeDefaultCapsule(profilAudit({ gender: g, styles: [st] }), representativeWeatherFor(s), [], s, pool);
        const w = representativeWeatherFor(s);
        const pieces = (ids: number[]) => ids.map((id) => capsule.find((c) => c.id === id)).filter((x): x is CatalogItem => Boolean(x));
        for (let i = 0; i < N; i++) {
          v.tirages++;
          const a = generateOutfitWithFallback(capsule, w, "voyage", "Présentiel", "Verre", [], g, s, { sansSportEnVoyage: true });
          const b = generateOutfitWithFallback(capsule, w, "voyage", "Présentiel", "Verre", [], g, s);
          const sport = (ids: number[]) => pieces(ids).some((x) => (x.cat === "haut" || x.cat === "pantalon") && vetementDeSport(x));
          if (sport(a.ids)) v.sportAvant++;
          if (sport(b.ids)) v.sportApres++;
          if (!a.noCompleteOutfit) v.completesAvant++;
          if (!b.noCompleteOutfit) v.completesApres++;
          t.tirages++;
          const c = generateOutfitWithFallback(capsule, w, "travail_formel", "Télétravail", "Verre", [], g, s, { vesteEnTeletravail: true });
          const d = generateOutfitWithFallback(capsule, w, "travail_formel", "Télétravail", "Verre", [], g, s);
          const dessus = (ids: number[]) => pieces(ids).some((x) => x.cat === "veste" || x.cat === "manteau");
          if (dessus(c.ids)) t.dessusAvant++;
          if (dessus(d.ids)) t.dessusApres++;
          if (pieces(d.ids).some((x) => fermetureMaille(x) === "ouverte")) t.giletApres++;
          if (!c.noCompleteOutfit) t.completesAvant++;
          if (!d.noCompleteOutfit) t.completesApres++;
        }
      }
  console.log("VOYAGE", JSON.stringify(v));
  console.log("TELETRAVAIL", JSON.stringify(t));
});
