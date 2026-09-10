import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// ALIGNER LA CAPSULE SUR L'EXEMPTION DE MIN QUI EXISTE DÉJÀ — LECTURE SEULE.
//
// CE QUI CONDUIT ICI. Le tri du 04/09 a montré que sur les 99 pièces dont une
// saison déclarée est contredite par leur plage, 65 le sont par le `min` sur
// une catégorie que la GÉNÉRATION exempte déjà :
//
//   logic.ts:633   min ignoré si cat ∈ TEMP_COMPENSATED_CATS
//                  = [haut, pull, robe, combinaison, jupe, short]
//   capsule.ts:517 min appliqué à TOUTES les catégories, sans exemption
//
// Une chemise `min 20` déclarée en hiver s'y porte réellement — sous un pull —
// et la génération le sait. Seule la capsule l'ignore, et la chasse d'une
// saison qu'elle revendique. Ces 65 cas ne sont donc pas des erreurs de
// saisie : ce sont des artefacts de cet écart.
//
// CE QUI EST MESURÉ. Un seul levier : la capsule cesse d'appliquer le `min`
// aux catégories que la génération exempte. Le `max` n'est pas touché — il
// n'a d'exemption nulle part, et c'est un autre chantier. Techniquement, un
// pool où `meteoMinTemp` est retiré des seules catégories exemptées est passé
// à computeDefaultCapsule ; les identifiants obtenus sont remappés sur les
// pièces ORIGINALES, bornes comprises, pour générer les tenues.
//
// Ce n'est PAS l'invention d'une règle : c'est la propagation d'une exemption
// déjà écrite et déjà documentée. C'est ce qui distingue cette mesure de
// celle sur la borne haute, où il fallait trancher entre deux définitions.
//
// LE RISQUE À MESURER, ET IL EST RÉEL. Si une chemise `min 20` entre dans la
// capsule d'hiver, rien ne garantit qu'elle sera portée SOUS quelque chose.
// L'exemption de logic.ts suppose une couche par-dessus ; elle ne l'impose
// pas. La mesure compte donc les pièces portées sous leur propre min, et
// surtout celles portées ainsi SANS AUCUNE COUCHE. Ce chiffre-là décide :
// une chemise nue par 6 °C invaliderait l'alignement, quel que soit le gain
// par ailleurs.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 40;
/** Recopié de logic.ts:630 — si cette liste y change, cette mesure ne vaut plus. */
const EXEMPTEES: CategoryKey[] = ["haut", "pull", "robe", "combinaison", "jupe", "short"];
/** Ce qui compte comme une couche par-dessus. */
const COUCHES: CategoryKey[] = ["pull", "veste", "manteau"];

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

function saisonsDeclarees(raw: string | null): CapsuleSeason[] {
  const jetons = (raw ?? "").split(/[,;|]/).map((s) => sansAccents(s)).filter(Boolean);
  return CAPSULE_SEASONS.filter((s) => jetons.includes(sansAccents(s)));
}

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

