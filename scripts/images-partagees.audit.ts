import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// LES IMAGES PARTAGÉES DU CATALOGUE — LECTURE SEULE (14/10/2026). Origine : les collants fins (496) et semi-opaques (497) portent la
// photo d'une pochette (accessoires/17.webp). Quelles autres pièces partagent une image avec une pièce d'un AUTRE nom ?
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("images partagées", () => {
  it("liste", async () => {
    if (!URL_ || !KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY requis");
    const sb = createClient(URL_, KEY);
    const { data, error } = await sb.from("vestiaire_universel").select("id,name,category,sous_type,url_image");
    if (error) throw error;
    const parUrl = new Map<string, { id: number; name: string; sous_type: string | null }[]>();
    for (const r of data ?? []) {
      if (!r.url_image) continue;
      const l = parUrl.get(r.url_image) ?? [];
      l.push({ id: r.id, name: r.name, sous_type: r.sous_type });
      parUrl.set(r.url_image, l);
    }
    for (const [url, l] of parUrl) if (l.length > 1) console.log("PARTAGE " + url.split("/").slice(-2).join("/") + " : " + l.map((x) => `${x.id} ${x.name} [${x.sous_type}]`).join(" | "));
  }, 60000);
});
