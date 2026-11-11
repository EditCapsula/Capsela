import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { formalityOf } from "../src/lib/attributes";
import { computeDefaultCapsule, representativeWeatherFor, styleFit } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { CLOTHING_CATS, generateOutfitWithFallback } from "../src/lib/logic";
import { STYLE_ID_TO_CATALOG_LABEL, type StyleId } from "../src/lib/profile";
import type { CapsuleSeason, DateContext, OccasionKey, WorkMode } from "../src/lib/types";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { STYLES_FEMME, STYLES_HOMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// TROIS STYLES AU LIEU DE DEUX (11/11/2026, demandé : « j'aimerais que l'on puisse choisir 3 styles au lieu de 2 »). LECTURE SEULE.
//
// Le plafond de deux styles (05/10/2026) reposait sur une crainte NON DÉMONTRÉE : une capsule d'une trentaine de pièces se diluerait
// entre trois styles. Mesure (AGENTS.md : même exécution, même catalogue, un seul levier — le troisième style) : pour chaque trio de
// styles {A, B, C} d'un genre, la capsule [A, B] puis la capsule [A, B, C], aux quatre saisons.
//   · taille de la capsule (hors bloc Sport, formalité 0, ajouté sans borne) ;
//   · part des vêtements de chaque style choisi — la plus petite dit si un style disparaît ;
//   · pièces de [A, B] qui sortent de la capsule quand C entre ;
//   · tenues : taux de tenue, palier de formalité atteint, tenues distinctes sur les tirages, par occasion.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const TIRAGES = 8;

interface Contexte { nom: string; occasion: OccasionKey; workMode?: WorkMode; dateContext?: DateContext }
const CONTEXTES: Contexte[] = [
  { nom: "Quotidien", occasion: "quotidien" },
  { nom: "Travail présentiel", occasion: "travail_formel", workMode: "Présentiel" },
  { nom: "Soirée", occasion: "soiree" },
  { nom: "RDV restaurant", occasion: "date", dateContext: "Restaurant / date romantique" },
  { nom: "Événement", occasion: "evenement_perso" },
  { nom: "Voyage", occasion: "voyage" },
];

const pct = (n: number, t: number) => (t ? `${((n / t) * 100).toFixed(1)} %` : "—");
const moy = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function trios<T>(xs: readonly T[]): [T, T, T][] {
  const out: [T, T, T][] = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) for (let k = j + 1; k < xs.length; k++) out.push([xs[i], xs[j], xs[k]]);
  return out;
}

interface Mesure { taille: number[]; partMin: number[]; sorties: number[]; ctx: Map<string, { ok: number; palier: number; total: number; distinctes: number; series: number }> }
const mesureVide = (): Mesure => ({ taille: [], partMin: [], sorties: [], ctx: new Map() });

