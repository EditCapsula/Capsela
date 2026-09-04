import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor, CAPSULE_SEASONS } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// QUELLE BORNE HAUTE POSER SUR LES PULLS QUI SORTENT PAR 27 °C — LECTURE SEULE.
//
// L'audit `pull-chaleur` a établi la cause : six pièces de catégorie `pull`
// n'ont AUCUN `meteo_max_temp`, et font 100 % des tenues à pull vues par
// l'utilisatrice le 3 septembre. L'arbitrage produit du 04/09/2026 retient de
// corriger ces six-là d'abord.
//
// CE SCRIPT NE CORRIGE RIEN. Il produit ce qu'il faut pour que la valeur
// proposée soit ANCRÉE et non inventée — la règle maison étant « UNKNOWN +
// donnée honnête » plutôt que « donnée renseignée mais stylistiquement
// fausse ». Il répond à quatre questions, dans la même exécution, sur le même
// pool, en ne faisant varier que la borne étudiée (règle d'audit, point 3) :
//
//   1 · QUI exactement ? Le jeu des six est DÉRIVÉ de la mesure, pas recopié
//       depuis un rapport : un nom recopié dérive, un identifiant mesuré non.
//   2 · SUR QUOI CALER LA VALEUR ? Les bornes que portent déjà les pulls
//       comparables du catalogue. C'est l'ancrage : la maison a une grille,
//       autant s'y tenir plutôt que d'en inventer une.
//   3 · QUE COÛTE CHAQUE VALEUR CANDIDATE ? Une borne à 20 ° chasse aussi la
//       pièce de la capsule d'ÉTÉ (construite à 24 °) et des journées à 22 °,
//       où un cardigan fin est précisément utile. Le choix n'est donc pas
//       « une valeur basse est plus sûre » : il se mesure.
//   4 · LA CORRECTION TIENT-ELLE ? `poolFor` retire le filtre de température
//       en dernier recours quand une catégorie essentielle se viderait. Si
//       exclure ces six pièces déclenche ce repli, elles reviennent et la
//       correction ne sert à rien. C'est la contre-épreuve décisive : elle est
//       mesurée ici AVANT que le moindre UPDATE soit proposé.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 30;
const TEMP_SIGNALEE = 27;
const SAISON_CALENDAIRE: CapsuleSeason = "Automne";
/** Les valeurs candidates soumises à mesure. Toutes excluent 27 ° ; elles ne diffèrent que par ce qu'elles coûtent EN DEÇÀ. */
const CANDIDATES = [20, 22, 24, 26];
/**
 * Le balayage de températures. Chaque palier est choisi pour DISCRIMINER une
 * candidate : 21 ° ne mord que sur la borne 20, 23 ° sur 20 et 22, 25 ° sur
 * tout sauf 26, 27 ° sur toutes. 16 ° est le témoin — aucune candidate ne
 * devrait y changer quoi que ce soit.
 */
const TEMPS = [16, 21, 23, 25, 27];

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

/**
 * La météo telle que le store la construit quand le bucket du jour diffère du
 * bucket calendaire : LES DEUX sont acceptés. S'en écarter mesurerait autre
 * chose que ce que voit l'utilisatrice.
 */
function meteoDuJour(temp: number): Weather {
  const bucket = temp >= 18 ? "Printemps / Été" : "Automne / Hiver";
  return {
    season: bucket,
    temp,
    label: `balayage ${temp} °`,
    seasons: bucket === "Automne / Hiver" ? [bucket, "Toutes saisons"] : [bucket, "Automne / Hiver", "Toutes saisons"],
  } as unknown as Weather;
}

const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) + " %" : "—");

