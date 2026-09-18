import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import {
  CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor,
  saisonCapsulePourMeteo, weatherForDay, STRATEGIE_PRODUCTION, type SelectionStrategy,
} from "../src/lib/capsule";
import { generateOutfitWithFallback } from "../src/lib/logic";
import { composeWardrobePool } from "../src/lib/selectors";
import { CATS, OCCASIONS } from "../src/lib/data";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey, Item, OccasionKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// LE RÉGLAGE DES QUATRE TEMPÉRATURES — SES DEUX USAGES, DANS LA MÊME EXÉCUTION.
// LECTURE SEULE.
//
// CE QUI CONDUIT ICI, ET C'EST UN AVEU. Le réglage « Printemps 14 · Été 24 ·
// Automne 12 · Hiver 5 » a été mesuré le 14/09 sur UN SEUL usage : la
// composition des capsules. Il a été présenté comme « retenable » sur cette
// base. Or depuis le correctif du 15/09, ces quatre nombres ont un SECOND
// usage, qui n'existait pas quand la mesure a été prise :
// `saisonCapsulePourMeteo` choisit le vivier de la tenue du jour en prenant la
// saison dont la température représentative est la plus proche du thermomètre.
// Les quatre valeurs découpent donc implicitement l'axe des températures à
// mi-chemin entre elles, et changer le réglage DÉPLACE CES FRONTIÈRES.
//
// Le point 8 de la règle d'audit l'impose : une mesure nouvelle susceptible
// d'invalider une conclusion oblige à rouvrir cette conclusion avant toute
// écriture. Le point 4 interdit d'extrapoler d'un scénario à l'autre — ce qui
// est bon pour la composition des capsules ne dit rien du choix de la saison
// du jour. Ce script mesure donc les deux, sur le même pool, dans la même
// exécution, en ne faisant varier que le réglage.
//
// LES DEUX USAGES NE S'APPELLENT PAS DE LA MÊME FAÇON, et c'est délibéré :
//
//   · USAGE A — l'écran Capsule. Il reste CALENDAIRE (arbitrage du 15/09) : la
//     capsule Automne est bâtie pour l'automne, à sa température
//     représentative, quel que soit le thermomètre. C'est le référentiel
//     saisonnier qui prime, donc `capsuleSeason` est transmis au moteur,
//     exactement comme le fait `looks.ts`.
//
//   · USAGE B — la tenue du jour. `regen` (store.tsx) ne transmet PAS
//     `capsuleSeason` et compose son pool par occasion via
//     `composeWardrobePool`. Le reproduire autrement mesurerait une variante
//     plus stricte que la production — l'erreur commise le 14/09, rattrapée
//     avant publication. Le vivier vient de `saisonCapsulePourMeteo`, la
//     capsule est filtrée sur la représentative de CETTE saison, puis le
//     moteur applique la température RÉELLE.
//
// Le réglage pèse donc deux fois sur l'usage B : sur le choix de la saison, et
// sur le filtre de composition de la capsule choisie.
//
// CE QUE CE SCRIPT NE MESURE PAS. Il ne rouvre pas la grille complète des
// combinaisons — `temperatures-representatives` (14/09) l'a déjà balayée pour
// l'usage A. Il oppose deux réglages COMPLETS, parce que la question posée est
// binaire : garde-t-on la production, ou bascule-t-on sur le réglage mesuré.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié. Les deux
// coutures employées (`SelectionStrategy.tempRepresentative`,
// `saisonCapsulePourMeteo(temp, réglage)`) sont facultatives : omises, elles
// reproduisent exactement la production.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const OCCS: OccasionKey[] = OCCASIONS.map(([k]) => k);
const CAT_KEYS = CATS.map(([k]) => k) as CategoryKey[];
/** Tirages par cellule. Plus bas que les 40 de l'audit du 14/09 : l'usage B balaie 16 températures. */
const N = 15;
/**
 * Le balayage de l'usage B — des journées d'hiver aux canicules, AU DEGRÉ.
 *
 * Le pas de 2° du premier jet suffisait à voir les frontières bouger, mais pas
 * à soutenir la conclusion qui compte : « aucune température ne se dégrade ».
 * Une grille à trous ne peut pas démontrer une absence — elle démontre au
 * mieux l'absence sur ses propres points. Le pas de 1° coûte neuf secondes de
 * plus et rend l'affirmation défendable.
 */
