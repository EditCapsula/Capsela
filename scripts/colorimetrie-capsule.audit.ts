import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { CatalogItem } from "../src/lib/catalog";
import { CAPSULE_SEASONS, STRATEGIE_PRODUCTION, computeDefaultCapsule, representativeWeatherFor, type SelectionStrategy } from "../src/lib/capsule";
import { colorimetrieDeSaison, SAISONS_CLES, type SaisonCle } from "../src/lib/colorimetrie";
import { colorimetrieMoteur } from "../src/lib/colorimetrieMoteur";
import { OCCASIONS } from "../src/lib/data";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { PAL_COULEURS } from "../src/lib/palCouleurs";
import { estDansLUnivers } from "../src/lib/univers";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, STYLES_HOMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LA SAISON COLORIMÉTRIQUE DANS LA CAPSULE — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE. (15/11/2026, question de la propriétaire :
// « pourquoi la capsule ne s'adapte pas à ma colorimétrie ? »)
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : le catalogue réel complet (paginé, pièces gelées écartées), la météo représentative de
// chaque saison de capsule, aucun dressing, aucune exclusion, aucune morphologie, un style à la fois.
// LEVIER ÉTUDIÉ (point 2) : SelectionStrategy.colorimetrieCapsule — trois bras, sur le même profil et le même pool :
//   avant         la production (la capsule ne lit pas la saison colorimétrique) ;
//   apres_occasions la palette entre au classement juste après la couverture des occasions (le plus fort) ;
//   apres_basique la palette de la saison entre au classement juste après « basique » ;
//   departage     la palette ne départage qu'en dernier, avant l'id.
// FIXES : genre (femme, homme), style, saison de capsule, saison colorimétrique, couleurs préférées (aucune, puis « Noir, Marine,
// Camel », le cas où goûts et saison se contredisent). Tous les bras d'une cellule partagent ces fixes (point 3).
//
// Mesures par cellule : taille de la capsule ; part des VÊTEMENTS de la capsule dans la palette de la saison (signature + neutres) ;
// pièces changées par rapport à « avant » ; occasions sans tenue possible (le moteur des tenues, avec la colorimétrie comme en
// production, sur la seule capsule). Aucune conclusion n'est extrapolée d'un genre ou d'un jeu de préférences à l'autre (point 4).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const VETEMENTS: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "robe", "veste", "manteau", "short", "combinaison"] as CategoryKey[];
const hex = (n: string) => PAL_COULEURS.find(([x]) => x === n)![1];
const PREFERENCES: [string, string[]][] = [
  ["aucune", []],
  ["Noir, Marine, Camel", [hex("Noir"), hex("Marine"), hex("Camel")]],
];
const BRAS: [string, SelectionStrategy][] = [
  ["avant", STRATEGIE_PRODUCTION],
  ["apres_occasions", { ...STRATEGIE_PRODUCTION, colorimetrieCapsule: "apres_occasions" }],
  ["apres_basique", { ...STRATEGIE_PRODUCTION, colorimetrieCapsule: "apres_basique" }],
  ["departage", { ...STRATEGIE_PRODUCTION, colorimetrieCapsule: "departage" }],
];

interface Cumul { cellules: number; taille: number; vetements: number; dansPalette: number; changees: number; occImpossibles: number; capsulesAvecImpossible: number }
const vide = (): Cumul => ({ cellules: 0, taille: 0, vetements: 0, dansPalette: 0, changees: 0, occImpossibles: 0, capsulesAvecImpossible: 0 });
const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : "0.0") + " %";

