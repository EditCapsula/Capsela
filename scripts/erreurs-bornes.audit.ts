import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, VESTIAIRE_ID_OFFSET, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, CategoryKey } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// QUELLES LIGNES DE `coherence-bornes` SONT DES ERREURS DE DONNÉES ?
// LECTURE SEULE.
//
// CE QUI CONDUIT ICI. `coherence-bornes` rend 144 couples pièce × saison
// déclarée où une borne contredit la déclaration. Ce nombre a servi jusqu'ici
// de population indistincte, alors qu'il mélange DEUX choses qui n'appellent
// pas la même décision :
//
//   1. Les artefacts de l'exemption de min. logic.ts:684 ignore `min` pour
//      [haut, pull, robe, combinaison, jupe, short] — une chemise `min 20`
//      se porte en hiver SOUS un pull, et la génération le sait.
//      capsule.ts:516 applique `min` à TOUTES les catégories, sans exemption.
//      Ces couples ne sont pas des erreurs de saisie : ils sont le symptôme
//      d'un écart entre deux fichiers, déjà mesuré le 04/09 (bras D, REFUSÉ :
//      371 tenues sous le min sans couche) et rouvert par `capsule-appartenance`.
//      RIEN n'est proposé ici pour eux.
//
//   2. Ce qu'aucun mécanisme ne rattrape. Le `max` n'a d'exemption NULLE PART
//      — ni dans la capsule, ni à la génération. Et le `min` sur une catégorie
//      NON exemptée (chaussures, accessoire, veste, manteau) est dur des deux
//      côtés. Pour ces couples, la borne et la saison déclarée se contredisent
//      sans recours : l'un des deux champs est faux.
//
// CE QUE MESURE CE SCRIPT, en une seule exécution et sur le même pool.
// Pour chaque couple de la classe 2, un CONTREFACTUEL à une seule pièce : le
// pool est reconstruit avec les bornes de CETTE pièce seule neutralisées, et
// la capsule de la saison déclarée est recalculée pour les huit styles. Si la
// pièce entre alors qu'elle n'entrait pas, la borne est bien ce qui l'exclut —
// DÉMONTRÉ. Si elle n'entre toujours pas, autre chose l'exclut déjà (style,
// quota, plafond) et corriger la borne ne rendrait rien — la distinction
// compte, parce qu'une correction sans effet mesuré n'est pas une correction.
//
// Le contrefactuel neutralise les DEUX bornes de la pièce visée plutôt que la
// seule borne fautive : la pièce ne déclare qu'une contradiction par saison,
// et neutraliser les deux évite qu'une seconde borne masque l'effet de la
// première. Aucune autre pièce n'est touchée, donc aucun effet de bord sur les
// quotas ni sur le plafond.
//
// Aucune écriture, aucun ALTER, aucun fichier de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Copie de logic.ts:684 — les catégories dont la génération ignore le `min`. */
const EXEMPTEES: CategoryKey[] = ["haut", "pull", "robe", "combinaison", "jupe", "short"];

const sansAccents = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();

function saisonsDeclarees(raw: string | null): CapsuleSeason[] {
  const jetons = (raw ?? "").split(/[,;|]/).map((s) => sansAccents(s)).filter(Boolean);
  return CAPSULE_SEASONS.filter((s) => jetons.includes(sansAccents(s)));
}

type Classe = "max" | "min-dur" | "min-exempté";
type Couple = {
  id: number; ref: number; nom: string; cat: CategoryKey; saison: CapsuleSeason;
  t: number; min: number | null; max: number | null; classe: Classe; motif: string;
};

