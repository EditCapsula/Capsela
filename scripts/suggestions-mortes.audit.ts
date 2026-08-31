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

interface Mesure {
  /** Nombre de tenues contenant la pièce, par id. */
  parPiece: Map<number, number>;
  /** Nombre de tenues contenant AU MOINS une pièce de la catégorie. */
  parCat: Map<CategoryKey, number>;
  /** Tenues non vides produites. */
  tenues: number;
}

/** Dix occasions × n tirages, sur la capsule telle quelle. */
function mesure(capsule: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, s: CapsuleSeason, n: number): Mesure {
  const parPiece = new Map<number, number>();
  const parCat = new Map<CategoryKey, number>();
  const index = new Map(capsule.map((it) => [it.id, it]));
  let tenues = 0;
  for (const occ of OCCS) {
    for (let k = 0; k < n; k++) {
      const ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", s).ids;
      if (!ids.length) continue;
      tenues += 1;
      const cats = new Set<CategoryKey>();
      for (const id of ids) {
        parPiece.set(id, (parPiece.get(id) ?? 0) + 1);
        const it = index.get(id);
        if (it) cats.add(it.cat);
      }
      for (const c of cats) parCat.set(c, (parCat.get(c) ?? 0) + 1);
    }
  }
  return { parPiece, parCat, tenues };
}

