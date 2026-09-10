import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { SUBTYPES } from "../src/lib/data";
import type { CatalogItem, } from "../src/lib/catalog";
import type { CategoryKey } from "../src/lib/types";

// SOUS-TYPES RÉELS DU VESTIAIRE — LECTURE SEULE, AUCUNE ÉCRITURE.
//
// POURQUOI CET AUDIT EXISTE.
//
// Deux règles de production comparent `it.subtype` par ÉGALITÉ STRICTE à un
// vocabulaire canonique :
//
//   R-B10      isShirtLike   subtype === "Chemise" || subtype === "Chemisier"
//   mailles    isClosedKnit  cat === "pull" && (subtype === "Pull" || "Col roulé")
//
// Or `subtype` est peuplé par DEUX voies, et une seule est normalisée :
//
//   catalog.ts    subtype = detectSubtype(cat, name)  -> contraint à SUBTYPES
//   vestiaire.ts  subtype = row.sous_type             -> TEXTE LIBRE de la base
//
// Le vestiaire réel — celui que voient les utilisatrices — passe par la
// seconde. Une égalité stricte y compare donc un vocabulaire canonique à du
// texte libre : toute casse, tout accent, tout libellé voisin ou tout NULL
// fait échouer le test SANS AUCUN SIGNAL.
//
// Ce n'est plus une hypothèse pour la règle des mailles fermées : l'audit
// `pull-contrat` du 31/08/2026 a mesuré son bras de neutralisation (R) comme
// STRICTEMENT IDENTIQUE à la production sur toutes les métriques, pendant que
// son échantillon contenait « Pull col roulé fin + Pantalon + Pull col rond
// gris chiné » — deux pulls superposés. La règle est inerte, c'est établi.
//
// R-B10, elle, est en production depuis le 21/08/2026 et n'a jamais été
// vérifiée sur les données. Elle a pourtant le MÊME défaut de construction.
// C'est la vraie raison de cet audit : de deux choses l'une, ou `sous_type`
// est renseigné correctement pour les chemises et R-B10 fonctionne, ou elle
// n'a jamais corrigé le bug qu'elle prétend corriger.
//
// CE QUE CET AUDIT NE FAIT PAS. Il ne propose aucune valeur de remplacement,
// ne compte aucune pièce comme « mal classée », et ne conclut pas qu'il faut
// écrire en base. Il rend une distribution. Un écart entre le nom d'une pièce
// et son sous-type est un FAIT À INSTRUIRE, jamais une donnée à corriger
// d'office : « UNKNOWN + données honnêtes » plutôt que « donnée renseignée
// mais stylistiquement fausse ».

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) + " %" : "—");
/** Normalisation la plus permissive imaginable : casse, accents, espaces. */
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