const TEMPERATURES = Array.from({ length: 35 }, (_, i) => i);

/** Copie de logic.ts:684 — les catégories dont la génération ignore le `min`. */
const EXEMPTEES: CategoryKey[] = ["haut", "pull", "robe", "combinaison", "jupe", "short"];
/** Copie de tenues-hors-plage — ce qui compense une pièce portée sous son min. */
const COUCHES: CategoryKey[] = ["pull", "veste", "manteau"];

type Reglage = Record<CapsuleSeason, number>;
interface Bras {
  nom: string;
  reglage: Reglage;
}

/**
 * Les bras. Le premier EST la production — il n'est pas une reconstitution.
 *
 * Les deux derniers sont apparus APRÈS la première exécution, et il faut dire
 * pourquoi plutôt que de les présenter comme prévus. Le balayage au degré a
 * montré que « mesuré 14/09 » se dégrade à 9° et nulle part ailleurs : la
 * frontière Automne/Hiver, à mi-chemin des deux représentatives, descend de
 * 10° (entre 14 et 6) à 8,5° (entre 12 et 5). Une journée à 9° reçoit donc un
 * vivier d'automne là où elle recevait un vivier d'hiver, et l'automne est
 * trop léger pour 9°.
 *
 * Deux réparations minimales existent, et une seule frontière les sépare :
 * remonter l'Hiver, ou remonter l'Automne. Elles sont mesurées plutôt que
 * choisies — c'est la seule façon de savoir laquelle coûte le gain obtenu sur
 * l'usage A.
 */
const BRAS: Bras[] = [
  { nom: "production", reglage: { Printemps: 16, Été: 24, Automne: 14, Hiver: 6 } },
  { nom: "mesuré 14/09", reglage: { Printemps: 14, Été: 24, Automne: 12, Hiver: 5 } },
  { nom: "Hiver 7", reglage: { Printemps: 14, Été: 24, Automne: 12, Hiver: 7 } },
  { nom: "Automne 13", reglage: { Printemps: 14, Été: 24, Automne: 13, Hiver: 6 } },
];

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

function saisonsDeclarees(raw: string | null): CapsuleSeason[] {
  const jetons = (raw ?? "").split(/[,;|]/).map((s) => sansAccents(s)).filter(Boolean);
  return CAPSULE_SEASONS.filter((s) => jetons.includes(sansAccents(s)));
}

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

