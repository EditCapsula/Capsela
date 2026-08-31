import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule } from "../src/lib/capsule";
import { generateOutfit } from "../src/lib/logic";
import { conseilAffichable, effetMorphologique, niveauConfiance, scoreMorphoV2, signatureLook } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, Season } from "../src/lib/types";
import { type Profile } from "../src/lib/profile";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";

// Instrumentation de phase 8 — LECTURE SEULE, aucune règle modifiée ici.
//
//   F · KPI de couverture du conseil : quelle part des looks reçoit réellement
//       un conseil affichable, par morphologie et par saison ?
//   D · Capacité fonctionnelle d'une capsule : quels leviers stylistiques sont
//       disponibles — outil d'analyse, jamais un quota.
//   B · Audit des cas +10 du rectangle, AVANT toute modification de la règle.
//   E · Asymétrie des écarts −3 / +3 : quelles pièces en sont responsables ?

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEMP: Record<CapsuleSeason, number> = { Printemps: 16, "Été": 26, Automne: 13, Hiver: 5 };
const BUCKET: Record<CapsuleSeason, Season> = {
  Printemps: "Printemps / Été", "Été": "Printemps / Été",
  Automne: "Automne / Hiver", Hiver: "Automne / Hiver",
};
/**
 * Les styles exposés, par IDENTIFIANT (harnais d'audit du 29/08/2026).
 * Les libellés français qu'utilisait la version précédente renvoyaient
 * `undefined` via STYLE_ID_TO_CATALOG_LABEL : le filtre de style était
 * silencieusement sauté et la mesure portait sur un pool universel.
 */
const STYLES = STYLES_FEMME;
const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const MORPHOS = ["f_poire", "f_triangle_inverse", "f_sablier", "f_rectangle", "f_pomme"];
const TENTATIVES = 35;

const meteo = (t: number, s: Season): Weather =>
  ({ season: s, temp: t, label: t < 10 ? "Froid" : t < 20 ? "Doux" : "Chaud", seasons: [s, "Toutes saisons"] });
const profil = (styles: readonly string[]): Profile => profilAudit({ gender: "femme", styles });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const moy = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const isSport = (it: Item) => (it.niveauFormalite ?? 1) === 0;

