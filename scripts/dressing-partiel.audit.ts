import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { suggestOccasions } from "../src/lib/attributes";
import { CATS, OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// UN DRESSING PARTIEL PEUT-IL TUER UNE OCCASION ? — LECTURE SEULE.
//
// Signalé le 10/09 : « pourquoi je n'ai pas de tenues de sport ». L'audit
// `couverture-occasions` rend pourtant 100 % de tenues pour le sport, sur
// toutes les saisons et tous les styles. Il mesure donc quelque chose que
// l'utilisatrice ne vit pas : son profil est synthétique et son dressing
// VIDE, si bien que le pool est toujours la capsule entière.
//
// L'HYPOTHÈSE, lue dans store.tsx:558 et testée ici plutôt que déduite :
//
//     const real = state.items.filter((i) => i.cat === key);
//     return real.length ? real : defaultCapsule.filter((i) => i.cat === key);
//
// C'est tout ou rien, catégorie par catégorie. Posséder UNE pièce dans une
// catégorie écarte TOUTES les suggestions du catalogue pour cette catégorie.
// Croisé avec FORMALITY_FALLBACK_CHAIN, où le sport est la seule occasion
// sans repli (0: [0]), un dressing réel sans pièce technique devrait rendre
// le sport impossible — et lui seul.
//
// PROTOCOLE (points 1 à 3 de la règle d'audit). Les deux bras sont mesurés
// DANS LA MÊME EXÉCUTION, sur la même capsule, avec les mêmes graines ; seule
// varie la composition du pool.
//
//   · bras VIDE    — dressing vide, pool = capsule entière. Reproduit
//                    `couverture-occasions`, et sert de témoin.
//   · bras PARTIEL — l'utilisatrice possède, dans chaque catégorie de
//                    vêtement, les pièces de sa capsule qui ne déclarent PAS
//                    le sport. Cas le plus courant : on ajoute ses vraies
//                    affaires, on n'y met pas de tenue de sport.
//
// Ce que le script NE fait pas : proposer un correctif. Il établit si le
// mécanisme existe et quelles occasions il touche. Le remède est un
// arbitrage produit, pas une conséquence de cette mesure.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 25;
/** Les catégories de vêtements qu'une utilisatrice remplit en premier. */
const CATS_POSSEDEES: CategoryKey[] = ["haut", "pantalon", "jean", "robe", "jupe", "chaussures"];

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

/** Recopie d'`occasionsOf` (capsule.ts:187), qui n'est pas exportée. */
const occasionsDe = (it: CatalogItem): OccasionKey[] =>
  it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType);

/** Recopie fidèle de la composition du pool (store.tsx:558) — tout ou rien par catégorie. */
function poolDeGeneration(possedees: CatalogItem[], capsule: CatalogItem[]): CatalogItem[] {
  return CATS.flatMap(([key]) => {
    const reelles = possedees.filter((i) => i.cat === key);
    return reelles.length ? reelles : capsule.filter((i) => i.cat === key);
  });
}

