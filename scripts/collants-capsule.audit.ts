import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// POURQUOI 57 ROBES SORTENT SOUS LEUR MIN SANS COLLANTS — LECTURE SEULE.
//
// L'audit `tenues-hors-plage` a mesuré, sur 46 000 tenues : 78 jupes et 57
// robes portées sous leur propre meteo_min_temp sans aucune couche. R-B19
// (logic.ts:905 et 957) est pourtant écrit exactement pour ces deux cas — une
// robe ou une jupe sous son min déclenche une recherche dédiée de collants.
// 24 jupes ont bien été couvertes. AUCUNE robe.
//
// PRÉDICTION TESTÉE ICI, pas supposée. Lue dans logic.ts:983 :
//
//     const collantPool = inTemp.length ? inTemp : allCollants;
//
// R-B19 préfère la paire dont la plage couvre la température du jour, mais
// n'en laisse jamais aucune. La météo ne peut donc PAS être le motif de
// l'absence. Si la capsule contient au moins un collant, R-B19 en pose un ;
// si elle n'en contient aucun, il ne peut rien poser. La couverture devrait
// donc être de 100 % ou de 0 % selon la seule composition de la capsule,
// jamais entre les deux.
//
// Un taux intermédiaire réfuterait cette lecture et rouvrirait la question :
// il faudrait alors chercher ailleurs (harmonize() qui écarte la paire, un
// doublon d'id, un chemin qui ne passe pas par le bloc). C'est le sens de la
// colonne « ni l'un ni l'autre » du tableau B.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 25;

/** Les mêmes plages que `tenues-hors-plage`, pour que les deux audits se recoupent. */
const PLAGE: Record<CapsuleSeason, number[]> = {
  Printemps: [7, 10, 13, 16, 19, 22],
  "Été": [18, 21, 24, 27, 30],
  Automne: [6, 8, 11, 14, 17, 20],
  Hiver: [-2, 0, 3, 6, 9, 12],
};

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function grainePour(cle: string): number {
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const meteo = (temp: number, saison: CapsuleSeason): Weather =>
  ({ ...representativeWeatherFor(saison), temp }) as Weather;

const estCollant = (it: CatalogItem): boolean =>
  it.cat === "accessoire" && it.accessoireType === "Collants";

describe("les collants en capsule", () => {
  it("explique la couverture de R-B19 par la seule composition des capsules", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));

    // ═══ A · CE QUE LE CATALOGUE CONTIENT ═══════════════════════════════
    console.log(`\n════════ A · LES COLLANTS DU CATALOGUE ════════`);
    const collants = pool.filter(estCollant);
    console.log(`  Catalogue : ${pool.length} pièces, dont ${collants.length} collants.`);
    for (const c of collants) {
      const st = (c.styleTags ?? []).join(", ") || "—";
      console.log(`     #${String(c.id).padStart(5)}  [${c.meteoMinTemp ?? "—"}, ${c.meteoMaxTemp ?? "—"}]  ${c.name}`);
      console.log(`            styles : ${st}`);
    }
    if (!collants.length) console.log(`     AUCUN. R-B19 ne peut alors rien poser nulle part.`);

    // ═══ B · CE QUE LES CAPSULES CONTIENNENT, ET CE QUI EN SORT ═════════
    console.log(`\n════════ B · PAR CAPSULE — COLLANT DISPONIBLE, ET COUVERTURE OBSERVÉE ════════`);
    console.log(`  « demandes » = tirages où une robe ou une jupe retenue est sous son propre min,`);
    console.log(`  c'est-à-dire exactement la condition qui arme R-B19 (logic.ts:905 et 957).`);
    console.log(`\n  ${"saison".padEnd(11)}${"style".padEnd(14)}${"collants".padStart(9)}${"demandes".padStart(10)}${"couvertes".padStart(11)}${"taux".padStart(8)}`);

    let totalDemandes = 0, totalCouvertes = 0;
    let avecCollantDemandes = 0, avecCollantCouvertes = 0;
    let sansCollantDemandes = 0, sansCollantCouvertes = 0;

    for (const saison of CAPSULE_SEASONS) {
      for (const style of STYLES_FEMME) {
        const capsule = computeDefaultCapsule(
          profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, pool
        );
        const collantsEnCapsule = capsule.filter(estCollant);
        let demandes = 0, couvertes = 0;
        for (const temp of PLAGE[saison]) {
          const w = meteo(temp, saison);
          for (const occ of OCCS) {
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}|${temp}`));
              let ids: number[];
              try {
                ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids;
              } finally { Math.random = vrai; }
              if (!ids.length) continue;
              const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
              const arme = pieces.some(
                (p) => (p.cat === "robe" || p.cat === "jupe") && p.meteoMinTemp != null && temp < p.meteoMinTemp
              );
              if (!arme) continue;
              demandes += 1;
              if (pieces.some(estCollant)) couvertes += 1;
            }
          }
        }
        totalDemandes += demandes; totalCouvertes += couvertes;
        if (collantsEnCapsule.length) { avecCollantDemandes += demandes; avecCollantCouvertes += couvertes; }
        else { sansCollantDemandes += demandes; sansCollantCouvertes += couvertes; }
        const taux = demandes ? `${((couvertes / demandes) * 100).toFixed(0)}%` : "—";
        console.log(`  ${saison.padEnd(11)}${style.padEnd(14)}${String(collantsEnCapsule.length).padStart(9)}${String(demandes).padStart(10)}${String(couvertes).padStart(11)}${taux.padStart(8)}`);
      }
    }

    // ═══ C · LA PRÉDICTION TIENT-ELLE ? ════════════════════════════════
    console.log(`\n════════ C · LA PRÉDICTION TIENT-ELLE ? ════════`);
    const pc = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)} %` : "—");
    console.log(`  capsules AVEC au moins un collant : ${avecCollantCouvertes} / ${avecCollantDemandes} couvertes (${pc(avecCollantCouvertes, avecCollantDemandes)})`);
    console.log(`  capsules SANS aucun collant ..... : ${sansCollantCouvertes} / ${sansCollantDemandes} couvertes (${pc(sansCollantCouvertes, sansCollantDemandes)})`);
    console.log(`  ensemble ........................ : ${totalCouvertes} / ${totalDemandes} (${pc(totalCouvertes, totalDemandes)})`);
    const conforme = sansCollantCouvertes === 0 && avecCollantCouvertes === avecCollantDemandes;
    console.log(`\n  ${conforme ? "CONFORME" : "RÉFUTÉE"} — attendu : 100 % avec collant, 0 % sans.`);
    if (!conforme) {
      console.log(`  Un taux intermédiaire signifie qu'un AUTRE mécanisme écarte la paire.`);
      console.log(`  La cause n'est alors pas la composition de la capsule, et reste à trouver.`);
    } else {
      console.log(`  L'absence de collants ne vient d'aucun défaut de R-B19 : la règle fait`);
      console.log(`  exactement ce qu'elle dit, sur les capsules qui ont de quoi la servir.`);
      console.log(`  Ce qui reste à arbitrer est une question de COMPOSITION de capsule,`);
      console.log(`  pas de génération — et ce script ne la tranche pas.`);
    }
    console.log(`\n  LECTURE SEULE. Aucun correctif appliqué, aucune donnée modifiée.`);
  }, 600_000);
});
