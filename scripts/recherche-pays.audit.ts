import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { lirePaysCommeCapitale } from "../src/lib/weather";

// LA RECHERCHE D'UN PAYS DANS « TA DESTINATION » (11/11/2026, signalé : « lorsque je saisis un pays le moteur ne trouve pas »).
// LECTURE SEULE : aucune écriture. Pour chaque saisie, ce que répond le géocodage de l'app (fonction Edge `weather`, mode geo) et ce
// que répond REST Countries, que l'app n'interroge QUE si le géocodage ne rend aucune ville (fetchVilles, weather.ts).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const SAISIES = ["Inde", "Italie", "Japon", "Thaïlande", "Maroc", "Espagne", "Grèce", "Portugal", "Mexique", "Indonésie", "Ind", "Ital"];

describe("recherche d'un pays", () => {
  it("compare le géocodage et REST Countries", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    for (const q of SAISIES) {
      const { data, error } = await supabase.functions.invoke("weather", { body: { city: q, mode: "geo" } });
      const villes = Array.isArray(data) ? data : (data as { villes?: unknown[]; results?: unknown[] } | null)?.villes ?? data;
      const resume = error ? `erreur ${error.message}` : JSON.stringify(villes).slice(0, 260);
      let pays = "";
      try {
        const res = await fetch(`https://restcountries.com/v3.1/translation/${encodeURIComponent(q)}?fields=name,translations,capital,capitalInfo,cca2`);
        const corps = res.ok ? await res.json() : null;
        pays = `HTTP ${res.status} · ${corps ? JSON.stringify(lirePaysCommeCapitale(corps, q)).slice(0, 200) : "—"}`;
      } catch (e) {
        pays = `échec réseau : ${(e as Error).message}`;
      }
      console.log(`\n« ${q} »\n  géocodage : ${resume}\n  REST Countries : ${pays}`);
    }
    // Le corps brut de REST Countries, par nom et par code : un 200 qui ne rend aucun pays lisible vient-il du format de la réponse ?
    for (const url of [
      "https://restcountries.com/v3.1/translation/Tha%C3%AFlande?fields=name,translations,capital,capitalInfo,cca2",
      "https://restcountries.com/v3.1/translation/Tha%C3%AFlande",
      "https://restcountries.com/v3.1/alpha/TH?fields=capital,capitalInfo,cca2",
    ]) {
      try {
        const res = await fetch(url);
        console.log(`\n${url}\n  HTTP ${res.status} · ${(await res.text()).slice(0, 500)}`);
      } catch (e) {
        console.log(`\n${url}\n  échec réseau : ${(e as Error).message}`);
      }
    }
  }, 120_000);
});
