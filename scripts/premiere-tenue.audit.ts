import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CHALEUR_HORS_SAISON, computeDefaultCapsule, currentSeasonKey, saisonCapsuleDuJour, weatherForDay } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { CATS, type Weather } from "../src/lib/data";
import { genererTenueDiversifiee } from "../src/lib/diversite";
import { composeWardrobePool } from "../src/lib/selectors";
import type { StyleId } from "../src/lib/profile";
import type { DateContext, OccasionKey, WorkMode } from "../src/lib/types";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { STYLES_FEMME, STYLES_HOMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LA PREMIÈRE TENUE D'UN COMPTE NEUF (15/11/2026, signalé : une testeuse qui vient de finir l'onboarding — femme, Classique chic, Casual
// chic, Minimaliste, 10° nuageux — voit « On prépare ta première tenue », même après avoir rouvert l'app). LECTURE SEULE.
//
// Non reproduit en mode démo (catalogue de repli de l'app, 16 profils, 24° et 10°) : la mesure se fait donc sur le VRAI catalogue. Elle
// rejoue la chaîne de l'accueil pour un dressing vide, à l'identique du store : weatherForDay → saisonCapsuleDuJour → computeDefaultCapsule
// → composeWardrobePool (puis la complétion par occasion de regen) → genererTenueDiversifiee, sans historique. Un seul levier varie à la
// fois : le trio de styles, la température, l'occasion. Rien d'autre n'est réglé.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const TIRAGES = 10;
const TEMPS: [number, string][] = [
  [4, "Nuageux"],
  [10, "Nuageux"],
  [16, "Nuageux"],
];
const CAT_KEYS = CATS.map(([key]) => key);

interface Contexte { nom: string; occasion: OccasionKey; workMode: WorkMode; dateContext: DateContext }
const CONTEXTES: Contexte[] = [
  { nom: "Quotidien", occasion: "quotidien", workMode: "Présentiel" as WorkMode, dateContext: "Restaurant / date romantique" as DateContext },
  { nom: "Travail présentiel", occasion: "travail_formel", workMode: "Présentiel" as WorkMode, dateContext: "Restaurant / date romantique" as DateContext },
  // « Je suis en congés » ou une période de congés (occasionParDefaut, jourConsulte.ts) : l'occasion par défaut est Cocooning.
  { nom: "Cocooning", occasion: "cocooning", workMode: "Présentiel" as WorkMode, dateContext: "Restaurant / date romantique" as DateContext },
];

function trios(styles: StyleId[]): StyleId[][] {
  const r: StyleId[][] = [];
  for (let a = 0; a < styles.length; a++) for (let b = a + 1; b < styles.length; b++) for (let c = b + 1; c < styles.length; c++) r.push([styles[a], styles[b], styles[c]]);
  return r;
}

function mesurer(catalogue: CatalogItem[], genre: "femme" | "homme" | null, styles: StyleId[], temp: number, label: string, ctx: Contexte) {
  // Genre non renseigné (15/11/2026) : la capsule du compte signalé montre des pièces homme, 33 au lieu de 40.
  const profil = genre ? profilAudit({ gender: genre, styles }) : profilAudit({ gender: "femme", styles, patch: { gender: null } });
  const w: Weather = weatherForDay(temp, label, currentSeasonKey(), CHALEUR_HORS_SAISON);
  const capsule = computeDefaultCapsule(profil, w, [], saisonCapsuleDuJour(w.temp), catalogue);
  const pool = composeWardrobePool([], capsule, CAT_KEYS);
  const poolGeneration = composeWardrobePool(pool, capsule, CAT_KEYS, { completerPourOccasion: ctx.occasion, saison: w, exclureHorsOccasion: true, pieceAdaptee: true, genre });
  let echecs = 0;
  const raisons = new Map<string, number>();
  for (let t = 0; t < TIRAGES; t++) {
    const r = genererTenueDiversifiee({ pool: poolGeneration, weather: w, occasion: ctx.occasion, workMode: ctx.workMode, dateContext: ctx.dateContext, preferredHexes: [], gender: genre, morphology: null, colorimetrie: null, recents: [] });
    if (r.noCompleteOutfit || !r.ids.length) {
      echecs++;
      const k = String(r.reason ?? "sans raison");
      raisons.set(k, (raisons.get(k) ?? 0) + 1);
    }
  }
  const parCat = new Map<string, number>();
  for (const p of poolGeneration) parCat.set(p.cat, (parCat.get(p.cat) ?? 0) + 1);
  return { capsule: capsule.length, pool: poolGeneration.length, echecs, raisons, parCat };
}

describe("première tenue d'un compte neuf (dressing vide)", () => {
  it("compose une tenue à partir de la seule capsule", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL / SB_SECRET_KEY absents");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const catalogue = rows
      .filter((r) => !(r as { frozen?: boolean }).frozen)
      .map(rowToCatalogItem)
      .filter((i): i is CatalogItem => !!i);
    assertCatalogueStyles(catalogue);
    console.log(`Catalogue complet (paginé) : ${rows.length} lignes, ${catalogue.length} pièces actives. Saison calendaire : ${currentSeasonKey()}. ${TIRAGES} tirages par cellule.`);

    // 0. LA REQUÊTE EXACTE DE L'APP (fetchVestiaireUniversel, vestiaire.ts) : une seule requête, sans ordre ni pagination. Le plafond de
    // lignes de l'API Supabase (1 000 par défaut) peut la tronquer : on compte ce qu'elle rend, et on rejoue le profil signalé dessus.
    const { data: brut, error: errApp } = await supabase.from("vestiaire_universel").select("*").eq("frozen", false);
    if (errApp) throw errApp;
    const catalogueApp = ((brut ?? []) as VestiaireRow[]).map(rowToCatalogItem).filter((i): i is CatalogItem => !!i);
    console.log(`Requête de l'app : ${brut?.length ?? 0} lignes rendues, ${catalogueApp.length} pièces (contre ${catalogue.length} au complet).`);
    console.log("\n=== Profil signalé, sur le catalogue tel que l'app le reçoit ===");
    for (const [temp, label] of TEMPS)
      for (const ctx of CONTEXTES) {
        const m = mesurer(catalogueApp, "femme", ["classique_chic", "casual_chic", "minimaliste"], temp, label, ctx);
        console.log(`${temp}° ${ctx.nom} : capsule ${m.capsule}, pool ${m.pool}, échecs ${m.echecs}/${TIRAGES}` + (m.raisons.size ? ` (${[...m.raisons].map(([k, n]) => `${k} ×${n}`).join(", ")})` : "") + ` | ${[...m.parCat].map(([c, n]) => `${c} ${n}`).join(", ")}`);
      }

    // 1. Le profil signalé, en détail.
    console.log("\n=== Profil signalé : femme, classique_chic + casual_chic + minimaliste ===");
    for (const [temp, label] of TEMPS)
      for (const ctx of CONTEXTES) {
        const m = mesurer(catalogue, "femme", ["classique_chic", "casual_chic", "minimaliste"], temp, label, ctx);
        console.log(
          `${temp}° ${ctx.nom} : capsule ${m.capsule}, pool ${m.pool}, échecs ${m.echecs}/${TIRAGES}` +
            (m.raisons.size ? ` (${[...m.raisons].map(([k, n]) => `${k} ×${n}`).join(", ")})` : "") +
            ` | ${[...m.parCat].map(([c, n]) => `${c} ${n}`).join(", ")}`,
        );
      }

    // 1 bis. Le même trio, profil SANS GENRE puis HOMME.
    for (const genre of [null, "homme"] as const) {
      console.log(`\n=== Trio signalé, genre ${genre ?? "non renseigné"} ===`);
      for (const [temp, label] of TEMPS)
        for (const ctx of CONTEXTES) {
          const m = mesurer(catalogue, genre, ["classique_chic", "casual_chic", "minimaliste"], temp, label, ctx);
          console.log(`${temp}° ${ctx.nom} : capsule ${m.capsule}, pool ${m.pool}, échecs ${m.echecs}/${TIRAGES}` + (m.raisons.size ? ` (${[...m.raisons].map(([k, n]) => `${k} ×${n}`).join(", ")})` : "") + ` | ${[...m.parCat].map(([c, n]) => `${c} ${n}`).join(", ")}`);
        }
    }

    // 2. Tous les trios, par genre : les cellules en échec seulement.
    for (const [genre, styles] of [["femme", STYLES_FEMME], ["homme", STYLES_HOMME]] as const) {
      let cellules = 0;
      let enEchec = 0;
      console.log(`\n=== ${genre} : trios en échec (au moins un tirage sans tenue) ===`);
      for (const trio of trios(styles))
        for (const [temp, label] of TEMPS)
          for (const ctx of CONTEXTES) {
            cellules++;
            const m = mesurer(catalogue, genre, trio, temp, label, ctx);
            if (m.echecs) {
              enEchec++;
              console.log(`${trio.join(" + ")} · ${temp}° · ${ctx.nom} : ${m.echecs}/${TIRAGES} (capsule ${m.capsule}) ${[...m.raisons].map(([k, n]) => `${k} ×${n}`).join(", ")}`);
            }
          }
      console.log(`${genre} : ${enEchec} cellules en échec sur ${cellules}.`);
    }
  }, 600_000);
});
