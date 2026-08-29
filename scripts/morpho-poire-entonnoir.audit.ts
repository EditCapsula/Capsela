import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfit } from "../src/lib/logic";
import { effetMorphologique } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item } from "../src/lib/types";
import { type Profile } from "../src/lib/profile";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";
import { OCCASIONS } from "../src/lib/data";

// Où se perd la capacité morphologique d'une poire ? — LECTURE SEULE.
//
// La phase 8 a montré qu'en été et en hiver, presque aucun look ne réunit un
// levier épaules et un bas discret. Restait à savoir À QUEL ÉTAGE la capacité
// disparaît. On suit donc le même entonnoir pour chaque saison :
//
//   CATALOGUE ÉLIGIBLE  →  RETENU EN CAPSULE  →  TIRÉ DANS UN LOOK
//
// Trois étages, trois causes possibles : insuffisance du catalogue, sélection
// de capsule, ou génération des looks. Aucune règle n'est modifiée ici.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
/**
 * Les styles exposés, par IDENTIFIANT (harnais d'audit du 29/08/2026).
 * Les libellés français qu'utilisait la version précédente renvoyaient
 * `undefined` via STYLE_ID_TO_CATALOG_LABEL : le filtre de style était
 * silencieusement sauté et la mesure portait sur un pool universel.
 */
const STYLES = STYLES_FEMME;
const profil = (styles: readonly string[]): Profile => profilAudit({ gender: "femme", styles });
const pct = (n: number, t: number) => (t ? ((n / t) * 100).toFixed(1) : "0.0") + " %";
const isSport = (it: Item) => (it.niveauFormalite ?? 1) === 0;

/** Ce qui donne de la présence en haut. */
const levierEpaules = (x: Item) => effetMorphologique(x).epaules >= 2;
/** Un bas dont l'effet sur les hanches est connu et faible. */
const basDiscret = (x: Item) => ["pantalon", "jean", "jupe", "short"].includes(x.cat)
  && effetMorphologique(x).confiance !== "inconnue" && effetMorphologique(x).hanches <= 1;
/** Un bas qui charge les hanches — le contraire du levier recherché. */
const basChargeant = (x: Item) => ["pantalon", "jean", "jupe", "short"].includes(x.cat)
  && effetMorphologique(x).hanches >= 2;

describe("Entonnoir de capacité morphologique — poire", () => {
  it("localise l'étage où la capacité disparaît", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    console.log(`\n════════ 0 · VÉRIFICATION DU PLAFOND DE 40 ════════`);
    console.log(`  Recherche dans capsule.ts : AUCUNE borne sur la taille totale de la capsule.`);
    console.log(`  Les quotas de CAPSULE_GROUPS somment à 35 ; cinq mécanismes ajoutent par-dessus`);
    console.log(`  sans plafond (formalité, ensure×8, chaussures d'intérieur, collants, sport).`);
    console.log(`  Le plafond de 40 est donc une CIBLE PRODUIT, pas une règle implémentée.\n`);

    for (const saison of SAISONS) {
      const w = representativeWeatherFor(saison);
      const bucket = capsuleSeasonBucket(saison);
      // Étage 1 — catalogue éligible : femme, saison, température. Ce sont les
      // filtres que computeDefaultCapsule applique avant toute curation.
      const eligible = pool.filter((it) =>
        it.genre !== "homme" &&
        (it.season === bucket || it.season === "Toutes saisons") &&
        (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) &&
        (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp) &&
        !isSport(it)
      );

      // Étage 2 — retenu en capsule, sur les 6 styles.
      const enCapsule = new Map<number, CatalogItem>();
      for (const style of STYLES) {
        for (const p of computeDefaultCapsule(profil([style]), w, [], saison, pool)) {
          if (!isSport(p)) enCapsule.set(p.id, p);
        }
      }

      // Étage 3 — effectivement tiré dans un look.
      const tire = new Set<number>();
      for (const style of STYLES) {
        const capsule = computeDefaultCapsule(profil([style]), w, [], saison, pool);
        for (const [occ] of OCCASIONS) {
          for (let n = 0; n < 30; n++) {
            const { ids } = generateOutfit(capsule, w, occ, "Présentiel", "Verre", [], "femme");
            ids.forEach((id) => tire.add(id));
          }
        }
      }

      const compte = (f: (x: Item) => boolean) => ({
        cat: eligible.filter(f).length,
        caps: [...enCapsule.values()].filter(f).length,
        look: [...enCapsule.values()].filter((x) => f(x) && tire.has(x.id)).length,
      });
      const ep = compte(levierEpaules);
      const bd = compte(basDiscret);
      const bc = compte(basChargeant);

      console.log(`\n──────── ${saison.toUpperCase()} (${w.temp} °C, bucket « ${bucket} ») ────────`);
      console.log(`  ${"".padEnd(22)} ${"catalogue".padStart(10)} ${"capsule".padStart(9)} ${"tiré".padStart(7)}`);
      console.log(`  ${"leviers épaules".padEnd(22)} ${String(ep.cat).padStart(10)} ${String(ep.caps).padStart(9)} ${String(ep.look).padStart(7)}`);
      console.log(`  ${"bas discrets".padEnd(22)} ${String(bd.cat).padStart(10)} ${String(bd.caps).padStart(9)} ${String(bd.look).padStart(7)}`);
      console.log(`  ${"bas chargeant les hanches".padEnd(22)} ${String(bc.cat).padStart(10)} ${String(bc.caps).padStart(9)} ${String(bc.look).padStart(7)}`);
      console.log(`  Taux de passage épaules : catalogue→capsule ${pct(ep.caps, ep.cat)} · capsule→look ${pct(ep.look, ep.caps)}`);

      // Qui sont ces leviers, et lesquels ne sortent jamais ?
      const leviers = [...enCapsule.values()].filter(levierEpaules);
      console.log(`\n  Leviers épaules retenus en capsule :`);
      for (const l of leviers) {
        const e = effetMorphologique(l);
        console.log(`     ${tire.has(l.id) ? "✓" : "✗"} ${l.name.padEnd(38).slice(0, 38)} [${l.cat}] épaules ${e.epaules} · formalité ${l.niveauFormalite ?? "?"}`);
      }

      // Les leviers du catalogue écartés par la sélection : combien, et pourquoi
      // ne passent-ils pas ? On regarde leur famille.
      const ecartes = eligible.filter((x) => levierEpaules(x) && !enCapsule.has(x.id));
      const parFamille = new Map<string, number>();
      for (const x of ecartes) parFamille.set(x.cat, (parFamille.get(x.cat) || 0) + 1);
      console.log(`\n  Leviers épaules éligibles mais NON retenus : ${ecartes.length}`);
      for (const [fam, n] of [...parFamille.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`     ${fam.padEnd(12)} ${n}`);
      }
      console.log(`     exemples : ${ecartes.slice(0, 4).map((x) => x.name).join(" · ")}`);
    }

    console.log(`\nAucune modification effectuée — audit en lecture seule.`);
  }, 900_000);
});
