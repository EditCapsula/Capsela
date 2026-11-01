import { it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { chaussureHabillee } from "../src/lib/attributes";
import { profilAudit } from "./harnaisAudit";
import { exposedStyleIds } from "../src/lib/profile";
import { enLigne, lireCsv } from "./catalogueCsv";

// R-S25 (01/11/2026) : en soirée, une femme reçoit des chaussures habillées, sinon la paire est signalée manquante. Mesuré avec et sans
// le levier `sansChaussuresHabilleesEnSoiree`, sur les mêmes capsules, dans la même exécution ; liste les paires de chaque capsule.
// Usage : CATALOGUE_CSV=<export.csv> npx vitest run --config vitest.audit.config.mts scripts/chaussures-soiree.audit.ts
it("chaussures de soirée, capsules femme", () => {
  const pool = lireCsv(readFileSync(process.env.CATALOGUE_CSV!, "utf8")).map(enLigne).map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
  const manque: string[] = [];
  let nonHabAvant = 0, tot = 0;
  for (const s of ["Printemps", "Été", "Automne", "Hiver"] as const)
    for (const st of exposedStyleIds("femme")) {
      const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [st] }), representativeWeatherFor(s), [], s, pool);
      const w = representativeWeatherFor(s);
      let sansAvant = 0, sansApres = 0;
      for (let i = 0; i < 30; i++) {
        const a = generateOutfitWithFallback(capsule, w, "soiree", "Présentiel", "Verre", [], "femme", s, { sansChaussuresHabilleesEnSoiree: true });
        const b = generateOutfitWithFallback(capsule, w, "soiree", "Présentiel", "Verre", [], "femme", s);
        const shA = a.ids.map((id) => capsule.find((c) => c.id === id)!).find((x) => x?.cat === "chaussures");
        tot++; if (shA && !chaussureHabillee(shA)) nonHabAvant++;
        if (!shA) sansAvant++;
        if (!b.ids.some((id) => capsule.find((c) => c.id === id)?.cat === "chaussures")) sansApres++;
      }
      const hab = capsule.filter((c) => c.cat === "chaussures" && chaussureHabillee(c)).map((c) => c.name);
      if (sansApres) manque.push(`${s} ${st}: sans chaussures ${sansApres}/30 (avant ${sansAvant}/30) · paires habillées : ${hab.join(", ") || "aucune"}`);
    }
  for (const st of exposedStyleIds("femme")) for (const s of ["Automne", "Été"] as const) {
    const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [st] }), representativeWeatherFor(s), [], s, pool);
    console.log("CHAUSSURES", s, st, capsule.filter((c) => c.cat === "chaussures").map((c) => `${c.name} [${c.shoeType}|${c.subtype}|f${c.niveauFormalite}]`).join(" ; "));
  }
  console.log(`tirages avant avec chaussures non habillées : ${nonHabAvant}/${tot}`);
  console.log(manque.join("\n"));
});
