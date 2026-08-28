import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule } from "../src/lib/capsule";
import { generateOutfit } from "../src/lib/logic";
import { effetMorphologique, signatureLook } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, Season } from "../src/lib/types";
import { EMPTY_PROFILE, type Profile } from "../src/lib/profile";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";

// Simulation de phase 7 — LECTURE SEULE, aucune règle de production touchée.
//
// Les variantes de règles sont calculées ICI, à partir de la signature, et
// jamais écrites dans le prototype : on mesure avant de choisir, conformément
// à « ne valide aucune solution sans mesure ».
//
// Trois questions :
//   1. Rectangle — R1/R2/R3/R4 : laquelle discrimine réellement ?
//   2. Poire / triangle inversé — la relation suffit-elle, ou faut-il un écart
//      minimal ? Un look 3/0 et un look 1/0 valident tous deux « épaules ≥
//      hanches » sans produire le même effet.
//   3. Capsule — de combien de pièces « capables » dispose une capsule
//      aujourd'hui, et cela suffit-il à composer des silhouettes équilibrées ?

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEMP: Record<CapsuleSeason, number> = { Printemps: 16, "Été": 26, Automne: 13, Hiver: 5 };
const BUCKET: Record<CapsuleSeason, Season> = {
  Printemps: "Printemps / Été", "Été": "Printemps / Été",
  Automne: "Automne / Hiver", Hiver: "Automne / Hiver",
};
const STYLES = ["Casual chic", "Classique", "Glamour", "Bohème", "Streetwear", "Minimaliste"];
const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const TENTATIVES = 35;

const meteo = (t: number, s: Season): Weather =>
  ({ season: s, temp: t, label: t < 10 ? "Froid" : t < 20 ? "Doux" : "Chaud", seasons: [s, "Toutes saisons"] });
const profil = (styles: string[]): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const evaluee = (it: Item) => {
  const e = effetMorphologique(it);
  return e.pertinent && (e.confiance === "haute" || e.confiance === "moyenne" || e.epaules > 0 || e.hanches > 0);
};
const isSport = (it: Item) => (it.niveauFormalite ?? 1) === 0;

interface Sig { epaules: number; taille: number; hanches: number; ready: boolean; tailleConnue: boolean }

/** Variantes de règles, calculées hors du prototype. delta: +10 / 0 / −5. */
const REGLES: Record<string, (s: Sig) => number | null> = {
  "poire · actuelle (≥1 / ≤1)": (s) =>
    !s.ready ? null : s.epaules >= 1 && s.hanches <= 1 ? 10 : (s.epaules < 1 ? 1 : 0) + (s.hanches > 1 ? s.hanches - 1 : 0) >= 2 ? -5 : 0,
  "poire · relation": (s) =>
    !s.ready ? null : s.epaules >= s.hanches && s.epaules + s.hanches >= 1 ? 10 : s.hanches - s.epaules >= 2 ? -5 : 0,
  "poire · relation + écart ≥1": (s) =>
    !s.ready ? null : s.epaules - s.hanches >= 1 ? 10 : s.hanches - s.epaules >= 2 ? -5 : 0,
  "triangle · actuelle (≤1 / ≥1)": (s) =>
    !s.ready ? null : s.hanches >= 1 && s.epaules <= 1 ? 10 : (s.hanches < 1 ? 1 : 0) + (s.epaules > 1 ? s.epaules - 1 : 0) >= 2 ? -5 : 0,
  "triangle · relation": (s) =>
    !s.ready ? null : s.hanches >= s.epaules && s.epaules + s.hanches >= 1 ? 10 : s.epaules - s.hanches >= 2 ? -5 : 0,
  "triangle · relation + écart ≥1": (s) =>
    !s.ready ? null : s.hanches - s.epaules >= 1 ? 10 : s.epaules - s.hanches >= 2 ? -5 : 0,
  "rectangle R0 · taille ≥2": (s) =>
    !s.ready || !s.tailleConnue ? null : s.taille >= 2 ? 10 : s.taille === 0 ? -5 : 0,
  "rectangle R1 · taille ≥3": (s) =>
    !s.ready || !s.tailleConnue ? null : s.taille >= 3 ? 10 : s.taille <= 1 ? -5 : 0,
  "rectangle R2 · taille ≥2 + volume ≥1": (s) =>
    !s.ready || !s.tailleConnue ? null : s.taille >= 2 && s.epaules + s.hanches >= 1 ? 10 : s.taille === 0 ? -5 : 0,
  "rectangle R3 · taille > max(ép,ha)": (s) =>
    !s.ready || !s.tailleConnue ? null : s.taille > Math.max(s.epaules, s.hanches) ? 10 : s.taille === 0 ? -5 : 0,
  "sablier · actuelle": (s) =>
    !s.ready || !s.tailleConnue ? null : s.taille >= 1 && s.epaules <= 2 && s.hanches <= 2 ? 10
      : (s.taille < 1 ? 1 : 0) + Math.max(0, s.epaules - 2) + Math.max(0, s.hanches - 2) >= 2 ? -5 : 0,
};