describe("saison colorimétrique dans la capsule", () => {
  it("mesure avant / après dans la même exécution", { timeout: 3_600_000 }, async () => {
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
    console.log(`Catalogue : ${rows.length} lignes, ${catalogue.length} pièces actives.`);

    // Le catalogue a-t-il seulement les couleurs des saisons ? Une palette absente du catalogue ne peut rien changer.
    console.log("\n=== Pièces du catalogue dans la palette de chaque saison (signature + neutres) ===");
    for (const s of SAISONS_CLES) {
      const c = colorimetrieDeSaison(s, "questionnaire");
      const h = new Set([...(c.signature ?? []), ...(c.neutres ?? [])]);
      for (const g of ["femme", "homme"] as const) {
        const duGenre = catalogue.filter((it) => estDansLUnivers(it, g));
        const n = duGenre.filter((it) => h.has(it.hex)).length;
        console.log(`${c.libelle} · ${g} : ${n} / ${duGenre.length} (${pct(n, duGenre.length)})`);
      }
    }

    for (const g of ["femme", "homme"] as const) {
      const styles = g === "femme" ? STYLES_FEMME : STYLES_HOMME;
      for (const [nomPref, prefs] of PREFERENCES) {
        const cumuls = new Map(BRAS.map(([b]) => [b, vide()]));
        const parSaisonColo = new Map<SaisonCle, Map<string, Cumul>>();
        const detail: string[] = [];
        for (const sc of SAISONS_CLES) {
          const coloProfil = colorimetrieDeSaison(sc, "questionnaire");
          const coloMoteur = colorimetrieMoteur(coloProfil);
          const hexSaison = new Set([...(coloProfil.signature ?? []), ...(coloProfil.neutres ?? [])]);
          const parBras = new Map(BRAS.map(([b]) => [b, vide()]));
          parSaisonColo.set(sc, parBras);
          for (const style of styles)
            for (const saisonCap of CAPSULE_SEASONS) {
              const profil = profilAudit({ gender: g, styles: [style], patch: { colorimetrie: coloProfil, paletteCouleurs: prefs } });
              const w = representativeWeatherFor(saisonCap);
              let idsAvant: Set<number> | null = null;
              const ligne: string[] = [];
              for (const [nomBras, strat] of BRAS) {
                const cap = computeDefaultCapsule(profil, w, [], saisonCap, catalogue, strat);
                const vet = cap.filter((it) => VETEMENTS.includes(it.cat));
                const dans = vet.filter((it) => hexSaison.has(it.hex)).length;
                const ids = new Set(cap.map((it) => it.id));
                if (!idsAvant) idsAvant = ids;
                const changees = [...ids].filter((id) => !idsAvant!.has(id)).length;
                let impossibles = 0;
                for (const occ of OCCS) {
                  const r = generateOutfitWithFallback(cap, w, occ, "Présentiel", "Verre", prefs, g, saisonCap, undefined, coloMoteur);
                  if (r.noCompleteOutfit || !r.ids.length) impossibles++;
                }
                for (const c of [cumuls.get(nomBras)!, parBras.get(nomBras)!]) {
                  c.cellules++;
                  c.taille += cap.length;
                  c.vetements += vet.length;
                  c.dansPalette += dans;
                  c.changees += changees;
                  c.occImpossibles += impossibles;
                  if (impossibles) c.capsulesAvecImpossible++;
                }
                ligne.push(`${nomBras} ${cap.length} p., ${pct(dans, vet.length)} palette, ${changees} chg, ${impossibles} occ. imp.`);
              }
              detail.push(`${coloProfil.libelle} | ${style} | ${saisonCap} : ${ligne.join(" · ")}`);
            }
        }
        console.log(`\n=== ${g.toUpperCase()} · préférences : ${nomPref} — ${styles.length} styles × 4 saisons de capsule × 4 saisons colorimétriques ===`);
        for (const [b, c] of cumuls)
          console.log(
            `${b.padEnd(16)} capsule moy. ${(c.taille / c.cellules).toFixed(1)} p. · vêtements dans la palette ${pct(c.dansPalette, c.vetements)} · pièces changées moy. ${(c.changees / c.cellules).toFixed(1)} · occasions impossibles ${c.occImpossibles} (capsules touchées ${c.capsulesAvecImpossible}/${c.cellules})`,
          );
        console.log("Par saison colorimétrique (vêtements dans la palette : avant → apres_occasions → apres_basique → departage) :");
        for (const [sc, m] of parSaisonColo) {
          const v = (b: string) => pct(m.get(b)!.dansPalette, m.get(b)!.vetements);
          const imp = (b: string) => m.get(b)!.occImpossibles;
          console.log(`  ${sc.padEnd(10)} ${v("avant")} → ${v("apres_occasions")} → ${v("apres_basique")} → ${v("departage")} · occ. impossibles ${imp("avant")} → ${imp("apres_occasions")} → ${imp("apres_basique")} → ${imp("departage")}`);
        }
        console.log("Détail :");
        for (const l of detail) console.log("  " + l);
      }
    }
  });
});
