import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CATALOG, type CatalogItem } from "../src/lib/catalog";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { colorimetrieDeSaison, SAISONS_CLES, type SaisonCle } from "../src/lib/colorimetrie";
import { accordVisage, colorimetrieMoteur, estPresDuVisage, teinteDe, type ColorimetrieMoteur } from "../src/lib/colorimetrieMoteur";
import { OCCASIONS, PALETTE } from "../src/lib/data";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { PAL_COULEURS } from "../src/lib/palCouleurs";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// COLORIMÉTRIE DANS LE MOTEUR — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE.
//
// Levier étudié : le paramètre `colorimetrie` de generateOutfitWithFallback
// (30/09/2026). Tout le reste est gelé : même pool, mêmes occasions, même
// météo représentative, même préférence de palette, et MÊME GRAINE pour les
// deux bras de chaque tirage — seul le paramètre change (AGENTS.md, points 1
// à 3). Le bras « avant » omet le paramètre, ce qui reproduit le comportement
// d'origine sans dupliquer le pipeline.
//
// Deux scénarios, jamais extrapolés l'un à l'autre (point 4) :
//   A · capsule par défaut (dressing vide) — catalogue Supabase si les
//       variables sont là, sinon le catalogue de repli (catalog.ts), et le
//       rapport le dit en tête ;
//   B · un dressing réel synthétique, aux couleurs de la palette du dressing.
//
// Deux préférences de palette : aucune, et « Noir, Marine, Camel » — qui
// contient une couleur « avec modération » pour trois saisons sur quatre, le
// cas où colorimétrie et goûts se contredisent.
//
// Trois bras par tirage : « avant » (sans colorimétrie), « union » (la règle
// retenue) et « palier » (la première version, levier `strategie`).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const TIRAGES = 40;
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const pal = (n: string) => PAL_COULEURS.find(([x]) => x === n)![1];
const PREFS: Record<string, string[]> = { aucune: [], "Noir+Marine+Camel": [pal("Noir"), pal("Marine"), pal("Camel")] };

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const graine = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "—").padStart(5) + " %";

interface Compte {
  tenues: number;
  vides: number;
  moderationVisage: number;
  principalHarmonie: number;
  moderationAilleurs: number;
  accord: number;
  prefPresente: number;
  distinctes: Set<string>;
}
const vide = (): Compte => ({ tenues: 0, vides: 0, moderationVisage: 0, principalHarmonie: 0, moderationAilleurs: 0, accord: 0, prefPresente: 0, distinctes: new Set() });

function compter(c: Compte, ids: number[], pool: Item[], colo: ColorimetrieMoteur, prefs: string[], videe: boolean) {
  if (videe) { c.vides++; return; }
  const pieces = ids.map((i) => pool.find((p) => p.id === i)).filter((p): p is Item => Boolean(p));
  c.tenues++;
  c.distinctes.add([...ids].sort((a, b) => a - b).join(","));
  const t = (p: Item) => teinteDe(p);
  if (pieces.some((p) => estPresDuVisage(p) && t(p) && colo.loinDuVisage.has(t(p)!))) c.moderationVisage++;
  const principal = pieces.find((p) => ["haut", "robe", "combinaison"].includes(p.cat));
  if (principal && t(principal) && colo.harmonie.has(t(principal)!)) c.principalHarmonie++;
  if (pieces.some((p) => !estPresDuVisage(p) && t(p) && colo.loinDuVisage.has(t(p)!))) c.moderationAilleurs++;
  if (accordVisage(pieces, colo)) c.accord++;
  if (prefs.length && pieces.some((p) => prefs.includes(p.hex))) c.prefPresente++;
}

function mesurer(nom: string, pools: { cle: string; pool: Item[] }[]) {
  console.log(`\n════════ ${nom} ════════`);
  console.log("saison      préférence          bras   tenues  vides  modér.visage  principal∈saison  modér.ailleurs  R-S18   préf.présente  distinctes");
  for (const saison of SAISONS_CLES as SaisonCle[]) {
    const colo = colorimetrieMoteur(colorimetrieDeSaison(saison, "questionnaire"))!;
    for (const [nomPref, prefs] of Object.entries(PREFS)) {
      const avant = vide();
      const apres = vide();
      const paliers = vide();
      const coloPaliers: ColorimetrieMoteur = { ...colo, strategie: "paliers" };
      for (const { cle, pool } of pools) {
        const saisonCap = CAPSULE_SEASONS.find((s) => cle.startsWith(s)) ?? "Automne";
        const w = representativeWeatherFor(saisonCap);
        for (const occ of OCCS) {
          for (let k = 0; k < TIRAGES; k++) {
            const g = graine(`${cle}|${occ}|${k}`);
            const vrai = Math.random;
            try {
              Math.random = mulberry32(g);
              const a = generateOutfitWithFallback(pool, w, occ, "Présentiel", "Verre", prefs, "femme", saisonCap);
              Math.random = mulberry32(g);
              const b = generateOutfitWithFallback(pool, w, occ, "Présentiel", "Verre", prefs, "femme", saisonCap, undefined, colo);
              Math.random = mulberry32(g);
              const c = generateOutfitWithFallback(pool, w, occ, "Présentiel", "Verre", prefs, "femme", saisonCap, undefined, coloPaliers);
              compter(avant, a.ids, pool, colo, prefs, a.noCompleteOutfit);
              compter(apres, b.ids, pool, colo, prefs, b.noCompleteOutfit);
              compter(paliers, c.ids, pool, colo, prefs, c.noCompleteOutfit);
            } finally {
              Math.random = vrai;
            }
          }
        }
      }
      for (const [bras, c] of [["avant", avant], ["union", apres], ["palier", paliers]] as const) {
        console.log(
          `${saison.padEnd(11)} ${nomPref.padEnd(19)} ${bras.padEnd(6)} ${String(c.tenues).padStart(6)} ${String(c.vides).padStart(6)}  ${pct(c.moderationVisage, c.tenues)}      ${pct(c.principalHarmonie, c.tenues)}          ${pct(c.moderationAilleurs, c.tenues)}   ${pct(c.accord, c.tenues)}  ${prefs.length ? pct(c.prefPresente, c.tenues) : "   —   "}      ${c.distinctes.size}`
        );
      }
    }
  }
}

