import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// DEUX MESURES ARBITRÉES LE 04/09/2026 — LECTURE SEULE.
//
// 1 · COHÉRENCE BORNE / SAISON DÉCLARÉE.
//     En écrivant les bornes des dix pulls du bug « 27 °C », un contrôle croisé
//     improvisé a attrapé DEUX erreurs sur dix lignes — des bornes qui
//     auraient exclu une pièce d'une saison qu'elle revendique. L'invariant
//     est simple et ne figure nulle part dans le projet :
//
//       pour chaque saison déclarée dans `saison_capsule`,
//       meteo_min_temp <= température représentative <= meteo_max_temp
//
//     `computeDefaultCapsule` construit la capsule à cette température
//     (Printemps 16, Été 24, Automne 14, Hiver 6). Une pièce hors plage est
//     donc silencieusement absente d'une capsule qu'elle déclare — sans
//     erreur, sans log, sans que rien ne le signale.
//
//     Arbitrage : AUDIT D'ABORD, pas de test bloquant. Si le catalogue en
//     contient beaucoup, un test ferait échouer la CI sur de l'hérité ; on
//     regarde l'ampleur avant de décider.
//
// 2 · ROBES DE MAILLE ET CAPSULE ÉTÉ.
//     L'arbitrage étend la règle des mailles fermées aux robes par `sous_type`
//     (préfixes « robe pull » et « robe maille »), ce qui les exclura de l'Été
//     comme les pulls fermés. Avant de porter ce changement en production, on
//     mesure ce qu'il coûte.
//
//     La simulation est FIDÈLE et non approchée : l'exclusion de production
//     retire la pièce du `base` de computeDefaultCapsule ; retirer ces robes
//     du pool passé à la même fonction produit donc exactement la capsule que
//     la règle produirait. Aucun code de production n'a besoin d'être touché
//     pour le mesurer.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/** Les saisons réellement déclarées, lues sur la colonne libre. */
function saisonsDeclarees(raw: string | null): CapsuleSeason[] {
  const jetons = (raw ?? "").split(/[,;|]/).map((s) => sansAccents(s)).filter(Boolean);
  return CAPSULE_SEASONS.filter((s) => jetons.includes(sansAccents(s)));
}

/** L'arbitrage du 04/09 : par sous_type seulement, la matière est écartée. */
const estRobeMaille = (sousType: string | null) => /^robe (pull|maille)/.test(sansAccents(sousType));

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

