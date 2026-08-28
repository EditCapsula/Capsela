import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, morphoFit, morphoVigilance } from "../src/lib/capsule";
import { computeLookScore, generateOutfit } from "../src/lib/logic";
import { effetMorphologique, scoreMorphoV2, signatureLook, type ClasseLook } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey, Season } from "../src/lib/types";
import { EMPTY_PROFILE, MORPHOLOGIES, type Profile } from "../src/lib/profile";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";

// Couverture MORPHOLOGIQUE AU NIVEAU DU LOOK — lecture seule, shadow mode.
//
// Demande du 28/08/2026 : la bonne question n'est pas « quel % du catalogue
// porte un attribut morphologique » mais « quand Capsela formule un conseil
// morphologique, a-t-elle assez d'information fiable sur la TENUE pour que ce
// conseil soit crédible ». On mesure donc trois niveaux :
//   1. couverture pièce   — déjà mesurée par couverture-morpho.audit.ts
//   2. couverture look    — % de looks dont la signature est exploitable
//   3. couverture conseil — % de looks recevant réellement un avis, par morphologie
//
// Le score v2 n'est JAMAIS branché : il est calculé en parallèle du legacy et
// seulement comparé. Aucun ranking de production n'est touché.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEMP: Record<CapsuleSeason, number> = { Printemps: 16, "Été": 26, Automne: 13, Hiver: 5 };
const BUCKET: Record<CapsuleSeason, Season> = {
  Printemps: "Printemps / Été", "Été": "Printemps / Été",
  Automne: "Automne / Hiver", Hiver: "Automne / Hiver",
};

// Morphologie = parcours femme uniquement (profile.ts, valuesFor).
const CAS: { style: string; saison: CapsuleSeason }[] = [
  { style: "Casual chic", saison: "Été" },
  { style: "Casual chic", saison: "Automne" },
  { style: "Classique", saison: "Hiver" },
  { style: "Glamour", saison: "Hiver" },
  { style: "Bohème", saison: "Printemps" },
  { style: "Streetwear", saison: "Automne" },
];

const TENTATIVES = 40;

function meteo(temp: number, season: Season): Weather {
  return { season, temp, label: temp < 10 ? "Froid" : temp < 20 ? "Doux" : "Chaud", seasons: [season, "Toutes saisons"] };
}
const profil = (styles: string[]): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles });

const pct = (n: number, total: number) => (total ? ((n / total) * 100).toFixed(1) : "0.0") + " %";
const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const badgeDe = (s: number) => (s >= 80 ? "recommande" : s < 50 ? "ajuster" : "neutre");
const clamp = (n: number) => Math.max(0, Math.min(120, n));

function quantile(tries: number[], q: number): number {
  if (!tries.length) return 0;
  const t = [...tries].sort((a, b) => a - b);
  return t[Math.min(t.length - 1, Math.floor(q * (t.length - 1)))];
}
const moyenne = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

interface Look {
  cas: string; occasion: OccasionKey; ids: number[]; pieces: Item[];
  classe: ClasseLook; epaules: number; taille: number; hanches: number;
  longueur: string; tailleConnue: boolean; scoreBase: number;
}

