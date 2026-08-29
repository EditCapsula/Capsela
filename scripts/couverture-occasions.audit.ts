import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import {
  CAPSULE_MAX_PIECES, capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor, styleFit,
} from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS, isSunny, type Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey, OutfitFailureReason } from "../src/lib/types";
import { STYLE_ID_TO_CATALOG_LABEL, type StyleId } from "../src/lib/profile";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE 15 — CHANTIER B : COUVERTURE D'OCCASION RÉELLE. LECTURE SEULE.
//
// La phase 12 mesurait 8,6 occasions couvertes sur 10, et le critère
// d'acceptation du plafond de 40 disait 10/10. Les deux chiffres ne parlent
// pas de la même chose et aucun des deux n'est la promesse produit :
//
//   PORTÉE  — au moins une pièce de la capsule déclare l'occasion. C'est la
//             métrique de la phase 12. Elle ne garantit AUCUNE tenue : une
//             capsule peut « porter » festive par une seule paire d'escarpins
//             sans qu'aucun haut ni bas n'atteigne le palier.
//   TENUE   — generateOutfitWithFallback produit une tenue complète. C'est ce
//             que l'utilisateur voit. C'est la seule métrique qui engage.
//
// Cet audit mesure les deux, et pour chaque occasion non couverte remonte
// l'entonnoir jusqu'à l'étage responsable. Les filtres sont reproduits à
// l'identique de computeDefaultCapsule (soleil R-B15, genre, saison,
// température, style, palette) à partir des mêmes helpers exportés — jamais
// réécrits, pour qu'ils ne puissent pas diverger silencieusement.
//
// Le plafond de 40 est structurellement hors de cause pour la PORTÉE :
// respecterBudget refuse de libérer toute pièce dont le retrait ferait perdre
// une occasion (capsule.ts, `if (occasionsOf(it).some((o) => !occReste.has(o))) continue`).
// La mesure le corrobore en croisant taille de capsule et occasions perdues.
// Pour la TENUE, le plafond peut en principe retirer un partenaire compatible :
// ce cas n'est pas décidable sans une couture supplémentaire, il est donc
// rapporté comme NON DÉMONTRÉ plutôt que deviné.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const FORMALITE_OCC = new Map<OccasionKey, number>(OCCASIONS.map(([k, , , f]) => [k, f]));
/** Répétitions de la génération de tenue — generateOutfit est stochastique, la capsule ne l'est pas. */
const REPETITIONS = 5;
const TIRAGES = 20;

const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
/** Demi-largeur d'un intervalle à ~95 % sur les répétitions (t≈2,78 à 4 ddl). */
const demiIC = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = moy(xs);
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
  return (2.78 * sd) / Math.sqrt(xs.length);
};

/** Étages de l'entonnoir, reproduits à l'identique de computeDefaultCapsule. */
function entonnoir(pool: CatalogItem[], style: StyleId, saison: CapsuleSeason, w: Weather) {
  const etages: { nom: string; pieces: CatalogItem[] }[] = [];
  let base = pool;
  etages.push({ nom: "catalogue", pieces: base });

  if (!isSunny(w)) base = base.filter((it) => !it.necessiteSoleil);
  etages.push({ nom: "soleil", pieces: base });

  const noHomme = base.filter((it) => it.genre !== "homme");
  if (noHomme.length >= 16) base = noHomme;
  etages.push({ nom: "genre", pieces: base });

  const bucket = capsuleSeasonBucket(saison);
  const seasonFit = base.filter((it) => it.season === bucket || it.season === "Toutes saisons");
  if (seasonFit.length >= 16) base = seasonFit;
  etages.push({ nom: "saison", pieces: base });

  const temp = w.temp;
  const tempFit = base.filter(
    (it) => (it.meteoMinTemp == null || temp >= it.meteoMinTemp) && (it.meteoMaxTemp == null || temp <= it.meteoMaxTemp),
  );
  if (tempFit.length >= 16) base = tempFit;
  etages.push({ nom: "temp", pieces: base });

  // Filtre de style — mêmes exemptions fonctionnelles que la production.
  const label = STYLE_ID_TO_CATALOG_LABEL[style];
  const isSportEssential = (it: Item) =>
    (it.cat === "accessoire" && it.accessoireType === "Gourde") || (it.cat === "sac" && it.sacType === "Sac de sport");
  let curated = base.filter((it) => isSportEssential(it) || styleFit(it, label));
  const fallback = curated.length < 18;
  if (fallback) curated = base;
  etages.push({ nom: "style", pieces: curated });

  // Le bloc Sport est repris sur `base` (jamais sur `curated`) : une occasion
  // sport reste atteignable même si le catalogue sport ne matche pas le style.
  const atteignable = [...new Set([...curated, ...base.filter((it) => formalityOf(it) === 0)])];
  etages.push({ nom: "atteignable", pieces: atteignable });

  return { etages, fallback, atteignable };
}

