import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import type { CatalogItem } from "../src/lib/catalog";
import { STYLES_FEMME, assertCatalogueStyles } from "./harnaisAudit";

// LES PULLS SANS BORNE HAUTE ONT-ILS UN JUMEAU DÉJÀ BORNÉ ? — LECTURE SEULE.
//
// L'audit `bornes-pulls` a produit un résultat que je n'attendais pas et qui
// change le périmètre de la correction : le jeu des « six pièces fautives »
// N'EST PAS STABLE d'une exécution à l'autre. Deux mesures de la même
// situation en ont désigné six chacune, qui ne se recouvrent pas — et les
// identifiants montrent pourquoi : le catalogue contient des DOUBLONS de nom
// (« Cardigan structuré » 865 et 875, « Sweat graphique oversize » 973 et
// 978...). Le tirage choisit tantôt l'un, tantôt l'autre.
//
// Deux conséquences, qui ne se déduisent pas l'une de l'autre :
//
//   a) Corriger « les six qui sont sortis » laisserait leurs jumeaux produire
//      exactement le même défaut le lendemain. Le périmètre défendable de
//      l'arbitrage « corriger d'abord celles qui sortent » n'est donc pas six
//      LIGNES, mais six PIÈCES — jumeaux compris.
//   b) Là où un jumeau est DÉJÀ borné, la valeur à poser n'a pas à être
//      inventée : elle est déjà dans le catalogue, posée par la maison sur la
//      même pièce. C'est l'ancrage le plus fort disponible.
//
// Ce script établit ces deux points. Il ne propose aucune valeur et n'écrit
// rien : il dit, pour chacun des pulls sans borne, ce que le catalogue sait
// déjà de lui.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");

/** Médiane entière, arrondie vers le bas — pas de borne à 17,5 °. */
function mediane(xs: number[]): number | null {
  if (!xs.length) return null;
  const t = [...xs].sort((a, b) => a - b);
  const m = t.length % 2 ? t[(t.length - 1) / 2] : Math.floor((t[t.length / 2 - 1] + t[t.length / 2]) / 2);
  return m;
}

describe("jumeaux des pulls sans borne haute", () => {
  it("dit ce que le catalogue sait déjà de chaque pièce non bornée", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const ligne = new Map<number, VestiaireRow>(brutes.map((r) => [VESTIAIRE_ID_OFFSET + r.id, r]));
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const pulls = pool.filter((it) => it.cat === "pull");
    const bornes = pulls.filter((it) => it.meteoMaxTemp != null);
    const sansBorne = pulls.filter((it) => it.meteoMaxTemp == null);

    console.log(`${pulls.length} pulls — ${bornes.length} bornés, ${sansBorne.length} sans borne haute.`);

    // ═══ 1 · LES DOUBLONS DE NOM ═════════════════════════════════════════
    //
    // Établit le fait a) : une même pièce apparaît plusieurs fois, et les
    // exemplaires ne portent pas les mêmes bornes.
    console.log(`\n════════ 1 · DOUBLONS DE NOM PARMI LES PULLS ════════`);
    const parNom = new Map<string, CatalogItem[]>();
    for (const it of pulls) {
      const k = norm(it.name);
      parNom.set(k, [...(parNom.get(k) ?? []), it]);
    }
    const doublons = [...parNom.entries()].filter(([, v]) => v.length > 1);
    console.log(`  ${doublons.length} noms apparaissent plusieurs fois (${doublons.reduce((n, [, v]) => n + v.length, 0)} lignes).`);
    let discordants = 0;
    for (const [, v] of doublons) {
      const vals = new Set(v.map((it) => it.meteoMaxTemp ?? "NULL"));
      const discord = vals.size > 1;
      if (discord) discordants += 1;
      console.log(`  ${discord ? "⚠ DISCORDANT" : "  cohérent  "}  ${v[0].name}`);
      for (const it of v) {
        const r = ligne.get(it.id)!;
        console.log(`         id ${String(r.id).padStart(5)}  max ${String(it.meteoMaxTemp ?? "NULL").padStart(4)}  min ${String(it.meteoMinTemp ?? "—").padStart(4)}  ${(r.sous_type ?? "—").slice(0, 26).padEnd(27)}${r.matiere ?? "—"}`);
      }
    }
    console.log(`\n  >>> ${discordants} pièces existent en double AVEC des bornes discordantes.`);
    console.log(`      Corriger un exemplaire sans son jumeau laisse le défaut se reproduire.`);

    // ═══ 2 · CE QUE LE CATALOGUE SAIT DE CHAQUE PIÈCE NON BORNÉE ════════
    //
    // Trois ancrages, du plus fort au plus faible. Aucun n'est une
    // proposition : ce sont des faits catalogue, à confronter pièce par pièce.
    console.log(`\n════════ 2 · ANCRAGE DISPONIBLE POUR CHAQUE PULL SANS BORNE ════════`);
    console.log(`  jumeau     = un pull de MÊME NOM déjà borné (ancrage le plus fort)`);
    console.log(`  sous_type  = les pulls de MÊME sous_type déjà bornés (médiane, effectif)`);
    console.log(`  matiere    = les pulls de MÊME matiere déjà bornés (médiane, effectif)`);
    console.log(`  Une case vide signifie que le catalogue ne dit rien : la valeur devrait`);
    console.log(`  alors être ARBITRÉE explicitement, pas déduite.\n`);
    console.log(
      `  ${"id".padStart(5)}  ${"nom".padEnd(34)}${"sous_type".padEnd(26)}${"matiere".padEnd(18)}` +
      `${"jumeau".padStart(8)}${"sous_type".padStart(14)}${"matiere".padStart(14)}`,
    );
    let avecJumeau = 0, sansAucunAncrage = 0;
    for (const it of sansBorne.sort((a, b) => a.id - b.id)) {
      const r = ligne.get(it.id)!;
      const jum = bornes.filter((b) => norm(b.name) === norm(it.name)).map((b) => b.meteoMaxTemp!);
      const st = bornes.filter((b) => norm(ligne.get(b.id)!.sous_type) === norm(r.sous_type) && norm(r.sous_type) !== "").map((b) => b.meteoMaxTemp!);
      const mt = bornes.filter((b) => norm(ligne.get(b.id)!.matiere) === norm(r.matiere) && norm(r.matiere) !== "").map((b) => b.meteoMaxTemp!);
      const mJ = mediane(jum), mS = mediane(st), mT = mediane(mt);
      if (mJ != null) avecJumeau += 1;
      if (mJ == null && mS == null && mT == null) sansAucunAncrage += 1;
      const cell = (m: number | null, n: number) => (m == null ? "—" : `${m}° (${n})`);
      console.log(
        `  ${String(r.id).padStart(5)}  ${it.name.slice(0, 33).padEnd(34)}${(r.sous_type ?? "—").slice(0, 25).padEnd(26)}${(r.matiere ?? "—").slice(0, 17).padEnd(18)}` +
        `${cell(mJ, jum.length).padStart(8)}${cell(mS, st.length).padStart(14)}${cell(mT, mt.length).padStart(14)}`,
      );
    }
    console.log(`\n  ${avecJumeau}/${sansBorne.length} ont un jumeau de même nom déjà borné.`);
    console.log(`  ${sansAucunAncrage}/${sansBorne.length} n'ont AUCUN ancrage catalogue — pour celles-là, une valeur`);
    console.log(`  déduite serait une valeur inventée.`);

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucune donnée modifiée, aucun schéma touché.`);
    console.log(`  Ce script n'arbitre rien : il dit où la valeur existe déjà et où elle manque.`);
  }, 300_000);
});