const idsVus = (capsule: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, s: CapsuleSeason, n: number): Set<number> =>
  new Set(mesure(capsule, w, s, n).parPiece.keys());

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
    /** Cause retenue pour CHAQUE morte — le §4 doit porter sur les 90, jamais sur l'échantillon. */
    const causeParMorte = new Map<(typeof mortes)[number], string>();

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
      causeParMorte.set(m, cause);
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
    const concurrentes = mortes.filter((m) => causeParMorte.get(m) === "CONCURRENCE");
    const conc = new Map<CategoryKey, number>();
    for (const m of concurrentes) conc.set(m.it.cat, (conc.get(m.it.cat) ?? 0) + 1);
    console.log(`  Sur les ${concurrentes.length} pièces CONCURRENCE — toutes, pas un échantillon :`);
    for (const [cat, n] of [...conc.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(cat).padEnd(14)}${String(n).padStart(5)}  ${pct(n, concurrentes.length)}`);
    }

    // ═══ 5 · LA CATÉGORIE EST-ELLE RAREMENT TIRÉE, OU SATURÉE ? ═══
    console.log(`\n════════ 5 · OCCUPATION DES CATÉGORIES ════════`);
    console.log(`  Deux explications concurrentes à une morte, que ce tableau sépare :`);
    console.log(`    (a) SATURATION  la catégorie est tirée souvent, mais un seul exemplaire par tenue —`);
    console.log(`                    au-delà d'un certain nombre de pièces, le surplus est inatteignable.`);
    console.log(`    (b) RARETÉ      la catégorie n'est presque jamais tirée — même deux pièces suffisent`);
    console.log(`                    à en laisser une morte.`);
    console.log(`  « tenues » = part des tenues contenant au moins une pièce de la catégorie.`);
    console.log(`  « places/pièce » = tenues occupées ÷ pièces de la catégorie dans la capsule.`);
    console.log(`\n  ${"catégorie".padEnd(14)}${"pièces/caps.".padStart(13)}${"tenues".padStart(10)}${"places/pièce".padStart(14)}${"mortes".padStart(9)}`);
    const agCat = new Map<CategoryKey, { pieces: number; occup: number; tenues: number; cellules: number }>();
    for (const c of cellules) {
      const m = mesure(c.capsule, c.w, c.saison, N_BASE);
      for (const it of c.capsule) {
        const a = agCat.get(it.cat) ?? { pieces: 0, occup: 0, tenues: 0, cellules: 0 };
        a.pieces += 1;
        agCat.set(it.cat, a);
      }
      for (const cat of new Set(c.capsule.map((it) => it.cat))) {
        const a = agCat.get(cat)!;
        a.occup += m.parCat.get(cat) ?? 0;
        a.tenues += m.tenues;
        a.cellules += 1;
      }
    }
    const mortesParCat = new Map<CategoryKey, number>();
    for (const m of mortes) mortesParCat.set(m.it.cat, (mortesParCat.get(m.it.cat) ?? 0) + 1);
    for (const [cat, a] of [...agCat.entries()].sort((x, y) => (y[1].occup / y[1].tenues) - (x[1].occup / x[1].tenues))) {
      const piecesParCaps = a.pieces / a.cellules;
      const partTenues = a.occup / a.tenues;
      console.log(`  ${String(cat).padEnd(14)}${piecesParCaps.toFixed(1).padStart(13)}${(pct(a.occup, a.tenues)).padStart(10)}` +
        `${(partTenues > 0 ? (partTenues / piecesParCaps).toFixed(2) : "—").padStart(14)}${String(mortesParCat.get(cat) ?? 0).padStart(9)}`);
    }

    // ═══ 6 · LA MORTE COEXISTE-T-ELLE AVEC DES VIVANTES DE SA CATÉGORIE ? ═══
    console.log(`\n════════ 6 · VOISINAGE IMMÉDIAT DE CHAQUE MORTE ════════`);
    console.log(`  Test direct de la concurrence intra-catégorie : dans SA capsule, combien de pièces`);
    console.log(`  partagent sa catégorie, et combien d'entre elles sont vivantes ?`);
    console.log(`    seule de sa catégorie      -> la concurrence intra-catégorie est exclue.`);
    console.log(`    entourée de vivantes       -> concurrence intra-catégorie démontrée.`);
    console.log(`    catégorie entièrement morte -> la catégorie n'est jamais tirée, autre cause.`);
    let seule = 0, entouree = 0, catMorte = 0;
    const detailVoisinage: { saison: CapsuleSeason; style: string; nom: string; cat: CategoryKey; total: number; vivantes: number }[] = [];
    for (const m of concurrentes) {
      const vus = idsVus(m.capsule, m.w, m.saison, N_LARGE);
      const memeCat = m.capsule.filter((x) => x.cat === m.it.cat);
      const vivantes = memeCat.filter((x) => vus.has(x.id)).length;
      if (memeCat.length === 1) seule += 1;
      else if (vivantes > 0) entouree += 1;
      else catMorte += 1;
      if (detailVoisinage.length < 25) {
        detailVoisinage.push({ saison: m.saison, style: m.style, nom: m.it.name, cat: m.it.cat, total: memeCat.length, vivantes });
      }
    }
    console.log(`\n  seule de sa catégorie        : ${String(seule).padStart(4)}  ${pct(seule, concurrentes.length)}`);
    console.log(`  entourée de vivantes         : ${String(entouree).padStart(4)}  ${pct(entouree, concurrentes.length)}`);
    console.log(`  catégorie entièrement morte  : ${String(catMorte).padStart(4)}  ${pct(catMorte, concurrentes.length)}`);
    console.log(`\n  ${"saison".padEnd(11)}${"style".padEnd(16)}${"cat".padEnd(13)}${"cat.".padStart(6)}${"viv.".padStart(6)}  pièce`);
    for (const d of detailVoisinage) {
      console.log(`  ${d.saison.padEnd(11)}${d.style.padEnd(16)}${String(d.cat).padEnd(13)}${String(d.total).padStart(6)}${String(d.vivantes).padStart(6)}  ${d.nom}`);
    }

    // ═══ 5 · ÉCHANTILLON NOMINATIF ═══
    console.log(`\n════════ 7 · ÉCHANTILLON NOMINATIF (40 premières) ════════`);
    console.log(`  ${"cause".padEnd(30)}${"saison".padEnd(11)}${"style".padEnd(16)}${"cat".padEnd(13)}pièce`);
    for (const e of exemples) {
      console.log(`  ${e.cause.padEnd(30)}${e.saison.padEnd(11)}${e.style.padEnd(16)}${String(e.cat).padEnd(13)}${e.nom}`);
    }

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucune modification de production.`);
    console.log(`  Aucune correction n'est proposée ici : cet audit établit une cause, rien de plus.`);
  }, 900_000);
});
