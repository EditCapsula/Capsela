import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { generateOutfitWithFallback } from "../src/lib/logic";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import type { StyleId } from "../src/lib/profile";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE 15 · CHANTIER E — SIMULATION DU RETAG. LECTURE SEULE, EN MÉMOIRE.
// AUCUN UPDATE. La base n'est jamais écrite : le retag est appliqué à la
// copie en mémoire du pool, le temps de la mesure.
//
// Deux points du contrôle de cohérence ne sont pas démontrés et le sont ici :
//
//  (9) Un changement d'occasion affecte-t-il la SÉLECTION ?
//      Oui, mécaniquement : pickBestMarginal classe d'abord sur le nombre
//      d'occasions marginales non couvertes, et respecterBudget protège la
//      dernière porteuse d'une occasion — les deux via occasionsOf(), qui
//      retombe sur l'heuristique quand la colonne est vide. Passer de
//      l'heuristique (3 occasions pour une robe) à une liste explicite de 4
//      change donc le rang. L'ampleur est mesurée ici.
//
//  (10) Ces pièces entrent-elles seulement dans la capsule de leur style ?
//      Retaguer une pièce que la sélection ne retient jamais ne produirait
//      rien. Jamais vérifié jusqu'ici.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const OCC4: OccasionKey[] = ["festive", "evenement_perso"];
const TIRAGES = 20;

/** Les cinq candidates, plus les deux cas ouverts. Ids CATALOGUE (offset inclus). */
const CANDIDATES: { id: number; nom: string; styles: StyleId[] }[] = [
  { id: 100855, nom: "Robe portefeuille midi", styles: ["casual_chic"] },
  { id: 101038, nom: "Robe chemise noire", styles: ["casual_chic", "minimaliste"] },
  { id: 100891, nom: "Robe chemise longue ceinturée", styles: ["boheme"] },
  { id: 100993, nom: "Robe portefeuille midi", styles: ["preppy", "classique_chic"] },
  { id: 100801, nom: "Robe chemise midi ceinturée", styles: ["preppy", "classique_chic"] },
  { id: 100795, nom: "Robe pull col rond (F1, cas ouvert)", styles: ["preppy"] },
  { id: 100725, nom: "Robe T-shirt oversize (streetwear, cas ouvert)", styles: ["streetwear"] },
];
const CIBLES: StyleId[] = ["casual_chic", "boheme", "preppy", "streetwear"];

/** Les deux ensembles en débat au Q2. Aucun n'est neutre : toute écriture restreint. */
const VARIANTES: Record<string, OccasionKey[]> = {
  "avec quotidien": ["quotidien", "soiree", "date", "evenement_perso"],
  "sans quotidien": ["soiree", "date", "evenement_perso"],
};

const occDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(0) : "0") + " %";

function tauxPalier4(capsule: CatalogItem[], w: ReturnType<typeof representativeWeatherFor>, occ: OccasionKey) {
  let ok = 0, plein = 0;
  for (let k = 0; k < TIRAGES; k++) {
    const r = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme");
    if (!r.ids.length) continue;
    ok += 1;
    if (!r.formalityDowngraded) plein += 1;
  }
  return { ok, plein };
}

