import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, contexteCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { ECART_FORT, evaluerAlerteMeteo, proposerAdaptation } from "../src/lib/alerteMeteo";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

/*
 * AUDIT DE L'ALERTE MÉTÉO D'UN LOOK PLANIFIÉ ET DE SON ADAPTATION (12/10/2026) — LECTURE SEULE.
 *
 * CONFIGURATION GELÉE (règle d'audit, points 1 à 4) :
 *   · pool = le VRAI catalogue vestiaire_universel (hors pièces gelées), lu avec la clé de service, rien n'est écrit ;
 *   · « le dressing » = les capsules par défaut des quatre saisons réunies. CE N'EST PAS UN DRESSING RÉEL : aucun dressing d'utilisatrice
 *     n'est lu (et la table dressing_items ne porte aucune borne de température). Toute conclusion vaut pour des pièces du CATALOGUE ;
 *   · looks = generateOutfitWithFallback sur la capsule de la saison du plan, composée à la température représentative de cette saison ;
 *   · le look est ensuite JUGÉ à une température de plan qui diffère de celle de sa construction (l'écart simule une prévision qui
 *     s'éloigne de la saison) ;
 *   · leviers : température du plan, saison, occasion. Fixes : profil (femme, un style), 40 tirages par cellule, graine non fixée —
 *     mais chaque cellule agrège 40 looks, la lecture est un taux, pas un cas.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
// Écarts entre la température du plan et celle à laquelle le look a été construit (celle de la saison de sa capsule).
const ECARTS = [-12, -8, -5, -3, 0, 3, 5, 8, 12];
const OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "soiree"];
const TIRAGES = 40;

describe("alerte météo et adaptation — mesure sur le catalogue réel", () => {
  it("mesure la couverture des bornes, la fréquence des alertes et la qualité des adaptations", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const profil = profilAudit({ gender: "femme", styles: [STYLES_FEMME[0]] });
    void VESTIAIRE_ID_OFFSET;

    // ═══ 1 · COUVERTURE DES BORNES (catalogue) ═══════════════════════════
    console.log(`\n════════ 1 · COUVERTURE DES BORNES DE TEMPÉRATURE — ${pool.length} pièces du catalogue ════════`);
    const avec = (it: Item) => it.meteoMinTemp != null || it.meteoMaxTemp != null;
    const parCat = new Map<string, { n: number; min: number; max: number; any: number }>();
    for (const it of pool) {
      const c = parCat.get(it.cat) ?? { n: 0, min: 0, max: 0, any: 0 };
      c.n++;
      if (it.meteoMinTemp != null) c.min++;
      if (it.meteoMaxTemp != null) c.max++;
      if (avec(it)) c.any++;
      parCat.set(it.cat, c);
    }
    const tot = pool.filter(avec).length;
    console.log(`  Au moins une borne : ${tot} / ${pool.length} (${((100 * tot) / pool.length).toFixed(1)} %) — min ${pool.filter((i) => i.meteoMinTemp != null).length}, max ${pool.filter((i) => i.meteoMaxTemp != null).length}`);
    for (const [cat, c] of [...parCat].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${cat.padEnd(14)} ${String(c.n).padStart(4)}  bornées ${String(c.any).padStart(4)} (${((100 * c.any) / c.n).toFixed(0)} %)`);

    // ═══ 2 · ALERTES ET ADAPTATIONS PAR TEMPÉRATURE ══════════════════════
    console.log(`\n════════ 2 · LOOKS DE CAPSULE JUGÉS À UNE TEMPÉRATURE DE PLAN (${TIRAGES} tirages × saison × occasion ; l'écart est celui entre la température du plan et celle de construction du look) ════════`);
    console.log(`  seuil fort : ${ECART_FORT} °C ; « dressing » = les quatre capsules réunies (NON un dressing réel)`);
    const dressing: Item[] = [];
    const vus = new Set<number>();
    const capsules = new Map<CapsuleSeason, Item[]>();
    for (const s of CAPSULE_SEASONS) {
      const c = computeDefaultCapsule(profil, representativeWeatherFor(s), [], s, pool);
      capsules.set(s, c);
      for (const it of c) if (!vus.has(it.id)) { vus.add(it.id); dressing.push(it); }
    }
    console.log(`  dressing de test : ${dressing.length} pièces, dont ${dressing.filter(avec).length} avec borne`);

    type Cellule = { ecarts: number[]; ecartsFormalite: number[]; n: number; legere: number; forte: number; proposees: number; resolues: number; changements: number; gardeesAltereesCount: number; horsBorneCount: number; pieceAutreSaison: number };
    const mesurer = (nomDressing: string, dressingDe: (saison: CapsuleSeason) => Item[]) => {
      const parEcart = new Map<number, Cellule>();
      for (const e of ECARTS) parEcart.set(e, { ecarts: [], ecartsFormalite: [], n: 0, legere: 0, forte: 0, proposees: 0, resolues: 0, changements: 0, gardeesAltereesCount: 0, horsBorneCount: 0, pieceAutreSaison: 0 });
      for (const saison of CAPSULE_SEASONS) {
        const capsule = capsules.get(saison)!;
        const meteoBase = representativeWeatherFor(saison);
        const contexte = contexteCapsule(saison);
        const leDressing = dressingDe(saison);
        for (const occasion of OCCASIONS) {
          for (let k = 0; k < TIRAGES; k++) {
            const r = generateOutfitWithFallback(capsule, meteoBase, occasion, "Présentiel", "Verre", [], "femme", saison);
            const pieces = r.ids.map((id) => capsule.find((i) => i.id === id)).filter((i): i is Item => !!i);
            if (!pieces.length) continue;
            for (const e of ECARTS) {
              const T = meteoBase.temp + e;
              const c = parEcart.get(e)!;
              c.n++;
              const meteo = { temp: T, label: T >= 24 ? "Ensoleillé" : "Nuageux" };
              const a = evaluerAlerteMeteo(pieces, meteo, { ville: "Test", moment: "Soirée" });
              if (!a) continue;
              if (a.niveau === "forte") c.forte++; else c.legere++;
              c.ecarts.push(a.ecart);
              const p = proposerAdaptation({ pieces, dressing: leDressing, meteo, occasion, contexte });
              if (!p) continue;
              c.proposees++;
              if (p.resolu) c.resolues++;
              c.changements += p.changements.length;
              const touchees = new Set(p.changements.flatMap((x) => [x.remplace?.id]).filter((x): x is number => x != null));
              // INVARIANT : toute pièce qui n'est pas remplacée est restée dans le look.
              for (const piece of pieces) if (!touchees.has(piece.id) && !p.ids.includes(piece.id)) c.gardeesAltereesCount++;
              // INVARIANT : une pièce ajoutée ou remplaçante qui porte une borne la respecte à la température du plan.
              for (const ch of p.changements) {
                const q = ch.piece;
                if (ch.remplace && q.niveauFormalite != null && ch.remplace.niveauFormalite != null) c.ecartsFormalite.push(Math.abs(q.niveauFormalite - ch.remplace.niveauFormalite));
                if ((q.meteoMinTemp != null && T < q.meteoMinTemp) || (q.meteoMaxTemp != null && T > q.meteoMaxTemp)) c.horsBorneCount++;
                if (!contexte.seasons.includes(q.season) && q.season !== "Toutes saisons" && !q.saisons?.some((s) => contexte.saisons?.includes(s))) c.pieceAutreSaison++;
              }
            }
          }
        }
      }
      histogramme(parEcart, nomDressing.slice(0, 1));
      console.log(`\n  ── ${nomDressing} ──`);
      console.log(`  écart | looks | alerte légère | alerte forte | adaptation proposée | résolue | changements/prop. | gardées altérées | hors borne | autre saison`);
      const pct = (x: number, s: number) => (s ? `${((100 * x) / s).toFixed(0)} %` : "—");
      for (const e of ECARTS) {
        const c = parEcart.get(e)!;
        const alertes = c.legere + c.forte;
        console.log(
          `  ${(e > 0 ? "+" : "") + e}`.padEnd(8) + `| ${String(c.n).padStart(5)} | ${pct(c.legere, c.n).padStart(13)} | ${pct(c.forte, c.n).padStart(12)} | ${pct(c.proposees, alertes).padStart(19)} | ${pct(c.resolues, c.proposees).padStart(7)} | ${(c.proposees ? c.changements / c.proposees : 0).toFixed(1).padStart(17)} | ${String(c.gardeesAltereesCount).padStart(16)} | ${String(c.horsBorneCount).padStart(10)} | ${String(c.pieceAutreSaison).padStart(12)}`
        );
      }
    };
    const histogramme = (parEcart: Map<number, Cellule>, nom: string) => {
      const tous = [...parEcart.values()].flatMap((c) => c.ecarts);
      const f = [...parEcart.values()].flatMap((c) => c.ecartsFormalite);
      const part = (xs: number[], pred: (x: number) => boolean) => (xs.length ? `${((100 * xs.filter(pred).length) / xs.length).toFixed(0)} %` : "—");
      console.log(`  ${nom} : ${tous.length} alertes — écart avec la borne : <= 1 °C ${part(tous, (x) => x <= 1)} ; <= 2 °C ${part(tous, (x) => x <= 2)} ; <= 3 °C ${part(tous, (x) => x <= 3)} ; >= 5 °C ${part(tous, (x) => x >= 5)}`);
      console.log(`  ${nom} : ${f.length} remplacements avec formalité connue — écart de formalité 0 : ${part(f, (x) => x === 0)} ; >= 2 : ${part(f, (x) => x >= 2)} ; >= 3 : ${part(f, (x) => x >= 3)}`);
    };
    mesurer("A · dressing = les quatre capsules réunies (riche, 62 pièces)", () => dressing);
    mesurer("B · dressing = la seule capsule de la saison du plan (pauvre : aucune pièce plus chaude ou plus légère hors de cette saison)", (saison) => capsules.get(saison)!);
    console.log(`\n  Lecture : la colonne « adaptation proposée » est rapportée aux looks en alerte ; « résolue » aux adaptations proposées.`);
  });
});
