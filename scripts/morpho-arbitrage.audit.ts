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

// Arbitrage de phase 5B — lecture seule. Trois questions se tranchent avec des
// chiffres plutôt qu'avec un avis :
//   B · la fluidité déduite de `matiere` est-elle exploitable, et sur quelle part
//       du catalogue « Synthétique » — la valeur la plus ambiguë — pèse-t-elle ?
//   C · la superposition est-elle un défaut de fond ? On mesure d'abord combien
//       de looks sont concernés, avant de décider s'il faut une pondération.
//   A · des contraintes par intervalle changent-elles réellement le verdict par
//       rapport à une cible-point ?

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEMP: Record<CapsuleSeason, number> = { Printemps: 16, "Été": 26, Automne: 13, Hiver: 5 };
const BUCKET: Record<CapsuleSeason, Season> = {
  Printemps: "Printemps / Été", "Été": "Printemps / Été",
  Automne: "Automne / Hiver", Hiver: "Automne / Hiver",
};
const CAS: { style: string; saison: CapsuleSeason }[] = [
  { style: "Casual chic", saison: "Été" }, { style: "Casual chic", saison: "Automne" },
  { style: "Classique", saison: "Hiver" }, { style: "Glamour", saison: "Hiver" },
  { style: "Bohème", saison: "Printemps" }, { style: "Streetwear", saison: "Automne" },
];
const meteo = (t: number, s: Season): Weather =>
  ({ season: s, temp: t, label: t < 10 ? "Froid" : t < 20 ? "Doux" : "Chaud", seasons: [s, "Toutes saisons"] });
const profil = (styles: string[]): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";

/**
 * Contraintes par intervalle proposées pour la V1 — un plancher, un plafond, ou
 * les deux, jamais un point. Une zone absente n'est pas contrainte.
 * `f_pomme` n'a volontairement aucune contrainte : les trois axes horizontaux ne
 * permettent pas d'en défendre une.
 */
type Borne = { min?: number; max?: number };
const CONTRAINTES: Record<string, Partial<Record<"epaules" | "taille" | "hanches", Borne>>> = {
  f_poire: { epaules: { min: 1 }, hanches: { max: 1 } },
  f_triangle_inverse: { epaules: { max: 1 }, hanches: { min: 1 } },
  f_sablier: { taille: { min: 1 }, epaules: { max: 2 }, hanches: { max: 2 } },
  f_rectangle: { taille: { min: 2 } },
  f_pomme: {},
};
/** Cibles-point de la phase 3, conservées pour la comparaison. */
const CIBLES_POINT: Record<string, { epaules: number; taille: number; hanches: number } | null> = {
  f_poire: { epaules: 2, taille: 1, hanches: 0 },
  f_triangle_inverse: { epaules: 0, taille: 1, hanches: 2 },
  f_sablier: { epaules: 1, taille: 2, hanches: 1 },
  f_rectangle: { epaules: 1, taille: 2, hanches: 1 },
  f_pomme: null,
};

const ecartIntervalle = (v: number, b: Borne) =>
  Math.max(0, (b.min ?? -Infinity) - v === -Infinity ? 0 : (b.min ?? 0) - v) + Math.max(0, v - (b.max ?? Infinity));

