import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor, type SelectionStrategy } from "../src/lib/capsule";
import { formalityOf, huesHarmonious, isNeutralColor, isStatement, matiereOf, suggestOccasions } from "../src/lib/attributes";
import { computeLookScore, generateOutfit } from "../src/lib/logic";
import { conseilAffichable, scoreMorphoV2 } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { EMPTY_PROFILE, exposedStyleIds, type Profile } from "../src/lib/profile";
import { OCCASIONS, type Weather } from "../src/lib/data";

// PHASE 12 — LECTURE SEULE, AUCUN BRANCHEMENT.
//
// Le legacy est retiré de la sélection ET R-S9 du score : la comparaison de la
// phase 11 est donc périmée, puisque le score y récompensait encore les choix
// du signal que la sélection venait d'abandonner. La référence est désormais
// B2 = production actuelle, et la seule question est de savoir si V2 améliore
// la direction morphologique sans coûter de score.
//
// Le score ne dépendant plus de la morphologie, tout écart de score entre B2
// et B3 vient exclusivement de la COMPOSITION de la capsule — plus aucun terme
// ne récompense ou ne pénalise le choix morphologique lui-même.
//
// L'hypothèse R-B2 de la phase 11 est déjà réfutée par le code : R-B2 vit dans
// evaluateBlocking, un bandeau doux de la création manuelle, et n'entre pas
// dans computeLookScore. L'instrumentation cherche donc ailleurs, en
// recalculant à l'identique les termes du score que les pièces échangées
// peuvent faire basculer : R-S1 (sobriété chromatique), R-S2 (harmonie) et
// R-S8 (variété de matières).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
/**
 * Les HUIT styles féminins exposés, par IDENTIFIANT et non par libellé.
 *
 * Correction du 29/08/2026. `profile.styles` porte des StyleId, traduits en
 * libellé catalogue par STYLE_ID_TO_CATALOG_LABEL ; les libellés qu'utilisaient
 * les versions précédentes de cet audit y renvoyaient undefined, `filter(Boolean)`
 * vidait le tableau, et computeDefaultCapsule sautait le filtre de style. Les
 * mesures portaient donc sur UNE capsule répétée six fois par saison, construite
 * sur un pool de 184 à 271 pièces au lieu des 40 à 67 d'un pool de style réel.
 * L'un des six libellés, « Classique », n'existait même pas.
 */
const STYLES = exposedStyleIds("femme");
const REPETITIONS = 5;
const TIRAGES = 40;

const profil = (styles: readonly string[], morphology: string | null): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles: [...styles], morphology });
const isSport = (it: Item) => formalityOf(it) === 0;
const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const CLOTHING: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];

// B2 est figé en littéral : depuis le branchement de V2 le 29/08/2026,
// STRATEGIE_PRODUCTION vaut { neutre, "A" }, et s'y référer ferait comparer
// deux fois la même variante.
const B2: SelectionStrategy = { rang3: "neutre", v2: false };
const B3: SelectionStrategy = { rang3: "neutre", v2: "A" };

type Rep = {
  looks: number; score: number; median: number; p10: number; p90: number;
  compForte: number; comp: number; neutre: number; defav: number; defavFort: number; conseil: number;
  rs1: number; rs2: number; rs5: number; rs6: number; rs7: number; rs8: number; ecartFormalite: number;
};

/**
 * Termes du score recalculés à l'identique de logic.ts, sans le modifier :
 * R-S1 pénalise plus de trois teintes non neutres sur les vêtements, R-S2
 * récompense une harmonie chromatique, R-S8 récompense la variété de matières.
 * Ce sont les seuls termes que les pièces échangées par V2 peuvent basculer.
 */
