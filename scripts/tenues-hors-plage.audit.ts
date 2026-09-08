import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { generateOutfitWithFallback, type TraceRepli } from "../src/lib/logic";
import { OCCASIONS } from "../src/lib/data";
import type { Weather } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// POURQUOI LES TENUES DEVIENNENT FAUSSES QUAND LA MÉTÉO S'ÉCARTE DE LA
// SAISON — DIAGNOSTIC, LECTURE SEULE.
//
// LE CONSTAT. La capsule est bâtie à la température REPRÉSENTATIVE de la
// saison, mais la tenue du jour est générée avec la météo RÉELLE. Mesuré sur
// 2 000 tenues par point : 115 pièces portées au-dessus de leur maximum par
// 20 °C en automne, 121 par 12 °C en hiver, 143 portées nues sous leur
// minimum par 10 °C au printemps. À la seule température de référence, ces
// compteurs sont à zéro — c'est pourquoi aucune mesure antérieure ne les
// avait vus, y compris les miennes.
//
// C'est la même famille que le signalement du 03/09 (« 27 °C et on me propose
// des pulls »), qu'on a soigné sur six pièces sans traiter la cause.
//
// CE SCRIPT NE PROPOSE RIEN. Il attribue. L'audit `pull-chaleur` a déjà
// montré qu'on peut se tromper de cause — le repli du moteur y était à ZÉRO
// là où je l'attendais, et tout venait des données. La même prudence
// s'applique : l'hypothèse « c'est le repli de poolFor » est testée, pas
// supposée.
//
// PREMIÈRE VERSION RETIRÉE, ET POURQUOI. Ce script attribuait d'abord en
// RECONSTITUANT à côté le pool qui « aurait dû » être éligible. Il ne
// reconstituait que le filtre de température, alors que l'échelle de
// `poolFor` filtre d'abord par occasion, formalité et style. Sa famille
// « choix malgré alternatives » comptait donc comme alternatives des pièces
// qui n'auraient passé aucun des autres filtres : 266 cas attribués à tort.
// C'est le défaut qui a produit trois conclusions fausses en phase 15.
//
// L'ATTRIBUTION VIENT MAINTENANT DE LA PRODUCTION ELLE-MÊME, via la trace
// `traceRepli` (07/09/2026), fidèle par construction. Elle rapporte, pour
// chaque appel de `poolFor`, le barreau retenu et l'effectif de CHAQUE
// barreau. Deux familles suffisent alors, et elles sont exactes :
//
//   · REPLI — le barreau retenu n'est pas le premier. Par construction de
//     `poolFor`, cela signifie que le premier était VIDE : le moteur n'avait
//     aucune alternative. La question devient « qu'est-ce qui l'a vidé ? »,
//     et l'écart entre les effectifs des barreaux y répond.
//   · EXEMPTION SANS COUCHE — barreau 0, donc la pièce a passé le filtre de
//     température, et elle est pourtant sous son min : ce ne peut être que
//     l'exemption TEMP_COMPENSATED_CATS. Elle suppose une couche par-dessus
//     et il n'y en a pas.
//
// Un troisième cas serait une INCOHÉRENCE DE CODE et est compté à part :
// une pièce au-dessus de son max au barreau 0. Le max n'est exempté nulle
// part ; si ce compteur n'est pas nul, c'est qu'une pièce entre dans la tenue
// sans passer par `poolFor`.
//
// SEGMENTATION. `generateOutfitWithFallback` appelle `generateOutfit`
// plusieurs fois — une par palier de formalité, et jusqu'à
// MAX_ATTEMPTS_PER_TIER par palier. Seules les traces du DERNIER tirage
// correspondent à la tenue rendue ; les autres viennent de tentatives
// abandonnées. Le script segmente donc sur le marqueur « début » et ne garde
// que le dernier segment.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const N = 25;
/** Recopié de logic.ts:630. Si cette liste y change, cette attribution ne vaut plus. */
const COMPENSEES: CategoryKey[] = ["haut", "pull", "robe", "combinaison", "jupe", "short"];
const COUCHES: CategoryKey[] = ["pull", "veste", "manteau"];

/** La plage réaliste de chaque saison — ce que la météo du jour peut valoir. */
const PLAGE: Record<CapsuleSeason, number[]> = {
  Printemps: [8, 10, 13, 16, 19, 22],
  "Été": [18, 21, 24, 27, 30],
  Automne: [6, 8, 11, 14, 17, 20],
  Hiver: [-2, 0, 3, 6, 9, 12],
};

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