describe("réglage des températures représentatives — ses deux usages", () => {
  it("mesure la composition des capsules ET le choix de la saison du jour, même pool, même exécution", async () => {
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
    const declarees = new Map(pool.map((it) => [it.id, saisonsDeclarees(ligne.get(it.id)?.saison_capsule ?? null)]));

    console.log(`Catalogue : ${pool.length} pièces.`);
    console.log(`CONFIGURATION GELÉE : profils d'audit, ${STYLES_FEMME.length} styles femme, ${OCCS.length} occasions, ${N} tirages, graines déterministes.`);
    console.log(`Levier unique : le réglage des quatre températures. Rien d'autre ne varie entre les bras.`);
    for (const b of BRAS) {
      console.log(`  ${b.nom.padEnd(14)} ${CAPSULE_SEASONS.map((s) => `${s} ${b.reglage[s]}°`).join("  ·  ")}`);
    }

    const strategiePour = (r: Reglage): SelectionStrategy => ({ ...STRATEGIE_PRODUCTION, tempRepresentative: r });

    /**
     * Compte les pièces hors plage d'une tenue. Une pièce au-dessus de son max
     * est une faute sèche ; sous son min, elle ne l'est que si rien ne la
     * compense (couche, ou collants sur jupe/robe — R-B19).
     */
    const horsPlage = (ids: number[], t: number): { max: number; nue: number } => {
      const pieces = ids.map((id) => index.get(id)).filter((p): p is CatalogItem => Boolean(p));
      const aUneCouche = pieces.some((p) => COUCHES.includes(p.cat));
      const aDesCollants = pieces.some((p) => p.cat === "accessoire" && p.accessoireType === "Collants");
      let max = 0, nue = 0;
      for (const p of pieces) {
        if (p.meteoMaxTemp != null && t > p.meteoMaxTemp) max += 1;
        else if (p.meteoMinTemp != null && t < p.meteoMinTemp && !(aUneCouche || ((p.cat === "jupe" || p.cat === "robe") && aDesCollants))) nue += 1;
      }
      return { max, nue };
    };

    /** Exécute une génération sous graine, sans laisser `Math.random` détourné. */
    const tirage = (fn: () => number[], cle: string): number[] => {
      const vrai = Math.random;
      Math.random = mulberry32(grainePour(cle));
      try { return fn(); } finally { Math.random = vrai; }
    };

    // ═══ 0 · OÙ LE RÉGLAGE DÉPLACE LES FRONTIÈRES ════════════════════════
    console.log(`\n════════ 0 · LA CARTE DES SAISONS — CE QUE CHANGE LE RÉGLAGE ════════`);
    console.log(`  Saison du vivier de la tenue du jour, par température réelle.`);
    console.log(`  C'est l'usage qui n'existait pas quand le réglage a été mesuré.`);
    // Rendu par PLAGES et non ligne à ligne : au pas de 1° sur 35 points, la
    // liste exhaustive noie ce qu'on cherche, qui est l'emplacement des
    // frontières.
    const plages = (r: Reglage): string => {
      const out: string[] = [];
      let debut = TEMPERATURES[0], courante = saisonCapsulePourMeteo(debut, r);
      for (const t of TEMPERATURES.slice(1)) {
        const s = saisonCapsulePourMeteo(t, r);
        if (s === courante) continue;
        out.push(`${courante} ${debut}–${t - 1}°`);
        debut = t; courante = s;
      }
      out.push(`${courante} ${debut}–${TEMPERATURES[TEMPERATURES.length - 1]}°`);
      return out.join("  |  ");
    };
    for (const b of BRAS) console.log(`  ${b.nom.padEnd(14)} ${plages(b.reglage)}`);
    const bascules: { t: number; de: CapsuleSeason; vers: CapsuleSeason }[] = [];
    for (const t of TEMPERATURES) {
      const choix = BRAS.map((b) => saisonCapsulePourMeteo(t, b.reglage));
      if (new Set(choix).size > 1) bascules.push({ t, de: choix[0], vers: choix[1] });
    }
    console.log(`\n  ${bascules.length} température(s) sur ${TEMPERATURES.length} changent de vivier : ${bascules.map((b) => `${b.t}° ${b.de}→${b.vers}`).join(", ") || "aucune"}.`);

    // ═══ 1 · USAGE A — COMPOSITION DES CAPSULES (ÉCRAN CAPSULE) ══════════
    console.log(`\n════════ 1 · USAGE A — COMPOSITION DES CAPSULES, CALENDAIRE ════════`);
    console.log(`  Chaque capsule est bâtie pour SA saison, à la représentative du bras.`);
    console.log(`  Une exclusion est DÉMONTRÉE quand la pièce déclare la saison, n'entre dans`);
    console.log(`  aucune des ${STYLES_FEMME.length} capsules, et y entre dès que ses SEULES bornes sont neutralisées.`);
    console.log(`  « nue < min » exclut ce que le moteur a compensé.`);

    /** exclusions[bras][saison] = ids exclus par la borne, démontré par contrefactuel. */
    const exclusions = new Map<string, Set<number>>();
    console.log(`\n  ${"bras".padEnd(14)}${"saison".padEnd(11)}${"t".padStart(4)}${"capsules".padStart(10)}${"DÉMONTRÉES".padStart(12)}${"cellules".padStart(10)}${"hors max".padStart(10)}${"nue < min".padStart(11)}`);
    const totalA = new Map<string, { demo: number; cellules: number; max: number; nue: number }>();
    for (const bras of BRAS) {
      let demoTot = 0, cellTot = 0, maxTot = 0, nueTot = 0;
      for (const saison of CAPSULE_SEASONS) {
        const t = bras.reglage[saison];
        const w = representativeWeatherFor(saison, t);
        const strategie = strategiePour(bras.reglage);
        const capsules = new Map(STYLES_FEMME.map((st) =>
          [st, computeDefaultCapsule(profilAudit({ gender: "femme", styles: [st] }), w, [], saison, pool, strategie)]));
        const ids = new Map([...capsules].map(([st, c]) => [st, new Set(c.map((x) => x.id))]));
        const taille = [...ids.values()].reduce((a, s) => a + s.size, 0);

        // Exclusions démontrées par contrefactuel — bornes neutralisées sur la seule pièce testée.
        const candidates = pool.filter((it) => {
          if (!(declarees.get(it.id) ?? []).includes(saison)) return false;
          const r = ligne.get(it.id);
          if (!r) return false;
          const horsMax = r.meteo_max_temp != null && t > r.meteo_max_temp;
          const horsMin = !horsMax && r.meteo_min_temp != null && t < r.meteo_min_temp;
          if (!horsMax && !horsMin) return false;
          return horsMax || !EXEMPTEES.includes(it.cat);
        });
        const demo = new Set<number>();
        for (const it of candidates) {
          if (STYLES_FEMME.some((st) => ids.get(st)!.has(it.id))) continue;
          const contrefactuel = pool.map((x) => x.id === it.id ? { ...x, meteoMinTemp: undefined, meteoMaxTemp: undefined } : x);
          const entre = STYLES_FEMME.some((st) =>
            computeDefaultCapsule(profilAudit({ gender: "femme", styles: [st] }), w, [], saison, contrefactuel, strategie)
              .some((x) => x.id === it.id));
          if (entre) demo.add(it.id);
        }
        exclusions.set(`${bras.nom}|${saison}`, demo);

        // Tenues produites à cette représentative. `capsuleSeason` transmis :
        // c'est l'appel de l'écran Capsule (cf. looks.ts), pas celui de regen.
        let cellules = 0, horsMaxN = 0, nueN = 0;
        for (const st of STYLES_FEMME) {
          const capsule = capsules.get(st)!;
          for (const occ of OCCS) {
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const out = tirage(() => generateOutfitWithFallback(capsule, w, occ, "Présentiel", "Verre", [], "femme", saison).ids, `${st}|${occ}|${k}`);
              if (!out.length) continue;
              couverte = true;
              const hp = horsPlage(out, t);
              horsMaxN += hp.max; nueN += hp.nue;
            }
            if (couverte) cellules += 1;
          }
        }
        demoTot += demo.size; cellTot += cellules; maxTot += horsMaxN; nueTot += nueN;
        console.log(`  ${(saison === CAPSULE_SEASONS[0] ? bras.nom : "").padEnd(14)}${saison.padEnd(11)}${String(t).padStart(3)}°${String(taille).padStart(10)}${String(demo.size).padStart(12)}${`${cellules}/${STYLES_FEMME.length * OCCS.length}`.padStart(10)}${String(horsMaxN).padStart(10)}${String(nueN).padStart(11)}`);
      }
      totalA.set(bras.nom, { demo: demoTot, cellules: cellTot, max: maxTot, nue: nueTot });
    }

    console.log(`\n  Pièces MORTES — exclues de TOUTES les saisons qu'elles déclarent :`);
    const morts = (nom: string): number[] =>
      pool.filter((it) => {
        const d = declarees.get(it.id) ?? [];
        return d.length > 0 && d.every((s) => exclusions.get(`${nom}|${s}`)!.has(it.id));
      }).map((it) => it.id);
    for (const bras of BRAS) {
      const m = morts(bras.nom);
      console.log(`     ${bras.nom.padEnd(14)} ${String(m.length).padStart(3)} morte(s)`);
      for (const id of m) {
        const r = ligne.get(id)!;
        console.log(`        réf ${String(r.id).padStart(5)}  ${(declarees.get(id) ?? []).join("+").padEnd(28)}min ${String(r.meteo_min_temp ?? "—").padStart(4)}  max ${String(r.meteo_max_temp ?? "—").padStart(4)}  ${index.get(id)!.name}`);
      }
    }

    // ═══ 2 · USAGE B — LA TENUE DU JOUR ══════════════════════════════════
    console.log(`\n════════ 2 · USAGE B — LA TENUE DU JOUR, SUR TOUT LE THERMOMÈTRE ════════`);
    console.log(`  Reproduit regen (store.tsx) : saison choisie par saisonCapsulePourMeteo,`);
    console.log(`  capsule composée pour CETTE saison, pool complété par occasion, et le`);
    console.log(`  moteur appelé SANS capsuleSeason — comme la production, pas plus strict.`);
    console.log(`  La météo du jour est celle de weatherForDay, saison calendaire = la saison choisie.`);
    console.log(`  Seules les températures où quelque chose n'est pas nul ou diffère entre les`);
    console.log(`  bras sont détaillées ; les totaux ci-dessous portent sur les ${TEMPERATURES.length} températures.`);
    console.log(`\n  ${"t".padStart(5)}${BRAS.map((b) => `${b.nom} cell.`.padStart(20) + "max".padStart(7) + "nue".padStart(6)).join("")}`);

    const totalB = new Map<string, { cellules: number; max: number; nue: number; tenues: number }>();
    for (const b of BRAS) totalB.set(b.nom, { cellules: 0, max: 0, nue: 0, tenues: 0 });
    const parTemp = new Map<number, Map<string, { cellules: number; max: number; nue: number }>>();

    for (const t of TEMPERATURES) {
      const ligneT = new Map<string, { cellules: number; max: number; nue: number }>();
      for (const bras of BRAS) {
        const saison = saisonCapsulePourMeteo(t, bras.reglage);
        const w = weatherForDay(t, t >= 22 ? "Ensoleillé" : "Nuageux", saison);
        const strategie = strategiePour(bras.reglage);
        let cellules = 0, horsMaxN = 0, nueN = 0;
        for (const st of STYLES_FEMME) {
          // Dressing vide : le pool de départ EST la capsule, comme pour une
          // utilisatrice qui n'a rien saisi — le cas de la capture du 15/09.
          const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [st] }), w, [], saison, pool, strategie) as Item[];
          for (const occ of OCCS) {
            const poolOcc = composeWardrobePool(capsule, capsule, CAT_KEYS, { completerPourOccasion: occ });
            let couverte = false;
            for (let k = 0; k < N; k++) {
              const out = tirage(() => generateOutfitWithFallback(poolOcc, w, occ, "Présentiel", "Verre", [], "femme").ids, `${st}|${occ}|${k}`);
              if (!out.length) continue;
              couverte = true;
              const hp = horsPlage(out, t);
              horsMaxN += hp.max; nueN += hp.nue;
              totalB.get(bras.nom)!.tenues += 1;
            }
            if (couverte) cellules += 1;
          }
        }
        ligneT.set(bras.nom, { cellules, max: horsMaxN, nue: nueN });
        const tot = totalB.get(bras.nom)!;
        tot.cellules += cellules; tot.max += horsMaxN; tot.nue += nueN;
      }
      parTemp.set(t, ligneT);
      const valeurs = BRAS.map((b) => ligneT.get(b.nom)!);
      const plein = STYLES_FEMME.length * OCCS.length;
      const digneDInteret =
        valeurs.some((v) => v.max > 0 || v.nue > 0 || v.cellules < plein) ||
        new Set(valeurs.map((v) => `${v.cellules}|${v.max}|${v.nue}`)).size > 1;
      if (digneDInteret) {
        console.log(`  ${String(t).padStart(4)}°` + valeurs.map((v) =>
          `${v.cellules}/${plein}`.padStart(20) + String(v.max).padStart(7) + String(v.nue).padStart(6)).join(""));
      }
    }

    // ═══ 3 · LES DEUX USAGES CÔTE À CÔTE ═════════════════════════════════
    console.log(`\n════════ 3 · VERDICT — LES DEUX USAGES, MÊME EXÉCUTION ════════`);
    const prod = BRAS[0];
    const col = (s: string) => s.padStart(15);
    console.log(`\n  USAGE A — écran Capsule (calendaire)`);
    console.log(`  ${"".padEnd(24)}${BRAS.map((b) => col(b.nom)).join("")}`);
    const ligneA = (titre: string, valeur: (nom: string) => number) =>
      console.log(`  ${titre.padEnd(24)}${BRAS.map((b) => col(String(valeur(b.nom)))).join("")}`);
    ligneA("exclusions démontrées", (n) => totalA.get(n)!.demo);
    ligneA("pièces mortes", (n) => morts(n).length);
    ligneA("cellules couvertes", (n) => totalA.get(n)!.cellules);
    ligneA("pièces hors max", (n) => totalA.get(n)!.max);
    ligneA("pièces nues < min", (n) => totalA.get(n)!.nue);

    console.log(`\n  USAGE B — tenue du jour (${TEMPERATURES.length} températures)`);
    console.log(`  ${"".padEnd(24)}${BRAS.map((b) => col(b.nom)).join("")}`);
    const ligneB = (titre: string, valeur: (nom: string) => number) =>
      console.log(`  ${titre.padEnd(24)}${BRAS.map((b) => col(String(valeur(b.nom)))).join("")}`);
    ligneB("cellules couvertes", (n) => totalB.get(n)!.cellules);
    ligneB("tenues produites", (n) => totalB.get(n)!.tenues);
    ligneB("pièces hors max", (n) => totalB.get(n)!.max);
    ligneB("pièces nues < min", (n) => totalB.get(n)!.nue);

    // Le critère qui a fait tomber « mesuré 14/09 » : un total global meilleur
    // ne rachète pas une température où l'utilisatrice reçoit une tenue trop
    // légère. Chaque bras est donc confronté à la production, degré par degré.
    console.log(`\n  Températures où l'usage B SE DÉGRADE par rapport à la production :`);
    for (const bras of BRAS.slice(1)) {
      const pires: string[] = [];
      for (const t of TEMPERATURES) {
        const v0 = parTemp.get(t)!.get(prod.nom)!, v1 = parTemp.get(t)!.get(bras.nom)!;
        if (v1.cellules < v0.cellules || v1.max > v0.max || v1.nue > v0.nue) {
          pires.push(`${t}° (cell. ${v0.cellules}→${v1.cellules}, max ${v0.max}→${v1.max}, nue ${v0.nue}→${v1.nue})`);
        }
      }
      console.log(`     ${bras.nom.padEnd(14)} ${pires.length ? pires.join("  ·  ") : "aucune."}`);
    }

    console.log(`\n  LECTURE SEULE. Aucune température changée, aucune donnée touchée.`);
    console.log(`  Ce script MESURE, il ne tranche pas : un réglage qui gagne sur un usage et`);
    console.log(`  perd sur l'autre appelle un arbitrage éditorial, pas une conclusion d'audit.`);
  }, 1_800_000);
});
