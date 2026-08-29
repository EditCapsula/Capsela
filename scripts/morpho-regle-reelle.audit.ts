import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { computeLookScore, generateOutfit } from "../src/lib/logic";
import { conseilAffichable, effetMorphologique, niveauConfiance, scoreMorphoV2 } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { type Profile } from "../src/lib/profile";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";
import { OCCASIONS, type Weather } from "../src/lib/data";

// LA RÈGLE RÉELLE CONTRE L'ORACLE — LECTURE SEULE.
//
// L'expérience optimisée choisissait la substitution en RÉGÉNÉRANT les looks
// et en regardant le résultat. pickBestMarginal ne peut pas faire ça : il
// tranche entre deux pièces sur leurs seuls attributs, sans savoir quels
// looks en sortiront. Les gains mesurés étaient donc un PLAFOND, pas un
// atteignable, et un GO fondé dessus aurait crédité la règle des
// performances de l'oracle.
//
// Même protocole, même contrainte d'effectif, mêmes garde-fous : seul le
// CHOOSEUR change. L'écart entre les deux colonnes est exactement le biais
// d'oracle. Et tout est ventilé PAR SAISON, puisque le problème d'origine
// était saisonnier et que l'agrégat sur 24 capsules pouvait le masquer.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
/**
 * Les styles exposés, par IDENTIFIANT (harnais d'audit du 29/08/2026).
 * Les libellés français qu'utilisait la version précédente renvoyaient
 * `undefined` via STYLE_ID_TO_CATALOG_LABEL : le filtre de style était
 * silencieusement sauté et la mesure portait sur un pool universel.
 */
const STYLES = STYLES_FEMME;
const K = 2;
const TIRAGES = 20;
const SEUIL = 0.25;

const profil = (styles: readonly string[], morphology: string): Profile => profilAudit({ gender: "femme", styles, morphology });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const isSport = (it: Item) => formalityOf(it) === 0;
const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const BAS: CategoryKey[] = ["pantalon", "jean", "jupe", "short"];
const HAUTS: CategoryKey[] = ["haut", "pull", "veste", "manteau"];

type Axe = "haut" | "bas";
function levierPour(it: Item, morphology: string): Axe | null {
  const e = effetMorphologique(it);
  if (e.confiance === "inconnue") return null;
  if (morphology === "f_poire") {
    if (HAUTS.includes(it.cat) && e.epaules >= 2) return "haut";
    if (BAS.includes(it.cat) && e.hanches <= 1) return "bas";
    return null;
  }
  if (morphology === "f_triangle_inverse") {
    if (BAS.includes(it.cat) && e.hanches >= 2) return "bas";
    if (HAUTS.includes(it.cat) && e.epaules <= 1) return "haut";
    return null;
  }
  return null;
}

/** Intensité de la direction apportée, sur l'axe concerné, 0 à 3. */
function force(it: Item, morphology: string): number {
  const e = effetMorphologique(it);
  return morphology === "f_poire"
    ? (HAUTS.includes(it.cat) ? e.epaules : 3 - e.hanches)
    : (BAS.includes(it.cat) ? e.hanches : 3 - e.epaules);
}