describe("Phase 15 — simulation du retag", () => {
  it("mesure l'effet réel du retag sans jamais écrire en base", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    // ═══ 1 · CONTRÔLE DE COHÉRENCE : LES PIÈCES SONT-ELLES CE QU'ON CROIT ? ═══
    console.log(`\n════════ 1 · CONTRÔLE DE COHÉRENCE DES SEPT PIÈCES ════════`);
    console.log(`  ${"id".padEnd(9)}${"cat".padEnd(13)}${"F".padStart(3)}${"saison".padStart(18)}${"bornes".padStart(9)}${"occ. déclarées".padStart(24)}`);
    for (const c of CANDIDATES) {
      const it = pool.find((x) => x.id === c.id);
      if (!it) { console.log(`  #${c.id}  INTROUVABLE DANS LE POOL — DIVERGENCE`); continue; }
      const b = `${it.meteoMinTemp ?? "—"}/${it.meteoMaxTemp ?? "—"}`;
      const occ = it.occasion && it.occasion.length ? it.occasion.join(",") : "(vide → toutes)";
      console.log(`  #${it.id}  ${String(it.cat).padEnd(13)}${String(formalityOf(it)).padStart(3)}${String(it.season).padStart(18)}${b.padStart(9)}${occ.padStart(24)}`);
      console.log(`           styles: ${(it.styleTags ?? []).join(", ") || "(aucun)"}`);
      console.log(`           occasionsOf() aujourd'hui : ${occDe(it).join(", ")}`);
    }

    // ═══ 2 · POINT 10 — CES PIÈCES ENTRENT-ELLES DANS LA CAPSULE ? ═══
    console.log(`\n════════ 2 · PRÉSENCE DANS LA CAPSULE, AVANT TOUT RETAG ════════`);
    console.log(`  Retaguer une pièce que la sélection ne retient jamais ne produirait rien.`);
    console.log(`  ${"pièce".padEnd(9)}${"style".padEnd(16)}${SAISONS.map((s) => s.padStart(11)).join("")}`);
    for (const c of CANDIDATES) {
      for (const style of c.styles.filter((s) => CIBLES.includes(s))) {
        const dans = SAISONS.map((saison) => {
          const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, pool);
          return capsule.some((x) => x.id === c.id) ? "oui" : "—";
        });
        console.log(`  #${c.id}  ${style.padEnd(16)}${dans.map((d) => d.padStart(11)).join("")}`);
      }
    }

    // ═══ 3 · SIMULATION DU RETAG, DEUX VARIANTES ═══
    for (const [nomVariante, occs] of Object.entries(VARIANTES)) {
      console.log(`\n════════ 3 · SIMULATION — variante « ${nomVariante} » (${occs.join(", ")}) ════════`);
      // Les 5 candidates retenues seulement — ni #100795 ni #100725, cas ouverts.
      const aRetaguer = new Set([100855, 101038, 100891, 100993, 100801]);
      const simule: CatalogItem[] = pool.map((it) => (aRetaguer.has(it.id) ? { ...it, occasion: [...occs] } : it));

      console.log(`  ${"style".padEnd(16)}${"saison".padEnd(11)}${"palier 4 avant".padStart(16)}${"palier 4 après".padStart(16)}${"pièces déplacées".padStart(18)}`);
      for (const style of CIBLES) {
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          const p = profilAudit({ gender: "femme", styles: [style] });
          const avant = computeDefaultCapsule(p, w, [], saison, pool);
          const apres = computeDefaultCapsule(p, w, [], saison, simule);
          const idsAvant = new Set(avant.map((x) => x.id));
          const deplacees = apres.filter((x) => !idsAvant.has(x.id)).length;
          const a = OCC4.map((o) => tauxPalier4(avant, w, o));
          const b = OCC4.map((o) => tauxPalier4(apres, w, o));
          const fmt = (r: { ok: number; plein: number }[]) => r.map((x) => pct(x.plein, TIRAGES)).join(" / ");
          console.log(`  ${style.padEnd(16)}${saison.padEnd(11)}${fmt(a).padStart(16)}${fmt(b).padStart(16)}${String(deplacees).padStart(18)}`);
        }
      }
      console.log(`  (« palier 4 » = part des tenues produites SANS repli, festive / evenement_perso)`);

      // Effet collatéral sur les styles NON ciblés — les pièces retaguées y sont aussi.
      console.log(`\n  Effet collatéral sur les styles non ciblés :`);
      let totalDeplace = 0, cellules = 0;
      for (const style of STYLES_FEMME.filter((s) => !CIBLES.includes(s))) {
        const parSaison = SAISONS.map((saison) => {
          const w = representativeWeatherFor(saison);
          const p = profilAudit({ gender: "femme", styles: [style] });
          const avant = computeDefaultCapsule(p, w, [], saison, pool);
          const apres = computeDefaultCapsule(p, w, [], saison, simule);
          const idsAvant = new Set(avant.map((x) => x.id));
          const d = apres.filter((x) => !idsAvant.has(x.id)).length;
          totalDeplace += d; cellules += 1;
          return d;
        });
        console.log(`    ${style.padEnd(16)}${parSaison.map((d) => String(d).padStart(6)).join("")}`);
      }
      console.log(`    ⟹ ${totalDeplace} substitutions sur ${cellules} capsules de styles non ciblés.`);
    }
    console.log(`\n  AUCUNE ÉCRITURE EN BASE. Toutes les mesures ci-dessus portent sur une copie mémoire.`);
  }, 900_000);
});
