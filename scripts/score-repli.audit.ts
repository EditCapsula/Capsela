import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { computeLookScore, generateOutfitWithFallback } from "../src/lib/logic";
import { paletteHexes } from "../src/lib/profile";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// UX DU REPLI · SCORE DES TENUES REPLIÉES. LECTURE SEULE.
//
// Question posée, et une seule : sur les tenues dont la formalité a été
// abaissée (`formalityDowngraded`), quelle part atteint le seuil du badge
// « Recommandé » (score >= 80) ?
//
// Enjeu : TenuesScreen rend aujourd'hui les deux badges MUTUELLEMENT
// EXCLUSIFS — `formalityDowngraded ? "Meilleure alternative" : (badge ===
// "recommande" && "Recommandé")`. Une tenue repliée ne peut donc JAMAIS
// afficher « Recommandé », quel que soit son score. Si le cas « repliée ET
// score >= 80 » est fréquent, cette exclusivité masque une information vraie
// et la question n'est plus un simple libellé.
//
// Le score ne contient AUCUN terme de formalité (R-S1 à R-S15 : couleurs,
// pièce statement, métaux, chaussures/sac, matières, palette, layering,
// anti-répétition). C'est une lecture de code, pas une mesure — la mesure
// ci-dessous ne la présuppose pas et compare les deux populations à
// iso-occasion, dans la même exécution, sur les mêmes capsules.
//
// DEUX LIMITES, énoncées avant les chiffres :
// 1. Le profil d'audit n'a pas de palette personnelle, donc R-S10 (+10) ne
//    peut jamais se déclencher. Les scores mesurés sont un PLANCHER. La part
//    « >= 70 » est reportée en regard : c'est la borne haute qu'atteindrait
//    la même tenue chez une utilisatrice dont la palette est renseignée et
//    dont une pièce y correspond. Les deux populations subissent ce plancher
//    à l'identique.
// 2. R-S11 (+10 layering) ne se déclenche que si `isDressy(occasion)` est
//    faux. Il dépend de l'OCCASION demandée, jamais du palier résolu : une
//    tenue repliée pour une occasion habillée reste privée de ce bonus. La
//    comparaison n'est donc valide qu'à iso-occasion — d'où le détail §2.
//
// Aucun UPDATE, aucun retag, aucune modification de production.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const FORM = new Map<OccasionKey, number>(OCCASIONS.map(([k, , , f]) => [k, f]));
const TIRAGES = 30;
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "—").padStart(6) + (t ? " %" : "  ");

interface Stat {
  n: number;
  somme: number;
  min: number;
  max: number;
  reco: number; // >= 80
  haut: number; // >= 70 (borne palette)
  neutre: number; // 50..79
  ajuster: number; // < 50
}
const vide = (): Stat => ({ n: 0, somme: 0, min: 999, max: -1, reco: 0, haut: 0, neutre: 0, ajuster: 0 });
function ajoute(s: Stat, score: number) {
  s.n += 1;
  s.somme += score;
  s.min = Math.min(s.min, score);
  s.max = Math.max(s.max, score);
  if (score >= 80) s.reco += 1;
  if (score >= 70) s.haut += 1;
  if (score >= 50 && score < 80) s.neutre += 1;
  if (score < 50) s.ajuster += 1;
}
const moy = (s: Stat) => (s.n ? (s.somme / s.n).toFixed(1) : "—");
const ligne = (nom: string, s: Stat) =>
  `  ${nom.padEnd(22)}${String(s.n).padStart(7)}${moy(s).padStart(9)}` +
  `${(s.n ? `${s.min}-${s.max}` : "—").padStart(10)}${pct(s.reco, s.n)}${pct(s.haut, s.n)}${pct(s.neutre, s.n)}${pct(s.ajuster, s.n)}`;
const ENTETE =
  `  ${"population".padEnd(22)}${"tirages".padStart(7)}${"moyenne".padStart(9)}${"min-max".padStart(10)}` +
  `${">= 80".padStart(8)}${">= 70".padStart(8)}${"50-79".padStart(8)}${"< 50".padStart(8)}`;