describe("aligner la capsule sur l'exemption de min de la génération", () => {
  it("mesure le gain, le coût, et surtout les pièces portées sous leur min sans couche", async () => {
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
    const declarees = new Map(pool.map((it) => [it.id, saisonsDeclarees(ligne.get(it.id)?.saison_capsule ?? null)]));
    /** Le pool du bras D : min retiré sur les seules catégories exemptées. */
    const poolExempte = pool.map((it) => (EXEMPTEES.includes(it.cat) ? { ...it, meteoMinTemp: undefined } : it));
    console.log(`Catalogue : ${pool.length} pièces. Catégories exemptées : ${EXEMPTEES.join(", ")}.`);

    const capsulePour = (bras: "A" | "D", style: string, saison: CapsuleSeason): CatalogItem[] => {
      const src = bras === "A" ? pool : poolExempte;
      const c = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, src);
      return c.map((it) => index.get(it.id)).filter((x): x is CatalogItem => Boolean(x));
    };

    // ═══ 1 · COMPOSITION ════════════════════════════════════════════════
    console.log(`\n════════ 1 · COMPOSITION DES CAPSULES ════════`);
    console.log(`  ${"saison".padEnd(12)}${"A".padStart(8)}${"D".padStart(8)}${"écart".padStart(8)}${"entrants".padStart(11)}${"sortants".padStart(11)}`);
    const entrants = new Map<number, Set<CapsuleSeason>>();
    const sortants = new Map<number, Set<CapsuleSeason>>();
    for (const saison of CAPSULE_SEASONS) {
      let a = 0, d = 0, e = 0, s = 0;
      for (const style of STYLES_FEMME) {
        const ca = capsulePour("A", style, saison), cd = capsulePour("D", style, saison);
        a += ca.length; d += cd.length;
        const idsA = new Set(ca.map((it) => it.id)), idsD = new Set(cd.map((it) => it.id));
        for (const it of cd) if (!idsA.has(it.id)) { e += 1; entrants.set(it.id, (entrants.get(it.id) ?? new Set()).add(saison)); }
        for (const it of ca) if (!idsD.has(it.id)) { s += 1; sortants.set(it.id, (sortants.get(it.id) ?? new Set()).add(saison)); }
      }
      console.log(`  ${saison.padEnd(12)}${String(a).padStart(8)}${String(d).padStart(8)}${((d - a >= 0 ? "+" : "") + (d - a)).padStart(8)}${String(e).padStart(11)}${String(s).padStart(11)}`);
    }
    let entreesLegitimes = 0, entreesHorsDeclaration = 0, sortiesDeclarees = 0;
    for (const [id, ss] of entrants) for (const s of ss) {
      const d = declarees.get(id)!;
      if (!d.length || d.includes(s)) entreesLegitimes += 1; else entreesHorsDeclaration += 1;
    }
    for (const [id, ss] of sortants) for (const s of ss) if (declarees.get(id)!.includes(s)) sortiesDeclarees += 1;
    console.log(`\n  ${entrants.size} pièces distinctes entrantes, ${sortants.size} sortantes.`);
    console.log(`  entrées dans une saison DÉCLARÉE (ou pièce sans déclaration) : ${entreesLegitimes}`);
    console.log(`  entrées HORS déclaration ....................................: ${entreesHorsDeclaration}  <- serait une régression`);
    console.log(`  sorties d'une saison POURTANT déclarée ......................: ${sortiesDeclarees}  <- coût du plafond de capsule`);

    console.log(`\n  Les 20 premières entrantes :`);
    console.log(`  ${"id".padStart(6)}  ${"cat".padEnd(11)}${"min".padStart(5)}  ${"saisons gagnées".padEnd(28)}${"saisons déclarées".padEnd(28)}nom`);
    for (const [id, ss] of [...entrants.entries()].slice(0, 20)) {
      const it = index.get(id)!, r = ligne.get(id)!;
      console.log(`  ${String(r.id).padStart(6)}  ${it.cat.padEnd(11)}${String(it.meteoMinTemp ?? "—").padStart(5)}  ${[...ss].join(", ").padEnd(28)}${(r.saison_capsule ?? "—").slice(0, 27).padEnd(28)}${it.name}`);
    }

    // ═══ 2 · CONTRÔLE — LES CATÉGORIES NON EXEMPTÉES NE BOUGENT PAS ═════
    //
    // `accessoire` n'est pas exemptée : les collants doivent être STRICTEMENT
    // identiques dans les deux bras. Si ce n'est pas le cas, le levier fuit et
    // rien de ce qui suit n'est attribuable.
    console.log(`\n════════ 2 · CONTRÔLE DE FUITE — LES NON-EXEMPTÉES DOIVENT ÊTRE IDENTIQUES ════════`);
    let fuite = 0;
    for (const saison of CAPSULE_SEASONS) {
      for (const style of STYLES_FEMME) {
        const ca = capsulePour("A", style, saison).filter((it) => !EXEMPTEES.includes(it.cat));
        const cd = capsulePour("D", style, saison).filter((it) => !EXEMPTEES.includes(it.cat));
        const idsA = [...ca.map((it) => it.id)].sort().join(","), idsD = [...cd.map((it) => it.id)].sort().join(",");
        if (idsA !== idsD) fuite += 1;
      }
    }
    console.log(`  cellules où les pièces NON exemptées diffèrent : ${fuite}/${CAPSULE_SEASONS.length * STYLES_FEMME.length}`);
    console.log(`  Un chiffre non nul n'invalide pas la mesure — le plafond de capsule déplace`);
    console.log(`  mécaniquement d'autres pièces — mais il interdit d'attribuer ces écarts au`);
    console.log(`  seul levier. À lire comme tel.`);

    // ═══ 3 · LE RISQUE — PORTÉE SOUS SON MIN, ET SANS COUCHE ════════════
    console.log(`\n════════ 3 · LE CHIFFRE QUI DÉCIDE ════════`);
    console.log(`  Une pièce portée sous son propre min n'est un problème que si RIEN ne la`);
    console.log(`  couvre. L'exemption de logic.ts suppose une couche ; elle ne l'impose pas.`);
    console.log(`\n  ${"bras".padEnd(8)}${"saison".padEnd(12)}${"temp".padStart(6)}${"tenues".padStart(9)}${"cellules".padStart(11)}${"sous le min".padStart(13)}${"dont SANS couche".padStart(18)}`);
    for (const bras of ["A", "D"] as const) {
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        let tenues = 0, cellules = 0, sousMin = 0, sousMinNu = 0;
        for (const style of STYLES_FEMME) {
          const capsule = capsulePour(bras, style, saison);
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}`));
              let ids: number[];
              try { ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids; }
              finally { Math.random = vrai; }
              if (!ids.length) continue;
              couverte = true; tenues += 1;
              const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
              const aUneCouche = pieces.some((p) => COUCHES.includes(p.cat));
              for (const p of pieces) {
                if (p.meteoMinTemp == null || w.temp >= p.meteoMinTemp) continue;
                sousMin += 1;
                if (!aUneCouche) sousMinNu += 1;
              }
            }
            if (couverte) cellules += 1;
          }
        }
        console.log(`  ${bras.padEnd(8)}${saison.padEnd(12)}${(w.temp + "°").padStart(6)}${String(tenues).padStart(9)}${`${cellules}/${STYLES_FEMME.length * OCCS.length}`.padStart(11)}${String(sousMin).padStart(13)}${String(sousMinNu).padStart(18)}`);
      }
    }
    console.log(`\n  « dont SANS couche » qui grimpe en D invaliderait l'alignement : cela voudrait`);
    console.log(`  dire que la capsule protégeait ce que la génération ne protège pas.`);

    // ═══ 4 · MORTALITÉ ══════════════════════════════════════════════════
    console.log(`\n════════ 4 · MORTALITÉ PAR CATÉGORIE ════════`);
    const cats: CategoryKey[] = ["haut", "pull", "veste", "manteau", "robe", "jupe", "pantalon", "jean", "chaussures", "sac", "accessoire", "bijou"];
    const mortes = new Map<string, Map<CategoryKey, number>>();
    for (const bras of ["A", "D"] as const) {
      const m = new Map<CategoryKey, number>();
      for (const saison of CAPSULE_SEASONS) {
        const w = representativeWeatherFor(saison);
        for (const style of STYLES_FEMME) {
          const capsule = capsulePour(bras, style, saison);
          const vues = new Set<number>();
          for (const occ of OCCS) {
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}`));
              try { for (const id of generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids) vues.add(id); }
              finally { Math.random = vrai; }
            }
          }
          for (const it of capsule) if (!vues.has(it.id)) m.set(it.cat, (m.get(it.cat) ?? 0) + 1);
        }
      }
      mortes.set(bras, m);
    }
    console.log(`  ${"catégorie".padEnd(14)}${"A".padStart(8)}${"D".padStart(8)}${"écart".padStart(8)}`);
    for (const cat of cats) {
      const a = mortes.get("A")!.get(cat) ?? 0, d = mortes.get("D")!.get(cat) ?? 0;
      if (a || d) console.log(`  ${cat.padEnd(14)}${String(a).padStart(8)}${String(d).padStart(8)}${((d - a >= 0 ? "+" : "") + (d - a)).padStart(8)}`);
    }
    const ta = [...mortes.get("A")!.values()].reduce((x, y) => x + y, 0);
    const td = [...mortes.get("D")!.values()].reduce((x, y) => x + y, 0);
    console.log(`  ${"TOTAL".padEnd(14)}${String(ta).padStart(8)}${String(td).padStart(8)}${((td - ta >= 0 ? "+" : "") + (td - ta)).padStart(8)}`);

    console.log(`\n  LECTURE SEULE. Aucun fichier de production modifié, aucune donnée touchée.`);
  }, 900_000);
});