describe("Instrumentation phase 8", () => {
  it("mesure la couverture du conseil et audite les règles sans les modifier", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    const ligneDe = new Map(rows.map((r) => [r.id + VESTIAIRE_ID_OFFSET, r]));

    interface Look { saison: CapsuleSeason; style: string; occasion: string; pieces: CatalogItem[] }
    // Périmètre morphologique : un look composé uniquement de pièces sport est
    // HORS périmètre, pas « sans capacité ». R-B11 rend l'occasion sport
    // étanche (liste blanche formalité 0), donc ces looks n'ont pas à peser sur
    // le dénominateur d'une couverture de conseil morphologique.
    const horsPerimetre = (l: Look) => l.occasion === "sport" || l.pieces.every(isSport);
    const looks: Look[] = [];
    const capsules: { nom: string; saison: CapsuleSeason; pieces: CatalogItem[] }[] = [];

    for (const style of STYLES) {
      for (const saison of SAISONS) {
        const w = meteo(TEMP[saison], BUCKET[saison]);
        const c = computeDefaultCapsule(profil([style]), w, [], saison, pool);
        capsules.push({ nom: `${style} · ${saison}`, saison, pieces: c });
        const vus = new Set<string>();
        for (const [occ] of OCCASIONS) {
          for (let n = 0; n < TENTATIVES; n++) {
            const { ids } = generateOutfit(c, w, occ, "Présentiel", "Verre", [], "femme");
            const cle = [...ids].sort((a, b) => a - b).join(",");
            if (ids.length < 2 || vus.has(cle)) continue;
            vus.add(cle);
            const p = ids.map((i) => c.find((x) => x.id === i)).filter((x): x is CatalogItem => Boolean(x));
            if (p.length >= 2) looks.push({ saison, style, occasion: occ, pieces: p });
          }
        }
      }
    }

    // ── F · KPI DE COUVERTURE DU CONSEIL ──────────────────────────────────
    const dansPerimetre = looks.filter((l) => !horsPerimetre(l));
    const exclus = looks.length - dansPerimetre.length;
    console.log(`\n════════ F · COUVERTURE DU CONSEIL MORPHOLOGIQUE ════════`);
    console.log(`  ${looks.length} looks générés · ${exclus} hors périmètre morphologique (sport) · ${dansPerimetre.length} évalués`);
    console.log(`  Le sport n'est pas « sans capacité morphologique » : il est hors périmètre.`);
    console.log(`  Un conseil est AFFICHABLE si l'évidence est HIGH ou MEDIUM et la direction positive.`);
    console.log(`  Une direction défavorable n'est jamais montrée : elle ne sert qu'au classement.\n`);
    console.log(`  ${"morphologie".padEnd(20)} ${"HIGH".padStart(8)} ${"MEDIUM".padStart(8)} ${"LOW".padStart(8)} ${"UNKNOWN".padStart(9)} ${"CONSEIL".padStart(9)} ${"silence".padStart(9)}`);
    for (const m of MORPHOS) {
      const niveaux = dansPerimetre.map((l) => niveauConfiance(l.pieces));
      const n = (v: string) => niveaux.filter((x) => x === v).length;
      const avecConseil = dansPerimetre.filter((l) => conseilAffichable(l.pieces, m)).length;
      console.log(
        `  ${m.padEnd(20)} ${pct(n("HIGH"), dansPerimetre.length).padStart(8)} ${pct(n("MEDIUM"), dansPerimetre.length).padStart(8)}` +
        ` ${pct(n("LOW"), dansPerimetre.length).padStart(8)} ${pct(n("UNKNOWN"), dansPerimetre.length).padStart(9)}` +
        ` ${pct(avecConseil, dansPerimetre.length).padStart(9)} ${pct(dansPerimetre.length - avecConseil, dansPerimetre.length).padStart(9)}`
      );
    }

    console.log(`\n  Couverture du conseil par saison :`);
    console.log(`  ${"morphologie".padEnd(20)} ${SAISONS.map((s) => s.padStart(11)).join("")}`);
    for (const m of MORPHOS) {
      const cols = SAISONS.map((s) => {
        const sub = dansPerimetre.filter((l) => l.saison === s);
        return pct(sub.filter((l) => conseilAffichable(l.pieces, m)).length, sub.length).padStart(11);
      }).join("");
      console.log(`  ${m.padEnd(20)}${cols}`);
    }

    // ── D · CAPACITÉ FONCTIONNELLE DES CAPSULES ───────────────────────────
    console.log(`\n════════ D · CAPACITÉ FONCTIONNELLE DES CAPSULES ════════`);
    console.log(`  Outil d'analyse. N'influence AUCUNE sélection — aucun quota n'en découle.`);
    console.log(`\n  ${"capsule".padEnd(26)} ${"tot".padStart(4)} ${"lev.ép".padStart(7)} ${"lev.bas".padStart(8)} ${"lev.taille".padStart(11)} ${"intensités".padStart(11)}`);
    for (const c of capsules) {
      const hs = c.pieces.filter((x) => !isSport(x));
      const levEp = hs.filter((x) => effetMorphologique(x).epaules >= 2).length;
      const levBas = hs.filter((x) => ["pantalon", "jean", "jupe", "short"].includes(x.cat) && effetMorphologique(x).hanches <= 1
        && effetMorphologique(x).confiance !== "inconnue").length;
      const levTa = hs.filter((x) => effetMorphologique(x).taille >= 2).length;
      // Variété des intensités disponibles : une capsule dont toutes les pièces
      // ont le même effet n'offre aucun levier de composition.
      const intensites = new Set(hs.map((x) => {
        const e = effetMorphologique(x);
        return `${e.epaules}${e.taille}${e.hanches}`;
      })).size;
      console.log(`  ${c.nom.padEnd(26)} ${String(c.pieces.length).padStart(4)} ${String(levEp).padStart(7)} ${String(levBas).padStart(8)} ${String(levTa).padStart(11)} ${String(intensites).padStart(11)}`);
    }

    // ── §23-A/C/D · CAPACITÉ THÉORIQUE vs RÉELLEMENT EXPLOITÉE ───────────
    // Le coeur du diagnostic : une capsule peut CONTENIR des leviers sans que
    // les looks générés les ASSOCIENT jamais. On compare donc, saison par
    // saison, ce que la capsule rend possible et ce que la génération produit.
    console.log(`\n════════ §23 · POURQUOI LE SILENCE ? CAPACITÉ THÉORIQUE vs EXPLOITÉE ════════`);
    const estLevierEpaules = (x: Item) => effetMorphologique(x).epaules >= 2;
    const estBasDiscret = (x: Item) => ["pantalon", "jean", "jupe", "short"].includes(x.cat)
      && effetMorphologique(x).confiance !== "inconnue" && effetMorphologique(x).hanches <= 1;

    console.log(`  ${"saison".padEnd(11)} ${"lev.ép".padStart(7)} ${"utilisés".padStart(9)} ${"bas disc.".padStart(10)} ${"utilisés".padStart(9)} ${"looks avec les 2".padStart(17)} ${"compensation".padStart(13)}`);
    for (const saison of SAISONS) {
      const caps = capsules.filter((c) => c.saison === saison);
      const lks = looks.filter((l) => l.saison === saison);
      const leviers = new Set<number>(), basD = new Set<number>();
      for (const c of caps) for (const x of c.pieces.filter((y) => !isSport(y))) {
        if (estLevierEpaules(x)) leviers.add(x.id);
        if (estBasDiscret(x)) basD.add(x.id);
      }
      const leviersUtilises = new Set<number>(), basUtilises = new Set<number>();
      let avecLesDeux = 0;
      for (const l of lks) {
        const aLevier = l.pieces.some(estLevierEpaules);
        const aBas = l.pieces.some(estBasDiscret);
        l.pieces.filter(estLevierEpaules).forEach((x) => leviersUtilises.add(x.id));
        l.pieces.filter(estBasDiscret).forEach((x) => basUtilises.add(x.id));
        if (aLevier && aBas) avecLesDeux += 1;
      }
      const compense = lks.filter((l) => scoreMorphoV2(l.pieces, "f_poire").delta > 0).length;
      console.log(
        `  ${saison.padEnd(11)} ${String(leviers.size).padStart(7)} ${String(leviersUtilises.size).padStart(9)}` +
        ` ${String(basD.size).padStart(10)} ${String(basUtilises.size).padStart(9)}` +
        ` ${(`${avecLesDeux} ${pct(avecLesDeux, lks.length)}`).padStart(17)} ${(`${compense} ${pct(compense, lks.length)}`).padStart(13)}`
      );
    }

    // Un look qui réunit un levier épaules ET un bas discret compense-t-il ?
    console.log(`\n  Parmi les looks réunissant les deux leviers, part réellement en compensation :`);
    for (const saison of SAISONS) {
      const lks = looks.filter((l) => l.saison === saison
        && l.pieces.some(estLevierEpaules) && l.pieces.some(estBasDiscret));
      const ok = lks.filter((l) => scoreMorphoV2(l.pieces, "f_poire").delta > 0).length;
      console.log(`     ${saison.padEnd(11)} ${String(ok).padStart(4)} / ${String(lks.length).padStart(4)}  ${pct(ok, lks.length)}`);
    }

    // Les leviers présents mais JAMAIS tirés : éliminés par les contraintes ?
    console.log(`\n  Leviers épaules présents en capsule mais jamais tirés dans un look :`);
    for (const saison of SAISONS) {
      const caps = capsules.filter((c) => c.saison === saison);
      const lks = looks.filter((l) => l.saison === saison);
      const presents = new Map<number, string>();
      for (const c of caps) for (const x of c.pieces.filter((y) => !isSport(y) && estLevierEpaules(y))) presents.set(x.id, x.name);
      const tires = new Set<number>();
      for (const l of lks) l.pieces.filter(estLevierEpaules).forEach((x) => tires.add(x.id));
      const jamais = [...presents.entries()].filter(([id]) => !tires.has(id));
      console.log(`     ${saison.padEnd(11)} ${jamais.length} / ${presents.size}${jamais.length ? " — " + jamais.map(([, n]) => n).slice(0, 3).join(", ") : ""}`);
    }

    // Distribution des écarts PAR SAISON — localise le décalage.
    console.log(`\n  Distribution des écarts épaules − hanches par saison (looks READY) :`);
    console.log(`  ${"saison".padEnd(11)} ${[-3, -2, -1, 0, 1, 2, 3].map((e) => String(e).padStart(8)).join("")}`);
    for (const saison of SAISONS) {
      const sigs = looks.filter((l) => l.saison === saison).map((l) => signatureLook(l.pieces))
        .filter((x) => x.classe === "MORPHOLOGY_READY");
      const cols = [-3, -2, -1, 0, 1, 2, 3]
        .map((e) => pct(sigs.filter((x) => x.epaules - x.hanches === e).length, sigs.length).padStart(8)).join("");
      console.log(`  ${saison.padEnd(11)}${cols}`);
    }

    // ── B · AUDIT DES CAS +10 DU RECTANGLE ────────────────────────────────
    console.log(`\n════════ B · AUDIT DES CAS +10 DU RECTANGLE (avant toute modification) ════════`);
    const rect = looks.map((l) => ({ l, r: scoreMorphoV2(l.pieces, "f_rectangle"), s: signatureLook(l.pieces) })).filter((x) => x.r.actif);
    const positifs = rect.filter((x) => x.r.delta > 0);
    console.log(`  ${rect.length} looks actifs · ${positifs.length} en +10  ${pct(positifs.length, rect.length)}`);
    const distTaille = new Map<number, number>();
    const distEcart = new Map<number, number>();
    for (const { s } of positifs) {
      distTaille.set(s.taille, (distTaille.get(s.taille) || 0) + 1);
      const e = s.taille - Math.max(s.epaules, s.hanches);
      distEcart.set(e, (distEcart.get(e) || 0) + 1);
    }
    console.log(`\n  Distribution de la taille dans les +10 :`);
    for (const [t, n] of [...distTaille.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`     taille ${t} : ${String(n).padStart(4)}  ${pct(n, positifs.length)}`);
    }
    console.log(`\n  Écart taille − max(épaules, hanches) dans les +10 :`);
    for (const [e, n] of [...distEcart.entries()].sort((a, b) => a[0] - b[0])) {
      console.log(`     écart +${e} : ${String(n).padStart(4)}  ${pct(n, positifs.length)}`);
    }
    console.log(`\n  Pièces les plus fréquentes dans les +10 :`);
    const freqPos = new Map<string, number>();
    for (const { l } of positifs) {
      for (const p of l.pieces) {
        if (effetMorphologique(p).taille >= 2 || (p.cat === "accessoire" && p.accessoireType === "Ceinture")) {
          freqPos.set(p.name, (freqPos.get(p.name) || 0) + 1);
        }
      }
    }
    for (const [nom, n] of [...freqPos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      console.log(`     ${nom.padEnd(42).slice(0, 42)} ${String(n).padStart(5)}  ${pct(n, positifs.length)} des +10`);
    }

    // ── E · ASYMÉTRIE DES ÉCARTS −3 / +3 ──────────────────────────────────
    console.log(`\n════════ E · ASYMÉTRIE DES ÉCARTS EXTRÊMES ════════`);
    const parEcart = new Map<number, Look[]>();
    for (const l of looks) {
      const s = signatureLook(l.pieces);
      if (s.classe !== "MORPHOLOGY_READY") continue;
      const e = s.epaules - s.hanches;
      parEcart.set(e, [...(parEcart.get(e) || []), l]);
    }
    const totalReady = [...parEcart.values()].reduce((a, v) => a + v.length, 0);
    for (const e of [-3, 3]) {
      const groupe = parEcart.get(e) || [];
      console.log(`\n  Écart ${e > 0 ? "+" : ""}${e} : ${groupe.length} looks  ${pct(groupe.length, totalReady)}`);
      const freq = new Map<string, number>();
      for (const l of groupe) {
        for (const p of l.pieces) {
          const eff = effetMorphologique(p);
          const contribue = e < 0 ? eff.hanches >= 2 : eff.epaules >= 2;
          if (contribue) {
            const cat = ligneDe.get(p.id)?.category ?? p.cat;
            freq.set(`${p.name} [${cat}]`, (freq.get(`${p.name} [${cat}]`) || 0) + 1);
          }
        }
      }
      for (const [nom, n] of [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
        console.log(`     ${nom.padEnd(52).slice(0, 52)} ${String(n).padStart(4)}  ${pct(n, groupe.length)}`);
      }
    }
    // Le catalogue lui-même est-il asymétrique ?
    const pertinentes = pool.filter((p) => effetMorphologique(p).pertinent);
    const fortEp = pertinentes.filter((p) => effetMorphologique(p).epaules >= 3).length;
    const fortHa = pertinentes.filter((p) => effetMorphologique(p).hanches >= 3).length;
    console.log(`\n  Catalogue : ${fortEp} pièce(s) à épaules 3 · ${fortHa} pièce(s) à hanches 3`);
    console.log(`  (sur ${pertinentes.length} pièces pertinentes)`);

    console.log(`\n  Moyennes capsules — total ${moy(capsules.map((c) => c.pieces.length)).toFixed(1)}`);
    console.log(`\nAucune modification effectuée — instrumentation en lecture seule.`);
  }, 900_000);
});
