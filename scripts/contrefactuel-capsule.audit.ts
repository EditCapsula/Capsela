import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { computeLookScore, generateOutfit } from "../src/lib/logic";
import { conseilAffichable, effetMorphologique, niveauConfiance, scoreMorphoV2 } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import { type Profile } from "../src/lib/profile";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";
import { OCCASIONS } from "../src/lib/data";

// A/B CONTREFACTUEL DE SUBSTITUTION — LECTURE SEULE, AUCUNE RÈGLE MODIFIÉE.
//
// L'entonnoir a montré que les leviers morphologiques disparaissent à
// l'étage de la SÉLECTION de capsule : 20 leviers épaules éligibles en été,
// 2 retenus, 2 utilisés. C'est une preuve de MÉCANISME, pas une preuve
// d'IMPACT : rien n'y démontre que remettre ces pièces ferait monter le taux
// de compensation. Les deux questions sont distinctes, et c'est la seconde
// qui décide s'il faut toucher à la sélection.
//
// L'expérience remplace donc, à effectif CONSTANT, des pièces neutres
// redondantes de la capsule par des leviers écartés, puis régénère les looks
// et mesure ce qui change — y compris ce qui se dégrade.
//
// Le remplacement n'est PAS gratuit : une pièce retirée peut coûter de la
// polyvalence. Le pull fin qui bat le pull oversize au classement marginal
// peut parfaitement être le bon choix de capsule. C'est pourquoi la
// couverture d'occasion, la diversité des looks et le score global sont
// mesurés au même titre que la compensation morphologique.
//
// Trois variantes, plus une courbe de rendement marginal (k = 0…5
// substitutions) destinée à répondre par la mesure, et non à la main, à la
// question « combien de leviers avant saturation ? ».

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
const MORPHOS = ["f_poire", "f_triangle_inverse"];
const K_MAX = 5;
const TIRAGES = 25;

const profil = (styles: readonly string[], morphology?: string): Profile => profilAudit({ gender: "femme", styles, morphology: morphology ?? null });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const isSport = (it: Item) => formalityOf(it) === 0;
const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const BAS = ["pantalon", "jean", "jupe", "short"];

/**
 * Les trois axes de capacité morphologique que le modèle sait réellement
 * lire. Volontairement pas « la morphologie » en général : le moteur ne
 * connaît pas le corps, seulement l'effet des vêtements.
 */
type Axe = "epaules" | "bas_discret" | "taille";
function axesDe(it: Item): Axe[] {
  const e = effetMorphologique(it);
  const out: Axe[] = [];
  if (e.epaules >= 2) out.push("epaules");
  if (BAS.includes(it.cat) && e.confiance !== "inconnue" && e.hanches <= 1) out.push("bas_discret");
  if (e.taille >= 2) out.push("taille");
  return out;
}

/**
 * Pièce que l'on peut retirer sans rien casser : même prédicat que le
 * garde-fou de budget de capsule.ts — aucune occasion perdue, pas la
 * dernière de sa catégorie, pas le dernier palier de formalité de cette
 * catégorie — augmenté de « n'apporte aucun axe morphologique ».
 */
function redondanteNeutre(capsule: CatalogItem[], i: number): boolean {
  const it = capsule[i];
  if (isSport(it)) return false;
  if (axesDe(it).length) return false;
  const reste = capsule.filter((_, j) => j !== i);
  const occReste = new Set<OccasionKey>();
  reste.forEach((r) => occasionsDe(r).forEach((o) => occReste.add(o)));
  if (occasionsDe(it).some((o) => !occReste.has(o))) return false;
  if (!reste.some((r) => r.cat === it.cat)) return false;
  const palier = formalityOf(it);
  return reste.some((r) => r.cat === it.cat && formalityOf(r) === palier);
}

type Mesure = {
  pieces: number; occasions: number; looks: number; score: number;
  compensation: number; neutre: number; defavorable: number; actifs: number; conseil: number; evalues: number;
};