function termesScore(pieces: Item[]) {
  const clothing = pieces.filter((i) => CLOTHING.includes(i.cat));
  const nonNeutralClothing = new Set(clothing.filter((i) => !isNeutralColor(i.color)).map((i) => i.hex));
  const nonNeutralAll = pieces.filter((i) => i.cat !== "bijou" && !isNeutralColor(i.color));
  let harmonieux = false;
  for (let i = 0; i < nonNeutralAll.length && !harmonieux; i++) {
    for (let j = i + 1; j < nonNeutralAll.length; j++) {
      if (nonNeutralAll[i].hex !== nonNeutralAll[j].hex && huesHarmonious(nonNeutralAll[i].hex, nonNeutralAll[j].hex)) { harmonieux = true; break; }
    }
  }
  const matieres = new Set(pieces.filter((i) => i.cat !== "bijou").map(matiereOf));
  const form = clothing.map(formalityOf);
  // R-S5 / R-S6 / R-S7 : les seules autres règles d'amplitude 10 ou 15 que
  // l'échange de pièces peut faire basculer. R-S6 est un BONUS : le perdre
  // coûte 10 points, ce qui est la signature d'un P10 qui chute de 10 pile.
  const chaussure = pieces.find((i) => i.cat === "chaussures");
  const sac = pieces.find((i) => i.cat === "sac");
  return {
    rs1: nonNeutralClothing.size > 3 ? 1 : 0,          // pénalité −10
    rs2: harmonieux ? 1 : 0,                            // bonus +15
    rs5: pieces.filter(isStatement).length >= 2 ? 1 : 0, // pénalité −15
    rs6: chaussure && (isNeutralColor(chaussure.color) || clothing.some((i) => i.hex === chaussure.hex)) ? 1 : 0, // bonus +10
    rs7: sac && chaussure && isStatement(sac) && isStatement(chaussure) ? 1 : 0, // pénalité −10
    rs8: matieres.size > 1 ? 1 : 0,                     // bonus +5
    ecart: form.length >= 2 ? Math.max(...form) - Math.min(...form) : 0,
  };
}

function mesurerUneFois(capsule: CatalogItem[], w: Weather, morphology: string): Rep {
  const sig = new Set<string>();
  const scores: number[] = [];
  let actifs = 0, cf = 0, c = 0, n = 0, d = 0, df = 0, conseil = 0, evalues = 0;
  let rs1 = 0, rs2 = 0, rs5 = 0, rs6 = 0, rs7 = 0, rs8 = 0, ecart = 0, nLooks = 0;
  for (const [o] of OCCASIONS) {
    for (let k = 0; k < TIRAGES; k++) {
      const { ids } = generateOutfit(capsule, w, o, "Présentiel", "Verre", [], "femme");
      if (!ids.length) continue;
      const pieces = capsule.filter((it) => ids.includes(it.id));
      sig.add([...ids].sort((a, b) => a - b).join("-"));
      scores.push(computeLookScore(pieces, o, [], morphology, new Set<string>(), w).score);
      const t = termesScore(pieces);
      rs1 += t.rs1; rs2 += t.rs2; rs5 += t.rs5; rs6 += t.rs6; rs7 += t.rs7; rs8 += t.rs8; ecart += t.ecart; nLooks += 1;
      if (pieces.every(isSport)) continue;
      evalues += 1;
      const s = scoreMorphoV2(pieces, morphology);
      if (s.actif) {
        actifs += 1;
        if (s.direction === "compensation_forte") cf += 1;
        else if (s.direction === "compensation") c += 1;
        else if (s.direction === "neutre") n += 1;
        else if (s.direction === "defavorable") d += 1;
        else df += 1;
      }
      if (conseilAffichable(pieces, morphology)) conseil += 1;
    }
  }
  const tri = [...scores].sort((a, b) => a - b);
  const q = (p: number) => tri[Math.min(tri.length - 1, Math.floor(p * tri.length))] ?? 0;
  return {
    looks: sig.size,
    score: scores.reduce((a, b) => a + b, 0) / (scores.length || 1),
    median: q(0.5), p10: q(0.1), p90: q(0.9),
    compForte: actifs ? cf / actifs : 0, comp: actifs ? c / actifs : 0, neutre: actifs ? n / actifs : 0,
    defav: actifs ? d / actifs : 0, defavFort: actifs ? df / actifs : 0,
    conseil: evalues ? conseil / evalues : 0,
    rs1: nLooks ? rs1 / nLooks : 0, rs2: nLooks ? rs2 / nLooks : 0, rs5: nLooks ? rs5 / nLooks : 0,
    rs6: nLooks ? rs6 / nLooks : 0, rs7: nLooks ? rs7 / nLooks : 0, rs8: nLooks ? rs8 / nLooks : 0,
    ecartFormalite: nLooks ? ecart / nLooks : 0,
  };
}