describe("Arbitrage phase 5B", () => {
  it("mesure ce qui se tranche par les chiffres", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    // ── B · MATIÈRES ──────────────────────────────────────────────────────
    console.log(`\n════════ B · RÉPARTITION DES MATIÈRES ════════`);
    const pertinentes = pool.filter((p) => effetMorphologique(p).pertinent);
    const compte = new Map<string, number>();
    const comptePert = new Map<string, number>();
    for (const p of pool) {
      const m = p.matiere ?? "(vide)";
      compte.set(m, (compte.get(m) || 0) + 1);
      if (effetMorphologique(p).pertinent) comptePert.set(m, (comptePert.get(m) || 0) + 1);
    }
    console.log(`  ${"matière".padEnd(16)} ${"catalogue".padStart(12)} ${"pertinentes".padStart(14)}`);
    for (const [m, n] of [...compte.entries()].sort((a, b) => b[1] - a[1])) {
      const np = comptePert.get(m) || 0;
      console.log(`  ${m.padEnd(16)} ${String(n).padStart(5)} ${pct(n, pool.length).padStart(7)} ${String(np).padStart(6)} ${pct(np, pertinentes.length).padStart(7)}`);
    }

    // ── C · SUPERPOSITION ─────────────────────────────────────────────────
    const looks: CatalogItem[][] = [];
    for (const { style, saison } of CAS) {
      const w = meteo(TEMP[saison], BUCKET[saison]);
      const capsule = computeDefaultCapsule(profil([style]), w, [], saison, pool);
      const vus = new Set<string>();
      for (const [occ] of OCCASIONS) {
        for (let n = 0; n < 40; n++) {
          const { ids } = generateOutfit(capsule, w, occ, "Présentiel", "Verre", [], "femme");
          const cle = [...ids].sort((a, b) => a - b).join(",");
          if (ids.length < 2 || vus.has(cle)) continue;
          vus.add(cle);
          const p = ids.map((id) => capsule.find((x) => x.id === id)).filter((x): x is CatalogItem => Boolean(x));
          if (p.length >= 2) looks.push(p);
        }
      }
    }

    console.log(`\n════════ C · SUPERPOSITION (${looks.length} looks) ════════`);
    const aCouche = (p: Item[]) => p.some((x) => x.cat === "veste" || x.cat === "manteau");
    const aDessous = (p: Item[]) => p.some((x) => x.cat === "haut" || x.cat === "pull");
    const couverts = looks.filter((l) => aCouche(l) && aDessous(l));
    console.log(`  Looks avec une couche extérieure ET un haut dessous : ${couverts.length}  ${pct(couverts.length, looks.length)}`);

    // Le haut recouvert compte-t-il vraiment dans la signature ? On ne le sait
    // que si son effet est non nul ET distinct de celui de la couche.
    const hautPorteur = couverts.filter((l) =>
      l.some((x) => (x.cat === "haut" || x.cat === "pull") && effetMorphologique(x).epaules > 0));
    console.log(`  ...dont le haut recouvert porte lui-même un effet non nul : ${hautPorteur.length}  ${pct(hautPorteur.length, looks.length)}`);

    // Impact d'une pondération : effet du dessous divisé par deux quand une
    // couche extérieure est présente. On MESURE avant de décider si la règle
    // vaut la peine d'être inventée.
    let changentSignature = 0;
    for (const l of couverts) {
      const base = signatureLook(l);
      const attenue = l.filter((x) => !((x.cat === "haut" || x.cat === "pull") && aCouche(l)));
      const alt = signatureLook(attenue);
      if (base.epaules !== alt.epaules || base.taille !== alt.taille || base.hanches !== alt.hanches) changentSignature += 1;
    }
    console.log(`  Looks dont la signature changerait si le dessous était ignoré : ${changentSignature}  ${pct(changentSignature, looks.length)}`);

    // ── A · INTERVALLES vs CIBLE-POINT ────────────────────────────────────
    console.log(`\n════════ A · CONTRAINTES PAR INTERVALLE vs CIBLE-POINT ════════`);
    console.log(`  ${"morphologie".padEnd(20)} ${"actifs".padStart(8)} ${"+10 int.".padStart(9)} ${"−5 int.".padStart(9)} ${"+10 pt".padStart(8)} ${"−5 pt".padStart(8)} ${"désaccord".padStart(10)}`);
    for (const m of Object.keys(CONTRAINTES)) {
      const contrainte = CONTRAINTES[m];
      const zones = Object.keys(contrainte) as ("epaules" | "taille" | "hanches")[];
      if (!zones.length) { console.log(`  ${m.padEnd(20)}   non scorée (aucune contrainte défendable sur trois axes)`); continue; }
      let actifs = 0, plusInt = 0, moinsInt = 0, plusPt = 0, moinsPt = 0, desaccord = 0;
      const cible = CIBLES_POINT[m];
      for (const l of looks) {
        const sig = signatureLook(l);
        if (sig.classe !== "MORPHOLOGY_READY") continue;
        if (zones.includes("taille") && !sig.tailleConnue) continue;
        actifs += 1;
        const dInt = zones.reduce((a, z) => a + ecartIntervalle(sig[z], contrainte[z]!), 0);
        const deltaInt = dInt === 0 ? 10 : dInt >= 2 ? -5 : 0;
        if (deltaInt === 10) plusInt += 1; else if (deltaInt === -5) moinsInt += 1;
        if (cible) {
          const dPt = zones.reduce((a, z) => a + Math.abs(sig[z] - cible[z]), 0);
          const deltaPt = dPt <= 1 ? 10 : dPt >= 3 ? -5 : 0;
          if (deltaPt === 10) plusPt += 1; else if (deltaPt === -5) moinsPt += 1;
          if (deltaInt !== deltaPt) desaccord += 1;
        }
      }
      console.log(
        `  ${m.padEnd(20)} ${pct(actifs, looks.length).padStart(8)} ${pct(plusInt, actifs).padStart(9)} ${pct(moinsInt, actifs).padStart(9)}` +
        ` ${pct(plusPt, actifs).padStart(8)} ${pct(moinsPt, actifs).padStart(8)} ${pct(desaccord, actifs).padStart(10)}`
      );
    }

    // Sablier et rectangle donnaient exactement le même avis avec les cibles-point.
    let memeAvisPoint = 0, memeAvisInt = 0, evalues = 0;
    for (const l of looks) {
      const sig = signatureLook(l);
      if (sig.classe !== "MORPHOLOGY_READY" || !sig.tailleConnue) continue;
      evalues += 1;
      const dS = Math.abs(sig.epaules - 1) + Math.abs(sig.taille - 2) + Math.abs(sig.hanches - 1);
      if (dS === dS) memeAvisPoint += 1; // cibles identiques : l'avis l'est toujours
      const iS = ecartIntervalle(sig.taille, { min: 1 }) + ecartIntervalle(sig.epaules, { max: 2 }) + ecartIntervalle(sig.hanches, { max: 2 });
      const iR = ecartIntervalle(sig.taille, { min: 2 });
      const dS2 = iS === 0 ? 10 : iS >= 2 ? -5 : 0;
      const dR2 = iR === 0 ? 10 : iR >= 2 ? -5 : 0;
      if (dS2 === dR2) memeAvisInt += 1;
    }
    console.log(`\n  Sablier et rectangle, sur ${evalues} looks évaluables :`);
    console.log(`     cibles-point  : avis identique sur ${pct(memeAvisPoint, evalues)} (par construction, cibles égales)`);
    console.log(`     intervalles   : avis identique sur ${pct(memeAvisInt, evalues)}`);

    console.log(`\nAucune modification effectuée — audit en lecture seule.`);
  }, 900_000);
});
