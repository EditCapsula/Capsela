import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { CLOTHING_CATS, evaluateBlocking, generateOutfitWithFallback, type LeviersMesure } from "../src/lib/logic";
import { fermetureMaille } from "../src/lib/attributes";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// VALIDATION DU GARDE-FOU « DEUX MAILLES FERMÉES » — LECTURE SEULE.
//
// CE QUE CETTE EXPÉRIENCE MESURE, ET RIEN D'AUTRE.
//
// Elle ne mesure PAS si P1' est une bonne stratégie produit. Elle mesure si le
// garde-fou des mailles fermées fonctionne LORSQU'IL EST CONFRONTÉ AU SEUL
// SCÉNARIO QUI PEUT LE DÉCLENCHER.
//
// Pourquoi ce scénario est nécessaire. En production, le dessus principal est
// tiré sur la seule catégorie "haut" ; R-B8 n'ajoute QU'UNE seconde couche ;
// R-B18 se désactive dès qu'un pull est présent. Le moteur ne peut donc
// STRUCTURELLEMENT pas produire deux pulls dans une même tenue, et la mesure
// avant/après du 01/09/2026 a rendu zéro dans les quatre bras — un nul
// mécaniquement attendu, qui ne dit RIEN de l'efficacité du garde-fou.
// P1' (le pull peut être dessus principal) est le seul levier qui ouvre le
// cas. Il est ici un INSTRUMENT DE MESURE, jamais une proposition : il reste
// inerte en production, et rien de sa logique n'est touché.
//
// CRITÈRE PRINCIPAL, et il est binaire :
//   B > 0 et A = 0  ->  garde-fou DÉMONTRÉ efficace dans ce scénario.
//   A = B = 0       ->  NON DÉMONTRÉ. L'expérience n'a pas produit le cas.
//                       Ce n'est PAS un succès, et ne doit pas être présenté
//                       comme tel : la règle était censée fonctionner, cela ne
//                       constitue pas une preuve qu'elle fonctionne.
//   A > 0           ->  le garde-fou FUIT. Échantillon nominatif imprimé.
//
// Les deux bras partagent les MÊMES OBJETS CAPSULE, calculés une seule fois :
// l'identité des cellules est alors structurelle, pas promise. Les tirages
// sont semés sur (saison, style, occasion, k) SANS le bras, donc les deux
// voient la même suite de nombres et ne diffèrent que par le garde-fou.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(2) : "—").padStart(6) + (t ? " %" : "  ");

/**
 * Seul `superpositionMaillesFermees` sépare les deux bras. P1' est identique
 * de part et d'autre : c'est l'instrument, pas l'objet de la mesure.
 */
const BRAS: { nom: string; court: string; leviers: LeviersMesure }[] = [
  { nom: "A · P1' + garde-fou ACTIF", court: "A", leviers: { pullCommeHautPrincipal: "base" } },
  { nom: "B · P1' + garde-fou INACTIF", court: "B", leviers: { pullCommeHautPrincipal: "base", superpositionMaillesFermees: true } },
];

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

interface Resultat {
  tenues: number;
  occCouvertes: number;
  violations: number;
  parRegle: Map<string, number>;
  /** CRITÈRE PRINCIPAL. */
  deuxMaillesFermees: number;
  /** Deux pulls quels qu'ils soient — pour distinguer « la règle mord » de « le cas n'existe pas ». */
  deuxPulls: number;
  maillesFermeesUtilisees: Set<number>;
  pullPrincipal: number;
  pullSecondaire: number;
  mortes: Set<string>;
  mortesParCat: Map<CategoryKey, number>;
  mortesParSaison: Map<CapsuleSeason, number>;
  taillePool: number;
  signatures: Set<string>;
  echantillon: Map<string, string>;
}

