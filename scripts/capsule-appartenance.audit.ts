import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LE MÉCANISME D'APPARTENANCE — RÉOUVERTURE COMPLÈTE, LECTURE SEULE.
//
// RÉOUVERTURE au titre du point 8 de la règle d'audit. Trois bras ont été
// mesurés et refusés, et un quatrième n'a jamais été testé.
//
//   B  borne haute retirée, rien installé
//      -> 93 pièces hors borne à 22 °, 86 à 27 °, collants mi-saison de
//         retour en capsule Été. REFUSÉ.
//   D  min cessant d'être appliqué aux catégories que la génération exempte
//      -> 371 tenues où une pièce est portée sous son min SANS COUCHE.
//         REFUSÉ.
//   C  appartenance par saison déclarée, borne haute neutralisée, MAIS FILTRE
//      DE MIN TOUJOURS ACTIF -> sûr sur tous les critères de fuite, et +22
//      pièces mortes.
//
// LE POINT QUI IMPOSE LA RÉOUVERTURE : le +22 du bras C a été mesuré avec le
// filtre de min encore en place, donc avec les 65 artefacts de min encore
// actifs. Il ne peut pas être transporté sur un mécanisme qui les corrige
// aussi (point 4 : ne jamais extrapoler d'un scénario à un autre).
//
// LE BRAS E, jamais testé : la DÉCLARATION remplace les DEUX bornes pour
// l'appartenance. Les bornes ne servent plus qu'à la tenue du jour — la
// définition de l'utilisatrice, appliquée jusqu'au bout.
//
// Pourquoi c'est cohérent là où B et D ne l'étaient pas : ce qui protégeait
// contre le caraco nu par 6 °C dans le bras D, c'était la borne. Ici c'est la
// déclaration — un caraco déclaré « Été » n'entre pas dans la capsule d'hiver,
// quelle que soit sa borne. Le garde-fou n'est pas retiré, il est déplacé.
//
// LE POINT FAIBLE CONNU, et il est mesuré : une pièce SANS déclaration lisible
// n'a aucun garde-fou de saison. Celles-là conservent donc leurs bornes,
// faute de mieux. C'est un hybride assumé, pas un oubli.
//
// LES DEUX CHIFFRES QUI PEUVENT REFUSER CE BRAS, hérités des échecs
// précédents et repris tels quels :
//   · une pièce portée AU-DESSUS de son max (ce qui a tué le bras B) ;
//   · une pièce portée SOUS son min sans aucune couche (ce qui a tué le D).
// Et la mortalité, cette fois avec l'IDENTITÉ des pièces mortes — le bras C
// avait rendu un +22 sans jamais dire de qui il s'agissait.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;
const COUCHES: CategoryKey[] = ["pull", "veste", "manteau"];

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

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

