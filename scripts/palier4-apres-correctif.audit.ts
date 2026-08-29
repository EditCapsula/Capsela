import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { CLOTHING_CATS, TOP_LAYER_CATS, generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey, Season } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE P0 · RE-MESURE DU PALIER 4 APRÈS CORRECTIF. LECTURE SEULE.
//
// Le correctif du référentiel saisonnier est en place. La mesure de diversité
// a montré que les occasions HABILLÉES étaient les plus affectées au printemps
// — entretien +43,8 %, soiree +38,0 %, festive +36,7 %, evenement_perso
// +33,2 %. Une part de ce que les phases précédentes ont attribué à un trou de
// CATALOGUE venait donc peut-être de ce défaut de MOTEUR.
//
// Cet audit mesure les DIX occasions, pas seulement les deux de palier 4 :
// restreindre au palier 4 raterait les replis 3 -> 1 de entretien, soiree et
// travail_formel, qui ont bougé autant dans la mesure de diversité.
//
// AVANT et APRÈS sont mesurés dans la même exécution, sur la même capsule :
// le paramètre `capsuleSeason` de generateOutfitWithFallback étant optionnel,
// l'omettre reproduit exactement le comportement d'avant correctif.
//
// Le retag reste SIMULÉ en mémoire. Aucun UPDATE.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const FORM = new Map<OccasionKey, number>(OCCASIONS.map(([k, , , f]) => [k, f]));
const OCC4: OccasionKey[] = ["festive", "evenement_perso"];
const UNEPIECE: CategoryKey[] = ["robe", "combinaison"];
const TIRAGES = 20;
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const occDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));

function passeRB3(it: Item, occ: OccasionKey, min: number): boolean {
  return (
    !CLOTHING_CATS.includes(it.cat) ||
    Boolean(it.occasion && it.occasion.includes(occ)) ||
    (TOP_LAYER_CATS.includes(it.cat) && formalityOf(it) > 0) ||
    formalityOf(it) >= min
  );
}

/** Une cellule replie-t-elle ? Renvoie aussi si le comportement est déterministe. */
function repli(capsule: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, occ: OccasionKey, s: CapsuleSeason | null) {
  let plein = 0, vide = 0;
  for (let k = 0; k < TIRAGES; k++) {
    const r = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", s);
    if (!r.ids.length) { vide += 1; continue; }
    if (!r.formalityDowngraded) plein += 1;
  }
  return { replie: plein === 0, partiel: plein > 0 && plein < TIRAGES - vide, plein, vide };
}

