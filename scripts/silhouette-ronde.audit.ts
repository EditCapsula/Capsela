import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { CatalogItem } from "../src/lib/catalog";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor, styleFit } from "../src/lib/capsule";
import { matiereOf } from "../src/lib/attributes";
import { estDansLUnivers } from "../src/lib/univers";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import type { CategoryKey, Item } from "../src/lib/types";
import { STYLE_ID_TO_CATALOG_LABEL } from "../src/lib/profile";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LA SILHOUETTE « PLUTÔT RONDE ET RÉGULIÈRE » (f_pomme) — CE QUE LE CATALOGUE PERMET. LECTURE SEULE, AUCUN LEVIER. (15/11/2026, demandé :
// « il faudrait que l'on crée des règles dans le moteur pour les silhouettes rondes »)
//
// Aujourd'hui le moteur n'a aucune règle pour cette silhouette (ZONES_REQUISES.f_pomme = [], garmentEffect.ts). Avant d'en écrire une,
// on compte ce qu'une règle aurait à se mettre sous la dent. Principe de style PROPOSÉ, à arbitrer (ARBITRAGE ÉDITORIAL à venir) :
// des lignes verticales et une fluidité qui accompagne le buste. Cinq critères candidats, lus sur les données réelles :
//   V      encolure en V ou croisée (nom : col V, cache-cœur, portefeuille) — hauts, pulls, robes, combinaisons ;
//   LONG   pièce longue ouverte : gilet / cardigan / kimono / trench / manteau, longueur « longue » ou nom qui le dit ;
//   FLUIDE matière fluide (viscose, soie, satin, crêpe, modal, lyocell, mousseline, lin) ou couche « fluide » ou nom « fluide » ;
//   PORTEF robe portefeuille ou cache-cœur ;
//   BAS    bas droit, large ou légèrement évasé (pantalon, jean, jupe : droit, large, évasé, bootcut, palazzo, wide).
// Et le cas inverse, à ne PAS favoriser (jamais exclure) : les coupes moulantes ou à taille très serrée (MORPHO_AVOID.f_pomme existe
// déjà dans capsule.ts, inutilisé en production).
//
// Mesures : (1) complétude des colonnes utiles (longueur, couche, matière, coupe) ; (2) pièces femme répondant à chaque critère, par
// catégorie ; (3) par style × saison de capsule : vêtements candidats DISPONIBLES (saison et style) et part de la capsule actuelle qui
// répond déjà à au moins un critère — la marge réelle d'une règle. Aucune conclusion hors de ces scénarios (AGENTS.md, point 4).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const VETEMENTS: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison", "veste", "manteau"];
const nom = (it: Item) => `${it.name} ${(it as { sousType?: string }).sousType ?? ""}`.toLowerCase();

const CRITERES: Record<string, (it: Item) => boolean> = {
  V: (it) => ["haut", "pull", "robe", "combinaison"].includes(it.cat) && /col v|col en v|encolure v|décolleté v|cache-c(œ|oe)ur|portefeuille|croisé/.test(nom(it)),
  LONG: (it) =>
    ["pull", "veste", "manteau"].includes(it.cat) &&
    /gilet|cardigan|kimono|trench|manteau|duster|redingote/.test(nom(it)) &&
    (it.longueur === "longue" || /long|longue|maxi/.test(nom(it))),
  FLUIDE: (it) =>
    VETEMENTS.includes(it.cat) &&
    (/viscose|soie|satin|crêpe|crepe|modal|lyocell|tencel|mousseline|lin/.test(String(matiereOf(it)).toLowerCase() + " " + nom(it)) ||
      it.couche === "fluide" ||
      /fluide/.test(nom(it))),
  PORTEF: (it) => it.cat === "robe" && /portefeuille|cache-c(œ|oe)ur/.test(nom(it)),
  BAS: (it) => ["pantalon", "jean", "jupe"].includes(it.cat) && /droit|large|évasé|evase|bootcut|palazzo|wide|flare/.test(nom(it)),
};
const AEVITER = (it: Item) => /moulant|ceinture serrée|col montant|bodycon|seconde peau/.test(nom(it));
const unCritere = (it: Item) => Object.values(CRITERES).some((f) => f(it));
const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(1) : "0.0") + " %";

