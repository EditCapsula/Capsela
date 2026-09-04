import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// ET SI L'APPARTENANCE À UNE CAPSULE SE DÉCIDAIT SUR LA SAISON DÉCLARÉE ?
// LECTURE SEULE.
//
// CE QUI EST DÉJÀ ÉTABLI, et qu'il ne faut donc pas remesurer :
//
//   · `meteo_max_temp` est lu de deux façons. logic.ts applique la définition
//     de l'utilisatrice — au-delà de la borne, la pièce est écartée de la
//     tenue. capsule.ts en fait un critère d'APPARTENANCE : la pièce doit
//     couvrir la température représentative de la saison.
//   · Retirer purement et simplement ce second usage est REFUSÉ par la mesure
//     du 04/09 : « hors borne » passe de 0 à 93 (22 °) et 86 (27 °), les
//     collants mi-saison reviennent en capsule Été, et 14 couples pièce ×
//     saison sont réintégrés hors de toute déclaration.
//   · La cause est identifiée : `capsuleSeasonBucket` écrase les QUATRE
//     saisons de capsule sur TROIS buckets. Printemps et Été partagent le même
//     vivier, et la borne haute est le seul filtre fin qui reste pour les
//     distinguer. Toutes les pièces réintégrées à tort en Été déclarent le
//     Printemps et jamais l'Été.
//
// L'HYPOTHÈSE MESURÉE ICI. Si l'appartenance se décide sur `saison_capsule`
// — la colonne qui répond déjà à cette question, et qui distingue les quatre
// saisons — alors la borne haute n'a plus à jouer ce rôle et peut retrouver
// le sens que l'utilisatrice lui donne.
//
// Le bras C retire donc du vivier de la saison S toute pièce qui ne déclare
// pas S, et cesse d'utiliser la borne haute pour l'appartenance. Le retrait
// porte sur le POOL passé à computeDefaultCapsule, ce qui couvre aussi les
// filets `ensure()` — lesquels ne filtrent aujourd'hui sur aucune saison.
// Une pièce dont la déclaration est vide ou illisible est CONSERVÉE : sans
// information, on ne retire rien. Les identifiants obtenus sont remappés sur
// les pièces originales, bornes comprises, pour générer les tenues.
//
// La borne BASSE n'est pas touchée : la question porte sur la haute.
//
// CE QUE LA MESURE PRÉCÉDENTE N'AVAIT PAS FAIT, et qui est corrigé ici : la
// capsule étant plafonnée, 26 pièces entraient et 26 sortaient sans que
// l'audit dise lesquelles. Les SORTANTS sont donc listés au même titre que
// les entrants — un gain qui déloge une pièce mieux adaptée n'est pas un gain.
//
// L'occasion sert aussi à tester une hypothèse restée en dette : les manteaux
// « morts partout » le seraient parce qu'une doudoune bornée à 5 ° n'entre pas
// dans une capsule d'hiver bâtie à 6 °. Le bras C doit donc les ressusciter.
// C'est une PRÉDICTION, écrite avant de lire le résultat.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/**
 * Les saisons réellement déclarées. Une valeur comme « Toutes saisons » ne
 * nomme aucune des quatre : elle rend donc une liste vide, ce qui vaut
 * ABSENCE D'INFORMATION et non exclusion — la pièce sera conservée partout.
 * C'est aussi la correction d'un faux positif de l'audit précédent, qui
 * comptait ces pièces comme réintégrées « hors déclaration ».
 */
function saisonsDeclarees(raw: string | null): CapsuleSeason[] {
  const jetons = (raw ?? "").split(/[,;|]/).map((s) => sansAccents(s)).filter(Boolean);
  return CAPSULE_SEASONS.filter((s) => jetons.includes(sansAccents(s)));
}

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

const meteoReelle = (temp: number): Weather => ({
  season: temp >= 18 ? "Printemps / Été" : "Automne / Hiver", temp, label: `journée ${temp} °`,
  seasons: ["Printemps / Été", "Automne / Hiver", "Toutes saisons"],
} as unknown as Weather);

