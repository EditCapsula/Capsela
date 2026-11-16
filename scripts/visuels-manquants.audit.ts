import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { resolveItemImage } from "../src/lib/catalogImages";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";

// LES VISUELS MANQUANTS DU CATALOGUE (16/11/2026, signalé en capture : « Choisir des chaussures » montre des cases vides — « Bottes
// hautes classiques », « Bottines minimalistes à talon noir », « Mocassins épurés », « Bottines Chelsea »). LECTURE SEULE.
// Pour chaque pièce active : l'image que l'app afficherait (resolveItemImage) ; aucune → « sans visuel », avec la raison (pas
// d'url_image, statut ≠ ready, pas de hero) ; une image → son adresse est interrogée (HEAD) : un statut ≠ 200 → « visuel cassé ».

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;

describe("visuels manquants du catalogue", () => {
  it("liste les pièces sans visuel affichable", { timeout: 1_800_000 }, async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL / SB_SECRET_KEY absents");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: (VestiaireRow & { frozen?: boolean })[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1);
      if (error) throw error;
      rows.push(...((data ?? []) as typeof rows));
      if (!data || data.length < PAGE) break;
    }
    const actives = rows.filter((r) => !r.frozen);
    const sans: string[] = [];
    const casses: string[] = [];
    const aTester: { r: (typeof rows)[number]; url: string; source: string }[] = [];
    for (const r of actives) {
      const it = rowToCatalogItem(r);
      if (!it) continue;
      const img = resolveItemImage(it);
      if (!img.url) {
        sans.push(`${r.id} · ${r.category} · ${r.name} · url_image ${r.url_image ? "présente" : "absente"}, statut ${r.image_status ?? "∅"}, hero ${r.url_image_hero ? "présent" : "absent"}`);
        continue;
      }
      aTester.push({ r, url: img.url, source: img.url === r.url_image_hero ? "hero" : "standard" });
    }
    for (let i = 0; i < aTester.length; i += 12) {
      await Promise.all(
        aTester.slice(i, i + 12).map(async ({ r, url, source }) => {
          try {
            const res = await fetch(url, { method: "HEAD" });
            if (!res.ok) casses.push(`${r.id} · ${r.category} · ${r.name} · ${source} ${res.status} · ${url}`);
          } catch (e) {
            casses.push(`${r.id} · ${r.category} · ${r.name} · ${source} injoignable (${String(e).slice(0, 60)}) · ${url}`);
          }
        })
      );
    }
    console.log(`\nPièces actives : ${actives.length} · sans visuel affichable : ${sans.length} · visuel cassé : ${casses.length}`);
    console.log("\n═══ SANS VISUEL : id · catégorie · nom · état ═══");
    for (const l of sans) console.log(l);
    console.log("\n═══ VISUEL CASSÉ : id · catégorie · nom · source et statut · adresse ═══");
    for (const l of casses) console.log(l);
  });
});