describe("Couverture morphologique au niveau du look", () => {
  it("mesure ce que le catalogue permet de conseiller réellement", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SB_SECRET_KEY sont requis.");
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);

    const pool = data
      .filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem)
      .filter((it): it is CatalogItem => Boolean(it));

    // ── Génération des looks ──────────────────────────────────────────────
    const looks: Look[] = [];
    const frequence = new Map<number, number>();   // id -> apparitions dans les looks
    const dansCapsule = new Set<number>();

    for (const { style, saison } of CAS) {
      const w = meteo(TEMP[saison], BUCKET[saison]);
      const capsule = computeDefaultCapsule(profil([style]), w, [], saison, pool);
      capsule.forEach((c) => dansCapsule.add(c.id));
      const libelle = `${style} · ${saison}`;
      const vus = new Set<string>();

      for (const [occasion] of OCCASIONS) {
        for (let n = 0; n < TENTATIVES; n++) {
          const { ids } = generateOutfit(capsule, w, occasion, "Présentiel", "Verre", [], "femme");
          if (ids.length < 2) continue;
          const cle = [...ids].sort((a, b) => a - b).join(",");
          if (vus.has(cle)) continue;
          vus.add(cle);
          const pieces = ids.map((id) => capsule.find((p) => p.id === id)).filter((p): p is CatalogItem => Boolean(p));
          if (pieces.length < 2) continue;
          pieces.forEach((p) => frequence.set(p.id, (frequence.get(p.id) || 0) + 1));
          const sig = signatureLook(pieces);
          looks.push({
            cas: libelle, occasion, ids, pieces,
            classe: sig.classe, epaules: sig.epaules, taille: sig.taille, hanches: sig.hanches,
            longueur: sig.longueur ?? "inconnue", tailleConnue: sig.tailleConnue,
            scoreBase: computeLookScore(pieces, occasion, [], null, new Set(), w, "Présentiel", "Verre").score,
          });
        }
      }
    }

    console.log(`\n════════ LOOKS GÉNÉRÉS ════════`);
    console.log(`  ${looks.length} looks distincts sur ${CAS.length} capsules × ${OCCASIONS.length} occasions.`);

    // ── 1. Couverture look ────────────────────────────────────────────────
    console.log(`\n── COUVERTURE LOOK ──`);
    const parClasse = (c: ClasseLook) => looks.filter((l) => l.classe === c);
    for (const c of ["MORPHOLOGY_READY", "MORPHOLOGY_PARTIAL", "MORPHOLOGY_UNKNOWN"] as ClasseLook[]) {
      console.log(`  ${c.padEnd(20)} ${String(parClasse(c).length).padStart(4)}  ${pct(parClasse(c).length, looks.length)}`);
    }
    const tailleConnue = looks.filter((l) => l.tailleConnue).length;
    console.log(`  dont taille renseignée : ${tailleConnue}  ${pct(tailleConnue, looks.length)}`);
    const longueurConnue = looks.filter((l) => l.longueur !== "inconnue").length;
    console.log(`  dont longueur connue   : ${longueurConnue}  ${pct(longueurConnue, looks.length)}`);

    // Sensibilité du seuil : que se passerait-il avec un critère plus strict ?
    const readyStrict = looks.filter((l) => l.classe === "MORPHOLOGY_READY" && l.tailleConnue).length;
    console.log(`\n  Sensibilité du critère READY :`);
    console.log(`     haut+bas connus (retenu)        ${parClasse("MORPHOLOGY_READY").length}  ${pct(parClasse("MORPHOLOGY_READY").length, looks.length)}`);
    console.log(`     haut+bas+taille connus (strict) ${readyStrict}  ${pct(readyStrict, looks.length)}`);

    // ── 2. Couverture conseil, par morphologie ────────────────────────────
    console.log(`\n── COUVERTURE CONSEIL PAR MORPHOLOGIE ──`);
    console.log(`  ${"morphologie".padEnd(20)} ${"v2 actif".padStart(10)} ${"legacy actif".padStart(14)}`);
    const detail = new Map<string, { actifs: number; legacyActifs: number; deltas: number[]; legacyDeltas: number[] }>();

    for (const m of MORPHOLOGIES) {
      let actifs = 0, legacyActifs = 0;
      const deltas: number[] = [], legacyDeltas: number[] = [];
      for (const l of looks) {
        const v2 = scoreMorphoV2(l.pieces, m);
        if (v2.actif) actifs += 1;
        deltas.push(v2.delta);
        // R-S9 legacy, reproduit à l'identique depuis computeLookScore.
        const clothing = l.pieces.filter((i) => !["chaussures", "sac", "bijou", "accessoire"].includes(i.cat));
        const legacy = clothing.some((i) => morphoFit(i, m)) ? 10 : clothing.some((i) => morphoVigilance(i, m)) ? -5 : 0;
        if (legacy !== 0) legacyActifs += 1;
        legacyDeltas.push(legacy);
      }
      detail.set(m, { actifs, legacyActifs, deltas, legacyDeltas });
      console.log(`  ${m.padEnd(20)} ${(pct(actifs, looks.length)).padStart(10)} ${(pct(legacyActifs, looks.length)).padStart(14)}`);
    }

    // ── 3. Shadow score : legacy vs v2 ────────────────────────────────────
    console.log(`\n── SHADOW SCORE R-S9 legacy vs v2 ──`);
    let bascules = 0, rangsChanges = 0, groupes = 0, tetesChangees = 0;
    for (const m of MORPHOLOGIES) {
      const d = detail.get(m)!;
      const sLegacy = looks.map((l, i) => clamp(l.scoreBase + d.legacyDeltas[i]));
      const sV2 = looks.map((l, i) => clamp(l.scoreBase + d.deltas[i]));
      const badgesChanges = looks.filter((_, i) => badgeDe(sLegacy[i]) !== badgeDe(sV2[i])).length;
      bascules += badgesChanges;
      console.log(
        `  ${m.padEnd(20)} legacy moy ${moyenne(sLegacy).toFixed(1)} (p10 ${quantile(sLegacy, 0.1)} / p90 ${quantile(sLegacy, 0.9)})` +
        `  ·  v2 moy ${moyenne(sV2).toFixed(1)} (p10 ${quantile(sV2, 0.1)} / p90 ${quantile(sV2, 0.9)})` +
        `  ·  badge change ${pct(badgesChanges, looks.length)}`
      );

      // Changement de classement à l'intérieur de chaque (cas × occasion).
      const groupesMap = new Map<string, number[]>();
      looks.forEach((l, i) => {
        const k = `${l.cas}|${l.occasion}`;
        groupesMap.set(k, [...(groupesMap.get(k) || []), i]);
      });
      for (const idx of groupesMap.values()) {
        if (idx.length < 2) continue;
        groupes += 1;
        const ordL = [...idx].sort((a, b) => sLegacy[b] - sLegacy[a]);
        const ordV = [...idx].sort((a, b) => sV2[b] - sV2[a]);
        if (ordL[0] !== ordV[0]) tetesChangees += 1;
        rangsChanges += ordL.filter((v, i2) => v !== ordV[i2]).length;
      }
    }
    console.log(`\n  Bascules de badge, toutes morphologies : ${bascules} / ${looks.length * MORPHOLOGIES.length}  ${pct(bascules, looks.length * MORPHOLOGIES.length)}`);
    console.log(`  Groupes (cas × occasion) où la tête de classement change : ${tetesChangees} / ${groupes}  ${pct(tetesChangees, groupes)}`);
    console.log(`  Positions de classement modifiées : ${rangsChanges}`);

    // ── 4. Priorisation d'annotation par fréquence réelle ─────────────────
    const ligneDe = new Map(data.map((r) => [r.id, r]));
    const inconnues = pool
      .filter((p) => {
        const e = effetMorphologique(p);
        return e.pertinent && e.confiance === "inconnue";
      })
      .map((p) => ({
        id: p.id, name: p.name,
        categorie: ligneDe.get(p.id)?.category ?? "",
        sousType: ligneDe.get(p.id)?.sous_type ?? "",
        freq: frequence.get(p.id) || 0,
        capsule: dansCapsule.has(p.id),
      }))
      .sort((a, b) => b.freq - a.freq || a.id - b.id);

    console.log(`\n── PRIORISATION D'ANNOTATION (par fréquence réelle dans les looks) ──`);
    console.log(`  ${inconnues.length} pièces pertinentes non évaluées.`);
    console.log(`  dont présentes dans au moins une capsule : ${inconnues.filter((i) => i.capsule).length}`);
    console.log(`  dont apparues dans au moins un look      : ${inconnues.filter((i) => i.freq > 0).length}`);
    const top = inconnues.filter((i) => i.freq > 0).slice(0, 40);
    console.log(`\n  Les 40 plus fréquentes (échantillon pilote proposé) :`);
    for (const p of top) {
      console.log(`     ${String(p.freq).padStart(4)} looks · [#${p.id}] ${p.name} — ${p.categorie} / "${p.sousType}"`);
    }
    const couvertParTop = top.reduce((a, p) => a + p.freq, 0);
    const totalFreqInconnues = inconnues.reduce((a, p) => a + p.freq, 0);
    console.log(`\n  Ces 40 pièces représentent ${pct(couvertParTop, totalFreqInconnues)} des apparitions de pièces non évaluées.`);

    writeFileSync(
      "morpho-annotation-priorite.csv",
      [["id", "nom", "categorie", "sous_type", "apparitions_looks", "dans_capsule"].map(csv).join(",")]
        .concat(inconnues.map((p) => [p.id, p.name, p.categorie, p.sousType, p.freq, p.capsule].map(csv).join(",")))
        .join("\n"),
      "utf8"
    );

    writeFileSync(
      "morpho-looks.csv",
      [["cas", "occasion", "classe", "epaules", "taille", "hanches", "longueur", "taille_connue", "score_base", "ids"].map(csv).join(",")]
        .concat(looks.map((l) =>
          [l.cas, l.occasion, l.classe, l.epaules, l.taille, l.hanches, l.longueur, l.tailleConnue, l.scoreBase, l.ids.join(" ")]
            .map(csv).join(",")))
        .join("\n"),
      "utf8"
    );

    console.log(`\nArtefacts : morpho-looks.csv · morpho-annotation-priorite.csv`);
    console.log("Aucune modification effectuée — audit en lecture seule, score v2 jamais branché.");
  }, 600_000);
});