const meteo = (temp: number, saison: CapsuleSeason): Weather =>
  ({ ...representativeWeatherFor(saison), temp }) as Weather;

/** Le filtre réel de la génération, recopié depuis logic.ts:631. */
const passeLeFiltre = (it: CatalogItem, temp: number): boolean => {
  if (it.meteoMinTemp != null && temp < it.meteoMinTemp && !COMPENSEES.includes(it.cat)) return false;
  if (it.meteoMaxTemp != null && temp > it.meteoMaxTemp) return false;
  return true;
};

type Famille = "repli" | "exemption sans couche" | "INCOHÉRENCE — hors max sans repli";

describe("les tenues hors de la plage de leur saison", () => {
  it("attribue chaque pièce hors plage à un mécanisme, sans en supposer aucun", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    const index = new Map(pool.map((it) => [it.id, it]));
    console.log(`Catalogue : ${pool.length} pièces. Capsules bâties comme en production, tenues générées sur la plage réelle.`);

    const parFamille = new Map<Famille, number>();
    const parCategorie = new Map<CategoryKey, Map<Famille, number>>();
    const parPiece = new Map<number, number>();
    const coucheDispo = { oui: 0, non: 0 };
    /**
     * La même question, mais DÉMONTRÉE par la trace au lieu d'être
     * reconstituée. Limite assumée et mesurée : la trace ne voit que les
     * couches qui passent par `poolFor`, c'est-à-dire veste et manteau. Le
     * pull posé en calque est filtré directement sur `hardBase` et n'émet
     * aucune trace — les tirages où le moteur n'a pas demandé de couche
     * extérieure sont donc comptés « non observable » plutôt que rangés
     * d'office d'un côté ou de l'autre.
     */
    const coucheTracee = { disponible: 0, indisponible: 0, nonObservable: 0 };
    /**
     * R-B19 (logic.ts) : une jupe ou une robe retenue sous son propre
     * meteo_min_temp déclenche une recherche DÉDIÉE de collants, en dehors de
     * `poolFor`. Des collants sont donc, pour ces deux catégories seulement,
     * la couche que le moteur prévoit — les compter comme « nu sous son min »
     * revenait à déclarer fautives des tenues que le moteur avait compensées.
     * Corrigé ici ; ce compteur mesure exactement ce que la version
     * précédente de cet audit surestimait.
     */
    let collantsR19 = 0;
    const barreaux = new Map<string, number>();
    const videurs = new Map<string, number>();
    let tenuesTotal = 0, tenuesFautives = 0;
    const exemples: string[] = [];
    const rngEx = mulberry32(grainePour("echantillon-hors-plage"));
    let vusPourEx = 0;

    console.log(`\n════════ 1 · OÙ ET COMBIEN ════════`);
    console.log(`  ${"saison".padEnd(12)}${"temp".padStart(6)}${"tenues".padStart(9)}${"fautives".padStart(10)}${"taux".padStart(8)}${"au-dessus max".padStart(15)}${"nu sous min".padStart(13)}`);
    for (const saison of CAPSULE_SEASONS) {
      const capsules = STYLES_FEMME.map((style) => ({
        style,
        capsule: computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), representativeWeatherFor(saison), [], saison, pool),
      }));
      for (const temp of PLAGE[saison]) {
        const w = meteo(temp, saison);
        let tenues = 0, fautives = 0, surMax = 0, sousMinNu = 0;
        for (const { style, capsule } of capsules) {
          // Une couche était-elle seulement disponible dans la capsule à cette
          // température ? Sert au seul cas « exemption sans couche ».
          const coucheEligible = capsule.some((it) => COUCHES.includes(it.cat) && passeLeFiltre(it, temp));

          for (const occ of OCCS) {
            for (let k = 0; k < N; k++) {
              const vrai = Math.random;
              Math.random = mulberry32(grainePour(`${saison}|${style}|${occ}|${k}|${temp}`));
              let ids: number[];
              const brutes: TraceRepli[] = [];
              try {
                ids = generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison, {
                  traceRepli: (e) => brutes.push(e),
                }).ids;
              } finally { Math.random = vrai; }
              // Seul le dernier tirage a produit la tenue rendue.
              const dernier = brutes.map((e) => e.type).lastIndexOf("début");
              const tracesDuTirage = brutes.slice(dernier + 1);
              /** Le barreau retenu pour une catégorie, et l'échelle qui l'a produit. */
              const replisPar = new Map<CategoryKey, TraceRepli>();
              for (const e of tracesDuTirage) for (const c of e.cats) replisPar.set(c, e);
              // Ce que la trace sait d'une couche EXTÉRIEURE sur ce tirage.
              const tracesCouche = tracesDuTirage.filter((e) => e.cats.some((c) => c === "veste" || c === "manteau"));
              const coucheVerdict: "disponible" | "indisponible" | "nonObservable" =
                !tracesCouche.length ? "nonObservable"
                : tracesCouche.some((e) => e.barreau === 0 && (e.effectifs[0] ?? 0) > 0) ? "disponible"
                : "indisponible";
              if (!ids.length) continue;
              tenues += 1; tenuesTotal += 1;
              const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
              const aUneCouche = pieces.some((p) => COUCHES.includes(p.cat));
              const aDesCollants = pieces.some((p) => p.cat === "accessoire" && p.accessoireType === "Collants");
              // Une jupe/robe sous son min que le moteur a couverte de
              // collants (R-B19) n'est pas nue : elle est compensée.
              const compensee = (p: CatalogItem) =>
                aUneCouche || ((p.cat === "jupe" || p.cat === "robe") && aDesCollants);
              let fautive = false;
              for (const p of pieces) {
                const tropChaud = p.meteoMaxTemp != null && temp > p.meteoMaxTemp;
                const tropFroid = p.meteoMinTemp != null && temp < p.meteoMinTemp;
                if (tropFroid && !aUneCouche && compensee(p)) collantsR19 += 1;
                if (!tropChaud && !(tropFroid && !compensee(p))) continue;
                fautive = true;
                const trace = replisPar.get(p.cat);
                const aReplie = trace != null && trace.barreau !== 0;
                let fam: Famille;
                if (tropChaud) {
                  // Le max n'est exempté nulle part. Sans repli, la pièce
                  // n'aurait pas dû franchir applyTempFilter.
                  fam = aReplie ? "repli" : "INCOHÉRENCE — hors max sans repli";
                  surMax += 1;
                } else {
                  fam = aReplie ? "repli" : "exemption sans couche";
                  sousMinNu += 1;
                  if (fam === "exemption sans couche") {
                    if (coucheEligible) coucheDispo.oui += 1; else coucheDispo.non += 1;
                    coucheTracee[coucheVerdict] += 1;
                  }
                }
                if (aReplie && trace) {
                  barreaux.set(trace.nom, (barreaux.get(trace.nom) ?? 0) + 1);
                  // Ce qui a vidé le premier barreau : si le suivant est
                  // fourni, c'est la météo ; s'il est vide aussi, c'est plus
                  // en amont — occasion, formalité ou style.
                  const videPar = (trace.effectifs[1] ?? 0) > 0 ? "la météo" : "occasion / formalité / style";
                  videurs.set(videPar, (videurs.get(videPar) ?? 0) + 1);
                }
                parFamille.set(fam, (parFamille.get(fam) ?? 0) + 1);
                const m = parCategorie.get(p.cat) ?? new Map<Famille, number>();
                m.set(fam, (m.get(fam) ?? 0) + 1);
                parCategorie.set(p.cat, m);
                parPiece.set(p.id, (parPiece.get(p.id) ?? 0) + 1);

                // Échantillon par réservoir uniforme — ni les pires ni les plus commodes.
                vusPourEx += 1;
                const texte = `${saison} ${temp}° · ${style}/${occ} — ${p.name} [${p.meteoMinTemp ?? "—"}, ${p.meteoMaxTemp ?? "—"}] · ${fam}\n            tenue : ${pieces.map((x) => x.name).join(" + ")}`;
                if (exemples.length < 12) exemples.push(texte);
                else { const j = Math.floor(rngEx() * vusPourEx); if (j < 12) exemples[j] = texte; }
              }
              if (fautive) { fautives += 1; tenuesFautives += 1; }
            }
          }
        }
        const ref = representativeWeatherFor(saison).temp === temp ? "  <- référence" : "";
        console.log(`  ${saison.padEnd(12)}${(temp + "°").padStart(6)}${String(tenues).padStart(9)}${String(fautives).padStart(10)}${((fautives / tenues) * 100).toFixed(1).padStart(7)}%${String(surMax).padStart(15)}${String(sousMinNu).padStart(13)}${ref}`);
      }
    }

    // ═══ 2 · PAR QUEL MÉCANISME ═════════════════════════════════════════
    console.log(`\n════════ 2 · ATTRIBUTION — PAR QUEL CHEMIN CES PIÈCES ARRIVENT ════════`);
    const total = [...parFamille.values()].reduce((a, b) => a + b, 0);
    console.log(`  ${tenuesFautives} tenues fautives sur ${tenuesTotal} (${((tenuesFautives / tenuesTotal) * 100).toFixed(1)} %), ${total} occurrences.`);
    for (const fam of ["repli", "exemption sans couche", "INCOHÉRENCE — hors max sans repli"] as Famille[]) {
      const n = parFamille.get(fam) ?? 0;
      console.log(`  ${String(n).padStart(6)}  ${((n / total) * 100).toFixed(1).padStart(5)} %  ${fam}`);
    }
    console.log(`\n  Pour les « exemption sans couche » : une couche était-elle disponible ?`);
    console.log(`\n  a) RECONSTITUÉ par ce script, sur le seul filtre de température —`);
    console.log(`     à ne pas confondre avec une démonstration, c'est le type d'approximation`);
    console.log(`     qui a rendu fausse la première version de cet audit :`);
    console.log(`        couche température-éligible : ${coucheDispo.oui}   aucune : ${coucheDispo.non}`);
    console.log(`\n  b) DÉMONTRÉ par la trace, tous filtres compris (saison, occasion, formalité,`);
    console.log(`     style, météo). La trace ne voit que veste et manteau : le pull posé en`);
    console.log(`     calque est filtré hors de poolFor et n'émet rien.`);
    console.log(`        couche extérieure DISPONIBLE et non utilisée : ${coucheTracee.disponible}`);
    console.log(`        couche extérieure INDISPONIBLE ............. : ${coucheTracee.indisponible}`);
    console.log(`        aucun appel poolFor(veste|manteau) sur ce tirage : ${coucheTracee.nonObservable}`);
    console.log(`\n     La troisième ligne ne dit PAS que le moteur a renoncé à une couche : les`);
    console.log(`     deux compensations thermiques (R-B18 haut sous son min, R-B19 collants)`);
    console.log(`     tirent hors de poolFor et n'émettent aucune trace. Elle dit seulement`);
    console.log(`     que la question ne s'est pas posée par ce chemin-là.`);
    console.log(`\n     Seule la première ligne est corrigeable dans la génération sans toucher`);
    console.log(`     aux données ni à la capsule.`);
    console.log(`\n  c) Jupes/robes sous leur min que R-B19 avait déjà couvertes de collants,`);
    console.log(`     comptées à tort « nu sous son min » par la version précédente : ${collantsR19}`);

    console.log(`\n  Quel barreau a été retenu, et qu'est-ce qui avait vidé le premier :`);
    for (const [nom, n] of [...barreaux.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(5)}  barreau « ${nom} »`);
    for (const [nom, n] of [...videurs.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(5)}  premier barreau vidé par ${nom}`);

    console.log(`\n  Par catégorie :`);
    console.log(`  ${"cat".padEnd(13)}${"repli".padStart(13)}${"exempt. nue".padStart(13)}${"INCOHÉRENCE".padStart(14)}`);
    for (const [cat, m] of [...parCategorie.entries()].sort((a, b) => {
      const s = (x: Map<Famille, number>) => [...x.values()].reduce((p, q) => p + q, 0);
      return s(b[1]) - s(a[1]);
    })) {
      console.log(`  ${cat.padEnd(13)}${String(m.get("repli") ?? 0).padStart(13)}${String(m.get("exemption sans couche") ?? 0).padStart(13)}${String(m.get("INCOHÉRENCE — hors max sans repli") ?? 0).padStart(14)}`);
    }

    console.log(`\n  Les 15 pièces les plus souvent hors plage :`);
    for (const [id, n] of [...parPiece.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      const it = index.get(id)!;
      console.log(`     ${String(n).padStart(5)}×  ${it.cat.padEnd(11)}[${it.meteoMinTemp ?? "—"}, ${it.meteoMaxTemp ?? "—"}]`.padEnd(40) + it.name);
    }

    console.log(`\n════════ 3 · ÉCHANTILLON BRUT, TIRÉ PAR RÉSERVOIR ════════`);
    console.log(`  Ni les pires ni les plus commodes : tirage uniforme et semé.`);
    for (const e of exemples) console.log(`     ${e}`);

    console.log(`\n  LECTURE SEULE. Aucun correctif appliqué, aucune donnée modifiée.`);
    console.log(`  Ce script ne dit pas quoi corriger : il dit par quel chemin le défaut passe.`);
  }, 900_000);
});
