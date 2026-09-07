import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// POURQUOI LES TENUES DEVIENNENT FAUSSES QUAND LA MÉTÉO S'ÉCARTE DE LA
// SAISON — DIAGNOSTIC, LECTURE SEULE.
//
// LE CONSTAT. La capsule est bâtie à la température REPRÉSENTATIVE de la
// saison, mais la tenue du jour est générée avec la météo RÉELLE. Mesuré sur
// 2 000 tenues par point : 115 pièces portées au-dessus de leur maximum par
// 20 °C en automne, 121 par 12 °C en hiver, 143 portées nues sous leur
// minimum par 10 °C au printemps. À la seule température de référence, ces
// compteurs sont à zéro — c'est pourquoi aucune mesure antérieure ne les
// avait vus, y compris les miennes.
//
// C'est la même famille que le signalement du 03/09 (« 27 °C et on me propose
// des pulls »), qu'on a soigné sur six pièces sans traiter la cause.
//
// CE SCRIPT NE PROPOSE RIEN. Il attribue. L'audit `pull-chaleur` a déjà
// montré qu'on peut se tromper de cause — le repli du moteur y était à ZÉRO
// là où je l'attendais, et tout venait des données. La même prudence
// s'applique : l'hypothèse « c'est le repli de poolFor » est testée, pas
// supposée.
//
// L'ATTRIBUTION, calculable et sans instrumenter la production. Pour chaque
// pièce portée hors de sa plage, on reconstruit le pool qui ÉTAIT éligible
// dans sa capsule à cette température, avec les règles réelles de
// `applyTempFilter` — max toujours appliqué, min exempté pour
// TEMP_COMPENSATED_CATS :
//
//   · REPLI FORCÉ — aucune pièce de cette catégorie ne passait le filtre.
//     Le moteur n'avait pas le choix : soit il relâchait, soit la catégorie
//     restait vide. Correctif éventuel : la capsule, pas le repli.
//   · CHOIX MALGRÉ ALTERNATIVES — d'autres pièces de la même catégorie
//     passaient. Le moteur avait de quoi faire et a pris celle-ci.
//     Correctif éventuel : le chemin de sélection, pas la capsule.
//   · EXEMPTION SANS COUCHE — la pièce est sous son min dans une catégorie
//     que la génération exempte volontairement. L'exemption suppose une
//     couche par-dessus ; ici il n'y en a pas. On mesure alors si une couche
//     ÉTAIT disponible dans la capsule : si oui, le défaut est corrigeable
//     sans toucher aux données ni à la capsule.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 25;
/** Recopié de logic.ts:630. Si cette liste y change, cette attribution ne vaut plus. */
const COMPENSEES: CategoryKey[] = ["haut", "pull", "robe", "combinaison", "jupe", "short"];
const COUCHES: CategoryKey[] = ["pull", "veste", "manteau"];

