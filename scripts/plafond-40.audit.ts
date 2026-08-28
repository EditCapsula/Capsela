import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { formalityOf, suggestOccasions } from "../src/lib/attributes";
import { generateOutfit } from "../src/lib/logic";
import { effetMorphologique } from "../src/lib/garmentEffect";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Item, CategoryKey, OccasionKey } from "../src/lib/types";
import { EMPTY_PROFILE, type Profile } from "../src/lib/profile";
import { OCCASIONS } from "../src/lib/data";

// Plafond de 40 pièces par capsule (style × saison) — LECTURE SEULE.
//
// Règle produit énoncée le 28/08/2026 : « le plafond de 40 correspond au
// maximum à ne pas dépasser pour chaque capsule par style et par saison »,
// pièces Sport COMPRISES. Ce relevé sert de mesure avant/après : il tourne à
// l'identique sur le code d'avant et d'après la mise en budget, et c'est la
// comparaison des deux sorties qui décide si la répartition est bonne.
//
// Le critère d'acceptation n'est pas seulement « ≤ 40 » : une capsule plus
// petite qui perdrait de la couverture d'occasion, un palier de formalité ou
// une garantie serait une régression, pas un succès. Chaque colonne ci-dessous
// existe pour rendre cette régression visible.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const STYLES = ["Casual chic", "Classique", "Glamour", "Bohème", "Streetwear", "Minimaliste"];
const profil = (styles: string[]): Profile => ({ ...EMPTY_PROFILE, gender: "femme", styles });
const isSport = (it: Item) => formalityOf(it) === 0;
const occasionsDe = (it: Item): OccasionKey[] => (it.occasion && it.occasion.length ? it.occasion : suggestOccasions(it.cat, it.shoeType));

/** Les 7 blocs de CAPSULE_GROUPS, redits ici pour lire la composition sans importer un symbole privé. */
const FAMILLES: [string, CategoryKey[]][] = [
  ["hauts", ["haut", "pull"]],
  ["bas", ["pantalon", "jean", "jupe", "short"]],
  ["robes", ["robe", "combinaison"]],
  ["vestes", ["veste", "manteau"]],
  ["chauss.", ["chaussures"]],
  ["access.", ["sac", "accessoire"]],
  ["bijoux", ["bijou"]],
];

const levierEpaules = (x: Item) => effetMorphologique(x).epaules >= 2;
const basDiscret = (x: Item) => ["pantalon", "jean", "jupe", "short"].includes(x.cat)
  && effetMorphologique(x).confiance !== "inconnue" && effetMorphologique(x).hanches <= 1;

