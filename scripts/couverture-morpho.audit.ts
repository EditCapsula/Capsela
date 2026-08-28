import { describe, it } from "vitest";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { effetMorphologique, type Confiance } from "../src/lib/garmentEffect";

// Mesure de couverture du prototype d'effet morphologique — lecture seule.
//
// Question posée le 28/08/2026 : combien d'information morphologique le
// catalogue actuel permet-il d'obtenir SANS annotation manuelle massive ?
// La réponse commande l'arbitrage entre annoter à la main (B), élargir la
// déduction (C), ou combiner les deux (B+C).
//
// Le dénominateur est le nombre de pièces MORPHOLOGIQUEMENT PERTINENTES :
// un bonnet ou un sac ne modifient pas la silhouette et ne doivent pas
// compter comme une lacune de données.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const pct = (n: number, total: number) => (total ? ((n / total) * 100).toFixed(1) : "0.0") + " %";

describe("Couverture morphologique", () => {
  it("mesure ce que le catalogue permet sans annotation", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SB_SECRET_KEY sont requis.");
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("vestiaire_universel")
      .select("*")
      .order("id", { ascending: true })
      .returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);

    interface Mesure {
      id: number; name: string; category: string; sousType: string;
      pertinent: boolean; epaules: number; taille: number; hanches: number;
      confiance: Confiance; motif: string; exploitable: boolean;
    }

    const mesures: Mesure[] = [];
    for (const r of data) {
      const it = rowToCatalogItem(r);
      if (!it) continue;
      const e = effetMorphologique(it, r.sous_type);
      mesures.push({
        id: r.id, name: r.name || "", category: r.category || "", sousType: r.sous_type || "",
        pertinent: e.pertinent, epaules: e.epaules, taille: e.taille, hanches: e.hanches,
        confiance: e.confiance, motif: e.motif,
        exploitable: e.pertinent && e.confiance !== "inconnue",
      });
    }

    const pertinentes = mesures.filter((m) => m.pertinent);
    const nonPertinentes = mesures.filter((m) => !m.pertinent);
    const exploitables = pertinentes.filter((m) => m.exploitable);
    const inconnues = pertinentes.filter((m) => !m.exploitable);

    writeFileSync(
      "couverture-morpho.csv",
      [["id", "nom", "categorie", "sous_type", "pertinent", "epaules", "taille", "hanches", "confiance", "motif"].map(csv).join(",")]
        .concat(mesures.map((m) =>
          [m.id, m.name, m.category, m.sousType, m.pertinent, m.epaules, m.taille, m.hanches, m.confiance, m.motif]
            .map(csv).join(",")))
        .join("\n"),
      "utf8"
    );

    console.log(`Catalogue : ${mesures.length} article(s) convertis.\n`);

    console.log(`── COUVERTURE GLOBALE ──`);
    console.log(`  morphologiquement pertinentes : ${pertinentes.length} (${pct(pertinentes.length, mesures.length)} du catalogue)`);
    console.log(`  non pertinentes (bonnet, sac…) : ${nonPertinentes.length} (${pct(nonPertinentes.length, mesures.length)})`);
    console.log(`\n  Sur les ${pertinentes.length} pertinentes :`);
    console.log(`    avec au moins un effet exploitable : ${exploitables.length}  → ${pct(exploitables.length, pertinentes.length)}`);
    console.log(`    UNKNOWN (neutres)                  : ${inconnues.length}  → ${pct(inconnues.length, pertinentes.length)}`);

    const avecEffet = (cle: "epaules" | "taille" | "hanches") => pertinentes.filter((m) => m[cle] > 0);
    console.log(`\n── COUVERTURE PAR ZONE (sur ${pertinentes.length} pertinentes) ──`);
    for (const cle of ["epaules", "taille", "hanches"] as const) {
      const n = avecEffet(cle).length;
      console.log(`  ${cle.padEnd(8)} : ${String(n).padStart(3)} pièce(s)  ${pct(n, pertinentes.length)}`);
    }

    console.log(`\n── COUVERTURE PAR CATÉGORIE ──`);
    const parCat = new Map<string, Mesure[]>();
    for (const m of pertinentes) parCat.set(m.category, [...(parCat.get(m.category) || []), m]);
    for (const [cat, ms] of [...parCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const ok = ms.filter((m) => m.exploitable).length;
      console.log(`  ${cat.padEnd(24)} ${String(ok).padStart(3)} / ${String(ms.length).padStart(3)}  ${pct(ok, ms.length)}`);
    }

    console.log(`\n── NIVEAU DE CONFIANCE (pertinentes) ──`);
    for (const c of ["haute", "moyenne", "faible", "inconnue"] as Confiance[]) {
      const n = pertinentes.filter((m) => m.confiance === c).length;
      console.log(`  ${c.padEnd(9)} : ${String(n).padStart(3)}  ${pct(n, pertinentes.length)}`);
    }

    // Priorisation d'une éventuelle annotation : les UNKNOWN des familles qui
    // pèsent le plus sur la silhouette, jamais les accessoires.
    const FAMILLES_CENTRALES = ["pantalons", "jeans", "jupes", "robes", "vestes_blazers", "manteaux_exterieurs", "hauts", "pulls_gilets"];
    const aAnnoter = inconnues
      .filter((m) => FAMILLES_CENTRALES.includes(m.category))
      .sort((a, b) => FAMILLES_CENTRALES.indexOf(a.category) - FAMILLES_CENTRALES.indexOf(b.category));

    console.log(`\n── SI ANNOTATION : PRIORITÉ ──`);
    console.log(`  ${aAnnoter.length} pièce(s) UNKNOWN dans les familles centrales.`);
    const parCatAnnoter = new Map<string, number>();
    for (const m of aAnnoter) parCatAnnoter.set(m.category, (parCatAnnoter.get(m.category) || 0) + 1);
    for (const [cat, n] of [...parCatAnnoter.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${cat.padEnd(24)} ${n}`);
    }
    console.log(`\n  Exemples (30 premiers) :`);
    for (const m of aAnnoter.slice(0, 30)) {
      console.log(`     [#${m.id}] ${m.name} — sous_type "${m.sousType}"`);
    }

    console.log(`\n════════ BILAN ════════`);
    const taux = (exploitables.length / (pertinentes.length || 1)) * 100;
    console.log(`  Couverture des pièces pertinentes : ${taux.toFixed(1)} %`);
    console.log(`  Seuil de décision évoqué : 70 %`);
    console.log(`  → ${taux >= 70 ? "AU-DESSUS du seuil" : taux >= 55 ? "PROCHE du seuil" : "EN DESSOUS du seuil"}`);
    console.log(`\nArtefact : couverture-morpho.csv`);
    console.log("Aucune modification effectuée — audit en lecture seule.");
  });
});
