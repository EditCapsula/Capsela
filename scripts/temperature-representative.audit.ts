import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// ET SI LE DÉFAUT ÉTAIT LE PARAMÈTRE, PAS LE MÉCANISME ? — LECTURE SEULE.
//
// CE QUI EST ÉTABLI ET NE SE REMESURE PAS. Quatre mécanismes d'appartenance
// alternatifs ont été mesurés et refusés, chacun par le nombre de tenues
// incohérentes qu'il produit :
//
//   A · actuel — bucket + bornes ........................    0 tenue fausse
//   B · bucket seul .....................................  179
//   C · déclaration + min ............................... 0, mais +22 mortes
//   D · bucket + max ....................................  371
//   E · déclaration seule ............................... 932
//
// Le mécanisme actuel est le seul des cinq qui ne produise aucune tenue
// incohérente. Ses défauts sont des coûts d'INVISIBILITÉ : 85 pièces absentes
// de capsules qu'elles déclarent, 27 manteaux morts.
//
// L'HYPOTHÈSE MESURÉE ICI. Le bras E faisait tomber la mortalité manteau de
// 27 à 0, mais au prix de 225 dépassements de max en automne. Ces deux faits
// ont la MÊME cause : la capsule d'automne est bâtie à 14 °C. Un manteau
// `max 12` est correctement décrit, correctement déclaré, et exclu d'une
// capsule bâtie à une température de fin d'été.
//
// Si c'est le PARAMÈTRE qui est faux et non la règle, le baisser doit faire
// entrer les manteaux SANS qu'aucune borne ne soit violée — puisque rien ne
// change dans les règles, seulement la température de référence.
//
// COMMENT C'EST SIMULÉ, EXACTEMENT. REPRESENTATIVE_TEMP n'est pas exporté,
// mais le filtre est `min <= T <= max`. Tester T' avec les bornes réelles
// équivaut donc à tester T avec toutes les bornes décalées de (T − T').
// Le décalage est appliqué au pool ; `seasonKey` reste inchangé, donc le
// bucket saisonnier et la règle des mailles fermées en été se comportent à
// l'identique. Les identifiants obtenus sont remappés sur les pièces
// ORIGINALES pour générer les tenues : les bornes réelles y sont intactes.
//
// CE QUI PEUT REFUSER CHAQUE CANDIDAT. La tenue du jour n'utilise PAS la
// température représentative — elle utilise la météo réelle. Baisser le
// paramètre fait donc entrer dans la capsule des pièces qui seront ensuite
// portées par des journées plus douces que la nouvelle référence. Les tenues
// sont donc générées sur une PLAGE RÉELLE par saison, pas à la seule
// température candidate, et les deux compteurs qui ont refusé les bras
// précédents sont repris tels quels.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 25;
const COUCHES: CategoryKey[] = ["pull", "veste", "manteau"];

/** Candidats par saison, du plus prudent au plus franc. Le premier est l'actuel. */
const CANDIDATS: Record<CapsuleSeason, number[]> = {
  Printemps: [16, 15, 14],
  "Été": [24, 23, 22],
  Automne: [14, 12, 10],
  Hiver: [6, 4, 2],
};

/** La plage réelle de chaque saison — ce que la météo du jour peut valoir. */
const PLAGE_REELLE: Record<CapsuleSeason, number[]> = {
  Printemps: [10, 16, 22],
  "Été": [20, 25, 30],
  Automne: [8, 14, 20],
  Hiver: [0, 6, 12],
};

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

function saisonsDeclarees(raw: string | null): CapsuleSeason[] {
  const jetons = (raw ?? "").split(/[,;|]/).map((s) => sansAccents(s)).filter(Boolean);
  return CAPSULE_SEASONS.filter((s) => jetons.includes(sansAccents(s)));
}

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

const meteo = (temp: number, saison: CapsuleSeason): Weather => {
  const w = representativeWeatherFor(saison);
  return { ...w, temp } as Weather;
};

