import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import type { CatalogItem } from "../src/lib/catalog";
import type { OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// VÉRIFICATION DU RETAG — LECTURE SEULE, AUCUNE ÉCRITURE.
//
// À lancer DEUX FOIS : une fois AVANT l'exécution du SQL, une fois APRÈS.
// Les deux sorties se comparent ligne à ligne. Aucun UPDATE n'est émis par ce
// script ; la clé de service ne sert qu'à lire.
//
// Les sept contrôles arrêtés à l'arbitrage :
//   1. la valeur exacte de `occasions` sur les cinq lignes ;
//   2. qu'aucune AUTRE ligne n'a changé — inventaire complet des lignes à
//      occasions non vides, à comparer entre les deux exécutions ;
//   3. les 32 cellules evenement_perso, en conditions RÉELLES et non simulées ;
//   4. le résultat attendu : 5 cellules en repli ;
//   5. festive, qui doit rester à 16/32 — aucun retag ne l'introduit ;
//   6. les trois occasions de formalité 3, sans régression ;
//   7. la conformité des cinq lignes à l'intention éditoriale validée.
//
// `occasions` étant une RESTRICTION et non un ajout, un UPDATE remplace
// l'ensemble précédent : le contrôle 6 n'est pas facultatif.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/** L'intention éditoriale validée, pièce par pièce. Ids de la TABLE. */
const ATTENDU: Record<number, string> = {
  1038: "quotidien,travail_formel,entretien,soiree,date,evenement_perso",
  801: "quotidien,travail_formel,entretien,soiree,date,evenement_perso",
  855: "quotidien,travail_formel,entretien,soiree,date,evenement_perso",
  993: "quotidien,travail_formel,entretien,soiree,date,evenement_perso",
  // Robe LONGUE bohème : bureau et entretien écartés, arbitrage du 29/08/2026.
  891: "quotidien,soiree,date,evenement_perso",
};
const CIBLES = Object.keys(ATTENDU).map(Number);
const OCC4: OccasionKey[] = ["festive", "evenement_perso"];
const OCC3: OccasionKey[] = ["travail_formel", "entretien", "soiree"];
/** Attendu après exécution. Avant, la mesure doit donner 16 et 16. */
const CIBLE_REPLI = { evenement_perso: 5, festive: 16 };
const TIRAGES = 20;
const norm = (s: string | null) => (s || "").split(",").map((x) => x.trim()).filter(Boolean).join(",");

describe("Vérification du retag", () => {
  it("exécute les sept contrôles, sans jamais écrire", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    // ═══ 1 & 7 · LES CINQ LIGNES, VALEUR EXACTE ET CONFORMITÉ ═══
    console.log(`\n════════ 1 & 7 · LES CINQ LIGNES ════════`);
    let conformes = 0, vides = 0;
    for (const id of CIBLES) {
      const r = rows.find((x) => x.id === id);
      if (!r) { console.log(`  id ${id} — INTROUVABLE`); continue; }
      const actuel = norm(r.occasions);
      const attendu = ATTENDU[id];
      const etat = !actuel ? "VIDE (avant exécution)" : actuel === attendu ? "CONFORME" : "*** DIVERGENT ***";
      if (!actuel) vides += 1; else if (actuel === attendu) conformes += 1;
      console.log(`  id ${String(id).padStart(5)}  ${(r.name || "").slice(0, 34).padEnd(36)}${etat}`);
      if (actuel && actuel !== attendu) {
        console.log(`         attendu : ${attendu}`);
        console.log(`         trouvé  : ${actuel}`);
      }
    }
    console.log(`\n  ${vides} vide(s), ${conformes} conforme(s) sur ${CIBLES.length}.`);
    console.log(`  AVANT exécution : 5 vides attendus. APRÈS : 5 conformes attendus.`);

    // ═══ 2 · AUCUNE AUTRE LIGNE MODIFIÉE ═══
    console.log(`\n════════ 2 · INVENTAIRE DES LIGNES À occasions NON VIDE ════════`);
    console.log(`  À comparer entre l'exécution AVANT et l'exécution APRÈS : seuls les cinq`);
    console.log(`  ids ciblés doivent apparaître en plus.`);
    const remplies = rows.filter((r) => norm(r.occasions)).map((r) => r.id).sort((a, b) => a - b);
    console.log(`  Total : ${remplies.length} lignes sur ${rows.length}.`);
    console.log(`  Ids : ${remplies.join(",")}`);

    // ═══ 3 à 6 · MESURE EN CONDITIONS RÉELLES ═══
    console.log(`\n════════ 3-6 · REPLI SUR LES 32 CELLULES, DONNÉES RÉELLES ════════`);
    console.log(`  Aucune simulation : le pool est celui du catalogue tel qu'il est maintenant.`);
    const replie = (caps: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, occ: OccasionKey, s: typeof CAPSULE_SEASONS[number]) => {
      for (let k = 0; k < TIRAGES; k++) {
        const r = generateOutfitWithFallback(caps, w, occ, "Présentiel", "Verre", [], "femme", s);
        if (r.ids.length && !r.formalityDowngraded) return false;
      }
      return true;
    };
    console.log(`  ${"occasion".padEnd(18)}${"form.".padStart(6)}${"replient".padStart(11)}${"attendu après".padStart(16)}${"verdict".padStart(12)}`);
    for (const occ of [...OCC4, ...OCC3]) {
      let n = 0;
      const detail: string[] = [];
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES_FEMME) {
          const caps = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool);
          if (replie(caps, w, occ, saison)) { n += 1; detail.push(`${saison}/${style}`); }
        }
      }
      const cible = (CIBLE_REPLI as Record<string, number>)[occ];
      const verdict = cible === undefined ? "—" : n === cible ? "conforme" : "*** ÉCART ***";
      console.log(`  ${occ.padEnd(18)}${(occ === "festive" || occ === "evenement_perso" ? "4" : "3").padStart(6)}${(n + "/32").padStart(11)}${(cible === undefined ? "inchangé" : String(cible)).padStart(16)}${verdict.padStart(12)}`);
      if (n && n <= 20) console.log(`         ${detail.join(" · ")}`);
    }
    console.log(`\n  Rappel des valeurs AVANT exécution : evenement_perso 16/32, festive 16/32,`);
    console.log(`  travail_formel 4/32, entretien 4/32, soiree 3/32.`);
    console.log(`  Toute variation des trois occasions de formalité 3 est une RÉGRESSION :`);
    console.log(`  \`occasions\` est une restriction, un UPDATE remplace l'ensemble précédent.`);
    console.log(`\n  LECTURE SEULE. Aucun UPDATE émis par ce script.`);
  }, 900_000);
});
