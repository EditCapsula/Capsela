import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, saisonCapsulePourMeteo, weatherForDay } from "../src/lib/capsule";
import { generateOutfitWithFallback, type LeviersMesure, type TraceRepli } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// QUAND LA MÉTÉO CONTREDIT LA SAISON — LECTURE SEULE.
//
// SIGNALÉ LE 14/09/2026, capture à l'appui : 28° et ensoleillé à Montreuil,
// occasion « Rendez-vous important », et l'application propose un blazer de
// laine SOUS un trench, sous une légende « 28° aujourd'hui · légère et
// fraîche ».
//
// LE MÉCANISME SUPPOSÉ, à confirmer plutôt qu'à affirmer :
//   store.tsx:551  la capsule suit la saison CALENDAIRE (`currentSeasonKey`),
//                  donc en septembre elle est bâtie pour l'Automne, à sa
//                  température représentative de 14°.
//   logic.ts       à 28°, `applyTempFilter` retire tout ce dont le `max` est
//                  dépassé — dans une capsule d'automne, presque tout.
//   poolFor        chaque catégorie se vide, l'échelle descend au barreau 1,
//                  « météo relâchée », qui abandonne la température des DEUX
//                  côtés. Le trench redevient éligible.
//
// La section 0 le vérifie par la TRACE plutôt que par déduction : elle lit le
// barreau réellement retenu pour chaque catégorie, sur le cas signalé.
//
// POURQUOI LES DEUX BORNES NE SE VALENT PAS. Sous son `min`, une pièce reste
// portable : une couche compense, et c'est exactement ce que
// TEMP_COMPENSATED_CATS, R-B18 et R-B19 organisent. Au-dessus de son `max`,
// rien ne compense — on ne retire pas la laine d'un manteau. Relâcher le `min`
// produit une tenue imparfaite ; relâcher le `max` produit une tenue fausse.
//
// LES DEUX LEVIERS MESURÉS, et leur combinaison, dans la MÊME exécution :
//   B  le barreau « météo relâchée » ne relâche plus que le `min`. Correctif
//      chirurgical : il ne touche à rien d'autre.
//   C  la capsule de la TENUE DU JOUR est celle dont la température
//      représentative est la plus proche de la météo, au lieu de la saison
//      calendaire (`saisonCapsulePourMeteo`). N'invente aucune constante :
//      se sert des quatre nombres déjà mesurés le 14/09.
//
// ARBITRÉ LE 15/09 : B ET C, l'écran Capsule restant calendaire. Les deux sont
// donc en production, et les bras s'inversent — `replMeteoRelacheMax` et la
// capsule calendaire reconstituent désormais l'AVANT. Le bras D est le livré.
//
// CORRECTION DU SCRIPT AU PASSAGE. La première version transmettait
// `capsuleSeason` à `generateOutfitWithFallback` ; `regen` (store.tsx) ne le
// fait pas. Le bras de référence n'était donc pas la production, mais une
// variante plus stricte sur le filtre de saison. Il est omis partout ici.
//
// LA CONTRE-MESURE, sans laquelle B serait un moyen de vider l'application :
// une catégorie qui n'avait que des pièces hors `max` devient VIDE. On compte
// donc les occasions perdues autant que les pièces hors plage, et une seule
// occasion perdue suffit à poser la question à l'utilisatrice.
//
// CE QUI N'EST PAS TRANSPORTÉ ICI. La mesure du 14/09 « 0 pièce hors max
// partout » a été prise aux températures REPRÉSENTATIVES de chaque saison —
// 14° pour l'automne. Elle ne dit rien d'une vraie journée à 28°, et n'est
// donc pas invoquée (AGENTS.md, point 4).
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 20;

type Bras = { nom: string; leviers?: LeviersMesure; capsuleMeteo: boolean };
const BRAS: Bras[] = [
  { nom: "A · avant le 15/09", leviers: { replMeteoRelacheMax: true }, capsuleMeteo: false },
  { nom: "B · max jamais relâché", capsuleMeteo: false },
  { nom: "C · capsule selon météo", leviers: { replMeteoRelacheMax: true }, capsuleMeteo: true },
  { nom: "D · B + C (livré)", capsuleMeteo: true },
];

