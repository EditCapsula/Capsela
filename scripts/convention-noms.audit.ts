import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { STYLE_ID_TO_CATALOG_LABEL } from "../src/lib/profile";
import {
  coupeOf, formalityOf, intensiteOf, isStatement, matiereOf, metalOf, rolePieceOf, tonsOf,
} from "../src/lib/attributes";
import { morphoFit, morphoVigilance, styleFit } from "../src/lib/capsule";
import { composerNom, estLongueur, matierePrincipale, type Decoupage } from "../src/lib/conventionNoms";

// Audit du renommage du catalogue — convention arrêtée le 28/08/2026 :
//   TYPE → LONGUEUR → COUPE → DÉTAIL → MATIÈRE (seulement si nécessaire)
//
// Strictement en lecture. Ne produit aucun UPDATE : la sortie est un tableau
// de contrôle destiné à être relu avant toute écriture.
//
// Deux principes de la convention gouvernent tout le reste :
//   · ne jamais déduire un attribut absent des données structurées ;
//   · ne jamais dupliquer une caractéristique déjà portée par sous_type.
//
// Il n'existe AUCUNE colonne de longueur en base : la longueur ne peut donc
// venir que de sous_type, par analyse lexicale. Le lexique ci-dessous est
// volontairement fermé, et tout terme non reconnu est signalé plutôt
// qu'interprété — c'est la consigne "signale au lieu de deviner".
//
// La contrainte "ne modifier que name" demande enfin une vérification que le
// nom ne mérite pas à première vue : quand coupe, morphologies, styles ou
// matiere sont vides, le moteur retombe sur des expressions régulières
// appliquées AU NOM (coupeOf, morphoFit, styleFit, matiereOf). Renommer peut
// donc déplacer le scoring sans toucher une colonne structurée. L'audit
// recalcule les onze attributs dérivés avant/après et sépare les renommages
// inertes de ceux qui changent le comportement.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// LIBELLÉS catalogue, et non StyleId : ce sont les valeurs que porte la
// colonne `styles` et qu'attend styleFit(item, label). Ils ne touchent jamais
// `profile.styles`. Dérivés de la table de correspondance plutôt qu'écrits en
// dur — la liste précédente en omettait un, « Minimaliste ».
const LIBELLES_STYLE = Object.values(STYLE_ID_TO_CATALOG_LABEL);
const MORPHOS = ["f_sablier", "f_triangle_inverse", "f_poire", "f_rectangle", "f_pomme"];