describe("P0 — palier 4 après correctif", () => {
  it("re-mesure les dix occasions, avant et après, dans la même exécution", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    const capsules = new Map<string, CatalogItem[]>();
    for (const saison of CAPSULE_SEASONS) {
      for (const style of STYLES_FEMME) {
        capsules.set(`${saison}|${style}`, computeDefaultCapsule(
          profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, pool));
      }
    }

    // ═══ 1 · REPLI PAR OCCASION, AVANT ET APRÈS ═══
    console.log(`\n════════ 1 · CELLULES QUI REPLIENT, SUR 32 (4 saisons × 8 styles) ════════`);
    console.log(`  ${"occasion".padEnd(18)}${"form.".padStart(6)}${"avant".padStart(9)}${"après".padStart(9)}${"réparées".padStart(11)}${"cellules partielles".padStart(21)}`);
    let totalAvant = 0, totalApres = 0, partiels = 0;
    const detail: { occ: OccasionKey; saison: CapsuleSeason; style: string }[] = [];
    for (const occ of OCCS) {
      let a = 0, b = 0;
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES_FEMME) {
          const caps = capsules.get(`${saison}|${style}`)!;
          const av = repli(caps, w, occ, null);
          const ap = repli(caps, w, occ, saison);
          if (av.partiel || ap.partiel) partiels += 1;
          if (av.replie) a += 1;
          if (ap.replie) b += 1; else if (av.replie) detail.push({ occ, saison, style });
        }
      }
      totalAvant += a; totalApres += b;
      console.log(`  ${occ.padEnd(18)}${String(FORM.get(occ)).padStart(6)}${(a + "/32").padStart(9)}${(b + "/32").padStart(9)}${String(a - b).padStart(11)}${(partiels ? String(partiels) : "0").padStart(21)}`);
    }
    console.log(`\n  TOTAL : ${totalAvant} cellules repliaient sur 320, ${totalApres} après — ${totalAvant - totalApres} réparées.`);
    console.log(`  Cellules au comportement non déterministe : ${partiels} (0 attendu).`);

    // ═══ 2 · LES CELLULES RÉPARÉES, NOMMÉES ═══
    console.log(`\n════════ 2 · CELLULES RÉPARÉES PAR LE SEUL CORRECTIF ════════`);
    if (!detail.length) console.log(`  aucune.`);
    for (const d of detail) console.log(`  ${d.occ.padEnd(18)}${d.saison.padEnd(11)}${d.style}`);

    // ═══ 3 · MÉCANISME — UNE-PIÈCES ÉLIGIBLES AU PALIER 4 DANS LE POOL EFFECTIF ═══
    console.log(`\n════════ 3 · UNE-PIÈCES ÉLIGIBLES AU PALIER 4, POOL EFFECTIF ════════`);
    console.log(`  useRobe exige poolFor(ONEPIECE_CATS).length > 0 : à zéro, le repli est certain.`);
    console.log(`  ${"saison".padEnd(11)}${STYLES_FEMME.map((s) => s.slice(0, 8).padStart(11)).join("")}`);
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      const bucket: Season[] = [capsuleSeasonBucket(saison), "Toutes saisons"];
      const cellules = STYLES_FEMME.map((style) => {
        const caps = capsules.get(`${saison}|${style}`)!;
        const elig = (base: CatalogItem[]) => base.filter((it) =>
          UNEPIECE.includes(it.cat) && OCC4.some((o) => passeRB3(it, o, 4)) &&
          (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) && (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp)).length;
        return `${elig(caps.filter((it) => w.seasons.includes(it.season)))}→${elig(caps.filter((it) => bucket.includes(it.season)))}`;
      });
      console.log(`  ${saison.padEnd(11)}${cellules.map((c) => c.padStart(11)).join("")}`);
    }
    console.log(`  Lecture : « avant → après ».`);

    // ═══ 4 · LE RETAG APPORTE-T-IL ENCORE QUELQUE CHOSE ? ═══
    console.log(`\n════════ 4 · RETAG SIMULÉ, PAR-DESSUS LE CORRECTIF ════════`);
    console.log(`  Retag TOUJOURS simulé en mémoire. Aucun UPDATE.`);
    const RETAG: OccasionKey[] = ["quotidien", "travail_formel", "entretien", "soiree", "date", "evenement_perso"];
    const cibles = new Set([100855, 101038, 100891, 100993, 100801]);
    const simule: CatalogItem[] = pool.map((it) => (cibles.has(it.id) ? { ...it, occasion: [...RETAG] } : it));
    console.log(`  ${"occasion".padEnd(18)}${"correctif seul".padStart(16)}${"+ retag".padStart(11)}${"apport du retag".padStart(18)}`);
    for (const occ of OCC4) {
      let sansRetag = 0, avecRetag = 0;
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES_FEMME) {
          const p = profilAudit({ gender: "femme", styles: [style] });
          if (!repli(capsules.get(`${saison}|${style}`)!, w, occ, saison).replie) sansRetag += 1;
          const capsuleSim = computeDefaultCapsule(p, w, [], saison, simule);
          if (!repli(capsuleSim, w, occ, saison).replie) avecRetag += 1;
        }
      }
      console.log(`  ${occ.padEnd(18)}${(sansRetag + "/32").padStart(16)}${(avecRetag + "/32").padStart(11)}${String(avecRetag - sansRetag).padStart(18)}`);
    }

    // ═══ 5 · PORTÉE CONTRE TENUE, APRÈS CORRECTIF ═══
    console.log(`\n════════ 5 · PORTÉE CONTRE TENUE, APRÈS CORRECTIF ════════`);
    console.log(`  La portée dépend de la capsule seule : le correctif ne peut pas la changer.`);
    let portee = 0, tenue = 0, n = 0;
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        const caps = capsules.get(`${saison}|${style}`)!;
        for (const occ of OCCS) {
          n += 1;
          if (caps.some((it) => occDe(it).includes(occ))) portee += 1;
          let ok = false;
          for (let k = 0; k < TIRAGES && !ok; k++) {
            if (generateOutfitWithFallback(caps, w, occ, "Présentiel", "Verre", [], "femme", saison).ids.length) ok = true;
          }
          if (ok) tenue += 1;
        }
      }
    }
    console.log(`  Portée : ${pct(portee, n)} (${(portee / 32).toFixed(2)}/10 par capsule)`);
    console.log(`  Tenue  : ${pct(tenue, n)} (${(tenue / 32).toFixed(2)}/10 par capsule)`);
    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucun retag appliqué, aucune modification.`);
  }, 900_000);
});
