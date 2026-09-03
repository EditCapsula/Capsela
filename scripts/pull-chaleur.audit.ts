import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// UN PULL PAR 27 °C EN SEPTEMBRE — SIGNALEMENT UTILISATRICE, LECTURE SEULE.
//
// LE SIGNALEMENT, mot pour mot : « nous sommes le 3 septembre et il fait 27
// degrés, les tenues recommandées comportent des pulls ».
//
// CE QUI EST DÉJÀ ÉTABLI PAR LECTURE DE CODE, et n'a pas besoin d'être
// mesuré :
//
//   1. La saison de capsule est CALENDAIRE. Au 3 septembre,
//      `currentSeasonKey()` renvoie "Automne" quelle que soit la météo.
//   2. La capsule est construite pour la température REPRÉSENTATIVE de cette
//      saison — REPRESENTATIVE_TEMP.Automne = 14 °C — et non pour les 27 °C
//      réels. Le vivier de septembre est donc un vivier d'automne AVANT même
//      que la tenue du jour soit tirée.
//   3. La tenue du jour, elle, est générée avec la météo RÉELLE sur ce vivier.
//
// CE QUI RESTE À ÉTABLIR, et c'est l'objet de cet audit : pourquoi le filtre
// de température ne retire pas les pulls à 27 °C. `logic.ts` filtre
// `meteoMaxTemp != null && weather.temp > i.meteoMaxTemp` — sans exemption
// pour les hauts, contrairement au plancher. Deux causes possibles, qui
// n'appellent PAS le même correctif :
//
//   CAUSE A — DONNÉE MANQUANTE. Les pulls n'ont pas de `meteo_max_temp`
//   déclaré. Le filtre ne peut alors rien exclure : il ne s'applique jamais.
//   Correctif éventuel : données, ou règle par catégorie.
//
//   CAUSE B — REPLI DU MOTEUR. Les bornes existent et excluent bien les
//   pulls, mais `poolFor` retire le filtre de température en dernier recours
//   quand une catégorie essentielle serait vidée, et les réintroduit.
//   Correctif éventuel : le repli, pas les données.
//
// Les deux peuvent opérer ensemble. Cet audit les sépare AVANT toute
// proposition : je ne veux pas corriger un repli si le problème est une
// colonne vide, ni remplir une colonne si le problème est un repli.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;
/** La situation signalée : 3 septembre, 27 °C. */
const TEMP_REELLE = 27;
const SAISON_CALENDAIRE = "Automne" as const;

/**
 * La météo telle que le store la construit (store.tsx) : quand le bucket
 * météo du jour diffère du bucket calendaire, LES DEUX sont acceptés. C'est
 * reproduit ici à l'identique — s'en écarter mesurerait autre chose que ce
 * que voit l'utilisatrice.
 */
const METEO_REELLE: Weather = {
  season: "Printemps / Été",
  temp: TEMP_REELLE,
  label: "signalement 3 septembre",
  seasons: ["Printemps / Été", "Automne / Hiver", "Toutes saisons"],
} as unknown as Weather;