describe("silhouette plutôt ronde : ce que le catalogue permet", () => {
  it("compte les pièces candidates", { timeout: 1_800_000 }, async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL / SB_SECRET_KEY absents");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (error) throw error;
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const catalogue = rows
      .filter((r) => !(r as { frozen?: boolean }).frozen)
      .map(rowToCatalogItem)
      .filter((i): i is CatalogItem => !!i);
    assertCatalogueStyles(catalogue);
    const femme = catalogue.filter((it) => estDansLUnivers(it, "femme"));
    const vet = femme.filter((it) => VETEMENTS.includes(it.cat));
    console.log(`Catalogue : ${catalogue.length} pièces actives, ${femme.length} dans l'univers femme, dont ${vet.length} vêtements.`);

    console.log("\n=== 1. Complétude des colonnes (vêtements femme) ===");
    const remplis = (f: (it: Item) => unknown) => vet.filter((it) => f(it) != null && f(it) !== "").length;
    console.log(`longueur ${pct(remplis((it) => it.longueur), vet.length)} · couche ${pct(remplis((it) => it.couche), vet.length)} · matière déclarée ${pct(remplis((it) => it.matiere), vet.length)} · coupe ${pct(remplis((it) => it.coupe), vet.length)}`);

    console.log("\n=== 2. Pièces femme par critère et par catégorie ===");
    for (const [cle, f] of Object.entries(CRITERES)) {
      const n = vet.filter(f);
      const parCat = new Map<string, number>();
      for (const it of n) parCat.set(it.cat, (parCat.get(it.cat) ?? 0) + 1);
      console.log(`${cle.padEnd(7)} ${String(n.length).padStart(4)} (${pct(n.length, vet.length)}) | ${[...parCat].map(([c, k]) => `${c} ${k}`).join(", ")}`);
      console.log(`        exemples : ${n.slice(0, 6).map((it) => `#${it.id} ${it.name}`).join(" ; ")}`);
    }
    const auMoins = vet.filter(unCritere).length;
    const aEviter = vet.filter(AEVITER);
    console.log(`Au moins un critère : ${auMoins} (${pct(auMoins, vet.length)}). Coupes à ne pas favoriser : ${aEviter.length} (${aEviter.slice(0, 6).map((it) => it.name).join(" ; ")}).`);

    console.log("\n=== 3. Par style × saison de capsule : candidats disponibles et capsule actuelle ===");
    console.log("style | saison | vêtements de saison et de style : candidats / total | capsule actuelle (f_pomme) : vêtements avec ≥ 1 critère / vêtements · à ne pas favoriser");
    let somCap = 0, somCapOk = 0;
    for (const style of STYLES_FEMME)
      for (const saison of CAPSULE_SEASONS) {
        const profil = profilAudit({ gender: "femme", styles: [style], morphology: "f_pomme" });
        const cap = computeDefaultCapsule(profil, representativeWeatherFor(saison), [], saison, catalogue);
        const capVet = cap.filter((it) => VETEMENTS.includes(it.cat));
        const capOk = capVet.filter(unCritere).length;
        const capEviter = capVet.filter(AEVITER).length;
        somCap += capVet.length;
        somCapOk += capOk;
        const bucket = saison === "Printemps" || saison === "Été" ? "Printemps / Été" : "Automne / Hiver";
        const dispo = vet.filter((it) => (it.season === bucket || it.season === "Toutes saisons") && styleFit(it, STYLE_ID_TO_CATALOG_LABEL[style]));
        const dispoOk = dispo.filter(unCritere).length;
        console.log(`${style} | ${saison} | ${dispoOk} / ${dispo.length} | ${capOk} / ${capVet.length} · ${capEviter}`);
      }
    console.log(`Toutes capsules : ${somCapOk} / ${somCap} vêtements répondent déjà à au moins un critère (${pct(somCapOk, somCap)}).`);
  });
});
