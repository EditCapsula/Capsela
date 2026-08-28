import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { computeLookScore, generateOutfit } from "../src/lib/logic";
import { conseilAffichable, effetMorphologique, niveauConfiance, scoreMorphoV2 } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { EMPTY_PROFILE, type Profile } from "../src/lib/profile";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";

// SUBSTITUTION OPTIMISÉE — LECTURE SEULE, AUCUNE RÈGLE DE PRODUCTION MODIFIÉE.
//
// La contrefactuelle naïve (leviers pris dans l'ordre du catalogue, première
// pièce sortante venue) a montré un impact causal réel sur la poire mais ne
// disait pas quelle substitution est la bonne. Elle avait surtout un défaut
// de conception : ses « leviers » étaient définis une fois pour toutes comme
// « épaules ≥ 2 / bas discret », c'est-à-dire des leviers DE POIRE, appliqués
// aussi au triangle inversé — dont ils vont exactement à l'envers.
//
// Ici chaque morphologie a ses PROPRES leviers, et la substitution est
// choisie par évaluation réelle : les meilleurs couples (sortante, entrante)
// sont régénérés et c'est la mesure qui tranche, pas un ordre de catalogue.
//
// Rien n'est optimisé « pour faire parler le moteur » : une tenue neutre
// reste valide, un silence reste valide. Ce qui est mesuré, c'est le COÛT
// FONCTIONNEL d'un départage morphologique, en face de son bénéfice.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const STYLES = ["Casual chic", "Classique", "Glamour", "Bohème", "Streetwear", "Minimaliste"];
const K_MAX = 4;
const TIRAGES = 20;
/** Nombre de couples (sortante, entrante) réellement régénérés à chaque pas. */
const CANDIDATS_EVALUES = 4;
const PLAFOND = 40;

const profil = (styles: string[], morphology: string): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles, morphology });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const isSport = (it: Item) => formalityOf(it) === 0;
const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const BAS: CategoryKey[] = ["pantalon", "jean", "jupe", "short"];
const HAUTS: CategoryKey[] = ["haut", "pull", "veste", "manteau"];

/** Quotas de CAPSULE_GROUPS, redits ici pour lire la composition sans importer un symbole privé. */
const FAMILLES: [string, CategoryKey[], number][] = [
  ["hauts", ["haut", "pull"], 7],
  ["bas", BAS, 6],
  ["robes", ["robe", "combinaison"], 3],
  ["vestes", ["veste", "manteau"], 5],
  ["chauss.", ["chaussures"], 3],
  ["access.", ["sac", "accessoire"], 4],
  ["bijoux", ["bijou"], 2],
];

/**
 * Leviers DIRIGÉS. Une direction morphologique n'a de sens que rapportée à la
 * morphologie déclarée : ce qui compense une poire aggrave un triangle
 * inversé, et réciproquement. Il n'existe donc pas de « pièce
 * morphologiquement riche » dans l'absolu, et c'est exactement pourquoi une
 * notion générique de diversité morphologique est à écarter.
 */
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

/**
 * Pièce libérable : même prédicat que le garde-fou de budget de capsule.ts —
 * aucune occasion perdue, pas la dernière de sa catégorie, pas le dernier
 * palier de formalité de cette catégorie — augmenté de « n'est pas elle-même
 * un levier pour cette morphologie » et « n'est pas du Sport ».
 */
