import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { CLOTHING_CATS, evaluateBlocking, generateOutfitWithFallback, type LeviersMesure } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// CONTRAT PULL / GÉNÉRATION — MESURE AVANT DÉCISION. LECTURE SEULE.
//
// Deux arbitrages éditoriaux ont été rendus le 31/08/2026 :
//   1. « Un pull peut constituer à lui seul le haut de la tenue. »
//   2. « Un pull de coupe fine peut être proposé par-dessus une chemise. »
//
// Ils désignent deux verrous du moteur, indépendants :
//   P1  logic.ts — le tirage du haut principal ne demande que la catégorie
//       "haut", donc aucun pull ne peut être haut principal, quel que soit
//       son rôle.
//   P2  R-B8 — la seconde couche exige le rôle "calque", donc jamais un pull
//       de coupe fine.
//
// Deux leviers => baseline, chacun seul, et la combinaison, DANS LA MÊME
// EXÉCUTION sur les MÊMES capsules (règle d'audit, points 1 à 3). Les bras
// isolés ne servent pas à « faire mieux » : ils servent à ATTRIBUER une
// éventuelle régression à l'un des deux.
//
// CE QUE CETTE MESURE NE DÉCIDE PAS. Le nombre de tenues distinctes n'est
// PAS un objectif : une hausse n'est pas un gain, une baisse n'est pas une
// perte. Il est reporté en dernier et ne doit être lu qu'après la mortalité,
// la couverture et les violations de règles dures. Le réalisme éditorial —
// « porterait-on vraiment ça ? » — n'est mesurable par aucune métrique
// existante : `evaluateBlocking` mesure la conformité aux règles dures, pas
// le goût, et `computeLookScore` ne discrimine rien sur ce pool (mesuré :
// 100 % des tenues à >= 80). Un échantillon nominatif de tenues NOUVELLES est
// donc imprimé en fin d'audit pour lecture humaine, séparément du chiffré.
//
// Aucun UPDATE, aucune écriture, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "—").padStart(6) + (t ? " %" : "  ");

const BRAS: { nom: string; court: string; leviers?: LeviersMesure }[] = [
  { nom: "A · production actuelle", court: "A" },
  { nom: "P1 · pull haut principal", court: "P1", leviers: { pullCommeHautPrincipal: true } },
  { nom: "avant-P2 · pull non superposable", court: "avP2", leviers: { pullNonSuperposable: true } },
  { nom: "P1 seul, sans P2", court: "P1-av", leviers: { pullCommeHautPrincipal: true, pullNonSuperposable: true } },
  // Cinquième bras — ne teste aucun arbitrage. Il élucide un écart de ligne de
  // base que je n'ai pas su expliquer : l'audit `suggestions-mortes` comptait
  // 90 mortes, celui-ci 69 sur le même pool. La règle des mailles fermées est
  // la seule modification de code entre les deux runs. Ce bras la neutralise :
  // s'il retrouve 90, l'écart est expliqué ; sinon, il ne l'est pas et les
  // valeurs absolues du bras A restent ininterprétables.
  { nom: "R · sans règle mailles fermées", court: "R", leviers: { superpositionMaillesFermees: true } },
];

const estMailleFermee = (it: Item) => it.cat === "pull" && (it.subtype === "Pull" || it.subtype === "Col roulé");

interface Resultat {
  vus: Set<number>;
  tenues: number;
  tenuesParOcc: Map<OccasionKey, number>;
  occCouvertes: number;
  violations: number;
  tenuesAvecViolation: number;
  /** R-B1 comptée à part — cf. le commentaire à son point de calcul. */
  rb1: number;
  parRegle: Map<string, number>;
  distinctes: Set<string>;
  pullPrincipal: number;
  pullSecondaire: number;
  deuxMaillesFermees: number;
  parCatOcc: Map<string, number>;
  /** Signatures de tenues, pour repérer celles qu'un bras crée et que A ne produit pas. */
  echantillon: Map<string, string>;
}

