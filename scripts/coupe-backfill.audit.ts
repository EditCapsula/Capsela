import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Étape A du chantier "normalisation de coupe" — AUDIT SEUL, aucune écriture.
//
// Objectif : rendre explicite dans la colonne `coupe` ce que coupeOf() déduit
// aujourd'hui du NOM, afin de pouvoir ensuite supprimer ce repli sans changer
// le comportement. Mais la consigne du 28/08/2026 est de ne PAS fossiliser les
// erreurs : les cas sémantiquement douteux sont signalés, jamais convertis en
// silence.
//
// Ce que coupeOf() fait réellement (attributes.ts:252) :
//   1. colonne coupe = "Ample"            -> oversize
//   2. colonne coupe = "Serré" | "Ajusté" -> ajusté
//   3. /oversize|large|ample|évasé/  sur (name + " " + color) -> oversize
//   4. /ajusté|moulant|slim|cintré|côtelé/ sur (name + " " + color) -> ajusté
//   5. sinon                               -> regular
//
// Point de vigilance : coupeOf lit `name + color`, JAMAIS `sous_type`. Un
// comptage fait sur sous_type ne décrit donc pas le comportement du moteur.
// Les deux périmètres sont mesurés séparément ici.
//
// Le type Coupe n'admet que "Serré" | "Ajusté" | "Ample" (types.ts:104), et une
// contrainte CHECK l'impose en base sur vestiaire_universel ET dressing_items.
// "Droit" et "Fluide" sont donc hors modèle : décision du 28/08/2026, on ne
// touche pas à la contrainte. Une pièce droite reste `null`, ce qui ne perd
// rien puisque coupeOf renvoie "regular" pour null comme pour un nom muet.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

type Coupe = "Serré" | "Ajusté" | "Ample";
type Classe = "certain" | "probable" | "ambigu" | "non_representable" | "incoherence";
type Confiance = "haute" | "moyenne" | "faible";

/** Mots dont la présence dans le nom fait basculer coupeOf, avec la valeur Coupe correspondante. */
const VERS_AMPLE = ["oversize", "large", "ample"];
const VERS_SERRE = ["skinny", "serré"];
const VERS_AJUSTE = ["ajusté", "moulant", "slim", "cintré"];
/** Traités à part : leur équivalence avec une valeur de Coupe n'est pas acquise. */
const DOUTEUX = ["côtelé", "évasé"];

/**
 * Un mot de coupe qui suit "manches", "col" ou "épaules" ne qualifie pas la
 * coupe du vêtement mais un de ses éléments. coupeOf ne fait pas cette
 * distinction — d'où des faux positifs à signaler plutôt qu'à recopier.
 */
const PORTEURS_LOCAUX = ["manche", "manches", "col", "épaule", "épaules", "encolure"];

function motTrouve(texte: string, mots: string[]): { mot: string; index: number } | null {
  for (const mot of mots) {
    const i = texte.indexOf(mot);
    if (i >= 0) return { mot, index: i };
  }
  return null;
}

/** Le mot qualifie-t-il un élément (manche, col) plutôt que le vêtement ? */
function qualifieUnElement(texte: string, index: number): string | null {
  const avant = texte.slice(0, index).trim().split(/\s+/);
  const precedent = avant[avant.length - 1] || "";
  const avantPrecedent = avant[avant.length - 2] || "";
  for (const p of PORTEURS_LOCAUX) {
    if (precedent === p || avantPrecedent === p) return p;
  }
  return null;
}

interface Ligne {
  id: number;
  name: string | null;
  category: string | null;
  sous_type: string | null;
  couleur_dominante: string | null;
  coupe: string | null;
}

interface Verdict {
  ligne: Ligne;
  coupeActuelle: string;
  comportementActuel: "ajusté" | "regular" | "oversize";
  proposee: Coupe | null;
  origine: string;
  motif: string;
  confiance: Confiance;
  classe: Classe;
}

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

