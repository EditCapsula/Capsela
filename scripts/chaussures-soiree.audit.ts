import { it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor, STRATEGIE_AVANT_PAIRE_HABILLEE, STRATEGIE_PRODUCTION } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { chaussureHabillee } from "../src/lib/attributes";
import { profilAudit } from "./harnaisAudit";
import { exposedStyleIds } from "../src/lib/profile";
import { enLigne, lireCsv } from "./catalogueCsv";

// R-S25 et la paire habillée garantie (01/11/2026). Mesuré dans la même exécution, sur les mêmes capsules femme (9 styles × 4 saisons) :
//   · avant : la sélection d'avant (STRATEGIE_AVANT_PAIRE_HABILLEE) et le tirage sans R-S25 ;
//   · R-S25 seule : la sélection d'avant, le tirage avec R-S25 ;
//   · les deux : la production.
// Usage : CATALOGUE_CSV=<export.csv> npx vitest run --config vitest.audit.config.mts scripts/chaussures-soiree.audit.ts

const N = 30;
it("chaussures de soirée, capsules femme", () => {
  const pool = lireCsv(readFileSync(process.env.CATALOGUE_CSV!, "utf8")).map(enLigne).map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
  const total = { avantNonHabillees: 0, rs25SansPaire: 0, deuxSansPaire: 0, tirages: 0, capsulesSansPaireAvant: 0, capsulesSansPaireApres: 0, tailleAvant: 0, tailleApres: 0 };
  const lignes: string[] = [];
  for (const s of ["Printemps", "Été", "Automne", "Hiver"] as const)
    for (const st of exposedStyleIds("femme")) {
      const prof = profilAudit({ gender: "femme", styles: [st] });
      const w = representativeWeatherFor(s);
      const avant = computeDefaultCapsule(prof, w, [], s, pool, STRATEGIE_AVANT_PAIRE_HABILLEE);
      const apres = computeDefaultCapsule(prof, w, [], s, pool, STRATEGIE_PRODUCTION);
      const chaussure = (caps: CatalogItem[], ids: number[]) => ids.map((id) => caps.find((c) => c.id === id)).find((x) => x?.cat === "chaussures");
      let sansIci = 0;
      for (let i = 0; i < N; i++) {
        total.tirages++;
        const a = chaussure(avant, generateOutfitWithFallback(avant, w, "soiree", "Présentiel", "Verre", [], "femme", s, { sansChaussuresHabilleesEnSoiree: true }).ids);
        if (!a || !chaussureHabillee(a)) total.avantNonHabillees++;
        if (!chaussure(avant, generateOutfitWithFallback(avant, w, "soiree", "Présentiel", "Verre", [], "femme", s).ids)) total.rs25SansPaire++;
        if (!chaussure(apres, generateOutfitWithFallback(apres, w, "soiree", "Présentiel", "Verre", [], "femme", s).ids)) {
          total.deuxSansPaire++;
          sansIci++;
        }
      }
      const habAvant = avant.filter(chaussureHabillee).map((c) => c.name);
      const habApres = apres.filter(chaussureHabillee).map((c) => `${c.name} [f${c.niveauFormalite ?? "?"}, ${c.occasion?.join("/") ?? "sans occasion"}]`);
      if (!habAvant.length) total.capsulesSansPaireAvant++;
      if (!habApres.length) total.capsulesSansPaireApres++;
      total.tailleAvant += avant.length;
      total.tailleApres += apres.length;
      const retirees = avant.filter((x) => !apres.some((y) => y.id === x.id)).map((x) => x.name);
      lignes.push(`${s.padEnd(9)} ${st.padEnd(14)} ${habApres.join(", ") || "AUCUNE"} · soirées sans paire ${sansIci}/${N}${retirees.length ? `   (retirée : ${retirees.join(", ")})` : ""}`);
    }
  console.log(lignes.join("\n"));
  console.log(JSON.stringify(total, null, 1));
});
