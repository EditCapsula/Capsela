import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { PALETTE } from "../src/lib/data";
import { PAL_COULEURS } from "../src/lib/palCouleurs";
import { teinteDe } from "../src/lib/colorimetrieMoteur";

// COUVERTURE DES PALETTES PAR LE CATALOGUE RÉEL — LECTURE SEULE.
// Combien de pièces de vestiaire_universel ont une couleur que la palette du dressing
// (PALETTE) ou la palette de goûts (PAL_COULEURS) reconnaît à l'identique (hex), et que la
// colorimétrie sait lire (teinteDe) ? Quelles couleurs du catalogue n'ont aucune
// correspondance ? Sert à choisir les teintes à ajouter, avant de modifier quoi que ce soit.
describe("couverture des palettes", () => {
  it("mesure sur le catalogue réel", async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const cle = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !cle) throw new Error("Supabase non configuré");
    const { data, error } = await createClient(url, cle).from("vestiaire_universel").select("category,couleur_dominante,hex").eq("frozen", false);
    if (error || !data) throw new Error(error?.message ?? "vide");
    const hexPalette = new Set(PALETTE.map(([, h]) => h.toUpperCase()));
    const hexPal = new Set(PAL_COULEURS.map(([, h]) => h.toUpperCase()));
    let dansPalette = 0, dansPal = 0, lisibles = 0;
    const absents = new Map<string, { n: number; hex: string }>();
    for (const r of data) {
      const h = String(r.hex ?? "").toUpperCase();
      if (hexPalette.has(h)) dansPalette++;
      if (hexPal.has(h)) dansPal++;
      if (teinteDe({ hex: h, color: r.couleur_dominante ?? "" })) lisibles++;
      if (!hexPalette.has(h) && !hexPal.has(h)) {
        const k = `${r.couleur_dominante ?? "?"}`;
        const e = absents.get(k) ?? { n: 0, hex: h };
        e.n++; absents.set(k, e);
      }
    }
    const t = data.length;
    console.log(`Catalogue réel : ${t} pièces. Hex identique à PALETTE (dressing) : ${dansPalette} (${((dansPalette / t) * 100).toFixed(0)} %) ; à PAL_COULEURS (goûts) : ${dansPal} (${((dansPal / t) * 100).toFixed(0)} %) ; teinte lisible par la colorimétrie : ${lisibles} (${((lisibles / t) * 100).toFixed(0)} %).`);
    console.log("Couleurs du catalogue sans correspondance exacte, par effectif :");
    for (const [k, v] of [...absents.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 40)) console.log(`  ${String(v.n).padStart(3)}  ${k.padEnd(28)} ${v.hex}`);
  }, 120_000);
});