describe("Plafond de 40 pièces par capsule", () => {
  it("relève la taille et la capacité de chaque capsule style × saison", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const pool = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));

    type Ligne = {
      saison: string; style: string; total: number; sport: number; horsSport: number;
      familles: number[]; occasions: number; paliers: string; collants: boolean; interieur: boolean;
      looks: number; epaules: number; basDiscrets: number;
    };
    const lignes: Ligne[] = [];

    for (const saison of SAISONS) {
      const w = representativeWeatherFor(saison);
      for (const style of STYLES) {
        const capsule = computeDefaultCapsule(profil([style]), w, [], saison, pool);
        const sport = capsule.filter(isSport);

        // Occasions couvertes : une occasion compte dès qu'une pièce de la
        // capsule la porte. C'est la mesure que la mise en budget ne doit
        // dégrader sous aucun prétexte.
        const couvertes = new Set<OccasionKey>();
        capsule.forEach((it) => occasionsDe(it).forEach((o) => couvertes.add(o)));

        // Paliers de formalité présents dans les familles structurantes —
        // le garde-fou existant les réintègre de force, on vérifie qu'ils
        // survivent au budget.
        const structurantes: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "jupe", "short", "robe", "combinaison"];
        const paliers = [...new Set(capsule.filter((it) => structurantes.includes(it.cat)).map(formalityOf))].sort();

        // Looks réellement générables : signatures d'ensembles distincts sur
        // toutes les occasions. Une capsule plus petite qui produirait moins
        // de tenues distinctes serait une perte de valeur d'usage.
        const signatures = new Set<string>();
        for (const [occ] of OCCASIONS) {
          for (let n = 0; n < 40; n++) {
            const { ids } = generateOutfit(capsule, w, occ, "Présentiel", "Verre", [], "femme");
            if (ids.length) signatures.add([...ids].sort((a, b) => a - b).join("-"));
          }
        }

        lignes.push({
          saison, style,
          total: capsule.length, sport: sport.length, horsSport: capsule.length - sport.length,
          familles: FAMILLES.map(([, cats]) => capsule.filter((it) => cats.includes(it.cat)).length),
          occasions: couvertes.size,
          paliers: paliers.join("/"),
          collants: capsule.some((it) => it.cat === "accessoire" && it.accessoireType === "Collants"),
          interieur: capsule.some((it) => it.cat === "chaussures" && it.shoeType === "Chaussures d'intérieur"),
          looks: signatures.size,
          epaules: capsule.filter((x) => !isSport(x) && levierEpaules(x)).length,
          basDiscrets: capsule.filter((x) => !isSport(x) && basDiscret(x)).length,
        });
      }
    }

    console.log(`\n════════ TAILLE DES 24 CAPSULES (plafond produit : 40, Sport compris) ════════\n`);
    const entete = ["saison", "style", "tot", "spt", "hs", ...FAMILLES.map(([n]) => n), "occ", "paliers", "col", "int", "looks", "épa", "bas"];
    console.log("  " + entete.map((h, i) => h.padEnd(i < 2 ? (i === 0 ? 10 : 14) : 8)).join(""));
    for (const l of lignes) {
      const cells = [
        l.saison.padEnd(10), l.style.padEnd(14),
        String(l.total).padEnd(8), String(l.sport).padEnd(8), String(l.horsSport).padEnd(8),
        ...l.familles.map((n) => String(n).padEnd(8)),
        String(l.occasions).padEnd(8), l.paliers.padEnd(8),
        (l.collants ? "oui" : "—").padEnd(8), (l.interieur ? "oui" : "—").padEnd(8),
        String(l.looks).padEnd(8), String(l.epaules).padEnd(8), String(l.basDiscrets).padEnd(8),
      ];
      const marque = l.total > 40 ? " ⚠" : "";
      console.log("  " + cells.join("") + marque);
    }

    const moy = (f: (l: Ligne) => number) => (lignes.reduce((s, l) => s + f(l), 0) / lignes.length).toFixed(1);
    const depassent = lignes.filter((l) => l.total > 40);
    console.log(`\n════════ SYNTHÈSE ════════`);
    console.log(`  Capsules > 40 pièces          : ${depassent.length} / ${lignes.length}`);
    console.log(`  Taille : moyenne ${moy((l) => l.total)} · min ${Math.min(...lignes.map((l) => l.total))} · max ${Math.max(...lignes.map((l) => l.total))}`);
    console.log(`  Dont Sport : moyenne ${moy((l) => l.sport)} · max ${Math.max(...lignes.map((l) => l.sport))}`);
    console.log(`  Occasions couvertes           : moyenne ${moy((l) => l.occasions)} · min ${Math.min(...lignes.map((l) => l.occasions))} / ${OCCASIONS.length}`);
    console.log(`  Looks distincts générables    : moyenne ${moy((l) => l.looks)} · min ${Math.min(...lignes.map((l) => l.looks))}`);
    console.log(`  Garantie collants (Aut./Hiv.) : ${lignes.filter((l) => (l.saison === "Automne" || l.saison === "Hiver") && l.collants).length} / ${lignes.filter((l) => l.saison === "Automne" || l.saison === "Hiver").length}`);
    console.log(`  Garantie chauss. d'intérieur  : ${lignes.filter((l) => l.interieur).length} / ${lignes.length}`);
    console.log(`  Leviers épaules               : moyenne ${moy((l) => l.epaules)} · min ${Math.min(...lignes.map((l) => l.epaules))}`);
    console.log(`  Bas discrets                  : moyenne ${moy((l) => l.basDiscrets)} · min ${Math.min(...lignes.map((l) => l.basDiscrets))}`);
    // Ligne compacte pour la comparaison avant/après, une capsule par ligne.
    console.log(`\n──── LIGNE DE COMPARAISON (saison|style|total|occasions|looks|paliers) ────`);
    for (const l of lignes) console.log(`  CMP ${l.saison}|${l.style}|${l.total}|${l.occasions}|${l.looks}|${l.paliers}`);
    console.log(`\nAucune modification effectuée — audit en lecture seule.`);
  }, 1_800_000);
});