describe("Backfill de coupe — audit", () => {
  it("classe chaque article sans rien écrire", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SB_SECRET_KEY sont requis.");
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("vestiaire_universel")
      .select("id, name, category, sous_type, couleur_dominante, coupe")
      .order("id", { ascending: true })
      .returns<Ligne[]>();
    if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);

    const verdicts: Verdict[] = [];

    for (const ligne of data) {
      // Exactement la base lue par coupeOf : name + " " + color. Jamais sous_type.
      const texte = `${ligne.name || ""} ${ligne.couleur_dominante || ""}`.toLowerCase();
      const colonne = (ligne.coupe || "").trim();

      // 1-2. Colonne déjà renseignée : coupeOf ne lit pas le nom.
      if (colonne === "Ample" || colonne === "Serré" || colonne === "Ajusté") {
        const comportement = colonne === "Ample" ? "oversize" : "ajusté";
        // Le nom contredit-il la colonne ? Signalé, jamais corrigé ici.
        const contradiction =
          (comportement === "oversize" && motTrouve(texte, [...VERS_AJUSTE, ...VERS_SERRE])) ||
          (comportement === "ajusté" && motTrouve(texte, VERS_AMPLE));
        verdicts.push({
          ligne, coupeActuelle: colonne, comportementActuel: comportement,
          proposee: null,
          origine: "colonne structurée",
          motif: contradiction
            ? `le nom contient « ${contradiction.mot} », qui contredit la colonne`
            : "déjà renseignée, rien à faire",
          confiance: "haute",
          classe: contradiction ? "incoherence" : "certain",
        });
        continue;
      }

      // 3-5. Colonne vide : c'est le nom qui décide aujourd'hui.
      const douteux = motTrouve(texte, DOUTEUX);
      const ample = motTrouve(texte, VERS_AMPLE);
      const serre = motTrouve(texte, VERS_SERRE);
      const ajuste = motTrouve(texte, VERS_AJUSTE);

      // "évasé" -> oversize aujourd'hui. Décision : non représentable, on ne
      // touche pas. "côtelé" -> ajusté aujourd'hui : texture, pas coupe.
      if (douteux && !ample && !serre && !ajuste) {
        const estEvase = douteux.mot === "évasé";
        verdicts.push({
          ligne, coupeActuelle: "—",
          comportementActuel: estEvase ? "oversize" : "ajusté",
          proposee: null,
          origine: `nom : « ${douteux.mot} »`,
          motif: estEvase
            ? "évasé décrit un volume croissant vers le bas, pas une ampleur générale — aucune valeur de Coupe ne le représente"
            : "côtelé décrit une matière, pas une coupe — non déductible avec confiance",
          confiance: "faible",
          classe: estEvase ? "non_representable" : "ambigu",
        });
        continue;
      }

      const trouve = ample || serre || ajuste;
      if (!trouve) {
        verdicts.push({
          ligne, coupeActuelle: "—", comportementActuel: "regular",
          proposee: null, origine: "aucun mot de coupe",
          motif: "reste null — coupeOf renvoie regular pour null comme pour un nom muet",
          confiance: "haute", classe: "certain",
        });
        continue;
      }

      const cible: Coupe = ample ? "Ample" : serre ? "Serré" : "Ajusté";
      const comportement = ample ? "oversize" : "ajusté";
      const element = qualifieUnElement(texte, trouve.index);
      const aussiDouteux = douteux ? ` (contient aussi « ${douteux.mot} »)` : "";

      verdicts.push({
        ligne, coupeActuelle: "—", comportementActuel: comportement,
        proposee: cible,
        origine: `nom : « ${trouve.mot} »`,
        motif: element
          ? `« ${trouve.mot} » suit « ${element} » : qualifie un élément, pas la coupe du vêtement${aussiDouteux}`
          : `« ${trouve.mot} » qualifie la coupe du vêtement${aussiDouteux}`,
        confiance: element ? "faible" : aussiDouteux ? "moyenne" : "haute",
        classe: element ? "ambigu" : aussiDouteux ? "probable" : "certain",
      });
    }

    // ── Sorties ────────────────────────────────────────────────────────────
    const aEcrire = verdicts.filter((v) => v.proposee !== null);
    const parClasse = (c: Classe) => verdicts.filter((v) => v.classe === c);

    writeFileSync(
      "coupe-backfill.csv",
      [
        ["id", "nom", "categorie", "sous_type", "coupe_actuelle", "comportement_actuel",
         "coupe_proposee", "origine", "motif", "confiance", "classe"].map(csv).join(","),
      ]
        .concat(
          verdicts
            .filter((v) => v.classe !== "certain" || v.proposee !== null)
            .map((v) =>
              [v.ligne.id, v.ligne.name, v.ligne.category, v.ligne.sous_type, v.coupeActuelle,
               v.comportementActuel, v.proposee ?? "", v.origine, v.motif, v.confiance, v.classe]
                .map(csv).join(",")
            )
        )
        .join("\n"),
      "utf8"
    );

    const liste = (titre: string, vs: Verdict[], max = 60) => {
      console.log(`\n── ${titre} (${vs.length}) ──`);
      for (const v of vs.slice(0, max)) {
        console.log(`  [#${v.ligne.id}] ${v.ligne.name}`);
        console.log(`      cat ${v.ligne.category} · sous_type "${v.ligne.sous_type}" · coupe ${v.coupeActuelle}`);
        console.log(`      aujourd'hui ${v.comportementActuel} — proposé ${v.proposee ?? "AUCUN"} — ${v.motif}`);
      }
      if (vs.length > max) console.log(`  … et ${vs.length - max} autre(s), voir le CSV.`);
    };

    const versAmple = aEcrire.filter((v) => v.proposee === "Ample");
    const versAjuste = aEcrire.filter((v) => v.proposee === "Ajusté" || v.proposee === "Serré");
    const cotele = verdicts.filter((v) => v.origine.includes("côtelé"));
    const evase = verdicts.filter((v) => v.classe === "non_representable");

    liste("1 · CHANGEMENTS CERTAINS → Ample", versAmple.filter((v) => v.classe === "certain"));
    liste("1 · CHANGEMENTS CERTAINS → Ajusté / Serré", versAjuste.filter((v) => v.classe === "certain"));
    liste("2 · CHANGEMENTS PROBABLES", verdicts.filter((v) => v.classe === "probable"));
    liste("3 · CAS AMBIGUS", parClasse("ambigu"));
    liste("4 · NON REPRÉSENTABLES PAR LE MODÈLE (évasé)", evase);
    liste("5 · INCOHÉRENCES colonne / nom", parClasse("incoherence"));

    // Périmètre alternatif : ce qu'un comptage sur sous_type aurait donné.
    const viaSousType = data.filter(
      (r) => !r.coupe && /oversize|large|ample/i.test(r.sous_type || "")
    );

    console.log(`\n════════ BILAN ════════`);
    console.log(`Catalogue : ${data.length} article(s).`);
    console.log(`  ${verdicts.filter((v) => v.coupeActuelle !== "—").length} ont déjà une coupe structurée.`);
    console.log(`  ${aEcrire.length} recevraient une valeur (dont ${versAmple.length} en Ample).`);
    console.log(`     certains  : ${aEcrire.filter((v) => v.classe === "certain").length}`);
    console.log(`     probables : ${aEcrire.filter((v) => v.classe === "probable").length}`);
    console.log(`     ambigus   : ${aEcrire.filter((v) => v.classe === "ambigu").length}`);
    console.log(`  ${parClasse("ambigu").length} cas ambigus au total (dont ${cotele.length} "côtelé").`);
    console.log(`  ${evase.length} non représentables ("évasé").`);
    console.log(`  ${parClasse("incoherence").length} incohérence(s) colonne / nom.`);
    console.log(`  ${verdicts.filter((v) => v.proposee === null && v.coupeActuelle === "—" && v.classe === "certain").length} resteront null (aucun mot de coupe).`);
    console.log(`\n  Coût de régénération si les ${versAmple.length} Ample sont écrits : ~${(versAmple.length * 0.02).toFixed(2)} $`);
    console.log(`\n  Repère : un comptage fait sur sous_type (et non sur le nom, base réelle`);
    console.log(`  de coupeOf) aurait donné ${viaSousType.length} article(s) — périmètre différent.`);
    console.log("\nAucune modification effectuée — audit en lecture seule.");
  });
});
