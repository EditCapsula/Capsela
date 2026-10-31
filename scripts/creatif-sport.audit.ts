import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor, STRATEGIE_PRODUCTION, styleFit, type SelectionStrategy } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { formalityOf } from "../src/lib/attributes";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason } from "../src/lib/types";
import { exposedStyleIds, STYLE_ID_TO_CATALOG_LABEL, type StyleId } from "../src/lib/profile";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";
import { enLigne, lireCsv } from "./catalogueCsv";

// OPTION C — LE BLOC SPORT FILTRÉ PAR STYLE (31/10/2026, demandé : « mesure C »). LECTURE SEULE, rien n'est écrit nulle part.
//
// Aujourd'hui (arbitrage du 24/08/2026), le bloc Sport d'une capsule prend TOUT le sport du pool, quel que soit le style : créer les
// 17 pièces de sport Créatif les ferait entrer dans les capsules de tous les styles. L'option C (SelectionStrategy.sportParStyle,
// « par_style ») garde, famille par famille, le sport du style du profil, et retombe sur le sport commun d'une famille où le style n'a
// rien.
//
// Règle d'audit (AGENTS.md) : quatre scénarios dans la MÊME exécution, sur le MÊME catalogue de base, deux leviers seulement —
//   catalogue  P    = la production au 31/10/2026 (export + SQL 01 et 02.a appliqués) ;
//              P+S  = P + les 17 pièces de sport Créatif (bloc 2.b, non appliqué) ;
//   règle      commun (production) / par_style (option C).
//   S0 = P · commun (référence)   S1 = P+S · commun   S2 = P · par_style   S3 = P+S · par_style
//   S4 = P · C2   S5 = P+S · C2 — C2 : règle « etiquette » (une pièce de sport n'entre que si elle porte le style du profil) ET le sport
//   commun actuel (brassière, sweat, legging, jogging : #491, #493, #494, #495, #522, #523, #524) étiqueté avec tous les styles,
//   simulé en mémoire.
// Mesures, pour chaque style exposé × genre × saison : capsule identique à S0 ou non (et si la différence touche autre chose que le
// sport) ; tenues Sport complètes sur 20 tirages ; part des pièces du style dans les tenues Sport.
//
// Usage : CREATIF_CSV=<export.csv> CREATIF_REVUE=docs/capsules/creatif/sql/revue.json \
//         npx vitest run --config vitest.audit.config.mts scripts/creatif-sport.audit.ts

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const TIRAGES = 20;
const ETIQUETES = [504, 505, 506, 512, 521, 565, 574, 577, 609, 675, 709, 710, 750, 752, 807, 813, 817, 836, 846, 851, 852, 901, 905, 910, 911, 957, 973, 1063, 481, 520, 971, 972];
const COMMUN: SelectionStrategy = STRATEGIE_PRODUCTION;
const PAR_STYLE: SelectionStrategy = { ...STRATEGIE_PRODUCTION, sportParStyle: "par_style" };
const ETIQUETTE: SelectionStrategy = { ...STRATEGIE_PRODUCTION, sportParStyle: "etiquette" };
/** C2 — le sport commun actuel (brassière, sweat, legging, jogging), étiqueté avec tous les styles. T-shirt technique #521 et
 * baskets de sport #971/#972 portent déjà les huit styles et « Créatif » (SQL 01). */
const SPORT_COMMUN = [491, 493, 494, 495, 522, 523, 524];
const TOUS_STYLES = "Minimaliste, Casual chic, Classique chic, Romantique, Bohème, Streetwear, Preppy, Glamour, Créatif";

const versPool = (rows: VestiaireRow[]) => rows.map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
const empreinte = (c: CatalogItem[]) => c.map((it) => it.id).sort((a, b) => a - b).join(",");
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 100) : 0) + " %";
const estSport = (it: CatalogItem) => formalityOf(it) === 0;