/** Mêmes garde-fous que respecterBudget, plus les garanties et le sport. */
function liberable(capsule: CatalogItem[], i: number, morphology: string): boolean {
  const it = capsule[i];
  if (isSport(it)) return false;
  if (levierPour(it, morphology)) return false;
  if (it.cat === "accessoire" && it.accessoireType === "Collants") return false;
  if (it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur") return false;
  const reste = capsule.filter((_, j) => j !== i);
  const occReste = new Set<OccasionKey>();
  reste.forEach((r) => occasionsDe(r).forEach((o) => occReste.add(o)));
  if (occasionsDe(it).some((o) => !occReste.has(o))) return false;
  if (!reste.some((r) => r.cat === it.cat)) return false;
  const palier = formalityOf(it);
  return reste.some((r) => r.cat === it.cat && formalityOf(r) === palier);
}

type Mesure = {
  pieces: number; sport: number; occasions: number; categories: number; paliers: number; garanties: number;
  looks: number; scores: number[];
  compForte: number; comp: number; neutre: number; defav: number; defavFort: number; actifs: number;
  high: number; medium: number; conseil: number; evalues: number;
};
const VIDE = (): Mesure => ({
  pieces: 0, sport: 0, occasions: 0, categories: 0, paliers: 0, garanties: 0, looks: 0, scores: [],
  compForte: 0, comp: 0, neutre: 0, defav: 0, defavFort: 0, actifs: 0, high: 0, medium: 0, conseil: 0, evalues: 0,
});

function mesurer(capsule: CatalogItem[], w: Weather, morphology: string, besoinCollants: boolean): Mesure {
  const m = VIDE();
  m.pieces = capsule.length;
  m.sport = capsule.filter(isSport).length;
  const occ = new Set<OccasionKey>();
  capsule.forEach((it) => occasionsDe(it).forEach((o) => occ.add(o)));
  m.occasions = occ.size;
  m.categories = new Set(capsule.map((it) => it.cat)).size;
  const struct: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison"];
  m.paliers = new Set(capsule.filter((it) => struct.includes(it.cat)).map(formalityOf)).size;
  const interieur = capsule.some((it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur");
  const collants = capsule.some((it) => it.cat === "accessoire" && it.accessoireType === "Collants");
  m.garanties = (interieur ? 1 : 0) + (!besoinCollants || collants ? 1 : 0);

  const sig = new Set<string>();
  for (const [o] of OCCASIONS) {
    for (let n = 0; n < TIRAGES; n++) {
      const { ids } = generateOutfit(capsule, w, o, "Présentiel", "Verre", [], "femme");
      if (!ids.length) continue;
      const pieces = capsule.filter((it) => ids.includes(it.id));
      sig.add([...ids].sort((a, b) => a - b).join("-"));
      m.scores.push(computeLookScore(pieces, o, [], morphology, new Set<string>(), w).score);
      if (pieces.every(isSport)) continue;   // hors périmètre morphologique
      m.evalues += 1;
      const s = scoreMorphoV2(pieces, morphology);
      if (s.actif) {
        m.actifs += 1;
        if (s.direction === "compensation_forte") m.compForte += 1;
        else if (s.direction === "compensation") m.comp += 1;
        else if (s.direction === "neutre") m.neutre += 1;
        else if (s.direction === "defavorable") m.defav += 1;
        else m.defavFort += 1;
      }
      const niv = niveauConfiance(pieces);
      if (niv === "HIGH") m.high += 1;
      else if (niv === "MEDIUM") m.medium += 1;
      if (conseilAffichable(pieces, morphology)) m.conseil += 1;
    }
  }
  m.looks = sig.size;
  return m;
}

const tauxComp = (m: Mesure) => (m.actifs ? (m.compForte + m.comp) / m.actifs : 0);

/** ORACLE : régénère les meilleurs couples et garde ce que la mesure désigne. */
function pasOracle(capsule: CatalogItem[], leviers: CatalogItem[], w: Weather, morphology: string, coll: boolean) {
  const couples: { i: number; l: CatalogItem; f: number }[] = [];
  for (const l of leviers) {
    if (capsule.some((c) => c.id === l.id)) continue;
    for (let i = 0; i < capsule.length; i++) {
      if (capsule[i].cat !== l.cat || !liberable(capsule, i, morphology)) continue;
      couples.push({ i, l, f: force(l, morphology) });
    }
  }
  if (!couples.length) return null;
  couples.sort((a, b) => b.f - a.f || a.l.id - b.l.id);
  let best: { capsule: CatalogItem[]; entrante: CatalogItem; taux: number } | null = null;
  const vus = new Set<string>();
  for (const c of couples) {
    const cle = `${c.i}:${c.l.id}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (vus.size > 4) break;
    const v = capsule.map((x, j) => (j === c.i ? c.l : x));
    const m = mesurer(v, w, morphology, coll);
    if (!best || tauxComp(m) > best.taux) best = { capsule: v, entrante: c.l, taux: tauxComp(m) };
  }
  return best ? { capsule: best.capsule, entrante: best.entrante } : null;
}

/**
 * RÈGLE RÉELLE : aucun accès aux looks. La pièce entrante est choisie sur ses
 * seuls attributs — poids de saturation de l'axe × intensité de la direction —
 * et la sortante est la plus redondante de sa famille (non basique d'abord,
 * puis id le plus grand, comme le -id du tri existant).
 */
function pasRegle(capsule: CatalogItem[], leviers: CatalogItem[], morphology: string, poids: (n: number) => number) {
  let choix: { i: number; l: CatalogItem; v: number } | null = null;
  for (const l of leviers) {
    if (capsule.some((c) => c.id === l.id)) continue;
    const axe = levierPour(l, morphology);
    if (!axe) continue;
    const dejaLa = capsule.filter((c) => levierPour(c, morphology) === axe).length;
    const p = poids(dejaLa);
    if (p < SEUIL) continue;
    const v = p * force(l, morphology);
    const sortantes = capsule
      .map((c, i) => ({ c, i }))
      .filter(({ c, i }) => c.cat === l.cat && liberable(capsule, i, morphology))
      .sort((a, b) => (a.c.estBasiqueCapsule ? 1 : 0) - (b.c.estBasiqueCapsule ? 1 : 0) || b.c.id - a.c.id);
    if (!sortantes.length) continue;
    if (!choix || v > choix.v || (v === choix.v && l.id < choix.l.id)) choix = { i: sortantes[0].i, l, v };
  }
  if (!choix) return null;
  return { capsule: capsule.map((x, j) => (j === choix!.i ? choix!.l : x)), entrante: choix.l };
}

function agreger(c: Mesure, m: Mesure) {
  c.pieces += m.pieces; c.sport += m.sport; c.occasions += m.occasions; c.categories += m.categories;
  c.paliers += m.paliers; c.garanties += m.garanties; c.looks += m.looks; c.scores.push(...m.scores);
  c.compForte += m.compForte; c.comp += m.comp; c.neutre += m.neutre; c.defav += m.defav;
  c.defavFort += m.defavFort; c.actifs += m.actifs; c.high += m.high; c.medium += m.medium;
  c.conseil += m.conseil; c.evalues += m.evalues;
}
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const t = [...xs].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.floor(q * t.length))];
};

const POIDS: Record<string, (n: number) => number> = {
  A: (x) => [1, 0.6, 0.3, 0.05][x] ?? 0,
  B: (x) => 1 / (1 + x),
};

describe("Règle réelle contre oracle, ventilé par saison", () => {
  it("mesure le biais d'oracle et le comportement saisonnier", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    // ─────────── B1 CONTRE B4 — LE RANG 3 TRANCHE-T-IL SEULEMENT ? ───────────
    //
    // Test de RÉFUTATION, à faire avant tout le reste. B1 est la production
    // avec morphologie déclarée : morphoFit peut départager au rang 3. B4 est
    // la même production avec morphology = null : morphoFit renvoie alors
    // toujours false, le rang 3 devient constant, et le tri se réduit à
    // occasions → basique → id.
    //
    // Si B1 et B4 produisent la même capsule, c'est que le rang 3 n'est
    // JAMAIS atteint dans les faits — deux pièces ne sont pratiquement jamais
    // à égalité sur la couverture marginale ET sur le caractère basique. Un
    // signal V2 placé au rang 4, donc encore plus bas, serait alors
    // structurellement muet, et la question du « legacy qui masque V2 » se
    // dissoudrait : ce n'est pas le legacy qui masque, c'est le rang 1 qui
    // décide seul.
    console.log(`\n════════ RÉFUTATION PRÉALABLE — LE RANG MORPHOLOGIQUE TRANCHE-T-IL ? ════════`);
    console.log(`  Comparaison B1 (morphologie déclarée) contre B4 (morphologie nulle),`);
    console.log(`  sur la MÊME production, tous filtres et garanties identiques.\n`);
    console.log(`  ${"morphologie".padEnd(20)}${"saison".padEnd(11)}${"capsules ≠".padStart(11)}${"pièces ≠ (moy)".padStart(16)}${"max".padStart(6)}`);
    let totalDiff = 0, totalCapsules = 0;
    for (const morphology of ["f_poire", "f_triangle_inverse", "f_rectangle", "f_sablier", "f_pomme"]) {
      for (const saison of SAISONS) {
        const w = representativeWeatherFor(saison);
        let capsulesDifferentes = 0;
        const ecarts: number[] = [];
        for (const style of STYLES) {
          const avec = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool);
          const sans = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style], morphology: null }), w, [], saison, pool);
          const idsSans = new Set(sans.map((it) => it.id));
          const ecart = avec.filter((it) => !idsSans.has(it.id)).length;
          ecarts.push(ecart);
          if (ecart > 0) capsulesDifferentes += 1;
          totalCapsules += 1;
          if (ecart > 0) totalDiff += 1;
        }
        console.log(
          `  ${morphology.padEnd(20)}${saison.padEnd(11)}${(capsulesDifferentes + "/" + STYLES.length).padStart(11)}` +
          `${(ecarts.reduce((a, b) => a + b, 0) / ecarts.length).toFixed(2).padStart(16)}${String(Math.max(...ecarts)).padStart(6)}`
        );
      }
    }
    console.log(`\n  Capsules dont la composition change quand la morphologie est déclarée : ${totalDiff} / ${totalCapsules}`);
    console.log(`  (morphoFit legacy au rang 3 ; un signal V2 au rang 4 serait atteint encore moins souvent)`);

    const VARIANTES = ["Contrôle", "Oracle", "Règle A", "Règle B"] as const;

    for (const morphology of ["f_poire", "f_triangle_inverse"]) {
      console.log(`\n\n════════════════ ${morphology} ════════════════`);
      const global = new Map<string, Mesure>(VARIANTES.map((v) => [v, VIDE()]));
      const substitutions = new Map<string, number>(VARIANTES.map((v) => [v, 0]));

      for (const saison of SAISONS) {
        const w = representativeWeatherFor(saison);
        const bucket = capsuleSeasonBucket(saison);
        const coll = bucket === "Automne / Hiver";
        const eligible = pool.filter((it) =>
          it.genre !== "homme" &&
          (it.season === bucket || it.season === "Toutes saisons") &&
          (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
          (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp) &&
          !isSport(it) && levierPour(it, morphology) !== null
        );
        const parSaison = new Map<string, Mesure>(VARIANTES.map((v) => [v, VIDE()]));

        for (const style of STYLES) {
          const base = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool);
          for (const variante of VARIANTES) {
            let capsule = base;
            let leviers = eligible.filter((e) => !base.some((c) => c.id === e.id));
            if (variante !== "Contrôle") {
              for (let pas = 0; pas < K; pas++) {
                const r = variante === "Oracle"
                  ? pasOracle(capsule, leviers, w, morphology, coll)
                  : pasRegle(capsule, leviers, morphology, POIDS[variante === "Règle A" ? "A" : "B"]);
                if (!r) break;
                capsule = r.capsule;
                leviers = leviers.filter((l) => l.id !== r.entrante.id);
                substitutions.set(variante, (substitutions.get(variante) ?? 0) + 1);
              }
            }
            const m = mesurer(capsule, w, morphology, coll);
            agreger(parSaison.get(variante)!, m);
            agreger(global.get(variante)!, m);
          }
        }

        console.log(`\n──── ${saison.toUpperCase()} ────`);
        console.log(`  ${"variante".padEnd(11)}${"occ.".padStart(6)}${"looks".padStart(7)}${"score".padStart(7)}${"comp.".padStart(8)}${"neutre".padStart(8)}${"défav".padStart(7)}${"HIGH".padStart(7)}${"MED".padStart(7)}${"conseil".padStart(8)}`);
        for (const v of VARIANTES) {
          const a = parSaison.get(v)!;
          const moy = a.scores.reduce((s, x) => s + x, 0) / (a.scores.length || 1);
          console.log(
            `  ${v.padEnd(11)}${(a.occasions / STYLES.length).toFixed(1).padStart(6)}${String(a.looks).padStart(7)}` +
            `${moy.toFixed(1).padStart(7)}${pct(a.compForte + a.comp, a.actifs).padStart(8)}` +
            `${pct(a.neutre, a.actifs).padStart(8)}${pct(a.defav + a.defavFort, a.actifs).padStart(7)}` +
            `${pct(a.high, a.evalues).padStart(7)}${pct(a.medium, a.evalues).padStart(7)}${pct(a.conseil, a.evalues).padStart(8)}`
          );
        }
      }

      const n = SAISONS.length * STYLES.length;
      console.log(`\n──── SYNTHÈSE ${morphology} ────`);
      console.log(`  ${"variante".padEnd(11)}${"subst.".padStart(7)}${"pièces".padStart(8)}${"sport".padStart(7)}${"occ.".padStart(6)}${"cat.".padStart(6)}${"gar.".padStart(6)}${"looks".padStart(7)}${"Δlooks".padStart(8)}${"moy".padStart(7)}${"méd".padStart(6)}${"P10".padStart(6)}${"P90".padStart(6)}${"comp++".padStart(8)}${"comp+".padStart(7)}${"neutre".padStart(8)}${"déf".padStart(7)}${"déf++".padStart(7)}${"conseil".padStart(8)}`);
      const ref = global.get("Contrôle")!;
      for (const v of VARIANTES) {
        const a = global.get(v)!;
        const moy = a.scores.reduce((s, x) => s + x, 0) / (a.scores.length || 1);
        console.log(
          `  ${v.padEnd(11)}${((substitutions.get(v) ?? 0) / n).toFixed(2).padStart(7)}` +
          `${(a.pieces / n).toFixed(1).padStart(8)}${(a.sport / n).toFixed(1).padStart(7)}${(a.occasions / n).toFixed(1).padStart(6)}` +
          `${(a.categories / n).toFixed(1).padStart(6)}${(a.garanties / n).toFixed(1).padStart(6)}${String(a.looks).padStart(7)}` +
          `${(v === "Contrôle" ? "—" : (((a.looks - ref.looks) / ref.looks) * 100).toFixed(1) + " %").padStart(8)}` +
          `${moy.toFixed(1).padStart(7)}${String(quantile(a.scores, 0.5)).padStart(6)}${String(quantile(a.scores, 0.1)).padStart(6)}${String(quantile(a.scores, 0.9)).padStart(6)}` +
          `${pct(a.compForte, a.actifs).padStart(8)}${pct(a.comp, a.actifs).padStart(7)}${pct(a.neutre, a.actifs).padStart(8)}` +
          `${pct(a.defav, a.actifs).padStart(7)}${pct(a.defavFort, a.actifs).padStart(7)}${pct(a.conseil, a.evalues).padStart(8)}`
        );
      }
    }

    console.log(`\nAucun fichier de production n'a été modifié — audit en lecture seule.`);
  }, 3_600_000);
});
