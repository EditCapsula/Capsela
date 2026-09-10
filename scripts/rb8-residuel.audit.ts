import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { evaluateBlocking, generateOutfitWithFallback, type LeviersMesure } from "../src/lib/logic";
import { fermetureMaille, rolePieceOf } from "../src/lib/attributes";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// D'OÙ VIENNENT LES +13 R-B8 ? — AUDIT CAUSAL, LECTURE SEULE.
//
// L'expérience du 01/09/2026 a démontré le garde-fou des mailles fermées
// (B = 159 tenues interdites, A = 0). Elle a aussi produit une RÉGRESSION
// que je n'ai pas expliquée :
//
//   R-B8   526 -> 539   soit +13
//   R-B2    92 ->  90   soit  -2
//   total dur  2619 -> 2630   soit +11 NET
//
// +13 et +11 sont DEUX CHIFFRES DIFFÉRENTS et ne doivent jamais être
// confondus : le second est le premier après compensation par R-B2. Mon
// rapport les avait présentés collés ; c'est corrigé ici.
//
// MON HYPOTHÈSE, à confirmer ou à réfuter : refuser la seconde maille fermée
// fait retomber le tirage sur un autre calque, parfois un pull oversize, qui
// déclenche alors le signal R-B8 « deux pièces amples ». Une hypothèse n'est
// pas une explication : cet audit doit la mettre en défaut ou la démontrer.
//
// MÉTHODE — COMPARAISON APPARIÉE, PAS AGRÉGÉE.
//
// Les deux bras partagent leurs capsules ET leur graine. À chaque index de
// tirage (saison, style, occasion, k) correspond donc UNE PAIRE de tenues :
// celle de B et celle de A, produites du même flux aléatoire. On peut donc
// comparer tirage par tirage, et non seulement des totaux — c'est la seule
// façon d'ATTRIBUER un écart plutôt que de le constater.
//
// Sur chaque paire divergente : la pièce retirée (B \ A) et la pièce ajoutée
// (A \ B) sont identifiées nommément, puis R-B8 et R-B2 sont réévaluées des
// deux côtés. Le total des écarts par paire doit reconstituer EXACTEMENT le
// +13 et le -2. Tout résiduel est un mécanisme que l'hypothèse n'explique
// pas, et sera rapporté comme tel.
//
// Contrôle de cohérence intégré : sur les paires IDENTIQUES, l'écart doit
// être nul par construction. S'il ne l'est pas, l'appariement est faux et
// tout le reste de cet audit est à jeter — le script le dira.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;

