import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, occasionsOf, pieceOrienteeParMorphologie, representativeWeatherFor, STRATEGIE_AVANT_LOT4, type SelectionStrategy } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { coupesDeLaPiece } from "../src/lib/coupesPieces";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey } from "../src/lib/types";
import { exposedStyleIds, type StyleId } from "../src/lib/profile";
import { COUPES_PREFEREES, type CoupePreferee, type PreferencesSilhouette } from "../src/lib/preferencesSilhouette";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";
import { enLigne, lireCsv } from "./catalogueCsv";

// LOT 4 — COUPES PRÉFÉRÉES ET MISE EN VALEUR DANS LA SÉLECTION DE LA CAPSULE (31/10/2026). LECTURE SEULE, rien n'est écrit.
//
// Règle d'audit (AGENTS.md) : configuration gelée, MÊME exécution, MÊME pool, un levier à la fois puis la combinaison.
//   Pool    = la production au 31/10/2026 : export CSV + SQL 01, 02, 04 (sport commun étiqueté tous styles) et 05 simulés.
//   Fixes   = STRATEGIE_AVANT_LOT4 (la production d'avant le lot 4 ; la production actuelle = apres_basique + prime) (sport « etiquette », morphologie rang 4 « A »), météo représentative de chaque saison.
//   Leviers = coupesPreferees (absent | avant_basique | apres_basique | apres_direction) ; miseEnValeurPrime (absent | true).
// Mesures : capsules modifiées ; part des vêtements de la capsule ayant une coupe préférée ; pièces « basiques » perdues ;
// occasions couvertes ; tenues complètes (8 occasions × 5 tirages) ; direction morphologique (poire, triangle inversé).
//
// Usage : CREATIF_CSV=<export.csv> CREATIF_REVUE=docs/capsules/creatif/sql/revue.json \
//         npx vitest run --config vitest.audit.config.mts scripts/preferences-silhouette.audit.ts

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "date", "soiree", "sport", "cocooning", "voyage", "evenement_perso"];
const TIRAGES = 5;
const ETIQUETES = [504, 505, 506, 512, 521, 565, 574, 577, 609, 675, 709, 710, 750, 752, 807, 813, 817, 836, 846, 851, 852, 901, 905, 910, 911, 957, 973, 1063, 481, 520, 971, 972];
const SPORT_COMMUN = [491, 493, 494, 495, 522, 523, 524];
const TOUS_STYLES = "Minimaliste, Casual chic, Classique chic, Romantique, Bohème, Streetwear, Preppy, Glamour, Créatif";
const PLACEMENTS = ["avant_basique", "apres_basique", "apres_direction"] as const;

const VETEMENTS = new Set(["haut", "pull", "veste", "manteau", "robe", "combinaison", "pantalon", "jean", "jupe", "short"]);
const versPool = (rows: VestiaireRow[]) => rows.map(rowToCatalogItem).filter((x): x is CatalogItem => x !== null);
const empreinte = (c: CatalogItem[]) => c.map((x) => x.id).sort((a, b) => a - b).join(",");
const pct = (n: number, t: number) => (t ? Math.round((n / t) * 1000) / 10 : 0);
const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function poolDeProduction(): CatalogItem[] {
  const csv = process.env.CREATIF_CSV;
  const revue = process.env.CREATIF_REVUE;
  if (!csv || !revue) throw new Error("CREATIF_CSV et CREATIF_REVUE sont requis (cf. en-tête).");
  const etiq = new Set(ETIQUETES);
  const commun = new Set(SPORT_COMMUN);
  const base = lireCsv(readFileSync(csv, "utf8"))
    .map(enLigne)
    .map((r) => (etiq.has(r.id) && !(r.styles ?? "").includes("Créatif") ? { ...r, styles: r.styles ? `${r.styles}, Créatif` : "Créatif" } : r))
    .map((r) => (commun.has(r.id) ? { ...r, styles: TOUS_STYLES } : r));
  const crees = (JSON.parse(readFileSync(revue, "utf8")).revue as Record<string, unknown>[]).map(
    (v, i) => ({ ...(v as unknown as VestiaireRow), id: 900000 + i, url_image: null, frozen: false }) as VestiaireRow
  );
  return versPool([...base, ...crees]);
}

interface Mesure {
  capsule: CatalogItem[];
  partCoupe: number;
  basiques: number;
  occasions: number;
  completes: number;
}

