import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { accordAPlusieursCouleurs, estFranche } from "../src/lib/accordsCouleurs";
import { isNeutralColor } from "../src/lib/attributes";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { computeLookScore, generateOutfitWithFallback } from "../src/lib/logic";
import type { StyleId } from "../src/lib/profile";
import type { Item, OccasionKey } from "../src/lib/types";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LES ACCORDS À LA WADA (12/11/2026, accordsCouleurs.ts, option B demandée « partout »). LECTURE SEULE.
// AGENTS.md : le moteur SANS puis AVEC les accords (levier sansAccordsWada), DANS LA MÊME EXÉCUTION, sur les mêmes capsules, météos,
// occasions et nombres de tirages. Le seul levier qui varie. Le moteur est le même pour la tenue du jour, la Capsule, le Dressing et la
// valise : ce sont ici des capsules (le Dressing d'une personne n'existe pas au catalogue), le pool que ces écrans reçoivent sans dressing.
//
// Ce qui est mesuré : les tenues complètes ; celles à 2 couleurs non neutres ou plus ; celles qui forment un accord à plusieurs
// couleurs (R-S19) ; celles à 2 couleurs franches (jamais voulu) ; celles à plus de 3 couleurs (R-S1) ; le score moyen ; des exemples.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const TIRAGES = 25;
const PROFILS: { genre: "femme" | "homme"; styles: StyleId[] }[] = [
  { genre: "femme", styles: ["minimaliste"] },
  { genre: "femme", styles: ["boheme"] },
  { genre: "femme", styles: ["romantique"] },
  { genre: "femme", styles: ["creatif"] },
  { genre: "homme", styles: ["casual_chic"] },
  { genre: "homme", styles: ["classique_chic"] },
];
const OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "date", "soiree"];

type Compte = { tenues: number; completes: number; multi: number; accord: number; deuxFranches: number; plusDe3: number; score: number; exemples: Map<string, number> };
const vide = (): Compte => ({ tenues: 0, completes: 0, multi: 0, accord: 0, deuxFranches: 0, plusDe3: 0, score: 0, exemples: new Map() });
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)} %` : "—");

describe("accords à la Wada", () => {
  it("mesure le moteur sans puis avec les accords", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const catalogue = rows.filter((r) => !(r as { frozen?: boolean }).frozen).map(rowToCatalogItem).filter((i): i is CatalogItem => !!i);
    assertCatalogueStyles(catalogue);
    console.log(`\nCatalogue : ${catalogue.length} pièces actives. ${TIRAGES} tirages par cellule.`);

    const total = new Map<string, Compte>();
    const parProfil = new Map<string, Compte>();
    for (const profil of PROFILS) {
      const profile = profilAudit({ gender: profil.genre, styles: profil.styles });
      for (const saison of CAPSULE_SEASONS) {
        const meteo = representativeWeatherFor(saison);
        const capsule = computeDefaultCapsule(profile, meteo, [], saison, catalogue);
        for (const occasion of OCCASIONS)
          for (const [nom, sansAccordsWada] of [["avant", true], ["après", false]] as const) {
            const c = total.get(nom) ?? vide();
            const cp = parProfil.get(`${profil.genre} ${profil.styles[0]}|${nom}`) ?? vide();
            for (let k = 0; k < TIRAGES; k++) {
              const r = generateOutfitWithFallback(capsule, meteo, occasion, "Présentiel", "Verre", [], profil.genre, saison, { sansAccordsWada });
              for (const x of [c, cp]) x.tenues++;
              if (!r.ids.length) continue;
              const pieces = r.ids.map((id) => capsule.find((p) => p.id === id)).filter((p): p is CatalogItem => !!p) as Item[];
              const sansBijou = pieces.filter((p) => p.cat !== "bijou");
              const couleurs = [...new Map(sansBijou.filter((p) => !isNeutralColor(p.color)).map((p) => [p.hex.toUpperCase(), p])).values()];
              const score = computeLookScore(pieces, occasion, [], null, new Set(), meteo, "Présentiel", "Verre", [], null, { sansAccordsWada }).score;
              for (const x of [c, cp]) {
                x.completes++;
                x.score += score;
                if (couleurs.length >= 2) x.multi++;
                if (accordAPlusieursCouleurs(sansBijou)) x.accord++;
                if (couleurs.filter(estFranche).length >= 2) x.deuxFranches++;
                if (couleurs.length > 3) x.plusDe3++;
              }
              if (couleurs.length >= 2) {
                const cle = couleurs.map((p) => p.color).sort().join(" + ");
                c.exemples.set(cle, (c.exemples.get(cle) ?? 0) + 1);
              }
            }
            total.set(nom, c);
            parProfil.set(`${profil.genre} ${profil.styles[0]}|${nom}`, cp);
          }
      }
    }
    const ligne = (titre: string, c: Compte) =>
      `   ${titre.padEnd(8)} complètes ${pct(c.completes, c.tenues)} · 2 couleurs ou + ${pct(c.multi, c.completes)} · accord R-S19 ${pct(c.accord, c.completes)} · 2 franches ${pct(c.deuxFranches, c.completes)} · plus de 3 ${pct(c.plusDe3, c.completes)} · score moyen ${(c.score / Math.max(1, c.completes)).toFixed(1)}`;
    console.log("\nEnsemble :");
    for (const nom of ["avant", "après"]) console.log(ligne(nom, total.get(nom)!));
    console.log("\nPar profil :");
    for (const profil of PROFILS) {
      const k = `${profil.genre} ${profil.styles[0]}`;
      console.log(` ${k}`);
      for (const nom of ["avant", "après"]) console.log(ligne(nom, parProfil.get(`${k}|${nom}`)!));
    }
    for (const nom of ["avant", "après"]) {
      const ex = [...total.get(nom)!.exemples].sort((a, b) => b[1] - a[1]).slice(0, 15);
      console.log(`\nAssociations à plusieurs couleurs les plus fréquentes, ${nom} :`);
      for (const [cle, n] of ex) console.log(`   ${n} × ${cle}`);
    }
  }, 900_000);
});
