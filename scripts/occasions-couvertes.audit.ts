import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, occasionsOf, saisonCapsulePourMeteo, weatherForDay } from "../src/lib/capsule";
import { composeWardrobePool } from "../src/lib/selectors";
import { occasionsCouvertes, NB_OCCASIONS } from "../src/lib/looks";
import { CATS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item } from "../src/lib/types";
import { STYLES_FEMME, STYLES_HOMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// « N OCCASIONS COUVERTES » BOUGE-T-IL JAMAIS ? LECTURE SEULE.
//
// LA QUESTION, posée le 15/09 : si ce compteur affiche toujours 10/10, il
// n'apprend rien à personne et ne mérite pas la place qu'il prendrait.
//
// CE QUI EST DÉJÀ ÉTABLI, et qu'il ne faut donc pas remesurer :
//   · dressing VIDE, 8 styles × 4 saisons -> 10/10 partout (compteur-looks,
//     15/09) ;
//   · dressing VIDE, 10 journées où le calendrier et le thermomètre se
//     contredisent, 4 bras -> 80/80 partout (meteo-contre-saison, 15/09).
//
// Le seul mécanisme JAMAIS démontré capable de vider une occasion est le
// dressing partiel : posséder des pièces dans une catégorie écarte les
// suggestions du catalogue pour cette catégorie, et le sport — seule occasion
// sans repli de formalité — tombait alors à zéro (10/09). Il a été corrigé le
// jour même par la complétion du pool. La question est donc ouverte : le
// compteur peut-il ENCORE descendre, et dans quels cas ?
//
// CE QUE MESURE CE SCRIPT, dans une seule exécution et sur le même pool. Le
// dressing varie, tout le reste est gelé :
//   vide            témoin, doit reproduire le 10/10 connu ;
//   partiel         les vraies affaires, sans pièce technique — le cas du
//                   10/09, désormais corrigé ;
//   sans chaussures l'utilisatrice n'a rentré aucune paire ;
//   une seule paire une paire de ville et rien d'autre ;
//   minuscule       trois pièces en tout, un début de dressing ;
//   tout            tout ce que la capsule propose, sans exception.
//
// Deux genres, quatre saisons, tous les styles exposés. On rapporte le
// MINIMUM et la distribution, pas une moyenne : une moyenne de 9,8 cacherait
// exactement le cas qui nous intéresse.
//
// Aucune écriture, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const CAT_KEYS = CATS.map(([k]) => k) as CategoryKey[];
/** Les catégories qu'une utilisatrice rentre en premier dans son dressing. */
const CATS_COURANTES: CategoryKey[] = ["haut", "pull", "pantalon", "jean", "robe", "veste", "chaussures", "sac"];

type Forme = { nom: string; possedees: (capsule: CatalogItem[]) => CatalogItem[] };

const FORMES: Forme[] = [
  { nom: "vide", possedees: () => [] },
  {
    nom: "partiel (sans sport)",
    possedees: (c) => c.filter((it) => CATS_COURANTES.includes(it.cat) && !occasionsOf(it).includes("sport")),
  },
  { nom: "sans chaussures", possedees: (c) => c.filter((it) => CATS_COURANTES.includes(it.cat) && it.cat !== "chaussures") },
  {
    nom: "une seule paire",
    possedees: (c) => {
      const paire = c.find((it) => it.cat === "chaussures");
      return paire ? [paire] : [];
    },
  },
  { nom: "minuscule (3 pièces)", possedees: (c) => [c.find((i) => i.cat === "haut"), c.find((i) => i.cat === "pantalon"), c.find((i) => i.cat === "chaussures")].filter((x): x is CatalogItem => Boolean(x)) },
  { nom: "tout", possedees: (c) => [...c] },
];

describe("le compteur d'occasions couvertes", () => {
  it("cherche les cas où il descend sous 10, plutôt que de supposer qu'il n'y en a pas", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`Catalogue : ${pool.length} pièces. Total d'occasions : ${NB_OCCASIONS}.`);
    console.log(`CONFIGURATION GELÉE : 4 saisons, ${STYLES_FEMME.length} styles femme + ${STYLES_HOMME.length} homme, ${FORMES.length} formes de dressing.`);

    const resultats = new Map<string, number[]>(FORMES.map((f) => [f.nom, []]));
    const creux: string[] = [];

    for (const genre of ["femme", "homme"] as const) {
      const styles = genre === "femme" ? STYLES_FEMME : STYLES_HOMME;
      for (const saison of CAPSULE_SEASONS) {
        const temp = { Printemps: 16, Été: 24, Automne: 14, Hiver: 6 }[saison];
        const w = weatherForDay(temp, saison === "Été" ? "Ensoleillé" : "Nuageux", saison);
        const saisonTenue: CapsuleSeason = saisonCapsulePourMeteo(temp);
        for (const style of styles) {
          const capsule = computeDefaultCapsule(profilAudit({ gender: genre, styles: [style] }), w, [], saisonTenue, pool);
          for (const forme of FORMES) {
            const possedees = forme.possedees(capsule);
            // Le pool exactement comme le store le compose, complétion comprise.
            const poolEffectif: Item[] = composeWardrobePool(possedees, capsule, CAT_KEYS);
            const n = occasionsCouvertes(poolEffectif, w, genre, saisonTenue);
            resultats.get(forme.nom)!.push(n);
            if (n < NB_OCCASIONS) creux.push(`${genre} · ${saison} · ${style} · ${forme.nom} → ${n}/${NB_OCCASIONS}`);
          }
        }
      }
    }

    console.log(`\n════════ CE QUE RÉPOND LE COMPTEUR, FORME PAR FORME ════════`);
    console.log(`  ${"forme de dressing".padEnd(24)}${"cellules".padStart(10)}${"min".padStart(6)}${"max".padStart(6)}${"< 10".padStart(7)}`);
    for (const f of FORMES) {
      const v = resultats.get(f.nom)!;
      const sous = v.filter((n) => n < NB_OCCASIONS).length;
      console.log(`  ${f.nom.padEnd(24)}${String(v.length).padStart(10)}${String(Math.min(...v)).padStart(6)}${String(Math.max(...v)).padStart(6)}${String(sous).padStart(7)}`);
    }

    console.log(`\n════════ LES CAS OÙ IL DESCEND ════════`);
    if (!creux.length) {
      console.log(`  AUCUN, sur ${[...resultats.values()].flat().length} cellules.`);
      console.log(`  Le compteur vaudrait donc ${NB_OCCASIONS}/${NB_OCCASIONS} pour tout le monde : il n'apprendrait rien,`);
      console.log(`  et l'afficher reviendrait à occuper la place avec une constante.`);
    } else {
      for (const c of creux.slice(0, 60)) console.log(`  ${c}`);
      if (creux.length > 60) console.log(`  … et ${creux.length - 60} autres.`);
    }

    console.log(`\n  LECTURE SEULE. Aucun affichage changé.`);
  }, 900_000);
});
