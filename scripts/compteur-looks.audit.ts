import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { CAPSULE_SEASONS, computeDefaultCapsule, saisonCapsulePourMeteo, weatherForDay } from "../src/lib/capsule";
import { looksCombinatoires, occasionsCouvertes, tenuesDistinctes, NB_OCCASIONS } from "../src/lib/looks";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason } from "../src/lib/types";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// « X LOOKS POSSIBLES » — CE CHIFFRE EST-IL VRAI ? LECTURE SEULE.
//
// SIGNALÉ LE 15/09/2026 : « il faut qu'il soit vrai et non une estimation
// fausse ». L'écran Capsule affiche `(hauts × bas + robes) × chaussures`, un
// produit combinatoire brut. Il ignore la formalité par occasion (R-B3), les
// occasions déclarées, la palette, les bornes météo, R-B9, la règle de
// superposition et les mailles fermées — il compte donc des assemblages que
// le moteur ne produira jamais.
//
// CE QUE MESURE CE SCRIPT, dans une seule exécution et sur le même pool :
//   · la formule actuelle, telle quelle (`looksCombinatoires`) ;
//   · A, le nombre de tenues DISTINCTES que le moteur produit réellement, à
//     budgets croissants — 10, 20, 40, 80, 160 tirages par occasion ;
//   · B, le nombre d'occasions couvertes, exact et sans budget.
//
// LA QUESTION QUI DÉCIDE, et c'est pour elle que les budgets croissent : A
// est un MINORANT. Si le décompte se stabilise vite, il approche le vrai
// total et peut s'afficher tel quel. S'il continue de grimper avec le budget,
// alors c'est un chiffre qui dépend d'un réglage arbitraire — il serait plus
// honnête que la formule actuelle, mais pas « vrai » pour autant, et il
// faudrait le dire autrement (« au moins X ») ou lui préférer B.
//
// Le coût par capsule est mesuré aussi : ce compteur tournerait au rendu de
// l'écran Capsule, pas dans un script.
//
// Aucune écriture, aucun fichier de production modifié — `looks.ts` porte les
// trois compteurs pour que ce script mesure le code de l'écran, pas une copie.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUDGETS = [10, 20, 40, 80, 160];

