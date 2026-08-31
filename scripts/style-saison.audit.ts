import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor, styleFit } from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { EMPTY_PROFILE, STYLE_ID_TO_CATALOG_LABEL, exposedStyleIds, type Profile, type StyleId } from "../src/lib/profile";

// PHASE 14 — FILTRE DE STYLE ET DIFFÉRENCIATION SAISONNIÈRE. LECTURE SEULE.
//
// Première chose à vérifier, avant d'accuser le moteur : mes propres scripts.
// `profile.styles` porte des StyleId ("casual_chic"), traduits en libellé
// catalogue par STYLE_ID_TO_CATALOG_LABEL. Tous mes audits antérieurs
// passaient des LIBELLÉS ("Casual chic"), pour lesquels la table renvoie
// undefined ; .filter(Boolean) vide alors le tableau, `styles.length` vaut 0,
// et computeDefaultCapsule saute purement et simplement le filtre de style.
//
// Si c'est le cas, « les capsules d'été sont identiques entre styles » n'est
// pas une anomalie de production : c'est un défaut de mon harnais d'audit, et
// il affecte TOUTES les phases précédentes.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const STYLE_IDS_FEMME = exposedStyleIds("femme");
/** Les six chaînes utilisées par mes audits précédents — dont « Classique », qui n'existe pas. */
const LIBELLES_UTILISES_AVANT = ["Casual chic", "Classique", "Glamour", "Bohème", "Streetwear", "Minimaliste"];
const SEUIL_FALLBACK = 18;

const profil = (styles: string[]): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles });
const isSport = (it: Item) => formalityOf(it) === 0;
const isSportEssential = (it: Item) =>
  (it.cat === "accessoire" && it.accessoireType === "Gourde") || (it.cat === "sac" && it.sacType === "Sac de sport");
const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const empreinte = (c: CatalogItem[]) => c.map((it) => it.id).sort((a, b) => a - b).join(",");
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const FAMILLES: [string, CategoryKey[]][] = [
  ["hauts", ["haut", "pull"]], ["bas", ["pantalon", "jean", "jupe", "short"]],
  ["robes", ["robe", "combinaison"]], ["vestes", ["veste", "manteau"]],
  ["chauss.", ["chaussures"]], ["access.", ["sac", "accessoire"]], ["bijoux", ["bijou"]],
];

