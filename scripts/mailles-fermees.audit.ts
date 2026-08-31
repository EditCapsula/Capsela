import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";

// CLASSIFICATION OUVERT / FERMÉ — PROPOSITION MESURÉE, RIEN EN PRODUCTION.
//
// POURQUOI CETTE ÉTAPE EXISTE.
//
// Trois règles de production comparent `subtype` par ÉGALITÉ STRICTE à un
// vocabulaire canonique que la base n'emploie jamais. Mesuré le 31/08/2026 :
//   mailles fermées               0 / 34   (totalement inerte)
//   R-B10, deux chemises         20 / 29   (fuit un tiers)
//   R-S17, robe chemise festive   0 /  4   (totalement inerte)
//
// Le correctif arbitré est une comparaison par PRÉFIXE, jamais une écriture
// en base. Mais un préfixe mal choisi échouerait exactement comme l'égalité
// stricte a échoué : SANS AUCUN SIGNAL. Les trois règles ci-dessus ont toutes
// été écrites en croyant qu'elles fonctionnaient. Cet audit existe pour que la
// quatrième ne le soit pas : il applique la classification proposée aux 623
// pièces réelles et rend son verdict PIÈCE PAR PIÈCE, à relire à l'œil avant
// toute écriture.
//
// ARBITRAGE ÉDITORIAL APPLIQUÉ ICI (31/08/2026) :
//   « Une maille fermée peut être le dessus principal ou être portée sous une
//     pièce extérieure. Elle ne doit pas être superposée à une autre maille
//     fermée. »
//   « Pas de pull en été, juste des gilets ou vestes. »
//   Critère retenu pour fermé/ouvert : l'OUVRABILITÉ RÉELLE — un sweat zippé
//   s'ouvre comme un cardigan, un hoodie non. C'est pourquoi le marqueur
//   « zippé » l'emporte sur le préfixe, et pourquoi « Sweat graphique », non
//   zippé, est classé fermé au même titre qu'un hoodie : le critère arbitré
//   est la fermeture, pas le libellé.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

/** Préfixes de sous-type qui désignent une maille qui s'enfile par la tête. */
const PREFIXES_FERMES = ["pull", "col roule", "hoodie", "sweat"];
/** Préfixes qui désignent une maille qui s'ouvre sur le devant. */
const PREFIXES_OUVERTS = ["cardigan", "gilet", "veste en maille"];
/**
 * Le marqueur d'ouvrabilité l'emporte sur le préfixe : « Sweat à capuche
 * zippé » s'ouvre, donc il est ouvert, quoi que dise son préfixe. C'est le
 * critère arbitré, appliqué dans le sens qu'il impose.
 */
const MARQUEUR_OUVRABLE = /\bzipp/;

type Fermeture = "fermée" | "ouverte" | "indécise";

function fermetureDe(sousType: string | undefined, nom: string): Fermeture {
  const st = norm(sousType ?? "");
  const texte = norm(`${sousType ?? ""} ${nom}`);
  if (MARQUEUR_OUVRABLE.test(texte)) return "ouverte";
  if (PREFIXES_FERMES.some((p) => st.startsWith(p))) return "fermée";
  if (PREFIXES_OUVERTS.some((p) => st.startsWith(p))) return "ouverte";
  return "indécise";
}

