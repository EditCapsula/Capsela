import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { styleFit } from "../src/lib/capsule";
import { formalityOf, matiereOf } from "../src/lib/attributes";
import type { CatalogItem } from "../src/lib/catalog";
import type { CategoryKey } from "../src/lib/types";
import { STYLE_ID_TO_CATALOG_LABEL, type StyleId } from "../src/lib/profile";
import { STYLES_FEMME, assertCatalogueStyles } from "./harnaisAudit";

// PHASE 15 · CHANTIER D — LISTE NOMINATIVE DES CANDIDATS AU RE-TAGGING.
// LECTURE SEULE. AUCUN UPDATE. AUCUN FICHIER SQL.
//
// L'arbitrage a retenu : déclarer l'occasion sur des une-pièces existantes
// plutôt que créer des pièces, pour casual_chic / boheme / preppy. Le critère
// est éditorial et s'applique pièce par pièce — il faut donc les nommer.
//
// DEUX AVERTISSEMENTS QUE CETTE LISTE EXISTE POUR RENDRE VISIBLES :
//
// 1. Une colonne `occasions` VIDE vaut « toutes occasions » :
//      declaredOccasionOk = !it.occasion || !it.occasion.length || includes(occ)
//    Écrire `festive` sur une pièce à colonne vide ne l'ajoute pas au palier 4,
//    elle la RETIRE des neuf autres occasions. Tout retag d'une pièce vide doit
//    écrire l'ensemble complet visé, jamais la seule occasion de palier 4. La
//    colonne actuelle est donc affichée pour chaque candidate.
//
// 2. Le croisement formalité × saison doit être JOINT. Une mesure séparée
//    (« 6 pièces F3 » et « présentes dans les deux buckets ») n'établit pas
//    qu'il existe une F3 dans CHAQUE bucket. Le tableau final le tranche.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const UNEPIECE: CategoryKey[] = ["robe", "combinaison"];
/** Les styles que l'arbitrage a désignés — plus streetwear, pour documenter son cas. */
const CIBLES: StyleId[] = ["casual_chic", "boheme", "preppy", "streetwear"];
const BUCKETS = ["Printemps / Été", "Automne / Hiver", "Toutes saisons"] as const;

describe("Phase 15 — candidats au palier 4", () => {
  it("nomme les une-pièces re-taguables et croise formalité × saison", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    // Indexé sur l'id du CatalogItem, pas sur celui de la ligne :
    // rowToCatalogItem applique VESTIAIRE_ID_OFFSET, les deux diffèrent de 100000.
    const parId = new Map<number, VestiaireRow>();
    const pool: CatalogItem[] = [];
    for (const r of brutes) {
      const it = rowToCatalogItem(r);
      if (!it) continue;
      pool.push(it);
      parId.set(it.id, r);
    }
    assertCatalogueStyles(pool, STYLES_FEMME);

    // ═══ 1 · CROISEMENT JOINT FORMALITÉ × SAISON ═══
    console.log(`\n════════ 1 · UNE-PIÈCES PAR STYLE × BUCKET × FORMALITÉ (croisement JOINT) ════════`);
    console.log(`  La question : existe-t-il une une-pièce de formalité >= 3 dans CHAQUE bucket ?`);
    console.log(`  ${"style".padEnd(16)}${BUCKETS.map((b) => b.slice(0, 15).padStart(20)).join("")}`);
    for (const style of STYLES_FEMME) {
      const label = STYLE_ID_TO_CATALOG_LABEL[style];
      const l = pool.filter((it) => UNEPIECE.includes(it.cat) && styleFit(it, label));
      const cellules = BUCKETS.map((b) => {
        const dedans = l.filter((it) => it.season === b);
        const f3 = dedans.filter((it) => formalityOf(it) >= 3).length;
        return `${dedans.length} dont ${f3} F3+`;
      });
      console.log(`  ${style.padEnd(16)}${cellules.map((c) => c.padStart(20)).join("")}`);
    }
    console.log(`\n  Une pièce « Toutes saisons » couvre les deux buckets. Un style n'est couvrable`);
    console.log(`  par re-tagging que s'il a une F3+ dans chaque bucket, ou une F3+ Toutes saisons.`);

    // ═══ 2 · LISTE NOMINATIVE ═══
    console.log(`\n════════ 2 · CANDIDATES, PIÈCE PAR PIÈCE ════════`);
    console.log(`  Le critère d'attribution est ÉDITORIAL et s'applique ici, pièce par pièce.`);
    console.log(`  « occasions » vide = actuellement éligible à TOUTES les occasions.`);
    for (const style of CIBLES) {
      const label = STYLE_ID_TO_CATALOG_LABEL[style];
      const l = pool
        .filter((it) => UNEPIECE.includes(it.cat) && styleFit(it, label))
        .sort((a, b) => formalityOf(b) - formalityOf(a) || a.id - b.id);
      console.log(`\n  ──────── ${style} (${l.length} une-pièces) ────────`);
      if (!l.length) { console.log(`    aucune — le re-tagging est impossible, seule la création reste.`); continue; }
      for (const it of l) {
        const row = parId.get(it.id)!;
        const occ = (row.occasions || "").trim();
        const bornes = `${it.meteoMinTemp ?? "—"}/${it.meteoMaxTemp ?? "—"}`;
        console.log(
          `    #${it.id}  F${formalityOf(it)}  ${String(it.cat).padEnd(12)}${(it.name || "").slice(0, 40).padEnd(42)}` +
          `${String(it.season).padEnd(18)}${bornes.padStart(10)}  ${(matiereOf(it) ?? "—")}`);
        console.log(`             styles: ${(row.styles || "—")}`);
        console.log(`             occasions: ${occ ? occ : "(VIDE → toutes occasions — un retag partiel RESTREINDRAIT cette pièce)"}`);
      }
    }

    // ═══ 3 · CE QU'UN RETAG DEVRAIT ÉCRIRE ═══
    console.log(`\n════════ 3 · CE QU'UN RETAG DEVRAIT ÉCRIRE (aucun UPDATE ici) ════════`);
    const vides = pool.filter((it) => UNEPIECE.includes(it.cat) && !(parId.get(it.id)!.occasions || "").trim());
    const remplies = pool.filter((it) => UNEPIECE.includes(it.cat) && (parId.get(it.id)!.occasions || "").trim());
    console.log(`  Une-pièces à colonne occasions VIDE     : ${vides.length}`);
    console.log(`  Une-pièces à colonne occasions REMPLIE  : ${remplies.length}`);
    console.log(`\n  Pour une pièce VIDE, la valeur écrite doit être l'ensemble complet visé.`);
    console.log(`  Le repli heuristique actuel d'une robe est : soiree, date, evenement_perso`);
    console.log(`  (OCCASIONS_DEFAULT_BY_CAT, attributes.ts). Écrire moins que cela retirerait`);
    console.log(`  la pièce d'occasions qu'elle sert déjà.`);
    console.log(`\n  Valeurs actuellement présentes dans la colonne, toutes catégories confondues :`);
    const distinctes = new Set<string>();
    for (const r of brutes) for (const v of (r.occasions || "").split(",")) if (v.trim()) distinctes.add(v.trim());
    console.log(`    ${[...distinctes].sort().join(", ")}`);
    console.log(`\n  AUCUN UPDATE n'est produit par cet audit. Le SQL sera proposé en revue,`);
    console.log(`  pièce par pièce, après application du critère éditorial.`);
  }, 900_000);
});