describe("Phase 14 — filtre de style et différenciation saisonnière", () => {
  it("cartographie le filtre, le fallback et la pureté stylistique", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    // ═══ 15. CORRESPONDANCE DES LIBELLÉS ═══
    console.log(`\n════════ 15 · CORRESPONDANCE DES STYLES ════════`);
    console.log(`  Styles exposés (femme) : ${STYLE_IDS_FEMME.length} — ${STYLE_IDS_FEMME.join(", ")}`);
    console.log(`\n  Ce que mes audits précédents passaient à profile.styles :`);
    for (const l of LIBELLES_UTILISES_AVANT) {
      const traduit = STYLE_ID_TO_CATALOG_LABEL[l as StyleId];
      console.log(`     « ${l.padEnd(14)} » → ${traduit ? `« ${traduit} »` : "UNDEFINED — écarté par filter(Boolean)"}`);
    }

    // Valeurs réellement présentes dans la colonne `styles` du catalogue.
    const valeursDB = new Map<string, number>();
    let sansStyle = 0;
    for (const r of brutes) {
      const raw = (r as VestiaireRow & { styles?: string | null }).styles;
      if (!raw || !raw.trim()) { sansStyle += 1; continue; }
      raw.split(",").map((x) => x.trim()).filter(Boolean).forEach((v) => valeursDB.set(v, (valeursDB.get(v) ?? 0) + 1));
    }
    const libellesAttendus = new Set(STYLE_IDS_FEMME.map((id) => STYLE_ID_TO_CATALOG_LABEL[id]));
    console.log(`\n  Colonne « styles » du catalogue : ${brutes.length - sansStyle} pièces renseignées, ${sansStyle} vides`);
    console.log(`  ${"valeur en base".padEnd(24)}${"pièces".padStart(8)}   correspondance`);
    for (const [v, n] of [...valeursDB.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${v.padEnd(24)}${String(n).padStart(8)}   ${libellesAttendus.has(v) ? "✓" : "✗ ORPHELINE (aucun style exposé)"}`);
    }
    const orphelinsUI = [...libellesAttendus].filter((l) => !valeursDB.has(l));
    console.log(`  Styles exposés sans aucune pièce en base : ${orphelinsUI.length ? orphelinsUI.join(", ") : "aucun"}`);

    // ═══ PREUVE DU DÉFAUT DE HARNAIS ═══
    console.log(`\n════════ PREUVE — LIBELLÉ CONTRE IDENTIFIANT ════════`);
    for (const saison of SAISONS) {
      const w = representativeWeatherFor(saison);
      const parLibelle = new Set(LIBELLES_UTILISES_AVANT.map((l) => empreinte(computeDefaultCapsule(profil([l]), w, [], saison, pool))));
      const parId = new Set(STYLE_IDS_FEMME.map((id) => empreinte(computeDefaultCapsule(profil([id]), w, [], saison, pool))));
      console.log(`  ${saison.padEnd(11)} capsules distinctes — avec libellés : ${parLibelle.size}/${LIBELLES_UTILISES_AVANT.length}   ·   avec identifiants : ${parId.size}/${STYLE_IDS_FEMME.length}`);
    }

    // ═══ 3-8. CARTOGRAPHIE QUANTITATIVE, AVEC LES BONS IDENTIFIANTS ═══
    console.log(`\n════════ 4-5-8 · POOLS, FALLBACK ET PURETÉ (identifiants corrects) ════════`);
    console.log(`  ${"saison".padEnd(11)}${"style".padEnd(16)}${"base".padStart(6)}${"pool style".padStart(11)}${"fallback".padStart(10)}${"pureté".padStart(9)}${"pièces".padStart(8)}   catégories déficitaires (pool style < 2)`);
    const empreintesParSaison = new Map<string, Map<string, Set<number>>>();
    for (const saison of SAISONS) {
      const w = representativeWeatherFor(saison);
      const bucket = capsuleSeasonBucket(saison);
      // `base` reconstruit à l'identique de computeDefaultCapsule : genre,
      // soleil, saison, température — le style s'applique juste après.
      const base = pool.filter((it) =>
        it.genre !== "homme" &&
        (it.season === bucket || it.season === "Toutes saisons") &&
        (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
        (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp)
      );
      const parStyle = new Map<string, Set<number>>();
      for (const id of STYLE_IDS_FEMME) {
        const libelle = STYLE_ID_TO_CATALOG_LABEL[id];
        const poolStyle = base.filter((it) => isSportEssential(it) || styleFit(it, libelle));
        const fallback = poolStyle.length < SEUIL_FALLBACK;
        const capsule = computeDefaultCapsule(profil([id]), w, [], saison, pool);
        parStyle.set(id, new Set(capsule.map((it) => it.id)));
        const horsSport = capsule.filter((it) => !isSport(it));
        const duStyle = horsSport.filter((it) => styleFit(it, libelle)).length;
        const deficitaires = FAMILLES
          .filter(([, cats]) => base.filter((it) => cats.includes(it.cat) && styleFit(it, libelle)).length < 2)
          .map(([n]) => n);
        console.log(`  ${saison.padEnd(11)}${id.padEnd(16)}${String(base.length).padStart(6)}${String(poolStyle.length).padStart(11)}` +
          `${(fallback ? "OUI" : "non").padStart(10)}${pct(duStyle, horsSport.length).padStart(9)}${String(capsule.length).padStart(8)}   ${deficitaires.join(", ") || "—"}`);
      }
      empreintesParSaison.set(saison, parStyle);
    }

    // ═══ 6-7. DIFFÉRENCIATION ENTRE STYLES ═══
    console.log(`\n════════ 6-7 · DIFFÉRENCIATION ENTRE STYLES (Jaccard) ════════`);
    console.log(`  ${"saison".padEnd(11)}${"capsules distinctes".padStart(20)}${"Jaccard moyen".padStart(15)}${"pièces communes aux 8".padStart(23)}${"union".padStart(8)}`);
    for (const saison of SAISONS) {
      const m = empreintesParSaison.get(saison)!;
      const ens = [...m.values()];
      const distinctes = new Set([...m.values()].map((s) => [...s].sort((a, b) => a - b).join(","))).size;
      let somme = 0, paires = 0;
      for (let i = 0; i < ens.length; i++) {
        for (let j = i + 1; j < ens.length; j++) {
          const inter = [...ens[i]].filter((x) => ens[j].has(x)).length;
          const union = new Set([...ens[i], ...ens[j]]).size;
          somme += union ? inter / union : 0; paires += 1;
        }
      }
      const communes = ens.reduce((acc, s) => new Set([...acc].filter((x) => s.has(x))), ens[0]);
      const union = new Set(ens.flatMap((s) => [...s]));
      console.log(`  ${saison.padEnd(11)}${(distinctes + "/" + ens.length).padStart(20)}${(somme / paires).toFixed(3).padStart(15)}${String(communes.size).padStart(23)}${String(union.size).padStart(8)}`);
    }

    // ═══ 10. CE QUE COÛTERAIT LA SUPPRESSION DU FALLBACK ═══
    console.log(`\n════════ 10 · CONSÉQUENCES D'UNE SUPPRESSION DU FALLBACK ════════`);
    console.log(`  Capsule reconstruite sur le SEUL pool de style, sans repli sur base.`);
    console.log(`  ${"saison".padEnd(11)}${"style".padEnd(16)}${"pool style".padStart(11)}${"occasions".padStart(11)}${"catégories".padStart(12)}${"verdict".padStart(22)}`);
    for (const saison of SAISONS) {
      const w = representativeWeatherFor(saison);
      const bucket = capsuleSeasonBucket(saison);
      const base = pool.filter((it) =>
        it.genre !== "homme" &&
        (it.season === bucket || it.season === "Toutes saisons") &&
        (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
        (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp)
      );
      for (const id of STYLE_IDS_FEMME) {
        const libelle = STYLE_ID_TO_CATALOG_LABEL[id];
        const poolStyle = base.filter((it) => isSportEssential(it) || styleFit(it, libelle));
        const occ = new Set<OccasionKey>();
        poolStyle.forEach((it) => occasionsDe(it).forEach((o) => occ.add(o)));
        const cats = new Set(poolStyle.map((it) => it.cat));
        const manquantes = FAMILLES.filter(([, c]) => !poolStyle.some((it) => c.includes(it.cat))).map(([n]) => n);
        console.log(`  ${saison.padEnd(11)}${id.padEnd(16)}${String(poolStyle.length).padStart(11)}${String(occ.size).padStart(11)}${String(cats.size).padStart(12)}` +
          `${(manquantes.length ? "familles vides : " + manquantes.length : "complète").padStart(22)}`);
      }
    }

    console.log(`\nAudit en lecture seule — aucune logique de production modifiée.`);
  }, 1_800_000);
});