describe("un dressing partiel", () => {
  it("mesure si posséder des pièces peut retirer une occasion, au lieu de l'en déduire", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`Catalogue : ${pool.length} pièces. Deux bras, même exécution, mêmes graines.`);

    type Compte = { tenues: number; total: number };
    const vide = new Map<OccasionKey, Compte>();
    const partiel = new Map<OccasionKey, Compte>();
    for (const o of OCCS) { vide.set(o, { tenues: 0, total: 0 }); partiel.set(o, { tenues: 0, total: 0 }); }
    let piecesPossedeesTotal = 0, capsulesVues = 0;

    for (const saison of CAPSULE_SEASONS) {
      const w: Weather = representativeWeatherFor(saison);
      for (const style of STYLES_FEMME) {
        const capsule = computeDefaultCapsule(
          profilAudit({ gender: "femme", styles: [style] }), w, [], saison, pool
        );
        // Le dressing simulé : ce que la capsule propose dans ces catégories,
        // MOINS toute pièce qui déclare le sport. On modélise une utilisatrice
        // qui a rentré ses vraies affaires sans tenue de sport — pas une
        // utilisatrice dont le dressing serait choisi contre le moteur.
        const possedees = capsule.filter(
          (it) => CATS_POSSEDEES.includes(it.cat) && !occasionsDe(it).includes("sport")
        );
        piecesPossedeesTotal += possedees.length; capsulesVues += 1;
        const poolVide = poolDeGeneration([], capsule);
        const poolPartiel = poolDeGeneration(possedees, capsule);

        for (const occ of OCCS) {
          for (let k = 0; k < N; k++) {
            for (const [bras, p, compteur] of [
              ["vide", poolVide, vide] as const,
              ["partiel", poolPartiel, partiel] as const,
            ]) {
              void bras;
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}`));
              let ids: number[];
              try {
                ids = generateOutfitWithFallback(p, w, occ, "Présentiel", "Verre", [], "femme", saison).ids;
              } finally { Math.random = vrai; }
              const c = compteur.get(occ)!;
              c.total += 1;
              if (ids.length) c.tenues += 1;
            }
          }
        }
      }
    }

    console.log(`\n  Dressing simulé : ${(piecesPossedeesTotal / capsulesVues).toFixed(1)} pièces en moyenne par capsule,`);
    console.log(`  dans les catégories ${CATS_POSSEDEES.join(", ")}, aucune déclarant le sport.`);
    console.log(`\n════════ TAUX DE TENUE PAR OCCASION ════════`);
    console.log(`  ${"occasion".padEnd(18)}${"dressing vide".padStart(15)}${"dressing partiel".padStart(18)}${"écart".padStart(10)}`);
    const pc = (c: Compte) => (c.total ? (c.tenues / c.total) * 100 : 0);
    let pires: { occ: OccasionKey; ecart: number }[] = [];
    for (const occ of OCCS) {
      const a = pc(vide.get(occ)!), b = pc(partiel.get(occ)!);
      const ecart = b - a;
      pires.push({ occ, ecart });
      const marque = ecart <= -50 ? "   <<< OCCASION PERDUE" : ecart < 0 ? "   <-- dégradée" : "";
      console.log(`  ${occ.padEnd(18)}${a.toFixed(1).padStart(14)}%${b.toFixed(1).padStart(17)}%${ecart.toFixed(1).padStart(9)}${marque}`);
    }
    pires = pires.sort((x, y) => x.ecart - y.ecart);

    console.log(`\n════════ VERDICT ════════`);
    const perdues = pires.filter((p) => p.ecart <= -50).map((p) => p.occ);
    const degradees = pires.filter((p) => p.ecart < 0 && p.ecart > -50).map((p) => p.occ);
    if (!perdues.length && !degradees.length) {
      console.log(`  Aucune occasion ne recule. L'hypothèse est RÉFUTÉE : posséder des pièces`);
      console.log(`  ne retire pas d'occasion, et la cause du signalement est ailleurs.`);
    } else {
      if (perdues.length) console.log(`  Occasions PERDUES (chute de 50 points ou plus) : ${perdues.join(", ")}`);
      if (degradees.length) console.log(`  Occasions dégradées sans être perdues .......... : ${degradees.join(", ")}`);
      console.log(`\n  Le mécanisme est celui de store.tsx:558 : posséder une pièce dans une`);
      console.log(`  catégorie écarte toutes les suggestions du catalogue pour cette catégorie.`);
      console.log(`  Une occasion sans repli de formalité n'a alors nulle part où redescendre.`);
    }
    console.log(`\n  LECTURE SEULE. Aucun correctif appliqué, aucune donnée modifiée.`);
    console.log(`  Ce script établit l'existence du mécanisme, pas le remède : le remède`);
    console.log(`  est un arbitrage produit.`);
  }, 900_000);
});
