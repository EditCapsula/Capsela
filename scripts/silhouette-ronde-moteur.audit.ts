import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { CatalogItem } from "../src/lib/catalog";
import { CAPSULE_SEASONS, STRATEGIE_AVANT_SILHOUETTE_RONDE, STRATEGIE_PRODUCTION, computeDefaultCapsule, representativeWeatherFor, styleFit, type SelectionStrategy } from "../src/lib/capsule";
import { OCCASIONS } from "../src/lib/data";
import { computeLookScore, generateOutfitWithFallback } from "../src/lib/logic";
import { STYLE_ID_TO_CATALOG_LABEL } from "../src/lib/profile";
import { compatibiliteRonde, criteresRonde, meilleurTirageMorphologique, type Corpulence } from "../src/lib/silhouetteRonde";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LA SILHOUETTE RONDE DANS LE MOTEUR — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE. (15/11/2026, brief « Gestion des silhouettes
// rondes » ; arbitrages : cinq morphologies inchangées, sélection + bonus de tenue sans phrase, pas de question posée pour l'instant.)
//
// CONFIGURATION GELÉE (AGENTS.md, point 1) : catalogue réel complet (paginé, pièces gelées écartées), profils femme, un style à la
// fois, météo représentative de chaque saison de capsule, aucun dressing, aucune couleur préférée, aucune colorimétrie.
// LEVIERS ÉTUDIÉS (point 2), mesurés séparément puis ensemble sur les mêmes données (point 3) :
//   capsule : SelectionStrategy.silhouetteRonde = "rang" (avant : production) ;
//   tenue   : LeviersMesure.silhouetteRonde (R-S20) — sur les MÊMES tirages, la tenue retenue au meilleur score, règle éteinte puis
//             allumée : seul le classement change, jamais les candidats.
// COMBINAISONS : ronde seule (f_pomme, la seule connue en production aujourd'hui) ; ronde + A, V, H, X / 8 (corpulence « ronde »,
// renseignée ici seulement) ; TÉMOIN : X / 8 sans silhouette ronde, qui doit rester identique.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const TIRAGES = 8;
const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const VETEMENTS: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];
const COMBINAISONS: { nom: string; morphology: string; corpulence: Corpulence | null }[] = [
  { nom: "ronde seule (plutôt ronde et régulière)", morphology: "f_pomme", corpulence: null },
  { nom: "ronde + A (hanches marquées)", morphology: "f_poire", corpulence: "ronde" },
  { nom: "ronde + V (épaules larges)", morphology: "f_triangle_inverse", corpulence: "ronde" },
  { nom: "ronde + H (fine et droite)", morphology: "f_rectangle", corpulence: "ronde" },
  { nom: "ronde + X / 8 (taille marquée)", morphology: "f_sablier", corpulence: "ronde" },
  { nom: "TÉMOIN X / 8 sans silhouette ronde", morphology: "f_sablier", corpulence: null },
];
// En production depuis le 15/11/2026 : « avant » est la production d'avant, « avec » la production.
const AVEC: SelectionStrategy = STRATEGIE_PRODUCTION;
const pct = (a: number, d: number) => (d ? ((a / d) * 100).toFixed(1) : "0.0") + " %";
const moy = (a: number, d: number) => (d ? (a / d).toFixed(1) : "0.0");