describe("l'appartenance à une capsule décidée sur la saison déclarée", () => {
  it("mesure entrants, sortants, couverture, tenue du jour et mortalité", async () => {
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
    const declarees = new Map(pool.map((it) => [it.id, saisonsDeclarees(ligne.get(it.id)?.saison_capsule ?? null)]));
    const sansInfo = pool.filter((it) => !declarees.get(it.id)!.length).length;
    console.log(`Catalogue : ${pool.length} pièces, dont ${sansInfo} sans saison déclarée lisible (conservées partout).`);

    /** Le pool du bras C pour une saison : déclaration seule, borne haute retirée. */
    const poolDeclare = (saison: CapsuleSeason): CatalogItem[] =>
      pool
        .filter((it) => { const d = declarees.get(it.id)!; return !d.length || d.includes(saison); })
        .map((it) => ({ ...it, meteoMaxTemp: undefined }));

    const capsulePour = (bras: "A" | "C", style: string, saison: CapsuleSeason): CatalogItem[] => {
      const src = bras === "A" ? pool : poolDeclare(saison);
      const c = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, src);
      return c.map((it) => index.get(it.id)).filter((x): x is CatalogItem => Boolean(x));
    };

    // ═══ 1 · ENTRANTS ET SORTANTS ════════════════════════════════════════
    console.log(`\n════════ 1 · COMPOSITION DES CAPSULES ════════`);
    console.log(`  ${"saison".padEnd(12)}${"A".padStart(8)}${"C".padStart(8)}${"écart".padStart(8)}${"entrants".padStart(11)}${"sortants".padStart(11)}`);
    const entrants = new Map<number, Set<CapsuleSeason>>();
    const sortants = new Map<number, Set<CapsuleSeason>>();
    for (const saison of CAPSULE_SEASONS) {
      let a = 0, c = 0, e = 0, s = 0;
      for (const style of STYLES_FEMME) {
        const ca = capsulePour("A", style, saison), cc = capsulePour("C", style, saison);
        a += ca.length; c += cc.length;
        const idsA = new Set(ca.map((it) => it.id)), idsC = new Set(cc.map((it) => it.id));
        for (const it of cc) if (!idsA.has(it.id)) { e += 1; entrants.set(it.id, (entrants.get(it.id) ?? new Set()).add(saison)); }
        for (const it of ca) if (!idsC.has(it.id)) { s += 1; sortants.set(it.id, (sortants.get(it.id) ?? new Set()).add(saison)); }
      }
      console.log(`  ${saison.padEnd(12)}${String(a).padStart(8)}${String(c).padStart(8)}${((c - a >= 0 ? "+" : "") + (c - a)).padStart(8)}${String(e).padStart(11)}${String(s).padStart(11)}`);
    }

    const fiche = (id: number, saisons: Set<CapsuleSeason>) => {
      const it = index.get(id)!, r = ligne.get(id)!;
      return `  ${String(r.id).padStart(6)}  ${it.cat.padEnd(11)}${String(it.meteoMaxTemp ?? "—").padStart(5)}  ${[...saisons].join(", ").padEnd(28)}${(r.saison_capsule ?? "—").slice(0, 27).padEnd(28)}${it.name}`;
    };
    console.log(`\n  ENTRANTS — ${entrants.size} pièces distinctes :`);
    console.log(`  ${"id".padStart(6)}  ${"cat".padEnd(11)}${"max".padStart(5)}  ${"saisons gagnées".padEnd(28)}${"saisons déclarées".padEnd(28)}nom`);
    for (const [id, s] of [...entrants.entries()].sort((x, y) => index.get(x[0])!.cat.localeCompare(index.get(y[0])!.cat) || x[0] - y[0])) console.log(fiche(id, s));

    console.log(`\n  SORTANTS — ${sortants.size} pièces distinctes. C'est le coût du bras C :`);
    console.log(`  une pièce qui sort d'une capsule qu'elle DÉCLARE serait une régression.`);
    console.log(`  ${"id".padStart(6)}  ${"cat".padEnd(11)}${"max".padStart(5)}  ${"saisons perdues".padEnd(28)}${"saisons déclarées".padEnd(28)}nom`);
    let sortiesDeclarees = 0;
    for (const [id, s] of [...sortants.entries()].sort((x, y) => index.get(x[0])!.cat.localeCompare(index.get(y[0])!.cat) || x[0] - y[0])) {
      console.log(fiche(id, s));
      for (const sa of s) if (declarees.get(id)!.includes(sa)) sortiesDeclarees += 1;
    }
    console.log(`  >>> sorties d'une saison POURTANT déclarée : ${sortiesDeclarees}`);
    let entreesHorsDeclaration = 0;
    for (const [id, s] of entrants) for (const sa of s) if (declarees.get(id)!.length && !declarees.get(id)!.includes(sa)) entreesHorsDeclaration += 1;
    console.log(`  >>> entrées HORS déclaration : ${entreesHorsDeclaration}  (doit être 0 par construction — contrôle)`);

    // ═══ 2 · LE CAS QUI A MOTIVÉ LE FILTRE ═══════════════════════════════
    console.log(`\n════════ 2 · CONTRE-ÉPREUVE — LES COLLANTS MI-SAISON EN ÉTÉ ════════`);
    console.log(`  ${"bras".padEnd(8)}${"saison".padEnd(12)}${"collants".padStart(10)}   détail`);
    for (const bras of ["A", "C"] as const) {
      for (const saison of CAPSULE_SEASONS) {
        let n = 0; const noms = new Set<string>();
        for (const style of STYLES_FEMME) {
          for (const it of capsulePour(bras, style, saison)) {
            if (it.cat === "accessoire" && it.accessoireType === "Collants") { n += 1; noms.add(it.name); }
          }
        }
        console.log(`  ${bras.padEnd(8)}${saison.padEnd(12)}${String(n).padStart(10)}   ${[...noms].join(" · ")}`);
      }
    }

    // ═══ 3 · TENUES ══════════════════════════════════════════════════════
    console.log(`\n════════ 3 · TENUES — COUVERTURE ET RESPECT DE LA BORNE ════════`);
    console.log(`  Capsule ÉTÉ, températures réelles. « hors borne » doit rester à 0 comme en A.`);
    console.log(`\n  ${"bras".padEnd(8)}${"temp".padStart(6)}${"tenues".padStart(9)}${"cellules".padStart(11)}${"hors borne".padStart(13)}`);
    for (const bras of ["A", "C"] as const) {
      for (const temp of [18, 22, 27]) {
        const w = meteoReelle(temp);
        let tenues = 0, cellules = 0, horsBorne = 0;
        for (const style of STYLES_FEMME) {
          const capsule = capsulePour(bras, style, "Été");
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${style}|${occ}|${k}|${temp}`));
              let ids: number[];
              try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", "Été").ids; }
              finally { Math.random = vrai; }
              if (!ids.length) continue;
              couverte = true; tenues += 1;
              for (const id of ids) { const p = index.get(id); if (p?.meteoMaxTemp != null && temp > p.meteoMaxTemp) horsBorne += 1; }
            }
            if (couverte) cellules += 1;
          }
        }
        console.log(`  ${bras.padEnd(8)}${(temp + "°").padStart(6)}${String(tenues).padStart(9)}${`${cellules}/${STYLES_FEMME.length * OCCS.length}`.padStart(11)}${String(horsBorne).padStart(13)}`);
      }
    }

    // ═══ 4 · MORTALITÉ — L'HYPOTHÈSE MANTEAU ═════════════════════════════
    //
    // PRÉDICTION ÉCRITE AVANT LECTURE : si les manteaux sont morts parce que
    // leur borne les exclut de leur propre capsule, le bras C doit en
    // ressusciter. Si la mortalité manteau ne bouge pas, l'hypothèse est
    // FAUSSE et la dette a une autre cause.
    console.log(`\n════════ 4 · MORTALITÉ PAR CATÉGORIE — TEST DE L'HYPOTHÈSE MANTEAU ════════`);
    const cats: CategoryKey[] = ["haut", "pull", "veste", "manteau", "robe", "jupe", "pantalon", "jean", "chaussures", "sac", "accessoire", "bijou"];
    const mortes = new Map<string, Map<CategoryKey, number>>();
    for (const bras of ["A", "C"] as const) {
      const m = new Map<CategoryKey, number>();
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES_FEMME) {
          const capsule = capsulePour(bras, style, saison);
          const vues = new Set<number>();
          for (const occ of OCCS) {
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}`));
              let ids: number[];
              try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids; }
              finally { Math.random = vrai; }
              for (const id of ids) vues.add(id);
            }
          }
          for (const it of capsule) if (!vues.has(it.id)) m.set(it.cat, (m.get(it.cat) ?? 0) + 1);
        }
      }
      mortes.set(bras, m);
    }
    console.log(`  ${"catégorie".padEnd(14)}${"A".padStart(8)}${"C".padStart(8)}${"écart".padStart(8)}`);
    for (const cat of cats) {
      const a = mortes.get("A")!.get(cat) ?? 0, c = mortes.get("C")!.get(cat) ?? 0;
      console.log(`  ${cat.padEnd(14)}${String(a).padStart(8)}${String(c).padStart(8)}${((c - a >= 0 ? "+" : "") + (c - a)).padStart(8)}`);
    }
    const ta = [...mortes.get("A")!.values()].reduce((x, y) => x + y, 0);
    const tc = [...mortes.get("C")!.values()].reduce((x, y) => x + y, 0);
    console.log(`  ${"TOTAL".padEnd(14)}${String(ta).padStart(8)}${String(tc).padStart(8)}${((tc - ta >= 0 ? "+" : "") + (tc - ta)).padStart(8)}`);
    console.log(`\n  Une mortalité manteau qui ne bouge pas invalide l'hypothèse. Le dire alors,`);
    console.log(`  plutôt que de chercher une autre lecture des mêmes chiffres.`);

    console.log(`\n  LECTURE SEULE. Aucun fichier de production modifié, aucune donnée touchée.`);
  }, 900_000);
});
