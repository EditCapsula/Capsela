import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { CatalogItem } from "../src/lib/catalog";
import { CAPSULE_SEASONS, STRATEGIE_PRODUCTION, computeDefaultCapsule, representativeWeatherFor, type SelectionStrategy } from "../src/lib/capsule";
import { colorimetrieDeSaison, SAISONS_CLES } from "../src/lib/colorimetrie";
import { colorimetrieMoteur } from "../src/lib/colorimetrieMoteur";
import { OCCASIONS } from "../src/lib/data";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { PAL_COULEURS } from "../src/lib/palCouleurs";
import type { Profile } from "../src/lib/profile";
import { estDansLUnivers } from "../src/lib/univers";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, STYLES_HOMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LA SAISON COLORIMÉTRIQUE DANS LA CAPSULE — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE.
// 15/11/2026, 1re mesure (question : « pourquoi la capsule ne s'adapte pas à ma colorimétrie ? ») : trois places pour la saison.
// 15/11/2026, 2e mesure, après l'ARBITRAGE ÉDITORIAL de la propriétaire : « il faut plus tenir compte des couleurs préférées, puis la
// colorimétrie vient juste après ».
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : le catalogue réel complet (paginé, pièces gelées écartées), la météo représentative de
// chaque saison de capsule, aucun dressing, aucune exclusion, un style à la fois.
// LEVIER ÉTUDIÉ (point 2) : SelectionStrategy.colorimetrieCapsule — trois bras sur le même profil et le même pool :
//   avant       la production : couleurs préférées par le filtre de curation seulement, saison ignorée ;
//   saison      la saison seule, juste après la couverture des occasions (la meilleure place de la 1re mesure) ;
//   hierarchie  au même rang, trois niveaux : couleur préférée (2), couleur de la saison (1), le reste (0) — l'arbitrage.
// FIXES CROISÉS (point 3) : genre × style × saison de capsule × saison colorimétrique × profil :
//   P1 sans couleur préférée ; P2 « Noir, Marine, Camel » ; P3 = P2 + silhouette en A + coupes « droites » (femme), pour voir si
//   les rangs morphologie et coupe changent la conclusion (NON DÉMONTRÉ à la 1re mesure).
// Mesures : taille ; vêtements dans les couleurs préférées ; vêtements dans la saison ; basiques retenus ; pièces changées par rapport
// à « avant » ; occasions sans tenue possible (moteur des tenues avec la colorimétrie, sur la capsule seule).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const VETEMENTS: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];
const hex = (n: string) => PAL_COULEURS.find(([x]) => x === n)![1];
const NMC = [hex("Noir"), hex("Marine"), hex("Camel")];
const PROFILS: { nom: string; genres: ("femme" | "homme")[]; patch: Partial<Profile>; morphology: string | null }[] = [
  { nom: "P1 sans couleur préférée", genres: ["femme", "homme"], patch: { paletteCouleurs: [] }, morphology: null },
  { nom: "P2 Noir, Marine, Camel", genres: ["femme", "homme"], patch: { paletteCouleurs: NMC }, morphology: null },
  { nom: "P3 Noir, Marine, Camel + silhouette en A + coupes droites", genres: ["femme"], patch: { paletteCouleurs: NMC, preferencesSilhouette: { miseEnValeur: null, coupes: ["droites"] } }, morphology: "f_poire" },
];
const BRAS: [string, SelectionStrategy][] = [
  ["avant", STRATEGIE_PRODUCTION],
  ["saison", { ...STRATEGIE_PRODUCTION, colorimetrieCapsule: "apres_occasions" }],
  ["hierarchie", { ...STRATEGIE_PRODUCTION, colorimetrieCapsule: "hierarchie" }],
];

interface Cumul { n: number; taille: number; vet: number; pref: number; saison: number; basiques: number; changees: number; occImp: number; touchees: number }
const vide = (): Cumul => ({ n: 0, taille: 0, vet: 0, pref: 0, saison: 0, basiques: 0, changees: 0, occImp: 0, touchees: 0 });
const pct = (a: number, d: number) => (d ? ((a / d) * 100).toFixed(1) : "0.0") + " %";
const moy = (a: number, d: number) => (d ? (a / d).toFixed(1) : "0.0");

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
    for (const g of ["femme", "homme"] as const) {
      const duGenre = catalogue.filter((it) => estDansLUnivers(it, g));
      console.log(`${g} : ${duGenre.filter((it) => NMC.includes(it.hex)).length} / ${duGenre.length} pièces en Noir, Marine ou Camel.`);
    }

    for (const prof of PROFILS)
      for (const g of prof.genres) {
        const styles = g === "femme" ? STYLES_FEMME : STYLES_HOMME;
        const cumuls = new Map(BRAS.map(([b]) => [b, vide()]));
        for (const sc of SAISONS_CLES) {
          const coloProfil = colorimetrieDeSaison(sc, "questionnaire");
          const coloMoteur = colorimetrieMoteur(coloProfil);
          const hexSaison = new Set([...(coloProfil.signature ?? []), ...(coloProfil.neutres ?? [])]);
          const hexPref = new Set(prof.patch.paletteCouleurs ?? []);
          for (const style of styles)
            for (const saisonCap of CAPSULE_SEASONS) {
              const profil = profilAudit({ gender: g, styles: [style], morphology: prof.morphology, patch: { ...prof.patch, colorimetrie: coloProfil } });
              const w = representativeWeatherFor(saisonCap);
              let idsAvant: Set<number> | null = null;
              for (const [nomBras, strat] of BRAS) {
                const cap = computeDefaultCapsule(profil, w, [], saisonCap, catalogue, strat);
                const vet = cap.filter((it) => VETEMENTS.includes(it.cat));
                const ids = new Set(cap.map((it) => it.id));
                if (!idsAvant) idsAvant = ids;
                let imp = 0;
                for (const occ of OCCS) {
                  const r = generateOutfitWithFallback(cap, w, occ, "Présentiel", "Verre", [...hexPref], g, saisonCap, undefined, coloMoteur);
                  if (r.noCompleteOutfit || !r.ids.length) imp++;
                }
                const c = cumuls.get(nomBras)!;
                c.n++;
                c.taille += cap.length;
                c.vet += vet.length;
                c.pref += vet.filter((it) => hexPref.has(it.hex)).length;
                c.saison += vet.filter((it) => hexSaison.has(it.hex)).length;
                c.basiques += cap.filter((it) => it.estBasiqueCapsule).length;
                c.changees += [...ids].filter((id) => !idsAvant!.has(id)).length;
                c.occImp += imp;
                if (imp) c.touchees++;
              }
            }
        }
        console.log(`\n=== ${g.toUpperCase()} · ${prof.nom} — ${styles.length} styles × 4 saisons de capsule × 4 saisons colorimétriques ===`);
        for (const [b, c] of cumuls)
          console.log(
            `${b.padEnd(11)} capsule ${moy(c.taille, c.n)} p. · vêtements en couleurs préférées ${pct(c.pref, c.vet)} · dans la saison ${pct(c.saison, c.vet)} · basiques ${moy(c.basiques, c.n)} · changées ${moy(c.changees, c.n)} · occ. impossibles ${c.occImp} (${c.touchees}/${c.n} capsules)`,
          );
      }
  });
});