describe("silhouette ronde dans le moteur", () => {
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
    console.log(`Catalogue : ${catalogue.length} pièces actives.`);

    // Ce que la détection trouve dans le catalogue, famille par famille (vêtements femme et unisexes).
    const vet = catalogue.filter((it) => VETEMENTS.includes(it.cat) && (it as { genre?: string }).genre !== "homme");
    const parFamille = new Map<string, number>();
    for (const it of vet) for (const c of criteresRonde(it)) parFamille.set(c, (parFamille.get(c) ?? 0) + 1);
    console.log(`\n=== Familles détectées sur ${vet.length} vêtements ===\n${[...parFamille].sort((a, b) => b[1] - a[1]).map(([c, k]) => `${c} ${k}`).join(" · ")}`);

    for (const comb of COMBINAISONS) {
      const capAvant = { n: 0, taille: 0, vet: 0, compat: 0, style: 0, basiques: 0, imp: 0 };
      const capApres = { ...capAvant };
      let changees = 0;
      const tenue = { n: 0, change: 0, compatOff: 0, compatOn: 0, pieces: 0, scoreBaisse: 0 };
      // PLANIFIER SANS HUMEUR, VALISE, TENUE DU JOUR SANS HISTORIQUE (meilleurTirageMorphologique) : un tirage contre le meilleur de six.
      const unTirage = { n: 0, compat: 0, echecs: 0 };
      const meilleurDeSix = { n: 0, compat: 0, echecs: 0 };
      for (const style of STYLES_FEMME)
        for (const saison of CAPSULE_SEASONS) {
          const profil = { ...profilAudit({ gender: "femme", styles: [style], morphology: comb.morphology }), corpulence: comb.corpulence };
          const w = representativeWeatherFor(saison);
          const label = STYLE_ID_TO_CATALOG_LABEL[style];
          const mesurer = (cap: CatalogItem[], acc: typeof capAvant) => {
            const v = cap.filter((it) => VETEMENTS.includes(it.cat));
            acc.n++;
            acc.taille += cap.length;
            acc.vet += v.length;
            acc.compat += v.filter((it) => compatibiliteRonde(it, comb.morphology, comb.corpulence) === 1).length;
            acc.style += cap.filter((it) => styleFit(it, label)).length;
            acc.basiques += cap.filter((it) => it.estBasiqueCapsule).length;
            for (const occ of OCCS) {
              const r = generateOutfitWithFallback(cap, w, occ, "Présentiel", "Verre", [], "femme", saison);
              if (r.noCompleteOutfit || !r.ids.length) acc.imp++;
            }
          };
          const avant = computeDefaultCapsule(profil, w, [], saison, catalogue, STRATEGIE_AVANT_SILHOUETTE_RONDE);
          const apres = computeDefaultCapsule(profil, w, [], saison, catalogue, AVEC);
          mesurer(avant, capAvant);
          mesurer(apres, capApres);
          const ids = new Set(avant.map((i) => i.id));
          changees += apres.filter((i) => !ids.has(i.id)).length;

          for (const occ of OCCS) {
            const tirer = () => generateOutfitWithFallback(apres, w, occ, "Présentiel", "Verre", [], "femme", saison);
            const compatDe = (ids: number[]) => ids.map((id) => apres.find((x) => x.id === id)).filter((x): x is CatalogItem => !!x && VETEMENTS.includes(x.cat) && compatibiliteRonde(x, comb.morphology, comb.corpulence) === 1).length;
            for (let t = 0; t < 3; t++) {
              const a = meilleurTirageMorphologique(tirer, apres, comb.morphology, comb.corpulence, false);
              const b = meilleurTirageMorphologique(tirer, apres, comb.morphology, comb.corpulence, true);
              unTirage.n++; meilleurDeSix.n++;
              if (a.noCompleteOutfit || !a.ids.length) unTirage.echecs++; else unTirage.compat += compatDe(a.ids);
              if (b.noCompleteOutfit || !b.ids.length) meilleurDeSix.echecs++; else meilleurDeSix.compat += compatDe(b.ids);
            }
          }

          // La tenue : mêmes tirages, choix au meilleur score sans puis avec R-S20 (sur la capsule « après », celle de production si validée).
          for (const occ of OCCS) {
            const cands: Item[][] = [];
            for (let t = 0; t < TIRAGES; t++) {
              const r = generateOutfitWithFallback(apres, w, occ, "Présentiel", "Verre", [], "femme", saison);
              if (!r.noCompleteOutfit && r.ids.length) cands.push(r.ids.map((id) => apres.find((x) => x.id === id)).filter((x): x is CatalogItem => !!x));
            }
            if (cands.length < 2) continue;
            const note = (pieces: Item[], on: boolean) => computeLookScore(pieces, occ, [], comb.morphology, new Set(), w, "Présentiel", "Verre", apres, null, { silhouetteRonde: on }, comb.corpulence).score;
            const meilleur = (on: boolean) => cands.reduce((m, c) => (note(c, on) > note(m, on) ? c : m), cands[0]);
            const off = meilleur(false);
            const on = meilleur(true);
            const compat = (c: Item[]) => c.filter((it) => VETEMENTS.includes(it.cat) && compatibiliteRonde(it, comb.morphology, comb.corpulence) === 1).length;
            tenue.n++;
            if (off !== on) tenue.change++;
            tenue.compatOff += compat(off);
            tenue.compatOn += compat(on);
            tenue.pieces += on.filter((it) => VETEMENTS.includes(it.cat)).length;
            if (cands.some((c) => note(c, true) < note(c, false))) tenue.scoreBaisse++;
          }
        }
      console.log(`\n=== ${comb.nom} — ${STYLES_FEMME.length} styles × 4 saisons ===`);
      for (const [nom, a] of [["avant", capAvant], ["après", capApres]] as const)
        console.log(
          `capsule ${nom.padEnd(5)} ${moy(a.taille, a.n)} p. · vêtements compatibles ${pct(a.compat, a.vet)} · pièces du style ${moy(a.style, a.n)} · basiques ${moy(a.basiques, a.n)} · occasions impossibles ${a.imp}`,
        );
      console.log(`pièces changées par capsule : ${moy(changees, capAvant.n)}`);
      console.log(
        `Planifier sans humeur / valise / tenue sans historique : vêtements compatibles par tenue ${moy(unTirage.compat, unTirage.n)} → ${moy(meilleurDeSix.compat, meilleurDeSix.n)} · tenues impossibles ${unTirage.echecs} → ${meilleurDeSix.echecs} (sur ${unTirage.n})`,
      );
      console.log(
        `tenue (R-S20, mêmes tirages) : choix changé ${pct(tenue.change, tenue.n)} des ${tenue.n} cas · vêtements compatibles par tenue ${moy(tenue.compatOff, tenue.n)} → ${moy(tenue.compatOn, tenue.n)} · tenues dont le score baisse : ${tenue.scoreBaisse}`,
      );
    }
  });
});