describe("sous-types réels du vestiaire", () => {
  it("rend la distribution catégorie × sous_type, sans rien écrire", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);

    // On mesure sur les pièces telles que le MOTEUR les voit, pas sur les
    // lignes brutes : `rowToCatalogItem` remappe des catégories (les sacs
    // catalogués en "accessoires", notamment) et c'est cette vue-là que les
    // règles consultent.
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const paires = brutes
      .map((r) => ({ row: r, it: rowToCatalogItem(r) }))
      .filter((p): p is { row: VestiaireRow; it: CatalogItem } => Boolean(p.it));
    console.log(`Catalogue exploitable : ${paires.length} pièces sur ${rows.length} lignes.`);

    // ═══ 1 · TAUX DE RENSEIGNEMENT ═══
    console.log(`\n════════ 1 · SOUS_TYPE EST-IL SEULEMENT RENSEIGNÉ ? ════════`);
    console.log(`  Une colonne vide rend TOUTE règle qui la teste inerte, sans exception.`);
    console.log(`  ${"catégorie".padEnd(14)}${"pièces".padStart(8)}${"sous_type vide".padStart(16)}${"part vide".padStart(11)}`);
    const parCat = new Map<CategoryKey, { row: VestiaireRow; it: CatalogItem }[]>();
    for (const p of paires) {
      if (!parCat.has(p.it.cat)) parCat.set(p.it.cat, []);
      parCat.get(p.it.cat)!.push(p);
    }
    const cats = [...parCat.keys()].sort();
    let videTotal = 0;
    for (const cat of cats) {
      const l = parCat.get(cat)!;
      const vides = l.filter((p) => !p.it.subtype || !p.it.subtype.trim()).length;
      videTotal += vides;
      console.log(`  ${cat.padEnd(14)}${String(l.length).padStart(8)}${String(vides).padStart(16)}${pct(vides, l.length).padStart(11)}`);
    }
    console.log(`  ${"TOTAL".padEnd(14)}${String(paires.length).padStart(8)}${String(videTotal).padStart(16)}${pct(videTotal, paires.length).padStart(11)}`);

    // ═══ 2 · VALEURS RÉELLES, POUR LES TROIS CATÉGORIES QUI PORTENT DES RÈGLES ═══
    console.log(`\n════════ 2 · VALEURS RÉELLES DE SOUS_TYPE ════════`);
    console.log(`  Les catégories qui portent une règle de superposition. « canon » indique si la`);
    console.log(`  valeur appartient au vocabulaire SUBTYPES du même nom — celui auquel les règles`);
    console.log(`  comparent. Une valeur hors vocabulaire n'est PAS une erreur en soi : c'est un`);
    console.log(`  écart entre ce que la base dit et ce que le code croit qu'elle dit.`);
    for (const cat of ["pull", "haut", "robe"] as CategoryKey[]) {
      const l = parCat.get(cat) ?? [];
      const canon = SUBTYPES[cat] ?? [];
      const compte = new Map<string, number>();
      for (const p of l) compte.set(p.it.subtype ?? "(vide)", (compte.get(p.it.subtype ?? "(vide)") ?? 0) + 1);
      console.log(`\n  ── ${cat} (${l.length} pièces) — vocabulaire attendu : ${canon.join(", ") || "aucun"}`);
      console.log(`  ${"sous_type".padEnd(34)}${"n".padStart(6)}${"canon".padStart(8)}${"canon si normalisé".padStart(20)}`);
      for (const [v, n] of [...compte.entries()].sort((a, b) => b[1] - a[1])) {
        const exact = canon.includes(v) ? "oui" : "—";
        const apresNorm = canon.some((c) => norm(c) === norm(v)) ? "oui" : "—";
        console.log(`  ${v.padEnd(34)}${String(n).padStart(6)}${exact.padStart(8)}${apresNorm.padStart(20)}`);
      }
    }

    // ═══ 3 · LES DEUX RÈGLES, MESURÉES ═══
    console.log(`\n════════ 3 · CE QUE LES DEUX RÈGLES VOIENT RÉELLEMENT ════════`);
    console.log(`  Colonne « règle » : ce que le code compte aujourd'hui, par égalité stricte.`);
    console.log(`  Colonne « nom » : ce que le NOM de la pièce laisse attendre. L'écart entre les`);
    console.log(`  deux est la mesure de l'inertie — il ne dit pas laquelle des deux a raison.`);

    const pulls = parCat.get("pull") ?? [];
    const regleFermee = pulls.filter((p) => p.it.subtype === "Pull" || p.it.subtype === "Col roulé");
    const nomFermee = pulls.filter((p) => /\bpull\b|col roul|sweat|maille c[oô]t|marini[eè]re/i.test(p.it.name));
    const nomOuverte = pulls.filter((p) => /cardigan|gilet|veste en maille/i.test(p.it.name));
    console.log(`\n  ── mailles fermées (isClosedKnit) sur ${pulls.length} pulls`);
    console.log(`     règle (subtype === "Pull" | "Col roulé") : ${regleFermee.length}`);
    console.log(`     nom évoquant une maille FERMÉE             : ${nomFermee.length}`);
    console.log(`     nom évoquant une maille OUVERTE            : ${nomOuverte.length}`);
    console.log(`     ni l'un ni l'autre                          : ${pulls.length - nomFermee.length - nomOuverte.length}`);
    if (regleFermee.length === 0 && nomFermee.length > 0) {
      console.log(`     >>> La règle ne voit AUCUNE maille fermée alors que ${nomFermee.length} pièces en portent le nom.`);
      console.log(`         C'est la confirmation par les données de ce que le bras R de l'audit`);
      console.log(`         pull-contrat avait montré par la mesure : la règle est inerte.`);
    }

    const hauts = parCat.get("haut") ?? [];
    const regleChemise = hauts.filter((p) => p.it.subtype === "Chemise" || p.it.subtype === "Chemisier");
    const nomChemise = hauts.filter((p) => /chemis/i.test(p.it.name));
    console.log(`\n  ── R-B10 (isShirtLike) sur ${hauts.length} hauts — RÈGLE DE PRODUCTION DEPUIS LE 21/08/2026`);
    console.log(`     règle (subtype === "Chemise" | "Chemisier") : ${regleChemise.length}`);
    console.log(`     nom contenant « chemis »                     : ${nomChemise.length}`);
    const manquees = nomChemise.filter((p) => !regleChemise.includes(p));
    if (manquees.length) {
      console.log(`     >>> ${manquees.length} chemises que R-B10 ne voit pas. Exemples (nom -> sous_type) :`);
      for (const p of manquees.slice(0, 12)) console.log(`         ${p.it.name}  ->  ${p.it.subtype ?? "(vide)"}`);
    } else if (regleChemise.length) {
      console.log(`     >>> Aucun écart : R-B10 fonctionne sur les données réelles.`);
    }

    // ═══ 4 · LA ROBE-PULL, TROU INDÉPENDANT DES DONNÉES ═══
    console.log(`\n════════ 4 · LA ROBE-PULL ════════`);
    console.log(`  isClosedKnit exige cat === "pull". Une robe-pull a cat === "robe" : elle est`);
    console.log(`  INVISIBLE à la règle, et ce trou-là tiendrait même avec un sous_type parfait.`);
    const robes = parCat.get("robe") ?? [];
    const robesPull = robes.filter((p) => p.it.subtype === "Pull" || /robe pull|pull.?robe|robe en maille/i.test(p.it.name));
    console.log(`  robes au total : ${robes.length} — dont robes-pull repérables : ${robesPull.length}`);
    for (const p of robesPull.slice(0, 12)) console.log(`     ${p.it.name}  ->  ${p.it.subtype ?? "(vide)"}`);

    // ═══ 5 · L'AXE OUVERT / FERMÉ EXISTE-T-IL AILLEURS ? ═══
    console.log(`\n════════ 5 · UN AUTRE CHAMP PORTE-T-IL L'AXE OUVERT / FERMÉ ? ════════`);
    console.log(`  L'arbitrage éditorial du 31/08/2026 porte sur « deux mailles FERMÉES ». Si`);
    console.log(`  sous_type ne peut pas l'exprimer, il faut savoir si un autre champ le peut,`);
    console.log(`  AVANT d'envisager quoi que ce soit. On ne mesure ici que la disponibilité des`);
    console.log(`  champs, pas leur pertinence : aucun d'eux ne décrit une fermeture.`);
    console.log(`  ${"champ".padEnd(16)}${"renseigné sur les pulls".padStart(26)}${"valeurs distinctes".padStart(20)}`);
    const champs: [string, (p: { row: VestiaireRow; it: CatalogItem }) => string | null | undefined][] = [
      ["coupe", (p) => p.it.coupe],
      ["matiere", (p) => p.it.matiere],
      ["role_piece", (p) => p.it.rolePiece],
      ["niveau_formalite", (p) => (p.it.niveauFormalite == null ? null : String(p.it.niveauFormalite))],
    ];
    for (const [nom, lire] of champs) {
      const vals = pulls.map(lire).filter((v): v is string => Boolean(v && String(v).trim()));
      console.log(`  ${nom.padEnd(16)}${`${vals.length}/${pulls.length}`.padStart(26)}${String(new Set(vals).size).padStart(20)}`);
    }

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucun ALTER, aucune valeur proposée.`);
    console.log(`  Cet audit ne décide rien : il dit ce que la base contient, pour qu'un`);
    console.log(`  arbitrage porte sur des faits et non sur ce que le code suppose.`);
  });
});
