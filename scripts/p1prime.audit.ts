import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { CLOTHING_CATS, evaluateBlocking, generateOutfitWithFallback, type LeviersMesure } from "../src/lib/logic";
import { fermetureMaille } from "../src/lib/attributes";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE 2 — P1' : LE PULL COMME DESSUS PRINCIPAL. LECTURE SEULE.
//
// LA QUESTION PRODUIT, et elle n'est pas quantitative :
//   « Capsela doit-elle pouvoir utiliser un pull de rôle `base` comme dessus
//     principal d'une tenue générée ? »
//
// CE QUE CET AUDIT NE CHERCHE PAS. Ni à maximiser le nombre de looks, ni la
// diversité, ni à minimiser la mortalité. Aucune de ces trois métriques n'est
// un KPI de réussite, et une variation dans l'un ou l'autre sens ne constitue
// ni un gain ni une perte. Elles sont reportées en dernier, après tout le
// reste, et jamais commentées comme un succès.
//
// LE TAUX DE PULL EN DESSUS PRINCIPAL EST UNE MÉTRIQUE D'OBSERVATION, PAS UNE
// CIBLE. Aucun plafond n'est fixé avant la mesure (arbitrage du 01/09/2026) :
// on ne sait pas encore si 18,7 % représente un usage raisonnable, une
// surreprésentation, ou la simple conséquence mécanique de l'ouverture du
// pool. Il est ventilé par saison et par occasion pour être JUGÉ, pas atteint.
//
// ═══ LIMITE MÉTHODOLOGIQUE CONNUE, À LIRE AVANT LES CHIFFRES ═══
//
// Démontré le 01/09/2026 : « même graine » NE GARANTIT PAS « même tirage
// pièce par pièce ». Quand un levier modifie la TAILLE ou le CONTENU d'une
// liste de candidats, le même nombre aléatoire y sélectionne un autre
// élément, et le décalage se propage aux tirages suivants — accessoires,
// chaussures, sac. Mesuré : 66 paires divergentes de cette seule cause, pour
// une contribution de 0 aux règles étudiées.
//
// Conséquence, appliquée ici : toute divergence est classée en TROIS familles
// distinctes, jamais confondues —
//   1. divergence causée DIRECTEMENT par le levier (la composition du dessus
//      change) ;
//   2. divergence PROPAGÉE en aval (le dessus est identique, autre chose a
//      bougé) ;
//   3. absence d'effet sur la métrique étudiée.
// Un écart de la famille 2 n'est pas un effet de P1' et ne sera pas présenté
// comme tel.
//
// ═══ LES TROIS BRAS ═══
//
//   A   production actuelle — un pull n'est jamais dessus principal
//   B   P1' — un pull de rôle `base` peut l'être
//   C   P1' SAUF entretien — l'arbitrage éditorial déjà pris le 31/08/2026
//
// Le bras C n'a PAS de levier dédié et ne doit pas en avoir un : l'audit
// boucle occasion par occasion, donc il se compose à l'appel (levier actif
// partout, absent pour `entretien`). Aucune ligne de `generateOutfit` n'est
// modifiée. Cette isolabilité est VÉRIFIÉE hors ligne par
// src/lib/__tests__/p1primeBras.test.ts, contre-épreuve comprise : le test
// exige d'abord que le bras B produise bien le pull EN ENTRETIEN, sans quoi
// l'absence de pull dans le bras C ne démontrerait rien.
//
// Le garde-fou des mailles fermées reste ACTIF dans les trois bras. Le § 5
// vérifie qu'il continue d'interdire pull fermé + pull fermé sans interdire
// pull + cardigan/gilet.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;
const TAILLE_ECHANTILLON = 30;
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "—").padStart(6) + (t ? " %" : "  ");

const P1: LeviersMesure = { pullCommeHautPrincipal: "base" };

const BRAS: { nom: string; court: string; leviers: (occ: OccasionKey) => LeviersMesure | undefined }[] = [
  { nom: "A · production actuelle", court: "A", leviers: () => undefined },
  { nom: "B · P1'", court: "B", leviers: () => P1 },
  { nom: "C · P1' sauf entretien", court: "C", leviers: (occ) => (occ === "entretien" ? undefined : P1) },
];

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

