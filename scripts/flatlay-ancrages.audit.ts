import { it } from "vitest";
import { composerFlatLay, CONTEXTES, type ContexteFlatLay, type PieceFlatLay } from "../src/lib/flatLay";
import { choisirTemplate } from "../src/lib/flatLayTemplates";
import type { CategoryKey } from "../src/lib/types";

/*
 * AUDIT — accessoires à place fixe (02/11/2026, demandé : « que les accessoires soient au même emplacement », dans tous les hero), et
 * mesure de la hauteur des bas (demandé le même jour : « que chaque bas soit à la même taille »).
 *
 * Configuration gelée : les tenues-types ci-dessous (formats d'image réalistes : pantalon 0,38 à 0,45, jean 0,42, jupe 0,8, short 1,1),
 * 4 graines chacune, les contextes look-detail (zones 100, 118, 126 : Composer, idée de look, Tenue du jour) et hero-home (112).
 * Levier : `accessoiresFixes` ; tout le reste fixe. Mesurés dans la même exécution : la règle d'avant et la nouvelle.
 */
const P = (id: number, cat: CategoryKey, ratio: number): PieceFlatLay => ({ id, cat, ratio });
const TENUES: [string, PieceFlatLay[]][] = [
  ["haut+pantalon+chaussures+sac", [P(1, "haut", 1), P(2, "pantalon", 0.38), P(3, "chaussures", 2), P(4, "sac", 0.9)]],
  ["haut+jean+chaussures", [P(1, "haut", 0.95), P(2, "jean", 0.42), P(3, "chaussures", 2.2)]],
  ["veste+haut+pantalon+chaussures+sac", [P(1, "veste", 0.75), P(2, "haut", 1), P(3, "pantalon", 0.45), P(4, "chaussures", 1.8), P(5, "sac", 0.9)]],
  ["pull+haut+jupe+chaussures+sac", [P(1, "pull", 1.05), P(2, "haut", 1), P(3, "jupe", 0.8), P(4, "chaussures", 2), P(5, "sac", 1)]],
  ["haut+short+chaussures+sac+accessoire", [P(1, "haut", 1), P(2, "short", 1.1), P(3, "chaussures", 2), P(4, "sac", 0.9), P(5, "accessoire", 1)]],
  ["haut+pantalon+chaussures+bijou+accessoire", [P(1, "haut", 1), P(2, "pantalon", 0.4), P(3, "chaussures", 2), P(4, "bijou", 1), P(5, "accessoire", 1.2)]],
  ["manteau+pull+jean+chaussures+accessoire", [P(1, "manteau", 0.6), P(2, "pull", 1), P(3, "jean", 0.42), P(4, "chaussures", 2), P(5, "accessoire", 1)]],
  ["robe+chaussures+sac+bijou", [P(1, "robe", 0.5), P(2, "chaussures", 2), P(3, "sac", 0.9), P(4, "bijou", 1)]],
];
const GRAINES = ["a", "b", "c", "d"];
const ZONES: [ContexteFlatLay, number][] = [["look-detail", 100], ["look-detail", 118], ["look-detail", 126], ["hero-home", 112]];
// Le levier de la taille fixe des bas, essayé le même jour, n'est pas retenu (conflit avec les règles d'octobre, cf. compte rendu) : seul
// celui des accessoires reste mesuré.
const SCENARIOS: [string, boolean][] = [
  ["avant", false],
  ["accessoires fixes", true],
];

const st = (v: number[]) => (v.length ? `${Math.min(...v).toFixed(2)} / ${[...v].sort((a, b) => a - b)[Math.floor(v.length / 2)].toFixed(2)} / ${Math.max(...v).toFixed(2)}` : "—");

it("audit flat lay : bas et accessoires", () => {
  for (const [ctx, hz] of ZONES) {
    const c = CONTEXTES[ctx];
    const utile = hz - (c.margeHaute ?? c.marge) - c.marge;
    console.log(`\n=== ${ctx}, zone ${hz} ===`);
    for (const [nom, accessoiresFixes] of SCENARIOS) {
      const hBas: Record<string, number[]> = { pantalon: [], jean: [], jupe: [], short: [] };
      const places = new Map<string, number>();
      let poses = 0, ecartes = 0, recouvrementMax = 0, horsZone = 0;
      for (const [, pieces] of TENUES)
        for (const g of GRAINES) {
          // Comme FlatLayCapsela : un gabarit (template) sur la Tenue du jour, jamais sur l'accueil.
          const template = ctx === "hero-home" ? null : choisirTemplate(pieces.map((q) => ({ cat: q.cat, name: "" })));
          const r = composerFlatLay(pieces, g, { contexte: ctx, hauteurZone: hz, accessoiresFixes, template });
          for (const p of r.pieces) {
            if (p.cat in hBas && p.role !== "accessoire") hBas[p.cat].push(p.h / utile);
            if (p.role === "accessoire") {
              poses++;
              const k = `${Math.round(p.x / 10) * 10},${(Math.round((p.y / hz) * 10) / 10).toFixed(1)}`;
              places.set(k, (places.get(k) ?? 0) + 1);
            }
            if (p.x - p.l / 2 < c.marge - 0.5 || p.x + p.l / 2 > 100 - c.marge + 0.5 || p.y + p.h / 2 > hz - c.marge + 0.5) horsZone++;
          }
          ecartes += r.ecartees.filter((id) => pieces.find((q) => q.id === id && (q.cat === "bijou" || q.cat === "accessoire"))).length;
          for (let i = 0; i < r.pieces.length; i++)
            for (let j = i + 1; j < r.pieces.length; j++) {
              const a = r.pieces[i], b = r.pieces[j];
              const ix = Math.max(0, Math.min(a.x + a.l / 2, b.x + b.l / 2) - Math.max(a.x - a.l / 2, b.x - b.l / 2));
              const iy = Math.max(0, Math.min(a.y + a.h / 2, b.y + b.h / 2) - Math.max(a.y - a.h / 2, b.y - b.h / 2));
              recouvrementMax = Math.max(recouvrementMax, (ix * iy) / Math.min(a.l * a.h, b.l * b.h));
            }
        }
      console.log(
        `${nom.padEnd(18)} | h bas / h utile (min / médiane / max) pantalon ${st(hBas.pantalon)} · jean ${st(hBas.jean)} · jupe ${st(hBas.jupe)} · short ${st(hBas.short)}` +
          ` | accessoires posés ${poses}, écartés ${ecartes}, places distinctes ${places.size} [${[...places].map(([k, n]) => `${k}×${n}`).join(" ")}]` +
          ` | recouvrement max ${(recouvrementMax * 100).toFixed(0)} % | hors zone ${horsZone}`
      );
    }
  }
});
