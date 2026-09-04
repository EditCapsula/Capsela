import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles } from "./harnaisAudit";

// FIABILISER `saison_capsule` — DIAGNOSTIC, LECTURE SEULE.
//
// POURQUOI CE CHANTIER PASSE AVANT L'AUTRE. La mesure du 04/09 a montré que
// décider l'appartenance à une capsule sur `saison_capsule` est le mécanisme
// juste — borne respectée, aucune fuite, couverture intacte — mais qu'il
// coûte +22 pièces mortes sur ce catalogue. Cause probable : le moteur
// deviendrait dépendant d'une colonne que l'audit de cohérence a trouvée
// contradictoire sur 146 couples. On fiabilise donc la donnée d'abord.
//
// LA QUESTION QUE CE SCRIPT DOIT RENDRE ARBITRABLE. Les 146 contradictions
// opposent DEUX sources : la saison déclarée et la plage de température. Le
// diagnostic ne consiste pas à les compter une fois de plus, mais à dire,
// pour chaque famille de cas, LAQUELLE DES DEUX est probablement fausse.
// Ce script ne tranche pas : il regroupe par motif récurrent pour qu'un
// arbitrage porte sur une famille et non sur 146 lignes une par une, et il
// affiche matière et sous-type pour que l'arbitrage soit possible.
//
// TROIS SOURCES DE VÉRITÉ CONCURRENTES, jamais fondues en une :
//   · la SAISON DÉCLARÉE (`saison_capsule`) ;
//   · la PLAGE de température (`meteo_min_temp`/`meteo_max_temp`), dont on
//     déduit les saisons « implicites » — celles dont la température
//     représentative tombe dans la plage ;
//   · la MATIÈRE et le SOUS-TYPE, qui ne décident rien mais permettent à un
//     œil humain de voir laquelle des deux premières est absurde.
//
// Le détail ligne à ligne part dans un CSV plutôt que dans le log : 146 lignes
// dans un journal de CI ne se relisent pas, et l'arbitrage a besoin d'un
// fichier triable.
//
// Aucune écriture en base, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV = "saison-capsule-arbitrage.csv";

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

function saisonsDeclarees(raw: string | null): CapsuleSeason[] {
  const jetons = (raw ?? "").split(/[,;|]/).map((s) => sansAccents(s)).filter(Boolean);
  return CAPSULE_SEASONS.filter((s) => jetons.includes(sansAccents(s)));
}

const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

