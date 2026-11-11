import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { VestiaireRow } from "../src/lib/vestiaire";

// LES BLAZERS ET LEUR NIVEAU DE FORMALITÉ (11/11/2026, « corrige les deux blazers »). LECTURE SEULE.
// Liste chaque blazer du catalogue avec son identifiant de ligne, son niveau déclaré, sa matière, sa saison et ses occasions.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("blazers du catalogue", () => {
  it("les liste avec leur niveau déclaré", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase.from("vestiaire_universel").select("*").ilike("name", "%blazer%").order("id").returns<VestiaireRow[]>();
    if (error) throw new Error(error.message);
    console.log(`\nBlazers : ${data.length}\nid | nom | genre | styles | niveau | matière | saison | occasions | gelée`);
    for (const r of data) {
      console.log([r.id, r.name, r.genre, r.styles, r.niveau_formalite, r.matiere, r.saison_capsule, r.occasions, (r as { frozen?: boolean }).frozen ? "oui" : "non"].map((v) => String(v ?? "—")).join(" | "));
    }
  });
});
