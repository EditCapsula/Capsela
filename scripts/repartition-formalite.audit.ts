import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { formalityOf } from "../src/lib/attributes";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";

// LA RÉPARTITION DE LA FORMALITÉ DU CATALOGUE (11/11/2026, audit « formalité, contexte et activités », décision D1). LECTURE SEULE.
//
// Avant de décider s'il faut ouvrir le niveau 2 (« casual chic / smart casual », inutilisé), mesurer ce que le catalogue déclare :
//   1. la valeur brute de `niveau_formalite`, par catégorie (vide compris) ;
//   2. la formalité que le moteur lit (formalityOf : la valeur déclarée, sinon la déduction par le nom) ;
//   3. les pièces que le brief cite comme ambiguës — blazers, jeans, chemises, robes, baskets —, avec leur niveau, pour voir lesquelles
//      tomberaient entre 1 et 3.
// Les pièces gelées (frozen) sont comptées à part ; les pièces réservées à la valise (étiquette « vacances ») aussi.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;

describe("répartition de la formalité du catalogue", () => {
  it("compte les niveaux déclarés et lus, par catégorie", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    // Par pages : PostgREST plafonne une réponse à 1 000 lignes, le catalogue en a davantage.
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const actives = rows.filter((r) => !(r as { frozen?: boolean }).frozen);
    console.log(`\nLignes : ${rows.length} (${rows.length - actives.length} gelées, exclues ci-dessous).`);

    // 1. Valeur brute, par catégorie.
    const brut = new Map<string, Map<string, number>>();
    for (const r of actives) {
      const cat = r.category ?? "(sans catégorie)";
      const f = r.niveau_formalite?.trim() || "(vide)";
      const m = brut.get(cat) ?? new Map<string, number>();
      m.set(f, (m.get(f) ?? 0) + 1);
      brut.set(cat, m);
    }
    console.log("\n1. niveau_formalite déclaré, par catégorie :");
    for (const [cat, m] of [...brut].sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`  ${cat.padEnd(22)} ${[...m].sort(([a], [b]) => a.localeCompare(b)).map(([f, n]) => `${f} ${n}`).join(" · ")}`);
    }

    // 2. Formalité lue par le moteur.
    const items = actives.map(rowToCatalogItem).filter((i): i is NonNullable<typeof i> => !!i);
    const lue = new Map<number, number>();
    for (const i of items) lue.set(formalityOf(i), (lue.get(formalityOf(i)) ?? 0) + 1);
    console.log(`\n2. formalityOf (${items.length} pièces lisibles) : ${[...lue].sort(([a], [b]) => a - b).map(([f, n]) => `niveau ${f} : ${n}`).join(" · ")}`);
    const vacances = items.filter((i) => i.vacances !== undefined).length;
    console.log(`   dont pièces étiquetées « vacances » : ${vacances}`);

    // 3. Les pièces ambiguës du brief.
    const familles: [string, RegExp][] = [
      ["Blazers", /blazer/i],
      ["Jeans", /\bjean/i],
      ["Chemises", /chemise/i],
      ["Robes", /\brobe/i],
      ["Baskets", /basket|sneaker/i],
    ];
    console.log("\n3. Pièces ambiguës, par niveau lu :");
    for (const [titre, re] of familles) {
      const siennes = items.filter((i) => re.test(`${i.name} ${i.subtype ?? ""}`));
      const parNiveau = new Map<number, string[]>();
      for (const i of siennes) parNiveau.set(formalityOf(i), [...(parNiveau.get(formalityOf(i)) ?? []), `#${i.id} ${i.name}`]);
      console.log(`  ${titre} (${siennes.length}) :`);
      for (const [f, noms] of [...parNiveau].sort(([a], [b]) => a - b)) console.log(`    niveau ${f} (${noms.length}) : ${noms.slice(0, 12).join(" | ")}${noms.length > 12 ? " | …" : ""}`);
    }
  });
});
