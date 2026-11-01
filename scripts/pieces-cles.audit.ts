import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { piecesCles, proprePourSaison } from "../src/lib/capsuleEcran";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item } from "../src/lib/types";
import { exposedStyleIds } from "../src/lib/profile";
import { profilAudit } from "./harnaisAudit";
import { enLigne, lireCsv } from "./catalogueCsv";

// PIÈCES CLÉS (01/11/2026) : la règle d'avant et les quatre règles validées, sur les mêmes capsules, dans la même exécution.
// Usage : CATALOGUE_CSV=<export.csv> npx vitest run --config vitest.audit.config.mts scripts/pieces-cles.audit.ts

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const FAMILLES: CategoryKey[][] = [["manteau", "veste"], ["pull", "haut"], ["chaussures"], ["pantalon", "jean", "jupe", "robe"]];

/** La règle du 01/10/2026, reproduite telle quelle pour la comparaison. */
function avant(capsule: Item[], saison: CapsuleSeason): Item[] {
  const out: Item[] = [];
  const froid = saison === "Automne" || saison === "Hiver";
  for (const f of FAMILLES) {
    if (out.length >= 3) break;
    let c = capsule.filter((it) => f.includes(it.cat));
    if (froid && f.includes("haut")) c = c.filter((it) => it.cat === "pull" || it.manches === "longues");
    const p = c.filter((it) => proprePourSaison(it, saison));
    if (p.length) c = p;
    const choix = c.find((it) => it.estBasiqueCapsule) ?? c[0];
    if (choix) out.push(choix);
  }
  return out;
}

describe("pièces clés", () => {
  it("avant / après, tous styles, quatre saisons, deux genres", () => {
    const csv = process.env.CATALOGUE_CSV;
    if (!csv) throw new Error("CATALOGUE_CSV requis.");
    const pool = lireCsv(readFileSync(csv, "utf8")).map(enLigne).map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
    let changees = 0, total = 0, moinsDeTrois = 0, moinsDeTroisAvant = 0;
    for (const g of ["femme", "homme"] as const)
      for (const s of SAISONS) {
        const lignes: string[] = [];
        for (const st of exposedStyleIds(g)) {
          const capsule = computeDefaultCapsule(profilAudit({ gender: g, styles: [st] }), representativeWeatherFor(s), [], s, pool);
          const a = avant(capsule, s).map((x) => x.name);
          const b = piecesCles(capsule, 3, s).map((x) => x.name);
          total++;
          if (a.join() !== b.join()) changees++;
          if (b.length < 3) moinsDeTrois++;
          if (a.length < 3) moinsDeTroisAvant++;
          lignes.push(`   ${st.padEnd(14)} avant : ${a.join(" · ")}\n${" ".repeat(18)}après : ${b.join(" · ")}`);
        }
        console.log(`\n${g} — ${s}\n${lignes.join("\n")}`);
      }
    console.log(`\nCapsules ${total} · pièces clés modifiées ${changees} · moins de 3 pièces clés : avant ${moinsDeTroisAvant}, après ${moinsDeTrois}`);
  });
});
