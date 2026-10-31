import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { enLigne, lireCsv } from "./catalogueCsv";
import { computeDefaultCapsule, representativeWeatherFor, STRATEGIE_PRODUCTION, type SelectionStrategy } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { formalityOf } from "../src/lib/attributes";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey } from "../src/lib/types";
import { exposedStyleIds, type Profile, type StyleId } from "../src/lib/profile";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// STYLE CRÉATIF, ÉTAPE 2 — MESURE AVANT TOUTE ÉCRITURE EN PRODUCTION (30/10/2026, docs/capsules/creatif/plan-integration-creatif.md § 6).
// LECTURE SEULE : le catalogue vient de l'export CSV de vestiaire_universel (Supabase n'est pas joignable depuis le conteneur), et le
// SQL de docs/capsules/creatif/sql/ est SIMULÉ en mémoire, jamais lancé.
//
// Règle d'audit (AGENTS.md) : trois états du catalogue mesurés dans la MÊME exécution, sur le MÊME pool, seul le levier variant —
//   L0  le catalogue tel qu'exporté ;
//   L1  + 01-etiqueter-existants.sql (équivalents exacts et pièces transversales étiquetés « Créatif ») ;
//   L2  + 02-creer-pieces.sql (pièces de la référence créées) ;
//   L2s L2 sans les pièces créées de formalité 0 (sport) — le bloc Sport d'une capsule n'est jamais filtré par style (capsule.ts,
//       arbitrage du 24/08/2026) : une pièce de sport créée pour Créatif entre dans les capsules de TOUS les styles.
//
// Usage : CREATIF_CSV=<export.csv> CREATIF_REVUE=docs/capsules/creatif/sql/revue.json \
//         npx vitest run --config vitest.audit.config.mts scripts/creatif.audit.ts

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
/** Mesures du 30/10/2026, faites avec le bloc Sport d'alors (« commun ») : explicite pour rester reproductibles (production « etiquette » depuis le 31/10/2026). */
const REGLE_DU_30_10: SelectionStrategy = { ...STRATEGIE_PRODUCTION, sportParStyle: "commun" };
const OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "date", "soiree", "sport", "cocooning", "voyage", "evenement_perso"];
const TIRAGES = 20;
/** 01-etiqueter-existants.sql, blocs 1.a et 1.b (le bloc 1.c, unisexes, reste commenté : décision en attente). */
const ETIQUETES = [504, 505, 506, 512, 521, 565, 574, 577, 609, 675, 709, 710, 750, 752, 807, 813, 817, 836, 846, 851, 852, 901, 905, 910, 911, 957, 973, 1063, 481, 520, 971, 972];

const versPool = (rows: VestiaireRow[]) => rows.map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
// Le harnais d'audit (scripts/harnaisAudit.ts) : un style vide est refusé, l'absence de style se demande par `null`.
const profil = (gender: "femme" | "homme", styles: StyleId[]): Profile => profilAudit({ gender, styles: styles.length ? styles : null });
const empreinte = (c: CatalogItem[]) => c.map((it) => it.id).sort((a, b) => a - b).join(",");
const estCreatif = (it: CatalogItem) => (it.styleTags ?? []).includes("Créatif");
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0) + " %";

