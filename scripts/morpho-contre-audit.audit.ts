import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule } from "../src/lib/capsule";
import { computeLookScore, generateOutfit } from "../src/lib/logic";
import { effetMorphologique, signatureLook, type ClasseLook } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey, Season } from "../src/lib/types";
import { EMPTY_PROFILE, type Profile } from "../src/lib/profile";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";

// CONTRE-AUDIT de la phase 3 — lecture seule, aucun score branché.
//
// Question centrale posée le 28/08/2026 : la conclusion « 21 pièces suffisent »
// est-elle valide, ou est-ce un biais de mesure dû au fait que les looks ont été
// générés depuis les capsules par DÉFAUT ? On distingue donc quatre populations
// (catalogue / capsule / usage réel / dressings réels) et on mesure les mêmes
// grandeurs sur chacune, au lieu de généraliser depuis une seule.
//
// Les tables d'usage (outfit_history, saved_looks, dressing_items) sont lues
// telles quelles. Si elles sont vides, c'est un RÉSULTAT, pas un incident : cela
// signifie que le rendement d'annotation ne peut PAS être validé sur l'usage.

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
const TENTATIVES = 40;

const ZONE: Record<string, "haut" | "bas" | "transverse" | "aucune"> = {
  haut: "haut", pull: "haut", veste: "haut", manteau: "haut",
  pantalon: "bas", jean: "bas", short: "bas", jupe: "bas",
  robe: "transverse", combinaison: "transverse",
  chaussures: "aucune", sac: "aucune", bijou: "aucune", accessoire: "aucune",
};

const meteo = (temp: number, season: Season): Weather =>
  ({ season, temp, label: temp < 10 ? "Froid" : temp < 20 ? "Doux" : "Chaud", seasons: [season, "Toutes saisons"] });
const profil = (styles: string[]): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** Une pièce est « évaluée » si on sait lui attribuer un chiffre sur sa zone. */
const evaluee = (it: Item, annotes?: Set<number>): boolean => {
  if (annotes?.has(it.id)) return true;
  const e = effetMorphologique(it);
  return e.pertinent && (e.confiance === "haute" || e.confiance === "moyenne" || e.epaules > 0 || e.hanches > 0);
};

const classeDe = (pieces: Item[], annotes?: Set<number>): ClasseLook => {
  let haut = false, bas = false;
  for (const it of pieces) {
    if (!effetMorphologique(it).pertinent) continue;
    if (!evaluee(it, annotes)) continue;
    const z = ZONE[it.cat];
    if (z === "haut" || z === "transverse") haut = true;
    if (z === "bas" || z === "transverse") bas = true;
  }
  return haut && bas ? "MORPHOLOGY_READY" : haut || bas ? "MORPHOLOGY_PARTIAL" : "MORPHOLOGY_UNKNOWN";
};