describe("cohérence des bornes et coût de l'extension aux robes", () => {
  it("passe le catalogue au crible et simule fidèlement l'exclusion des robes de maille", async () => {
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
    console.log(`Catalogue : ${pool.length} pièces.`);

    // ═══ 1 · BORNE CONTRE SAISON DÉCLARÉE ════════════════════════════════
    console.log(`\n════════ 1 · UNE BORNE EXCLUT-ELLE UNE PIÈCE D'UNE SAISON QU'ELLE DÉCLARE ? ════════`);
    console.log(`  Températures de construction : ${CAPSULE_SEASONS.map((s) => `${s} ${representativeWeatherFor(s).temp}°`).join("  ")}`);
    const temp = new Map(CAPSULE_SEASONS.map((s) => [s, representativeWeatherFor(s).temp]));

    type Souci = { id: number; nom: string; cat: string; saison: CapsuleSeason; t: number; min: number | null; max: number | null; motif: string };
    const soucis: Souci[] = [];
    const plagesVides: { id: number; nom: string; min: number; max: number }[] = [];
    let declarantes = 0, bornees = 0;

    for (const it of pool) {
      const r = ligne.get(it.id);
      if (!r) continue;
      const min = r.meteo_min_temp, max = r.meteo_max_temp;
      if (min != null && max != null && min > max) plagesVides.push({ id: r.id, nom: it.name, min, max });
      if (min != null || max != null) bornees += 1;
      const saisons = saisonsDeclarees(r.saison_capsule);
      if (!saisons.length) continue;
      declarantes += 1;
      for (const s of saisons) {
        const t = temp.get(s)!;
        if (max != null && t > max) soucis.push({ id: r.id, nom: it.name, cat: it.cat, saison: s, t, min, max, motif: `max ${max}° < ${t}°` });
        else if (min != null && t < min) soucis.push({ id: r.id, nom: it.name, cat: it.cat, saison: s, t, min, max, motif: `min ${min}° > ${t}°` });
      }
    }

    console.log(`  ${declarantes} pièces déclarent au moins une saison ; ${bornees} portent au moins une borne.`);
    console.log(`\n  PLAGES VIDES (min > max) — incohérence interne, la pièce n'entre nulle part : ${plagesVides.length}`);
    for (const p of plagesVides) console.log(`     id ${String(p.id).padStart(5)}  min ${p.min}° > max ${p.max}°  ${p.nom}`);

    console.log(`\n  EXCLUSIONS SILENCIEUSES : ${soucis.length} couple(s) (pièce × saison déclarée).`);
    const parCat = new Map<string, number>();
    for (const s of soucis) parCat.set(s.cat, (parCat.get(s.cat) ?? 0) + 1);
    if (soucis.length) {
      console.log(`  par catégorie : ${[...parCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join("  ")}`);
      console.log(`\n  ${"id".padStart(6)}  ${"cat".padEnd(11)}${"saison".padEnd(11)}${"motif".padEnd(18)}nom`);
      for (const s of soucis.sort((a, b) => a.cat.localeCompare(b.cat) || a.id - b.id)) {
        console.log(`  ${String(s.id).padStart(6)}  ${s.cat.padEnd(11)}${s.saison.padEnd(11)}${s.motif.padEnd(18)}${s.nom}`);
      }
    }
    console.log(`\n  Lecture : chaque ligne est une pièce absente d'une capsule qu'elle revendique,`);
    console.log(`  sans erreur ni log. AUCUNE correction n'est proposée ici — l'arbitrage porte`);
    console.log(`  sur l'ampleur d'abord.`);

    // ═══ 2 · ROBES DE MAILLE — CE QUE L'EXCLUSION DE L'ÉTÉ COÛTE ═════════
    console.log(`\n════════ 2 · ROBES DE MAILLE — SIMULATION FIDÈLE DE L'EXCLUSION EN ÉTÉ ════════`);
    const visees = pool.filter((it) => it.cat === "robe" && estRobeMaille(ligne.get(it.id)!.sous_type));
    console.log(`  Le prédicat arbitré (sous_type seul) vise ${visees.length} robes :`);
    for (const it of visees) {
      const r = ligne.get(it.id)!;
      console.log(`     id ${String(r.id).padStart(5)}  ${(r.sous_type ?? "—").padEnd(22)}${(r.matiere ?? "—").padEnd(18)}${it.name}`);
    }
    const hors = pool.filter((it) => it.cat === "robe" && !estRobeMaille(ligne.get(it.id)!.sous_type)
      && /maille|tricot/.test(sansAccents(`${ligne.get(it.id)!.sous_type} ${ligne.get(it.id)!.matiere}`)));
    console.log(`  Robes de maille NON visées (hors prédicat, par choix) : ${hors.length}`);
    for (const it of hors) console.log(`     id ${String(ligne.get(it.id)!.id).padStart(5)}  ${(ligne.get(it.id)!.sous_type ?? "—").padEnd(22)}${it.name}`);

    const viseesIds = new Set(visees.map((it) => it.id));
    const poolSansRobesMaille = pool.filter((it) => !viseesIds.has(it.id));

    console.log(`\n  Effet sur la capsule ÉTÉ, style par style :`);
    console.log(`  ${"style".padEnd(20)}${"pièces avant".padStart(14)}${"pièces après".padStart(14)}${"robes visées".padStart(14)}`);
    let totAvant = 0, totApres = 0, totVisees = 0;
    for (const style of STYLES_FEMME) {
      const profil = profilAudit({ gender: "femme", styles: [style] });
      const w = representativeWeatherFor("Été");
      const avant = computeDefaultCapsule(profil, w, [], "Été", pool);
      const apres = computeDefaultCapsule(profil, w, [], "Été", poolSansRobesMaille);
      const n = avant.filter((it) => viseesIds.has(it.id)).length;
      totAvant += avant.length; totApres += apres.length; totVisees += n;
      console.log(`  ${style.padEnd(20)}${String(avant.length).padStart(14)}${String(apres.length).padStart(14)}${String(n).padStart(14)}`);
    }
    console.log(`  ${"TOTAL".padEnd(20)}${String(totAvant).padStart(14)}${String(totApres).padStart(14)}${String(totVisees).padStart(14)}`);
    if (!totVisees) {
      console.log(`\n  >>> AUCUNE des robes visées n'entre aujourd'hui dans une capsule Été.`);
      console.log(`      L'extension serait alors SANS EFFET sur l'Été : elle ne retirerait rien.`);
      console.log(`      À dire tel quel plutôt que de la présenter comme un correctif.`);
    }

    console.log(`\n  Effet sur les tenues d'été (mêmes tirages, seul le pool varie) :`);
    console.log(`  ${"bras".padEnd(20)}${"tenues".padStart(10)}${"cellules".padStart(11)}${"robes visées".padStart(14)}`);
    for (const [nom, p] of [["avant", pool], ["après", poolSansRobesMaille]] as const) {
      let tenues = 0, cellules = 0, avecVisee = 0;
      for (const style of STYLES_FEMME) {
        const w = representativeWeatherFor("Été");
        const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], "Été", p);
        for (const occ of OCCS) {
          let couverte = false;
          for (let k = 0; k < N; k++) {
            const vrai = Math.random;
            Math.random = mulberry32(grainePour(`${style}|${occ}|${k}`));
            let ids: number[];
            try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", "Été").ids; }
            finally { Math.random = vrai; }
            if (!ids.length) continue;
            couverte = true; tenues += 1;
            if (ids.some((id) => viseesIds.has(id))) avecVisee += 1;
          }
          if (couverte) cellules += 1;
        }
      }
      console.log(`  ${nom.padEnd(20)}${String(tenues).padStart(10)}${`${cellules}/${STYLES_FEMME.length * OCCS.length}`.padStart(11)}${String(avecVisee).padStart(14)}`);
    }
    console.log(`  Une couverture qui baisserait serait une régression : l'exclusion ne doit pas`);
    console.log(`  vider une occasion faute de robe de remplacement.`);

    console.log(`\n  LECTURE SEULE. Aucune règle modifiée, aucune donnée touchée.`);
  }, 600_000);
});
