import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { fermetureMaille } from "../src/lib/attributes";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// R-B10, R-S17, MAILLES FERMÉES, ROBES-PULL : CE QUE LES RÈGLES VOIENT
// RÉELLEMENT DU CATALOGUE — LECTURE SEULE.
//
// ÉTAPES 2 et 3 du mandat du 04/09/2026, livrables B à E. Trois règles de
// production comparent `sous_type` par ÉGALITÉ STRICTE à un vocabulaire
// canonique, alors que la colonne est descriptive et libre. Une seule des
// trois a été corrigée (mailles fermées, 31/08) ; les deux autres sont
// mesurées ici AVANT toute modification, comme le mandat l'exige.
//
// CE QUE CE SCRIPT MESURE, ET CE QU'IL NE PEUT PAS MESURER :
//
//   R-B10 est une règle d'ÉVALUATION (evaluateBlocking) doublée d'un filtre
//   de génération. Son avant/après se mesure exactement : les mêmes tenues
//   sont évaluées avec le prédicat actuel puis avec le prédicat candidat.
//
//   R-S17 est une PRÉFÉRENCE DE GÉNÉRATION. Élargir sa détection changerait
//   les tenues produites, ce qui demande un levier de mesure en production —
//   qui n'existe pas et que le mandat interdit d'ajouter ici. Son avant/après
//   se mesure donc sur la COUVERTURE DE DÉTECTION (combien de pièces la règle
//   voit), pas sur les tenues. La distinction est dite, pas contournée.
//
// Le prédicat candidat n'est écrit nulle part en production : il vit dans ce
// script, le temps de la mesure. Aucune règle n'est modifiée.
//
// Aucune écriture, aucun ALTER, aucun fichier de production touché.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

// ── PRÉDICATS ACTUELS, recopiés à l'identique depuis logic.ts ──
const chemiseActuel = (it: Item) => it.subtype === "Chemise" || it.subtype === "Chemisier";
/** R-S17 côté robe : le filtre de génération compare à "Chemise" SEUL. */
const robeChemiseActuel = (it: Item) => it.subtype === "Chemise";

// ── PRÉDICATS CANDIDATS, par préfixe normalisé, définis ICI seulement ──
//
// Le préfixe est retenu plutôt que l'inclusion : « chemise » en tête de
// sous_type désigne le vêtement, alors qu'au milieu il qualifie souvent autre
// chose (« robe chemise », « veste chemise »). Une inclusion large
// attraperait ces pièces-là et changerait la règle au lieu de la réparer.
const chemiseCandidat = (it: Item) => /^chemis/.test(sansAccents(it.subtype));
const robeChemiseCandidat = (it: Item) => /^robe chemis/.test(sansAccents(it.subtype));

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

