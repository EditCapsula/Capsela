import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import type { CatalogItem } from "../src/lib/catalog";
import type { OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// ÉCART DE LA VÉRIFICATION — POURQUOI #891 NE REND PAS SES 4 CELLULES.
// LECTURE SEULE, AUCUNE ÉCRITURE.
//
// La vérification post-exécution donne evenement_perso 9/32, quand la
// simulation annonçait 5. Les 9 cellules sont exactement la grille à QUATRE
// retags : #891 n'a aucun effet.
//
// La seule différence entre la simulation et la réalité est le CONTENU de sa
// colonne : simulée avec SIX occasions, écrite avec QUATRE — travail_formel et
// entretien retirés par arbitrage éditorial.
//
// Hypothèse à tester, pas à affirmer : le rang 1 de pickBestMarginal est le
// nombre d'occasions marginales non couvertes. Moins d'occasions déclarées,
// rang plus faible, pièce non retenue par la sélection. L'arbitrage éditorial
// aurait alors annulé le gain mécanique — un couplage que ni la règle d'audit
// ni personne n'avait anticipé, puisqu'il va de l'éditorial vers la mesure et
// non l'inverse.
//
// Trois configurations de #891 comparées, tout le reste strictement identique
// et pris sur les données réelles d'aujourd'hui.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const ID_891 = 100891;
const TIRAGES = 20;
const CONFIGS: { nom: string; occ: OccasionKey[] | null }[] = [
  { nom: "réel : 4 occasions", occ: ["quotidien", "soiree", "date", "evenement_perso"] },
  { nom: "simulé : 6 occasions", occ: ["quotidien", "travail_formel", "entretien", "soiree", "date", "evenement_perso"] },
  { nom: "avant retag : vide", occ: null },
];

describe("Écart #891", () => {
  it("isole l'effet du nombre d'occasions déclarées sur la sélection", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    const cible = pool.find((it) => it.id === ID_891);
    console.log(`\n#${ID_891} en base aujourd'hui :`);
    console.log(`  ${cible?.name} · saison ${cible?.season} · bornes ${cible?.meteoMinTemp ?? "—"}/${cible?.meteoMaxTemp ?? "—"}`);
    console.log(`  occasions déclarées : ${cible?.occasion?.join(",") || "(vide)"}`);

    const replie = (caps: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, occ: OccasionKey, s: typeof CAPSULE_SEASONS[number]) => {
      for (let k = 0; k < TIRAGES; k++) {
        const r = generateOutfitWithFallback(caps, w, occ, "Présentiel", "Verre", [], "femme", s);
        if (r.ids.length && !r.formalityDowngraded) return false;
      }
      return true;
    };

    console.log(`\n════════ #891 EST-ELLE RETENUE, ET QUE REND-ELLE ? ════════`);
    console.log(`  ${"configuration".padEnd(24)}${"P".padStart(4)}${"É".padStart(4)}${"A".padStart(4)}${"H".padStart(4)}${"boheme replie".padStart(16)}${"total ev_perso".padStart(16)}`);
    for (const cfg of CONFIGS) {
      const src: CatalogItem[] = pool.map((it) =>
        it.id === ID_891 ? { ...it, occasion: cfg.occ ? [...cfg.occ] : undefined } : it);
      const dans: string[] = [];
      let bohemeReplie = 0, total = 0;
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        const capsB = computeDefaultCapsule(profilAudit({ gender: "femme", styles: ["boheme"] }), w, [], saison, src);
        dans.push(capsB.some((it) => it.id === ID_891) ? "oui" : "—");
        if (replie(capsB, w, "evenement_perso", saison)) bohemeReplie += 1;
        for (const style of STYLES_FEMME) {
          const caps = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, src);
          if (replie(caps, w, "evenement_perso", saison)) total += 1;
        }
      }
      console.log(`  ${cfg.nom.padEnd(24)}${dans.map((d) => d.padStart(4)).join("")}${(bohemeReplie + "/4").padStart(16)}${(total + "/32").padStart(16)}`);
    }
    console.log(`\n  Colonnes P/É/A/H : #891 est-elle dans la capsule bohème de cette saison ?`);
    console.log(`  Si « oui » n'apparaît qu'avec six occasions, l'hypothèse est confirmée :`);
    console.log(`  c'est le NOMBRE d'occasions déclarées qui pilote son rang de sélection.`);
    console.log(`\n  LECTURE SEULE. Aucune écriture, aucun UPDATE.`);
  }, 900_000);
});
