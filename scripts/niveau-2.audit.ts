import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { formalityOf } from "../src/lib/attributes";
import { computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import { CLOTHING_CATS, generateOutfitWithFallback, type LeviersMesure } from "../src/lib/logic";
import type { CapsuleSeason, DateContext, Item, OccasionKey, WorkMode } from "../src/lib/types";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { STYLES_FEMME, STYLES_HOMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// L'OUVERTURE DU NIVEAU 2 « CASUAL CHIC / SMART CASUAL » (11/11/2026, décision D1). LECTURE SEULE : rien n'est écrit dans la base.
//
// 1. PROPOSITION. Les pièces du catalogue que des critères écrits désignent comme casual chic (ci-dessous, CRITERES) : un blazer
//    déstructuré ou léger, une robe portefeuille ou fluide, une chemise col ouvert, un jean brut… Chaque pièce est listée avec son
//    niveau actuel et le critère qui la désigne, pour relecture pièce par pièce avant tout SQL. ARBITRAGE ÉDITORIAL à valider.
// 2. MESURE (AGENTS.md : même exécution, même pool, un levier à la fois). Trois variantes :
//      A · le catalogue tel qu'il est (référence) ;
//      B · les pièces proposées passées au niveau 2, planchers des occasions inchangés ;
//      C · B, et le plancher de Travail présentiel, de Soirée et de Rendez-vous « Soirée festive » abaissé de 3 à 2 (levier `plancher`).
//    Grille : 4 saisons × styles (femme, homme) × 7 contextes ; la capsule est recalculée par variante (elle lit la formalité).
//    Mesures : tenue trouvée, tenue au palier demandé (sans repli), et la part des tenues Quotidien qui portent un vêtement
//    business casual ou plus (la sur-formalité que le brief veut éviter).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const TIRAGES = 8;

/**
 * Les pièces que la propriétaire a retirées de la proposition (11/11/2026, validé : « Retire-les, on garde 126 pièces ») : jupes crayon,
 * pantalons cigarette et à pinces, mules à talons, mocassins à petit talon — des coupes de tailleur ou des talons, qui restent au niveau 3.
 * Identifiants de la base (vestiaire_universel.id).
 */
const RETIREES_PAR_LA_PROPRIETAIRE = new Set([765, 867, 1081, 688, 866, 594, 636, 841, 1035, 477, 1072]);

/** Ce qui ne descend jamais au niveau 2, quel que soit le reste du nom. */
const TOUJOURS_HABILLE = /tailleur|costume|smoking|satin|soie|velours|cérémonie|ceremonie|habillé|habille|fourreau|paillet|cocktail|gala/i;

/** Les critères de la proposition : une catégorie, des niveaux de départ, des mots du nom ou du type. */
const CRITERES: { nom: string; cats: Item["cat"][]; depuis: number[]; mots: RegExp }[] = [
  { nom: "Veste déstructurée, légère ou estivale", cats: ["veste"], depuis: [3, 4], mots: /déstructur|non doublé|léger|légère|oversize|\blin\b|d'été|en jean|surchemise/i },
  { nom: "Robe de jour (portefeuille, fluide, chemise, rayée…)", cats: ["robe"], depuis: [3], mots: /portefeuille|fluide|fleurie|rayée|ligne a|débardeur|chemise|polo|imprimée|longue|trapèze|droite/i },
  { nom: "Chemise ou blouse souple", cats: ["haut"], depuis: [3, 4], mots: /col ouvert|fluide|oversize|\blin\b|rayée|motif graphique|imprimée|blouse/i },
  { nom: "Jupe de jour", cats: ["jupe"], depuis: [3], mots: /midi|plissée|fluide|longue|portefeuille|trapèze|évasée/i },
  { nom: "Pantalon souple", cats: ["pantalon"], depuis: [3], mots: /fluide|large|chino|\blin\b|palazzo|carotte|cigarette/i },
  { nom: "Maille fine", cats: ["pull"], depuis: [3], mots: /cardigan|gilet|col v|fine|mérinos|merinos/i },
  { nom: "Chaussures de ville souples", cats: ["chaussures"], depuis: [3], mots: /mocassin|ballerine|loafer|derby|derbies|babies|mule/i },
  { nom: "Jean brut", cats: ["jean"], depuis: [1], mots: /\bbrut\b/i },
];

interface Contexte { nom: string; occasion: OccasionKey; workMode?: WorkMode; dateContext?: DateContext; plancherC?: number }
const CONTEXTES: Contexte[] = [
  { nom: "Quotidien", occasion: "quotidien" },
  { nom: "Travail présentiel", occasion: "travail_formel", workMode: "Présentiel", plancherC: 2 },
  { nom: "Soirée", occasion: "soiree", plancherC: 2 },
  { nom: "RDV soirée festive", occasion: "date", dateContext: "Soirée festive", plancherC: 2 },
  { nom: "RDV restaurant", occasion: "date", dateContext: "Restaurant / date romantique" },
  { nom: "Événement", occasion: "evenement_perso" },
  { nom: "Voyage", occasion: "voyage" },
];

const pct = (n: number, t: number) => (t ? `${((n / t) * 100).toFixed(1)} %` : "—");

describe("ouverture du niveau 2 (casual chic / smart casual)", () => {
  it("propose les pièces à reclasser et mesure A / B / C sur le même catalogue", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const actives = rows.filter((r) => !(r as { frozen?: boolean }).frozen);
    const paires = actives.map((r) => ({ r, it: rowToCatalogItem(r) })).filter((x): x is { r: VestiaireRow; it: CatalogItem } => !!x.it);
    const catalogue = paires.map((x) => x.it);
    assertCatalogueStyles(catalogue);
    console.log(`\nCatalogue : ${catalogue.length} pièces actives.`);

    // ═══ 1 · PROPOSITION ═══
    const proposees = new Map<number, { rowId: number; critere: string }>();
    console.log("\n1. PROPOSITION DE RECLASSEMENT AU NIVEAU 2 (à relire pièce par pièce)");
    for (const c of CRITERES) {
      const siennes = paires.filter(
        ({ r, it }) =>
          c.cats.includes(it.cat) &&
          c.depuis.includes(formalityOf(it)) &&
          it.vacances === undefined &&
          c.mots.test(`${it.name} ${it.subtype ?? ""}`) &&
          !TOUJOURS_HABILLE.test(`${it.name} ${it.subtype ?? ""}`) &&
          !RETIREES_PAR_LA_PROPRIETAIRE.has(Number(r.id)) &&
          !proposees.has(it.id)
      );
      console.log(`\n  ${c.nom} (${siennes.length}) :`);
      for (const { r, it } of siennes) {
        proposees.set(it.id, { rowId: Number(r.id), critere: c.nom });
        console.log(`    id ${r.id} · ${it.name} · ${it.genre ?? "?"} · ${(it.styleTags ?? []).join(", ")} · niveau ${formalityOf(it)} → 2`);
      }
    }
    console.log(`\n  Total proposé : ${proposees.size} pièces.`);
    console.log(`  Identifiants (pour le SQL) : ${[...proposees.values()].map((p) => p.rowId).sort((a, b) => a - b).join(", ")}`);

    // ═══ 2 · MESURE ═══
    const reclasse = catalogue.map((it) => (proposees.has(it.id) ? { ...it, niveauFormalite: 2 } : it));
    const variantes: { nom: string; pool: CatalogItem[]; planchers: boolean }[] = [
      { nom: "A · référence", pool: catalogue, planchers: false },
      { nom: "B · reclassement", pool: reclasse, planchers: false },
      { nom: "C · reclassement + planchers à 2", pool: reclasse, planchers: true },
    ];
    const profils: { genre: "femme" | "homme"; styles: readonly string[] }[] = [
      { genre: "femme", styles: STYLES_FEMME },
      { genre: "homme", styles: STYLES_HOMME },
    ];

    for (const { genre, styles } of profils) {
      console.log(`\n2. MESURE — ${genre} (${styles.length} styles × ${SAISONS.length} saisons × ${TIRAGES} tirages par contexte)`);
      console.log(`  ${"contexte".padEnd(20)} ${variantes.map((v) => v.nom.padEnd(34)).join("")}`);
      const lignes = new Map<string, string[]>();
      for (const v of variantes) {
        const parCtx = new Map<string, { ok: number; palier: number; total: number; surFormel: number; avec2: number }>();
        for (const saison of SAISONS) {
          const w = representativeWeatherFor(saison);
          for (const style of styles) {
            const capsule = computeDefaultCapsule(profilAudit({ gender: genre, styles: [style] }), w, [], saison, v.pool);
            const parId = new Map(capsule.map((p) => [p.id, p]));
            for (const ctx of CONTEXTES) {
              const leviers: LeviersMesure | undefined = v.planchers && ctx.plancherC != null ? { plancher: ctx.plancherC } : undefined;
              const m = parCtx.get(ctx.nom) ?? { ok: 0, palier: 0, total: 0, surFormel: 0, avec2: 0 };
              for (let k = 0; k < TIRAGES; k++) {
                const res = generateOutfitWithFallback(capsule, w, ctx.occasion, ctx.workMode ?? "Présentiel", ctx.dateContext ?? "Verre", [], genre, saison, leviers);
                m.total++;
                if (!res.ids.length) continue;
                m.ok++;
                if (!res.formalityDowngraded) m.palier++;
                const vetements = res.ids.map((id) => parId.get(id)).filter((p): p is CatalogItem => !!p && CLOTHING_CATS.includes(p.cat) && p.cat !== "manteau");
                if (vetements.some((p) => formalityOf(p) >= 3)) m.surFormel++;
                if (vetements.some((p) => formalityOf(p) === 2)) m.avec2++;
              }
              parCtx.set(ctx.nom, m);
            }
          }
        }
        for (const ctx of CONTEXTES) {
          const m = parCtx.get(ctx.nom)!;
          const cellule = `tenue ${pct(m.ok, m.total)} · palier ${pct(m.palier, m.ok)} · ≥3 ${pct(m.surFormel, m.ok)} · niv.2 ${pct(m.avec2, m.ok)}`;
          lignes.set(ctx.nom, [...(lignes.get(ctx.nom) ?? []), cellule.padEnd(34)]);
        }
      }
      for (const ctx of CONTEXTES) console.log(`  ${ctx.nom.padEnd(20)} ${(lignes.get(ctx.nom) ?? []).join(" | ")}`);
    }
    console.log("\nLecture : « tenue » = une tenue complète trouvée ; « palier » = sans repli de formalité ; « ≥3 » = la tenue porte un vêtement");
    console.log("business casual ou plus (manteau exclu) ; « niv.2 » = elle porte un vêtement casual chic.");
  }, 600_000);
});