describe("fiabilité de saison_capsule", () => {
  it("oppose la saison déclarée à la plage de température et regroupe par motif", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const ligne = new Map<number, VestiaireRow>(brutes.map((r) => [VESTIAIRE_ID_OFFSET + r.id, r]));
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    const temp = new Map(CAPSULE_SEASONS.map((s) => [s, representativeWeatherFor(s).temp]));
    console.log(`Catalogue : ${pool.length} pièces. Températures de capsule : ${CAPSULE_SEASONS.map((s) => `${s} ${temp.get(s)}°`).join("  ")}`);

    /** Les saisons que la PLAGE couvre — la « déclaration implicite » des bornes. */
    const saisonsImplicites = (min: number | null, max: number | null): CapsuleSeason[] =>
      CAPSULE_SEASONS.filter((s) => {
        const t = temp.get(s)!;
        return (min == null || t >= min) && (max == null || t <= max);
      });

    // ═══ 1 · COMBIEN DE PIÈCES SONT SEULEMENT ARBITRABLES ? ══════════════
    console.log(`\n════════ 1 · QUE PEUT-ON SEULEMENT INSTRUIRE ? ════════`);
    const declarantes = pool.filter((it) => saisonsDeclarees(ligne.get(it.id)!.saison_capsule).length);
    const bornees = pool.filter((it) => ligne.get(it.id)!.meteo_min_temp != null || ligne.get(it.id)!.meteo_max_temp != null);
    const instruisables = pool.filter((it) => {
      const r = ligne.get(it.id)!;
      return saisonsDeclarees(r.saison_capsule).length && (r.meteo_min_temp != null || r.meteo_max_temp != null);
    });
    console.log(`  déclarent une saison ......................... ${declarantes.length}/${pool.length}`);
    console.log(`  portent au moins une borne ................... ${bornees.length}/${pool.length}`);
    console.log(`  LES DEUX — seules pièces instruisables ....... ${instruisables.length}/${pool.length}`);
    console.log(`  Sur les autres, aucune des deux sources ne peut contredire l'autre :`);
    console.log(`  elles ne relèvent pas de ce chantier, mais d'un remplissage de données.`);

    // ═══ 2 · DÉSACCORDS ENTRE DÉCLARATION ET PLAGE ══════════════════════
    console.log(`\n════════ 2 · OÙ DÉCLARATION ET PLAGE SE CONTREDISENT ════════`);
    type Cas = {
      id: number; nom: string; cat: string; sousType: string; matiere: string;
      min: number | null; max: number | null;
      declarees: CapsuleSeason[]; implicites: CapsuleSeason[];
      aRetirer: CapsuleSeason[]; aAjouter: CapsuleSeason[];
      motif: string;
    };
    const cas: Cas[] = [];
    for (const it of instruisables) {
      const r = ligne.get(it.id)!;
      const dec = saisonsDeclarees(r.saison_capsule);
      const imp = saisonsImplicites(r.meteo_min_temp, r.meteo_max_temp);
      const aRetirer = dec.filter((s) => !imp.includes(s));
      const aAjouter = imp.filter((s) => !dec.includes(s));
      if (!aRetirer.length && !aAjouter.length) continue;
      // Le motif nomme le DÉSACCORD, pas sa correction.
      const motif = !imp.length ? "plage ne couvre AUCUNE saison"
        : aRetirer.length && aAjouter.length ? "déclaration et plage se croisent"
        : aRetirer.length ? "déclarée hors de sa plage"
        : "plage plus large que la déclaration";
      cas.push({
        id: r.id, nom: it.name, cat: it.cat, sousType: r.sous_type ?? "", matiere: r.matiere ?? "",
        min: r.meteo_min_temp, max: r.meteo_max_temp, declarees: dec, implicites: imp, aRetirer, aAjouter, motif,
      });
    }
    console.log(`  ${cas.length} pièces en désaccord sur ${instruisables.length} instruisables.`);
    const parMotif = new Map<string, number>();
    for (const c of cas) parMotif.set(c.motif, (parMotif.get(c.motif) ?? 0) + 1);
    for (const [m, n] of [...parMotif.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(4)}  ${m}`);

    // ═══ 3 · REGROUPEMENT PAR FAMILLE ARBITRABLE ════════════════════════
    //
    // Une famille = (catégorie, motif, saisons contestées). L'arbitrage porte
    // sur la famille ; le détail pièce à pièce va dans le CSV.
    console.log(`\n════════ 3 · FAMILLES — L'ARBITRAGE PORTE ICI, PAS SUR 146 LIGNES ════════`);
    const familles = new Map<string, Cas[]>();
    for (const c of cas) {
      const cle = `${c.cat}|${c.motif}|retirer:${c.aRetirer.join("+") || "—"}|ajouter:${c.aAjouter.join("+") || "—"}`;
      familles.set(cle, [...(familles.get(cle) ?? []), c]);
    }
    console.log(`  ${familles.size} familles. Les plus nombreuses d'abord :`);
    console.log(`\n  ${"n".padStart(4)}  ${"cat".padEnd(11)}${"motif".padEnd(34)}${"retirer".padEnd(24)}${"ajouter".padEnd(24)}exemple (matière · sous-type)`);
    for (const [cle, membres] of [...familles.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const [cat, motif, ret, add] = cle.split("|");
      const ex = membres[0];
      console.log(
        `  ${String(membres.length).padStart(4)}  ${cat.padEnd(11)}${motif.padEnd(34)}` +
        `${ret.replace("retirer:", "").padEnd(24)}${add.replace("ajouter:", "").padEnd(24)}` +
        `${(ex.matiere || "—").slice(0, 18)} · ${(ex.sousType || "—").slice(0, 22)}`,
      );
    }

    // ═══ 4 · LES DEUX SCÉNARIOS DE CORRECTION, CHIFFRÉS ═════════════════
    //
    // Ni l'un ni l'autre n'est recommandé ici : les chiffrer sépare le coût
    // du jugement. Corriger la DÉCLARATION croit les bornes ; corriger la
    // BORNE croit la déclaration. Les deux sont défendables et n'ont pas le
    // même volume.
    console.log(`\n════════ 4 · CE QUE COÛTERAIT CHAQUE SCÉNARIO ════════`);
    const scenarioDeclaration = cas.filter((c) => c.aRetirer.length || c.aAjouter.length);
    const orphelines = cas.filter((c) => !c.implicites.length);
    console.log(`  SCÉNARIO A — aligner la DÉCLARATION sur la plage (on croit les bornes)`);
    console.log(`     pièces à modifier .......................... ${scenarioDeclaration.length}`);
    console.log(`     dont pièces qui se retrouveraient SANS AUCUNE saison : ${orphelines.length}`);
    if (orphelines.length) {
      console.log(`     Ces pièces sortiraient de toutes les capsules. À traiter à part, jamais`);
      console.log(`     par application mécanique du scénario :`);
      for (const c of orphelines.slice(0, 15)) {
        console.log(`        id ${String(c.id).padStart(5)}  ${c.cat.padEnd(11)}[${c.min ?? "—"}, ${c.max ?? "—"}]  ${c.declarees.join(", ").padEnd(28)}${c.nom}`);
      }
    }
    const elargissements = cas
      .filter((c) => c.aRetirer.length)
      .map((c) => {
        const temps = c.aRetirer.map((s) => temp.get(s)!);
        const basBesoin = c.min != null ? Math.max(0, c.min - Math.min(...temps)) : 0;
        const hautBesoin = c.max != null ? Math.max(0, Math.max(...temps) - c.max) : 0;
        return { c, degres: basBesoin + hautBesoin };
      });
    console.log(`\n  SCÉNARIO B — élargir la BORNE pour couvrir les saisons déclarées (on croit la déclaration)`);
    console.log(`     pièces à modifier .......................... ${elargissements.length}`);
    const paliers = [1, 2, 3, 5, 10, 99];
    let reste = [...elargissements];
    for (const p of paliers) {
      const dans = reste.filter((e) => e.degres <= p);
      reste = reste.filter((e) => e.degres > p);
      if (dans.length) console.log(`     dont ${String(dans.length).padStart(4)} à ${p === 99 ? "plus de 10" : `≤ ${p}`} degré(s) d'élargissement`);
    }
    console.log(`     Un élargissement d'un degré est probablement une borne mal arrondie.`);
    console.log(`     Au-delà de cinq, c'est la déclaration qui est douteuse, pas la borne.`);

    // ═══ 6 · LE GROUPE LE PLUS FLAGRANT, EN ENTIER ══════════════════════
    //
    // Arbitrage du 04/09 : commencer par les pièces dont les deux sources sont
    // séparées de PLUS DE DIX DEGRÉS. C'est là que l'incompatibilité est
    // franche — une chemise en lin `min 20 °` n'est pas une pièce d'hiver,
    // quoi qu'en dise la colonne —, et la correction porte sur la DÉCLARATION,
    // donc sans risque d'inventer une borne.
    //
    // La « déclaration résultante » est ce que le scénario A donnerait
    // mécaniquement. Elle n'est PAS une recommandation : une pièce qui s'y
    // retrouverait sans aucune saison est signalée pour être traitée à part.
    const flagrants = elargissements.filter((e) => e.degres > 10).sort((a, b) => b.degres - a.degres);
    console.log(`\n════════ 6 · LES ${flagrants.length} PIÈCES À PLUS DE 10 ° D'ÉCART ════════`);
    console.log(`  Chaque ligne : ce que dit la plage, ce que dit la déclaration, et l'écart.`);
    for (const { c, degres } of flagrants) {
      const resultante = c.implicites.length ? c.implicites.join(", ") : "AUCUNE — à traiter à part";
      console.log(`\n  ── ${c.nom}   (id ${c.id})`);
      console.log(`     catégorie / sous-type ... ${c.cat} · ${c.sousType || "—"}`);
      console.log(`     matière ................. ${c.matiere || "—"}`);
      console.log(`     plage de température .... [${c.min ?? "—"}, ${c.max ?? "—"}]`);
      console.log(`     saisons DÉCLARÉES ....... ${c.declarees.join(", ")}`);
      console.log(`     saisons que la PLAGE couvre ... ${c.implicites.join(", ") || "aucune"}`);
      console.log(`     en contradiction ........ ${c.aRetirer.join(", ")}   (écart ${degres} °)`);
      console.log(`     déclaration résultante du scénario A : ${resultante}`);
    }

    // ═══ 5 · LE DÉTAIL, EN CSV ══════════════════════════════════════════
    const entetes = ["id", "nom", "categorie", "sous_type", "matiere", "min", "max", "saisons_declarees", "saisons_impliquees_par_la_plage", "a_retirer", "a_ajouter", "motif", "degres_elargissement_scenario_B"];
    const degresPar = new Map(elargissements.map((e) => [e.c.id, e.degres]));
    const lignes = cas
      .sort((a, b) => a.cat.localeCompare(b.cat) || a.motif.localeCompare(b.motif) || a.id - b.id)
      .map((c) => [c.id, c.nom, c.cat, c.sousType, c.matiere, c.min ?? "", c.max ?? "",
        c.declarees.join(" + "), c.implicites.join(" + "), c.aRetirer.join(" + "), c.aAjouter.join(" + "),
        c.motif, degresPar.get(c.id) ?? ""].map(csvCell).join(","));
    writeFileSync(CSV, [entetes.map(csvCell).join(","), ...lignes].join("\n"), "utf8");
    console.log(`\n  ${cas.length} lignes écrites dans ${CSV} (artefact du job) — triable, arbitrable.`);

    console.log(`\n  LECTURE SEULE. Aucune correction proposée, aucune donnée touchée.`);
    console.log(`  Ce script ne dit pas qui a raison de la déclaration ou de la borne : il`);
    console.log(`  met les deux face à face et regroupe les cas pour que ce soit décidable.`);
  }, 300_000);
});
