import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { paysDeLaSaisie } from "../src/lib/weather";

// LA RECHERCHE D'UN PAYS DANS « TA DESTINATION » (11/11/2026, signalé : « lorsque je saisis un pays le moteur ne trouve pas »).
// LECTURE SEULE. Pour chaque saisie : les pays reconnus par la liste de l'app (paysDeLaSaisie, paysData.ts) et la capitale que le
// géocodage de l'app (fonction Edge `weather`, mode geo, « capitale,CODE ») trouve pour chacun — ce que fetchVilles met en tête.
// (Avant le 11/11/2026 : REST Countries v3.1, fermé — « This API version has been deprecated ».)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SAISIES = ["Inde", "Italie", "Japon", "Thaïlande", "Maroc", "Espagne", "Grèce", "Portugal", "Mexique", "Indonésie", "Ind", "Ital", "Niger", "États-Unis", "Royaume-Uni", "Lisbonne"];

describe("recherche d'un pays", () => {
  it("pays reconnus et capitale géocodée", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    let sansCapitale = 0;
    for (const q of SAISIES) {
      const pays = paysDeLaSaisie(q);
      const lignes: string[] = [];
      for (const p of pays) {
        const { data, error } = await supabase.functions.invoke("weather", { body: { city: `${p.capitale},${p.code}`, mode: "geo" } });
        const premiere = (data as { places?: { name: string; country: string; lat: number; lon: number }[] } | null)?.places?.[0];
        if (!premiere) sansCapitale++;
        lignes.push(`${p.nom} → ${premiere ? `${premiere.name} (${premiere.country}) ${premiere.lat.toFixed(2)}, ${premiere.lon.toFixed(2)}` : `capitale introuvable${error ? ` (${error.message})` : ""}`}`);
      }
      console.log(`« ${q} » : ${lignes.length ? lignes.join(" · ") : "aucun pays"}`);
    }
    console.log(`\nCapitales introuvables : ${sansCapitale}`);
  }, 120_000);
});