describe("garde-fou mailles fermées — validation sous P1'", () => {
  it("mesure les deux bras sur les mêmes capsules et les mêmes tirages", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));

    // Capsules calculées UNE SEULE FOIS, partagées par les deux bras.
    const cellules: { saison: CapsuleSeason; style: string; capsule: CatalogItem[]; w: ReturnType<typeof representativeWeatherFor> }[] = [];
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        cellules.push({ saison, style, w, capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool) });
      }
    }
    const taillePool = cellules.reduce((n, c) => n + c.capsule.length, 0);
    console.log(`Catalogue exploitable : ${pool.length} pièces. ${cellules.length} cellules, ${taillePool} places de capsule.`);
    console.log(`${N} tirages par cellule × occasion. Capsules partagées, tirages semés, seul le garde-fou varie.`);

    const vide = (): Resultat => ({
      tenues: 0, occCouvertes: 0, violations: 0, parRegle: new Map(), deuxMaillesFermees: 0, deuxPulls: 0,
      maillesFermeesUtilisees: new Set(), pullPrincipal: 0, pullSecondaire: 0, mortes: new Set(),
      mortesParCat: new Map(), mortesParSaison: new Map(), taillePool, signatures: new Set(), echantillon: new Map(),
    });
    const res = new Map<string, Resultat>(BRAS.map((b) => [b.court, vide()]));

    for (const b of BRAS) {
      const r = res.get(b.court)!;
      for (const c of cellules) {
        const vusIci = new Set<number>();
        for (const occ of OCCS) {
          let couverte = false;
          for (let k = 0; k < N; k++) {
            const vraiRandom = Math.random;
            Math.random = mulberry32(grainePour(`${c.saison}|${c.style}|${occ}|${k}`));
            let ids: number[];
            try {
              ids = generateOutfitWithFallback(c.capsule, c.w, occ, "Présentiel", "Verre", [], "femme", c.saison, b.leviers).ids;
            } finally {
              Math.random = vraiRandom;
            }
            if (!ids.length) continue;
            couverte = true;
            r.tenues += 1;
            for (const id of ids) vusIci.add(id);
            const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];
            const signature = `${c.saison}|${c.style}|${occ}|${[...ids].sort((x, y) => x - y).join(",")}`;
            r.signatures.add(signature);

            // ── CRITÈRE PRINCIPAL ──
            const fermees = pieces.filter((p) => fermetureMaille(p) === "fermée");
            for (const f of fermees) r.maillesFermeesUtilisees.add(f.id);
            const pulls = pieces.filter((p) => p.cat === "pull");
            if (pulls.length >= 2) r.deuxPulls += 1;
            if (fermees.length >= 2) {
              r.deuxMaillesFermees += 1;
              r.echantillon.set(
                signature,
                `${c.saison} · ${c.style} · ${occ} — ${pieces.filter((p) => CLOTHING_CATS.includes(p.cat)).map((p) => p.name).join(" + ")}`
              );
            }

            // Composition, pour situer le scénario : P1' fait-il bien ce qu'on
            // attend de lui dans les DEUX bras ? Sans quoi l'expérience ne
            // teste pas ce qu'elle prétend.
            const unePiece = pieces.some((p) => p.cat === "robe" || p.cat === "combinaison");
            const dessus = pieces.filter((p) => p.cat === "haut" || p.cat === "pull");
            if (pulls.length && !unePiece && !dessus.some((p) => p.cat === "haut")) r.pullPrincipal += 1;
            if (pulls.length && dessus.some((p) => p.cat === "haut")) r.pullSecondaire += 1;

            // R-B1 exclue — cf. les audits précédents : bruit constant,
            // identique dans les deux bras, il masquerait les écarts réels.
            for (const h of evaluateBlocking(pieces, occ, c.w, "Présentiel", "Verre")) {
              if (h.id === "R-B1") continue;
              r.violations += 1;
              r.parRegle.set(h.id, (r.parRegle.get(h.id) ?? 0) + 1);
            }
          }
          if (couverte) r.occCouvertes += 1;
        }
        // Mortalité PAR CELLULE : une pièce jamais tirée dans SA capsule y est
        // morte, même si elle vit ailleurs. Définition plus stricte que celle
        // de l'audit pull-contrat — les deux chiffres ne se comparent pas.
        for (const it of c.capsule) {
          if (vusIci.has(it.id)) continue;
          r.mortes.add(`${c.saison}|${c.style}|${it.id}`);
          r.mortesParCat.set(it.cat, (r.mortesParCat.get(it.cat) ?? 0) + 1);
          r.mortesParSaison.set(c.saison, (r.mortesParSaison.get(c.saison) ?? 0) + 1);
        }
      }
    }

    const A = res.get("A")!;
    const B = res.get("B")!;

    // ═══ 1 · CRITÈRE PRINCIPAL ═══
    console.log(`\n════════ 1 · CRITÈRE PRINCIPAL — TENUES À DEUX MAILLES FERMÉES ════════`);
    console.log(`  C'est le comportement que le garde-fou est censé empêcher. Rien d'autre ne`);
    console.log(`  décide de cette expérience.`);
    console.log(`  ${"bras".padEnd(30)}${"tenues".padStart(10)}${"part".padStart(12)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(30)}${String(r.deuxMaillesFermees).padStart(10)}${pct(r.deuxMaillesFermees, r.tenues).padStart(12)}`);
    }
    const verdict =
      B.deuxMaillesFermees > 0 && A.deuxMaillesFermees === 0 ? "DÉMONTRÉ"
      : A.deuxMaillesFermees > 0 ? "LE GARDE-FOU FUIT"
      : "NON DÉMONTRÉ";
    console.log(`\n  >>> VERDICT : ${verdict}`);
    if (verdict === "NON DÉMONTRÉ") {
      console.log(`      Les deux bras sont à zéro : l'expérience n'a pas produit le cas que le`);
      console.log(`      garde-fou est censé empêcher. Cela ne prouve pas qu'il est faux, et cela`);
      console.log(`      ne prouve SURTOUT PAS qu'il fonctionne. La ligne « deux pulls » ci-dessous`);
      console.log(`      dit si le scénario était seulement atteignable.`);
    }
    if (verdict === "LE GARDE-FOU FUIT") {
      console.log(`      Le bras A en produit encore : la règle ne couvre pas tous les chemins.`);
    }

    console.log(`\n  Contexte — le scénario était-il seulement atteignable ?`);
    console.log(`  ${"bras".padEnd(30)}${"2 pulls".padStart(10)}${"mailles fermées vues".padStart(24)}${"pull seul dessus".padStart(18)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(30)}${String(r.deuxPulls).padStart(10)}${String(r.maillesFermeesUtilisees.size).padStart(24)}${pct(r.pullPrincipal, r.tenues).padStart(18)}`);
    }
    console.log(`  « 2 pulls » compte DEUX PULLS QUELCONQUES, garde-fou ou non. S'il vaut zéro`);
    console.log(`  dans le bras B, le cas n'existe pas et la règle n'a rien pu empêcher.`);

    // ═══ 2 · CE QUE LE GARDE-FOU A EMPÊCHÉ, NOMMÉMENT ═══
    console.log(`\n════════ 2 · LES TENUES QUE LE BRAS B PRODUIT ET QUE A BLOQUE ════════`);
    const bloquees = [...B.echantillon.entries()].filter(([sig]) => !A.signatures.has(sig));
    console.log(`  ${bloquees.length} tenue(s) à deux mailles fermées produites par B et absentes de A.`);
    for (const [, texte] of bloquees.slice(0, 25)) console.log(`     ${texte}`);
    if (A.deuxMaillesFermees > 0) {
      console.log(`\n  ANOMALIE — tenues à deux mailles fermées ENCORE présentes dans le bras A :`);
      for (const [, texte] of [...A.echantillon.entries()].slice(0, 25)) console.log(`     ${texte}`);
    }

    // ═══ 3 · CONSÉQUENCES — MESURES SECONDAIRES ═══
    console.log(`\n════════ 3 · CONSÉQUENCES DU GARDE-FOU ════════`);
    console.log(`  Secondaires : elles servent à repérer un coût, jamais à sauver le critère`);
    console.log(`  principal. Le bras B est la référence (garde-fou inactif).`);
    const ress = [...B.mortes].filter((k) => !A.mortes.has(k)).length;
    const nouv = [...A.mortes].filter((k) => !B.mortes.has(k)).length;
    console.log(`  ${"".padEnd(30)}${"B (sans)".padStart(12)}${"A (avec)".padStart(12)}${"écart".padStart(10)}`);
    const ligne = (nom: string, b: number, a: number) =>
      console.log(`  ${nom.padEnd(30)}${String(b).padStart(12)}${String(a).padStart(12)}${((a - b >= 0 ? "+" : "") + (a - b)).padStart(10)}`);
    ligne("tenues générées", B.tenues, A.tenues);
    ligne("pièces mortes", B.mortes.size, A.mortes.size);
    ligne("occasions couvertes", B.occCouvertes, A.occCouvertes);
    ligne("violations de règles dures", B.violations, A.violations);
    ligne("tenues distinctes", B.signatures.size, A.signatures.size);
    console.log(`  ${"ressuscitées par A".padEnd(30)}${String(ress).padStart(12)}`);
    console.log(`  ${"NOUVELLES MORTES sous A".padEnd(30)}${String(nouv).padStart(12)}   <- signal de régression`);
    console.log(`  Couverture : 320 = 32 capsules × 10 occasions. Aucune perte n'est acceptable`);
    console.log(`  sans nouvel arbitrage.`);

    const cats = [...new Set([...A.mortesParCat.keys(), ...B.mortesParCat.keys()])].sort();
    console.log(`\n  Mortalité par catégorie :`);
    console.log(`  ${"catégorie".padEnd(16)}${"B (sans)".padStart(12)}${"A (avec)".padStart(12)}`);
    for (const cat of cats) {
      console.log(`  ${cat.padEnd(16)}${String(B.mortesParCat.get(cat) ?? 0).padStart(12)}${String(A.mortesParCat.get(cat) ?? 0).padStart(12)}`);
    }
    console.log(`  Le chantier MANTEAU reste séparé : cette ligne ne conclut rien sur lui.`);

    console.log(`\n  Mortalité par saison :`);
    console.log(`  ${"".padEnd(16)}${CAPSULE_SEASONS.map((s) => s.padStart(12)).join("")}`);
    for (const b of BRAS) {
      console.log(`  ${b.court.padEnd(16)}` + CAPSULE_SEASONS.map((s) => String(res.get(b.court)!.mortesParSaison.get(s) ?? 0).padStart(12)).join(""));
    }

    const regles = [...new Set([...A.parRegle.keys(), ...B.parRegle.keys()])].sort();
    console.log(`\n  Violations par règle :`);
    console.log(`  ${"règle".padEnd(16)}${"B (sans)".padStart(12)}${"A (avec)".padStart(12)}`);
    for (const rg of regles) {
      console.log(`  ${rg.padEnd(16)}${String(B.parRegle.get(rg) ?? 0).padStart(12)}${String(A.parRegle.get(rg) ?? 0).padStart(12)}`);
    }

    console.log(`\n  LECTURE SEULE. P1' n'est pas modifié, il sert d'instrument de mesure.`);
    console.log(`  Cette expérience ne dit RIEN de la valeur produit de P1' — c'est une décision`);
    console.log(`  séparée, à instruire sur ses propres critères.`);
  });
});