/** Journées mesurées : la saison du calendrier, et la température qu'il fait vraiment. */
const JOURNEES: { calendaire: CapsuleSeason; temp: number; label: string }[] = [
  { calendaire: "Automne", temp: 30, label: "Ensoleillé" },
  { calendaire: "Automne", temp: 28, label: "Ensoleillé" },
  { calendaire: "Automne", temp: 25, label: "Ensoleillé" },
  { calendaire: "Automne", temp: 22, label: "Nuageux" },
  { calendaire: "Automne", temp: 18, label: "Nuageux" },
  { calendaire: "Automne", temp: 14, label: "Nuageux" },
  { calendaire: "Automne", temp: 8, label: "Nuageux" },
  { calendaire: "Été", temp: 15, label: "Nuageux" },
  { calendaire: "Printemps", temp: 28, label: "Ensoleillé" },
  { calendaire: "Hiver", temp: 15, label: "Nuageux" },
];

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function grainePour(cle: string): number {
  let h = 2166136261;
  for (let i = 0; i < cle.length; i++) { h ^= cle.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

describe("quand la météo contredit la saison", () => {
  it("confirme le mécanisme par la trace, puis mesure les deux leviers", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const ligne = new Map<number, VestiaireRow>(brutes.map((r) => [VESTIAIRE_ID_OFFSET + r.id, r]));
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    console.log(`Catalogue : ${pool.length} pièces.`);
    console.log(`CONFIGURATION GELÉE : profils d'audit, ${STYLES_FEMME.length} styles femme, ${OCCS.length} occasions, ${N} tirages, graines déterministes.`);

    const capsulePour = (style: string, saison: CapsuleSeason, temp: number, label: string) =>
      computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }),
        weatherForDay(temp, label, saison), [], saison, pool);

    // ═══ 0 · LE CAS SIGNALÉ, ET LA TRACE QUI DIT POURQUOI ════════════════
    console.log(`\n════════ 0 · LE CAS SIGNALÉ — Automne, 28°, Ensoleillé, « Rendez-vous important » ════════`);
    const wSignale = weatherForDay(28, "Ensoleillé", "Automne");
    console.log(`  weather.seasons = [${wSignale.seasons.join(", ")}]  ·  bucket ${wSignale.season}`);
    let stylesTouches = 0;
    let exemple: string[] = [];
    for (const style of STYLES_FEMME) {
      const capsule = capsulePour(style, "Automne", 28, "Ensoleillé");
      const traces: TraceRepli[] = [];
      const vrai = Math.random;
      Math.random = mulberry32(grainePour(`${style}|entretien|0`));
      let ids: number[];
      try {
        ids = generateOutfitWithFallback(capsule, wSignale, "entretien", "Présentiel", "Verre", [], "femme",
          undefined, { traceRepli: (e) => traces.push(e), replMeteoRelacheMax: true }).ids;
      } finally { Math.random = vrai; }
      const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
      const horsMax = pieces.filter((p) => p.meteoMaxTemp != null && 28 > p.meteoMaxTemp);
      if (horsMax.length) stylesTouches += 1;
      // Le dernier segment seulement : generateOutfitWithFallback tire plusieurs fois.
      const debut = traces.map((t, i) => (t.type === "début" ? i : -1)).filter((i) => i >= 0).pop() ?? -1;
      const dernier = traces.slice(debut + 1).filter((t) => t.type === "repli");
      console.log(`\n  ${style} — ${pieces.length} pièce(s), ${horsMax.length} au-dessus de leur max`);
      for (const p of horsMax)
        console.log(`     HORS MAX  réf ${String(ligne.get(p.id)!.id).padStart(5)}  ${p.cat.padEnd(11)}max ${String(p.meteoMaxTemp).padStart(3)}°  ${p.name}`);
      if (horsMax.length && !exemple.length) {
        exemple = [
          `  Tenue complète (${style}) : ${pieces.map((p) => `${p.name} [${p.cat}]`).join(" · ")}`,
          `  Barreaux retenus :`,
          ...dernier.map((t) => `     ${t.cats.join("+").padEnd(24)}barreau ${t.barreau} « ${t.nom} »   effectifs ${t.effectifs.join("/")}`),
        ];
      }
    }
    console.log(`\n  ${stylesTouches}/${STYLES_FEMME.length} styles proposent au moins une pièce au-dessus de son max.`);
    if (exemple.length) { console.log(``); for (const l of exemple) console.log(l); }
    console.log(`\n  Un barreau 0 partout invaliderait le mécanisme supposé. Un barreau 1`);
    console.log(`  (« météo relâchée ») sur les catégories fautives le confirme.`);

    // ═══ 1 · AMPLEUR ET LEVIERS ══════════════════════════════════════════
    console.log(`\n════════ 1 · AMPLEUR, ET CE QUE CHAQUE LEVIER CHANGE ════════`);
    console.log(`  Mêmes graines, mêmes occasions, même pool ; seuls la journée et le bras varient.`);
    console.log(`  « hors max » compte les pièces portées au-dessus de leur borne haute — jamais`);
    console.log(`  compensables. « nue < min » exclut ce que le moteur a couvert d'une couche ou`);
    console.log(`  de collants. « cellules » est la contre-mesure : ce que le bras fait perdre.`);

    const CELLULES = STYLES_FEMME.length * OCCS.length;
    for (const j of JOURNEES) {
      const w = weatherForDay(j.temp, j.label, j.calendaire);
      console.log(`\n  ── calendrier ${j.calendaire}, ${j.temp}° ${j.label} ──`);
      console.log(`  ${"bras".padEnd(26)}${"capsule".padEnd(11)}${"tenues".padStart(8)}${"cellules".padStart(10)}${"hors max".padStart(10)}${"nue < min".padStart(11)}`);
      for (const bras of BRAS) {
        const saisonCapsule = bras.capsuleMeteo ? saisonCapsulePourMeteo(j.temp) : j.calendaire;
        let tenues = 0, cellules = 0, horsMax = 0, nue = 0;
        for (const style of STYLES_FEMME) {
          const capsule = capsulePour(style, saisonCapsule, j.temp, j.label);
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${style}|${occ}|${k}`));
              let ids: number[];
              try {
                // `regen` (store.tsx) ne transmet PAS de capsuleSeason : l'omettre
              // ici est ce qui rend ce bras fidèle à la production.
              ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme",
                  undefined, bras.leviers).ids;
              } finally { Math.random = vrai; }
              if (!ids.length) continue;
              couverte = true; tenues += 1;
              const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
              const aUneCouche = pieces.some((p) => p.cat === "pull" || p.cat === "veste" || p.cat === "manteau");
              const aDesCollants = pieces.some((p) => p.cat === "accessoire" && p.accessoireType === "Collants");
              for (const p of pieces) {
                if (p.meteoMaxTemp != null && j.temp > p.meteoMaxTemp) horsMax += 1;
                else if (p.meteoMinTemp != null && j.temp < p.meteoMinTemp
                  && !(aUneCouche || ((p.cat === "jupe" || p.cat === "robe") && aDesCollants))) nue += 1;
              }
            }
            if (couverte) cellules += 1;
          }
        }
        console.log(`  ${bras.nom.padEnd(26)}${saisonCapsule.padEnd(11)}${String(tenues).padStart(8)}${`${cellules}/${CELLULES}`.padStart(10)}${String(horsMax).padStart(10)}${String(nue).padStart(11)}`);
      }
    }

    console.log(`\n  LECTURE SEULE. Aucune règle modifiée, aucune donnée touchée.`);
  }, 900_000);
});