describe("le mécanisme d'appartenance à une capsule", () => {
  it("mesure la déclaration comme unique critère d'appartenance, bornes rendues à la tenue du jour", async () => {
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
    const sansInfo = pool.filter((it) => !declarees.get(it.id)!.length);
    console.log(`Catalogue : ${pool.length} pièces, dont ${sansInfo.length} sans déclaration lisible — celles-là gardent leurs bornes.`);

    /**
     * Bras E : pour la saison S, ne restent que les pièces qui la déclarent
     * (ou qui ne déclarent rien), et les pièces déclarantes perdent LEURS DEUX
     * bornes pour le seul calcul d'appartenance. Les identifiants obtenus sont
     * remappés sur les pièces originales : la tenue du jour retrouve toutes
     * les bornes intactes.
     */
    const poolE = (saison: CapsuleSeason): CatalogItem[] =>
      pool
        .filter((it) => { const d = declarees.get(it.id)!; return !d.length || d.includes(saison); })
        .map((it) => (declarees.get(it.id)!.length ? { ...it, meteoMinTemp: undefined, meteoMaxTemp: undefined } : it));

    const capsulePour = (bras: "A" | "E", style: string, saison: CapsuleSeason): CatalogItem[] => {
      const src = bras === "A" ? pool : poolE(saison);
      const c = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, src);
      return c.map((it) => index.get(it.id)).filter((x): x is CatalogItem => Boolean(x));
    };

    // ═══ 1 · COMPOSITION, ENTRANTS, SORTANTS ════════════════════════════
    console.log(`\n════════ 1 · COMPOSITION DES CAPSULES ════════`);
    console.log(`  ${"saison".padEnd(12)}${"A".padStart(8)}${"E".padStart(8)}${"écart".padStart(8)}${"entrants".padStart(11)}${"sortants".padStart(11)}`);
    const entrants = new Map<number, Set<CapsuleSeason>>();
    const sortants = new Map<number, Set<CapsuleSeason>>();
    for (const saison of CAPSULE_SEASONS) {
      let a = 0, e = 0, ent = 0, sor = 0;
      for (const style of STYLES_FEMME) {
        const ca = capsulePour("A", style, saison), ce = capsulePour("E", style, saison);
        a += ca.length; e += ce.length;
        const idsA = new Set(ca.map((it) => it.id)), idsE = new Set(ce.map((it) => it.id));
        for (const it of ce) if (!idsA.has(it.id)) { ent += 1; entrants.set(it.id, (entrants.get(it.id) ?? new Set()).add(saison)); }
        for (const it of ca) if (!idsE.has(it.id)) { sor += 1; sortants.set(it.id, (sortants.get(it.id) ?? new Set()).add(saison)); }
      }
      console.log(`  ${saison.padEnd(12)}${String(a).padStart(8)}${String(e).padStart(8)}${((e - a >= 0 ? "+" : "") + (e - a)).padStart(8)}${String(ent).padStart(11)}${String(sor).padStart(11)}`);
    }
    let horsDeclaration = 0, sortiesDeclarees = 0;
    for (const [id, ss] of entrants) for (const s of ss) { const d = declarees.get(id)!; if (d.length && !d.includes(s)) horsDeclaration += 1; }
    for (const [id, ss] of sortants) for (const s of ss) if (declarees.get(id)!.includes(s)) sortiesDeclarees += 1;
    console.log(`\n  ${entrants.size} pièces entrantes, ${sortants.size} sortantes.`);
    console.log(`  entrées HORS déclaration ...............: ${horsDeclaration}  (doit être 0 — contrôle du levier)`);
    console.log(`  sorties d'une saison POURTANT déclarée .: ${sortiesDeclarees}  (coût du plafond de capsule)`);

    // Les cas nommés au fil du chantier : reviennent-ils ?
    const TEMOINS: [number, string][] = [
      [687, "Cardigan fin col rond — déclare l'Été, sorti par sa borne 21"],
      [843, "Doudoune longue — max 5, n'entre aujourd'hui nulle part"],
      [463, "Manteau droit en laine — max 12, déclaré Automne"],
      [609, "Chemise Oxford — min 20, déclarée les 4 saisons"],
    ];
    console.log(`\n  Les cas nommés pendant le chantier :`);
    for (const [idSql, quoi] of TEMOINS) {
      const id = VESTIAIRE_ID_OFFSET + idSql;
      const dansA: CapsuleSeason[] = [], dansE: CapsuleSeason[] = [];
      for (const saison of CAPSULE_SEASONS) {
        for (const style of STYLES_FEMME) {
          if (!dansA.includes(saison) && capsulePour("A", style, saison).some((it) => it.id === id)) dansA.push(saison);
          if (!dansE.includes(saison) && capsulePour("E", style, saison).some((it) => it.id === id)) dansE.push(saison);
        }
      }
      console.log(`     ${quoi}`);
      console.log(`        A : ${dansA.join(", ") || "aucune capsule"}   ->   E : ${dansE.join(", ") || "aucune capsule"}`);
    }

    // ═══ 2 · LES DEUX CHIFFRES QUI ONT TUÉ LES BRAS B ET D ══════════════
    console.log(`\n════════ 2 · CE QUI A REFUSÉ LES BRAS PRÉCÉDENTS ════════`);
    console.log(`  « au-dessus du max » a refusé le bras B. « sous le min sans couche » a refusé le D.`);
    console.log(`\n  ${"bras".padEnd(6)}${"saison".padEnd(12)}${"temp".padStart(6)}${"tenues".padStart(9)}${"cellules".padStart(11)}${"au-dessus du max".padStart(18)}${"sous min sans couche".padStart(22)}`);
    for (const bras of ["A", "E"] as const) {
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        let tenues = 0, cellules = 0, surMax = 0, sousMinNu = 0;
        for (const style of STYLES_FEMME) {
          const capsule = capsulePour(bras, style, saison);
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}`));
              let ids: number[];
              try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids; }
              finally { Math.random = vrai; }
              if (!ids.length) continue;
              couverte = true; tenues += 1;
              const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
              const aUneCouche = pieces.some((p) => COUCHES.includes(p.cat));
              for (const p of pieces) {
                if (p.meteoMaxTemp != null && w.temp > p.meteoMaxTemp) surMax += 1;
                if (p.meteoMinTemp != null && w.temp < p.meteoMinTemp && !aUneCouche) sousMinNu += 1;
              }
            }
            if (couverte) cellules += 1;
          }
        }
        console.log(`  ${bras.padEnd(6)}${saison.padEnd(12)}${(w.temp + "°").padStart(6)}${String(tenues).padStart(9)}${`${cellules}/${STYLES_FEMME.length * OCCS.length}`.padStart(11)}${String(surMax).padStart(18)}${String(sousMinNu).padStart(22)}`);
      }
    }

    // ═══ 3 · LE CAS DE 08/2026 ═════════════════════════════════════════
    console.log(`\n════════ 3 · CONTRE-ÉPREUVE — LES COLLANTS MI-SAISON EN ÉTÉ ════════`);
    for (const bras of ["A", "E"] as const) {
      for (const saison of CAPSULE_SEASONS) {
        const noms = new Set<string>();
        for (const style of STYLES_FEMME) {
          for (const it of capsulePour(bras, style, saison)) if (it.cat === "accessoire" && it.accessoireType === "Collants") noms.add(it.name);
        }
        console.log(`  ${bras}  ${saison.padEnd(12)}${String(noms.size).padStart(3)}   ${[...noms].join(" · ")}`);
      }
    }

    // ═══ 4 · MORTALITÉ, AVEC L'IDENTITÉ DES MORTES ══════════════════════
    //
    // Le bras C avait rendu un +22 sans jamais dire de qui il s'agissait.
    // Une pièce morte n'a pas la même gravité selon qu'elle est un manteau
    // d'hiver ou un caraco de plus parmi vingt.
    console.log(`\n════════ 4 · MORTALITÉ — ET QUI MEURT ════════`);
    const cats: CategoryKey[] = ["haut", "pull", "veste", "manteau", "robe", "jupe", "pantalon", "jean", "chaussures", "sac", "accessoire", "bijou"];
    const mortesPar = new Map<string, Map<CategoryKey, number>>();
    const identite = new Map<string, Set<string>>();
    for (const bras of ["A", "E"] as const) {
      const m = new Map<CategoryKey, number>();
      const ids = new Set<string>();
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES_FEMME) {
          const capsule = capsulePour(bras, style, saison);
          const vues = new Set<number>();
          for (const occ of OCCS) {
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}`));
              try { for (const id of generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids) vues.add(id); }
              finally { Math.random = vrai; }
            }
          }
          for (const it of capsule) if (!vues.has(it.id)) { m.set(it.cat, (m.get(it.cat) ?? 0) + 1); ids.add(`${saison}|${it.id}`); }
        }
      }
      mortesPar.set(bras, m);
      identite.set(bras, ids);
    }
    console.log(`  ${"catégorie".padEnd(14)}${"A".padStart(8)}${"E".padStart(8)}${"écart".padStart(8)}`);
    for (const cat of cats) {
      const a = mortesPar.get("A")!.get(cat) ?? 0, e = mortesPar.get("E")!.get(cat) ?? 0;
      if (a || e) console.log(`  ${cat.padEnd(14)}${String(a).padStart(8)}${String(e).padStart(8)}${((e - a >= 0 ? "+" : "") + (e - a)).padStart(8)}`);
    }
    const ta = [...mortesPar.get("A")!.values()].reduce((x, y) => x + y, 0);
    const te = [...mortesPar.get("E")!.values()].reduce((x, y) => x + y, 0);
    console.log(`  ${"TOTAL".padEnd(14)}${String(ta).padStart(8)}${String(te).padStart(8)}${((te - ta >= 0 ? "+" : "") + (te - ta)).padStart(8)}`);

    const nouvelles = [...identite.get("E")!].filter((k) => !identite.get("A")!.has(k));
    const ressuscitees = [...identite.get("A")!].filter((k) => !identite.get("E")!.has(k));
    console.log(`\n  ${nouvelles.length} NOUVELLES mortes (vivantes en A, mortes en E) :`);
    for (const k of nouvelles.slice(0, 30)) {
      const [saison, id] = k.split("|");
      const it = index.get(Number(id))!;
      console.log(`     ${saison.padEnd(11)}${it.cat.padEnd(11)}${(ligne.get(it.id)!.saison_capsule ?? "—").slice(0, 27).padEnd(28)}${it.name}`);
    }
    if (nouvelles.length > 30) console.log(`     … et ${nouvelles.length - 30} autres`);
    console.log(`\n  ${ressuscitees.length} RESSUSCITÉES (mortes en A, vivantes en E) :`);
    for (const k of ressuscitees.slice(0, 30)) {
      const [saison, id] = k.split("|");
      const it = index.get(Number(id))!;
      console.log(`     ${saison.padEnd(11)}${it.cat.padEnd(11)}${(ligne.get(it.id)!.saison_capsule ?? "—").slice(0, 27).padEnd(28)}${it.name}`);
    }
    if (ressuscitees.length > 30) console.log(`     … et ${ressuscitees.length - 30} autres`);
    console.log(`\n  Un solde nul cachant des centaines de mouvements ne serait pas « pas de`);
    console.log(`  changement » : les deux listes sont donc données brutes, pas seulement le net.`);

    console.log(`\n  LECTURE SEULE. Aucun fichier de production modifié, aucune donnée touchée.`);
  }, 900_000);
});
