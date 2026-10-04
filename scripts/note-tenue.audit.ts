import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { colorimetrieDeSaison } from "../src/lib/colorimetrie";
import { colorimetrieMoteur } from "../src/lib/colorimetrieMoteur";
import { OCCASIONS, type Weather } from "../src/lib/data";
import { computeLookScore, generateOutfitWithFallback, tenueAUnSocle } from "../src/lib/logic";
import { interpretationNote, noteDeLaTenue } from "../src/lib/noteTenue";
import { PAL_COULEURS } from "../src/lib/palCouleurs";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, STYLES_HOMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// MESURE DE LA DISTRIBUTION DE LA NOTE DE L'AVIS DE STYLISTE (04/10/2026). LECTURE SEULE.
//
// La note sur 10 (src/lib/noteTenue.ts, PR 94) repose sur des pondérations et des bases par dimension qui sont une
// PROPOSITION PRODUIT. Cet audit en mesure la distribution — rien d'autre. Règle d'audit (AGENTS.md) :
//
// 1. CONFIGURATION GELÉE.
//    Catalogue : vestiaire_universel, articles non gelés, lu une fois. Capsules : 4 saisons × 14 styles exposés
//    (8 femme, 6 homme) par computeDefaultCapsule, comme dans les audits de diversité. Météo représentative de la
//    saison. Tirages semés (mulberry32) : la même tenue est évaluée sous TOUS les bras.
//
// 2. LEVIERS.
//    · population des tenues — A « moteur » : generateOutfitWithFallback (ce que Capsela recommande) ;
//      B « aléatoire » : socle tiré au hasard dans la même capsule, accessoires facultatifs tirés au hasard, aucune
//      règle de l'application. A borne la note par le haut (tenues construites par des règles), B donne une tenue
//      non guidée. Une tenue photographiée par une personne n'est ni l'une ni l'autre : AUCUNE des deux ne représente
//      de vrais avis.
//    · profil — « nu » (aucune palette, aucune saison) ou « complet » (palette Noir + Marine + Camel, colorimétrie
//      d'automne). Il change le plafond des bonus de couleur, donc la note.
//    · verdict de la styliste — « Très réussi », « Réussi », « Bien vu », « À affiner », ou absent. Sa distribution
//      réelle est INCONNUE : il est donc balayé, jamais tiré.
//    Fixes : pondérations (25 / 20 / 10 / 45), bases par dimension, météo, occasion « quotidien » pour la note.
//
// 3. CRITÈRES DE JUGEMENT, ÉCRITS AVANT LA MESURE (ARBITRAGE ÉDITORIAL : ce sont des seuils de lecture, pas des mesures).
//    C1  médiane entre 6,5 et 8,0 pour le verdict « Bien vu » (une note « moyenne » ne doit être ni basse ni haute) ;
//    C2  part des notes ≥ 9 inférieure à 10 % pour le verdict « Réussi » (la note ne doit pas être toujours élevée) ;
//    C3  l'échelle est utilisée : au moins 15 % des tenues aléatoires sous 7, tous verdicts « Réussi » ;
//    C4  aucune dimension calculée n'est saturée : pas plus de 60 % des tenues sur la même valeur plafond ;
//    C5  aucune règle de score n'est inerte (jamais déclenchée) ni constante (déclenchée plus de 95 % du temps).
//
// 4. CE QUE CET AUDIT NE DIT PAS. Il ne dit rien de la distribution de vrais avis : ni les verdicts réels, ni les
//    pièces reconnues réelles, ni la part d'avis qui auront une note (il faut des pièces reconnues dans le dressing).
//    Il ne juge pas non plus la JUSTESSE de la note — seulement sa forme.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const TIRAGES = 12;
const VERDICTS = ["Très réussi", "Réussi", "Bien vu", "À affiner", undefined] as const;
const pal = (n: string) => PAL_COULEURS.find(([x]) => x === n)![1];
const PALETTE_COMPLETE = [pal("Noir"), pal("Marine"), pal("Camel")];
const COLO = colorimetrieMoteur(colorimetrieDeSaison("automne", "questionnaire"))!;

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const graine = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "—").padStart(5) + " %";
const f1 = (n: number) => n.toFixed(1).padStart(5);

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const moy = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - moy) ** 2, 0) / s.length);
  return { n: s.length, moy, sd, min: s[0], p5: q(0.05), p25: q(0.25), med: q(0.5), p75: q(0.75), p95: q(0.95), max: s[s.length - 1] };
}
const TRANCHES: [string, (n: number) => boolean][] = [
  ["<5", (n) => n < 5], ["5-5,9", (n) => n >= 5 && n < 6], ["6-6,9", (n) => n >= 6 && n < 7],
  ["7-7,9", (n) => n >= 7 && n < 8], ["8-8,9", (n) => n >= 8 && n < 9], ["≥9", (n) => n >= 9],
];