interface Resultat {
  tenues: number;
  occCouvertes: number;
  violations: number;
  parRegle: Map<string, number>;
  distinctes: Set<string>;
  mortes: Set<string>;
  mortesParCat: Map<CategoryKey, number>;
  mortesParSaison: Map<CapsuleSeason, number>;
  taillePool: number;
  /** Le pull est le seul dessus, sans robe ni combinaison dans la tenue. */
  pullPrincipal: number;
  /** ... et rien d'autre par-dessus. */
  pullPrincipalSeul: number;
  /** ... avec une seconde couche (calque ou extérieur). */
  pullPrincipalAvecCouche: number;
  pullsUtilisesEnPrincipal: Set<number>;
  parSaison: Map<CapsuleSeason, { tenues: number; pullPrincipal: number }>;
  parOcc: Map<OccasionKey, { tenues: number; pullPrincipal: number }>;
  deuxMaillesFermees: number;
  pullAvecMailleOuverte: number;
}

describe("P1' — le pull comme dessus principal", () => {
  it("mesure les trois bras dans la même exécution, sur les mêmes capsules et les mêmes tirages", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));

    // Capsules calculées UNE FOIS et partagées : l'identité des cellules est
    // structurelle, pas promise. P1' ne touche pas la sélection de capsule.
    const cellules: { saison: CapsuleSeason; style: string; capsule: CatalogItem[]; w: ReturnType<typeof representativeWeatherFor> }[] = [];
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        cellules.push({ saison, style, w, capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool) });
      }
    }
    const taillePool = cellules.reduce((n, c) => n + c.capsule.length, 0);
    console.log(`Catalogue : ${pool.length} pièces. ${cellules.length} cellules, ${taillePool} places de capsule.`);
    console.log(`${N} tirages par cellule × occasion, 3 bras. Garde-fou mailles fermées ACTIF partout.`);

    const vide = (): Resultat => ({
      tenues: 0, occCouvertes: 0, violations: 0, parRegle: new Map(), distinctes: new Set(), mortes: new Set(),
      mortesParCat: new Map(), mortesParSaison: new Map(), taillePool, pullPrincipal: 0, pullPrincipalSeul: 0,
      pullPrincipalAvecCouche: 0, pullsUtilisesEnPrincipal: new Set(), parSaison: new Map(), parOcc: new Map(),
      deuxMaillesFermees: 0, pullAvecMailleOuverte: 0,
    });
    const res = new Map<string, Resultat>(BRAS.map((b) => [b.court, vide()]));

    /** Échantillon qualitatif : réservoir tiré au sort, JAMAIS trié ni filtré. */
    const reservoir: { texte: string }[] = [];
    let vusPourEchantillon = 0;
    const rngEchantillon = mulberry32(grainePour("echantillon-qualitatif-p1prime"));

    for (const b of BRAS) {
      const r = res.get(b.court)!;
      for (const c of cellules) {
        const vusIci = new Set<number>();
        for (const occ of OCCS) {
          let couverte = false;
          const sOcc = r.parOcc.get(occ) ?? { tenues: 0, pullPrincipal: 0 };
          const sSaison = r.parSaison.get(c.saison) ?? { tenues: 0, pullPrincipal: 0 };
          for (let k = 0; k < N; k++) {
            const vraiRandom = Math.random;
            Math.random = mulberry32(grainePour(`${c.saison}|${c.style}|${occ}|${k}`));
            let ids: number[];
            try {
              ids = generateOutfitWithFallback(c.capsule, c.w, occ, "Présentiel", "Verre", [], "femme", c.saison, b.leviers(occ)).ids;
            } finally {
              Math.random = vraiRandom;
            }
            if (!ids.length) continue;
            couverte = true;
            r.tenues += 1;
            sOcc.tenues += 1;
            sSaison.tenues += 1;
            for (const id of ids) vusIci.add(id);
            r.distinctes.add(`${c.saison}|${c.style}|${occ}|${[...ids].sort((x, y) => x - y).join(",")}`);
            const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];

            // ── B · LE PULL COMME DESSUS PRINCIPAL ──
            // Les tenues à robe/combinaison sont exclues : un pull posé en
            // calque sur une robe n'est PAS un pull porté comme dessus
            // principal, et le compter ainsi gonflait la métrique de 2,2 %
            // dans un audit antérieur — un chiffre impossible, donc faux.
            const unePiece = pieces.some((p) => p.cat === "robe" || p.cat === "combinaison");
            const dessus = pieces.filter((p) => p.cat === "haut" || p.cat === "pull");
            const pulls = dessus.filter((p) => p.cat === "pull");
            const estPullPrincipal = pulls.length > 0 && !unePiece && !dessus.some((p) => p.cat === "haut");
            if (estPullPrincipal) {
              r.pullPrincipal += 1;
              sOcc.pullPrincipal += 1;
              sSaison.pullPrincipal += 1;
              for (const p of pulls) r.pullsUtilisesEnPrincipal.add(p.id);
              const aUneCouche = dessus.length > 1 || pieces.some((p) => p.cat === "veste" || p.cat === "manteau");
              if (aUneCouche) r.pullPrincipalAvecCouche += 1; else r.pullPrincipalSeul += 1;

              // ── F · ÉCHANTILLON QUALITATIF ──
              // Réservoir uniforme sur le SEUL bras B, sans aucun critère de
              // sélection : ni les cas problématiques, ni les cas réussis. Le
              // tirage est semé, donc reproductible à l'identique.
              if (b.court === "B") {
                vusPourEchantillon += 1;
                const ligne = { texte: `${c.saison} · ${c.style} · ${occ} — ${pieces.filter((p) => CLOTHING_CATS.includes(p.cat)).map((p) => p.name).join(" + ")}` };
                if (reservoir.length < TAILLE_ECHANTILLON) reservoir.push(ligne);
                else {
                  const j = Math.floor(rngEchantillon() * vusPourEchantillon);
                  if (j < TAILLE_ECHANTILLON) reservoir[j] = ligne;
                }
              }
            }

            // ── E · LE GARDE-FOU TIENT-IL TOUJOURS ? ──
            const fermees = pieces.filter((p) => fermetureMaille(p) === "fermée");
            if (fermees.length >= 2) r.deuxMaillesFermees += 1;
            if (pulls.length >= 2 && pieces.some((p) => fermetureMaille(p) === "ouverte")) r.pullAvecMailleOuverte += 1;

            // ── D · RÈGLES DURES ──
            // R-B1 exclue : elle compare la saison de la pièce à la météo
            // alors que la génération suit le référentiel de la capsule. Bruit
            // constant, identique dans les trois bras.
            for (const h of evaluateBlocking(pieces, occ, c.w, "Présentiel", "Verre")) {
              if (h.id === "R-B1") continue;
              r.violations += 1;
              r.parRegle.set(h.id, (r.parRegle.get(h.id) ?? 0) + 1);
            }
          }
          r.parOcc.set(occ, sOcc);
          r.parSaison.set(c.saison, sSaison);
          if (couverte) r.occCouvertes += 1;
        }
        // ── A · MORTALITÉ, PAR CELLULE ──
        // Une pièce jamais tirée dans SA capsule y est morte, même si elle vit
        // ailleurs. Définition plus stricte que celle de l'audit pull-contrat ;
        // les deux chiffres ne se comparent pas.
        for (const it of c.capsule) {
          if (vusIci.has(it.id)) continue;
          r.mortes.add(`${c.saison}|${c.style}|${it.id}`);
          r.mortesParCat.set(it.cat, (r.mortesParCat.get(it.cat) ?? 0) + 1);
          r.mortesParSaison.set(c.saison, (r.mortesParSaison.get(c.saison) ?? 0) + 1);
        }
      }
    }

    const A = res.get("A")!;

    // ═══ 1 · COUVERTURE — CRITÈRE BLOQUANT, DONC EN PREMIER ═══
    console.log(`\n════════ 1 · COUVERTURE D'OCCASION — CRITÈRE BLOQUANT ════════`);
    console.log(`  320 = 32 capsules × 10 occasions. Aucune perte n'est acceptable comme effet`);
    console.log(`  secondaire silencieux : une perte ici bloque la décision, quel que soit le reste.`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      const e = r.occCouvertes - A.occCouvertes;
      console.log(`  ${b.nom.padEnd(28)}${`${r.occCouvertes}/320`.padStart(10)}${(b.court === "A" ? "—" : (e >= 0 ? "+" : "") + e).padStart(10)}`);
    }

    // ═══ 2 · RÈGLES DURES ═══
    console.log(`\n════════ 2 · VIOLATIONS DE RÈGLES DURES ════════`);
    console.log(`  Une hausse inexpliquée bloque la décision. Seule R-B9 est bloquante au sens`);
    console.log(`  du moteur (hard: true) ; les autres sont des signaux affichés.`);
    console.log(`  ${"bras".padEnd(28)}${"tenues".padStart(9)}${"violations".padStart(12)}${"par tenue".padStart(11)}${"vs A".padStart(9)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      const e = r.violations - A.violations;
      console.log(`  ${b.nom.padEnd(28)}${String(r.tenues).padStart(9)}${String(r.violations).padStart(12)}` +
        `${(r.tenues ? (r.violations / r.tenues).toFixed(3) : "—").padStart(11)}${(b.court === "A" ? "—" : (e >= 0 ? "+" : "") + e).padStart(9)}`);
    }
    const regles = [...new Set(BRAS.flatMap((b) => [...res.get(b.court)!.parRegle.keys()]))].sort();
    console.log(`\n  ${"règle".padEnd(10)}${BRAS.map((b) => b.court.padStart(10)).join("")}`);
    for (const rg of regles) {
      console.log(`  ${rg.padEnd(10)}` + BRAS.map((b) => String(res.get(b.court)!.parRegle.get(rg) ?? 0).padStart(10)).join(""));
    }

    // ═══ 3 · LE GARDE-FOU MAILLES FERMÉES TIENT-IL SOUS P1' ? ═══
    console.log(`\n════════ 3 · GARDE-FOU MAILLES FERMÉES ════════`);
    console.log(`  Il doit interdire pull fermé + pull fermé SANS interdire pull + cardigan/gilet.`);
    console.log(`  ${"bras".padEnd(28)}${"2 mailles fermées".padStart(20)}${"pull + maille ouverte".padStart(24)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(28)}${String(r.deuxMaillesFermees).padStart(20)}${String(r.pullAvecMailleOuverte).padStart(24)}`);
    }
    console.log(`  Colonne 1 : doit valoir 0 partout. Colonne 2 : doit rester NON NULLE — sinon`);
    console.log(`  le garde-fou interdit en bloc au lieu de discriminer, et c'est une régression.`);

    // ═══ 4 · MORTALITÉ ═══
    console.log(`\n════════ 4 · MORTALITÉ ════════`);
    console.log(`  Une baisse n'est PAS un objectif. « Nouvelles mortes » n'est jamais soldé avec`);
    console.log(`  « ressuscitées » : c'est le signal de régression.`);
    console.log(`  ${"bras".padEnd(28)}${"mortes".padStart(9)}${"taux".padStart(10)}${"ressusc.".padStart(11)}${"NOUVELLES".padStart(11)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      const ress = [...A.mortes].filter((k) => !r.mortes.has(k)).length;
      const nouv = [...r.mortes].filter((k) => !A.mortes.has(k)).length;
      console.log(`  ${b.nom.padEnd(28)}${String(r.mortes.size).padStart(9)}${pct(r.mortes.size, r.taillePool).padStart(10)}` +
        `${(b.court === "A" ? "—" : String(ress)).padStart(11)}${(b.court === "A" ? "—" : String(nouv)).padStart(11)}`);
    }
    console.log(`\n  Par saison :`);
    console.log(`  ${"bras".padEnd(28)}${CAPSULE_SEASONS.map((s) => s.padStart(12)).join("")}`);
    for (const b of BRAS) {
      console.log(`  ${b.nom.padEnd(28)}` + CAPSULE_SEASONS.map((s) => String(res.get(b.court)!.mortesParSaison.get(s) ?? 0).padStart(12)).join(""));
    }
    const cats = [...new Set(BRAS.flatMap((b) => [...res.get(b.court)!.mortesParCat.keys()]))].sort();
    console.log(`\n  Par catégorie :`);
    console.log(`  ${"catégorie".padEnd(16)}${BRAS.map((b) => b.court.padStart(10)).join("")}`);
    for (const cat of cats) {
      console.log(`  ${cat.padEnd(16)}` + BRAS.map((b) => String(res.get(b.court)!.mortesParCat.get(cat) ?? 0).padStart(10)).join(""));
    }
    console.log(`  Le chantier MANTEAU reste séparé : cette ligne ne conclut rien sur lui.`);

    // ═══ 5 · USAGE DU PULL — OBSERVATION, PAS CIBLE ═══
    console.log(`\n════════ 5 · LE PULL COMME DESSUS PRINCIPAL ════════`);
    console.log(`  AUCUNE valeur cible n'est fixée. Ce tableau est à JUGER éditorialement, pas à`);
    console.log(`  atteindre. Un taux élevé n'est ni bon ni mauvais en soi.`);
    console.log(`  ${"bras".padEnd(28)}${"dessus princ.".padStart(15)}${"part".padStart(10)}${"seul".padStart(9)}${"+ couche".padStart(10)}${"pulls distincts".padStart(17)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(28)}${String(r.pullPrincipal).padStart(15)}${pct(r.pullPrincipal, r.tenues).padStart(10)}` +
        `${String(r.pullPrincipalSeul).padStart(9)}${String(r.pullPrincipalAvecCouche).padStart(10)}${String(r.pullsUtilisesEnPrincipal.size).padStart(17)}`);
    }
    console.log(`\n  Par saison :`);
    console.log(`  ${"bras".padEnd(28)}${CAPSULE_SEASONS.map((s) => `${s}`.padStart(14)).join("")}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(28)}` + CAPSULE_SEASONS.map((s) => {
        const v = r.parSaison.get(s);
        return pct(v?.pullPrincipal ?? 0, v?.tenues ?? 0).padStart(14);
      }).join(""));
    }
    console.log(`\n  Par occasion :`);
    console.log(`  ${"occasion".padEnd(20)}${BRAS.map((b) => b.court.padStart(12)).join("")}`);
    for (const occ of OCCS) {
      console.log(`  ${occ.padEnd(20)}` + BRAS.map((b) => {
        const v = res.get(b.court)!.parOcc.get(occ);
        return pct(v?.pullPrincipal ?? 0, v?.tenues ?? 0).padStart(12);
      }).join(""));
    }
    console.log(`  La ligne « entretien » doit valoir 0,0 % dans le bras C : c'est la vérification`);
    console.log(`  de l'arbitrage éditorial, et l'écart B - C en isole le coût.`);

    // ═══ 6 · ÉCHANTILLON QUALITATIF ═══
    console.log(`\n════════ 6 · ${TAILLE_ECHANTILLON} TENUES TIRÉES AU SORT — LECTURE HUMAINE ════════`);
    console.log(`  Tirage UNIFORME par réservoir sur les ${vusPourEchantillon} tenues du bras B où un pull est`);
    console.log(`  dessus principal. Ni les cas problématiques, ni les cas réussis n'ont été`);
    console.log(`  privilégiés ; aucune retouche. Le tirage est semé, donc reproductible.`);
    console.log(`  À classer à l'œil : COHÉRENTE / DISCUTABLE / INCOHÉRENTE. Ce classement est`);
    console.log(`  éditorial et ne doit PAS devenir un score automatique.`);
    for (const [i, e] of reservoir.entries()) console.log(`  ${String(i + 1).padStart(3)}. ${e.texte}`);

    // ═══ 7 · DIVERSITÉ — INFORMATION COMPLÉMENTAIRE, JAMAIS UN KPI ═══
    console.log(`\n════════ 7 · DIVERSITÉ ════════`);
    console.log(`  Ni une hausse ni une baisse ne constitue un gain ou une perte. Reporté ici`);
    console.log(`  uniquement à titre d'information, après tout le reste.`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      const e = r.distinctes.size - A.distinctes.size;
      console.log(`  ${b.nom.padEnd(28)}${String(r.distinctes.size).padStart(10)}${(b.court === "A" ? "—" : (e >= 0 ? "+" : "") + e).padStart(10)}`);
    }

    console.log(`\n  LECTURE SEULE. P1' reste un levier de mesure, inerte en production.`);
    console.log(`  Rappel de méthode : « même graine » ne garantit pas « même tirage pièce par`);
    console.log(`  pièce » — un levier qui change une liste de candidats décale le flux en aval.`);
    console.log(`  Tout écart de composition hors du dessus principal est à traiter comme une`);
    console.log(`  divergence PROPAGÉE, jamais comme un effet de P1'.`);
  });
});