function liberable(capsule: CatalogItem[], i: number, morphology: string): boolean {
  const it = capsule[i];
  if (isSport(it)) return false;
  if (levierPour(it, morphology)) return false;
  const reste = capsule.filter((_, j) => j !== i);
  const occReste = new Set<OccasionKey>();
  reste.forEach((r) => occasionsDe(r).forEach((o) => occReste.add(o)));
  if (occasionsDe(it).some((o) => !occReste.has(o))) return false;
  if (!reste.some((r) => r.cat === it.cat)) return false;
  const palier = formalityOf(it);
  if (!reste.some((r) => r.cat === it.cat && formalityOf(r) === palier)) return false;
  // Garanties : collants et chaussures d'intérieur ne sont jamais libérées.
  if (it.cat === "accessoire" && it.accessoireType === "Collants") return false;
  if (it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur") return false;
  return true;
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
  const occCouvertes = new Set<OccasionKey>();
  capsule.forEach((it) => occasionsDe(it).forEach((o) => occCouvertes.add(o)));
  m.occasions = occCouvertes.size;
  m.categories = new Set(capsule.map((it) => it.cat)).size;
  const structurantes: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison"];
  m.paliers = new Set(capsule.filter((it) => structurantes.includes(it.cat)).map(formalityOf)).size;
  const interieur = capsule.some((it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur");
  const collants = capsule.some((it) => it.cat === "accessoire" && it.accessoireType === "Collants");
  m.garanties = (interieur ? 1 : 0) + (!besoinCollants || collants ? 1 : 0);

  const signatures = new Set<string>();
  for (const [occ] of OCCASIONS) {
    for (let n = 0; n < TIRAGES; n++) {
      const { ids } = generateOutfit(capsule, w, occ, "Présentiel", "Verre", [], "femme");
      if (!ids.length) continue;
      const pieces = capsule.filter((it) => ids.includes(it.id));
      signatures.add([...ids].sort((a, b) => a - b).join("-"));
      m.scores.push(computeLookScore(pieces, occ, [], morphology, new Set<string>(), w).score);
      // Les looks EXCLUSIVEMENT Sport sortent du dénominateur morphologique :
      // R-B11 en fait une liste blanche étanche, le sport est hors périmètre.
      if (pieces.every(isSport)) continue;
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
  m.looks = signatures.size;
  return m;
}

/** Taux de direction favorable : ce que la substitution cherche à améliorer. */
const tauxCompensation = (m: Mesure) => (m.actifs ? (m.compForte + m.comp) / m.actifs : 0);

/**
 * Une substitution optimisée : on énumère les couples (sortante libérable,
 * entrante levier de la MÊME famille), on les pré-classe par l'intensité du
 * levier, puis on RÉGÉNÈRE réellement les meilleurs candidats et on garde
 * celui que la mesure désigne. L'effectif ne bouge pas, donc le plafond de 40
 * est respecté par construction.
 */
function meilleureSubstitution(
  capsule: CatalogItem[], leviers: CatalogItem[], w: Weather, morphology: string, besoinCollants: boolean, base: Mesure
): { capsule: CatalogItem[]; mesure: Mesure; entrante: CatalogItem } | null {
  const couples: { i: number; l: CatalogItem; force: number }[] = [];
  for (const l of leviers) {
    if (capsule.some((c) => c.id === l.id)) continue;
    const e = effetMorphologique(l);
    const force = morphology === "f_poire"
      ? (HAUTS.includes(l.cat) ? e.epaules : 3 - e.hanches)
      : (BAS.includes(l.cat) ? e.hanches : 3 - e.epaules);
    for (let i = 0; i < capsule.length; i++) {
      if (capsule[i].cat !== l.cat) continue;
      if (!liberable(capsule, i, morphology)) continue;
      couples.push({ i, l, force });
    }
  }
  if (!couples.length) return null;
  couples.sort((a, b) => b.force - a.force || a.l.id - b.l.id);

  let meilleur: { capsule: CatalogItem[]; mesure: Mesure; entrante: CatalogItem } | null = null;
  const vus = new Set<string>();
  for (const c of couples) {
    const cle = `${c.i}:${c.l.id}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    if (vus.size > CANDIDATS_EVALUES) break;
    const variante = capsule.map((x, j) => (j === c.i ? c.l : x));
    const m = mesurer(variante, w, morphology, besoinCollants);
    // Une substitution qui coûterait une occasion est rejetée, quelle que
    // soit son apport morphologique : la polyvalence passe avant.
    if (m.occasions < base.occasions) continue;
    if (!meilleur || tauxCompensation(m) > tauxCompensation(meilleur.mesure)
      || (tauxCompensation(m) === tauxCompensation(meilleur.mesure) && m.looks > meilleur.mesure.looks)) {
      meilleur = { capsule: variante, mesure: m, entrante: c.l };
    }
  }
  return meilleur;
}

function agreger(cible: Mesure, m: Mesure) {
  cible.pieces += m.pieces; cible.sport += m.sport; cible.occasions += m.occasions;
  cible.categories += m.categories; cible.paliers += m.paliers; cible.garanties += m.garanties;
  cible.looks += m.looks; cible.scores.push(...m.scores);
  cible.compForte += m.compForte; cible.comp += m.comp; cible.neutre += m.neutre;
  cible.defav += m.defav; cible.defavFort += m.defavFort; cible.actifs += m.actifs;
  cible.high += m.high; cible.medium += m.medium; cible.conseil += m.conseil; cible.evalues += m.evalues;
}

const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const t = [...xs].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.floor(q * t.length))];
};

describe("Substitution optimisée, leviers dirigés par morphologie", () => {
  it("mesure le bénéfice et le coût réel d'un départage morphologique", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    // ─────────── DIAGNOSTIC DU PLAFOND DE 40 (étape 7) ───────────
    console.log(`\n════════ DIAGNOSTIC — COMPOSITION SOUS PLAFOND DE 40 ════════`);
    console.log(`  Famille    quota  observé(min–max)  dont Sport  dépassement possible`);
    const parFamille = new Map<string, number[]>();
    const sportParFamille = new Map<string, number[]>();
    let depassements = 0;
    for (const saison of SAISONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES) {
        const c = computeDefaultCapsule(profil([style], "f_poire"), w, [], saison, pool);
        if (c.length > PLAFOND) depassements += 1;
        for (const [nom, cats] of FAMILLES) {
          const n = c.filter((it) => cats.includes(it.cat)).length;
          const s = c.filter((it) => cats.includes(it.cat) && isSport(it)).length;
          parFamille.set(nom, [...(parFamille.get(nom) || []), n]);
          sportParFamille.set(nom, [...(sportParFamille.get(nom) || []), s]);
        }
      }
    }
    for (const [nom, , quota] of FAMILLES) {
      const v = parFamille.get(nom) || [];
      const s = sportParFamille.get(nom) || [];
      // Plafond théorique = quota + complément de redistribution (quota/2 arrondi
      // au supérieur) + garanties hors quota applicables à cette famille.
      const theorique = quota + Math.ceil(quota / 2);
      console.log(`  ${nom.padEnd(10)} ${String(quota).padStart(5)}  ${(Math.min(...v) + "–" + Math.max(...v)).padStart(16)}  ${(Math.min(...s) + "–" + Math.max(...s)).padStart(10)}  ${String(theorique).padStart(6)} + garanties`);
    }
    console.log(`  Capsules au-dessus de 40 : ${depassements} / 24`);

    // ─────────── EXPÉRIENCE OPTIMISÉE (étapes 2 à 4) ───────────
    for (const morphology of ["f_poire", "f_triangle_inverse"]) {
      console.log(`\n\n════════════════ MORPHOLOGIE : ${morphology} ════════════════`);
      const parK: Mesure[] = [];
      // Pour chaque capsule, on garde l'état courant afin d'enchaîner les
      // substitutions de façon gloutonne mais évaluée à chaque pas.
      const etats: { capsule: CatalogItem[]; w: Weather; leviers: CatalogItem[]; collants: boolean; base: Mesure }[] = [];
      for (const saison of SAISONS) {
        const w = representativeWeatherFor(saison);
        const bucket = capsuleSeasonBucket(saison);
        const collants = bucket === "Automne / Hiver";
        const eligible = pool.filter((it) =>
          it.genre !== "homme" &&
          (it.season === bucket || it.season === "Toutes saisons") &&
          (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
          (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp) &&
          !isSport(it) && levierPour(it, morphology) !== null
        );
        for (const style of STYLES) {
          const capsule = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool);
          const base = mesurer(capsule, w, morphology, collants);
          etats.push({ capsule, w, leviers: eligible.filter((e) => !capsule.some((c) => c.id === e.id)), collants, base });
        }
      }

      const gainsParPas: number[][] = [];
      for (let k = 0; k <= K_MAX; k++) {
        const agg = VIDE();
        const gains: number[] = [];
        for (const e of etats) {
          if (k > 0) {
            const avant = tauxCompensation(mesurer(e.capsule, e.w, morphology, e.collants));
            const best = meilleureSubstitution(e.capsule, e.leviers, e.w, morphology, e.collants, e.base);
            if (best) {
              e.capsule = best.capsule;
              e.leviers = e.leviers.filter((l) => l.id !== best.entrante.id);
              gains.push(tauxCompensation(best.mesure) - avant);
            } else {
              gains.push(0);
            }
          }
          agreger(agg, mesurer(e.capsule, e.w, morphology, e.collants));
        }
        parK.push(agg);
        if (k > 0) gainsParPas.push(gains);
      }

      const n = etats.length;
      console.log(`\n──── COURBE DE RENDEMENT MARGINAL (substitution ÉVALUÉE, effectif constant) ────`);
      console.log(`  ${"k".padEnd(3)}${"pièces".padStart(8)}${"occ.".padStart(6)}${"cat.".padStart(6)}${"gar.".padStart(6)}${"looks".padStart(7)}${"Δlooks".padStart(8)}${"score".padStart(7)}${"P10".padStart(6)}${"P90".padStart(6)}${"comp++".padStart(8)}${"comp+".padStart(7)}${"neutre".padStart(8)}${"défav".padStart(7)}${"conseil".padStart(8)}`);
      for (let k = 0; k <= K_MAX; k++) {
        const a = parK[k];
        const moyScore = a.scores.reduce((s, x) => s + x, 0) / (a.scores.length || 1);
        console.log(
          `  ${String(k).padEnd(3)}${(a.pieces / n).toFixed(1).padStart(8)}${(a.occasions / n).toFixed(1).padStart(6)}` +
          `${(a.categories / n).toFixed(1).padStart(6)}${(a.garanties / n).toFixed(1).padStart(6)}` +
          `${String(a.looks).padStart(7)}${(k === 0 ? "—" : (a.looks - parK[k - 1].looks > 0 ? "+" : "") + (a.looks - parK[k - 1].looks)).padStart(8)}` +
          `${moyScore.toFixed(1).padStart(7)}${String(quantile(a.scores, 0.1)).padStart(6)}${String(quantile(a.scores, 0.9)).padStart(6)}` +
          `${pct(a.compForte, a.actifs).padStart(8)}${pct(a.comp, a.actifs).padStart(7)}${pct(a.neutre, a.actifs).padStart(8)}` +
          `${pct(a.defav + a.defavFort, a.actifs).padStart(7)}${pct(a.conseil, a.evalues).padStart(8)}`
        );
      }
      console.log(`  Gain marginal moyen de compensation par pas :`);
      gainsParPas.forEach((g, idx) => {
        const moy = g.reduce((s, x) => s + x, 0) / (g.length || 1);
        const positifs = g.filter((x) => x > 0.001).length;
        console.log(`     pas ${idx + 1} : ${(moy * 100).toFixed(2)} pts · capsules améliorées ${positifs}/${g.length}`);
      });

      // ─────────── FONCTIONS DE SATURATION (étape 3) ───────────
      // Les trois fonctions ne sont PAS des seuils : elles pondèrent la valeur
      // du n-ième levier déjà présent sur l'axe. La substitution est acceptée
      // tant que ce poids reste au-dessus d'un seuil commun, identique pour
      // les trois — ce qui compare bien les FORMES de décroissance et non
      // trois réglages différents du même quota.
      const SEUIL = 0.25;
      const FONCTIONS: [string, (n: number) => number][] = [
        ["A — paliers", (x) => [1, 0.6, 0.3, 0.05][x] ?? 0],
        ["B — continue 1/(1+n)", (x) => 1 / (1 + x)],
        ["C — effondrement après 2", (x) => (x <= 1 ? 1 : Math.pow(0.1, x - 1))],
      ];
      console.log(`\n──── FONCTIONS DE SATURATION (seuil commun ${SEUIL}) ────`);
      console.log(`  ${"fonction".padEnd(26)}${"subst.".padStart(8)}${"occ.".padStart(6)}${"looks".padStart(7)}${"score".padStart(7)}${"comp.".padStart(8)}${"neutre".padStart(8)}${"défav".padStart(7)}${"conseil".padStart(8)}`);
      for (const [nom, poids] of FONCTIONS) {
        const agg = VIDE();
        let subst = 0;
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          const bucket = capsuleSeasonBucket(saison);
          const collants = bucket === "Automne / Hiver";
          const eligible = pool.filter((it) =>
            it.genre !== "homme" &&
            (it.season === bucket || it.season === "Toutes saisons") &&
            (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
            (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp) &&
            !isSport(it) && levierPour(it, morphology) !== null
          );
          for (const style of STYLES) {
            let capsule = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool);
            const base = mesurer(capsule, w, morphology, collants);
            let leviers = eligible.filter((e) => !capsule.some((c) => c.id === e.id));
            for (let pas = 0; pas < K_MAX; pas++) {
              // Le poids se lit sur le nombre de leviers DÉJÀ présents sur
              // l'axe visé — la valeur décroît avec la redondance, elle n'est
              // jamais coupée par un compteur.
              const dispo = leviers.filter((l) => {
                const axe = levierPour(l, morphology);
                if (!axe) return false;
                const dejaLa = capsule.filter((c) => levierPour(c, morphology) === axe).length;
                return poids(dejaLa) >= SEUIL;
              });
              if (!dispo.length) break;
              const best = meilleureSubstitution(capsule, dispo, w, morphology, collants, base);
              if (!best) break;
              capsule = best.capsule;
              leviers = leviers.filter((l) => l.id !== best.entrante.id);
              subst += 1;
            }
            agreger(agg, mesurer(capsule, w, morphology, collants));
          }
        }
        const moyScore = agg.scores.reduce((s, x) => s + x, 0) / (agg.scores.length || 1);
        console.log(
          `  ${nom.padEnd(26)}${(subst / n).toFixed(2).padStart(8)}${(agg.occasions / n).toFixed(1).padStart(6)}` +
          `${String(agg.looks).padStart(7)}${moyScore.toFixed(1).padStart(7)}` +
          `${pct(agg.compForte + agg.comp, agg.actifs).padStart(8)}${pct(agg.neutre, agg.actifs).padStart(8)}` +
          `${pct(agg.defav + agg.defavFort, agg.actifs).padStart(7)}${pct(agg.conseil, agg.evalues).padStart(8)}`
        );
      }
    }

    console.log(`\nAucun fichier de production n'a été modifié — audit en lecture seule.`);
  }, 3_600_000);
});
