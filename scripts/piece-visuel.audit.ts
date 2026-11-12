import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// UNE PIÈCE ET SON VISUEL (12/11/2026, signalé : « Robe pull à détail asymétrique > le visuel n'est pas bon »). LECTURE SEULE : la ligne
// du catalogue (vestiaire_universel) et les pièces de dressing du même nom, avec l'adresse de leur visuel. Rien n'est modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const MOTIF = "%robe pull%asym%";

describe("pièce et visuel", () => {
  it("Robe pull à détail asymétrique", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: cat, error } = await supabase.from("vestiaire_universel").select("*").ilike("name", MOTIF);
    if (error) throw new Error(error.message);
    for (const r of cat ?? []) console.log("CATALOGUE", JSON.stringify(r));
    const { data: dr, error: e2 } = await supabase.from("dressing_items").select("id,name,cat,color,subtype,photo_url,created_at").ilike("name", MOTIF);
    if (e2) throw new Error(e2.message);
    for (const r of dr ?? []) console.log("DRESSING", JSON.stringify(r));
    console.log(`catalogue ${cat?.length ?? 0} · dressing ${dr?.length ?? 0}`);
  }, 60_000);
});