describe("UX repli — score des tenues repliées", () => {
  it("mesure la part des tenues repliées qui atteignent le seuil « Recommandé »", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`Catalogue exploitable : ${pool.length} pièces sur ${rows.length} lignes.`);
    console.log(`${TIRAGES} tirages par cellule × occasion, 4 saisons × 8 styles × 10 occasions.`);

    const global = { replie: vide(), plein: vide() };
    const parOcc = new Map<OccasionKey, { replie: Stat; plein: Stat }>();
    const parTransition = new Map<string, Stat>();
    for (const occ of OCCS) parOcc.set(occ, { replie: vide(), plein: vide() });

    // Cellules : une cellule est « repliée » quand tous ses tirages non vides
    // le sont (le repli est déterministe par construction — attemptCoreOutfit
    // épuise MAX_ATTEMPTS_PER_TIER avant de descendre d'un palier).
    const cellulesRepliees: { saison: CapsuleSeason; style: string; occ: OccasionKey; s: Stat }[] = [];
    let cellulesMixtes = 0;

    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        const profile = profilAudit({ gender: "femme", styles: [style] });
        const hexes = paletteHexes(profile);
        const caps = computeDefaultCapsule(profile, w, [], saison, pool);
        for (const occ of OCCS) {
          const cellule = { replie: vide(), plein: vide() };
          for (let k = 0; k < TIRAGES; k++) {
            const r = generateOutfitWithFallback(caps, w, occ, "Présentiel", "Verre", hexes, "femme", saison);
            if (!r.ids.length) continue;
            const pieces = r.ids
              .map((id) => caps.find((p) => p.id === id))
              .filter((p): p is CatalogItem => Boolean(p)) as Item[];
            const ls = computeLookScore(pieces, occ, hexes, profile.morphology, new Set<string>(), w, "Présentiel", "Verre", caps);
            const cible = r.formalityDowngraded ? "replie" : "plein";
            ajoute(cellule[cible], ls.score);
            ajoute(global[cible], ls.score);
            ajoute(parOcc.get(occ)![cible], ls.score);
            if (r.formalityDowngraded) {
              const cle = `${r.requestedFormality} → ${r.resolvedFormality}`;
              if (!parTransition.has(cle)) parTransition.set(cle, vide());
              ajoute(parTransition.get(cle)!, ls.score);
            }
          }
          if (cellule.replie.n && cellule.plein.n) cellulesMixtes += 1;
          if (cellule.replie.n && !cellule.plein.n) cellulesRepliees.push({ saison, style, occ, s: cellule.replie });
        }
      }
    }

    // ═══ 1 · LES DEUX POPULATIONS, TOUTES OCCASIONS CONFONDUES ═══
    console.log(`\n════════ 1 · SCORE DES TENUES, REPLIÉES CONTRE NON REPLIÉES ════════`);
    console.log(ENTETE);
    console.log(ligne("repliées", global.replie));
    console.log(ligne("non repliées", global.plein));
    console.log(`\n  « >= 80 » = seuil du badge « Recommandé » aujourd'hui inatteignable pour une tenue repliée.`);
    console.log(`  « >= 70 » = même tenue chez une utilisatrice dont la palette est renseignée et couverte (R-S10, +10).`);
    console.log(`  Toutes occasions confondues : comparaison INDICATIVE seulement (R-S11 dépend de l'occasion). Voir §2.`);

    // ═══ 2 · À ISO-OCCASION ═══
    console.log(`\n════════ 2 · À ISO-OCCASION — la seule comparaison valide ════════`);
    for (const occ of OCCS) {
      const o = parOcc.get(occ)!;
      console.log(`\n  ${occ} (formalité demandée ${FORM.get(occ)})`);
      console.log(ENTETE);
      console.log(ligne("  repliées", o.replie));
      console.log(ligne("  non repliées", o.plein));
    }

    // ═══ 3 · PAR TRANSITION DE PALIER ═══
    console.log(`\n════════ 3 · SCORE PAR TRANSITION DE PALIER ════════`);
    console.log(`  L'ampleur du repli (4 → 1 contre 3 → 1) change-t-elle le score ?`);
    console.log(ENTETE);
    for (const [cle, s] of [...parTransition.entries()].sort()) console.log(ligne(cle, s));

    // ═══ 4 · CELLULES ENTIÈREMENT REPLIÉES QUI ATTEINDRAIENT « RECOMMANDÉ » ═══
    console.log(`\n════════ 4 · CELLULES ENTIÈREMENT REPLIÉES, PAR SORT DU BADGE ════════`);
    console.log(`  Une cellule = saison × style × occasion. « Recommandé majoritaire » = plus de la`);
    console.log(`  moitié de ses tirages atteignent 80 — le badge serait affiché sans le repli.`);
    const majoReco = cellulesRepliees.filter((c) => c.s.reco * 2 > c.s.n);
    const majoHaut = cellulesRepliees.filter((c) => c.s.haut * 2 > c.s.n);
    const jamais = cellulesRepliees.filter((c) => c.s.reco === 0);
    console.log(`\n  Cellules entièrement repliées      : ${cellulesRepliees.length}`);
    console.log(`  Cellules au comportement mixte     : ${cellulesMixtes} (0 attendu — le repli est déterministe)`);
    console.log(`  ... dont « Recommandé » majoritaire : ${majoReco.length}  (${pct(majoReco.length, cellulesRepliees.length).trim()})`);
    console.log(`  ... dont >= 70 majoritaire          : ${majoHaut.length}  (${pct(majoHaut.length, cellulesRepliees.length).trim()})`);
    console.log(`  ... dont jamais 80 sur ${TIRAGES} tirages : ${jamais.length}  (${pct(jamais.length, cellulesRepliees.length).trim()})`);
    if (majoReco.length) {
      console.log(`\n  Les cellules où « Meilleure alternative » remplace un « Recommandé » mérité :`);
      console.log(`  ${"saison".padEnd(11)}${"style".padEnd(16)}${"occasion".padEnd(18)}${"moyenne".padStart(9)}${">= 80".padStart(8)}`);
      for (const c of majoReco) {
        console.log(`  ${c.saison.padEnd(11)}${c.style.padEnd(16)}${c.occ.padEnd(18)}${moy(c.s).padStart(9)}${pct(c.s.reco, c.s.n)}`);
      }
    }

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucune modification de production.`);
  }, 900_000);
});