function ic(v: number[]): [number, number] {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const s = v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1 || 1);
  return [m, 1.96 * Math.sqrt(s / v.length)];
}
const f = (v: number[], mult = 100, dec = 1) => { const [m, d] = ic(v); return `${(m * mult).toFixed(dec)}±${(d * mult).toFixed(dec)}`; };

describe("Phase 12 — V2 après retrait du legacy et de R-S9", () => {
  it("compare B2 et B3 sur le même pipeline, avec intervalles", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    // ═══ STRUCTURE ET GARANTIES — déterministe, hors tirage ═══
    console.log(`\n════════ 6 · INVARIANTS DE STRUCTURE (déterministes) ════════`);
    console.log(`  ${"morphologie".padEnd(20)}${"variante".padEnd(6)}${"pièces".padStart(9)}${"sport".padStart(7)}${"occ.".padStart(6)}${"cat.".padStart(6)}${"collants".padStart(10)}${"chauss.int".padStart(12)}${"subst.".padStart(8)}${"max".padStart(5)}`);
    for (const morphology of ["f_poire", "f_triangle_inverse", "f_rectangle", "f_sablier", "f_pomme"]) {
      for (const [nom, strat] of [["B2", B2], ["B3", B3]] as [string, SelectionStrategy][]) {
        let pieces = 0, sport = 0, occ = 0, cat = 0, collants = 0, interieur = 0, nCaps = 0;
        const substitutions: number[] = [];
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          for (const style of STYLES) {
            const c = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool, strat);
            const ref = computeDefaultCapsule(profil([style], morphology), w, [], saison, pool, B2);
            const refIds = new Set(ref.map((it) => it.id));
            substitutions.push(c.filter((it) => !refIds.has(it.id)).length);
            const o = new Set<OccasionKey>();
            c.forEach((it) => occasionsDe(it).forEach((x) => o.add(x)));
            pieces += c.length; sport += c.filter(isSport).length; occ += o.size;
            cat += new Set(c.map((it) => it.cat)).size;
            if (c.some((it) => it.cat === "accessoire" && it.accessoireType === "Collants")) collants += 1;
            if (c.some((it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur")) interieur += 1;
            nCaps += 1;
          }
        }
        const moySub = substitutions.reduce((a, b) => a + b, 0) / substitutions.length;
        console.log(`  ${morphology.padEnd(20)}${nom.padEnd(6)}${(pieces / nCaps).toFixed(1).padStart(9)}${(sport / nCaps).toFixed(1).padStart(7)}` +
          `${(occ / nCaps).toFixed(1).padStart(6)}${(cat / nCaps).toFixed(1).padStart(6)}${(collants + "/" + nCaps).padStart(10)}${(interieur + "/" + nCaps).padStart(12)}` +
          `${moySub.toFixed(2).padStart(8)}${String(Math.max(...substitutions)).padStart(5)}`);
      }
    }

    // ═══ B2 CONTRE B3 ═══
    console.log(`\n════════ 2-4 · B2 CONTRE B3 (${REPETITIONS} répétitions × ${TIRAGES} tirages) ════════`);
    for (const morphology of ["f_poire", "f_triangle_inverse"]) {
      console.log(`\n\n════════════════ ${morphology} ════════════════`);
      for (const saison of [...SAISONS, "TOUTES" as const]) {
        const cibles = saison === "TOUTES" ? SAISONS : [saison];
        const res = new Map<string, Rep[]>([["B2", []], ["B3", []]]);
        for (const [nom, strat] of [["B2", B2], ["B3", B3]] as [string, SelectionStrategy][]) {
          for (let r = 0; r < REPETITIONS; r++) {
            const cumul: Rep[] = [];
            for (const s of cibles) {
              const w = representativeWeatherFor(s);
              for (const style of STYLES) {
                cumul.push(mesurerUneFois(computeDefaultCapsule(profil([style], morphology), w, [], s, pool, strat), w, morphology));
              }
            }
            const moy = (g: (x: Rep) => number) => cumul.reduce((a, b) => a + g(b), 0) / cumul.length;
            res.get(nom)!.push({
              looks: cumul.reduce((a, b) => a + b.looks, 0),
              score: moy((x) => x.score), median: moy((x) => x.median), p10: moy((x) => x.p10), p90: moy((x) => x.p90),
              compForte: moy((x) => x.compForte), comp: moy((x) => x.comp), neutre: moy((x) => x.neutre),
              defav: moy((x) => x.defav), defavFort: moy((x) => x.defavFort), conseil: moy((x) => x.conseil),
              rs1: moy((x) => x.rs1), rs2: moy((x) => x.rs2), rs5: moy((x) => x.rs5), rs6: moy((x) => x.rs6),
              rs7: moy((x) => x.rs7), rs8: moy((x) => x.rs8), ecartFormalite: moy((x) => x.ecartFormalite),
            });
          }
        }
        console.log(`\n──── ${String(saison).toUpperCase()} ────`);
        console.log(`  ${"var".padEnd(5)}${"looks".padStart(12)}${"score".padStart(12)}${"méd".padStart(9)}${"P10".padStart(9)}${"P90".padStart(9)}${"comp++".padStart(11)}${"comp+".padStart(10)}${"neutre".padStart(11)}${"déf".padStart(10)}${"déf++".padStart(10)}${"conseil".padStart(11)}`);
        for (const nom of ["B2", "B3"]) {
          const v = res.get(nom)!;
          console.log(`  ${nom.padEnd(5)}${f(v.map((x) => x.looks), 1, 0).padStart(12)}${f(v.map((x) => x.score), 1, 2).padStart(12)}` +
            `${f(v.map((x) => x.median), 1, 1).padStart(9)}${f(v.map((x) => x.p10), 1, 1).padStart(9)}${f(v.map((x) => x.p90), 1, 1).padStart(9)}` +
            `${f(v.map((x) => x.compForte)).padStart(11)}${f(v.map((x) => x.comp)).padStart(10)}${f(v.map((x) => x.neutre)).padStart(11)}` +
            `${f(v.map((x) => x.defav)).padStart(10)}${f(v.map((x) => x.defavFort)).padStart(10)}${f(v.map((x) => x.conseil)).padStart(11)}`);
        }
        // Termes du score susceptibles de basculer — diagnostic obligatoire.
        console.log(`  ${"".padEnd(5)}${"R-S1 (-10)".padStart(13)}${"R-S2 (+15)".padStart(13)}${"R-S5 (-15)".padStart(13)}${"R-S6 (+10)".padStart(13)}${"R-S7 (-10)".padStart(13)}${"R-S8 (+5)".padStart(12)}${"écart form.".padStart(14)}`);
        for (const nom of ["B2", "B3"]) {
          const v = res.get(nom)!;
          console.log(`  ${nom.padEnd(5)}${f(v.map((x) => x.rs1)).padStart(13)}${f(v.map((x) => x.rs2)).padStart(13)}${f(v.map((x) => x.rs5)).padStart(13)}${f(v.map((x) => x.rs6)).padStart(13)}${f(v.map((x) => x.rs7)).padStart(13)}${f(v.map((x) => x.rs8)).padStart(12)}${f(v.map((x) => x.ecartFormalite), 1, 2).padStart(14)}`);
        }
      }
    }

    console.log(`\nAudit en lecture seule — V2 n'est pas branchée, aucune règle modifiée.`);
  }, 3_600_000);
});
