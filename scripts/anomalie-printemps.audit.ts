import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import {
  CAPSULE_SEASONS, capsuleSeasonBucket, computeDefaultCapsule, representativeWeatherFor, weatherSeasonBucket,
} from "../src/lib/capsule";
import { formalityOf } from "../src/lib/attributes";
import { CLOTHING_CATS, TOP_LAYER_CATS, generateOutfitWithFallback } from "../src/lib/logic";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, OccasionKey } from "../src/lib/types";
import type { StyleId } from "../src/lib/profile";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// PHASE 15 · CHANTIER F — CAUSE DE L'ANOMALIE PRINTEMPS. LECTURE SEULE.
//
// L'hypothèse « une veste de palier 4 manque » est ÉCARTÉE : elle n'explique
// pas pourquoi l'échec est propre au printemps, l'automne exigeant une couche
// au moins autant. La cause réelle est arithmétique et tient en deux lignes.
//
//   weatherSeasonBucket(temp) = temp >= 20 ? "Printemps / Été" : "Automne / Hiver"
//   capsuleSeasonBucket(s)    = (s === "Printemps" || s === "Été") ? "Printemps / Été" : "Automne / Hiver"
//
// representativeWeatherFor("Printemps") pose temp = 16, donc son bucket météo
// vaut "Automne / Hiver" — alors que la capsule Printemps est bâtie sur le
// bucket "Printemps / Été". generateOutfit filtre ensuite
//     seasonPool = pool.filter(i => weather.seasons.includes(i.season))
// et écarte donc TOUTES les pièces Printemps/Été de la capsule Printemps.
//
// Un garde-fou existe — `seasonPool.length >= 4 ? seasonPool : pool` — mais il
// ne joue que si moins de quatre pièces survivent. Cet audit mesure combien en
// survivent réellement, et si la pièce visée en fait partie.
//
// AUCUNE CORRECTION N'EST PROPOSÉE NI APPLIQUÉE ICI.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCC4: OccasionKey[] = ["festive", "evenement_perso"];
const UNEPIECE = ["robe", "combinaison"];
const TIRAGES = 20;
const CAS: { id: number; style: StyleId; saison: CapsuleSeason; attendu: string }[] = [
  { id: 100855, style: "casual_chic", saison: "Printemps", attendu: "ÉCHOUE" },
  { id: 100993, style: "preppy", saison: "Printemps", attendu: "ÉCHOUE" },
  { id: 101038, style: "casual_chic", saison: "Automne", attendu: "fonctionne" },
  { id: 101038, style: "casual_chic", saison: "Hiver", attendu: "fonctionne" },
  { id: 100801, style: "preppy", saison: "Automne", attendu: "fonctionne" },
];
const RETAG: OccasionKey[] = ["quotidien", "travail_formel", "soiree", "date", "evenement_perso"];

function passeRB3(it: Item, occ: OccasionKey, min: number): boolean {
  return (
    !CLOTHING_CATS.includes(it.cat) ||
    Boolean(it.occasion && it.occasion.includes(occ)) ||
    (TOP_LAYER_CATS.includes(it.cat) && formalityOf(it) > 0) ||
    formalityOf(it) >= min
  );
}