describe("erreurs de bornes — ce qu'aucun mécanisme ne rattrape", () => {
  it("classe les 144 couples et démontre l'exclusion par contrefactuel à une pièce", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const ligne = new Map<number, VestiaireRow>(brutes.map((r) => [VESTIAIRE_ID_OFFSET + r.id, r]));
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`Catalogue : ${pool.length} pièces.`);
    console.log(`Températures de construction : ${CAPSULE_SEASONS.map((s) => `${s} ${representativeWeatherFor(s).temp}°`).join("  ")}`);
    console.log(`Catégories que la génération exempte de min : ${EXEMPTEES.join(", ")}.`);

    // ═══ 1 · CLASSEMENT ══════════════════════════════════════════════════
    const couples: Couple[] = [];
    for (const it of pool) {
      const r = ligne.get(it.id);
      if (!r) continue;
      const min = r.meteo_min_temp, max = r.meteo_max_temp;
      for (const saison of saisonsDeclarees(r.saison_capsule)) {
        const t = representativeWeatherFor(saison).temp;
        const base = { id: it.id, ref: r.id, nom: it.name, cat: it.cat, saison, t, min, max };
        if (max != null && t > max) couples.push({ ...base, classe: "max", motif: `max ${max}° < ${t}°` });
        else if (min != null && t < min)
          couples.push({ ...base, classe: EXEMPTEES.includes(it.cat) ? "min-exempté" : "min-dur", motif: `min ${min}° > ${t}°` });
      }
    }

    console.log(`\n════════ 1 · CLASSEMENT DES ${couples.length} COUPLES ════════`);
    for (const c of ["max", "min-dur", "min-exempté"] as Classe[]) {
      const n = couples.filter((x) => x.classe === c).length;
      const quoi = c === "max" ? "borne haute, dure dans la capsule ET à la génération"
        : c === "min-dur" ? "min sur une catégorie NON exemptée, dur des deux côtés"
        : "min sur une catégorie exemptée — artefact connu, hors de ce script";
      console.log(`  ${c.padEnd(14)}${String(n).padStart(5)}   ${quoi}`);
    }
    const artefacts = couples.filter((c) => c.classe === "min-exempté");
    const parCatArt = new Map<string, number>();
    for (const c of artefacts) parCatArt.set(c.cat, (parCatArt.get(c.cat) ?? 0) + 1);
    console.log(`  artefacts par catégorie : ${[...parCatArt.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join("  ")}`);

    // ═══ 2 · CONTREFACTUEL À UNE PIÈCE ═══════════════════════════════════
    const suspects = couples.filter((c) => c.classe !== "min-exempté");
    console.log(`\n════════ 2 · CONTREFACTUEL À UNE PIÈCE — ${suspects.length} COUPLES ════════`);

    const capsuleIds = (src: CatalogItem[], style: string, saison: CapsuleSeason): Set<number> =>
      new Set(computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }),
        representativeWeatherFor(saison), [], saison, src).map((x) => x.id));

    /** Référence : la capsule d'aujourd'hui, calculée une fois par saison × style. */
    const reference = new Map<string, Set<number>>();
    for (const saison of CAPSULE_SEASONS) for (const style of STYLES_FEMME)
      reference.set(`${saison}|${style}`, capsuleIds(pool, style, saison));

    type Verdict = "EXCLUE" | "SANS EFFET" | "DÉJÀ DEDANS";
    const resultats: { c: Couple; verdict: Verdict; avant: number; apres: number }[] = [];
    for (const c of suspects) {
      const contrefactuel = pool.map((it) =>
        it.id === c.id ? { ...it, meteoMinTemp: undefined, meteoMaxTemp: undefined } : it);
      let avant = 0, apres = 0;
      for (const style of STYLES_FEMME) {
        if (reference.get(`${c.saison}|${style}`)!.has(c.id)) avant += 1;
        if (capsuleIds(contrefactuel, style, c.saison).has(c.id)) apres += 1;
      }
      const verdict: Verdict = avant > 0 ? "DÉJÀ DEDANS" : apres > 0 ? "EXCLUE" : "SANS EFFET";
      resultats.push({ c, verdict, avant, apres });
    }

    console.log(`  « avant » et « après » comptent les styles (sur ${STYLES_FEMME.length}) dont la capsule contient la pièce.`);
    console.log(`  EXCLUE      : 0 avant, ≥1 après — la borne est bien ce qui l'exclut. DÉMONTRÉ.`);
    console.log(`  SANS EFFET  : 0 avant, 0 après — autre chose l'exclut déjà ; corriger la borne ne rendrait rien.`);
    console.log(`  DÉJÀ DEDANS : la pièce y est malgré la borne (garde-fou des 16 pièces de capsule.ts:519).`);
    console.log(`\n  ${"réf".padStart(6)}  ${"cat".padEnd(11)}${"saison".padEnd(11)}${"motif".padEnd(18)}${"avant".padStart(6)}${"après".padStart(7)}  ${"verdict".padEnd(12)}nom`);
    for (const r of resultats.sort((a, b) =>
      a.c.classe.localeCompare(b.c.classe) || a.c.cat.localeCompare(b.c.cat) || a.c.ref - b.c.ref)) {
      console.log(`  ${String(r.c.ref).padStart(6)}  ${r.c.cat.padEnd(11)}${r.c.saison.padEnd(11)}${r.c.motif.padEnd(18)}${String(r.avant).padStart(6)}${String(r.apres).padStart(7)}  ${r.verdict.padEnd(12)}${r.c.nom}`);
    }

    console.log(`\n  ${"verdict".padEnd(14)}${"couples".padStart(9)}${"pièces".padStart(9)}`);
    for (const v of ["EXCLUE", "SANS EFFET", "DÉJÀ DEDANS"] as Verdict[]) {
      const l = resultats.filter((r) => r.verdict === v);
      console.log(`  ${v.padEnd(14)}${String(l.length).padStart(9)}${String(new Set(l.map((r) => r.c.ref)).size).padStart(9)}`);
    }

    // ═══ 3 · CE QUE CHAQUE PIÈCE PERD ════════════════════════════════════
    console.log(`\n════════ 3 · PIÈCES DONT TOUTES LES SAISONS DÉCLARÉES SONT PERDUES ════════`);
    const declarees = new Map<number, CapsuleSeason[]>();
    for (const it of pool) declarees.set(it.id, saisonsDeclarees(ligne.get(it.id)?.saison_capsule ?? null));
    const perdues = new Map<number, Set<CapsuleSeason>>();
    for (const r of resultats) if (r.verdict === "EXCLUE")
      perdues.set(r.c.id, (perdues.get(r.c.id) ?? new Set()).add(r.c.saison));
    let mortes = 0;
    for (const [id, s] of perdues) {
      const d = declarees.get(id) ?? [];
      if (d.length && d.every((x) => s.has(x))) {
        mortes += 1;
        const r = ligne.get(id)!;
        const nom = pool.find((it) => it.id === id)?.name ?? "";
        console.log(`  réf ${String(r.id).padStart(5)}  ${d.join("+").padEnd(28)}min ${String(r.meteo_min_temp ?? "—").padStart(4)}  max ${String(r.meteo_max_temp ?? "—").padStart(4)}  ${nom}`);
      }
    }
    console.log(`  ${mortes} pièce(s) n'entrent dans AUCUNE des capsules qu'elles déclarent.`);

    console.log(`\n  LECTURE SEULE. Aucune règle modifiée, aucune donnée touchée. Aucune correction appliquée.`);
  }, 900_000);
});