function mesurer(pool: CatalogItem[], genre: "femme" | "homme", style: StyleId, saison: CapsuleSeason, prefs: PreferencesSilhouette, strat: SelectionStrategy, morphology: string | null = null, tenues = false): Mesure {
  const w = representativeWeatherFor(saison);
  const p = profilAudit({ gender: genre, styles: [style], morphology, patch: { preferencesSilhouette: prefs } });
  const capsule = computeDefaultCapsule(p, w, [], saison, pool, strat);
  const vet = capsule.filter((x) => VETEMENTS.has(x.cat));
  const voulues = prefs.coupes ?? [];
  const partCoupe = pct(vet.filter((x) => voulues.some((c) => coupesDeLaPiece(x).has(c))).length, vet.length);
  const occ = new Set(capsule.flatMap((x) => occasionsOf(x)));
  let completes = 0;
  if (tenues)
    for (const o of OCCASIONS)
      for (let t = 0; t < TIRAGES; t++) if (!generateOutfitWithFallback(capsule, w, o, "Présentiel", "Verre", [], genre, saison).noCompleteOutfit) completes++;
  return { capsule, partCoupe, basiques: capsule.filter((x) => x.estBasiqueCapsule).length, occasions: occ.size, completes };
}

describe("Lot 4 — préférences de silhouette dans la sélection", () => {
  it("coupes préférées (3 placements) et mise en valeur, même pool, même exécution", () => {
    const pool = poolDeProduction();
    for (const g of ["femme", "homme"] as const) assertCatalogueStyles(pool, exposedStyleIds(g));

    // 0. Couverture : combien de vêtements du pool ont une coupe connue, par coupe.
    const vet = pool.filter((x) => VETEMENTS.has(x.cat));
    const parCoupe = COUPES_PREFEREES.map((c) => `${c} ${vet.filter((x) => coupesDeLaPiece(x).has(c)).length}`);
    console.log(`\nPool ${pool.length} articles, ${vet.length} vêtements · coupe connue : ${vet.filter((x) => coupesDeLaPiece(x).size).length} (${pct(vet.filter((x) => coupesDeLaPiece(x).size).length, vet.length)} %) · ${parCoupe.join(" · ")}`);

    // 1. Garde-fou : sans préférence, ou avec « Cela dépend » ([]), chaque levier rend la capsule de production à l'identique.
    let ecarts = 0;
    for (const g of ["femme", "homme"] as const)
      for (const st of exposedStyleIds(g))
        for (const s of SAISONS) {
          const ref = empreinte(mesurer(pool, g, st, s, { miseEnValeur: null, coupes: null }, STRATEGIE_AVANT_LOT4).capsule);
          for (const pl of PLACEMENTS)
            for (const prefs of [{ miseEnValeur: null, coupes: null }, { miseEnValeur: [], coupes: [] }] as PreferencesSilhouette[])
              if (empreinte(mesurer(pool, g, st, s, prefs, { ...STRATEGIE_AVANT_LOT4, coupesPreferees: pl, miseEnValeurPrime: true }).capsule) !== ref) ecarts++;
        }
    console.log(`Garde-fou — sans préférence ou « Cela dépend », capsules différentes de la production avec les leviers : ${ecarts}`);

    // 2. Coupes préférées : chaque coupe seule, chaque placement, tous styles × saisons × genres.
    for (const g of ["femme", "homme"] as const) {
      console.log(`\n══ ${g.toUpperCase()} — ${exposedStyleIds(g).length} styles × 4 saisons ══`);
      for (const coupe of COUPES_PREFEREES) {
        const prefs: PreferencesSilhouette = { miseEnValeur: null, coupes: [coupe as CoupePreferee] };
        const lignes: string[] = [];
        const base: Mesure[] = [];
        for (const st of exposedStyleIds(g)) for (const s of SAISONS) base.push(mesurer(pool, g, st, s, prefs, STRATEGIE_AVANT_LOT4, null, true));
        lignes.push(`   production        part ${moy(base.map((m) => m.partCoupe)).toFixed(1)} % · basiques ${moy(base.map((m) => m.basiques)).toFixed(1)} · occasions ${moy(base.map((m) => m.occasions)).toFixed(2)} · tenues complètes ${pct(base.reduce((a, m) => a + m.completes, 0), base.length * OCCASIONS.length * TIRAGES)} %`);
        for (const pl of PLACEMENTS) {
          const ms: Mesure[] = [];
          for (const st of exposedStyleIds(g)) for (const s of SAISONS) ms.push(mesurer(pool, g, st, s, prefs, { ...STRATEGIE_AVANT_LOT4, coupesPreferees: pl }, null, true));
          const changees = ms.filter((m, i) => empreinte(m.capsule) !== empreinte(base[i].capsule)).length;
          const pireOcc = Math.min(...ms.map((m, i) => m.occasions - base[i].occasions));
          lignes.push(
            `   ${pl.padEnd(17)} part ${moy(ms.map((m) => m.partCoupe)).toFixed(1)} % (${(moy(ms.map((m) => m.partCoupe)) - moy(base.map((m) => m.partCoupe))).toFixed(1).padStart(5)} pts) · capsules modifiées ${changees}/${ms.length} · basiques ${moy(ms.map((m) => m.basiques)).toFixed(1)} · occasions ${moy(ms.map((m) => m.occasions)).toFixed(2)} (pire écart ${pireOcc}) · tenues complètes ${pct(ms.reduce((a, m) => a + m.completes, 0), ms.length * OCCASIONS.length * TIRAGES)} %`
          );
        }
        console.log(`  Coupe préférée : ${coupe}\n${lignes.join("\n")}`);
      }
    }

    // 3. Mise en valeur prime sur la direction : poire + « Mes hanches », triangle inversé + « Mes épaules ».
    console.log(`\n══ MISE EN VALEUR — femme, 9 styles × 4 saisons ══`);
    for (const [morpho, zone] of [["f_poire", "hanches"], ["f_triangle_inverse", "epaules"]] as const) {
      const prefs: PreferencesSilhouette = { miseEnValeur: [zone], coupes: null };
      const res = { base: [] as CatalogItem[][], levier: [] as CatalogItem[][] };
      let tenuesBase = 0;
      let tenuesLevier = 0;
      for (const st of exposedStyleIds("femme"))
        for (const s of SAISONS) {
          const a = mesurer(pool, "femme", st, s, prefs, STRATEGIE_AVANT_LOT4, morpho, true);
          const b = mesurer(pool, "femme", st, s, prefs, { ...STRATEGIE_AVANT_LOT4, miseEnValeurPrime: true }, morpho, true);
          res.base.push(a.capsule);
          res.levier.push(b.capsule);
          tenuesBase += a.completes;
          tenuesLevier += b.completes;
        }
      const orientees = (cs: CatalogItem[][]) => moy(cs.map((c) => c.filter((x) => pieceOrienteeParMorphologie(x, morpho)).length));
      const changees = res.base.filter((c, i) => empreinte(c) !== empreinte(res.levier[i])).length;
      const tot = res.base.length * OCCASIONS.length * TIRAGES;
      console.log(
        `  ${morpho} + « ${zone} » : capsules modifiées ${changees}/${res.base.length} · pièces orientées par la silhouette ${orientees(res.base).toFixed(1)} → ${orientees(res.levier).toFixed(1)} · tenues complètes ${pct(tenuesBase, tot)} % → ${pct(tenuesLevier, tot)} %`
      );
    }

    // 4. Combinaison : chaque placement + mise en valeur, pour une poire « Mes hanches » qui préfère les coupes fluides.
    console.log(`\n══ COMBINAISON — femme poire, « Mes hanches », coupes fluides ══`);
    const prefs: PreferencesSilhouette = { miseEnValeur: ["hanches"], coupes: ["fluides"] };
    const ref: Mesure[] = [];
    for (const st of exposedStyleIds("femme")) for (const s of SAISONS) ref.push(mesurer(pool, "femme", st, s, prefs, STRATEGIE_AVANT_LOT4, "f_poire"));
    for (const pl of PLACEMENTS) {
      const seul: Mesure[] = [];
      const combo: Mesure[] = [];
      for (const st of exposedStyleIds("femme"))
        for (const s of SAISONS) {
          seul.push(mesurer(pool, "femme", st, s, prefs, { ...STRATEGIE_AVANT_LOT4, coupesPreferees: pl }, "f_poire"));
          combo.push(mesurer(pool, "femme", st, s, prefs, { ...STRATEGIE_AVANT_LOT4, coupesPreferees: pl, miseEnValeurPrime: true }, "f_poire"));
        }
      console.log(
        `  ${pl.padEnd(17)} part fluide : production ${moy(ref.map((m) => m.partCoupe)).toFixed(1)} % · coupe seule ${moy(seul.map((m) => m.partCoupe)).toFixed(1)} % · coupe + mise en valeur ${moy(combo.map((m) => m.partCoupe)).toFixed(1)} %`
      );
    }
  });
});
