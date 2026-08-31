import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// SUGGESTIONS MORTES · CAUSE. LECTURE SEULE.
//
// Une suggestion morte est une pièce présente dans la capsule mais retenue
// dans AUCUNE tenue, sur toutes les occasions et tous les tirages : affichée
// sur l'écran Capsule, inatteignable en tenue. Même définition que
// `diversite-tenues`, pour que les chiffres soient comparables — il y mesurait
// 24,7 % avant le correctif saisonnier et 7,0 % après, sans en établir la
// cause. C'est cette cause, et elle seule, que cet audit cherche.
//
// MÉTHODE — contrefactuelle, jamais déclarative.
//
// Aucune porte du moteur n'est réimplémentée ici : réécrire R-B3, R-B6, R-B15
// ou applyTempFilter de mémoire produirait une attribution qui décrit MA
// lecture du code, pas son comportement. À la place, chaque levier est
// neutralisé SUR LA PIÈCE — un champ de données, jamais une règle — et la
// mesure est rejouée à l'identique. Si la pièce revit, le levier neutralisé
// est la cause. C'est le moteur réel qui répond, pas moi.
//
//   SAISON       season -> "Toutes saisons"
//   TEMPÉRATURE  meteoMinTemp / meteoMaxTemp -> aucune borne
//   OCCASION     occasion -> [] (colonne vide = toutes occasions autorisées)
//   FORMALITÉ    niveauFormalite -> 4 (le plus haut palier)
//   SOLEIL       necessiteSoleil -> false
//
// Baseline, chaque levier seul et la combinaison des cinq sont mesurés DANS LA
// MÊME EXÉCUTION, sur la MÊME capsule, en ne faisant varier que le levier
// étudié (règle d'audit, points 1 à 3).
//
// GARDE-FOU CONTRE UN FAUX POSITIF. Le tirage est aléatoire : une pièce
// simplement rare peut paraître morte à N tirages et vivre à 2N. La §1 mesure
// donc la mortalité aux deux volumes. L'écart entre les deux n'est PAS une
// cause : c'est la part de « mortalité » qui n'est qu'un artefact de mesure,
// et elle est retirée du périmètre avant toute attribution.
//
// Aucun UPDATE, aucune écriture, aucune modification de production.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N_BASE = 40;
const N_LARGE = 80;
const N_CONTRE = 40;
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";

type Levier = "saison" | "temperature" | "occasion" | "formalite" | "soleil";
const LEVIERS: Levier[] = ["saison", "temperature", "occasion", "formalite", "soleil"];

/** Neutralise un levier SUR LA PIÈCE. Aucune règle du moteur n'est touchée. */
function neutralise(it: CatalogItem, leviers: Levier[]): CatalogItem {
  let r = { ...it };
  if (leviers.includes("saison")) r = { ...r, season: "Toutes saisons" };
  if (leviers.includes("temperature")) r = { ...r, meteoMinTemp: undefined, meteoMaxTemp: undefined };
  if (leviers.includes("occasion")) r = { ...r, occasion: [] };
  if (leviers.includes("formalite")) r = { ...r, niveauFormalite: 4 };
  if (leviers.includes("soleil")) r = { ...r, necessiteSoleil: false };
  return r;
}