describe("un pull par 27 °C en septembre", () => {
  it("sépare la donnée manquante du repli moteur", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    const pulls = pool.filter((it) => it.cat === "pull");

    console.log(`Catalogue : ${pool.length} pièces, dont ${pulls.length} pulls.`);
    console.log(`Situation reproduite : saison calendaire ${SAISON_CALENDAIRE}, météo réelle ${TEMP_REELLE} °C.`);

    // ═══ 1 · CAUSE A — LA BORNE HAUTE EST-ELLE SEULEMENT RENSEIGNÉE ? ═══
    console.log(`\n════════ 1 · meteo_max_temp EST-IL RENSEIGNÉ SUR LES PULLS ? ════════`);
    console.log(`  Le filtre ne peut exclure QUE ce qui est borné. Une borne absente rend le`);
    console.log(`  filtre inopérant sur la pièce, à n'importe quelle température.`);
    const sansMax = pulls.filter((it) => it.meteoMaxTemp == null);
    const avecMax = pulls.filter((it) => it.meteoMaxTemp != null);
    console.log(`  pulls SANS meteo_max_temp : ${sansMax.length}/${pulls.length}  <- jamais exclus par la chaleur`);
    console.log(`  pulls AVEC meteo_max_temp : ${avecMax.length}/${pulls.length}`);
    if (avecMax.length) {
      const bornes = new Map<number, number>();
      for (const it of avecMax) bornes.set(it.meteoMaxTemp!, (bornes.get(it.meteoMaxTemp!) ?? 0) + 1);
      console.log(`  valeurs de la borne : ${[...bornes.entries()].sort((a, b) => a[0] - b[0]).map(([v, n]) => `${v}°×${n}`).join("  ")}`);
      const passentA27 = avecMax.filter((it) => TEMP_REELLE <= it.meteoMaxTemp!);
      console.log(`  pulls bornés qui TOLÈRENT ${TEMP_REELLE} °C : ${passentA27.length}`);
      for (const it of passentA27) console.log(`     ${it.name} (max ${it.meteoMaxTemp} °)`);
    }
    const exclusIbles = pulls.filter((it) => it.meteoMaxTemp != null && TEMP_REELLE > it.meteoMaxTemp);
    console.log(`\n  >>> À ${TEMP_REELLE} °C, le filtre peut exclure ${exclusIbles.length} pulls sur ${pulls.length}.`);
    console.log(`      Les ${pulls.length - exclusIbles.length} autres lui échappent par construction.`);
    if (sansMax.length) {
      console.log(`      Exemples de pulls sans borne haute :`);
      for (const it of sansMax.slice(0, 10)) console.log(`         ${it.name}`);
    }

    // ═══ 2 · CE QUE LA CAPSULE D'AUTOMNE CONTIENT ═══
    console.log(`\n════════ 2 · LA CAPSULE D'AUTOMNE, CONSTRUITE POUR 14 °C ════════`);
    console.log(`  Le vivier est choisi sur la saison calendaire, pas sur la météo du jour.`);
    const capsules = STYLES_FEMME.map((style) => ({
      style,
      capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), METEO_REELLE, [], SAISON_CALENDAIRE, pool),
    }));
    console.log(`  ${"style".padEnd(20)}${"pièces".padStart(8)}${"pulls".padStart(8)}${"dont tolérant 27°".padStart(20)}`);
    for (const { style, capsule } of capsules) {
      const p = capsule.filter((it) => it.cat === "pull");
      const ok = p.filter((it) => it.meteoMaxTemp == null || TEMP_REELLE <= it.meteoMaxTemp);
      console.log(`  ${style.padEnd(20)}${String(capsule.length).padStart(8)}${String(p.length).padStart(8)}${String(ok.length).padStart(20)}`);
    }

    // ═══ 3 · LES TENUES RÉELLEMENT GÉNÉRÉES À 27 °C ═══
    console.log(`\n════════ 3 · TENUES GÉNÉRÉES À ${TEMP_REELLE} °C — CE QUE VOIT L'UTILISATRICE ════════`);
    let tenues = 0, avecPull = 0;
    const pullsVus = new Map<number, number>();
    const exemples: string[] = [];
    for (const { style, capsule } of capsules) {
      for (const occ of OCCS) {
        for (let k = 0; k < N; k++) {
          const ids = generateOutfitWithFallback(capsule, METEO_REELLE, occ, "Présentiel", "Verre", [], "femme", SAISON_CALENDAIRE).ids;
          if (!ids.length) continue;
          tenues += 1;
          const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
          const p = pieces.filter((x) => x.cat === "pull");
          if (!p.length) continue;
          avecPull += 1;
          for (const x of p) pullsVus.set(x.id, (pullsVus.get(x.id) ?? 0) + 1);
          if (exemples.length < 12) exemples.push(`${style} · ${occ} — ${pieces.map((x) => x.name).join(" + ")}`);
        }
      }
    }
    console.log(`  ${tenues} tenues générées, dont ${avecPull} contenant un pull (${((avecPull / tenues) * 100).toFixed(1)} %).`);
    console.log(`\n  Les pulls effectivement proposés à ${TEMP_REELLE} °C :`);
    console.log(`  ${"nom".padEnd(38)}${"max déclaré".padStart(13)}${"tenues".padStart(9)}${"verdict".padStart(22)}`);
    for (const [id, n] of [...pullsVus.entries()].sort((a, b) => b[1] - a[1])) {
      const it = index.get(id)!;
      const max = it.meteoMaxTemp;
      const verdict =
        max == null ? "AUCUNE BORNE"
        : TEMP_REELLE <= max ? `tolère ${TEMP_REELLE}°`
        : "BORNE IGNORÉE (repli)";
      console.log(`  ${it.name.slice(0, 37).padEnd(38)}${String(max ?? "—").padStart(13)}${String(n).padStart(9)}${verdict.padStart(22)}`);
    }
    const parRepli = [...pullsVus.keys()].filter((id) => {
      const m = index.get(id)!.meteoMaxTemp;
      return m != null && TEMP_REELLE > m;
    });
    console.log(`\n  ATTRIBUTION :`);
    console.log(`     pulls proposés SANS borne haute (cause A, donnée)  : ${[...pullsVus.keys()].filter((id) => index.get(id)!.meteoMaxTemp == null).length}`);
    console.log(`     pulls proposés MALGRÉ leur borne (cause B, repli)  : ${parRepli.length}`);
    console.log(`     pulls proposés qui tolèrent ${TEMP_REELLE} ° (légitimes)      : ${[...pullsVus.keys()].filter((id) => { const m = index.get(id)!.meteoMaxTemp; return m != null && TEMP_REELLE <= m; }).length}`);
    console.log(`\n  Échantillon de tenues :`);
    for (const e of exemples) console.log(`     ${e}`);

    // ═══ 4 · CONTRE-ÉPREUVE — ET SI LA CAPSULE SUIVAIT LA MÉTÉO ? ═══
    //
    // Ne propose RIEN : établit seulement si le problème vient du choix de la
    // saison ou du filtre. Si la capsule Été à 27 °C ne contient pas de pull
    // fermé, alors le mécanisme fautif est le calendrier, pas la température.
    console.log(`\n════════ 4 · CONTRE-ÉPREUVE — LA MÊME MÉTÉO AVEC UNE CAPSULE ÉTÉ ════════`);
    console.log(`  Ceci n'est PAS une proposition de correctif : c'est un test d'attribution.`);
    let tenuesEte = 0, avecPullEte = 0;
    for (const style of STYLES_FEMME) {
      const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), METEO_REELLE, [], "Été", pool);
      for (const occ of OCCS) {
        for (let k = 0; k < N; k++) {
          const ids = generateOutfitWithFallback(capsule, METEO_REELLE, occ, "Présentiel", "Verre", [], "femme", "Été").ids;
          if (!ids.length) continue;
          tenuesEte += 1;
          if (ids.some((id) => index.get(id)?.cat === "pull")) avecPullEte += 1;
        }
      }
    }
    console.log(`  capsule Automne à ${TEMP_REELLE} ° : ${((avecPull / tenues) * 100).toFixed(1)} % de tenues avec pull`);
    console.log(`  capsule Été     à ${TEMP_REELLE} ° : ${((avecPullEte / tenuesEte) * 100).toFixed(1)} % de tenues avec pull`);
    console.log(`  Un écart net désigne la SAISON CALENDAIRE comme mécanisme dominant.`);
    console.log(`  Un écart faible désigne le FILTRE DE TEMPÉRATURE.`);

    console.log(`\n  LECTURE SEULE. Aucun correctif appliqué, aucune donnée modifiée.`);
    console.log(`  Cet audit ne dit pas s'il faut corriger le calendrier, les données ou le`);
    console.log(`  repli : il dit lequel des trois produit le pull que l'utilisatrice a vu.`);
  });
});