function mesurer(capsule: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, morphology: string): Mesure {
  const occCouvertes = new Set<OccasionKey>();
  capsule.forEach((it) => occasionsDe(it).forEach((o) => occCouvertes.add(o)));

  const signatures = new Set<string>();
  let sommeScore = 0, nLooks = 0;
  let compensation = 0, neutre = 0, defavorable = 0, actifs = 0, conseil = 0, evalues = 0;

  for (const [occ] of OCCASIONS) {
    for (let n = 0; n < TIRAGES; n++) {
      const { ids } = generateOutfit(capsule, w, occ, "Présentiel", "Verre", [], "femme");
      if (!ids.length) continue;
      const pieces = capsule.filter((it) => ids.includes(it.id));
      signatures.add([...ids].sort((a, b) => a - b).join("-"));
      sommeScore += computeLookScore(pieces, occ, [], morphology, new Set<string>(), w).score;
      nLooks += 1;
      // Le sport est hors périmètre morphologique (R-B11 en fait une liste
      // blanche étanche) : il ne doit pas peser sur le dénominateur.
      if (pieces.every(isSport)) continue;
      evalues += 1;
      const s = scoreMorphoV2(pieces, morphology);
      if (!s.actif) continue;
      actifs += 1;
      if (s.delta > 0) compensation += 1;
      else if (s.delta === 0) neutre += 1;
      else defavorable += 1;
      const niv = niveauConfiance(pieces);
      if ((niv === "HIGH" || niv === "MEDIUM") && conseilAffichable(pieces, morphology)) conseil += 1;
    }
  }
  return {
    pieces: capsule.length, occasions: occCouvertes.size, looks: signatures.size,
    score: nLooks ? sommeScore / nLooks : 0,
    compensation, neutre, defavorable, actifs, conseil, evalues,
  };
}

/** Applique k substitutions selon la politique demandée, à effectif constant. */
function substituer(capsule: CatalogItem[], leviers: CatalogItem[], k: number, nonRedondantsSeulement: boolean): CatalogItem[] {
  let courant = [...capsule];
  const dejaPris = new Set<number>();
  for (let n = 0; n < k; n++) {
    // Compte des axes déjà représentés — sert à la variante B.
    const presence = new Map<Axe, number>();
    courant.forEach((it) => axesDe(it).forEach((a) => presence.set(a, (presence.get(a) ?? 0) + 1)));
    const candidats = leviers.filter((l) => !dejaPris.has(l.id) && !courant.some((c) => c.id === l.id));
    // Un levier remplace une pièce de SA PROPRE famille : c'est ce qui rend
    // la substitution comparable. Échanger un pull contre une ceinture
    // changerait la capsule bien au-delà de la morphologie.
    let choisi: { levier: CatalogItem; index: number } | null = null;
    for (const l of candidats) {
      const axes = axesDe(l);
      if (nonRedondantsSeulement && axes.every((a) => (presence.get(a) ?? 0) > 0)) continue;
      const index = courant.findIndex((c, i) => c.cat === l.cat && redondanteNeutre(courant, i));
      if (index < 0) continue;
      choisi = { levier: l, index };
      break;
    }
    if (!choisi) break;
    dejaPris.add(choisi.levier.id);
    courant = courant.map((c, i) => (i === choisi!.index ? choisi!.levier : c));
  }
  return courant;
}