/** Population B : un socle tiré au hasard dans la capsule, des accessoires facultatifs tirés au hasard. */
function tenueAleatoire(capsule: Item[], rnd: () => number): Item[] {
  const de = (...cats: string[]) => capsule.filter((i) => cats.includes(i.cat));
  const un = (l: Item[]) => (l.length ? l[Math.floor(rnd() * l.length)] : null);
  const robes = de("robe", "combinaison");
  const hauts = de("haut");
  const bas = de("pantalon", "jean", "jupe", "short");
  const pieces: (Item | null)[] = [];
  if (robes.length && (!hauts.length || !bas.length || rnd() < 0.3)) pieces.push(un(robes));
  else pieces.push(un(hauts), un(bas));
  if (rnd() < 0.9) pieces.push(un(de("chaussures")));
  if (rnd() < 0.6) pieces.push(un(de("sac")));
  if (rnd() < 0.4) pieces.push(un(de("bijou")));
  if (rnd() < 0.3) pieces.push(un(de("accessoire")));
  if (rnd() < 0.3) pieces.push(un(de("veste", "manteau")));
  if (rnd() < 0.2) pieces.push(un(de("pull")));
  const vues = new Set<number>();
  return pieces.filter((p): p is Item => !!p && !vues.has(p.id) && !!vues.add(p.id));
}

