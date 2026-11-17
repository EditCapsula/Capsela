import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { composerFlatLay, type PieceFlatLay } from "../src/lib/flatLay";
import { objectBounds } from "../src/lib/catalogMarges";
import { separerCoucheExterieure } from "../src/lib/coucheExterieure";
import type { CategoryKey, Item } from "../src/lib/types";

// LA COMPOSITION PAR RECETTE — AVANT / APRÈS, MÊME EXÉCUTION. LECTURE SEULE, SANS RÉSEAU.
//
// 17/11/2026, brief « Refonte du moteur de composition visuelle des tenues ». CONFIGURATION GELÉE (AGENTS.md, point 1) : contexte
// hero-home, zone 100 × 112 (la carte de l'accueil à 390 px), images RÉELLES du catalogue standard (leurs boîtes : catalogMarges.ts),
// les six tenues du brief, même graine. Un seul levier : `recettes` (false = production d'avant, true = recette). Les placements sont
// écrits dans FLATLAY_SORTIE (JSON) pour être rendus avec les images ; aucune donnée n'est lue ni écrite en base.

const B = "https://tkrbzrazejrxavtfspll.supabase.co/storage/v1/object/public/catalog-images/";
type P = { id: number; cat: CategoryKey; chemin: string; accessoireType?: string };
const p = (id: number, cat: CategoryKey, chemin: string, accessoireType?: string): P => ({ id, cat, chemin, accessoireType });

const robe = p(1, "robe", "femme/robes/1");
const robe2 = p(2, "robe", "femme/robes/43");
const haut = p(3, "haut", "femme/hauts/29");
const haut2 = p(4, "haut", "femme/hauts/30");
const pantalon = p(5, "pantalon", "femme/pantalons/40");
const jupe = p(6, "jupe", "femme/jupes/41");
const veste = p(7, "veste", "femme/vestes-blazers/32");
const manteau = p(8, "manteau", "femme/manteaux-exterieurs/584-1789485824634");
const sac = p(10, "sac", "femme/sacs/51");
const cabas = p(11, "sac", "femme/sacs/52");
const pochette = p(12, "sac", "femme/sacs/53");
const bottines = p(13, "chaussures", "femme/chaussures/47");
const escarpins = p(14, "chaussures", "femme/chaussures/197");
const ballerines = p(15, "chaussures", "femme/chaussures/50");
const bottes = p(16, "chaussures", "femme/chaussures/588-1789485902973");
const collants = p(20, "accessoire", "femme/accessoires/59", "Collants");
const ceinture = p(21, "accessoire", "unisexe/accessoires/54", "Ceinture");
const lunettes = p(22, "accessoire", "unisexe/accessoires/28", "Lunettes");
const collier = p(23, "bijou", "unisexe/bijoux/57");

const CAS: { nom: string; pieces: P[]; temperature?: number }[] = [
  { nom: "Robe + 4 accessoires", pieces: [robe, sac, bottines, collants, ceinture] },
  { nom: "Robe + 5 accessoires", pieces: [robe, sac, bottines, collants, ceinture, collier] },
  { nom: "Pantalon + haut + 3 accessoires", pieces: [haut, pantalon, cabas, escarpins, ceinture] },
  { nom: "Pantalon + haut + veste + 3 accessoires", pieces: [haut, pantalon, veste, cabas, escarpins, ceinture] },
  { nom: "Jupe + haut + 4 accessoires", pieces: [haut2, jupe, pochette, ballerines, collier, lunettes] },
  { nom: "Manteau dans « Pour l'extérieur » (10°)", pieces: [robe2, manteau, sac, bottes, collants], temperature: 10 },
];

const enItem = (q: P): Item => ({ id: q.id, name: q.chemin, cat: q.cat, color: "", hex: "#ccc", season: "Toutes saisons", worn: null, accessoireType: q.accessoireType }) as Item;
const enPiece = (q: P): PieceFlatLay => {
  const b = objectBounds(`${B}${q.chemin}.webp`);
  return { id: q.id, cat: q.cat, ratio: b ? b.width / b.height : 0.8, accessoireType: q.accessoireType };
};

describe("composition par recette", () => {
  it("avant / après, même exécution", () => {
    const sortie: unknown[] = [];
    for (const cas of CAS) {
      const sep = cas.temperature != null ? separerCoucheExterieure(cas.pieces.map(enItem), cas.temperature) : null;
      const dansLaPlanche = sep ? cas.pieces.filter((q) => sep.principal.some((i) => i.id === q.id)) : cas.pieces;
      const ligne: Record<string, unknown> = { nom: cas.nom, exterieur: sep?.exterieur ? cas.pieces.find((q) => q.id === sep.exterieur!.id)?.chemin : null };
      // Le levier mesuré (FLATLAY_LEVIER) : « recettes » (la règle d'avant contre la recette, 17/11/2026) ou « chevauchement » (la recette
      // côte à côte contre la recette rapprochée, même jour : CHEVAUCHEMENT_RECETTE, HAUTEUR_COTES_RECETTE).
      const leviers =
        process.env.FLATLAY_LEVIER === "chevauchement"
          ? ([["avant", { chevauchement: 0, hauteurCotes: 1 }], ["après", {}]] as const)
          : ([["avant", { recettes: false }], ["après", { recettes: true }]] as const);
      for (const [bras, levier] of leviers) {
        const r = composerFlatLay(dansLaPlanche.map(enPiece), "graine-audit", { contexte: "hero-home", hauteurZone: 112, ...levier });
        const pose = r.pieces.map((q) => ({ ...q, chemin: cas.pieces.find((x) => x.id === q.id)!.chemin, bornes: objectBounds(`${B}${cas.pieces.find((x) => x.id === q.id)!.chemin}.webp`) }));
        const aire = (q: { l: number; h: number }) => q.l * q.h;
        const principales = pose.filter((q) => ["robe", "combinaison", "haut", "pull", "pantalon", "jean", "jupe", "short", "veste"].includes(q.cat));
        const part = principales.reduce((t, q) => t + aire(q), 0) / Math.max(1e-9, pose.reduce((t, q) => t + aire(q), 0));
        const pluspetit = Math.min(...pose.map((q) => Math.max(q.l, q.h)));
        console.log(`${cas.nom} · ${bras} : ${pose.length} posées, ${r.ecartees.length} écartées · vêtements ${(100 * part).toFixed(0)} % de l'aire · plus petite pièce ${pluspetit.toFixed(1)} unités`);
        ligne[bras] = { pieces: pose, ecartees: r.ecartees.map((id) => cas.pieces.find((x) => x.id === id)?.chemin) };
      }
      sortie.push(ligne);
    }
    if (process.env.FLATLAY_SORTIE) writeFileSync(process.env.FLATLAY_SORTIE, JSON.stringify(sortie, null, 1));
  });
});
