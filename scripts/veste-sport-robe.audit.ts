import { it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { vetementDeSport } from "../src/lib/attributes";
import { OCCASIONS } from "../src/lib/data";
import { profilAudit } from "./harnaisAudit";
import { exposedStyleIds } from "../src/lib/profile";
import { enLigne, lireCsv } from "./catalogueCsv";

// R-B24 (01/11/2026) : une veste ou un manteau de sport sur une robe ou une combinaison. Mesuré avec et sans le levier
// `vesteDeSportSurRobe`, mêmes capsules femme, même exécution ; tenues complètes comptées des deux côtés.
// Usage : CATALOGUE_CSV=<export.csv> npx vitest run --config vitest.audit.config.mts scripts/veste-sport-robe.audit.ts
it("veste de sport sur une robe, capsules femme", () => {
  const pool = lireCsv(readFileSync(process.env.CATALOGUE_CSV!, "utf8")).map(enLigne).map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
  const t = { avant: 0, apres: 0, completesAvant: 0, completesApres: 0, tirages: 0 };
  for (const s of ["Printemps", "Été", "Automne", "Hiver"] as const)
    for (const st of exposedStyleIds("femme")) {
      const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [st] }), representativeWeatherFor(s), [], s, pool);
      const w = representativeWeatherFor(s);
      const fautif = (ids: number[]) => {
        const pieces = ids.map((id) => capsule.find((c) => c.id === id)).filter((x): x is CatalogItem => Boolean(x));
        return pieces.some((x) => x.cat === "robe" || x.cat === "combinaison") && pieces.some((x) => (x.cat === "veste" || x.cat === "manteau") && vetementDeSport(x));
      };
      for (const [occ] of OCCASIONS)
        for (let i = 0; i < 15; i++) {
          t.tirages++;
          const a = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", s, { vesteDeSportSurRobe: true });
          const b = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", s);
          if (fautif(a.ids)) t.avant++;
          if (fautif(b.ids)) t.apres++;
          if (!a.noCompleteOutfit) t.completesAvant++;
          if (!b.noCompleteOutfit) t.completesApres++;
        }
    }
  console.log(JSON.stringify(t));
});