/** Un dressing plausible, aux couleurs de la palette du dressing (AddScreen). */
function dressingSynthetique(): Item[] {
  let id = 0;
  const hex = (n: string) => PALETTE.find(([x]) => x === n)?.[1] ?? "#999999";
  const p = (cat: CategoryKey, couleur: string, nom: string, over: Partial<Item> = {}): Item =>
    ({ id: ++id, name: nom, cat, color: couleur, hex: hex(couleur), season: "Toutes saisons", worn: null, ...over }) as Item;
  return [
    ...["Blanc", "Noir", "Marine", "Camel", "Rose poudré", "Gris", "Terracotta", "Bleu ciel", "Kaki"].map((c) => p("haut", c, `T-shirt ${c}`, { subtype: "T-shirt" })),
    ...["Blanc cassé", "Noir"].map((c) => p("haut", c, `Chemise ${c}`, { subtype: "Chemise" })),
    ...["Crème", "Gris anthracite", "Bordeaux", "Moutarde"].map((c) => p("pull", c, `Pull ${c}`)),
    ...["Noir", "Rouille", "Marine"].map((c) => p("robe", c, `Robe ${c}`)),
    ...["Noir", "Camel"].map((c) => p("veste", c, `Blazer ${c}`)),
    p("manteau", "Sable", "Trench"),
    ...["Noir", "Denim", "Taupe", "Crème"].map((c) => p(c === "Denim" ? "jean" : "pantalon", c, `Pantalon ${c}`)),
    p("jupe", "Noir", "Jupe midi"),
    p("chaussures", "Noir", "Mocassins", { shoeType: "Mocassins" }),
    p("chaussures", "Blanc", "Baskets", { shoeType: "Baskets" }),
    p("chaussures", "Camel", "Bottines", { shoeType: "Bottines" }),
    p("chaussures", "Noir", "Escarpins", { shoeType: "Escarpins" }),
    p("sac", "Noir", "Sac cabas", { sacType: "Cabas" }),
    p("sac", "Camel", "Sac bandoulière", { sacType: "Bandoulière" }),
    p("bijou", "Doré", "Collier doré", { hex: "#C9A24B", metalDominant: "or" }),
    p("bijou", "Argenté", "Collier argenté", { hex: "#B9BEC4", metalDominant: "argent" }),
    p("accessoire", "Rose poudré", "Foulard en soie", { accessoireType: "Foulard" }),
    p("accessoire", "Noir", "Écharpe", { accessoireType: "Écharpe" }),
  ];
}

describe("colorimétrie dans le moteur", () => {
  it("mesure les deux bras dans la même exécution, sur les mêmes tirages", async () => {
    let catalogue: CatalogItem[] = CATALOG;
    let source = "catalogue de REPLI (catalog.ts, sans styles) — Supabase non joignable ou non configuré";
    let parStyle = false;
    if (SUPABASE_URL && SERVICE_ROLE_KEY) {
      try {
        const { data, error } = await createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
          .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
        if (!error && data?.length) {
          catalogue = data
            .filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
            .map(rowToCatalogItem)
            .filter((it): it is CatalogItem => Boolean(it));
          assertCatalogueStyles(catalogue, STYLES_FEMME);
          source = `vestiaire_universel (${catalogue.length} pièces)`;
          parStyle = true;
        }
      } catch {
        /* repli ci-dessous, annoncé */
      }
    }
    console.log(`\nSource du scénario A : ${source}`);
    const inconnues = catalogue.filter((i) => estPresDuVisage(i) && teinteDe(i) === null).length;
    console.log(`Pièces du visage dont la teinte n'est pas lisible (aucun effet sur elles) : ${inconnues} / ${catalogue.filter(estPresDuVisage).length}`);

    const capsules: { cle: string; pool: Item[] }[] = [];
    for (const saison of CAPSULE_SEASONS) {
      const styles = parStyle ? STYLES_FEMME.map((s) => [s] as string[]) : [null];
      for (const st of styles) {
        const profil = profilAudit({ gender: "femme", styles: st });
        capsules.push({ cle: `${saison}|${st?.[0] ?? "sans-style"}`, pool: computeDefaultCapsule(profil, representativeWeatherFor(saison), [], saison, catalogue) });
      }
    }
    mesurer(`A · CAPSULE PAR DÉFAUT — ${capsules.length} capsules × ${OCCS.length} occasions × ${TIRAGES} tirages`, capsules);
    const d = dressingSynthetique();
    mesurer(`B · DRESSING SYNTHÉTIQUE (${d.length} pièces) — 4 saisons de capsule × ${OCCS.length} occasions × ${TIRAGES} tirages`,
      CAPSULE_SEASONS.map((s) => ({ cle: `${s}|dressing`, pool: d })));
  });
});