describe("Contre-audit morphologie", () => {
  it("confronte la conclusion des 21 pièces à l'usage réel", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    const parId = new Map(pool.map((p) => [p.id, p]));
    const ligneDe = new Map(rows.map((r) => [r.id + VESTIAIRE_ID_OFFSET, r]));

    // ── A. USAGE RÉEL ─────────────────────────────────────────────────────
    console.log(`\n════════ 1 · DONNÉES D'USAGE RÉEL ════════`);
    const lire = async (table: string, cols: string) => {
      const r = await supabase.from(table).select(cols);
      if (r.error) { console.log(`  ${table.padEnd(16)} LECTURE IMPOSSIBLE : ${r.error.message}`); return null; }
      return r.data as unknown[];
    };
    const historique = await lire("outfit_history", "piece_ids, occasion");
    const sauvegardes = await lire("saved_looks", "piece_ids, occasion");
    const dressings = await lire("dressing_items", "id, user_id, name, cat, coupe");

    console.log(`  outfit_history  ${historique ? `${historique.length} tenue(s) enregistrée(s)` : "—"}`);
    console.log(`  saved_looks     ${sauvegardes ? `${sauvegardes.length} look(s) sauvegardé(s)` : "—"}`);
    console.log(`  dressing_items  ${dressings ? `${dressings.length} vêtement(s) utilisateur` : "—"}`);

    const looksReels = [...(historique ?? []), ...(sauvegardes ?? [])] as { piece_ids: number[]; occasion: string | null }[];
    const usageFreq = new Map<number, number>();
    let refCatalogue = 0, refDressing = 0;
    for (const l of looksReels) {
      for (const id of l.piece_ids ?? []) {
        if (id >= VESTIAIRE_ID_OFFSET) { refCatalogue += 1; usageFreq.set(id, (usageFreq.get(id) || 0) + 1); }
        else refDressing += 1;
      }
    }
    console.log(`\n  Looks réels exploitables : ${looksReels.length}`);
    console.log(`  Références de pièces : ${refCatalogue} catalogue · ${refDressing} dressing utilisateur`);
    console.log(`  Pièces de catalogue distinctes réellement portées : ${usageFreq.size}`);
    if (looksReels.length === 0) {
      console.log(`\n  ⚠ AUCUN look réel enregistré. Le rendement d'annotation ne peut donc PAS`);
      console.log(`    être validé sur l'usage : toute conclusion reste conditionnée aux`);
      console.log(`    capsules par défaut. C'est une limite du jeu de données, pas du modèle.`);
    }

    // Couverture des dressings réels — population totalement indépendante du catalogue.
    if (dressings && dressings.length) {
      const d = dressings as { id: number; cat: string; name: string; coupe: string | null }[];
      const faux = d.map((x) => ({ ...x, cat: x.cat, id: x.id, name: x.name })) as unknown as Item[];
      const pertinentes = faux.filter((x) => effetMorphologique(x).pertinent);
      const ok = pertinentes.filter((x) => evaluee(x)).length;
      console.log(`\n  Couverture des vêtements utilisateur : ${ok} / ${pertinentes.length}  ${pct(ok, pertinentes.length)}`);
    }

    // ── B. QUATRE POPULATIONS ─────────────────────────────────────────────
    const looks: { cas: string; occasion: OccasionKey; pieces: CatalogItem[]; score: number; scoreUse: number }[] = [];
    const capsuleIds = new Set<number>();
    const freqCapsule = new Map<number, number>();

    for (const { style, saison } of CAS) {
      const w = meteo(TEMP[saison], BUCKET[saison]);
      const capsule = computeDefaultCapsule(profil([style]), w, [], saison, pool);
      capsule.forEach((c) => capsuleIds.add(c.id));
      // Variante « utilisatrice active » : un historique de port réaliste, pour
      // savoir si la saturation du score tient encore quand l'anti-répétition
      // (R-S15, jusqu'à −30) se déclenche vraiment.
      const capsuleUsee = capsule.map((c, i) => ({ ...c, worn: i % 9 })) as CatalogItem[];
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
          pieces.forEach((p) => freqCapsule.set(p.id, (freqCapsule.get(p.id) || 0) + 1));
          const usees = ids.map((id) => capsuleUsee.find((p) => p.id === id)).filter((p): p is CatalogItem => Boolean(p));
          looks.push({
            cas: `${style} · ${saison}`, occasion, pieces,
            score: computeLookScore(pieces, occasion, [], null, new Set(), w, "Présentiel", "Verre").score,
            scoreUse: computeLookScore(usees, occasion, [], null, new Set(), w, "Présentiel", "Verre").score,
          });
        }
      }
    }

    const pertinentesPool = pool.filter((p) => effetMorphologique(p).pertinent);
    const couv = (items: Item[]) => {
      const p = items.filter((x) => effetMorphologique(x).pertinent);
      return { ok: p.filter((x) => evaluee(x)).length, total: p.length };
    };
    const cCat = couv(pool);
    const cCaps = couv([...capsuleIds].map((id) => parId.get(id)!).filter(Boolean));
    const cUse = couv([...usageFreq.keys()].map((id) => parId.get(id)!).filter(Boolean));

    console.log(`\n════════ 2 · COUVERTURE PAR POPULATION ════════`);
    console.log(`  catalogue complet   ${String(cCat.ok).padStart(4)} / ${String(cCat.total).padStart(4)}  ${pct(cCat.ok, cCat.total)}`);
    console.log(`  pièces de capsule   ${String(cCaps.ok).padStart(4)} / ${String(cCaps.total).padStart(4)}  ${pct(cCaps.ok, cCaps.total)}`);
    console.log(`  pièces réellement portées ${String(cUse.ok).padStart(4)} / ${String(cUse.total).padStart(4)}  ${pct(cUse.ok, cUse.total)}`);
    console.log(`  → écart capsule / catalogue : ${(((cCaps.ok / (cCaps.total || 1)) - (cCat.ok / (cCat.total || 1))) * 100).toFixed(1)} points`);

    // ── C. SATURATION DU SCORE ────────────────────────────────────────────
    console.log(`\n════════ 3 · SATURATION DU SCORE ════════`);
    const analyse = (cle: "score" | "scoreUse", libelle: string) => {
      const s = looks.map((l) => l[cle]);
      const plafond = s.filter((x) => x === 120).length;
      const recommande = s.filter((x) => x >= 80).length;
      const ajuster = s.filter((x) => x < 50).length;
      // Marge : un look à moins de 10 points d'une frontière peut basculer.
      const prochePlafond = s.filter((x) => x >= 110 && x < 120).length;
      const procheSeuil80 = s.filter((x) => x >= 70 && x < 90).length;
      const moy = s.reduce((a, b) => a + b, 0) / (s.length || 1);
      console.log(`  ${libelle}`);
      console.log(`     moyenne ${moy.toFixed(1)} · au plafond (120) ${plafond} ${pct(plafond, s.length)}`);
      console.log(`     badges : recommandé ${pct(recommande, s.length)} · neutre ${pct(s.length - recommande - ajuster, s.length)} · à ajuster ${pct(ajuster, s.length)}`);
      console.log(`     looks sensibles à ±10 autour du seuil 80 : ${procheSeuil80} ${pct(procheSeuil80, s.length)}`);
      console.log(`     looks 110-119 (une règle +10 les plafonnerait) : ${prochePlafond} ${pct(prochePlafond, s.length)}`);
    };
    analyse("score", "Conditions de la phase 3 (worn null, palette vide) :");
    analyse("scoreUse", "Conditions « utilisatrice active » (historique de port simulé) :");

    // ── D. STRATÉGIES D'ANNOTATION ────────────────────────────────────────
    const inconnues = pertinentesPool.filter((p) => !evaluee(p));
    // Impact réel : dans combien de looks cette pièce est-elle le SEUL verrou ?
    // C'est mesurable, contrairement à un « impact morphologique » estimé.
    const verrou = new Map<number, number>();
    for (const l of looks) {
      if (classeDe(l.pieces) === "MORPHOLOGY_READY") continue;
      const bloquantes = l.pieces.filter((p) => effetMorphologique(p).pertinent && !evaluee(p));
      for (const b of bloquantes) {
        if (classeDe(l.pieces, new Set([b.id])) === "MORPHOLOGY_READY") {
          verrou.set(b.id, (verrou.get(b.id) || 0) + 1);
        }
      }
    }
    const candidats = inconnues.map((p) => ({
      id: p.id, name: p.name, cat: p.cat,
      categorie: ligneDe.get(p.id)?.category ?? "",
      sousType: ligneDe.get(p.id)?.sous_type ?? "",
      freq: freqCapsule.get(p.id) || 0,
      verrou: verrou.get(p.id) || 0,
      usage: usageFreq.get(p.id) || 0,
    }));

    const readyAvec = (ids: number[]) => {
      const s = new Set(ids);
      return looks.filter((l) => classeDe(l.pieces, s) === "MORPHOLOGY_READY").length;
    };
    const glouton = (n: number): number[] => {
      const choisis: number[] = [];
      const restants = candidats.filter((c) => c.freq > 0 || c.verrou > 0).map((c) => c.id);
      for (let k = 0; k < n; k++) {
        let meilleur = -1, gain = -1;
        for (const id of restants) {
          if (choisis.includes(id)) continue;
          const r = readyAvec([...choisis, id]);
          if (r > gain) { gain = r; meilleur = id; }
        }
        if (meilleur < 0) break;
        choisis.push(meilleur);
      }
      return choisis;
    };

    const STRATS: { nom: string; ids: (n: number) => number[] }[] = [
      { nom: "A · fréquence",            ids: (n) => [...candidats].sort((a, b) => b.freq - a.freq).slice(0, n).map((c) => c.id) },
      { nom: "B · impact (verrou)",      ids: (n) => [...candidats].sort((a, b) => b.verrou - a.verrou).slice(0, n).map((c) => c.id) },
      { nom: "C · fréquence × verrou",   ids: (n) => [...candidats].sort((a, b) => b.freq * b.verrou - a.freq * a.verrou).slice(0, n).map((c) => c.id) },
      { nom: "D · glouton (marginal)",   ids: (n) => glouton(n) },
    ];
    console.log(`\n════════ 4 · STRATÉGIES D'ANNOTATION ════════`);
    console.log(`  base : ${pct(readyAvec([]), looks.length)} de looks READY`);
    console.log(`  ${"stratégie".padEnd(24)} ${"5".padStart(8)} ${"10".padStart(8)} ${"15".padStart(8)} ${"20".padStart(8)}`);
    for (const s of STRATS) {
      const l = [5, 10, 15, 20].map((n) => pct(readyAvec(s.ids(n)), looks.length).padStart(8)).join(" ");
      console.log(`  ${s.nom.padEnd(24)} ${l}`);
    }

    console.log(`\n  Top 20 candidats (fréquence · verrou · usage réel) :`);
    for (const c of [...candidats].sort((a, b) => b.verrou - a.verrou || b.freq - a.freq).slice(0, 20)) {
      console.log(`     [#${c.id - VESTIAIRE_ID_OFFSET}] ${c.name.padEnd(38).slice(0, 38)} ${c.categorie.padEnd(20)} freq ${String(c.freq).padStart(4)} · verrou ${String(c.verrou).padStart(4)} · usage ${c.usage}`);
    }

    const ordreD = glouton(20);
    console.log(`\n  Ordre glouton (le vrai top 20) :`);
    ordreD.forEach((id, i) => {
      const c = candidats.find((x) => x.id === id)!;
      console.log(`     ${String(i + 1).padStart(2)}. [#${id - VESTIAIRE_ID_OFFSET}] ${c.name} — ${c.categorie} (freq ${c.freq}, verrou ${c.verrou})`);
    });

    // ── E. READY BINAIRE vs NIVEAUX DE CONFIANCE ──────────────────────────
    console.log(`\n════════ 5 · READY BINAIRE vs CONFIANCE GRADUÉE ════════`);
    const niveau = (pieces: Item[]): "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN" => {
      const sig = signatureLook(pieces);
      const pert = pieces.filter((p) => effetMorphologique(p).pertinent);
      const part = pert.length ? pert.filter((p) => evaluee(p)).length / pert.length : 0;
      if (sig.classe === "MORPHOLOGY_READY" && part >= 0.75) return "HIGH";
      if (sig.classe === "MORPHOLOGY_READY") return "MEDIUM";
      if (sig.classe === "MORPHOLOGY_PARTIAL" && part >= 0.5) return "LOW";
      return "UNKNOWN";
    };
    const niv = new Map<string, number>();
    for (const l of looks) niv.set(niveau(l.pieces), (niv.get(niveau(l.pieces)) || 0) + 1);
    for (const k of ["HIGH", "MEDIUM", "LOW", "UNKNOWN"]) {
      console.log(`  ${k.padEnd(9)} ${String(niv.get(k) || 0).padStart(4)}  ${pct(niv.get(k) || 0, looks.length)}`);
    }
    const transverseSeule = looks.filter((l) => {
      const p = l.pieces.filter((x) => effetMorphologique(x).pertinent);
      return p.some((x) => ZONE[x.cat] === "transverse" && evaluee(x)) && p.filter((x) => ZONE[x.cat] !== "transverse").length === 0;
    }).length;
    console.log(`\n  Looks portés par une seule pièce transverse évaluée (robe/combinaison seule) : ${transverseSeule}`);
    const partielCouvrable = looks.filter((l) => {
      if (classeDe(l.pieces) !== "MORPHOLOGY_PARTIAL") return false;
      const bloq = l.pieces.filter((p) => effetMorphologique(p).pertinent && !evaluee(p));
      return bloq.length === 1;
    }).length;
    console.log(`  Looks PARTIAL à une seule pièce près : ${partielCouvrable}  ${pct(partielCouvrable, looks.length)}`);

    writeFileSync("morpho-candidats.csv",
      [["id", "nom", "categorie", "sous_type", "freq_capsule", "verrou_looks", "usage_reel"].map(csv).join(",")]
        .concat(candidats.sort((a, b) => b.verrou - a.verrou)
          .map((c) => [c.id - VESTIAIRE_ID_OFFSET, c.name, c.categorie, c.sousType, c.freq, c.verrou, c.usage].map(csv).join(",")))
        .join("\n"), "utf8");

    console.log(`\nArtefact : morpho-candidats.csv`);
    console.log("Aucune modification effectuée — contre-audit en lecture seule.");
  }, 900_000);
});
