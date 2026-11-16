import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { CatalogItem } from "../src/lib/catalog";
import { CAPSULE_SEASONS, STRATEGIE_PRODUCTION, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { accordCoupe, coupesDeLaPiece } from "../src/lib/coupesPieces";
import { OCCASIONS } from "../src/lib/data";
import { computeLookScore, generateOutfitWithFallback } from "../src/lib/logic";
import { COUPES_PREFEREES, PREFERENCES_SILHOUETTE_VIDES, type CoupePreferee } from "../src/lib/preferencesSilhouette";
import { meilleurTirageMorphologique } from "../src/lib/silhouetteRonde";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, STYLES_HOMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LES COUPES PRÉFÉRÉES DANS LES TENUES — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE. (16/11/2026, demandé : « est-ce que tu prends
// bien en compte les préférences en termes de coupes ? » puis « oui, prépare-le ».)
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : catalogue réel complet (paginé, pièces gelées écartées), un style à la fois, femme et
// homme, météo représentative de chaque saison, aucun dressing, aucune couleur, aucune colorimétrie, aucune morphologie (la silhouette
// ronde ne joue pas). La capsule est celle de PRODUCTION, qui lit déjà les coupes préférées (rang « apres_basique ») : seul le levier
// des TENUES change.
// LEVIERS (point 2), mesurés sur les MÊMES candidats (point 3) :
//   tenue avec historique / Planifier avec humeur : la meilleure note parmi TIRAGES tenues, R-S31 éteinte puis allumée ;
//   tenue sans historique / Planifier sans humeur / valise : un tirage contre le meilleur de six (meilleurTirageMorphologique).
// PROFILS : une coupe préférée à la fois, puis « ajustées + structurées » ; TÉMOIN : aucune préférence, qui doit rester identique.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const TIRAGES = 8;
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const VETEMENTS: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];
const PREFERENCES: { nom: string; coupes: CoupePreferee[] | null }[] = [
  ...COUPES_PREFEREES.map((c) => ({ nom: c, coupes: [c] as CoupePreferee[] })),
  { nom: "ajustees + structurees", coupes: ["ajustees", "structurees"] },
  { nom: "TÉMOIN sans préférence", coupes: null },
];
const pct = (a: number, d: number) => (d ? ((a / d) * 100).toFixed(1) : "0.0") + " %";
const moy = (a: number, d: number) => (d ? (a / d).toFixed(2) : "0.00");

describe("coupes préférées dans le moteur", () => {
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
    const catalogue = rows.filter((r) => !(r as { frozen?: boolean }).frozen).map(rowToCatalogItem).filter((i): i is CatalogItem => !!i);
    assertCatalogueStyles(catalogue);
    const vet = catalogue.filter((it) => VETEMENTS.includes(it.cat));
    const connues = new Map<string, number>();
    for (const it of vet) for (const c of coupesDeLaPiece(it)) connues.set(c, (connues.get(c) ?? 0) + 1);
    console.log(`Catalogue : ${catalogue.length} pièces actives, ${vet.length} vêtements.`);
    console.log(`Coupes connues : ${[...connues].map(([c, n]) => `${c} ${n}`).join(" · ")} · sans coupe connue ${vet.filter((it) => !coupesDeLaPiece(it).size).length}`);

    for (const pref of PREFERENCES) {
      const tenue = { n: 0, change: 0, accordOff: 0, accordOn: 0, vetOn: 0 };
      const tirage = { n: 0, accordUn: 0, accordSix: 0, echecsUn: 0, echecsSix: 0 };
      for (const [genre, styles] of [["femme", STYLES_FEMME], ["homme", STYLES_HOMME]] as const)
        for (const style of styles)
          for (const saison of CAPSULE_SEASONS) {
            const profil = profilAudit({ gender: genre, styles: [style], patch: { preferencesSilhouette: { ...PREFERENCES_SILHOUETTE_VIDES, coupes: pref.coupes } } });
            const w = representativeWeatherFor(saison);
            const cap = computeDefaultCapsule(profil, w, [], saison, catalogue, STRATEGIE_PRODUCTION);
            const piece = (id: number) => cap.find((x) => x.id === id);
            const accord = (pieces: Item[]) => pieces.filter((it) => VETEMENTS.includes(it.cat) && accordCoupe(it, pref.coupes) === 1).length;
            for (const occ of OCCS) {
              const tirer = () => generateOutfitWithFallback(cap, w, occ, "Présentiel", "Verre", [], genre, saison);
              const cands: Item[][] = [];
              for (let t = 0; t < TIRAGES; t++) {
                const r = tirer();
                if (!r.noCompleteOutfit && r.ids.length) cands.push(r.ids.map(piece).filter((x): x is CatalogItem => !!x));
              }
              if (cands.length >= 2) {
                const note = (c: Item[], on: boolean) => computeLookScore(c, occ, [], null, new Set(), w, "Présentiel", "Verre", cap, null, { coupesPreferees: on }, null, pref.coupes).score;
                const meilleur = (on: boolean) => cands.reduce((m, c) => (note(c, on) > note(m, on) ? c : m), cands[0]);
                const off = meilleur(false);
                const on = meilleur(true);
                tenue.n++;
                if (off !== on) tenue.change++;
                tenue.accordOff += accord(off);
                tenue.accordOn += accord(on);
                tenue.vetOn += on.filter((it) => VETEMENTS.includes(it.cat)).length;
              }
              for (let t = 0; t < 3; t++) {
                const a = meilleurTirageMorphologique(tirer, cap, null, null, false, pref.coupes, false);
                const b = meilleurTirageMorphologique(tirer, cap, null, null, false, pref.coupes, true);
                tirage.n++;
                if (a.noCompleteOutfit || !a.ids.length) tirage.echecsUn++;
                else tirage.accordUn += accord(a.ids.map(piece).filter((x): x is CatalogItem => !!x));
                if (b.noCompleteOutfit || !b.ids.length) tirage.echecsSix++;
                else tirage.accordSix += accord(b.ids.map(piece).filter((x): x is CatalogItem => !!x));
              }
            }
          }
      console.log(`\n=== ${pref.nom} — ${STYLES_FEMME.length + STYLES_HOMME.length} styles × 4 saisons × ${OCCS.length} occasions ===`);
      console.log(
        `avec historique / humeur (R-S31, mêmes candidats) : choix changé ${pct(tenue.change, tenue.n)} des ${tenue.n} cas · vêtements de la coupe préférée par tenue ${moy(tenue.accordOff, tenue.n)} → ${moy(tenue.accordOn, tenue.n)} (sur ${moy(tenue.vetOn, tenue.n)} vêtements)`,
      );
      console.log(
        `sans historique / sans humeur / valise (1 tirage → meilleur de 6) : vêtements de la coupe préférée par tenue ${moy(tirage.accordUn, tirage.n)} → ${moy(tirage.accordSix, tirage.n)} · tenues impossibles ${tirage.echecsUn} → ${tirage.echecsSix}`,
      );
    }
  });
});
