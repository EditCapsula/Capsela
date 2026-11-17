import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { type CatalogItem } from "../src/lib/catalog";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";

// LES MANTEAUX DU CATALOGUE ET LEURS BORNES DE TEMPÉRATURE. LECTURE SEULE.
//
// 17/11/2026, demandé : « tout manteau dans la strate Extérieur sauf en cocooning, et selon la météo — à 16 °C un trench, plus léger
// qu'un manteau ». Avant d'écrire la règle, l'état des données : quels manteaux déclarent une borne (meteo_min_temp / meteo_max_temp),
// lesquels n'en ont pas, et combien seraient admis à chaque température. Aucune écriture.

describe("manteaux et bornes de température", () => {
  it("état du catalogue", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const cle = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !cle) throw new Error("Supabase non configuré");
    const { data, error } = await createClient(url, cle).from("vestiaire_universel").select("*").order("id").returns<VestiaireRow[]>();
    if (error || !data?.length) throw new Error(`Lecture impossible : ${error?.message ?? "vide"}`);
    const cat = data
      .filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem)
      .filter((x): x is CatalogItem => Boolean(x));
    const manteaux = cat.filter((i) => i.cat === "manteau");
    console.log(`\nManteaux du catalogue : ${manteaux.length}`);
    console.log("id · genre · nom · saison · min · max");
    for (const m of manteaux) {
      const g = (m as CatalogItem & { gender?: string }).gender ?? "?";
      console.log(`${m.id} · ${g} · ${m.name} · ${m.season ?? "?"} · ${m.meteoMinTemp ?? "—"} · ${m.meteoMaxTemp ?? "—"}`);
    }
    const sansMax = manteaux.filter((m) => m.meteoMaxTemp == null).length;
    const sansMin = manteaux.filter((m) => m.meteoMinTemp == null).length;
    console.log(`\nSans borne haute : ${sansMax} · sans borne basse : ${sansMin}`);
    console.log("\nAdmis par température (bornes seules, saison et occasion non prises en compte) :");
    for (const t of [0, 5, 8, 10, 12, 14, 16, 18, 20, 22, 25]) {
      const ok = manteaux.filter((m) => (m.meteoMinTemp == null || t >= m.meteoMinTemp) && (m.meteoMaxTemp == null || t <= m.meteoMaxTemp));
      const types = new Map<string, number>();
      for (const m of ok) {
        const k = /trench/i.test(m.name) ? "trench" : /imperm|ciré|coupe-vent/i.test(m.name) ? "imperméable" : /doudoune|parka/i.test(m.name) ? "doudoune/parka" : /caban/i.test(m.name) ? "caban" : "manteau";
        types.set(k, (types.get(k) ?? 0) + 1);
      }
      console.log(`${t}° : ${ok.length} — ${[...types].map(([k, n]) => `${k} ${n}`).join(", ")}`);
    }
  });
});