function derives(row: VestiaireRow) {
  const it = rowToCatalogItem(row);
  if (!it) return null;
  return {
    coupe: coupeOf(it), formalite: formalityOf(it), statement: isStatement(it),
    matiere: matiereOf(it), metal: metalOf(it), role: rolePieceOf(it),
    tons: tonsOf(it), intensite: intensiteOf(it),
    styles: LIBELLES_STYLE.filter((s) => styleFit(it, s)),
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

    interface Entree {
      row: VestiaireRow;
      d: Decoupage;
      coupe: string | null;
      coupeInconnue: boolean;
      coupeDejaPresente: boolean;
      nomBase: string;
    }

    const sansSousType: VestiaireRow[] = [];
    const base = new Map<number, Entree>();

    for (const row of data) {
      const sousType = (row.sous_type || "").trim();
      if (!sousType) {
        sansSousType.push(row);
        continue;
      }
      const c = composerNom(sousType, row.coupe);
      base.set(row.id, {
        row, d: c.decoupage, coupe: c.coupe,
        coupeInconnue: c.coupeInconnue, coupeDejaPresente: c.coupeDejaPresente, nomBase: c.nom,
      });
    }

    // MATIÈRE : ajoutée uniquement quand deux pièces porteraient le même nom.
    const parNom = new Map<string, number[]>();
    for (const [id, e] of base) parNom.set(e.nomBase, [...(parNom.get(e.nomBase) || []), id]);

    const final = new Map<number, { nom: string; matiere: string | null; raison: string }>();
    const collisionsIrresolues: { nom: string; ids: number[]; motif: string }[] = [];

    for (const [nom, ids] of parNom) {
      if (ids.length === 1) {
        final.set(ids[0], { nom, matiere: null, raison: "" });
        continue;
      }
      const variantes = ids.map((id) => {
        const m = matierePrincipale(base.get(id)!.row.matiere);
        return { id, m, nom: m ? `${nom} en ${m}` : nom };
      });
      const persistantes = new Set(variantes.map((v) => v.nom).filter((n, i, a) => a.indexOf(n) !== i));
      for (const v of variantes) {
        const raison = !v.m
          ? `collision sur "${nom}", matière absente — NON RÉSOLU`
          : persistantes.has(v.nom)
            ? `collision persistante malgré la matière — NON RÉSOLU`
            : `collision sur "${nom}" avec ${ids.filter((i) => i !== v.id).join(", ")}`;
        final.set(v.id, { nom: v.nom, matiere: v.m, raison });
      }
      if (persistantes.size) collisionsIrresolues.push({ nom, ids, motif: "matière identique ou absente" });
      else if (variantes.some((v) => !v.m)) collisionsIrresolues.push({ nom, ids, motif: "matière absente" });
    }

    const lignes: string[] = [
      ["id", "genre", "ancien_nom", "sous_type", "longueur", "coupe", "detail", "matiere", "nouveau_nom", "raison_matiere", "impact_moteur"]
        .map(csv).join(","),
    ];
    let inchanges = 0;
    const inertes: number[] = [];
    const impactes: { id: number; ancien: string; nouveau: string; ecarts: string[] }[] = [];
    const aArbitrer: string[] = [];

    for (const [id, e] of base) {
      const cible = final.get(id)!;
      const ancien = (e.row.name || "").trim();
      if (e.coupeInconnue) aArbitrer.push(`  [#${id}] coupe "${e.row.coupe}" hors mapping — conservée telle quelle`);
      if (e.d.longueursMultiples.length) aArbitrer.push(`  [#${id}] plusieurs longueurs dans sous_type : ${e.d.longueursMultiples.join(", ")}`);
      if (e.d.longueurDeplacee) aArbitrer.push(`  [#${id}] longueur "${e.d.longueur}" déplacée : "${e.row.sous_type}" → "${cible.nom}"`);
      if (e.coupeDejaPresente) aArbitrer.push(`  [#${id}] coupe "${e.row.coupe}" déjà dans sous_type — non dupliquée`);

      if (cible.nom === ancien) { inchanges++; continue; }
      const diff = ecarts(e.row, cible.nom);
      if (diff.length) impactes.push({ id, ancien, nouveau: cible.nom, ecarts: diff });
      else inertes.push(id);
      lignes.push([
        id, e.row.genre, ancien, e.row.sous_type, e.d.longueur, e.coupe, e.d.detail,
        cible.matiere, cible.nom, cible.raison, diff.join(" | "),
      ].map(csv).join(","));
    }

    writeFileSync("tableau-de-controle-noms.csv", lignes.join("\n"), "utf8");

    // ── Jeu sûr ────────────────────────────────────────────────────────────
    // Un renommage n'est retenu que s'il est inerte pour le moteur ET si le
    // nom final reste unique dans TOUT le catalogue. L'unicité est vérifiée
    // contre l'ensemble complet des noms d'arrivée — les noms proposés pour
    // les lignes renommées comme les noms actuels des lignes qu'on ne touche
    // pas. Sans cette seconde condition, renommer une ligne "propre" peut la
    // faire entrer en collision avec une voisine laissée en place.
    const inertesSet = new Set(inertes);
    const nomsFinaux = new Map<string, number>();
    for (const [id, e] of base) {
      const ancien = (e.row.name || "").trim();
      const cible = final.get(id)!;
      const retenu = inertesSet.has(id) ? cible.nom : ancien;
      nomsFinaux.set(retenu, (nomsFinaux.get(retenu) || 0) + 1);
    }
    // Les lignes sans sous_type gardent leur nom : elles comptent aussi.
    for (const r of sansSousType) {
      const n = (r.name || "").trim();
      nomsFinaux.set(n, (nomsFinaux.get(n) || 0) + 1);
    }

    const sur: { id: number; ancien: string; nouveau: string }[] = [];
    const ecartesPourCollision: { id: number; nouveau: string }[] = [];
    for (const id of inertes) {
      const e = base.get(id)!;
      const cible = final.get(id)!;
      if ((nomsFinaux.get(cible.nom) || 0) > 1) {
        ecartesPourCollision.push({ id, nouveau: cible.nom });
        continue;
      }
      sur.push({ id, ancien: (e.row.name || "").trim(), nouveau: cible.nom });
    }

    // SQL en une seule instruction : la garde `v.name = c.ancien` fait qu'une
    // ligne modifiée entre-temps n'est pas touchée, plutôt que d'être écrasée.
    const sql = sur.length
      ? [
          "-- Jeu sûr : renommages inertes pour le moteur et sans collision de nom.",
          `-- ${sur.length} ligne(s). Généré le ${new Date().toISOString().slice(0, 10)} — à relire avant exécution.`,
          "update vestiaire_universel v",
          "set name = c.nouveau",
          "from (values",
          sur
            .map((r, i) => `  (${r.id}, '${r.ancien.replace(/'/g, "''")}', '${r.nouveau.replace(/'/g, "''")}')${i === sur.length - 1 ? "" : ","}`)
            .join("\n"),
          ") as c(id, ancien, nouveau)",
          "where v.id = c.id and v.name = c.ancien;",
        ].join("\n")
      : "-- Aucun renommage sûr.";
    writeFileSync("renommages-surs.sql", sql + "\n", "utf8");


    if (sansSousType.length) {
      console.log(`\n── ${sansSousType.length} ligne(s) sans sous_type — aucun nom proposé ──`);
      for (const r of sansSousType.slice(0, 25)) console.log(`  [#${r.id}] ${r.name} (${r.category})`);
      if (sansSousType.length > 25) console.log(`  … et ${sansSousType.length - 25} autre(s).`);
    }

    if (collisionsIrresolues.length) {
      console.log(`\n── Collisions que la matière ne résout pas ──`);
      for (const c of collisionsIrresolues) console.log(`  "${c.nom}" → ids ${c.ids.join(", ")} (${c.motif})`);
    }

    if (aArbitrer.length) {
      console.log(`\n── Cas ambigus signalés, non devinés ──`);
      for (const l of aArbitrer) console.log(l);
    }

    // Vocabulaire réel de sous_type : c'est la liste à arbitrer. Le parseur ne
    // connaît que le lexique fermé des longueurs ; TOUT le reste est rangé en
    // "détail" par défaut. Un terme de longueur absent du lexique apparaîtra
    // donc ici comme détail — c'est précisément ce qu'il faut repérer.
    const vocab = new Map<string, { n: number; exemples: Set<string> }>();
    for (const e of base.values()) {
      const sousType = (e.row.sous_type || "").trim();
      for (const mot of sousType.split(/\s+/).slice(1)) {
        if (!mot) continue;
        const v = vocab.get(mot) || { n: 0, exemples: new Set<string>() };
        v.n += 1;
        if (v.exemples.size < 3) v.exemples.add(sousType);
        vocab.set(mot, v);
      }
    }
    const termes = [...vocab.entries()].sort((a, b) => b[1].n - a[1].n);
    writeFileSync(
      "termes-sous-type.csv",
      [["terme", "occurrences", "classe_par_le_parseur", "exemples_sous_type"].map(csv).join(",")]
        .concat(
          termes.map(([mot, v]) =>
            [mot, v.n, estLongueur(mot) ? "LONGUEUR" : "détail", [...v.exemples].join(" | ")].map(csv).join(",")
          )
        )
        .join("\n"),
      "utf8"
    );

    console.log(`\n── Termes de sous_type à arbitrer (${termes.length}) ──`);
    console.log(`   "détail" = tout ce qui n'est pas dans le lexique des longueurs.`);
    console.log(`   Repérer ici les longueurs qui manqueraient au lexique.`);
    for (const [mot, v] of termes) {
      console.log(`  ${estLongueur(mot) ? "LONGUEUR" : "détail  "}  ${mot} (${v.n})`);
    }

    const coupesInconnues = new Map<string, number>();
    for (const e of base.values()) {
      if (e.coupeInconnue && e.row.coupe) coupesInconnues.set(e.row.coupe, (coupesInconnues.get(e.row.coupe) || 0) + 1);
    }
    if (coupesInconnues.size) {
      console.log(`\n── Valeurs de coupe hors mapping (conservées telles quelles) ──`);
      for (const [v, n] of coupesInconnues) console.log(`  "${v}" (${n})`);
    }

    if (impactes.length) {
      // Regroupés par nature d'impact : 136 entrées à plat sont illisibles, et
      // ce qui compte pour arbitrer n'est pas la ligne mais le motif — combien
      // de pièces perdent leur coupe, combien gagnent une affinité, etc.
      const familles = new Map<string, typeof impactes>();
      for (const i of impactes) {
        const cle = i.ecarts.map((e) => e.split(":")[0]).sort().join(" + ");
        familles.set(cle, [...(familles.get(cle) || []), i]);
      }
      console.log(`\n── Renommages qui MODIFIENT le moteur, par nature (contrainte 6) ──`);
      for (const [cle, lignes] of [...familles.entries()].sort((a, b) => b[1].length - a[1].length)) {
        console.log(`\n  ▸ ${cle} — ${lignes.length} pièce(s)`);
        // Transitions distinctes observées dans cette famille, avec leur poids.
        const transitions = new Map<string, number>();
        for (const l of lignes) for (const e of l.ecarts) transitions.set(e, (transitions.get(e) || 0) + 1);
        for (const [t, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)) {
          console.log(`      ${n}×  ${t}`);
        }
        console.log(`      exemples : ${lignes.slice(0, 3).map((l) => `[#${l.id}] "${l.ancien}" → "${l.nouveau}"`).join("  ·  ")}`);
        console.log(`      ids : ${lignes.map((l) => l.id).join(", ")}`);
      }
    }

    // Bilan en dernier : c'est la première chose qu'on lit dans un log tronqué.
    console.log(`\n════════ BILAN ════════`);
    console.log(`Catalogue : ${data.length} ligne(s), ${sansSousType.length} sans sous_type.`);
    console.log(`  ${inchanges} déjà conforme(s).`);
    console.log(`  ${inertes.length} renommage(s) INERTE(S).`);
    console.log(`  ${impactes.length} renommage(s) qui CHANGENT le moteur.`);
    console.log(`  ${collisionsIrresolues.length} collision(s) de nom NON RÉSOLUE(S) par la matière.`);
    console.log(`  → JEU SÛR : ${sur.length} renommage(s) applicables (inertes ET nom final unique).`);
    console.log(`     ${ecartesPourCollision.length} inerte(s) écarté(s) parce que leur nom final serait partagé.`);
    console.log(`  ${aArbitrer.length} cas ambigu(s) signalé(s).`);

    console.log(`\nArtefacts : tableau-de-controle-noms.csv, termes-sous-type.csv, renommages-surs.sql.`);
    console.log("Aucune modification effectuée — audit en lecture seule.");
  });
});
