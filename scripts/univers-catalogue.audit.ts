import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { isSunny, necessiteLeSoleil } from "../src/lib/data";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { estPieceDeValise } from "../src/lib/piecesDeValise";
import type { OccasionKey } from "../src/lib/types";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { assertCatalogueStyles, profilAudit, stylesAudit } from "./harnaisAudit";

// L'UNIVERS DU PROFIL FILTRE AVANT LE SCORE (12/11/2026, univers.ts, brief 2.3 point 2.3). LECTURE SEULE.
//
// Ce que le changement touche, et comment chaque point est mesuré DANS CETTE EXÉCUTION, sur le même catalogue :
//   1. Le garde-fou « au moins 16 pièces » de la capsule (retiré) : il n'annulait le filtre que si, après lui, il restait moins de
//      16 pièces. On compte, par univers et par météo (ensoleillée ou non, seul filtre appliqué avant lui), les pièces restantes. S'il
//      y en a toujours 16 ou plus, le garde-fou n'a jamais joué : son retrait est inerte pour un profil homme ou femme.
//   2. Les capsules et les tenues d'un profil homme et d'un profil femme, pour chaque style et chaque saison : aucune pièce de l'autre
//      univers, et la taille de chaque capsule.
//   3. Un profil SANS genre (avant : aucun filtre ; après : l'unisexe seul) : la taille de sa capsule, saison par saison.
//   4. Les sacs bandoulière / crossbody du catalogue, avec leur genre et leurs visuels (point 10 du brief).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const OCCASIONS: OccasionKey[] = ["quotidien", "travail_formel", "soiree", "date"];
const TIRAGES = 20;

describe("univers du profil", () => {
  it("mesure le filtre homme / femme sur le vrai catalogue", async () => {
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
    const parGenre = new Map<string, number>();
    for (const p of catalogue) parGenre.set(p.genre ?? "(aucun)", (parGenre.get(p.genre ?? "(aucun)") ?? 0) + 1);
    console.log(`\nCatalogue : ${catalogue.length} pièces actives — ${[...parGenre].map(([g, n]) => `${g} ${n}`).join(", ")}.`);

    // 1. Le garde-fou.
    console.log("\n1. Pièces restantes après le filtre d'univers (le garde-fou annulait le filtre sous 16) :");
    const source = catalogue.filter((it) => !estPieceDeValise(it));
    for (const genre of ["homme", "femme"] as const)
      for (const soleil of [true, false]) {
        const base = soleil ? source : source.filter((it) => !necessiteLeSoleil(it));
        const restantes = base.filter((it) => it.genre !== (genre === "homme" ? "femme" : "homme")).length;
        console.log(`   ${genre}, ${soleil ? "météo ensoleillée" : "autre météo"} : ${restantes} pièces${restantes < 16 ? "  ← LE GARDE-FOU JOUAIT" : ""}`);
      }

    // 2. Capsules et tenues par univers.
    console.log("\n2. Capsules et tenues, par style et par saison :");
    let violations = 0;
    for (const genre of ["homme", "femme"] as const) {
      const autre = genre === "homme" ? "femme" : "homme";
      for (const style of stylesAudit(genre)) {
        const tailles: string[] = [];
        for (const saison of CAPSULE_SEASONS) {
          const profile = profilAudit({ gender: genre, styles: [style] });
          const meteo = representativeWeatherFor(saison);
          const capsule = computeDefaultCapsule(profile, meteo, [], saison, catalogue);
          const dansCapsule = capsule.filter((p) => p.genre === autre).length;
          let dansTenues = 0;
          for (const occasion of OCCASIONS)
            for (let k = 0; k < TIRAGES; k++) {
              const r = generateOutfitWithFallback(catalogue, meteo, occasion, "Présentiel", "Verre", [], genre, saison);
              dansTenues += r.ids.filter((id) => catalogue.find((p) => p.id === id)?.genre === autre).length;
            }
          violations += dansCapsule + dansTenues;
          tailles.push(`${saison} ${capsule.length}${dansCapsule || dansTenues ? ` (${dansCapsule} en capsule, ${dansTenues} en tenue de l'autre univers)` : ""}`);
        }
        console.log(`   ${genre} ${style} : ${tailles.join(" · ")}`);
      }
    }
    console.log(`   Pièces de l'autre univers, capsules et tenues confondues (tenues tirées sur le catalogue ENTIER) : ${violations}`);

    // 3. Sans genre.
    console.log("\n3. Profil sans genre (l'unisexe seul) :");
    for (const saison of CAPSULE_SEASONS) {
      const meteo = representativeWeatherFor(saison);
      const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: null, patch: { gender: null } }), meteo, [], saison, catalogue);
      const parCat = new Map<string, number>();
      for (const p of capsule) parCat.set(p.cat, (parCat.get(p.cat) ?? 0) + 1);
      console.log(`   ${saison} (${isSunny(meteo) ? "soleil" : "sans soleil"}) : ${capsule.length} pièces — ${[...parCat].map(([c, n]) => `${c} ${n}`).join(", ")}`);
    }

    // 4. Les sacs bandoulière.
    console.log("\n4. Sacs bandoulière / crossbody du catalogue :");
    const sacs = rows.filter((r) => /bandouli|crossbody|besace|messager/i.test(`${r.name} ${r.sous_type ?? ""}`));
    for (const r of sacs)
      console.log(`   #${r.id} « ${r.name} » · sous-type ${r.sous_type ?? "—"} · genre ${r.genre ?? "—"} · styles ${r.styles ?? "—"} · visuels ${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k, v]) => /url$/.test(k) && v)))}`);
  }, 600_000);
});
