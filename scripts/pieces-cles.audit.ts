import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CATALOG, type CatalogItem } from "../src/lib/catalog";
import { CAPSULE_SEASONS, computeDefaultCapsule, contexteCapsule, estDeSaison, representativeWeatherFor } from "../src/lib/capsule";
import { piecesCles, proprePourSaison } from "../src/lib/capsuleEcran";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { STYLES_FEMME, profilAudit } from "./harnaisAudit";

// PIÈCES CLÉS ET SAISON — AVANT / APRÈS, LECTURE SEULE. Signalé le 01/10/2026 : « il faut
// qu'elles soient cohérentes avec la saison » (un t-shirt à manches courtes
// parmi les trois pièces clés d'une capsule d'hiver). Mesure la règle en
// production (piecesCles sans saison) : combien de pièces clés ne sont pas de
// la saison de la capsule (estDeSaison) ou sortent de leurs bornes de
// température à la température représentative de la saison.

for (const APRES of [false, true]) {
describe(`pièces clés et saison — ${APRES ? "après (saison transmise)" : "avant (règle d'origine)"}`, () => {
  it("mesure", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const cle = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let catalogue: CatalogItem[] = CATALOG;
    let source = "catalogue de REPLI";
    if (url && cle) {
      const { data, error } = await createClient(url, cle).from("vestiaire_universel").select("*").order("id").returns<VestiaireRow[]>();
      if (!error && data?.length) {
        catalogue = data.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true).map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
        source = "catalogue RÉEL (vestiaire_universel)";
      }
    }
    console.log(`CONFIGURATION GELÉE : ${source}, ${catalogue.length} pièces, ${STYLES_FEMME.length} styles femme, capsule bâtie comme à l'écran (météo représentative de la saison).`);
    for (const saison of CAPSULE_SEASONS) {
      const w = representativeWeatherFor(saison);
      const ctx = contexteCapsule(saison);
      let total = 0, horsSaison = 0, horsBornes = 0, propres = 0, hauts = 0, cellulesVides = 0;
      const vus = new Map<string, number>();
      const rep = new Map<string, number>();
      for (const style of STYLES_FEMME) {
        const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], saison, catalogue);
        if (piecesCles(capsule, 3, APRES ? saison : undefined).length < 3) cellulesVides++;
        for (const it of piecesCles(capsule, 3, APRES ? saison : undefined)) {
          total++;
          if (proprePourSaison(it, saison)) propres++;
          if (it.cat === "haut") hauts++;
          const clef = `${it.name} | ${it.season} | saisons ${it.saisons?.join("/") ?? "-"} | capsuleSeasons ${(it as CatalogItem).capsuleSeasons?.join("/") ?? "-"}`;
          rep.set(clef, (rep.get(clef) ?? 0) + 1);
          const hs = !estDeSaison(it, ctx);
          const hb = (it.meteoMinTemp != null && w.temp < it.meteoMinTemp) || (it.meteoMaxTemp != null && w.temp > it.meteoMaxTemp);
          if (hs) horsSaison++;
          if (hb) horsBornes++;
          if (hs || hb) vus.set(`${it.name} [${it.season}${it.saisons ? " " + it.saisons.join("/") : ""}; min ${it.meteoMinTemp ?? "-"} max ${it.meteoMaxTemp ?? "-"}]`, (vus.get(`${it.name}`) ?? 0) + 1);
        }
      }
      console.log(`\n── ${saison} (${w.temp}°) : ${total} pièces clés, hors saison ${horsSaison}, hors bornes ${horsBornes}, propres à la saison ${propres}, « haut » ${hauts}, styles à moins de 3 pièces clés ${cellulesVides}`);
      console.log(`   répartition : ${[...rep].map(([k, n]) => `${k} ×${n}`).join(" · ")}`);
      for (const [k] of [...vus].slice(0, 8)) console.log(`     ${k}`);
    }
  }, 600_000);
});
}
