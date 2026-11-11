import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { VestiaireRow } from "../src/lib/vestiaire";

// CONTRÔLE DU CLASSEMENT DES 52 PIÈCES (11/11/2026, docs/capsules/formalite-52-pieces.sql). LECTURE SEULE.
// Compare la base au classement validé par la propriétaire, pièce par pièce, et compte les pièces encore sans niveau.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const VALEURS = new Set(["sport", "decontracte", "casual_chic", "business_casual", "habille"]);
const CLASSEMENT = new Map<number, string>([
  [451, "decontracte"],
  [454, "casual_chic"],
  [455, "casual_chic"],
  [474, "casual_chic"],
  [476, "decontracte"],
  [479, "casual_chic"],
  [480, "casual_chic"],
  [482, "decontracte"],
  [483, "casual_chic"],
  [485, "casual_chic"],
  [486, "casual_chic"],
  [487, "casual_chic"],
  [488, "casual_chic"],
  [489, "casual_chic"],
  [490, "casual_chic"],
  [496, "business_casual"],
  [497, "casual_chic"],
  [498, "decontracte"],
  [503, "casual_chic"],
  [504, "casual_chic"],
  [526, "casual_chic"],
  [528, "casual_chic"],
  [684, "casual_chic"],
  [704, "casual_chic"],
  [813, "casual_chic"],
  [820, "casual_chic"],
  [823, "casual_chic"],
  [833, "casual_chic"],
  [844, "decontracte"],
  [851, "decontracte"],
  [852, "casual_chic"],
  [853, "decontracte"],
  [858, "casual_chic"],
  [862, "casual_chic"],
  [863, "casual_chic"],
  [872, "casual_chic"],
  [882, "casual_chic"],
  [896, "casual_chic"],
  [913, "casual_chic"],
  [925, "decontracte"],
  [926, "decontracte"],
  [943, "casual_chic"],
  [955, "decontracte"],
  [969, "decontracte"],
  [987, "decontracte"],
  [1019, "casual_chic"],
  [1033, "casual_chic"],
  [1036, "casual_chic"],
  [1043, "casual_chic"],
  [1044, "casual_chic"],
  [1054, "casual_chic"],
  [1057, "decontracte"],
]);

describe("classement des 52 pièces", () => {
  it("la base porte le classement validé", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const parId = new Map(rows.map((r) => [Number(r.id), r]));
    const ecarts: string[] = [];
    const decompte = new Map<string, number>();
    for (const [id, attendu] of CLASSEMENT) {
      const r = parId.get(id);
      const lu = r?.niveau_formalite?.trim() ?? "(absent)";
      decompte.set(lu, (decompte.get(lu) ?? 0) + 1);
      console.log(`  ${id} · ${r?.name ?? "?"} · ${r?.genre ?? "?"} · ${lu}${lu === attendu ? "" : `  ≠ attendu ${attendu}`}`);
      if (lu !== attendu) ecarts.push(`${id} : ${lu} au lieu de ${attendu}`);
    }
    console.log(`\nDécompte des 52 : ${[...decompte].sort().map(([v, n]) => `${v} ${n}`).join(" · ")}`);
    const actives = rows.filter((r) => !(r as { frozen?: boolean }).frozen);
    const sans = actives.filter((r) => !r.niveau_formalite?.trim());
    const horsListe = rows.filter((r) => r.niveau_formalite?.trim() && !VALEURS.has(r.niveau_formalite.trim()));
    const repartition = new Map<string, number>();
    for (const r of rows) { const v = r.niveau_formalite?.trim() || "(vide)"; repartition.set(v, (repartition.get(v) ?? 0) + 1); }
    console.log(`Pièces actives encore sans niveau : ${sans.length}${sans.length ? ` (${sans.map((r) => r.id).join(", ")})` : ""}`);
    console.log(`Valeurs hors des 5 autorisées, tout le catalogue : ${horsListe.length}`);
    console.log(`Répartition de tout le catalogue (${rows.length} lignes) : ${[...repartition].sort().map(([v, n]) => `${v} ${n}`).join(" · ")}`);
    console.log(`Écarts au classement : ${ecarts.length ? ecarts.join(" ; ") : "aucun"}`);
    expect(ecarts).toEqual([]);
  });
});