/** Ids vus dans au moins une tenue, sur les dix occasions × n tirages. */
function idsVus(capsule: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, s: CapsuleSeason, n: number): Set<number> {
  const vus = new Set<number>();
  for (const occ of OCCS) {
    for (let k = 0; k < n; k++) {
      for (const id of generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", s).ids) vus.add(id);
    }
  }
  return vus;
}

describe("suggestions mortes — cause", () => {
  it("mesure la mortalité, puis attribue chaque mort à un levier par contrefactuel", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`Catalogue exploitable : ${pool.length} pièces sur ${rows.length} lignes.`);
    console.log(`Baseline ${N_BASE} tirages/occasion, contrôle de rareté à ${N_LARGE}, contrefactuels à ${N_CONTRE}.`);

    const cellules: { saison: CapsuleSeason; style: string; capsule: CatalogItem[]; w: ReturnType<typeof representativeWeatherFor> }[] = [];
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        cellules.push({ saison, style, w, capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool) });
      }
    }

    // ═══ 1 · MORTALITÉ, ET LA PART QUI N'EST QUE DE LA RARETÉ ═══
    console.log(`\n════════ 1 · MORTALITÉ MESURÉE À DEUX VOLUMES DE TIRAGE ════════`);
    console.log(`  Une pièce morte à ${N_BASE} tirages mais vivante à ${N_LARGE} n'a aucune cause structurelle :`);
    console.log(`  elle est simplement rare. Cette part est retirée avant toute attribution.`);
    console.log(`  ${"saison".padEnd(11)}${"capsule".padStart(9)}${`mortes à ${N_BASE}`.padStart(15)}${`mortes à ${N_LARGE}`.padStart(15)}${"rareté seule".padStart(14)}`);
    const mortes: { saison: CapsuleSeason; style: string; it: CatalogItem; capsule: CatalogItem[]; w: ReturnType<typeof representativeWeatherFor> }[] = [];
    let totalPieces = 0, totalBase = 0, totalLarge = 0;
    for (const saison of CAPSULE_SEASONS) {
      let taille = 0, mB = 0, mL = 0;
      for (const c of cellules.filter((x) => x.saison === saison)) {
        const vusBase = idsVus(c.capsule, c.w, saison, N_BASE);
        const vusLarge = idsVus(c.capsule, c.w, saison, N_LARGE);
        taille += c.capsule.length;
        for (const it of c.capsule) {
          if (!vusBase.has(it.id)) mB += 1;
          if (!vusLarge.has(it.id)) { mL += 1; mortes.push({ saison, style: c.style, it, capsule: c.capsule, w: c.w }); }
        }
      }
      totalPieces += taille; totalBase += mB; totalLarge += mL;
      console.log(`  ${saison.padEnd(11)}${(taille / 8).toFixed(1).padStart(9)}${(`${(mB / 8).toFixed(1)} (${pct(mB, taille)})`).padStart(15)}` +
        `${(`${(mL / 8).toFixed(1)} (${pct(mL, taille)})`).padStart(15)}${String(mB - mL).padStart(14)}`);
    }
    console.log(`\n  TOTAL : ${totalBase} mortes sur ${totalPieces} (${pct(totalBase, totalPieces)}) à ${N_BASE} tirages,`);
    console.log(`          ${totalLarge} (${pct(totalLarge, totalPieces)}) à ${N_LARGE}.`);
    console.log(`  ${totalBase - totalLarge} « mortes » n'étaient que rares : ${pct(totalBase - totalLarge, totalBase)} du total initial.`);
    console.log(`  Périmètre d'attribution retenu : les ${totalLarge} pièces mortes à ${N_LARGE} tirages.`);

    // ═══ 2 · RÉPARTITION DES MORTES PAR CATÉGORIE ET PAR STYLE ═══
    console.log(`\n════════ 2 · OÙ SONT LES MORTES ════════`);
    const parCat = new Map<CategoryKey, number>();
    const parStyle = new Map<string, number>();
    for (const m of mortes) {
      parCat.set(m.it.cat, (parCat.get(m.it.cat) ?? 0) + 1);
      parStyle.set(m.style, (parStyle.get(m.style) ?? 0) + 1);
    }
    console.log(`  Par catégorie :`);
    for (const [cat, n] of [...parCat.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(cat).padEnd(14)}${String(n).padStart(5)}  ${pct(n, mortes.length)}`);
    }
    console.log(`  Par style :`);
    for (const [st, n] of [...parStyle.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${st.padEnd(16)}${String(n).padStart(5)}  ${pct(n, mortes.length)}`);
    }

    // ═══ 3 · CONTREFACTUEL — QUEL LEVIER RESSUSCITE LA PIÈCE ? ═══
    console.log(`\n════════ 3 · CONTREFACTUEL, UN LEVIER À LA FOIS ════════`);
    console.log(`  Le levier est neutralisé SUR LA PIÈCE (un champ de données), jamais sur une règle.`);
    console.log(`  Même capsule, même météo, même nombre de tirages : seul le levier varie.`);
    const compte = new Map<string, number>();
    const inc = (k: string) => compte.set(k, (compte.get(k) ?? 0) + 1);
    /** Détail nominatif, plafonné pour rester lisible. */
    const exemples: { cause: string; saison: CapsuleSeason; style: string; nom: string; cat: CategoryKey }[] = [];

    for (const m of mortes) {
      const rejoue = (leviers: Levier[]): boolean => {
        const modifiee = neutralise(m.it, leviers);
        const capsule = m.capsule.map((x) => (x.id === m.it.id ? modifiee : x));
        return idsVus(capsule, m.w, m.saison, N_CONTRE).has(m.it.id);
      };
      const seuls = LEVIERS.filter((l) => rejoue([l]));
      let cause: string;
      if (seuls.length === 1) cause = seuls[0].toUpperCase();
      else if (seuls.length > 1) cause = `PLUSIEURS (${seuls.join("+")})`;
      else cause = rejoue(LEVIERS) ? "INTERACTION" : "CONCURRENCE";
      inc(cause);
      if (exemples.length < 40) exemples.push({ cause, saison: m.saison, style: m.style, nom: m.it.name, cat: m.it.cat });
    }

    console.log(`\n  ${"cause".padEnd(34)}${"pièces".padStart(8)}${"part".padStart(9)}`);
    for (const [k, n] of [...compte.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(34)}${String(n).padStart(8)}${pct(n, mortes.length).padStart(9)}`);
    }
    console.log(`\n  Lecture :`);
    console.log(`    UN NOM DE LEVIER  ce levier seul suffit à ressusciter la pièce : cause unique établie.`);
    console.log(`    PLUSIEURS         plusieurs leviers suffisent CHACUN seul — la pièce est bloquée`);
    console.log(`                      plusieurs fois, aucun n'est LA cause à lui seul.`);
    console.log(`    INTERACTION       aucun levier seul ne suffit, les cinq ensemble oui : les blocages`);
    console.log(`                      se relaient, aucune correction isolée ne rendrait la pièce vivante.`);
    console.log(`    CONCURRENCE       même tous leviers neutralisés, la pièce n'est jamais tirée. Elle`);
    console.log(`                      n'est écartée par AUCUN filtre : elle perd le tirage face aux`);
    console.log(`                      autres pièces de sa catégorie. Ce n'est pas un défaut de règle.`);

    // ═══ 4 · LA CONCURRENCE EST-ELLE CONCENTRÉE SUR LES CATÉGORIES FACULTATIVES ? ═══
    console.log(`\n════════ 4 · PROFIL DES PIÈCES « CONCURRENCE » ════════`);
    console.log(`  Bijou et accessoire ne sont tirés qu'avec une probabilité (accessoryProbabilities),`);
    console.log(`  veste et manteau seulement quand la météo ou la formalité les appelle. Une morte dans`);
    console.log(`  ces catégories n'a pas le même sens qu'une morte sur un haut ou un bas.`);
    const conc = new Map<CategoryKey, number>();
    for (const e of exemples.filter((x) => x.cause === "CONCURRENCE")) conc.set(e.cat, (conc.get(e.cat) ?? 0) + 1);
    if (!conc.size) console.log(`  (aucune pièce CONCURRENCE dans l'échantillon nominatif ci-dessous)`);
    for (const [cat, n] of [...conc.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(cat).padEnd(14)}${String(n).padStart(5)}`);

    // ═══ 5 · ÉCHANTILLON NOMINATIF ═══
    console.log(`\n════════ 5 · ÉCHANTILLON NOMINATIF (40 premières) ════════`);
    console.log(`  ${"cause".padEnd(30)}${"saison".padEnd(11)}${"style".padEnd(16)}${"cat".padEnd(13)}pièce`);
    for (const e of exemples) {
      console.log(`  ${e.cause.padEnd(30)}${e.saison.padEnd(11)}${e.style.padEnd(16)}${String(e.cat).padEnd(13)}${e.nom}`);
    }

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucune modification de production.`);
    console.log(`  Aucune correction n'est proposée ici : cet audit établit une cause, rien de plus.`);
  }, 900_000);
});