describe("trois styles au lieu de deux", () => {
  it("compare les capsules [A, B] et [A, B, C] sur le même catalogue", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const catalogue = rows
      .filter((r) => !(r as { frozen?: boolean }).frozen)
      .map(rowToCatalogItem)
      .filter((i): i is CatalogItem => !!i);
    assertCatalogueStyles(catalogue);
    console.log(`\nCatalogue : ${catalogue.length} pièces actives.`);

    for (const [genre, styles] of [["femme", STYLES_FEMME], ["homme", STYLES_HOMME]] as const) {
      const lesTrios = trios(styles);
      const deux = mesureVide();
      const trois = mesureVide();
      let pire = { part: 1, libelle: "" };
      const parTrio: string[] = [];

      for (const trio of lesTrios) {
        const libelles = trio.map((s) => STYLE_ID_TO_CATALOG_LABEL[s as StyleId]);
        const tailles2: number[] = [];
        const tailles3: number[] = [];
        const parts3: number[] = [];
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          const variantes: [Mesure, StyleId[]][] = [
            [deux, trio.slice(0, 2) as StyleId[]],
            [trois, [...trio] as StyleId[]],
          ];
          const capsules: CatalogItem[][] = [];
          for (const [m, choisis] of variantes) {
            const capsule = computeDefaultCapsule(profilAudit({ gender: genre, styles: choisis }), w, [], saison, catalogue);
            capsules.push(capsule);
            const horsSport = capsule.filter((p) => formalityOf(p) !== 0);
            m.taille.push(horsSport.length);
            (choisis.length === 2 ? tailles2 : tailles3).push(horsSport.length);
            // Part des vêtements de chaque style choisi (une pièce multi-style compte pour chacun de ses styles).
            const vetements = horsSport.filter((p) => CLOTHING_CATS.includes(p.cat));
            const parts = choisis.map((s) => (vetements.length ? vetements.filter((p) => styleFit(p, STYLE_ID_TO_CATALOG_LABEL[s])).length / vetements.length : 0));
            const partMin = Math.min(...parts);
            m.partMin.push(partMin);
            if (choisis.length === 3) {
              parts3.push(partMin);
              if (partMin < pire.part) pire = { part: partMin, libelle: `${libelles.join(" + ")} · ${saison} · parts ${parts.map((x) => pct(x, 1)).join(" / ")}` };
            }
            const parId = new Map(capsule.map((p) => [p.id, p]));
            for (const ctx of CONTEXTES) {
              const c = m.ctx.get(ctx.nom) ?? { ok: 0, palier: 0, total: 0, distinctes: 0, series: 0 };
              const vues = new Set<string>();
              for (let k = 0; k < TIRAGES; k++) {
                const res = generateOutfitWithFallback(capsule, w, ctx.occasion, ctx.workMode ?? "Présentiel", ctx.dateContext ?? "Verre", [], genre, saison);
                c.total++;
                if (!res.ids.length) continue;
                c.ok++;
                if (!res.formalityDowngraded) c.palier++;
                vues.add(res.ids.filter((id) => parId.has(id)).sort((a, b) => a - b).join(","));
              }
              c.distinctes += vues.size;
              c.series++;
              m.ctx.set(ctx.nom, c);
            }
          }
          const ids3 = new Set(capsules[1].map((p) => p.id));
          trois.sorties.push(capsules[0].filter((p) => formalityOf(p) !== 0 && !ids3.has(p.id)).length);
        }
        parTrio.push(`  ${libelles.join(" + ").padEnd(52)} taille ${moy(tailles2).toFixed(1)} → ${moy(tailles3).toFixed(1)} · part du style le moins présent (3 styles) ${pct(moy(parts3), 1)}`);
      }

      console.log(`\n══════ ${genre.toUpperCase()} — ${lesTrios.length} trios × ${SAISONS.length} saisons (A, B : les deux premiers, C : le troisième) ══════`);
      console.log(`  Taille hors Sport, moyenne : 2 styles ${moy(deux.taille).toFixed(1)} · 3 styles ${moy(trois.taille).toFixed(1)} (max ${Math.max(...deux.taille)} / ${Math.max(...trois.taille)})`);
      console.log(`  Part du style le moins présent dans les vêtements, moyenne : 2 styles ${pct(moy(deux.partMin), 1)} · 3 styles ${pct(moy(trois.partMin), 1)}`);
      console.log(`  Capsules à 3 styles où un style pèse moins de 15 % des vêtements : ${trois.partMin.filter((x) => x < 0.15).length} / ${trois.partMin.length} ; à 0 % : ${trois.partMin.filter((x) => x === 0).length}`);
      console.log(`  Pire cas : ${pire.libelle}`);
      console.log(`  Pièces de [A, B] sorties de la capsule quand C entre, moyenne : ${moy(trois.sorties).toFixed(1)}`);
      console.log(`\n  ${"occasion".padEnd(20)} ${"2 styles".padEnd(48)} 3 styles`);
      for (const ctx of CONTEXTES) {
        const cell = (m: Mesure) => {
          const c = m.ctx.get(ctx.nom)!;
          return `tenue ${pct(c.ok, c.total)} · palier ${pct(c.palier, c.ok)} · distinctes ${(c.distinctes / c.series).toFixed(1)}/${TIRAGES}`;
        };
        console.log(`  ${ctx.nom.padEnd(20)} ${cell(deux).padEnd(48)} ${cell(trois)}`);
      }
      console.log(`\n  Par trio (moyenne des saisons) :`);
      for (const l of parTrio) console.log(l);
    }
  }, 600_000);
});
