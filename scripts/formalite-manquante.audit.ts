import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { formalityOf } from "../src/lib/attributes";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";

// LES PIÈCES SANS NIVEAU DE FORMALITÉ (11/11/2026, suite de l'audit « formalité, contexte et activités »). LECTURE SEULE.
//
// Liste, pour un classement relu pièce par pièce, les pièces actives dont `niveau_formalite` est vide : le moteur devine alors leur
// niveau à partir du nom (formalityOf). Chaque ligne donne ce qu'il faut pour classer sans voir la photo, et le niveau deviné.
// Sortie en tableau séparé par « | », à coller tel quel dans un prompt.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const NOM_NIVEAU = ["sport", "decontracte", "casual_chic", "business_casual", "habille"];
const net = (v: unknown) => String(v ?? "").replace(/[|\n]/g, " ").trim() || "—";

describe("pièces sans niveau de formalité", () => {
  it("les liste avec leurs attributs et le niveau deviné", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const sans = rows.filter((r) => !(r as { frozen?: boolean }).frozen && !r.niveau_formalite?.trim());
    console.log(`\nPièces actives sans niveau de formalité : ${sans.length}\n`);
    console.log("id | nom | catégorie | sous-type | genre | styles | occasions | matière | couleur | saison | niveau deviné");
    for (const r of sans) {
      const it = rowToCatalogItem(r);
      const devine = it ? NOM_NIVEAU[formalityOf(it)] ?? "?" : "illisible";
      console.log([r.id, r.name, r.category, r.sous_type, r.genre, r.styles, r.occasions, r.matiere, r.couleur_dominante, r.saison_capsule, devine].map(net).join(" | "));
    }
  });
});