describe("la température représentative des saisons", () => {
  it("mesure si baisser le paramètre récupère les pièces sans produire de tenue fausse", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const ligne = new Map<number, VestiaireRow>(brutes.map((r) => [VESTIAIRE_ID_OFFSET + r.id, r]));
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    const declarees = new Map(pool.map((it) => [it.id, saisonsDeclarees(ligne.get(it.id)?.saison_capsule ?? null)]));
    console.log(`Catalogue : ${pool.length} pièces.`);
    console.log(`Simulation exacte : tester T' revient à décaler toutes les bornes de (T − T').`);

    /** Le pool décalé — équivalent exact d'une capsule bâtie à `cible`. */
    const poolDecale = (saison: CapsuleSeason, cible: number): CatalogItem[] => {
      const delta = representativeWeatherFor(saison).temp - cible;
      if (!delta) return pool;
      return pool.map((it) => ({
        ...it,
        meteoMinTemp: it.meteoMinTemp == null ? undefined : it.meteoMinTemp + delta,
        meteoMaxTemp: it.meteoMaxTemp == null ? undefined : it.meteoMaxTemp + delta,
      }));
    };

    const capsulePour = (saison: CapsuleSeason, cible: number, style: string): CatalogItem[] =>
      computeDefaultCapsule(
        profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, poolDecale(saison, cible),
      ).map((it) => index.get(it.id)).filter((x): x is CatalogItem => Boolean(x));

    for (const saison of CAPSULE_SEASONS) {
      const actuel = CANDIDATS[saison][0];
      console.log(`\n════════ ${saison.toUpperCase()} — actuellement bâtie à ${actuel} °C ════════`);
      console.log(`  ${"réf.".padStart(6)}${"pièces".padStart(9)}${"manteaux".padStart(10)}${"mortes".padStart(9)}${"dont manteaux".padStart(15)}   tenues sur la plage réelle ${PLAGE_REELLE[saison].join("/")} °`);
      for (const cible of CANDIDATS[saison]) {
        let pieces = 0, manteaux = 0, mortes = 0, mortesManteau = 0;
        const capsules = STYLES_FEMME.map((style) => ({ style, capsule: capsulePour(saison, cible, style) }));
        for (const { capsule } of capsules) {
          pieces += capsule.length;
          manteaux += capsule.filter((it) => it.cat === "manteau").length;
        }
        // Mortalité et tenues, sur la PLAGE RÉELLE de la saison.
        const detail: string[] = [];
        for (const temp of PLAGE_REELLE[saison]) {
          const w = meteo(temp, saison);
          let surMax = 0, sousMinNu = 0, cellules = 0, tenues = 0;
          for (const { style, capsule } of capsules) {
            for (const occ of OCCS) {
              let couverte = false;
              for (let k = 0; k < N; k++) {
                const vrai = Math.random;
                Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}|${temp}`));
                let ids: number[];
                try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids; }
                finally { Math.random = vrai; }
                if (!ids.length) continue;
                couverte = true; tenues += 1;
                const p = ids.map((id) => index.get(id)).filter((x): x is CatalogItem => Boolean(x));
                const aUneCouche = p.some((x) => COUCHES.includes(x.cat));
                for (const x of p) {
                  if (x.meteoMaxTemp != null && temp > x.meteoMaxTemp) surMax += 1;
                  if (x.meteoMinTemp != null && temp < x.meteoMinTemp && !aUneCouche) sousMinNu += 1;
                }
              }
              if (couverte) cellules += 1;
            }
          }
          detail.push(`${temp}°: ${cellules}/${STYLES_FEMME.length * OCCS.length} · max+${surMax} · nu+${sousMinNu}`);
        }
        // Mortalité mesurée à la température de référence candidate.
        const wRef = meteo(cible, saison);
        for (const { style, capsule } of capsules) {
          const vues = new Set<number>();
          for (const occ of OCCS) {
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}|ref`));
              try { for (const id of generateOutfitWithFallback(capsule, wRef, occ, "Présentiel", "Verre", [], "femme", saison).ids) vues.add(id); }
              finally { Math.random = vrai; }
            }
          }
          for (const it of capsule) if (!vues.has(it.id)) { mortes += 1; if (it.cat === "manteau") mortesManteau += 1; }
        }
        const marque = cible === actuel ? " (actuel)" : "";
        console.log(`  ${(cible + "°").padStart(6)}${String(pieces).padStart(9)}${String(manteaux).padStart(10)}${String(mortes).padStart(9)}${String(mortesManteau).padStart(15)}   ${detail.join("   ")}${marque}`);
      }
      // Les pièces déclarant cette saison et qui n'y entrent toujours pas.
      const declarantes = pool.filter((it) => declarees.get(it.id)!.includes(saison));
      for (const cible of CANDIDATS[saison]) {
        const dedans = new Set<number>();
        for (const style of STYLES_FEMME) for (const it of capsulePour(saison, cible, style)) dedans.add(it.id);
        const absentes = declarantes.filter((it) => !dedans.has(it.id));
        console.log(`     à ${cible} ° : ${absentes.length}/${declarantes.length} pièces déclarant ${saison} n'entrent dans AUCUNE capsule de la saison`);
      }
    }

    console.log(`\n  Lecture : un candidat n'est retenable que si « max+ » et « nu+ » restent à 0`);
    console.log(`  sur TOUTE la plage réelle. Une capsule mieux fournie qui produit une tenue`);
    console.log(`  fausse un jour doux ne vaut pas mieux que les quatre mécanismes refusés.`);
    console.log(`\n  LECTURE SEULE. Aucun fichier de production modifié, aucune donnée touchée.`);
  }, 900_000);
});