type Cause = "CATALOGUE" | "SAISON" | "STYLE" | "SÉLECTION" | "PLAFOND" | "COUVERTE";

describe("Phase 15 — couverture d'occasion réelle", () => {
  it("mesure la portée, la tenue, et impute chaque manque à un étage", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    // Garde-fou du chantier A : un libellé orphelin viderait le pool de style
    // et ferait retomber la mesure sur un pool universel, en silence.
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`\nCatalogue exploitable : ${pool.length} pièces (${rows.length - brutes.length} gelées exclues).`);
    console.log(`Grille : ${SAISONS.length} saisons × ${STYLES_FEMME.length} styles × ${OCCS.length} occasions = ${SAISONS.length * STYLES_FEMME.length * OCCS.length} cellules.`);

    // ═══ 1 · COUVERTURE PAR SAISON × STYLE ═══
    interface Cellule {
      saison: CapsuleSeason; style: StyleId; occ: OccasionKey;
      portee: boolean; nPortee: number;
      tauxTenue: number[]; degrade: number[]; raisons: Map<OutfitFailureReason, number>;
      cause: Cause; etages: number[]; fallback: boolean; taille: number;
    }
    const cellules: Cellule[] = [];
    const tailles: number[] = [];

    for (const saison of SAISONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        const p = profilAudit({ gender: "femme", styles: [style] });
        const capsule = computeDefaultCapsule(p, w, [], saison, pool);
        const { etages, fallback, atteignable } = entonnoir(pool, style, saison, w);
        tailles.push(capsule.length);

        for (const occ of OCCS) {
          const dansCapsule = capsule.filter((it) => occasionsDe(it).includes(occ));
          const compte = etages.map((e) => e.pieces.filter((it) => occasionsDe(it).includes(occ)).length);
          const nAtteignable = atteignable.filter((it) => occasionsDe(it).includes(occ)).length;

          // Génération de tenue, répétée : seule métrique qui engage.
          const tauxTenue: number[] = [];
          const degrade: number[] = [];
          const raisons = new Map<OutfitFailureReason, number>();
          for (let r = 0; r < REPETITIONS; r++) {
            let ok = 0, dg = 0;
            for (let k = 0; k < TIRAGES; k++) {
              const res = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme");
              if (res.ids.length) { ok += 1; if (res.formalityDowngraded) dg += 1; }
              else if (res.reason) raisons.set(res.reason, (raisons.get(res.reason) ?? 0) + 1);
            }
            tauxTenue.push(ok / TIRAGES);
            degrade.push(ok ? dg / ok : 0);
          }

          // Imputation. L'ordre suit l'entonnoir : le premier étage qui met le
          // compte à zéro est le responsable, les suivants n'y peuvent rien.
          let cause: Cause;
          if (dansCapsule.length) cause = "COUVERTE";
          else if (compte[0] === 0) cause = "CATALOGUE";
          else if (compte[4] === 0) cause = "SAISON";
          else if (nAtteignable === 0) cause = "STYLE";
          else cause = "SÉLECTION";

          cellules.push({
            saison, style, occ, portee: dansCapsule.length > 0, nPortee: dansCapsule.length,
            tauxTenue, degrade, raisons, cause, etages: compte, fallback, taille: capsule.length,
          });
        }
      }
    }

    // ═══ 2 · PORTÉE PAR SAISON × STYLE ═══
    console.log(`\n════════ 1 · PORTÉE — occasions portées par ≥1 pièce (métrique phase 12) ════════`);
    console.log(`  ${"saison".padEnd(11)}${STYLES_FEMME.map((s) => s.slice(0, 9).padStart(10)).join("")}${"moy.".padStart(8)}`);
    for (const saison of SAISONS) {
      const parStyle = STYLES_FEMME.map((style) =>
        cellules.filter((c) => c.saison === saison && c.style === style && c.portee).length);
      console.log(`  ${saison.padEnd(11)}${parStyle.map((n) => `${n}/10`.padStart(10)).join("")}${moy(parStyle).toFixed(1).padStart(8)}`);
    }
    const porteeGlobale = cellules.filter((c) => c.portee).length / (SAISONS.length * STYLES_FEMME.length);
    console.log(`\n  Moyenne toutes saisons × styles : ${porteeGlobale.toFixed(2)}/10`);

    // ═══ 3 · TENUE PAR SAISON × STYLE ═══
    console.log(`\n════════ 2 · TENUE — occasions pour lesquelles une tenue complète existe ════════`);
    console.log(`  (une occasion compte comme couverte si le taux de réussite moyen est > 0)`);
    console.log(`  ${"saison".padEnd(11)}${STYLES_FEMME.map((s) => s.slice(0, 9).padStart(10)).join("")}${"moy.".padStart(8)}`);
    for (const saison of SAISONS) {
      const parStyle = STYLES_FEMME.map((style) =>
        cellules.filter((c) => c.saison === saison && c.style === style && moy(c.tauxTenue) > 0).length);
      console.log(`  ${saison.padEnd(11)}${parStyle.map((n) => `${n}/10`.padStart(10)).join("")}${moy(parStyle).toFixed(1).padStart(8)}`);
    }
    const tenueGlobale = cellules.filter((c) => moy(c.tauxTenue) > 0).length / (SAISONS.length * STYLES_FEMME.length);
    console.log(`\n  Moyenne toutes saisons × styles : ${tenueGlobale.toFixed(2)}/10`);

    // ═══ 4 · PLANCHER DE BRUIT ═══
    console.log(`\n════════ 3 · PLANCHER DE BRUIT (${REPETITIONS} répétitions × ${TIRAGES} tirages) ════════`);
    console.log(`  La capsule est déterministe (départage final par -id) : la PORTÉE n'a aucun bruit.`);
    console.log(`  Seule la génération de tenue est stochastique. Demi-largeur IC 95 % du taux de réussite :`);
    const ics = cellules.filter((c) => moy(c.tauxTenue) > 0 && moy(c.tauxTenue) < 1).map((c) => demiIC(c.tauxTenue));
    console.log(`  cellules partiellement couvertes : ${ics.length} — IC moyen ±${(moy(ics) * 100).toFixed(1)} pts, max ±${(Math.max(0, ...ics) * 100).toFixed(1)} pts`);
    const instables = cellules.filter((c) => c.tauxTenue.some((t) => t === 0) && c.tauxTenue.some((t) => t > 0));
    console.log(`  cellules qui basculent couvert/non couvert entre répétitions : ${instables.length}`);
    for (const c of instables.slice(0, 10)) {
      console.log(`    ${c.saison} · ${c.style} · ${c.occ} — taux ${c.tauxTenue.map((t) => t.toFixed(2)).join(" ")}`);
    }

    // ═══ 5 · IMPUTATION ═══
    console.log(`\n════════ 4 · IMPUTATION DES OCCASIONS NON PORTÉES ════════`);
    const parCause = new Map<Cause, Cellule[]>();
    for (const c of cellules) parCause.set(c.cause, [...(parCause.get(c.cause) ?? []), c]);
    const nonPortees = cellules.filter((c) => !c.portee);
    console.log(`  ${nonPortees.length} cellules non portées sur ${cellules.length} (${pct(nonPortees.length, cellules.length)}).`);
    for (const cause of ["CATALOGUE", "SAISON", "STYLE", "SÉLECTION"] as Cause[]) {
      const l = parCause.get(cause) ?? [];
      console.log(`  ${cause.padEnd(11)}${String(l.length).padStart(5)}${pct(l.length, nonPortees.length).padStart(9)}`);
    }

    console.log(`\n  Détail par occasion :`);
    console.log(`  ${"occasion".padEnd(18)}${"form.".padStart(6)}${"portée".padStart(9)}${"tenue".padStart(9)}${"CATAL".padStart(7)}${"SAIS".padStart(6)}${"STYLE".padStart(7)}${"SÉLEC".padStart(7)}`);
    for (const occ of OCCS) {
      const l = cellules.filter((c) => c.occ === occ);
      const n = l.length;
      const co = (cause: Cause) => l.filter((c) => c.cause === cause).length;
      console.log(
        `  ${occ.padEnd(18)}${String(FORMALITE_OCC.get(occ)).padStart(6)}` +
        `${pct(l.filter((c) => c.portee).length, n).padStart(9)}` +
        `${pct(l.filter((c) => moy(c.tauxTenue) > 0).length, n).padStart(9)}` +
        `${String(co("CATALOGUE")).padStart(7)}${String(co("SAISON")).padStart(6)}${String(co("STYLE")).padStart(7)}${String(co("SÉLECTION")).padStart(7)}`,
      );
    }

    // ═══ 6 · ENTONNOIRS DÉTAILLÉS ═══
    console.log(`\n════════ 5 · ENTONNOIRS DES OCCASIONS LES PLUS MANQUÉES ════════`);
    const rang = OCCS.map((occ) => ({ occ, manques: cellules.filter((c) => c.occ === occ && !c.portee).length }))
      .filter((r) => r.manques > 0).sort((a, b) => b.manques - a.manques);
    for (const { occ, manques } of rang) {
      console.log(`\n  ── ${occ} (${manques} cellules non portées, formalité ${FORMALITE_OCC.get(occ)}) ──`);
      console.log(`     ${"saison".padEnd(11)}${"style".padEnd(16)}${"catal".padStart(7)}${"soleil".padStart(8)}${"genre".padStart(7)}${"saison".padStart(8)}${"temp".padStart(6)}${"style".padStart(7)}${"atteig".padStart(8)}${"caps".padStart(6)}${"cause".padStart(11)}${"repli".padStart(7)}`);
      for (const c of cellules.filter((x) => x.occ === occ && !x.portee)) {
        const nAtt = c.etages[6];
        console.log(
          `     ${c.saison.padEnd(11)}${c.style.padEnd(16)}` +
          c.etages.slice(0, 6).map((n, i) => String(n).padStart([7, 8, 7, 8, 6, 7][i])).join("") +
          `${String(nAtt).padStart(8)}${String(c.nPortee).padStart(6)}${c.cause.padStart(11)}${(c.fallback ? "oui" : "non").padStart(7)}`,
        );
      }
    }

    // ═══ 7 · TENUE SANS PORTÉE, ET PORTÉE SANS TENUE ═══
    console.log(`\n════════ 6 · ÉCART ENTRE PORTÉE ET TENUE ════════`);
    const porteeSansTenue = cellules.filter((c) => c.portee && moy(c.tauxTenue) === 0);
    const tenueSansPortee = cellules.filter((c) => !c.portee && moy(c.tauxTenue) > 0);
    console.log(`  Portée mais AUCUNE tenue possible : ${porteeSansTenue.length} cellules — la métrique 8,6/10 les compte comme couvertes.`);
    for (const c of porteeSansTenue) {
      const r = [...c.raisons.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(", ");
      console.log(`    ${c.saison.padEnd(11)}${c.style.padEnd(16)}${c.occ.padEnd(18)}${c.nPortee} pièce(s) — ${r || "—"}`);
    }
    console.log(`\n  Non portée mais tenue possible : ${tenueSansPortee.length} cellules (repli de formalité, ou occasion déduite).`);
    for (const c of tenueSansPortee.slice(0, 15)) {
      console.log(`    ${c.saison.padEnd(11)}${c.style.padEnd(16)}${c.occ.padEnd(18)}taux ${moy(c.tauxTenue).toFixed(2)}, repli ${pct(moy(c.degrade) * 100, 100)}`);
    }

    // ═══ 8 · REPLI DE FORMALITÉ ═══
    console.log(`\n════════ 7 · REPLI DE FORMALITÉ (tenue produite à un palier inférieur) ════════`);
    console.log(`  ${"occasion".padEnd(18)}${"form.".padStart(6)}${"taux tenue".padStart(12)}${"dont repli".padStart(12)}`);
    for (const occ of OCCS) {
      const l = cellules.filter((c) => c.occ === occ);
      console.log(`  ${occ.padEnd(18)}${String(FORMALITE_OCC.get(occ)).padStart(6)}` +
        `${pct(moy(l.map((c) => moy(c.tauxTenue))) * 100, 100).padStart(12)}${pct(moy(l.map((c) => moy(c.degrade))) * 100, 100).padStart(12)}`);
    }

    // ═══ 9 · LE PLAFOND EST-IL EN CAUSE ? ═══
    console.log(`\n════════ 8 · PLAFOND DE 40 ════════`);
    console.log(`  Tailles de capsule : min ${Math.min(...tailles)}, moy ${moy(tailles).toFixed(1)}, max ${Math.max(...tailles)} (plafond ${CAPSULE_MAX_PIECES}).`);
    const auPlafond = cellules.filter((c) => c.taille >= CAPSULE_MAX_PIECES);
    const sousPlafond = cellules.filter((c) => c.taille < CAPSULE_MAX_PIECES);
    const tx = (l: Cellule[]) => (l.length ? l.filter((c) => !c.portee).length / l.length : 0);
    console.log(`  Cellules issues d'une capsule AU plafond   : ${auPlafond.length} — ${pct(auPlafond.filter((c) => !c.portee).length, auPlafond.length)} non portées`);
    console.log(`  Cellules issues d'une capsule SOUS le plafond : ${sousPlafond.length} — ${pct(sousPlafond.filter((c) => !c.portee).length, sousPlafond.length)} non portées`);
    console.log(`  Écart : ${((tx(auPlafond) - tx(sousPlafond)) * 100).toFixed(1)} points.`);
    console.log(`  Rappel du code : respecterBudget ne libère jamais une pièce dont le retrait ferait`);
    console.log(`  perdre une occasion. Le plafond ne peut donc PAS causer une perte de PORTÉE.`);
    console.log(`  Effet du plafond sur la TENUE (retrait d'un partenaire compatible) : NON DÉMONTRÉ`);
    console.log(`  — il faudrait une couture exposant la capsule avant budget, hors périmètre de cette phase.`);
  }, 900_000);
});