describe("le compteur de looks de l'écran Capsule", () => {
  it("compare la formule affichée à ce que le moteur produit vraiment", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);
    console.log(`Catalogue : ${pool.length} pièces.`);
    console.log(`CONFIGURATION GELÉE : profils d'audit, ${STYLES_FEMME.length} styles femme, ${NB_OCCASIONS} occasions.`);
    console.log(`La capsule est bâtie comme en production : saison choisie par la météo (saisonCapsulePourMeteo).`);

    // ═══ 1 · L'ÉCART, CELLULE PAR CELLULE ════════════════════════════════
    console.log(`\n════════ 1 · CE QUE LA FORMULE ANNONCE, CE QUE LE MOTEUR PRODUIT ════════`);
    console.log(`  « formule » = (hauts × bas + robes) × chaussures, ce qu'affiche l'écran aujourd'hui.`);
    console.log(`  A = tenues distinctes réellement produites, 40 tirages par occasion.`);
    console.log(`  B = occasions couvertes sur ${NB_OCCASIONS}.`);
    console.log(`\n  ${"saison".padEnd(11)}${"style".padEnd(17)}${"pièces".padStart(8)}${"formule".padStart(10)}${"A (40)".padStart(9)}${"B".padStart(6)}${"formule / A".padStart(13)}`);
    let totFormule = 0, totA = 0;
    const capsules = new Map<string, { capsule: CatalogItem[]; temp: number; saison: CapsuleSeason }>();
    for (const saison of CAPSULE_SEASONS) {
      // La journée typique de la saison : la production bâtirait exactement
      // cette capsule-là un jour où il fait cette température.
      const temp = { Printemps: 16, Été: 24, Automne: 14, Hiver: 6 }[saison];
      const w = weatherForDay(temp, saison === "Été" ? "Ensoleillé" : "Nuageux", saison);
      const saisonTenue = saisonCapsulePourMeteo(temp);
      for (const style of STYLES_FEMME) {
        const profil = profilAudit({ gender: "femme", styles: [style] });
        const capsule = computeDefaultCapsule(profil, w, [], saisonTenue, pool);
        capsules.set(`${saison}|${style}`, { capsule, temp, saison: saisonTenue });
        const formule = looksCombinatoires(capsule);
        const a = tenuesDistinctes(capsule, capsule, w, "femme", saisonTenue, 40);
        const b = occasionsCouvertes(capsule, capsule, w, "femme", saisonTenue);
        totFormule += formule; totA += a;
        const ratio = a ? `× ${(formule / a).toFixed(1)}` : "—";
        console.log(`  ${(style === STYLES_FEMME[0] ? saison : "").padEnd(11)}${style.padEnd(17)}${String(capsule.length).padStart(8)}${String(formule).padStart(10)}${String(a).padStart(9)}${`${b}/${NB_OCCASIONS}`.padStart(6)}${ratio.padStart(13)}`);
      }
    }
    console.log(`\n  TOTAL  formule ${totFormule}  ·  A ${totA}  ·  la formule annonce ${(totFormule / Math.max(1, totA)).toFixed(1)} fois ce que le moteur produit.`);

    // ═══ 2 · A SE STABILISE-T-IL ? ═══════════════════════════════════════
    console.log(`\n════════ 2 · A EST-IL UN VRAI NOMBRE, OU UN RÉGLAGE DÉGUISÉ ? ════════`);
    console.log(`  Si le décompte cesse de monter quand le budget double, il approche le total`);
    console.log(`  réel et peut s'afficher tel quel. S'il continue, c'est un minorant qui dépend`);
    console.log(`  d'un choix arbitraire, et il faut le dire autrement.`);
    console.log(`\n  ${"saison".padEnd(11)}${"style".padEnd(17)}${BUDGETS.map((b) => `A(${b})`.padStart(8)).join("")}${"ms @160".padStart(10)}`);
    for (const saison of CAPSULE_SEASONS) {
      for (const style of STYLES_FEMME) {
        const { capsule, temp, saison: sk } = capsules.get(`${saison}|${style}`)!;
        const w = weatherForDay(temp, saison === "Été" ? "Ensoleillé" : "Nuageux", saison);
        const valeurs: number[] = [];
        let ms160 = 0;
        for (const budget of BUDGETS) {
          const t0 = Date.now();
          valeurs.push(tenuesDistinctes(capsule, capsule, w, "femme", sk, budget));
          if (budget === 160) ms160 = Date.now() - t0;
        }
        console.log(`  ${(style === STYLES_FEMME[0] ? saison : "").padEnd(11)}${style.padEnd(17)}${valeurs.map((v) => String(v).padStart(8)).join("")}${String(ms160).padStart(10)}`);
      }
    }

    // ═══ 3 · LE COÛT DE B, ET SA STABILITÉ ═══════════════════════════════
    console.log(`\n════════ 3 · CE QUE COÛTE CHAQUE OPTION AU RENDU ════════`);
    const echantillon = [...capsules.values()].slice(0, 8);
    const chrono = (fn: () => void) => { const t = Date.now(); fn(); return Date.now() - t; };
    for (const [nom, fn] of [
      ["formule actuelle", (c: CatalogItem[], w: ReturnType<typeof weatherForDay>, s: CapsuleSeason) => { void looksCombinatoires(c); void w; void s; }],
      ["B · occasions couvertes", (c: CatalogItem[], w: ReturnType<typeof weatherForDay>, s: CapsuleSeason) => { void occasionsCouvertes(c, c, w, "femme", s); }],
      ["A · 40 tirages", (c: CatalogItem[], w: ReturnType<typeof weatherForDay>, s: CapsuleSeason) => { void tenuesDistinctes(c, c, w, "femme", s, 40); }],
      ["A · 160 tirages", (c: CatalogItem[], w: ReturnType<typeof weatherForDay>, s: CapsuleSeason) => { void tenuesDistinctes(c, c, w, "femme", s, 160); }],
    ] as const) {
      const ms = chrono(() => {
        for (const { capsule, temp, saison } of echantillon) {
          fn(capsule, weatherForDay(temp, "Nuageux", saison), saison);
        }
      });
      console.log(`  ${nom.padEnd(26)}${`${(ms / echantillon.length).toFixed(1)} ms`.padStart(10)} par capsule`);
    }
    console.log(`  Repère : « Comment porter cette pièce ? » assume déjà 37 ms à l'ouverture.`);

    // ═══ 4 · LE DÉCOMPTE EST-IL STABLE D'UN RENDU À L'AUTRE ? ════════════
    console.log(`\n════════ 4 · STABILITÉ — le même écran doit afficher le même nombre ════════`);
    let instables = 0;
    for (const { capsule, temp, saison } of echantillon) {
      const w = weatherForDay(temp, "Nuageux", saison);
      const a = tenuesDistinctes(capsule, capsule, w, "femme", saison, 40);
      const b = tenuesDistinctes(capsule, capsule, w, "femme", saison, 40);
      if (a !== b) instables += 1;
    }
    console.log(`  ${instables}/${echantillon.length} capsules rendent deux valeurs différentes à deux appels identiques.`);
    console.log(`  Un compteur par tirages DOIT être semé, sinon le nombre change à chaque rendu.`);

    console.log(`\n  LECTURE SEULE. Aucun affichage changé — l'arbitrage n'est pas rendu.`);
  }, 900_000);
});