describe("Style Créatif — mesure L0 / L1 / L2", () => {
  it("capsules, tenues et préservation des autres styles", () => {
    const csv = process.env.CREATIF_CSV;
    const revue = process.env.CREATIF_REVUE;
    if (!csv || !revue) throw new Error("CREATIF_CSV et CREATIF_REVUE sont requis (cf. en-tête).");
    const base = lireCsv(readFileSync(csv, "utf8")).map(enLigne);
    const etiq = new Set(ETIQUETES);
    const ajoutTag = (r: VestiaireRow): VestiaireRow =>
      etiq.has(r.id) && !(r.styles ?? "").includes("Créatif") ? { ...r, styles: r.styles ? `${r.styles}, Créatif` : "Créatif" } : r;
    const crees: VestiaireRow[] = (JSON.parse(readFileSync(revue, "utf8")).revue as Record<string, unknown>[]).map(
      (v, i) => ({ ...(v as unknown as VestiaireRow), id: 900000 + i, url_image: null, frozen: false }) as VestiaireRow
    );
    const idsCrees = new Set(versPool(crees).map((it) => it.id));
    const etats: [string, CatalogItem[]][] = [
      ["L0", versPool(base)],
      ["L1", versPool(base.map(ajoutTag))],
      ["L2", versPool([...base.map(ajoutTag), ...crees])],
      ["L2s", versPool([...base.map(ajoutTag), ...crees]).filter((it) => !idsCrees.has(it.id) || formalityOf(it) !== 0)],
    ];
    // Garde-fou du harnais : en L1 et au-delà, le libellé « Créatif » et ceux des autres styles existent bien dans le pool. En L0, son
    // absence EST la mesure (le style y est ignoré) : pas de garde-fou sur Créatif à ce niveau.
    for (const [, pool] of etats.slice(1)) for (const g of ["femme", "homme"] as const) assertCatalogueStyles(pool, exposedStyleIds(g));
    console.log(`\nPool : L0 ${etats[0][1].length} · L1 ${etats[1][1].length} · L2 ${etats[2][1].length} · L2s ${etats[3][1].length} articles ; ${crees.length} créés simulés.`);

    for (const genre of ["femme", "homme"] as const) {
      console.log(`\n══ ${genre.toUpperCase()} ══`);
      for (const saison of SAISONS) {
        const w = representativeWeatherFor(saison);
        const lignes: string[] = [];
        for (const [nom, pool] of etats) {
          const sansStyle = computeDefaultCapsule(profil(genre, []), w, [], saison, pool, REGLE_DU_30_10);
          const capsule = computeDefaultCapsule(profil(genre, ["creatif"]), w, [], saison, pool, REGLE_DU_30_10);
          const actif = empreinte(capsule) !== empreinte(sansStyle);
          const creatifs = capsule.filter(estCreatif).length;
          let completes = 0;
          let declassees = 0;
          let partCreatif = 0;
          let pieces = 0;
          for (const occ of OCCASIONS) {
            for (let t = 0; t < TIRAGES; t++) {
              const r = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], genre, saison);
              if (r.noCompleteOutfit) continue;
              completes++;
              if (r.formalityDowngraded) declassees++;
              const ids = new Set(r.ids);
              const portees = capsule.filter((it) => ids.has(it.id));
              pieces += portees.length;
              partCreatif += portees.filter(estCreatif).length;
            }
          }
          const tot = OCCASIONS.length * TIRAGES;
          lignes.push(
            `  ${nom}  style ${actif ? "ACTIF  " : "IGNORÉ "} capsule ${String(capsule.length).padStart(3)} pièces dont Créatif ${String(creatifs).padStart(3)} (${pct(creatifs, capsule.length)}) · tenues complètes ${pct(completes, tot)} · déclassées ${pct(declassees, completes)} · pièces Créatif portées ${pct(partCreatif, pieces)}`
          );
        }
        console.log(`${saison}\n${lignes.join("\n")}`);
        // Par occasion, en L2s : la tenue s'obtient-elle, et avec combien de pièces Créatif ?
        const pool2 = etats[3][1];
        const capsule2 = computeDefaultCapsule(profil(genre, ["creatif"]), w, [], saison, pool2, REGLE_DU_30_10);
        const parOcc = OCCASIONS.map((occ) => {
          let ok = 0;
          let cr = 0;
          let n = 0;
          for (let t = 0; t < TIRAGES; t++) {
            const r = generateOutfitWithFallback(capsule2, w, occ, "Présentiel", "Verre", [], genre, saison);
            if (r.noCompleteOutfit) continue;
            ok++;
            const ids = new Set(r.ids);
            const portees = capsule2.filter((it) => ids.has(it.id));
            n += portees.length;
            cr += portees.filter(estCreatif).length;
          }
          return `${occ} ${pct(ok, TIRAGES)}/${pct(cr, n)}`;
        });
        console.log(`  L2s par occasion (tenue complète / part Créatif) : ${parOcc.join(" · ")}`);
      }

      // Contrôle du harnais : deux calculs sur le MÊME pool donnent-ils la même capsule ? Sinon, une différence L0/L2 ne prouve rien.
      {
        const w = representativeWeatherFor("Printemps");
        const a = empreinte(computeDefaultCapsule(profil(genre, ["minimaliste"]), w, [], "Printemps", etats[0][1], REGLE_DU_30_10));
        const b = empreinte(computeDefaultCapsule(profil(genre, ["minimaliste"]), w, [], "Printemps", etats[0][1], REGLE_DU_30_10));
        console.log(`\nContrôle ${genre} — même pool, deux calculs : ${a === b ? "identiques (déterministe)" : "DIFFÉRENTS (non déterministe)"}`);
      }
      // Préservation : la capsule de chaque AUTRE style est-elle identique en L0 et en L2 ?
      const autres = exposedStyleIds(genre).filter((id) => id !== "creatif");
      for (const [nom, pool] of etats.slice(1)) {
        const changees: string[] = [];
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          for (const id of autres) {
            const a = empreinte(computeDefaultCapsule(profil(genre, [id]), w, [], saison, etats[0][1], REGLE_DU_30_10));
            const b = empreinte(computeDefaultCapsule(profil(genre, [id]), w, [], saison, pool, REGLE_DU_30_10));
            if (a !== b) changees.push(`${id}/${saison}`);
          }
        }
        console.log(`Autres styles ${genre} — capsules modifiées entre L0 et ${nom} : ${changees.length ? `${changees.length} sur ${autres.length * 4} (${changees.join(", ")})` : "aucune"}`);
      }
      // Diagnostic : par niveau, ce qui entre et sort de la capsule d'un autre style.
      for (const [nom, pool] of etats.slice(1)) {
        const w = representativeWeatherFor("Printemps");
        const id = autres[0];
        const c0 = computeDefaultCapsule(profil(genre, [id]), w, [], "Printemps", etats[0][1], REGLE_DU_30_10);
        const c1 = computeDefaultCapsule(profil(genre, [id]), w, [], "Printemps", pool, REGLE_DU_30_10);
        const i0 = new Set(c0.map((x) => x.id));
        const i1 = new Set(c1.map((x) => x.id));
        const entrent = c1.filter((x) => !i0.has(x.id)).map((x) => `${x.id} ${x.name} [${(x.styleTags ?? []).join("/")}]`);
        const sortent = c0.filter((x) => !i1.has(x.id)).map((x) => `${x.id} ${x.name}`);
        console.log(`  ${nom} ${id}/Printemps — entrent : ${entrent.join(" ; ") || "aucune"}\n     sortent : ${sortent.join(" ; ") || "aucune"}`);
      }
    }
  });
});