describe("Simulation phase 7", () => {
  it("mesure les variantes de règles et les capacités de capsule", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    // ── CAPSULES ──────────────────────────────────────────────────────────
    console.log(`\n════════ 1 · COMPOSITION RÉELLE DES CAPSULES ════════`);
    console.log(`  ${"capsule".padEnd(26)} ${"tot".padStart(4)} ${"hSpt".padStart(5)} ${"hauts".padStart(6)} ${"bas".padStart(4)} ${"vest".padStart(5)} ${"robes".padStart(6)} ${"cap.ép".padStart(7)} ${"cap.ba".padStart(7)} ${"cap.ta".padStart(7)}`);
    const capsules: { nom: string; pieces: CatalogItem[]; w: Weather }[] = [];
    const stats: { horsSport: number; capEp: number; capBas: number; capTa: number }[] = [];

    for (const style of STYLES) {
      for (const saison of SAISONS) {
        const w = meteo(TEMP[saison], BUCKET[saison]);
        const c = computeDefaultCapsule(profil([style]), w, [], saison, pool);
        const horsSport = c.filter((x) => !isSport(x));
        const n = (cats: string[]) => horsSport.filter((x) => cats.includes(x.cat)).length;
        // Capacités : ce que la capsule REND POSSIBLE, pas ce qu'elle impose.
        const capEp = horsSport.filter((x) => effetMorphologique(x).epaules >= 1).length;
        const capBas = horsSport.filter((x) => ["pantalon", "jean", "jupe", "short"].includes(x.cat) && evaluee(x) && effetMorphologique(x).hanches <= 1).length;
        const capTa = horsSport.filter((x) => effetMorphologique(x).taille >= 2).length;
        capsules.push({ nom: `${style} · ${saison}`, pieces: c, w });
        stats.push({ horsSport: horsSport.length, capEp, capBas, capTa });
        console.log(
          `  ${`${style} · ${saison}`.padEnd(26)} ${String(c.length).padStart(4)} ${String(horsSport.length).padStart(5)}` +
          ` ${String(n(["haut", "pull"])).padStart(6)} ${String(n(["pantalon", "jean", "jupe", "short"])).padStart(4)}` +
          ` ${String(n(["veste", "manteau"])).padStart(5)} ${String(n(["robe", "combinaison"])).padStart(6)}` +
          ` ${String(capEp).padStart(7)} ${String(capBas).padStart(7)} ${String(capTa).padStart(7)}`
        );
      }
    }
    // Arbitrage du 28/08/2026 : le sport COMPTE dans le plafond de 40, mais
    // reste un pool à part sur lequel la morphologie n'intervient jamais. La
    // contrainte porte donc sur le TOTAL, pas sur le hors-sport.
    const totaux = capsules.map((c) => c.pieces.length);
    const sports = capsules.map((c) => c.pieces.filter(isSport).length);
    console.log(`\n  Moyennes — TOTAL ${moy(totaux).toFixed(1)} · dont sport ${moy(sports).toFixed(1)} · hors sport ${moy(stats.map((s) => s.horsSport)).toFixed(1)}`);
    console.log(`  Capsules dont le TOTAL dépasse 40 : ${totaux.filter((t) => t > 40).length} / ${totaux.length}`);
    const depassements = totaux.map((t) => Math.max(0, t - 40));
    console.log(`  Dépassement : min ${Math.min(...depassements)} · moy ${moy(depassements).toFixed(1)} · max ${Math.max(...depassements)} pièce(s) à retirer`);
    console.log(`  Sport : min ${Math.min(...sports)} · moy ${moy(sports).toFixed(1)} · max ${Math.max(...sports)}`);
    console.log(`  Capacité épaules  : min ${Math.min(...stats.map((s) => s.capEp))} · moy ${moy(stats.map((s) => s.capEp)).toFixed(1)} · max ${Math.max(...stats.map((s) => s.capEp))}`);
    console.log(`  Capacité bas discret : min ${Math.min(...stats.map((s) => s.capBas))} · moy ${moy(stats.map((s) => s.capBas)).toFixed(1)} · max ${Math.max(...stats.map((s) => s.capBas))}`);
    console.log(`  Capacité taille   : min ${Math.min(...stats.map((s) => s.capTa))} · moy ${moy(stats.map((s) => s.capTa)).toFixed(1)} · max ${Math.max(...stats.map((s) => s.capTa))}`);

    // ── LOOKS ─────────────────────────────────────────────────────────────
    const sigs: Sig[] = [];
    const parCapsule: { nom: string; capEp: number; capBas: number; poireOk: number; total: number }[] = [];
    capsules.forEach((c, idx) => {
      const vus = new Set<string>();
      let poireOk = 0, total = 0;
      for (const [occ] of OCCASIONS) {
        for (let n = 0; n < TENTATIVES; n++) {
          const { ids } = generateOutfit(c.pieces, c.w, occ, "Présentiel", "Verre", [], "femme");
          const cle = [...ids].sort((a, b) => a - b).join(",");
          if (ids.length < 2 || vus.has(cle)) continue;
          vus.add(cle);
          const p = ids.map((i) => c.pieces.find((x) => x.id === i)).filter((x): x is CatalogItem => Boolean(x));
          if (p.length < 2) continue;
          const s = signatureLook(p);
          const sig: Sig = { epaules: s.epaules, taille: s.taille, hanches: s.hanches, ready: s.classe === "MORPHOLOGY_READY", tailleConnue: s.tailleConnue };
          sigs.push(sig);
          if (sig.ready) { total += 1; if (sig.epaules >= sig.hanches && sig.epaules + sig.hanches >= 1) poireOk += 1; }
        }
      }
      parCapsule.push({ nom: c.nom, capEp: stats[idx].capEp, capBas: stats[idx].capBas, poireOk, total });
    });

    console.log(`\n════════ 2 · VARIANTES DE RÈGLES (${sigs.length} looks) ════════`);
    console.log(`  ${"règle".padEnd(38)} ${"actifs".padStart(8)} ${"+10".padStart(8)} ${"0".padStart(8)} ${"−5".padStart(8)}`);
    for (const [nom, f] of Object.entries(REGLES)) {
      const res = sigs.map(f).filter((v): v is number => v !== null);
      const p = res.filter((v) => v === 10).length, z = res.filter((v) => v === 0).length, m = res.filter((v) => v === -5).length;
      console.log(`  ${nom.padEnd(38)} ${pct(res.length, sigs.length).padStart(8)} ${pct(p, res.length).padStart(8)} ${pct(z, res.length).padStart(8)} ${pct(m, res.length).padStart(8)}`);
    }

    // Distribution des couples (épaules, hanches) — répond à « 3/0 et 1/0
    // valident la même relation sans produire le même effet ».
    console.log(`\n  Distribution des écarts épaules − hanches sur les looks READY :`);
    const readySigs = sigs.filter((s) => s.ready);
    const ecarts = new Map<number, number>();
    for (const s of readySigs) ecarts.set(s.epaules - s.hanches, (ecarts.get(s.epaules - s.hanches) || 0) + 1);
    for (const [e, n] of [...ecarts.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`     écart ${String(e).padStart(3)} : ${String(n).padStart(4)}  ${pct(n, readySigs.length)}`);
    }
    const plats = readySigs.filter((s) => s.epaules === 0 && s.hanches === 0).length;
    console.log(`  Looks READY totalement plats (0/0) : ${plats}  ${pct(plats, readySigs.length)}`);

    // ── CORRÉLATION CAPACITÉ ↔ SILHOUETTES ÉQUILIBRÉES ────────────────────
    console.log(`\n════════ 3 · CAPACITÉ ÉPAULES ↔ LOOKS ÉQUILIBRÉS (poire) ════════`);
    console.log(`  ${"capsule".padEnd(26)} ${"cap.ép".padStart(7)} ${"READY".padStart(7)} ${"équilibrés".padStart(11)} ${"taux".padStart(8)}`);
    for (const c of [...parCapsule].sort((a, b) => a.capEp - b.capEp)) {
      console.log(`  ${c.nom.padEnd(26)} ${String(c.capEp).padStart(7)} ${String(c.total).padStart(7)} ${String(c.poireOk).padStart(11)} ${pct(c.poireOk, c.total).padStart(8)}`);
    }

    console.log(`\nAucune modification effectuée — simulation en lecture seule.`);
  }, 900_000);
});