describe("contrat pull / génération", () => {
  it("mesure les quatre bras dans la même exécution", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`Catalogue exploitable : ${pool.length} pièces sur ${rows.length} lignes.`);
    console.log(`${N} tirages par cellule × occasion, 4 saisons × 8 styles × 10 occasions, 4 bras.`);

    const cellules: { saison: CapsuleSeason; style: string; capsule: CatalogItem[]; w: ReturnType<typeof representativeWeatherFor> }[] = [];
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        cellules.push({ saison, style, w, capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool) });
      }
    }
    const taillePool = cellules.reduce((n, c) => n + c.capsule.length, 0);

    const vide = (): Resultat => ({
      vus: new Set(), tenues: 0, tenuesParOcc: new Map(), occCouvertes: 0, violations: 0, tenuesAvecViolation: 0, rb1: 0, parRegle: new Map(),
      distinctes: new Set(), pullPrincipal: 0, pullSecondaire: 0, deuxMaillesFermees: 0, parCatOcc: new Map(), echantillon: new Map(),
    });
    const res = new Map<string, Resultat>(BRAS.map((b) => [b.court, vide()]));
    /** Mortes par bras, pour la vitalité dans les deux sens. */
    const mortes = new Map<string, Set<string>>();

    for (const c of cellules) {
      for (const b of BRAS) {
        const r = res.get(b.court)!;
        for (const occ of OCCS) {
          let couverte = false;
          for (let k = 0; k < N; k++) {
            const ids = generateOutfitWithFallback(c.capsule, c.w, occ, "Présentiel", "Verre", [], "femme", c.saison, b.leviers).ids;
            if (!ids.length) continue;
            couverte = true;
            r.tenues += 1;
            r.tenuesParOcc.set(occ, (r.tenuesParOcc.get(occ) ?? 0) + 1);
            r.distinctes.add(`${c.saison}|${c.style}|${occ}|${[...ids].sort((x, y) => x - y).join(",")}`);
            const pieces = ids.map((id) => c.capsule.find((p) => p.id === id)).filter((p): p is CatalogItem => Boolean(p)) as Item[];
            for (const p of pieces) r.vus.add(p.id);

            // Composition — un pull est « principal » s'il est le seul dessus.
            // « Pull seul dessus » exclut les tenues à robe/combinaison : un pull
            // posé en calque sur une robe n'est pas un pull porté seul, et le
            // compter ainsi gonflait la métrique de 2,2 % dans un bras où aucun
            // pull ne PEUT être haut principal — un chiffre impossible, donc faux.
            const unePiece = pieces.some((p) => p.cat === "robe" || p.cat === "combinaison");
            const dessus = pieces.filter((p) => p.cat === "haut" || p.cat === "pull");
            const pulls = dessus.filter((p) => p.cat === "pull");
            const pullSeul = pulls.length > 0 && !unePiece && !dessus.some((p) => p.cat === "haut");
            if (pullSeul) r.pullPrincipal += 1;
            if (pulls.length && dessus.some((p) => p.cat === "haut")) r.pullSecondaire += 1;
            if (dessus.filter(estMailleFermee).length >= 2) r.deuxMaillesFermees += 1;
            for (const cat of new Set(pieces.map((p) => p.cat))) {
              r.parCatOcc.set(`${cat}|${occ}`, (r.parCatOcc.get(`${cat}|${occ}`) ?? 0) + 1);
            }

            // Violations de règles dures — seule métrique objective de cohérence.
            //
            // R-B1 EST EXCLUE, et il faut dire pourquoi. Elle compare la saison
            // de chaque pièce à `weather.seasons`, alors que la génération suit
            // désormais le référentiel de la CAPSULE (correctif du 29/08/2026) :
            // une capsule Printemps est bâtie sur « Printemps / Été » tandis que
            // sa météo représentative, 16 °C, porte le bucket « Automne /
            // Hiver ». R-B1 se déclencherait donc sur presque toutes les tenues,
            // à l'identique dans les quatre bras — un bruit constant qui
            // masquerait les écarts réels sans rien apprendre. Elle est comptée
            // à part, jamais mélangée aux autres.
            const hits = evaluateBlocking(pieces, occ, c.w, "Présentiel", "Verre");
            const dures = hits.filter((h) => h.id !== "R-B1");
            if (hits.some((h) => h.id === "R-B1")) r.rb1 += 1;
            if (dures.length) {
              r.violations += dures.length;
              r.tenuesAvecViolation += 1;
              for (const h of dures) r.parRegle.set(h.id, (r.parRegle.get(h.id) ?? 0) + 1);
            }

            // Échantillon pour lecture humaine — RESTREINT aux tenues où un pull
            // est le seul dessus. Sans ce filtre, il listait des tenues « absentes
            // du bras A » qui l'étaient par pur hasard du tirage, sans le moindre
            // pull : 8 642 tenues distinctes tirées aléatoirement rendent la
            // quasi-totalité des signatures inédites. L'échantillon ne montrait
            // donc rien de ce qu'il prétendait montrer.
            if (b.court !== "A" && pullSeul && r.echantillon.size < 400) {
              r.echantillon.set(
                `${c.saison}|${c.style}|${occ}|${[...ids].sort((x, y) => x - y).join(",")}`,
                `${c.saison} · ${c.style} · ${occ} — ${pieces.filter((p) => CLOTHING_CATS.includes(p.cat)).map((p) => p.name).join(" + ")}`
              );
            }
          }
          if (couverte) r.occCouvertes += 1;
        }
        for (const it of c.capsule) if (!r.vus.has(it.id)) { /* recalculé après la boucle */ }
      }
    }

    // Mortalité : une pièce est morte si elle n'est vue dans AUCUNE tenue de son bras.
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      const set = new Set<string>();
      for (const c of cellules) for (const it of c.capsule) if (!r.vus.has(it.id)) set.add(`${c.saison}|${c.style}|${it.id}`);
      mortes.set(b.court, set);
    }

    // ═══ 1 · MORTALITÉ ═══
    console.log(`\n════════ 1 · MORTALITÉ ════════`);
    console.log(`  ${"bras".padEnd(28)}${"mortes".padStart(9)}${"part".padStart(10)}${"ressusc.".padStart(11)}${"NOUVELLES MORTES".padStart(19)}`);
    const mA = mortes.get("A")!;
    for (const b of BRAS) {
      const m = mortes.get(b.court)!;
      const ressuscitees = [...mA].filter((k) => !m.has(k)).length;
      const nouvelles = [...m].filter((k) => !mA.has(k)).length;
      console.log(`  ${b.nom.padEnd(28)}${String(m.size).padStart(9)}${pct(m.size, taillePool).padStart(10)}` +
        `${(b.court === "A" ? "—" : String(ressuscitees)).padStart(11)}${(b.court === "A" ? "—" : String(nouvelles)).padStart(19)}`);
    }
    console.log(`\n  « Nouvelles mortes » n'est JAMAIS soldé avec « ressuscitées » : c'est le signal de régression.`);

    // ═══ 2 · MORTALITÉ PAR CATÉGORIE ET PAR SAISON ═══
    console.log(`\n════════ 2 · MORTALITÉ PAR CATÉGORIE ════════`);
    const cats = [...new Set(cellules.flatMap((c) => c.capsule.map((it) => it.cat)))].sort();
    console.log(`  ${"catégorie".padEnd(14)}${BRAS.map((b) => b.court.padStart(9)).join("")}`);
    for (const cat of cats) {
      const cols = BRAS.map((b) => {
        const m = mortes.get(b.court)!;
        let n = 0;
        for (const c of cellules) for (const it of c.capsule) if (it.cat === cat && m.has(`${c.saison}|${c.style}|${it.id}`)) n += 1;
        return String(n).padStart(9);
      });
      if (cols.some((x) => x.trim() !== "0")) console.log(`  ${String(cat).padEnd(14)}${cols.join("")}`);
    }
    console.log(`\n════════ 2b · MORTALITÉ PAR SAISON ════════`);
    console.log(`  ${"saison".padEnd(14)}${BRAS.map((b) => b.court.padStart(9)).join("")}`);
    for (const saison of CAPSULE_SEASONS) {
      const cols = BRAS.map((b) => {
        const m = mortes.get(b.court)!;
        let n = 0;
        for (const c of cellules.filter((x) => x.saison === saison)) for (const it of c.capsule) if (m.has(`${saison}|${c.style}|${it.id}`)) n += 1;
        return String(n).padStart(9);
      });
      console.log(`  ${saison.padEnd(14)}${cols.join("")}`);
    }

    // ═══ 3 · COUVERTURE — CRITÈRE BLOQUANT ═══
    console.log(`\n════════ 3 · COUVERTURE D'OCCASION — CRITÈRE BLOQUANT ════════`);
    console.log(`  Aucune perte n'est tolérable. 320 cellules = 32 capsules × 10 occasions.`);
    console.log(`  ${"bras".padEnd(28)}${"couvertes".padStart(12)}${"écart vs A".padStart(13)}`);
    const cA = res.get("A")!.occCouvertes;
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(28)}${`${r.occCouvertes}/320`.padStart(12)}${(b.court === "A" ? "—" : String(r.occCouvertes - cA)).padStart(13)}`);
    }

    // ═══ 4 · VIOLATIONS DE RÈGLES DURES ═══
    console.log(`\n════════ 4 · VIOLATIONS DE RÈGLES DURES (evaluateBlocking) ════════`);
    console.log(`  Seule métrique objective de cohérence disponible. Ne mesure pas le goût.`);
    console.log(`  R-B1 est EXCLUE du décompte (elle compare la saison de la pièce à la météo, or la`);
    console.log(`  génération suit le référentiel de la capsule : bruit constant, identique aux 4 bras).`);
    console.log(`  ${"bras".padEnd(28)}${"tenues".padStart(9)}${"tenues en faute".padStart(17)}${"part".padStart(9)}${"(R-B1 à part)".padStart(15)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(28)}${String(r.tenues).padStart(9)}${String(r.tenuesAvecViolation).padStart(17)}${pct(r.tenuesAvecViolation, r.tenues)}${pct(r.rb1, r.tenues).padStart(15)}`);
    }
    console.log(`\n  Détail par règle :`);
    const regles = [...new Set(BRAS.flatMap((b) => [...res.get(b.court)!.parRegle.keys()]))].sort();
    if (!regles.length) console.log(`    aucune violation hors R-B1, dans aucun bras.`);
    for (const id of regles) {
      console.log(`    ${id.padEnd(8)}${BRAS.map((b) => String(res.get(b.court)!.parRegle.get(id) ?? 0).padStart(11)).join("")}`);
    }

    // ═══ 5 · COMPOSITION ═══
    console.log(`\n════════ 5 · COMPOSITION DES TENUES ════════`);
    console.log(`  ${"bras".padEnd(28)}${"pull seul dessus".padStart(18)}${"pull + haut".padStart(13)}${"2 mailles fermées".padStart(19)}`);
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(28)}${pct(r.pullPrincipal, r.tenues).padStart(18)}${pct(r.pullSecondaire, r.tenues).padStart(13)}${pct(r.deuxMaillesFermees, r.tenues).padStart(19)}`);
    }
    console.log(`  « 2 mailles fermées » doit rester à 0,0 % partout : la règle du 31/08/2026 est active par défaut.`);

    console.log(`\n════════ 5b · OCCUPATION PAR CATÉGORIE — RÉGRESSIONS ÉVENTUELLES ════════`);
    console.log(`  Une catégorie qui recule est une pièce que le pull a évincée.`);
    const suivies: CategoryKey[] = ["haut", "pull", "veste", "manteau", "robe", "pantalon"];
    console.log(`  ${"catégorie".padEnd(14)}${BRAS.map((b) => b.court.padStart(11)).join("")}`);
    for (const cat of suivies) {
      const cols = BRAS.map((b) => {
        const r = res.get(b.court)!;
        let n = 0;
        for (const occ of OCCS) n += r.parCatOcc.get(`${cat}|${occ}`) ?? 0;
        return pct(n, r.tenues).padStart(11);
      });
      console.log(`  ${String(cat).padEnd(14)}${cols.join("")}`);
    }
    console.log(`\n  Interaction à surveiller (établie par lecture de code) : un pull devenu haut`);
    console.log(`  principal n'est jamais une chemise, or forceEntretienVeste exige une chemise`);
    console.log(`  pour déclencher la veste garantie ET l'unique tirage de manteau. Regarder`);
    console.log(`  « veste » et « manteau » sur entretien ci-dessous.`);
    console.log(`\n  ${"entretien".padEnd(14)}${BRAS.map((b) => b.court.padStart(11)).join("")}`);
    for (const cat of ["veste", "manteau"] as CategoryKey[]) {
      const cols = BRAS.map((b) => {
        const r = res.get(b.court)!;
        return pct(r.parCatOcc.get(`${cat}|entretien`) ?? 0, r.tenuesParOcc.get("entretien") ?? 0).padStart(11);
      });
      console.log(`  ${String(cat).padEnd(14)}${cols.join("")}`);
    }

    // ═══ 6 · DIVERSITÉ — EN DERNIER, ET SANS JUGEMENT ═══
    console.log(`\n════════ 6 · DIVERSITÉ — INDICATEUR SECONDAIRE ════════`);
    console.log(`  Une hausse n'est PAS un gain, une baisse n'est PAS une perte. À lire seulement`);
    console.log(`  après §1 à §5, et jamais comme un objectif.`);
    console.log(`  ${"bras".padEnd(28)}${"tenues distinctes".padStart(19)}${"écart vs A".padStart(13)}`);
    const dA = res.get("A")!.distinctes.size;
    for (const b of BRAS) {
      const r = res.get(b.court)!;
      console.log(`  ${b.nom.padEnd(28)}${String(r.distinctes.size).padStart(19)}${(b.court === "A" ? "—" : `${r.distinctes.size - dA > 0 ? "+" : ""}${r.distinctes.size - dA}`).padStart(13)}`);
    }

    // ═══ 7 · LECTURE HUMAINE ═══
    console.log(`\n════════ 7 · TENUES NOUVELLES — POUR LECTURE HUMAINE ════════`);
    console.log(`  Le réalisme éditorial n'est mesurable par AUCUNE métrique existante. Ces tenues`);
    console.log(`  sont produites par P1+P2, ont un PULL POUR SEUL DESSUS, et n'existent pas dans`);
    console.log(`  le bras A. C'est très exactement ce que l'arbitrage a autorisé. À juger à l'œil.`);
    const dejaVues = res.get("A")!.distinctes;
    const nouvelles = [...res.get("P1")!.echantillon.entries()].filter(([sig]) => !dejaVues.has(sig)).slice(0, 30);
    if (!nouvelles.length) console.log(`  (aucune tenue nouvelle)`);
    for (const [, texte] of nouvelles) console.log(`  ${texte}`);

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucun appelant de production modifié.`);
    console.log(`  Cet audit ne décide rien : il instruit un arbitrage.`);
  }, 900_000);
});
