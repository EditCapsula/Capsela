import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LA BORNE HAUTE DOIT-ELLE DÉCIDER DE L'APPARTENANCE À UNE CAPSULE ?
// LECTURE SEULE.
//
// LE CONSTAT QUI OUVRE CE CHANTIER, formulé par l'utilisatrice le 04/09/2026 :
// « pour moi le meteo max signifie qu'une pièce ne sera pas poussée au-delà de
// cette température ».
//
// Vérification faite, le champ est lu de DEUX façons dans le code :
//
//   TENUE DU JOUR — logic.ts:634 : `weather.temp > meteoMaxTemp` écarte la
//   pièce. C'est exactement la définition ci-dessus.
//
//   CAPSULE — capsule.ts:516 : `capsuleTemp <= meteoMaxTemp`, où capsuleTemp
//   est la température REPRÉSENTATIVE de la saison (Printemps 16, Été 24,
//   Automne 14, Hiver 6). Ce n'est plus « ne pas pousser au-delà » mais « la
//   pièce doit couvrir la moyenne de la saison ». Une pièce bornée à 21 sort
//   du vivier d'été, au lieu d'y rester et d'être écartée les jours chauds.
//   Le filet `ensure()` (ligne 680) applique le même test SANS le garde-fou
//   des 16 pièces qui rend le premier relâchable.
//
// CE QUE MESURE CE SCRIPT. Un seul levier : la borne haute cesse de
// conditionner l'APPARTENANCE, et continue d'agir sur la TENUE DU JOUR.
// Techniquement, deux pools — l'un sans borne haute, passé à
// computeDefaultCapsule ; les identifiants obtenus sont ensuite remappés sur
// les pièces ORIGINALES, bornes comprises, pour générer les tenues. Le levier
// est donc exactement celui décrit, sans qu'une ligne de production change.
//
// La borne BASSE est laissée intacte dans les deux bras. Elle pose une
// question symétrique — 80 hauts légers déclarés en hiver — mais ce n'est pas
// celle-ci, et les mélanger interdirait d'attribuer quoi que ce soit.
//
// TROIS CHOSES DOIVENT ÊTRE VRAIES pour que le déplacement soit sans danger,
// et chacune est mesurée plutôt que supposée :
//
//   1 · la capsule ne se remplit pas de pièces inadaptées à la saison ;
//   2 · le motif d'origine du filtre ne réapparaît PAS — le correctif du
//       20/08/2026 existe parce que des collants mi-saison revenaient dans une
//       capsule Été. Si le bras B les y ramène, le filtre gagne l'arbitrage ;
//   3 · la tenue du jour continue d'écarter les pièces trop chaudes. C'est le
//       cœur : si logic.ts fait son travail, une pièce réadmise dans la
//       capsule d'été n'apparaît PAS dans une tenue à 27 °C.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;

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

/** Météo réelle d'une journée chaude, telle que le store la compose. */
const meteoChaude = (temp: number): Weather => ({
  season: "Printemps / Été", temp, label: `journée ${temp} °`,
  seasons: ["Printemps / Été", "Automne / Hiver", "Toutes saisons"],
} as unknown as Weather);

