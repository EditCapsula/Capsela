import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import {
  coupeOf, formalityOf, intensiteOf, isStatement, matiereOf, metalOf, rolePieceOf, tonsOf,
} from "../src/lib/attributes";
import { morphoFit, morphoVigilance, styleFit } from "../src/lib/capsule";

// Audit du renommage du catalogue selon la convention arrêtée le 28/08/2026 :
//   NOM = TYPE + COUPE DISTINCTIVE + MATIÈRE SI NÉCESSAIRE
//
// Strictement en lecture. Ne produit aucun UPDATE : la sortie est un tableau
// de contrôle destiné à être relu avant toute écriture.
//
// La règle interdit de toucher à autre chose que `name`. Mais `name` n'est pas
// un libellé inerte : quand `coupe`, `morphologies`, `styles` ou `matiere` sont
// vides, le moteur retombe sur des expressions régulières appliquées AU NOM
// (cf. coupeOf, morphoFit, styleFit, matiereOf). Renommer peut donc déplacer le
// scoring sans toucher une seule colonne structurée.
//
// L'audit recalcule donc, pour chaque ligne, les onze attributs dérivés avec
// l'ancien et le nouveau nom, et sépare les renommages INERTES de ceux qui
// changent le comportement du moteur. Seuls les premiers respectent la
// contrainte 6 de la convention.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const STYLES = ["Casual chic", "Classique chic", "Romantique", "Bohème", "Streetwear", "Preppy", "Glamour"];
const MORPHOS = ["f_sablier", "f_triangle_inverse", "f_poire", "f_rectangle", "f_pomme"];

/** Mapping de coupe imposé par la convention (point 2). */
const COUPE_LIBELLE: Record<string, string> = {
  ample: "large",
  ajusté: "ajusté",
  ajuste: "ajusté",
  serré: "ajusté",
  serre: "ajusté",
  droit: "droit",
  oversize: "oversize",
  fluide: "fluide",
};