describe("note de l'avis — distribution", () => {
  it("mesure la forme de la note, sur les mêmes tenues, sous tous les bras", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    assertCatalogueStyles(pool, STYLES_HOMME);
    console.log(`\nCatalogue : ${pool.length} articles non gelés (${rows.length} lus).`);

    // ═══ Les tenues : générées UNE fois, évaluées sous tous les bras ═══
    type Tenue = { pop: "A" | "B"; pieces: Item[] };
    const tenues: Tenue[] = [];
    let vides = 0;
    const avis = { overallAssessment: "x", strengths: [], mainAdvice: "", suggestions: [] };
    for (const gender of ["femme", "homme"] as const) {
      for (const style of gender === "femme" ? STYLES_FEMME : STYLES_HOMME) {
        for (const saison of CAPSULE_SEASONS as CapsuleSeason[]) {
          const w = representativeWeatherFor(saison);
          const capsule = computeDefaultCapsule(profilAudit({ gender, styles: [style] }), w, [], saison, pool);
          for (const occ of OCCS) {
            for (let k = 0; k < TIRAGES; k++) {
              const g = graine(`${gender}|${style}|${saison}|${occ}|${k}`);
              const vrai = Math.random;
              try {
                Math.random = mulberry32(g);
                const r = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], gender, saison);
                if (r.noCompleteOutfit || !r.ids.length) vides++;
                else tenues.push({ pop: "A", pieces: r.ids.map((id) => capsule.find((c) => c.id === id)).filter((p): p is CatalogItem => !!p) });
              } finally {
                Math.random = vrai;
              }
              const b = tenueAleatoire(capsule, mulberry32(g ^ 0x5bd1e995));
              if (tenueAUnSocle(b)) tenues.push({ pop: "B", pieces: b });
            }
          }
        }
      }
    }
    const meteo = representativeWeatherFor("Automne") as Weather;
    const parPop = (p: "A" | "B") => tenues.filter((t) => t.pop === p);
    console.log(`Tenues : A « moteur » ${parPop("A").length} (${vides} sans tenue complète, écartées) · B « aléatoire » ${parPop("B").length}.`);

    const note = (t: Tenue, verdict: (typeof VERDICTS)[number], complet: boolean) =>
      noteDeLaTenue({
        avis, composition: t.pieces, dressing: t.pieces, piecesDuConseil: [], titreVerdict: verdict,
        palette: complet ? PALETTE_COMPLETE : [], colorimetrie: complet ? COLO : null, meteo,
      });

    // ═══ 1 · DISTRIBUTION DE LA NOTE ═══
    console.log(`\n════════ 1 · DISTRIBUTION DE LA NOTE (même tenues sous chaque bras) ════════`);
    console.log(`  ${"pop.".padEnd(5)}${"profil".padEnd(8)}${"verdict".padEnd(13)}${"n".padStart(6)}${"moy".padStart(6)}${"σ".padStart(6)}${"min".padStart(6)}${"p5".padStart(6)}${"p25".padStart(6)}${"méd".padStart(6)}${"p75".padStart(6)}${"p95".padStart(6)}${"max".padStart(6)}   ${TRANCHES.map(([l]) => l.padStart(7)).join("")}`);
    const notes = new Map<string, number[]>();
    for (const pop of ["A", "B"] as const) {
      for (const complet of [false, true]) {
        for (const v of VERDICTS) {
          const xs = parPop(pop).map((t) => note(t, v, complet)?.note).filter((n): n is number => n !== undefined);
          notes.set(`${pop}|${complet}|${v}`, xs);
          const s = stats(xs);
          console.log(`  ${pop.padEnd(5)}${(complet ? "complet" : "nu").padEnd(8)}${(v ?? "(absent)").padEnd(13)}${String(s.n).padStart(6)}${f1(s.moy)} ${f1(s.sd)} ${f1(s.min)} ${f1(s.p5)} ${f1(s.p25)} ${f1(s.med)} ${f1(s.p75)} ${f1(s.p95)} ${f1(s.max)}   ${TRANCHES.map(([, f]) => pct(xs.filter(f).length, xs.length).padStart(7)).join("")}`);
        }
      }
    }

    // ═══ 2 · LES DIMENSIONS CALCULÉES — SATURATION ═══
    console.log(`\n════════ 2 · DIMENSIONS CALCULÉES (profil nu, verdict « Réussi ») ════════`);
    console.log(`  ${"pop.".padEnd(5)}${"dimension".padEnd(26)}${"évaluée".padStart(9)}${"moy".padStart(6)}${"σ".padStart(6)}${"min".padStart(6)}${"max".padStart(6)}   valeur la plus fréquente`);
    const plafonds: string[] = [];
    for (const pop of ["A", "B"] as const) {
      for (const cle of ["couleurs", "coordination", "finition"] as const) {
        const vals = parPop(pop).map((t) => note(t, "Réussi", false)?.dimensions.find((d) => d.cle === cle)?.note).filter((n): n is number => n !== undefined);
        const total = parPop(pop).length;
        const freq = new Map<number, number>();
        vals.forEach((v) => freq.set(v, (freq.get(v) ?? 0) + 1));
        const [vTop, nTop] = [...freq.entries()].sort((a, b) => b[1] - a[1])[0];
        const s = stats(vals);
        console.log(`  ${pop.padEnd(5)}${cle.padEnd(26)}${pct(vals.length, total).padStart(9)}${f1(s.moy)} ${f1(s.sd)} ${f1(s.min)} ${f1(s.max)}   ${vTop.toFixed(1)} (${pct(nTop, vals.length).trim()})`);
        if (nTop / vals.length > 0.6) plafonds.push(`${pop}/${cle} = ${vTop.toFixed(1)} sur ${((nTop / vals.length) * 100).toFixed(0)} %`);
      }
    }

    // ═══ 3 · LES RÈGLES : FRÉQUENCE DE DÉCLENCHEMENT ═══
    console.log(`\n════════ 3 · RÈGLES DE SCORE — part des tenues où chacune se déclenche (profil complet) ════════`);
    const regles = ["R-S1", "R-S2", "R-S3", "R-S4", "R-S5", "R-S6", "R-S7", "R-S8", "R-S10", "R-S11", "R-S18"];
    console.log(`  ${"règle".padEnd(8)}${"A moteur".padStart(11)}${"B aléatoire".padStart(13)}`);
    const frequences: Record<string, number[]> = {};
    const evalue = new Map<string, Set<string>[]>();
    for (const pop of ["A", "B"] as const) {
      evalue.set(pop, parPop(pop).map((t) => new Set(computeLookScore(t.pieces, "quotidien", PALETTE_COMPLETE, null, new Set(), meteo, undefined, undefined, [], COLO).regles.map((x) => x.regle))));
    }
    for (const r of regles) {
      const [a, b] = (["A", "B"] as const).map((pop) => {
        const l = evalue.get(pop)!;
        return { n: l.filter((x) => x.has(r)).length, total: l.length };
      });
      frequences[r] = [a.n / a.total, b.n / b.total];
      console.log(`  ${r.padEnd(8)}${pct(a.n, a.total).padStart(11)}${pct(b.n, b.total).padStart(13)}`);
    }

    // ═══ 4 · « À AMÉLIORER » ═══
    console.log(`\n════════ 4 · « À AMÉLIORER » CALCULÉ (hors conseil de la styliste) — nombre de pistes par tenue ════════`);
    for (const pop of ["A", "B"] as const) {
      const cpt = [0, 0, 0, 0];
      const titres = new Map<string, number>();
      const ts = parPop(pop);
      ts.forEach((t) => {
        const n = note(t, "Réussi", true);
        if (!n) return;
        cpt[Math.min(3, n.ameliorations.length)]++;
        n.ameliorations.forEach((a) => titres.set(a.titre, (titres.get(a.titre) ?? 0) + 1));
      });
      console.log(`  ${pop}  0 piste ${pct(cpt[0], ts.length).trim()} · 1 : ${pct(cpt[1], ts.length).trim()} · 2 : ${pct(cpt[2], ts.length).trim()} · 3 : ${pct(cpt[3], ts.length).trim()}   |   ${[...titres.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${pct(n, ts.length).trim()}`).join(" · ")}`);
    }

    // ═══ 5 · POIDS DE LA LECTURE DE LA STYLISTE ═══
    console.log(`\n════════ 5 · QUI FAIT LA NOTE ? étendue due au verdict, contre dispersion due aux tenues ════════`);
    for (const pop of ["A", "B"] as const) {
      const meds = VERDICTS.slice(0, 4).map((v) => stats(notes.get(`${pop}|false|${v}`)!).moy);
      const dispTenues = VERDICTS.slice(0, 4).map((v) => stats(notes.get(`${pop}|false|${v}`)!).sd);
      console.log(`  ${pop}  moyenne « À affiner » → « Très réussi » : ${f1(meds[3])} → ${f1(meds[0])} (étendue ${(meds[0] - meds[3]).toFixed(1)} pt) · σ due aux tenues à verdict fixé : ${f1(dispTenues.reduce((a, b) => a + b, 0) / 4)}`);
    }

    // ═══ 6 · LIBELLÉS ═══
    console.log(`\n════════ 6 · LIBELLÉS AFFICHÉS (profil nu) ════════`);
    for (const pop of ["A", "B"] as const) {
      for (const v of ["Réussi", "Bien vu"] as const) {
        const xs = notes.get(`${pop}|false|${v}`)!;
        const par = new Map<string, number>();
        xs.forEach((n) => par.set(interpretationNote(n).libelle, (par.get(interpretationNote(n).libelle) ?? 0) + 1));
        console.log(`  ${pop} ${v.padEnd(8)} ${[...par.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${pct(n, xs.length).trim()}`).join(" · ")}`);
      }
    }

    // ═══ 7 · CRITÈRES ═══
    console.log(`\n════════ 7 · CRITÈRES ÉCRITS AVANT LA MESURE ════════`);
    const bienVuA = stats(notes.get("A|false|Bien vu")!).med, bienVuB = stats(notes.get("B|false|Bien vu")!).med;
    const okC1 = [bienVuA, bienVuB].every((m) => m >= 6.5 && m <= 8.0);
    console.log(`  C1 médiane « Bien vu » dans [6,5 ; 8,0]    A ${bienVuA.toFixed(1)} · B ${bienVuB.toFixed(1)}   → ${okC1 ? "TENU" : "NON TENU"}`);
    const hautA = notes.get("A|false|Réussi")!.filter((n) => n >= 9).length / notes.get("A|false|Réussi")!.length;
    const hautB = notes.get("B|false|Réussi")!.filter((n) => n >= 9).length / notes.get("B|false|Réussi")!.length;
    console.log(`  C2 part ≥ 9 sous « Réussi » < 10 %          A ${(hautA * 100).toFixed(1)} % · B ${(hautB * 100).toFixed(1)} %   → ${hautA < 0.1 && hautB < 0.1 ? "TENU" : "NON TENU"}`);
    const basB = notes.get("B|false|Réussi")!.filter((n) => n < 7).length / notes.get("B|false|Réussi")!.length;
    console.log(`  C3 ≥ 15 % des tenues aléatoires sous 7      B ${(basB * 100).toFixed(1)} %                    → ${basB >= 0.15 ? "TENU" : "NON TENU"}`);
    console.log(`  C4 aucune dimension sur la même valeur > 60 %   ${plafonds.length ? "NON TENU : " + plafonds.join(" ; ") : "TENU"}`);
    const inertes = regles.filter((r) => frequences[r][0] === 0 && frequences[r][1] === 0);
    const constantes = regles.filter((r) => frequences[r][0] > 0.95 || frequences[r][1] > 0.95);
    console.log(`  C5 aucune règle inerte ni constante (> 95 %)    inertes : ${inertes.join(", ") || "aucune"} · constantes : ${constantes.join(", ") || "aucune"}   → ${inertes.length || constantes.length ? "NON TENU" : "TENU"}`);
  });
});