describe("la borne haute doit-elle décider de l'appartenance à une capsule", () => {
  it("mesure le déplacement de la borne haute vers la seule tenue du jour", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const ligne = new Map<number, VestiaireRow>(brutes.map((r) => [VESTIAIRE_ID_OFFSET + r.id, r]));
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    /** Le pool du bras B : identique, borne haute retirée POUR L'APPARTENANCE seule. */
    const poolSansBorneHaute = pool.map((it) => ({ ...it, meteoMaxTemp: undefined }));
    console.log(`Catalogue : ${pool.length} pièces, dont ${pool.filter((it) => it.meteoMaxTemp != null).length} avec une borne haute.`);

    /** Capsule d'un bras, toujours remappée sur les pièces ORIGINALES. */
    const capsulePour = (bras: "A" | "B", style: string, saison: CapsuleSeason): CatalogItem[] => {
      const src = bras === "A" ? pool : poolSansBorneHaute;
      const c = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, src);
      return c.map((it) => index.get(it.id)).filter((x): x is CatalogItem => Boolean(x));
    };

    // ═══ 1 · CE QUE LA CAPSULE GAGNE ═════════════════════════════════════
    console.log(`\n════════ 1 · COMPOSITION DES CAPSULES ════════`);
    console.log(`  ${"saison".padEnd(12)}${"A (actuel)".padStart(12)}${"B (borne au jour)".padStart(20)}${"écart".padStart(9)}`);
    const reintegrees = new Map<number, Set<CapsuleSeason>>();
    for (const saison of CAPSULE_SEASONS) {
      let a = 0, b = 0;
      for (const style of STYLES_FEMME) {
        const ca = capsulePour("A", style, saison), cb = capsulePour("B", style, saison);
        a += ca.length; b += cb.length;
        const ids = new Set(ca.map((it) => it.id));
        for (const it of cb) if (!ids.has(it.id)) reintegrees.set(it.id, (reintegrees.get(it.id) ?? new Set()).add(saison));
      }
      console.log(`  ${saison.padEnd(12)}${String(a).padStart(12)}${String(b).padStart(20)}${((b - a >= 0 ? "+" : "") + (b - a)).padStart(9)}`);
    }
    console.log(`\n  ${reintegrees.size} pièces distinctes réintégrées dans au moins une capsule :`);
    console.log(`  ${"id".padStart(6)}  ${"cat".padEnd(11)}${"max".padStart(5)}  ${"saisons regagnées".padEnd(30)}${"saisons déclarées".padEnd(28)}nom`);
    for (const [id, saisons] of [...reintegrees.entries()].sort((x, y) => (index.get(x[0])!.cat).localeCompare(index.get(y[0])!.cat) || x[0] - y[0])) {
      const it = index.get(id)!, r = ligne.get(id)!;
      console.log(`  ${String(r.id).padStart(6)}  ${it.cat.padEnd(11)}${String(it.meteoMaxTemp ?? "—").padStart(5)}  ${[...saisons].join(", ").padEnd(30)}${(r.saison_capsule ?? "—").slice(0, 27).padEnd(28)}${it.name}`);
    }
    console.log(`\n  Lecture : une pièce dont les « saisons regagnées » ne figurent PAS dans ses`);
    console.log(`  saisons déclarées serait une régression — la capsule accueillerait une pièce`);
    console.log(`  que le catalogue n'y met pas. Une pièce qui regagne une saison qu'elle`);
    console.log(`  déclare est au contraire le défaut que ce bras corrige.`);
    let horsDeclaration = 0;
    for (const [id, saisons] of reintegrees) {
      const dec = (ligne.get(id)!.saison_capsule ?? "").toLowerCase();
      for (const s of saisons) if (!dec.includes(s.toLowerCase())) horsDeclaration += 1;
    }
    console.log(`  >>> couples (pièce × saison) réintégrés HORS déclaration : ${horsDeclaration}`);

    // ═══ 2 · LE MOTIF D'ORIGINE DU FILTRE REVIENT-IL ? ═══════════════════
    //
    // Le filtre a été posé le 20/08/2026 contre un cas précis : des collants
    // mi-saison réapparaissant dans une capsule Été. Si le bras B les y
    // ramène, le filtre a raison et le déplacement est refusé.
    console.log(`\n════════ 2 · CONTRE-ÉPREUVE — LE CAS QUI A MOTIVÉ LE FILTRE ════════`);
    console.log(`  ${"bras".padEnd(8)}${"saison".padEnd(12)}${"collants en capsule".padStart(22)}${"détail".padStart(10)}`);
    for (const bras of ["A", "B"] as const) {
      for (const saison of CAPSULE_SEASONS) {
        let n = 0;
        const noms = new Set<string>();
        for (const style of STYLES_FEMME) {
          for (const it of capsulePour(bras, style, saison)) {
            if (it.cat === "accessoire" && it.accessoireType === "Collants") { n += 1; noms.add(it.name); }
          }
        }
        console.log(`  ${bras.padEnd(8)}${saison.padEnd(12)}${String(n).padStart(22)}${String(noms.size).padStart(10)}  ${[...noms].join(" · ")}`);
      }
    }
    console.log(`  Un retour des collants en capsule ÉTÉ dans le bras B ferait gagner le filtre.`);

    // ═══ 3 · LA TENUE DU JOUR FAIT-ELLE LE TRAVAIL ? ═════════════════════
    //
    // Le cœur. Une pièce réadmise dans la capsule d'été ne doit PAS sortir
    // dans une tenue à 27 °C — sinon le déplacement recrée le bug signalé.
    console.log(`\n════════ 3 · LA BORNE TIENT-ELLE AU NIVEAU DE LA TENUE ? ════════`);
    console.log(`  Capsule ÉTÉ des deux bras, tenues générées à plusieurs températures réelles.`);
    console.log(`  « hors borne » = pièces présentes dans la tenue alors que temp > leur max.`);
    console.log(`\n  ${"bras".padEnd(8)}${"temp".padStart(6)}${"tenues".padStart(9)}${"cellules".padStart(11)}${"hors borne".padStart(13)}${"réintégrées vues".padStart(18)}`);
    const idsReintegres = new Set(reintegrees.keys());
    for (const bras of ["A", "B"] as const) {
      for (const temp of [18, 22, 27]) {
        const w = meteoChaude(temp);
        let tenues = 0, cellules = 0, horsBorne = 0, vues = 0;
        for (const style of STYLES_FEMME) {
          const capsule = capsulePour(bras, style, "Été");
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${style}|${occ}|${k}|${temp}`));
              let ids: number[];
              try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", "Été").ids; }
              finally { Math.random = vrai; }
              if (!ids.length) continue;
              couverte = true; tenues += 1;
              for (const id of ids) {
                const p = index.get(id);
                if (!p) continue;
                if (p.meteoMaxTemp != null && temp > p.meteoMaxTemp) horsBorne += 1;
                if (idsReintegres.has(id)) vues += 1;
              }
            }
            if (couverte) cellules += 1;
          }
        }
        console.log(`  ${bras.padEnd(8)}${(temp + "°").padStart(6)}${String(tenues).padStart(9)}${`${cellules}/${STYLES_FEMME.length * OCCS.length}`.padStart(11)}${String(horsBorne).padStart(13)}${String(vues).padStart(18)}`);
      }
    }
    console.log(`\n  Ce qu'il faut lire : « hors borne » doit rester au même niveau dans les deux`);
    console.log(`  bras. S'il explose dans B, la tenue du jour ne rattrape pas ce que la capsule`);
    console.log(`  ne filtre plus, et le déplacement recréerait le bug des 27 °C.`);
    console.log(`  « réintégrées vues » à 18 ° puis 0 à 27 ° serait la démonstration inverse :`);
    console.log(`  la pièce est disponible quand il fait doux et écartée quand il fait chaud.`);

    console.log(`\n  LECTURE SEULE. Aucun fichier de production modifié, aucune donnée touchée.`);
    console.log(`  Ce script ne tranche pas : il dit ce que le déplacement coûterait et ce`);
    console.log(`  qu'il rendrait.`);
  }, 900_000);
});