describe("Phase 15 — anomalie printemps", () => {
  it("établit la cause par la mesure, sans rien corriger", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    // ═══ 1 · LES DEUX BUCKETS CONCORDENT-ILS ? ═══
    console.log(`\n════════ 1 · BUCKET DE LA CAPSULE CONTRE BUCKET DE LA MÉTÉO REPRÉSENTATIVE ════════`);
    console.log(`  ${"saison".padEnd(11)}${"temp".padStart(6)}${"bucket capsule".padStart(20)}${"bucket météo".padStart(20)}${"concordent".padStart(13)}`);
    for (const s of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(s);
      const bc = capsuleSeasonBucket(s);
      const bm = weatherSeasonBucket(w.temp);
      console.log(`  ${s.padEnd(11)}${String(w.temp).padStart(6)}${bc.padStart(20)}${bm.padStart(20)}${(bc === bm ? "oui" : "*** NON ***").padStart(13)}`);
    }

    // ═══ 2 · COMBIEN DE PIÈCES DE LA CAPSULE SURVIVENT AU FILTRE SAISON ? ═══
    console.log(`\n════════ 2 · SURVIE DE LA CAPSULE AU FILTRE seasonPool DE generateOutfit ════════`);
    console.log(`  Garde-fou : seasonPool est abandonné au profit du pool entier s'il reste < 4 pièces.`);
    console.log(`  ${"style".padEnd(16)}${"saison".padEnd(11)}${"capsule".padStart(9)}${"survivent".padStart(11)}${"garde-fou".padStart(11)}${"1p survivantes".padStart(16)}`);
    for (const style of STYLES_FEMME) {
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool);
        const survivent = capsule.filter((it) => w.seasons.includes(it.season));
        const garde = survivent.length >= 4 ? "non" : "OUI (repli)";
        console.log(`  ${style.padEnd(16)}${saison.padEnd(11)}${String(capsule.length).padStart(9)}${String(survivent.length).padStart(11)}${garde.padStart(11)}` +
          `${String(survivent.filter((it) => UNEPIECE.includes(it.cat)).length).padStart(16)}`);
      }
    }

    // ═══ 3 · TRACE DES CINQ CAS ═══
    console.log(`\n════════ 3 · TRACE PAS À PAS DES CINQ CAS ════════`);
    const aRetaguer = new Set([100855, 101038, 100891, 100993, 100801]);
    const simule: CatalogItem[] = pool.map((it) => (aRetaguer.has(it.id) ? { ...it, occasion: [...RETAG] } : it));
    for (const cas of CAS) {
      const w = representativeWeatherFor(cas.saison);
      const p = profilAudit({ gender: "femme", styles: [cas.style] });
      const capsule = computeDefaultCapsule(p, w, [], cas.saison, simule);
      const cible = capsule.find((it) => it.id === cas.id);
      console.log(`\n  ── #${cas.id} · ${cas.style} · ${cas.saison}  (attendu : ${cas.attendu}) ──`);
      console.log(`     capsule : ${capsule.length} pièces · météo repr. : ${w.temp} °C, seasons = [${w.seasons.join(", ")}]`);
      if (!cible) { console.log(`     ÉTAPE 1 — la pièce n'est PAS dans la capsule. Arrêt.`); continue; }
      console.log(`     ÉTAPE 1 — dans la capsule : oui (saison de la pièce : ${cible.season})`);
      const passeSaison = w.seasons.includes(cible.season);
      console.log(`     ÉTAPE 2 — passe le filtre seasonPool : ${passeSaison ? "oui" : "*** NON — exclue ici ***"}`);
      const survivent = capsule.filter((it) => w.seasons.includes(it.season));
      console.log(`     ÉTAPE 3 — survivants du filtre saison : ${survivent.length} → garde-fou ${survivent.length >= 4 ? "inactif" : "ACTIF, pool entier restauré"}`);
      const base = survivent.length >= 4 ? survivent : capsule;
      const tempOk = (cible.meteoMinTemp == null || w.temp >= cible.meteoMinTemp) && (cible.meteoMaxTemp == null || w.temp <= cible.meteoMaxTemp);
      console.log(`     ÉTAPE 4 — filtre température (${cible.meteoMinTemp ?? "—"}/${cible.meteoMaxTemp ?? "—"} contre ${w.temp} °C) : ${tempOk ? "oui" : "*** NON ***"}`);
      console.log(`     ÉTAPE 5 — R-B3 au palier 4 : ${passeRB3(cible, "evenement_perso", 4) ? "oui (occasion déclarée)" : "*** NON ***"}`);
      const unePieceEligibles = base.filter(
        (it) => UNEPIECE.includes(it.cat) && passeRB3(it, "evenement_perso", 4) &&
          (it.meteoMinTemp == null || w.temp >= it.meteoMinTemp) && (it.meteoMaxTemp == null || w.temp <= it.meteoMaxTemp));
      console.log(`     ÉTAPE 6 — une-pièces éligibles au palier 4 dans le pool effectif : ${unePieceEligibles.length}`);
      console.log(`               ${unePieceEligibles.map((it) => `#${it.id}`).join(" ") || "(aucune → useRobe impossible → repli)"}`);
      for (const occ of OCC4) {
        let plein = 0;
        for (let k = 0; k < TIRAGES; k++) {
          const r = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme");
          if (r.ids.length && !r.formalityDowngraded) plein += 1;
        }
        console.log(`     RÉSULTAT — ${occ.padEnd(16)} palier 4 sans repli : ${plein}/${TIRAGES}`);
      }
    }

    // ═══ 4 · PORTÉE DU DÉFAUT AU-DELÀ DU PALIER 4 ═══
    console.log(`\n════════ 4 · PORTÉE DU DÉFAUT — TOUTES OCCASIONS, PAS SEULEMENT LE PALIER 4 ════════`);
    console.log(`  Part de la capsule effectivement utilisable par generateOutfit, par saison :`);
    console.log(`  ${"saison".padEnd(11)}${"capsule moy.".padStart(14)}${"utilisable moy.".padStart(17)}${"perte".padStart(9)}`);
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      let tot = 0, surv = 0;
      for (const style of STYLES_FEMME) {
        const c = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool);
        tot += c.length;
        surv += c.filter((it) => w.seasons.includes(it.season)).length;
      }
      const n = STYLES_FEMME.length;
      console.log(`  ${saison.padEnd(11)}${(tot / n).toFixed(1).padStart(14)}${(surv / n).toFixed(1).padStart(17)}${(((tot - surv) / tot) * 100).toFixed(1).padStart(8)}%`);
    }
    console.log(`\n  AUCUNE CORRECTION N'EST PROPOSÉE NI APPLIQUÉE. Constat seul.`);
  }, 900_000);
});