describe("bornes hautes des pulls proposés par 27 °C", () => {
  it("dérive les pièces, ancre la valeur, mesure ce que chaque candidate coûte", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const ligne = new Map<number, VestiaireRow>(brutes.map((r) => [VESTIAIRE_ID_OFFSET + r.id, r]));
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    const pulls = pool.filter((it) => it.cat === "pull");

    console.log(`Catalogue : ${pool.length} pièces, dont ${pulls.length} de catégorie « pull ».`);

    // ═══ 1 · DÉRIVER LE JEU DES SIX ═══════════════════════════════════════
    //
    // Reproduit la situation signalée et relève les pulls SANS borne qui en
    // sortent. Le jeu n'est pas recopié : il est remesuré.
    console.log(`\n════════ 1 · QUELLES PIÈCES SORTENT RÉELLEMENT À ${TEMP_SIGNALEE} °C ? ════════`);
    const capsulesAutomne = STYLES_FEMME.map((style) => ({
      style,
      capsule: computeDefaultCapsule(
        profilAudit({ gender: "femme", styles: [style] }),
        meteoDuJour(TEMP_SIGNALEE), [], SAISON_CALENDAIRE, pool,
      ),
    }));
    const vus = new Map<number, number>();
    let tenuesRef = 0;
    for (const { style, capsule } of capsulesAutomne) {
      for (const occ of OCCS) {
        for (let k = 0; k < N; k++) {
          const vrai = Math.random;
          Math.random = mulberry32(grainePour(`${style}|${occ}|${k}|${TEMP_SIGNALEE}`));
          let ids: number[];
          try {
            ids = generateOutfitWithFallback(capsule, meteoDuJour(TEMP_SIGNALEE), occ, "Présentiel", "Verre", [], "femme", SAISON_CALENDAIRE).ids;
          } finally { Math.random = vrai; }
          if (!ids.length) continue;
          tenuesRef += 1;
          for (const id of ids) if (index.get(id)?.cat === "pull") vus.set(id, (vus.get(id) ?? 0) + 1);
        }
      }
    }
    const cibles = [...vus.entries()]
      .filter(([id]) => index.get(id)!.meteoMaxTemp == null)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);
    console.log(`  ${tenuesRef} tenues générées. Pulls sans borne haute effectivement proposés : ${cibles.length}.`);
    if (!cibles.length) throw new Error("Aucune cible dérivée : la mesure ne reproduit plus le signalement, ne pas proposer d'UPDATE.");

    // ═══ 2 · LA FICHE DE CHAQUE CIBLE ═════════════════════════════════════
    console.log(`\n════════ 2 · FICHE DES PIÈCES À CORRIGER ════════`);
    console.log(`  L'identifiant SQL est l'id de la table, SANS l'offset applicatif de ${VESTIAIRE_ID_OFFSET}.`);
    for (const id of cibles) {
      const it = index.get(id)!;
      const r = ligne.get(id)!;
      console.log(`\n  ── ${it.name}`);
      console.log(`     id SQL ................ ${r.id}   (id applicatif ${it.id})`);
      console.log(`     sous_type ............. ${r.sous_type ?? "—"}`);
      console.log(`     matiere ............... ${r.matiere ?? "—"}`);
      console.log(`     coupe ................. ${r.coupe ?? "—"}`);
      console.log(`     role_piece ............ ${r.role_piece ?? "—"}`);
      console.log(`     niveau_formalite ...... ${r.niveau_formalite ?? "—"}`);
      console.log(`     saison_capsule ........ ${r.saison_capsule ?? "—"}`);
      console.log(`     occasions ............. ${r.occasions ?? "—"}`);
      console.log(`     meteo_min_temp ........ ${r.meteo_min_temp ?? "NULL"}`);
      console.log(`     meteo_max_temp ........ ${r.meteo_max_temp ?? "NULL"}   <- à renseigner`);
      console.log(`     tenues à ${TEMP_SIGNALEE} ° ......... ${vus.get(id)}`);
    }

    // ═══ 3 · ANCRAGE — LA GRILLE DÉJÀ EN VIGUEUR ══════════════════════════
    //
    // Une valeur inventée est une donnée fausse déguisée en donnée. Celles-ci
    // sont les bornes que la maison a déjà posées sur des pièces comparables :
    // c'est sur elles que la proposition doit se caler.
    console.log(`\n════════ 3 · ANCRAGE — LES BORNES DÉJÀ POSÉES SUR LES PULLS ════════`);
    const bornes = pulls.filter((it) => it.meteoMaxTemp != null).sort((a, b) => a.meteoMaxTemp! - b.meteoMaxTemp!);
    console.log(`  ${bornes.length} pulls sur ${pulls.length} portent une borne haute.`);
    console.log(`  ${"max".padStart(5)}${"min".padStart(6)}  ${"sous_type".padEnd(26)}${"matiere".padEnd(18)}${"coupe".padEnd(10)}nom`);
    for (const it of bornes) {
      const r = ligne.get(it.id)!;
      console.log(`  ${String(it.meteoMaxTemp).padStart(5)}${String(it.meteoMinTemp ?? "—").padStart(6)}  ${(r.sous_type ?? "—").slice(0, 25).padEnd(26)}${(r.matiere ?? "—").slice(0, 17).padEnd(18)}${(r.coupe ?? "—").padEnd(10)}${it.name}`);
    }
    console.log(`\n  Pour comparaison, la grille sur les autres catégories de dessus :`);
    for (const cat of ["haut", "veste", "manteau"] as const) {
      const av = pool.filter((it) => it.cat === cat && it.meteoMaxTemp != null);
      const rep = new Map<number, number>();
      for (const it of av) rep.set(it.meteoMaxTemp!, (rep.get(it.meteoMaxTemp!) ?? 0) + 1);
      const total = pool.filter((it) => it.cat === cat).length;
      console.log(`     ${cat.padEnd(10)} ${av.length}/${total} bornés — ${[...rep.entries()].sort((a, b) => a[0] - b[0]).map(([v, n]) => `${v}°×${n}`).join("  ") || "aucune"}`);
    }

    // ═══ 4 · CE QUE L'OPTION RETENUE LAISSE OUVERT ════════════════════════
    console.log(`\n════════ 4 · RÉSIDUEL — LES PULLS SANS BORNE QUI NE SORTENT PAS AUJOURD'HUI ════════`);
    console.log(`  Ils ne produisent aucune tenue fautive dans la mesure ci-dessus, mais rien ne`);
    console.log(`  garantit qu'ils ne le feront pas après un changement de capsule ou de saison.`);
    const residuel = pulls.filter((it) => it.meteoMaxTemp == null && !cibles.includes(it.id));
    console.log(`  ${residuel.length} pièces :`);
    for (const it of residuel) {
      const r = ligne.get(it.id)!;
      console.log(`     id ${String(r.id).padStart(6)}  ${(r.sous_type ?? "—").slice(0, 25).padEnd(26)}${it.name}`);
    }

    // ═══ 5 · CE QUE CHAQUE VALEUR CANDIDATE COÛTE ═════════════════════════
    //
    // Partie déterministe d'abord : l'appartenance à chaque capsule ne dépend
    // que de la température représentative de la saison, pas d'un tirage.
    console.log(`\n════════ 5 · EFFET DE CHAQUE VALEUR CANDIDATE ════════`);
    console.log(`\n  5a · APPARTENANCE AUX CAPSULES (déterministe — la capsule est bâtie à la`);
    console.log(`       température représentative de la saison, pas à la météo du jour) :`);
    console.log(`       ${"borne".padEnd(8)}${CAPSULE_SEASONS.map((s) => `${s} (${representativeWeatherFor(s).temp}°)`.padEnd(16)).join("")}`);
    for (const v of CANDIDATES) {
      const cells = CAPSULE_SEASONS.map((s) => (representativeWeatherFor(s).temp <= v ? "éligible" : "EXCLUE").padEnd(16));
      console.log(`       ${(v + " °").padEnd(8)}${cells.join("")}`);
    }
    console.log(`       Lecture : une borne sous 24 ° retire ces pièces du vivier d'ÉTÉ. Pour un`);
    console.log(`       cardigan fin, c'est un choix éditorial, pas un détail technique.`);

    // Partie mesurée : le balayage de températures, bras par bras, graines
    // partagées — seule la borne varie.
    console.log(`\n  5b · TENUES MESURÉES — capsule ${SAISON_CALENDAIRE}, balayage de température`);
    console.log(`       « cibles » = tenues contenant au moins une des ${cibles.length} pièces visées.`);
    console.log(`       « repli » = occurrences où une pièce sort MALGRÉ sa borne (poolFor a`);
    console.log(`       relâché le filtre) : c'est le seul chiffre qui peut invalider la correction.`);
    const brasNoms = ["actuel (aucune borne)", ...CANDIDATES.map((v) => `borne ${v} °`)];
    const brasBornes: (number | null)[] = [null, ...CANDIDATES];

    console.log(`\n       ${"bras".padEnd(24)}${"temp".padStart(6)}${"tenues".padStart(9)}${"cibles".padStart(10)}${"pulls".padStart(10)}${"cellules".padStart(11)}${"repli".padStart(8)}`);
    for (let b = 0; b < brasBornes.length; b++) {
      const borne = brasBornes[b];
      const poolBras = pool.map((it) => (borne != null && cibles.includes(it.id) ? { ...it, meteoMaxTemp: borne } : it));
      const idxBras = new Map(poolBras.map((it) => [it.id, it]));
      for (const temp of TEMPS) {
        const w = meteoDuJour(temp);
        let tenues = 0, avecCible = 0, avecPull = 0, repli = 0, cellules = 0;
        for (const style of STYLES_FEMME) {
          const capsule = computeDefaultCapsule(
            profilAudit({ gender: "femme", styles: [style] }), w, [], SAISON_CALENDAIRE, poolBras,
          );
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${style}|${occ}|${k}|${temp}`));
              let ids: number[];
              try {
                ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", SAISON_CALENDAIRE).ids;
              } finally { Math.random = vrai; }
              if (!ids.length) continue;
              couverte = true;
              tenues += 1;
              const pieces = ids.map((id) => idxBras.get(id)).filter((p): p is CatalogItem => Boolean(p));
              if (pieces.some((p) => p.cat === "pull")) avecPull += 1;
              if (pieces.some((p) => cibles.includes(p.id))) avecCible += 1;
              for (const p of pieces) if (p.meteoMaxTemp != null && temp > p.meteoMaxTemp) repli += 1;
            }
            if (couverte) cellules += 1;
          }
        }
        console.log(
          `       ${(b === 0 ? brasNoms[0] : brasNoms[b]).padEnd(24)}${(temp + "°").padStart(6)}${String(tenues).padStart(9)}` +
          `${pct(avecCible, tenues).padStart(10)}${pct(avecPull, tenues).padStart(10)}` +
          `${`${cellules}/${STYLES_FEMME.length * OCCS.length}`.padStart(11)}${String(repli).padStart(8)}`,
        );
      }
      console.log("");
    }

    // ═══ 6 · CONTRE-ÉPREUVE ÉTÉ ═══════════════════════════════════════════
    //
    // Une borne sous 24 ° ne fait pas que retirer la pièce des journées
    // chaudes : elle la retire du VIVIER d'été. Mesuré, pas supposé.
    console.log(`════════ 6 · CONTRE-ÉPREUVE — CE QUE LA BORNE COÛTE À LA CAPSULE D'ÉTÉ ════════`);
    console.log(`  ${"bras".padEnd(24)}${"pièces Été".padStart(12)}${"dont pulls".padStart(12)}${"cibles retenues".padStart(18)}`);
    for (let b = 0; b < brasBornes.length; b++) {
      const borne = brasBornes[b];
      const poolBras = pool.map((it) => (borne != null && cibles.includes(it.id) ? { ...it, meteoMaxTemp: borne } : it));
      let pieces = 0, p = 0, c = 0;
      for (const style of STYLES_FEMME) {
        const capsule = computeDefaultCapsule(
          profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor("Été"), [], "Été", poolBras,
        );
        pieces += capsule.length;
        p += capsule.filter((it) => it.cat === "pull").length;
        c += capsule.filter((it) => cibles.includes(it.id)).length;
      }
      console.log(`  ${brasNoms[b].padEnd(24)}${String(pieces).padStart(12)}${String(p).padStart(12)}${String(c).padStart(18)}`);
    }

    console.log(`\n  LECTURE SEULE. Aucun UPDATE exécuté, aucune donnée modifiée, aucun schéma touché.`);
    console.log(`  Ce script ne choisit pas la valeur : il rend le choix mesurable pièce par pièce.`);
  }, 600_000);
});