const LEVIERS_A: LeviersMesure = { pullCommeHautPrincipal: "base" };
const LEVIERS_B: LeviersMesure = { pullCommeHautPrincipal: "base", superpositionMaillesFermees: true };

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function grainePour(cle: string): number {
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Décrit une pièce en une ligne lisible. */
const decrire = (it: Item) => `${it.name} [${it.cat}/${rolePieceOf(it)}${fermetureMaille(it) ? "/" + fermetureMaille(it) : ""}]`;

describe("origine des +13 R-B8", () => {
  it("attribue tirage par tirage l'écart entre les deux bras", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));

    const cellules: { saison: CapsuleSeason; style: string; capsule: CatalogItem[]; w: ReturnType<typeof representativeWeatherFor> }[] = [];
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        cellules.push({ saison, style, w, capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool) });
      }
    }
    console.log(`Catalogue : ${pool.length} pièces. ${cellules.length} cellules × ${OCCS.length} occasions × ${N} tirages.`);
    console.log(`Capsules partagées, graine partagée : chaque index de tirage donne UNE PAIRE (B, A).`);

    // Compteurs globaux, reconstitués par paire.
    let paires = 0, identiques = 0, divergentes = 0;
    let ecartRB8 = 0, ecartRB2 = 0;
    let ecartRB8SurIdentiques = 0, ecartRB2SurIdentiques = 0;
    // Divergences DUES AU GARDE-FOU : B contenait deux mailles fermées.
    let divGardeFou = 0, ecartRB8GardeFou = 0, ecartRB2GardeFou = 0;
    // Divergences NON attribuables au garde-fou — le résiduel à expliquer.
    let divAutres = 0, ecartRB8Autres = 0, ecartRB2Autres = 0;

    const remplacants = new Map<string, number>();
    const retirees = new Map<string, number>();
    const exemplesRB8 = new Map<string, string>();
    const exemplesAutres = new Map<string, string>();

    const piecesDe = (ids: number[]): Item[] =>
      ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];
    const compte = (pieces: Item[], occ: OccasionKey, w: ReturnType<typeof representativeWeatherFor>, regle: string) =>
      evaluateBlocking(pieces, occ, w, "Présentiel", "Verre").filter((h) => h.id === regle).length;

    for (const c of cellules) {
      for (const occ of OCCS) {
        for (let k = 0; k < N; k++) {
          const cle = `${c.saison}|${c.style}|${occ}|${k}`;
          const tirer = (leviers: LeviersMesure): number[] => {
            const vrai = Math.random;
            Math.random = mulberry32(grainePour(cle));
            try {
              return generateOutfitWithFallback(c.capsule, c.w, occ, "Présentiel", "Verre", [], "femme", c.saison, leviers).ids;
            } finally { Math.random = vrai; }
          };
          const idsB = tirer(LEVIERS_B);
          const idsA = tirer(LEVIERS_A);
          if (!idsB.length && !idsA.length) continue;
          paires += 1;

          const setB = new Set(idsB), setA = new Set(idsA);
          const memeTenue = idsB.length === idsA.length && idsB.every((id) => setA.has(id));
          const piecesB = piecesDe(idsB), piecesA = piecesDe(idsA);
          const dRB8 = compte(piecesA, occ, c.w, "R-B8") - compte(piecesB, occ, c.w, "R-B8");
          const dRB2 = compte(piecesA, occ, c.w, "R-B2") - compte(piecesB, occ, c.w, "R-B2");
          ecartRB8 += dRB8;
          ecartRB2 += dRB2;

          if (memeTenue) {
            identiques += 1;
            // Doit rester nul : même tenue, même occasion, même météo.
            ecartRB8SurIdentiques += dRB8;
            ecartRB2SurIdentiques += dRB2;
            continue;
          }
          divergentes += 1;

          const fermeesB = piecesB.filter((p) => fermetureMaille(p) === "fermée");
          const declenche = fermeesB.length >= 2;
          const partiesB = piecesB.filter((p) => !setA.has(p.id));
          const partiesA = piecesA.filter((p) => !setB.has(p.id));

          if (declenche) {
            divGardeFou += 1;
            ecartRB8GardeFou += dRB8;
            ecartRB2GardeFou += dRB2;
            for (const p of partiesB) retirees.set(decrire(p), (retirees.get(decrire(p)) ?? 0) + 1);
            for (const p of partiesA) remplacants.set(decrire(p), (remplacants.get(decrire(p)) ?? 0) + 1);
            if (dRB8 > 0 && exemplesRB8.size < 15) {
              exemplesRB8.set(cle,
                `${c.saison} · ${c.style} · ${occ}\n` +
                `        B : ${piecesB.map((p) => p.name).join(" + ")}\n` +
                `        A : ${piecesA.map((p) => p.name).join(" + ")}\n` +
                `        retiré : ${partiesB.map(decrire).join(", ") || "—"}\n` +
                `        ajouté : ${partiesA.map(decrire).join(", ") || "—"}`);
            }
          } else {
            divAutres += 1;
            ecartRB8Autres += dRB8;
            ecartRB2Autres += dRB2;
            if (exemplesAutres.size < 10) {
              exemplesAutres.set(cle,
                `${c.saison} · ${c.style} · ${occ}\n` +
                `        B : ${piecesB.map((p) => p.name).join(" + ")}\n` +
                `        A : ${piecesA.map((p) => p.name).join(" + ")}`);
            }
          }
        }
      }
    }

    // ═══ 0 · CONTRÔLE DE COHÉRENCE ═══
    console.log(`\n════════ 0 · L'APPARIEMENT EST-IL VALIDE ? ════════`);
    console.log(`  Sur les paires IDENTIQUES, l'écart doit être nul par construction. S'il ne`);
    console.log(`  l'est pas, l'appariement est faux et tout ce qui suit est à jeter.`);
    console.log(`  paires comparées                : ${paires}`);
    console.log(`  dont tenues identiques          : ${identiques}`);
    console.log(`  dont tenues divergentes         : ${divergentes}`);
    console.log(`  écart R-B8 sur les identiques   : ${ecartRB8SurIdentiques}   (doit valoir 0)`);
    console.log(`  écart R-B2 sur les identiques   : ${ecartRB2SurIdentiques}   (doit valoir 0)`);
    const apparieOk = ecartRB8SurIdentiques === 0 && ecartRB2SurIdentiques === 0;
    console.log(`  >>> ${apparieOk ? "APPARIEMENT VALIDE" : "APPARIEMENT INVALIDE — NE PAS LIRE LA SUITE"}`);

    // ═══ 1 · RECONSTITUTION DES ÉCARTS ═══
    console.log(`\n════════ 1 · RECONSTITUTION DE +13 R-B8 ET -2 R-B2 ════════`);
    console.log(`  L'écart total mesuré par paires doit retrouver celui de l'audit précédent.`);
    console.log(`  ${"".padEnd(42)}${"R-B8".padStart(8)}${"R-B2".padStart(8)}`);
    const l = (nom: string, a: number, b: number) => console.log(`  ${nom.padEnd(42)}${String(a).padStart(8)}${String(b).padStart(8)}`);
    l("écart TOTAL (A - B)", ecartRB8, ecartRB2);
    l("   attendu de l'audit précédent", 13, -2);
    l("dont divergences dues AU GARDE-FOU", ecartRB8GardeFou, ecartRB2GardeFou);
    l("dont divergences AUTRES", ecartRB8Autres, ecartRB2Autres);
    l("dont paires identiques", ecartRB8SurIdentiques, ecartRB2SurIdentiques);
    console.log(`\n  divergences dues au garde-fou : ${divGardeFou}`);
    console.log(`  divergences autres            : ${divAutres}`);

    // Le verdict porte sur la CONTRIBUTION à l'écart, jamais sur le NOMBRE de
    // divergences. Correctif du 01/09/2026 : la première version exigeait
    // `divAutres === 0` pour conclure « expliquée », ce qui confondait « il
    // existe d'autres divergences » avec « d'autres divergences contribuent ».
    // Elle a rendu « PARTIELLEMENT EXPLIQUÉE » sur un résiduel de 0 et 0, en
    // imprimant la phrase auto-contradictoire « Un résiduel subsiste : 0 ».
    // Des divergences sans effet sur les règles mesurées ne sont pas un
    // résiduel : c'est un fait distinct, rapporté au § 4 et nulle part ailleurs.
    const totalRetrouve = ecartRB8 === 13 && ecartRB2 === -2;
    const residuel = ecartRB8Autres !== 0 || ecartRB2Autres !== 0;
    const gardeFouExplique = ecartRB8GardeFou !== 0 || ecartRB2GardeFou !== 0;
    const ecartNul = ecartRB8 === 0 && ecartRB2 === 0;
    const verdict =
      !apparieOk ? "AUDIT INVALIDE"
      : !totalRetrouve ? "ÉCART NON REPRODUIT — voir § 1"
      : !residuel ? "CAUSE EXPLIQUÉE"
      : gardeFouExplique ? "CAUSE PARTIELLEMENT EXPLIQUÉE"
      : "CAUSE NON EXPLIQUÉE";
    console.log(`\n  >>> VERDICT : ${verdict}`);
    if (verdict === "CAUSE EXPLIQUÉE") {
      console.log(`      L'intégralité de l'écart est attribuée aux divergences que le garde-fou`);
      console.log(`      a provoquées. Les divergences AUTRES y contribuent 0 et 0 : elles ne`);
      console.log(`      sont pas un résiduel, mais un fait séparé — cf. § 4.`);
      if (ecartNul) {
        console.log(`      ATTENTION : l'écart total est nul. « Expliqué » ne veut alors rien dire`);
        console.log(`      d'autre que « il n'y avait rien à expliquer ».`);
      }
    }
    if (verdict === "CAUSE PARTIELLEMENT EXPLIQUÉE") {
      console.log(`      RÉSIDUEL RÉEL : ${ecartRB8Autres} R-B8 et ${ecartRB2Autres} R-B2 proviennent de divergences`);
      console.log(`      où B ne contenait PAS deux mailles fermées. Le garde-fou a donc un effet`);
      console.log(`      MESURABLE au-delà du cas qu'il vise. Échantillon au § 4.`);
    }
    if (verdict === "CAUSE NON EXPLIQUÉE") {
      console.log(`      Les divergences dues au garde-fou n'expliquent RIEN de l'écart. Le mécanisme`);
      console.log(`      supposé est réfuté ; il faut en chercher un autre avant toute phase 2.`);
    }

    // ═══ 2 · CE QUI A REMPLACÉ QUOI ═══
    console.log(`\n════════ 2 · SUR LES DIVERGENCES DUES AU GARDE-FOU ════════`);
    console.log(`  Pièces RETIRÉES (présentes dans B, absentes de A) :`);
    for (const [nom, n] of [...retirees.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`     ${String(n).padStart(5)}  ${nom}`);
    }
    console.log(`\n  Pièces AJOUTÉES (présentes dans A, absentes de B) — les remplaçants :`);
    for (const [nom, n] of [...remplacants.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
      console.log(`     ${String(n).padStart(5)}  ${nom}`);
    }
    console.log(`\n  L'hypothèse prévoit des remplaçants de rôle « calque ». Si les remplaçants`);
    console.log(`  sont majoritairement « base », ou d'une autre catégorie, elle est réfutée.`);

    // ═══ 3 · LES PAIRES QUI CRÉENT UNE VIOLATION R-B8 ═══
    console.log(`\n════════ 3 · PAIRES OÙ LE GARDE-FOU CRÉE UNE VIOLATION R-B8 ════════`);
    if (!exemplesRB8.size) console.log(`  Aucune : l'écart R-B8 ne vient pas des tenues que le garde-fou a modifiées.`);
    for (const [, texte] of exemplesRB8) console.log(`     ${texte}`);

    // ═══ 4 · LE RÉSIDUEL ═══
    console.log(`\n════════ 4 · DIVERGENCES NON ATTRIBUABLES AU GARDE-FOU ════════`);
    console.log(`  Paires où les deux bras diffèrent alors que B ne contenait PAS deux mailles`);
    console.log(`  fermées — là où le garde-fou n'avait rien à refuser.`);
    console.log(`  Nombre : ${divAutres}. CONTRIBUTION à l'écart : ${ecartRB8Autres} R-B8, ${ecartRB2Autres} R-B2.`);
    console.log(`  Ces deux chiffres ne disent PAS la même chose et ne doivent pas être`);
    console.log(`  confondus : des divergences peuvent exister sans peser sur aucune règle.`);
    console.log(`  Mécanisme attendu : le garde-fou raccourcit la LISTE de candidats de R-B8,`);
    console.log(`  donc le même nombre aléatoire y sélectionne un autre élément, et le décalage`);
    console.log(`  se propage aux tirages suivants. La garantie « mêmes tirages » vaut à`);
    console.log(`  l'ENTRÉE, pas à chaque tirage intermédiaire — limite de méthode, à connaître`);
    console.log(`  pour tout audit comparatif ultérieur. L'attribution du § 2 n'en dépend pas :`);
    console.log(`  elle compare les tenues pièce à pièce, sans supposer l'identité du flux.`);
    if (!divAutres) console.log(`  Aucune. Le garde-fou ne modifie que les tenues qu'il vise.`);
    for (const [, texte] of exemplesAutres) console.log(`     ${texte}`);

    // ═══ 5 · R-B2 SÉPARÉMENT ═══
    console.log(`\n════════ 5 · POURQUOI R-B2 BAISSE DE 2 ════════`);
    console.log(`  R-B2 signale un contraste de formalité entre les pièces. Écart mesuré : ${ecartRB2}.`);
    console.log(`  Attribution : ${ecartRB2GardeFou} sur les divergences du garde-fou, ${ecartRB2Autres} ailleurs.`);
    console.log(`  Une BAISSE signifie que les tenues de A sont plus homogènes en formalité que`);
    console.log(`  celles de B. Ce n'est pas un gain à revendiquer : c'est un effet de bord du`);
    console.log(`  même remplacement, à constater et à attribuer, pas à porter au crédit.`);

    console.log(`\n  LECTURE SEULE. Aucun code de production modifié, aucune correction appliquée.`);
  });
});