describe("Option C — bloc Sport par style", () => {
  it("quatre scénarios, tous les styles, deux genres, quatre saisons", () => {
    const csv = process.env.CREATIF_CSV;
    const revue = process.env.CREATIF_REVUE;
    if (!csv || !revue) throw new Error("CREATIF_CSV et CREATIF_REVUE sont requis (cf. en-tête).");
    const etiq = new Set(ETIQUETES);
    const base = lireCsv(readFileSync(csv, "utf8"))
      .map(enLigne)
      .map((r) => (etiq.has(r.id) && !(r.styles ?? "").includes("Créatif") ? { ...r, styles: r.styles ? `${r.styles}, Créatif` : "Créatif" } : r));
    const crees: VestiaireRow[] = (JSON.parse(readFileSync(revue, "utf8")).revue as Record<string, unknown>[]).map(
      (v, i) => ({ ...(v as unknown as VestiaireRow), id: 900000 + i, url_image: null, frozen: false }) as VestiaireRow
    );
    const sportCrees = new Set(crees.filter((r) => r.niveau_formalite === "sport").map((r) => r.id));
    // Les 17 pièces de sport propres au Créatif, reconnues par leur nom (rowToCatalogItem ne garde pas l'id de la ligne tel quel).
    const nomsSportCreatif = new Set(crees.filter((r) => r.niveau_formalite === "sport").map((r) => `${r.genre}|${r.name}`));
    const P = versPool([...base, ...crees.filter((r) => !sportCrees.has(r.id))]);
    const PS = versPool([...base, ...crees]);
    const commun = new Set(SPORT_COMMUN);
    const baseC2 = base.map((r) => (commun.has(r.id) ? { ...r, styles: TOUS_STYLES } : r));
    const PC2 = versPool([...baseC2, ...crees.filter((r) => !sportCrees.has(r.id))]);
    const PSC2 = versPool([...baseC2, ...crees]);
    for (const g of ["femme", "homme"] as const) assertCatalogueStyles(P, exposedStyleIds(g));

    const scenarios: [string, CatalogItem[], SelectionStrategy][] = [
      ["S0 P·commun", P, COMMUN],
      ["S1 P+S·commun", PS, COMMUN],
      ["S2 P·par_style", P, PAR_STYLE],
      ["S3 P+S·par_style", PS, PAR_STYLE],
      ["S4 P·C2", PC2, ETIQUETTE],
      ["S5 P+S·C2", PSC2, ETIQUETTE],
    ];
    console.log(`\nCatalogue P ${P.length} articles · P+S ${PS.length} (dont ${sportCrees.size} pièces de sport Créatif).`);

    for (const genre of ["femme", "homme"] as const) {
      const styles = exposedStyleIds(genre);
      console.log(`\n══ ${genre.toUpperCase()} — ${styles.length} styles × 4 saisons = ${styles.length * 4} capsules ══`);
      const ref = new Map<string, CatalogItem[]>();
      for (const [nom, pool, strat] of scenarios) {
        let changees = 0;
        const quelles: string[] = [];
        let changeesHorsSport = 0;
        let piecesSport = 0;
        let sportDuStyle = 0;
        const parStyle: string[] = [];
        let pireCompletude = 100;
        for (const id of styles) {
          const libelle = STYLE_ID_TO_CATALOG_LABEL[id as StyleId];
          let completes = 0;
          let portees = 0;
          let portéesDuStyle = 0;
          let propresCreatif = 0;
          for (const saison of SAISONS) {
            const w = representativeWeatherFor(saison);
            const capsule = computeDefaultCapsule(profilAudit({ gender: genre, styles: [id] }), w, [], saison, pool, strat);
            const cle = `${id}/${saison}`;
            if (nom.startsWith("S0")) ref.set(cle, capsule);
            const c0 = ref.get(cle)!;
            if (empreinte(capsule) !== empreinte(c0)) {
              changees++;
              quelles.push(cle);
              if (empreinte(capsule.filter((x) => !estSport(x))) !== empreinte(c0.filter((x) => !estSport(x)))) changeesHorsSport++;
            }
            const sport = capsule.filter(estSport);
            piecesSport += sport.length;
            sportDuStyle += sport.filter((x) => styleFit(x, libelle)).length;
            let ok = 0;
            for (let t = 0; t < TIRAGES; t++) {
              const r = generateOutfitWithFallback(capsule, w, "sport", "Présentiel", "Verre", [], genre, saison);
              if (r.noCompleteOutfit) continue;
              ok++;
              const ids = new Set(r.ids);
              const tenue = capsule.filter((x) => ids.has(x.id));
              portees += tenue.length;
              portéesDuStyle += tenue.filter((x) => styleFit(x, libelle)).length;
              propresCreatif += tenue.filter((x) => nomsSportCreatif.has(`${genre}|${x.name}`)).length;
            }
            completes += ok;
            pireCompletude = Math.min(pireCompletude, Math.round((ok / TIRAGES) * 100));
            // Détail d'une saison sans tenue Sport complète : ce que le bloc Sport contenait.
            if (ok < TIRAGES)
              console.log(`   ⚠ ${nom} ${genre} ${id}/${saison} : ${ok}/${TIRAGES} tenues Sport complètes — bloc sport : ${sport.map((x) => `${x.name} [${x.cat}]`).join(" ; ")}`);
          }
          parStyle.push(`${id} ${pct(completes, TIRAGES * 4)}/${pct(portéesDuStyle, portees)}${id === "creatif" ? ` (dont pièces de sport propres au Créatif : ${pct(propresCreatif, portees)})` : ""}`);
        }
        console.log(
          `${nom.padEnd(17)} capsules modifiées vs S0 : ${String(changees).padStart(2)} (hors sport : ${changeesHorsSport}) · bloc sport moyen ${(piecesSport / (styles.length * 4)).toFixed(1)} pièces dont du style ${pct(sportDuStyle, piecesSport)} · pire saison, tenues Sport complètes : ${pireCompletude} %`
        );
        console.log(`   par style (tenues Sport complètes / part du style portée) : ${parStyle.join(" · ")}`);
        const autres = quelles.filter((q) => !q.startsWith("creatif/"));
        console.log(`   capsules modifiées : Créatif ${quelles.length - autres.length} · AUTRES STYLES ${autres.length}${autres.length ? ` (${autres.join(", ")})` : ""}`);
      }
    }
  });
});
