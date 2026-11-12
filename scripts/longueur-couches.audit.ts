import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { computeDefaultCapsule } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { vestePlusLongueQueLeManteau } from "../src/lib/forme";
import { generateOutfitWithFallback } from "../src/lib/logic";
import type { StyleId } from "../src/lib/profile";
import type { Item, Longueur, OccasionKey } from "../src/lib/types";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// R-B25, LA LONGUEUR DES COUCHES (12/11/2026, validé : « une veste portée sous un manteau ne doit pas être plus longue que lui »).
// LECTURE SEULE. AGENTS.md : le moteur SANS puis AVEC le levier longueurDesCouches, DANS LA MÊME EXÉCUTION, sur les mêmes capsules,
// météos et occasions. Le seul levier qui varie.
//
// Le catalogue n'a pas de longueur (colonne absente) : les longueurs sont POSÉES par l'audit, en deux scénarios, sur les vestes et les
// manteaux de chaque capsule — jamais écrites nulle part :
//   · « pire cas » : toutes les vestes longues, tous les manteaux courts — la règle s'applique à chaque tenue qui porte les deux ;
//   · « au nom » : longue si le nom dit « long », courte s'il dit « court » / « cropped », sinon inconnue — une hypothèse d'audit,
//     PAS une règle de l'app (forme.ts ne déduit jamais une longueur d'un nom).
// Ce qui est mesuré : les tenues qui portent veste ET manteau, celles où la veste dépasse, les tenues incomplètes, les occasions relâchées.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const TIRAGES = 60;
const PROFILS: { genre: "femme" | "homme"; styles: StyleId[] }[] = [
  { genre: "femme", styles: ["minimaliste"] },
  { genre: "femme", styles: ["boheme", "casual_chic"] },
  { genre: "femme", styles: ["classique_chic"] },
  { genre: "homme", styles: ["classique_chic"] },
];
const TEMPERATURES = [4, 9];
const OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "soiree", "date"];

type Scenario = { nom: string; longueur: (p: Item) => Longueur | undefined };
const SCENARIOS: Scenario[] = [
  { nom: "pire cas", longueur: (p) => (p.cat === "veste" ? "longue" : p.cat === "manteau" ? "courte" : undefined) },
  {
    nom: "au nom",
    longueur: (p) =>
      p.cat !== "veste" && p.cat !== "manteau" ? undefined : /\blong/i.test(p.name) ? "longue" : /\bcourt|cropped/i.test(p.name) ? "courte" : undefined,
  },
];

interface Compte { tenues: number; incompletes: number; relachees: number; vesteEtManteau: number; depasse: number }
const vide = (): Compte => ({ tenues: 0, incompletes: 0, relachees: 0, vesteEtManteau: 0, depasse: 0 });

describe("R-B25 — longueur des couches", () => {
  it("mesure le moteur sans puis avec le levier", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const catalogue = rows.filter((r) => !(r as { frozen?: boolean }).frozen).map(rowToCatalogItem).filter((i): i is CatalogItem => !!i);
    assertCatalogueStyles(catalogue);
    console.log(`\nCatalogue : ${catalogue.length} pièces actives.`);

    const cumul = new Map<string, Compte>();
    for (const scenario of SCENARIOS)
      for (const profil of PROFILS) {
        const profile = profilAudit({ gender: profil.genre, styles: profil.styles });
        for (const temp of TEMPERATURES) {
          const meteo = { season: "Automne / Hiver" as const, temp, label: "Nuageux", seasons: ["Automne / Hiver", "Toutes saisons"] as const };
          const capsule = computeDefaultCapsule(profile, { ...meteo, seasons: [...meteo.seasons] }, [], "Hiver", catalogue);
          const pool: Item[] = capsule.map((p) => ({ ...p, longueur: scenario.longueur(p) }));
          const nbLongueurs = pool.filter((p) => p.longueur).length;
          for (const occasion of OCCASIONS)
            for (const [nom, longueurDesCouches] of [["avant", false], ["avec R-B25", true]] as const) {
              const c = cumul.get(`${scenario.nom}|${nom}`) ?? vide();
              const co = cumul.get(`${scenario.nom}|${nom}|${occasion}`) ?? vide();
              for (let k = 0; k < TIRAGES; k++) {
                const r = generateOutfitWithFallback(pool, { ...meteo, seasons: [...meteo.seasons] }, occasion, "Présentiel", undefined, [], profil.genre, undefined, { sansLongueurDesCouches: !longueurDesCouches });
                c.tenues++;
                co.tenues++;
                if (r.noCompleteOutfit || !r.ids.length) c.incompletes++;
                if (r.occasionRelachee) c.relachees++;
                const portees = r.ids.map((id) => pool.find((p) => p.id === id)).filter((p): p is Item => !!p);
                const manteau = portees.find((p) => p.cat === "manteau");
                const vestes = portees.filter((p) => p.cat === "veste");
                if (manteau && vestes.length) c.vesteEtManteau++;
                if (manteau && vestes.length) co.vesteEtManteau++;
                if (manteau && vestes.some((v) => vestePlusLongueQueLeManteau(v, manteau))) {
                  c.depasse++;
                  co.depasse++;
                }
              }
              cumul.set(`${scenario.nom}|${nom}`, c);
              cumul.set(`${scenario.nom}|${nom}|${occasion}`, co);
            }
          if (scenario.nom === "au nom") console.log(`${profil.genre} ${profil.styles.join("+")} ${temp}° : ${nbLongueurs} longueur(s) posée(s) au nom sur ${pool.filter((p) => p.cat === "veste" || p.cat === "manteau").length} vestes et manteaux`);
        }
      }

    const pct = (a: number, b: number) => `${b ? ((a / b) * 100).toFixed(1) : "—"} %`;
    console.log("\n═══ BILAN (4 profils × 2 températures × 4 occasions × 60 tirages) ═══");
    console.log("scénario · variante | tenues | incomplètes | occasion relâchée | veste + manteau | veste qui dépasse le manteau");
    for (const scenario of SCENARIOS)
      for (const nom of ["avant", "avec R-B25"]) {
        const c = cumul.get(`${scenario.nom}|${nom}`)!;
        console.log(`${`${scenario.nom} · ${nom}`.padEnd(22)} | ${c.tenues} | ${pct(c.incompletes, c.tenues)} | ${pct(c.relachees, c.tenues)} | ${pct(c.vesteEtManteau, c.tenues)} | ${pct(c.depasse, c.tenues)}`);
        console.log(`    par occasion (veste + manteau / dépasse) : ${OCCASIONS.map((o) => { const x = cumul.get(`${scenario.nom}|${nom}|${o}`)!; return `${o} ${pct(x.vesteEtManteau, x.tenues)} / ${pct(x.depasse, x.tenues)}`; }).join(" · ")}`);
      }
  }, 1_800_000);
});