/** La plage réaliste de chaque saison — ce que la météo du jour peut valoir. */
const PLAGE: Record<CapsuleSeason, number[]> = {
  Printemps: [8, 10, 13, 16, 19, 22],
  "Été": [18, 21, 24, 27, 30],
  Automne: [6, 8, 11, 14, 17, 20],
  Hiver: [-2, 0, 3, 6, 9, 12],
};

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function grainePour(cle: string): number {
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const meteo = (temp: number, saison: CapsuleSeason): Weather =>
  ({ ...representativeWeatherFor(saison), temp }) as Weather;

/** Le filtre réel de la génération, recopié depuis logic.ts:631. */
const passeLeFiltre = (it: CatalogItem, temp: number): boolean => {
  if (it.meteoMinTemp != null && temp < it.meteoMinTemp && !COMPENSEES.includes(it.cat)) return false;
  if (it.meteoMaxTemp != null && temp > it.meteoMaxTemp) return false;
  return true;
};

type Famille = "repli forcé" | "choix malgré alternatives" | "exemption sans couche";

describe("les tenues hors de la plage de leur saison", () => {
  it("attribue chaque pièce hors plage à un mécanisme, sans en supposer aucun", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    console.log(`Catalogue : ${pool.length} pièces. Capsules bâties comme en production, tenues générées sur la plage réelle.`);

    const parFamille = new Map<Famille, number>();
    const parCategorie = new Map<CategoryKey, Map<Famille, number>>();
    const parPiece = new Map<number, number>();
    const coucheDispo = { oui: 0, non: 0 };
    let tenuesTotal = 0, tenuesFautives = 0;
    const exemples: string[] = [];
    const rngEx = mulberry32(grainePour("echantillon-hors-plage"));
    let vusPourEx = 0;

    console.log(`\n════════ 1 · OÙ ET COMBIEN ════════`);
    console.log(`  ${"saison".padEnd(12)}${"temp".padStart(6)}${"tenues".padStart(9)}${"fautives".padStart(10)}${"taux".padStart(8)}${"au-dessus max".padStart(15)}${"nu sous min".padStart(13)}`);
    for (const saison of CAPSULE_SEASONS) {
      const capsules = STYLES_FEMME.map((style) => ({
        style,
        capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, pool),
      }));
      for (const temp of PLAGE[saison]) {
        const w = meteo(temp, saison);
        let tenues = 0, fautives = 0, surMax = 0, sousMinNu = 0;
        for (const { style, capsule } of capsules) {
          // Ce qui ÉTAIT éligible dans cette capsule à cette température.
          const eligiblesParCat = new Map<CategoryKey, number>();
          for (const it of capsule) if (passeLeFiltre(it, temp)) eligiblesParCat.set(it.cat, (eligiblesParCat.get(it.cat) ?? 0) + 1);
          const coucheEligible = COUCHES.some((c) => (eligiblesParCat.get(c) ?? 0) > 0);

          for (const occ of OCCS) {
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}|${temp}`));
              let ids: number[];
              try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids; }
              finally { Math.random = vrai; }
              if (!ids.length) continue;
              tenues += 1; tenuesTotal += 1;
              const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
              const aUneCouche = pieces.some((p) => COUCHES.includes(p.cat));
              let fautive = false;
              for (const p of pieces) {
                const tropChaud = p.meteoMaxTemp != null && temp > p.meteoMaxTemp;
                const tropFroid = p.meteoMinTemp != null && temp < p.meteoMinTemp;
                if (!tropChaud && !(tropFroid && !aUneCouche)) continue;
                fautive = true;
                let fam: Famille;
                if (tropChaud) {
                  fam = (eligiblesParCat.get(p.cat) ?? 0) === 0 ? "repli forcé" : "choix malgré alternatives";
                  surMax += 1;
                } else {
                  fam = COMPENSEES.includes(p.cat) ? "exemption sans couche"
                    : (eligiblesParCat.get(p.cat) ?? 0) === 0 ? "repli forcé" : "choix malgré alternatives";
                  sousMinNu += 1;
                  if (fam === "exemption sans couche") { if (coucheEligible) coucheDispo.oui += 1; else coucheDispo.non += 1; }
                }
                parFamille.set(fam, (parFamille.get(fam) ?? 0) + 1);
                const m = parCategorie.get(p.cat) ?? new Map<Famille, number>();
                m.set(fam, (m.get(fam) ?? 0) + 1);
                parCategorie.set(p.cat, m);
                parPiece.set(p.id, (parPiece.get(p.id) ?? 0) + 1);

                // Échantillon par réservoir uniforme — ni les pires ni les plus commodes.
                vusPourEx += 1;
                const texte = `${saison} ${temp}° · ${style}/${occ} — ${p.name} [${p.meteoMinTemp ?? "—"}, ${p.meteoMaxTemp ?? "—"}] · ${fam}\n            tenue : ${pieces.map((x) => x.name).join(" + ")}`;
                if (exemples.length < 12) exemples.push(texte);
                else { const j = Math.floor(rngEx() * vusPourEx); if (j < 12) exemples[j] = texte; }
              }
              if (fautive) { fautives += 1; tenuesFautives += 1; }
            }
          }
        }
        const ref = representativeWeatherFor(saison).temp === temp ? "  <- référence" : "";
        console.log(`  ${saison.padEnd(12)}${(temp + "°").padStart(6)}${String(tenues).padStart(9)}${String(fautives).padStart(10)}${((fautives / tenues) * 100).toFixed(1).padStart(7)}%${String(surMax).padStart(15)}${String(sousMinNu).padStart(13)}${ref}`);
      }
    }

    // ═══ 2 · PAR QUEL MÉCANISME ═════════════════════════════════════════
    console.log(`\n════════ 2 · ATTRIBUTION — PAR QUEL CHEMIN CES PIÈCES ARRIVENT ════════`);
    const total = [...parFamille.values()].reduce((a, b) => a + b, 0);
    console.log(`  ${tenuesFautives} tenues fautives sur ${tenuesTotal} (${((tenuesFautives / tenuesTotal) * 100).toFixed(1)} %), ${total} occurrences.`);
    for (const fam of ["repli forcé", "choix malgré alternatives", "exemption sans couche"] as Famille[]) {
      const n = parFamille.get(fam) ?? 0;
      console.log(`  ${String(n).padStart(6)}  ${((n / total) * 100).toFixed(1).padStart(5)} %  ${fam}`);
    }
    console.log(`\n  Pour les « exemption sans couche » : une couche était-elle disponible ?`);
    console.log(`     couche DISPONIBLE dans la capsule, non utilisée : ${coucheDispo.oui}`);
    console.log(`     aucune couche éligible ........................ : ${coucheDispo.non}`);
    console.log(`  Le premier chiffre est corrigeable sans toucher aux données ni à la capsule.`);

    console.log(`\n  Par catégorie :`);
    console.log(`  ${"cat".padEnd(13)}${"repli forcé".padStart(13)}${"malgré alt.".padStart(13)}${"exempt. nue".padStart(13)}`);
    for (const [cat, m] of [...parCategorie.entries()].sort((a, b) => {
      const s = (x: Map<Famille, number>) => [...x.values()].reduce((p, q) => p + q, 0);
      return s(b[1]) - s(a[1]);
    })) {
      console.log(`  ${cat.padEnd(13)}${String(m.get("repli forcé") ?? 0).padStart(13)}${String(m.get("choix malgré alternatives") ?? 0).padStart(13)}${String(m.get("exemption sans couche") ?? 0).padStart(13)}`);
    }

    console.log(`\n  Les 15 pièces les plus souvent hors plage :`);
    for (const [id, n] of [...parPiece.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      const it = index.get(id)!;
      console.log(`     ${String(n).padStart(5)}×  ${it.cat.padEnd(11)}[${it.meteoMinTemp ?? "—"}, ${it.meteoMaxTemp ?? "—"}]`.padEnd(40) + it.name);
    }

    console.log(`\n════════ 3 · ÉCHANTILLON BRUT, TIRÉ PAR RÉSERVOIR ════════`);
    console.log(`  Ni les pires ni les plus commodes : tirage uniforme et semé.`);
    for (const e of exemples) console.log(`     ${e}`);

    console.log(`\n  LECTURE SEULE. Aucun correctif appliqué, aucune donnée modifiée.`);
    console.log(`  Ce script ne dit pas quoi corriger : il dit par quel chemin le défaut passe.`);
  }, 900_000);
});