/** Casse et espaces uniquement — la convention interdit de réinterpréter le type. */
function normaliserType(sousType: string): string {
  const t = sousType.trim().replace(/\s+/g, " ");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/**
 * Libellé de coupe, UNIQUEMENT depuis la colonne structurée. Une coupe vide ne
 * produit rien : la convention interdit d'en déduire une depuis le nom actuel
 * (c'est précisément ce qui rendrait le renommage non réversible).
 */
function libelleCoupe(coupe: string | null): string | null {
  const c = (coupe || "").trim().toLowerCase();
  if (!c) return null;
  return COUPE_LIBELLE[c] || c;
}

/** Matière principale : le premier terme d'une valeur composée ("Lin / coton" → "lin"). */
function matierePrincipale(matiere: string | null): string | null {
  const m = (matiere || "").trim().toLowerCase();
  if (!m) return null;
  const premier = m.split(/\s*[/,+]\s*| et /)[0].trim();
  return premier || null;
}

/**
 * Insertion de la coupe après le nom de tête du type — "Pantalon à pinces" +
 * large → "Pantalon large à pinces", conformément aux exemples de la
 * convention. Un type d'un seul mot reçoit la coupe en suffixe.
 *
 * POINT AMBIGU, signalé et non tranché unilatéralement : les exemples fournis
 * ne s'accordent pas sur la place de la coupe ("Pantalon droit à pinces"
 * l'insère, "Robe longue fluide" la suffixe). L'insertion après le nom de tête
 * est retenue par défaut parce qu'elle reproduit les noms déjà en base
 * ("Pull ample col rond"). Le tableau de contrôle expose type et coupe
 * séparément pour que chaque cas soit vérifiable.
 */
function composer(type: string, coupe: string | null): string {
  if (!coupe) return type;
  const mots = type.split(" ");
  if (mots.length === 1) return `${type} ${coupe}`;
  return [mots[0], coupe, ...mots.slice(1)].join(" ");
}

function derives(row: VestiaireRow) {
  const it = rowToCatalogItem(row);
  if (!it) return null;
  return {
    coupe: coupeOf(it),
    formalite: formalityOf(it),
    statement: isStatement(it),
    matiere: matiereOf(it),
    metal: metalOf(it),
    role: rolePieceOf(it),
    tons: tonsOf(it),
    intensite: intensiteOf(it),
    styles: STYLES.filter((s) => styleFit(it, s)),
    morphoFit: MORPHOS.filter((m) => morphoFit(it, m)),
    morphoAvoid: MORPHOS.filter((m) => morphoVigilance(it, m)),
  };
}

function ecarts(row: VestiaireRow, nouveauNom: string): string[] {
  const avant = derives(row);
  const apres = derives({ ...row, name: nouveauNom });
  if (!avant || !apres) return [];
  return (Object.keys(avant) as (keyof typeof avant)[])
    .filter((c) => JSON.stringify(avant[c]) !== JSON.stringify(apres[c]))
    .map((c) => `${c}: ${JSON.stringify(avant[c])} → ${JSON.stringify(apres[c])}`);
}

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

describe("Convention de nommage du catalogue", () => {
  it("produit le tableau de contrôle", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SB_SECRET_KEY sont requis.");
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("vestiaire_universel")
      .select("*")
      .order("id", { ascending: true })
      .returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);

    // 1-2. TYPE + COUPE, sans matière. La matière n'entre en jeu qu'au vu des
    // collisions, donc après avoir construit tous les noms de base.
    const sansSousType: VestiaireRow[] = [];
    const base = new Map<number, { row: VestiaireRow; type: string; coupe: string | null; nom: string }>();
    for (const row of data) {
      const type = normaliserType(row.sous_type || "");
      if (!type) {
        sansSousType.push(row);
        continue;
      }
      const coupe = libelleCoupe(row.coupe);
      base.set(row.id, { row, type, coupe, nom: composer(type, coupe) });
    }

    // 3. Collisions : la matière n'est ajoutée QUE si deux pièces porteraient
    // sinon le même nom. Le genre est conservé dans le tableau — une collision
    // homme/femme n'appelle pas forcément une matière, c'est un cas à arbitrer.
    const parNom = new Map<string, number[]>();
    for (const [id, e] of base) parNom.set(e.nom, [...(parNom.get(e.nom) || []), id]);

    const final = new Map<number, { nom: string; raison: string }>();
    const collisionsIrresolues: { nom: string; ids: number[] }[] = [];
    for (const [nom, ids] of parNom) {
      if (ids.length === 1) {
        final.set(ids[0], { nom, raison: "" });
        continue;
      }
      const avecMatiere = ids.map((id) => {
        const e = base.get(id)!;
        const m = matierePrincipale(e.row.matiere);
        return { id, m, nom: m ? `${nom} en ${m}` : nom };
      });
      const encoreEnCollision = new Set(
        avecMatiere
          .map((a) => a.nom)
          .filter((n, i, arr) => arr.indexOf(n) !== i)
      );
      for (const a of avecMatiere) {
        const raison = !a.m
          ? `collision sur "${nom}" mais matière absente — non résolu`
          : encoreEnCollision.has(a.nom)
            ? `collision persistante malgré la matière — doublon probable`
            : `collision sur "${nom}" avec ${ids.filter((i) => i !== a.id).join(", ")}`;
        final.set(a.id, { nom: a.nom, raison });
      }
      if (encoreEnCollision.size || avecMatiere.some((a) => !a.m)) {
        collisionsIrresolues.push({ nom, ids });
      }
    }

    // 4. Impact moteur, ligne à ligne.
    const lignes: string[] = [
      ["id", "genre", "ancien_nom", "sous_type", "coupe", "matiere", "nouveau_nom", "raison_matiere", "impact_moteur"]
        .map(csv)
        .join(","),
    ];
    let inchanges = 0;
    const inertes: number[] = [];
    const impactes: { id: number; ancien: string; nouveau: string; ecarts: string[] }[] = [];

    for (const [id, e] of base) {
      const cible = final.get(id)!;
      const ancien = (e.row.name || "").trim();
      if (cible.nom === ancien) {
        inchanges++;
        continue;
      }
      const diff = ecarts(e.row, cible.nom);
      if (diff.length) impactes.push({ id, ancien, nouveau: cible.nom, ecarts: diff });
      else inertes.push(id);
      lignes.push(
        [id, e.row.genre, ancien, e.row.sous_type, e.row.coupe, e.row.matiere, cible.nom, cible.raison, diff.join(" | ")]
          .map(csv)
          .join(",")
      );
    }

    writeFileSync("tableau-de-controle-noms.csv", lignes.join("\n"), "utf8");

    console.log(`\nCatalogue : ${data.length} ligne(s).`);
    console.log(`  ${inchanges} déjà conforme(s) — aucun changement de nom.`);
    console.log(`  ${inertes.length} renommage(s) INERTE(S) — aucun attribut dérivé ne bouge.`);
    console.log(`  ${impactes.length} renommage(s) qui CHANGENT le comportement du moteur.`);
    if (sansSousType.length) {
      console.log(`  ${sansSousType.length} ligne(s) sans sous_type — aucun nom proposé :`);
      for (const r of sansSousType.slice(0, 20)) console.log(`      [#${r.id}] ${r.name}`);
      if (sansSousType.length > 20) console.log(`      … et ${sansSousType.length - 20} autre(s).`);
    }

    if (impactes.length) {
      console.log(`\n── Renommages à arbitrer (contrainte 6 non respectée) ──`);
      for (const i of impactes) {
        console.log(`  [#${i.id}] "${i.ancien}" → "${i.nouveau}"`);
        for (const e of i.ecarts) console.log(`      ⚠ ${e}`);
      }
    }

    if (collisionsIrresolues.length) {
      console.log(`\n── Collisions que la matière ne résout pas ──`);
      for (const c of collisionsIrresolues) console.log(`  "${c.nom}" → ids ${c.ids.join(", ")}`);
    }

    console.log(`\nTableau complet : tableau-de-controle-noms.csv (artefact du job).`);
    console.log("Aucune modification effectuée — audit en lecture seule.");
  });
});