describe("ce que R-B10, R-S17 et la règle des mailles voient du catalogue", () => {
  it("mesure la couverture de détection avant et après, sans modifier aucune règle", async () => {
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

    // ═══ B · MAILLES FERMÉES — CE QUE LA RÈGLE CORRIGÉE VOIT ═════════════
    console.log(`\n════════ B · MAILLES FERMÉES — CLASSIFICATION DES SOUS-TYPES RÉELS ════════`);
    console.log(`  La règle est DÉJÀ corrigée en production (fermetureMaille, 31/08). Ce qui`);
    console.log(`  suit est son résultat sur les données réelles, pas une proposition.`);
    const pulls = pool.filter((it) => it.cat === "pull");
    const parSousType = new Map<string, { n: number; f: ReturnType<typeof fermetureMaille> }>();
    for (const it of pulls) {
      const st = ligne.get(it.id)!.sous_type ?? "(vide)";
      const e = parSousType.get(st) ?? { n: 0, f: fermetureMaille(it) };
      e.n += 1;
      parSousType.set(st, e);
    }
    console.log(`  ${pulls.length} pièces de catégorie « pull », ${parSousType.size} sous-types distincts.`);
    console.log(`  ${"sous_type".padEnd(32)}${"n".padStart(4)}   classification`);
    for (const [st, e] of [...parSousType.entries()].sort((a, b) => (a[1].f ?? "z").localeCompare(b[1].f ?? "z") || a[0].localeCompare(b[0]))) {
      console.log(`  ${st.slice(0, 31).padEnd(32)}${String(e.n).padStart(4)}   ${e.f ?? "NON CLASSÉE  <- ambiguë, à arbitrer"}`);
    }
    const nf = pulls.filter((it) => fermetureMaille(it) === "fermée").length;
    const no = pulls.filter((it) => fermetureMaille(it) === "ouverte").length;
    console.log(`\n  fermées ${nf} · ouvertes ${no} · NON CLASSÉES ${pulls.length - nf - no}`);
    console.log(`  Une pièce non classée n'est ni interdite ni autorisée : elle échappe à la`);
    console.log(`  règle. C'est le seul endroit où un arbitrage reste à prendre.`);

    // ═══ E · ROBES-PULL — INVISIBLES À LA RÈGLE ══════════════════════════
    console.log(`\n════════ E · ROBES DE MAILLE — CE QUE fermetureMaille NE VOIT PAS ════════`);
    console.log(`  fermetureMaille renvoie null hors de cat === "pull". Une robe-pull est donc`);
    console.log(`  invisible, quelle que soit sa maille. Voici les robes concernées.`);
    const robes = pool.filter((it) => it.cat === "robe");
    const robesMaille = robes.filter((it) => {
      const r = ligne.get(it.id)!;
      return /maille|pull|tricot/.test(sansAccents(`${r.sous_type} ${r.matiere} ${it.name}`));
    });
    console.log(`  ${robes.length} robes au catalogue, dont ${robesMaille.length} évoquant la maille :`);
    console.log(`  ${"id".padStart(6)}  ${"sous_type".padEnd(26)}${"matiere".padEnd(20)}nom`);
    for (const it of robesMaille) {
      const r = ligne.get(it.id)!;
      console.log(`  ${String(r.id).padStart(6)}  ${(r.sous_type ?? "—").slice(0, 25).padEnd(26)}${(r.matiere ?? "—").slice(0, 19).padEnd(20)}${it.name}`);
    }
    console.log(`  fermetureMaille les classe toutes : null (aucune n'est de catégorie « pull »).`);

    // ═══ C · R-B10 — DEUX CHEMISES ═══════════════════════════════════════
    console.log(`\n════════ C · R-B10 — COUVERTURE DE DÉTECTION ════════`);
    const hauts = pool.filter((it) => it.cat === "haut");
    const vusActuel = hauts.filter(chemiseActuel);
    const vusCandidat = hauts.filter(chemiseCandidat);
    const ajoutees = vusCandidat.filter((it) => !chemiseActuel(it));
    const perdues = vusActuel.filter((it) => !chemiseCandidat(it));
    console.log(`  hauts au catalogue : ${hauts.length}`);
    console.log(`  vus par le prédicat ACTUEL (égalité stricte)   : ${vusActuel.length}`);
    console.log(`  vus par le prédicat CANDIDAT (préfixe normalisé) : ${vusCandidat.length}`);
    console.log(`  pièces AJOUTÉES par le candidat : ${ajoutees.length}`);
    for (const it of ajoutees) console.log(`     id ${String(ligne.get(it.id)!.id).padStart(5)}  ${(ligne.get(it.id)!.sous_type ?? "—").padEnd(28)}${it.name}`);
    console.log(`  pièces PERDUES par le candidat : ${perdues.length}${perdues.length ? "  <- RÉGRESSION, ne pas livrer en l'état" : "  (aucune régression)"}`);
    for (const it of perdues) console.log(`     id ${String(ligne.get(it.id)!.id).padStart(5)}  ${(ligne.get(it.id)!.sous_type ?? "—").padEnd(28)}${it.name}`);
    console.log(`\n  Contrôle de périmètre — pièces NON « haut » que le candidat attraperait :`);
    const horsHaut = pool.filter((it) => it.cat !== "haut" && chemiseCandidat(it));
    console.log(`  ${horsHaut.length} pièce(s). R-B10 ne filtre pas par catégorie : toute pièce vue compte.`);
    for (const it of horsHaut) console.log(`     ${it.cat.padEnd(10)} id ${String(ligne.get(it.id)!.id).padStart(5)}  ${(ligne.get(it.id)!.sous_type ?? "—").padEnd(28)}${it.name}`);

    // Effet sur des tenues réelles — même tirage, deux prédicats.
    console.log(`\n  EFFET SUR LES TENUES (mêmes tirages, seul le prédicat varie) :`);
    const cellules: { saison: CapsuleSeason; style: string; capsule: CatalogItem[]; w: ReturnType<typeof representativeWeatherFor> }[] = [];
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        cellules.push({ saison, style, w, capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool) });
      }
    }
    let tenues = 0, hitActuel = 0, hitCandidat = 0, festives = 0, festiveChemiseActuel = 0, festiveChemiseCandidat = 0;
    for (const c of cellules) {
      for (const occ of OCCS) {
        for (let k = 0; k < N; k++) {
          const vrai = Math.random;
          Math.random = mulberry32(grainePour(`${c.saison}|${c.style}|${occ}|${k}`));
          let ids: number[];
          try {
            ids = generateOutfitWithFallback(c.capsule, c.w, occ, "Présentiel", "Verre", [], "femme", c.saison).ids;
          } finally { Math.random = vrai; }
          if (!ids.length) continue;
          tenues += 1;
          const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];
          if (pieces.filter(chemiseActuel).length >= 2) hitActuel += 1;
          if (pieces.filter(chemiseCandidat).length >= 2) hitCandidat += 1;
          if (occ === "festive") {
            festives += 1;
            if (pieces.some((p) => (p.cat === "haut" && chemiseActuel(p)) || (p.cat === "robe" && robeChemiseActuel(p)))) festiveChemiseActuel += 1;
            if (pieces.some((p) => (p.cat === "haut" && chemiseCandidat(p)) || (p.cat === "robe" && robeChemiseCandidat(p)))) festiveChemiseCandidat += 1;
          }
        }
      }
    }
    console.log(`  ${tenues} tenues générées (bras production, aucun levier).`);
    console.log(`  tenues signalées R-B10 par le prédicat ACTUEL   : ${hitActuel}`);
    console.log(`  tenues signalées R-B10 par le prédicat CANDIDAT : ${hitCandidat}`);
    console.log(`  Écart : ${hitCandidat - hitActuel} tenue(s) aujourd'hui produites SANS être signalées.`);

    // ═══ D · R-S17 — ROBES CHEMISES ══════════════════════════════════════
    console.log(`\n════════ D · R-S17 — COUVERTURE DE DÉTECTION ════════`);
    const robeVueActuel = robes.filter(robeChemiseActuel);
    const robeVueCandidat = robes.filter(robeChemiseCandidat);
    console.log(`  robes au catalogue : ${robes.length}`);
    console.log(`  robes chemises vues par le prédicat ACTUEL (subtype === "Chemise") : ${robeVueActuel.length}`);
    console.log(`  robes chemises vues par le prédicat CANDIDAT (préfixe "robe chemis") : ${robeVueCandidat.length}`);
    for (const it of robeVueCandidat) console.log(`     id ${String(ligne.get(it.id)!.id).padStart(5)}  ${(ligne.get(it.id)!.sous_type ?? "—").padEnd(28)}${it.name}`);
    console.log(`\n  EFFET SUR LES SORTIES FESTIVES :`);
    console.log(`  ${festives} tenues festives générées.`);
    console.log(`  contenant une chemise/robe chemise VUE par le prédicat actuel   : ${festiveChemiseActuel}`);
    console.log(`  contenant une chemise/robe chemise VUE par le prédicat candidat : ${festiveChemiseCandidat}`);
    console.log(`  LIMITE ASSUMÉE : R-S17 est une préférence de GÉNÉRATION. Ces deux chiffres`);
    console.log(`  disent ce que la règle VERRAIT, pas ce qu'elle produirait. Mesurer l'effet`);
    console.log(`  réel demanderait un levier en production, que le mandat interdit d'ajouter`);
    console.log(`  à ce stade. Ne pas lire le second chiffre comme « tenues corrigées ».`);

    console.log(`\n  LECTURE SEULE. Aucune règle modifiée, aucune donnée touchée. Les prédicats`);
    console.log(`  candidats n'existent que dans ce script.`);
  }, 600_000);
});