describe("Contrefactuel de substitution — capsule", () => {
  it("mesure ce que rapporte et ce que coûte le remplacement d'une pièce neutre par un levier", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    for (const morphology of MORPHOS) {
      console.log(`\n\n════════════════ MORPHOLOGIE : ${morphology} ════════════════`);

      // Courbe de rendement marginal, cumulée sur les 24 capsules.
      const cumul: Mesure[] = [];
      let substitutionsPossibles = 0, substitutionsDemandees = 0;

      for (let k = 0; k <= K_MAX; k++) {
        const agg: Mesure = { pieces: 0, occasions: 0, looks: 0, score: 0, compensation: 0, neutre: 0, defavorable: 0, actifs: 0, conseil: 0, evalues: 0 };
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          const bucket = capsuleSeasonBucket(saison);
          const eligible = pool.filter((it) =>
            it.genre !== "homme" &&
            (it.season === bucket || it.season === "Toutes saisons") &&
            (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
            (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp) &&
            !isSport(it) && axesDe(it).length > 0
          );
          for (const style of STYLES) {
            const base = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool);
            const ecartes = eligible.filter((e) => !base.some((c) => c.id === e.id));
            const variante = k === 0 ? base : substituer(base, ecartes, k, false);
            if (k === 1) {
              substitutionsDemandees += 1;
              if (variante.some((v, i) => v.id !== base[i]?.id)) substitutionsPossibles += 1;
            }
            const m = mesurer(variante, w, morphology);
            agg.pieces += m.pieces; agg.occasions += m.occasions; agg.looks += m.looks; agg.score += m.score;
            agg.compensation += m.compensation; agg.neutre += m.neutre; agg.defavorable += m.defavorable;
            agg.actifs += m.actifs; agg.conseil += m.conseil; agg.evalues += m.evalues;
          }
        }
        cumul.push(agg);
      }

      const n = SAISONS.length * STYLES.length;
      console.log(`\n──── COURBE DE RENDEMENT MARGINAL (substitutions à effectif constant) ────`);
      console.log(`  ${"k".padEnd(4)}${"pièces".padStart(8)}${"occ.".padStart(7)}${"looks".padStart(8)}${"Δlooks".padStart(8)}${"score".padStart(8)}${"compens.".padStart(10)}${"neutre".padStart(9)}${"défav.".padStart(9)}${"conseil".padStart(9)}`);
      for (let k = 0; k <= K_MAX; k++) {
        const a = cumul[k];
        const dLooks = k === 0 ? 0 : a.looks - cumul[k - 1].looks;
        console.log(
          `  ${String(k).padEnd(4)}` +
          `${(a.pieces / n).toFixed(1).padStart(8)}` +
          `${(a.occasions / n).toFixed(1).padStart(7)}` +
          `${String(a.looks).padStart(8)}` +
          `${(k === 0 ? "—" : (dLooks > 0 ? "+" : "") + dLooks).padStart(8)}` +
          `${(a.score / n).toFixed(1).padStart(8)}` +
          `${pct(a.compensation, a.actifs).padStart(10)}` +
          `${pct(a.neutre, a.actifs).padStart(9)}` +
          `${pct(a.defavorable, a.actifs).padStart(9)}` +
          `${pct(a.conseil, a.evalues).padStart(9)}`
        );
      }
      console.log(`  Capsules où une première substitution est seulement POSSIBLE : ${substitutionsPossibles} / ${substitutionsDemandees}`);

      // Variantes A / B / C au même effectif, à k fixé au maximum testé.
      console.log(`\n──── VARIANTES À EFFECTIF CONSTANT (k = ${K_MAX}) ────`);
      const variantes: [string, (base: CatalogItem[], ec: CatalogItem[]) => CatalogItem[]][] = [
        ["Contrôle", (base) => base],
        ["A — leviers, sans filtre", (base, ec) => substituer(base, ec, K_MAX, false)],
        ["B — leviers non redondants", (base, ec) => substituer(base, ec, K_MAX, true)],
      ];
      console.log(`  ${"variante".padEnd(28)}${"pièces".padStart(8)}${"occ.".padStart(7)}${"looks".padStart(8)}${"score".padStart(8)}${"compens.".padStart(10)}${"neutre".padStart(9)}${"défav.".padStart(9)}${"conseil".padStart(9)}`);
      for (const [nom, f] of variantes) {
        const agg: Mesure = { pieces: 0, occasions: 0, looks: 0, score: 0, compensation: 0, neutre: 0, defavorable: 0, actifs: 0, conseil: 0, evalues: 0 };
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          const bucket = capsuleSeasonBucket(saison);
          const eligible = pool.filter((it) =>
            it.genre !== "homme" &&
            (it.season === bucket || it.season === "Toutes saisons") &&
            (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
            (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp) &&
            !isSport(it) && axesDe(it).length > 0
          );
          for (const style of STYLES) {
            const base = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool);
            const m = mesurer(f(base, eligible.filter((e) => !base.some((c) => c.id === e.id))), w, morphology);
            agg.pieces += m.pieces; agg.occasions += m.occasions; agg.looks += m.looks; agg.score += m.score;
            agg.compensation += m.compensation; agg.neutre += m.neutre; agg.defavorable += m.defavorable;
            agg.actifs += m.actifs; agg.conseil += m.conseil; agg.evalues += m.evalues;
          }
        }
        console.log(
          `  ${nom.padEnd(28)}` +
          `${(agg.pieces / n).toFixed(1).padStart(8)}` +
          `${(agg.occasions / n).toFixed(1).padStart(7)}` +
          `${String(agg.looks).padStart(8)}` +
          `${(agg.score / n).toFixed(1).padStart(8)}` +
          `${pct(agg.compensation, agg.actifs).padStart(10)}` +
          `${pct(agg.neutre, agg.actifs).padStart(9)}` +
          `${pct(agg.defavorable, agg.actifs).padStart(9)}` +
          `${pct(agg.conseil, agg.evalues).padStart(9)}`
        );
      }
    }

    console.log(`\nAucune règle de sélection n'a été modifiée — audit en lecture seule.`);
  }, 1_800_000);
});
