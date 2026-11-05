import { it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor, sontJumelles, STRATEGIE_AVANT_JUMELLES, STRATEGIE_PRODUCTION } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { profilAudit, stylesAudit } from "./harnaisAudit";
import { enLigne, lireCsv } from "./catalogueCsv";

// LES PIÈCES JUMELLES EN CAPSULE — AVANT / APRÈS, LECTURE SEULE (05/11/2026).
//
// Signalé : « dans cette capsule j'ai deux tee-shirts blancs » (448 « T-shirt basique blanc », 451 « T-shirt coton col rond »).
// Mesure, dans la même exécution et sur le même export du catalogue (CATALOGUE_CSV), la production sans la règle
// (STRATEGIE_AVANT_JUMELLES) et avec (STRATEGIE_PRODUCTION), pour chaque genre × style × saison : les pièces jumelles d'une pièce
// déjà présente, la taille de la capsule, et ce qui entre ou sort. Aucune écriture.

const jumellesEnTrop = (c: CatalogItem[]) => c.filter((p, i) => c.slice(0, i).some((q) => sontJumelles(p, q)));

it("pièces jumelles, avant / après", () => {
  const brut = lireCsv(readFileSync(process.env.CATALOGUE_CSV!, "utf8")).filter((r) => String(r.frozen) !== "true");
  const pool = brut.map(enLigne).map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
  const total = { capsules: 0, avecJumellesAvant: 0, avecJumellesApres: 0, jumellesAvant: 0, jumellesApres: 0, tailleAvant: 0, tailleApres: 0, changees: 0 };
  const lignes: string[] = [];
  for (const gender of ["femme", "homme"] as const)
    for (const s of CAPSULE_SEASONS)
      for (const st of stylesAudit(gender)) {
        const prof = profilAudit({ gender, styles: [st] });
        const w = representativeWeatherFor(s);
        const avant = computeDefaultCapsule(prof, w, [], s, pool, STRATEGIE_AVANT_JUMELLES);
        const apres = computeDefaultCapsule(prof, w, [], s, pool, STRATEGIE_PRODUCTION);
        const ja = jumellesEnTrop(avant);
        const jp = jumellesEnTrop(apres);
        total.capsules++;
        total.jumellesAvant += ja.length;
        total.jumellesApres += jp.length;
        if (ja.length) total.avecJumellesAvant++;
        if (jp.length) total.avecJumellesApres++;
        total.tailleAvant += avant.length;
        total.tailleApres += apres.length;
        const sorties = avant.filter((x) => !apres.some((y) => y.id === x.id));
        const entrees = apres.filter((x) => !avant.some((y) => y.id === x.id));
        if (sorties.length || entrees.length) total.changees++;
        const nom = (x: CatalogItem) => `${x.name} (${x.subtype ?? "?"}, ${x.color})`;
        lignes.push(
          `${gender.padEnd(6)} ${s.padEnd(9)} ${st.padEnd(14)} taille ${avant.length}→${apres.length} · jumelles ${ja.length}→${jp.length}` +
            (sorties.length ? `\n    sort : ${sorties.map(nom).join(" ; ")}` : "") +
            (entrees.length ? `\n    entre : ${entrees.map(nom).join(" ; ")}` : "") +
            (jp.length ? `\n    restent jumelles : ${jp.map(nom).join(" ; ")}` : "")
        );
      }
  console.log(lignes.join("\n"));
  console.log(JSON.stringify(total, null, 1));
});
