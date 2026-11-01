import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, pieceOrienteeParMorphologie, representativeWeatherFor, STRATEGIE_PRODUCTION } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { coupeOf } from "../src/lib/attributes";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey } from "../src/lib/types";
import { exposedStyleIds } from "../src/lib/profile";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";
import { enLigne, lireCsv } from "./catalogueCsv";

// LOT 5 — COUPES DU CATALOGUE COMPLÉTÉES : EFFET HORS PRÉFÉRENCES (31/10/2026). LECTURE SEULE, rien n'est écrit.
//
// La colonne `coupe` n'est pas lue que par les coupes préférées : direction morphologique (garmentEffect), rôle de superposition,
// règle d'équilibre haut / bas (R-B4, logic.ts), humeur « confortable ». AGENTS.md, point 8 : mesurer ce que l'enrichissement
// change pour TOUS les profils avant toute écriture. Même exécution, même pool, un seul levier : P (production) / P+C (coupes
// proposées appliquées aux seules pièces sans coupe). Stratégie : STRATEGIE_PRODUCTION, profils SANS préférence de silhouette.
//
// Usage : CREATIF_CSV=<export.csv> CREATIF_REVUE=docs/capsules/creatif/sql/revue.json COUPES_ENRICHIES=<coupes.json> \
//         npx vitest run --config vitest.audit.config.mts scripts/coupes-catalogue.audit.ts

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "date", "soiree", "sport", "cocooning", "voyage", "evenement_perso"];
const TIRAGES = 10;
const ETIQUETES = [504, 505, 506, 512, 521, 565, 574, 577, 609, 675, 709, 710, 750, 752, 807, 813, 817, 836, 846, 851, 852, 901, 905, 910, 911, 957, 973, 1063, 481, 520, 971, 972];
const SPORT_COMMUN = [491, 493, 494, 495, 522, 523, 524];
const TOUS_STYLES = "Minimaliste, Casual chic, Classique chic, Romantique, Bohème, Streetwear, Preppy, Glamour, Créatif";
const HAUT_BAS = new Set(["haut", "pull", "pantalon", "jean", "jupe", "short"]);
const empreinte = (c: CatalogItem[]) => c.map((x) => x.id).sort((a, b) => a - b).join(",");
const pct = (n: number, t: number) => (t ? (Math.round((n / t) * 1000) / 10).toFixed(1) : "0.0");

function pools(): [CatalogItem[], CatalogItem[]] {
  const { CREATIF_CSV: csv, CREATIF_REVUE: revue, COUPES_ENRICHIES: enr } = process.env;
  if (!csv || !revue || !enr) throw new Error("CREATIF_CSV, CREATIF_REVUE et COUPES_ENRICHIES sont requis (cf. en-tête).");
  const etiq = new Set(ETIQUETES);
  const commun = new Set(SPORT_COMMUN);
  const base = lireCsv(readFileSync(csv, "utf8"))
    .map(enLigne)
    .map((r) => (etiq.has(r.id) && !(r.styles ?? "").includes("Créatif") ? { ...r, styles: r.styles ? `${r.styles}, Créatif` : "Créatif" } : r))
    .map((r) => (commun.has(r.id) ? { ...r, styles: TOUS_STYLES } : r));
  const crees = (JSON.parse(readFileSync(revue, "utf8")).revue as Record<string, unknown>[]).map(
    (v, i) => ({ ...(v as unknown as VestiaireRow), id: 900000 + i, url_image: null, frozen: false }) as VestiaireRow
  );
  const coupes = JSON.parse(readFileSync(enr, "utf8")) as Record<string, string>;
  const vers = (rows: VestiaireRow[]) => rows.map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
  const tout = [...base, ...crees];
  return [vers(tout), vers(tout.map((r) => (!r.coupe?.trim() && r.name && coupes[r.name] ? { ...r, coupe: coupes[r.name] } : r)))];
}

describe("Lot 5 — coupes du catalogue complétées", () => {
  it("effet sur les profils sans préférence : capsules, direction morphologique, tenues", () => {
    const [P, PC] = pools();
    for (const g of ["femme", "homme"] as const) assertCatalogueStyles(P, exposedStyleIds(g));
    console.log(`\nP ${P.length} articles · P+C : ${PC.filter((x, i) => x.coupe !== P[i].coupe).length} coupes ajoutées`);
    const cas: ["femme" | "homme", string | null][] = [["femme", null], ["femme", "f_poire"], ["femme", "f_triangle_inverse"], ["femme", "f_sablier"], ["homme", null]];
    for (const [genre, morpho] of cas) {
      let changees = 0;
      let n = 0;
      const orient = [0, 0];
      const tenues = [0, 0];
      const desequilibre = [0, 0];
      const hautBas = [0, 0];
      for (const st of exposedStyleIds(genre))
        for (const s of SAISONS) {
          const w = representativeWeatherFor(s);
          const p = profilAudit({ gender: genre, styles: [st], morphology: morpho });
          const caps = [P, PC].map((pool) => computeDefaultCapsule(p, w, [], s, pool, STRATEGIE_PRODUCTION));
          n++;
          if (empreinte(caps[0]) !== empreinte(caps[1])) changees++;
          caps.forEach((c, k) => {
            orient[k] += c.filter((x) => pieceOrienteeParMorphologie(x, morpho)).length;
            for (const o of OCCASIONS)
              for (let t = 0; t < TIRAGES; t++) {
                const r = generateOutfitWithFallback(c, w, o, "Présentiel", "Verre", [], genre, s);
                if (r.noCompleteOutfit) continue;
                tenues[k]++;
                const ids = new Set(r.ids);
                const hb = c.filter((x) => ids.has(x.id) && HAUT_BAS.has(x.cat));
                if (hb.length === 2) {
                  hautBas[k]++;
                  const [a, b] = hb.map((x) => coupeOf(x));
                  if (a === b && a !== "regular") desequilibre[k]++;
                }
              }
          });
        }
      const tot = n * OCCASIONS.length * TIRAGES;
      console.log(
        `${genre} ${morpho ?? "sans silhouette"} : capsules modifiées ${changees}/${n} · pièces orientées par la silhouette ${(orient[0] / n).toFixed(1)} → ${(orient[1] / n).toFixed(1)} · tenues complètes ${pct(tenues[0], tot)} % → ${pct(tenues[1], tot)} % · haut + bas tous deux amples ou ajustés ${pct(desequilibre[0], hautBas[0])} % → ${pct(desequilibre[1], hautBas[1])} %`
      );
    }
  });
});