describe("classification ouvert / fermé", () => {
  it("applique la classification proposée aux pièces réelles, sans rien écrire", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    const pulls = pool.filter((it) => it.cat === "pull");
    console.log(`Catalogue exploitable : ${pool.length} pièces, dont ${pulls.length} pulls.`);

    // ═══ 1 · LA CLASSIFICATION, PIÈCE PAR PIÈCE ═══
    console.log(`\n════════ 1 · LES 56 PULLS CLASSÉS — À RELIRE À L'ŒIL ════════`);
    console.log(`  C'est LE tableau à valider. Une seule ligne fausse ici et la règle repart`);
    console.log(`  pour trois semaines d'inertie silencieuse.`);
    console.log(`  ${"nom".padEnd(38)}${"sous_type".padEnd(30)}${"fermeture".padStart(11)}`);
    const parFermeture = new Map<Fermeture, CatalogItem[]>([["fermée", []], ["ouverte", []], ["indécise", []]]);
    for (const it of [...pulls].sort((a, b) => norm(a.subtype ?? "").localeCompare(norm(b.subtype ?? "")))) {
      const f = fermetureDe(it.subtype, it.name);
      parFermeture.get(f)!.push(it);
      const alerte = f === "indécise" ? "   <<< À TRANCHER" : "";
      console.log(`  ${it.name.slice(0, 37).padEnd(38)}${(it.subtype ?? "(vide)").slice(0, 29).padEnd(30)}${f.padStart(11)}${alerte}`);
    }
    console.log(`\n  fermées : ${parFermeture.get("fermée")!.length}` +
      ` · ouvertes : ${parFermeture.get("ouverte")!.length}` +
      ` · INDÉCISES : ${parFermeture.get("indécise")!.length}`);
    console.log(`  Référence : la mesure du 31/08 comptait 34 noms évoquant une maille fermée`);
    console.log(`  et 20 une maille ouverte. Un écart avec ces chiffres est à expliquer.`);

    // ═══ 2 · L'ÉPAISSEUR EST-ELLE UNE DONNÉE DÉCLARÉE ? ═══
    //
    // L'arbitrage exclut de l'Été les mailles ouvertes mais ÉPAISSES. Reste à
    // savoir sur quoi fonder l'épaisseur. `matiere` est renseigné sur 53 des
    // 56 pulls : s'il porte l'information, il vaut infiniment mieux qu'une
    // expression régulière sur un libellé libre — c'est précisément l'erreur
    // que les trois règles inertes ont commise.
    console.log(`\n════════ 2 · SUR QUOI FONDER L'ÉPAISSEUR ? ════════`);
    console.log(`  Valeurs réelles de \`matiere\` sur les pulls :`);
    const parMatiere = new Map<string, number>();
    for (const it of pulls) parMatiere.set(it.matiere ?? "(vide)", (parMatiere.get(it.matiere ?? "(vide)") ?? 0) + 1);
    for (const [v, n] of [...parMatiere.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${v.padEnd(26)}${String(n).padStart(4)}`);
    }
    const marqueurEpais = /\bepais|alpaga|grosse maille|torsad|laine bouillie|mohair/;
    const epais = pulls.filter((it) => marqueurEpais.test(norm(`${it.subtype ?? ""} ${it.name}`)));
    console.log(`\n  À défaut : ${epais.length} pulls portent un marqueur d'épaisseur dans leur libellé.`);
    for (const it of epais) console.log(`     ${it.name.slice(0, 42).padEnd(44)}${it.matiere ?? "(vide)"}`);
    console.log(`  Ce repérage par libellé n'est PAS une proposition : il sert seulement à dire`);
    console.log(`  combien de pièces sont en jeu si aucun champ déclaré ne porte l'épaisseur.`);

    // ═══ 3 · CE QUE LA RÈGLE CHANGERAIT EN ÉTÉ ═══
    console.log(`\n════════ 3 · EFFET SUR L'ÉLIGIBILITÉ À L'ÉTÉ ════════`);
    const TEMP_ETE = representativeWeatherFor("Été").temp;
    const eligiblesEte = pulls.filter(
      (it) =>
        (it.season === "Printemps / Été" || it.season === "Toutes saisons") &&
        (it.meteoMinTemp == null || TEMP_ETE >= it.meteoMinTemp) &&
        (it.meteoMaxTemp == null || TEMP_ETE <= it.meteoMaxTemp)
    );
    console.log(`  ${eligiblesEte.length} pulls passent aujourd'hui les filtres de l'Été (${TEMP_ETE} °C).`);
    console.log(`  ${"nom".padEnd(38)}${"fermeture".padStart(11)}${"épais ?".padStart(10)}${"verdict Été".padStart(14)}`);
    let exclusFerme = 0, exclusEpais = 0;
    for (const it of eligiblesEte) {
      const f = fermetureDe(it.subtype, it.name);
      const e = marqueurEpais.test(norm(`${it.subtype ?? ""} ${it.name}`));
      const verdict = f === "fermée" ? "EXCLU (fermé)" : e ? "EXCLU (épais)" : f === "indécise" ? "À TRANCHER" : "gardé";
      if (f === "fermée") exclusFerme += 1;
      else if (e) exclusEpais += 1;
      console.log(`  ${it.name.slice(0, 37).padEnd(38)}${f.padStart(11)}${(e ? "oui" : "—").padStart(10)}${verdict.padStart(14)}`);
    }
    console.log(`\n  La règle retirerait ${exclusFerme} pièce(s) pour fermeture et ${exclusEpais} pour épaisseur,`);
    console.log(`  laissant ${eligiblesEte.length - exclusFerme - exclusEpais} pull(s) éligible(s) à l'Été.`);
    if (eligiblesEte.length - exclusFerme - exclusEpais === 0) {
      console.log(`  >>> ALERTE : plus aucun pull éligible. ensure("pull") forcerait alors une pièce`);
      console.log(`      hors saison dans chaque capsule Été — l'inverse exact de l'effet voulu.`);
    }

    // ═══ 4 · LE MÊME CORRECTIF SUR LES DEUX AUTRES RÈGLES ═══
    console.log(`\n════════ 4 · R-B10 ET R-S17 AVEC LA COMPARAISON PAR PRÉFIXE ════════`);
    console.log(`  Même défaut, mêmes règles de production. Mesuré avant / après, ici, pour que`);
    console.log(`  le correctif ne soit pas poussé sur une intuition.`);
    const hauts = pool.filter((it) => it.cat === "haut");
    const rb10Avant = hauts.filter((it) => it.subtype === "Chemise" || it.subtype === "Chemisier");
    const estChemise = (st: string | undefined) => {
      const n = norm(st ?? "");
      return n.startsWith("chemise") || n.startsWith("chemisier");
    };
    const rb10Apres = hauts.filter((it) => estChemise(it.subtype));
    console.log(`\n  R-B10 (deux chemises)  avant : ${rb10Avant.length}   après : ${rb10Apres.length}`);
    console.log(`  Nouvellement vues :`);
    for (const it of rb10Apres.filter((it) => !rb10Avant.includes(it))) {
      console.log(`     ${it.name.slice(0, 40).padEnd(42)}${it.subtype}`);
    }
    console.log(`  NOTE : "Surchemise" ne commence PAS par "chemise", donc elle reste hors R-B10.`);
    console.log(`  C'est voulu — une surchemise est une pièce de superposition, pas une 2e chemise.`);

    const robes = pool.filter((it) => it.cat === "robe");
    const rs17Avant = robes.filter((it) => it.subtype === "Chemise");
    const rs17Apres = robes.filter((it) => norm(it.subtype ?? "").startsWith("robe chemise"));
    console.log(`\n  R-S17 (robe chemise en festive)  avant : ${rs17Avant.length}   après : ${rs17Apres.length}`);
    for (const it of rs17Apres) console.log(`     ${it.name.slice(0, 40).padEnd(42)}${it.subtype}`);

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucun ALTER, aucune règle modifiée.`);
    console.log(`  La classification ci-dessus est une PROPOSITION à valider, pas une décision.`);
  });
});
