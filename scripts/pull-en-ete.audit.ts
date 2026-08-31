import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule, representativeWeatherFor } from "../src/lib/capsule";
import { rolePieceOf } from "../src/lib/attributes";
import type { CatalogItem } from "../src/lib/catalog";
import { STYLES_FEMME, assertCatalogueStyles, profilAudit } from "./harnaisAudit";

// POURQUOI Y A-T-IL UN PULL DANS LA CAPSULE ÉTÉ ? — LECTURE SEULE.
//
// Question posée le 31/08/2026. Trois mécanismes peuvent l'expliquer, et ils
// n'appellent PAS le même arbitrage. On ne peut donc pas répondre par lecture
// de code seule : il faut savoir lequel opère.
//
//   VOIE 1 — SÉLECTION LÉGITIME. La pièce est déclarée pour la saison. Le
//   modèle `Season` ne compte que trois valeurs ("Printemps / Été",
//   "Automne / Hiver", "Toutes saisons") : un pull fin déclaré "Toutes
//   saisons" ou "Printemps / Été" passe le filtre à bon droit. Une soirée
//   d'été fraîche est un cas réel. Rien à corriger.
//
//   VOIE 2 — FILTRE RELÂCHÉ. `seasonFit` et `tempFit` ne s'appliquent que
//   si au moins 16 pièces y survivent (`if (x.length >= 16) base = x`).
//   Sous ce seuil, le filtre est ABANDONNÉ EN ENTIER, pas assoupli. Une
//   pièce hors saison entre alors sans être distinguée des autres.
//
//   VOIE 3 — FILET DE SÉCURITÉ `ensure("pull")`. Il garantit au moins un
//   pull dans CHAQUE capsule et ne filtre que genre, soleil et bornes de
//   température — JAMAIS la saison. C'est le même mécanisme qui avait
//   réintroduit des manteaux A/H dans des capsules Été.
//
// Ce que cet audit ne fait pas : il ne conclut pas qu'un pull en Été est une
// erreur. Un pull fin en été est défendable ; un pull en grosse maille
// déclaré Automne/Hiver ne l'est pas. La distinction est éditoriale, et cet
// audit ne fait que lui donner les faits.
//
// Aucune écriture, aucun ALTER, aucun appelant de production modifié.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("pull en capsule Été", () => {
  it("établit par quelle voie un pull entre dans une capsule Été", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: rows, error } = await supabase
      .from("vestiaire_universel").select("*").order("id", { ascending: true }).returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    const brutes = rows.filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true);
    const pool = brutes.map(rowToCatalogItem).filter((it): it is CatalogItem => Boolean(it));
    assertCatalogueStyles(pool, STYLES_FEMME);

    // Lue par la fonction exportée plutôt qu'en exportant la constante :
    // REPRESENTATIVE_TEMP est interne à capsule.ts et l'élargir pour le seul
    // confort d'un audit ferait payer à la production le prix de la mesure.
    const w = representativeWeatherFor("Été");
    const TEMP_ETE = w.temp;
    const pulls = pool.filter((it) => it.cat === "pull");
    console.log(`Catalogue exploitable : ${pool.length} pièces, dont ${pulls.length} pulls.`);
    console.log(`Température représentative de l'Été : ${TEMP_ETE} °C.`);

    // ═══ 1 · COMBIEN DE PULLS SONT SEULEMENT ÉLIGIBLES À L'ÉTÉ ? ═══
    //
    // Reproduit les DEUX filtres de computeDefaultCapsule dans leur ordre, à
    // l'identique. Si aucun pull ne les passe, alors tout pull présent dans
    // une capsule Été y est entré par la voie 2 ou la voie 3 — la question
    // est tranchée avant même de regarder les capsules.
    const saisonOk = pulls.filter((it) => it.season === "Printemps / Été" || it.season === "Toutes saisons");
    const tempOk = pulls.filter(
      (it) => (it.meteoMinTemp == null || TEMP_ETE >= it.meteoMinTemp) && (it.meteoMaxTemp == null || TEMP_ETE <= it.meteoMaxTemp)
    );
    const lesDeux = saisonOk.filter((it) => tempOk.includes(it));
    console.log(`\n════════ 1 · ÉLIGIBILITÉ DES PULLS À L'ÉTÉ ════════`);
    console.log(`  passent le filtre de SAISON (bucket "Printemps / Été" ou "Toutes saisons") : ${saisonOk.length}/${pulls.length}`);
    console.log(`  passent le filtre de TEMPÉRATURE à ${TEMP_ETE} °C                            : ${tempOk.length}/${pulls.length}`);
    console.log(`  passent LES DEUX                                                  : ${lesDeux.length}/${pulls.length}`);
    if (lesDeux.length) {
      console.log(`\n  Les pulls légitimement éligibles à l'Été (voie 1) :`);
      console.log(`  ${"nom".padEnd(38)}${"saison".padStart(18)}${"min".padStart(6)}${"max".padStart(6)}${"rôle".padStart(9)}`);
      for (const it of lesDeux) {
        console.log(`  ${it.name.slice(0, 37).padEnd(38)}${String(it.season).padStart(18)}` +
          `${String(it.meteoMinTemp ?? "—").padStart(6)}${String(it.meteoMaxTemp ?? "—").padStart(6)}${rolePieceOf(it).padStart(9)}`);
      }
    } else {
      console.log(`  >>> AUCUN pull n'est éligible à l'Été. Tout pull présent dans une capsule Été`);
      console.log(`      y est donc entré par un filtre relâché (voie 2) ou par ensure() (voie 3).`);
    }

    // ═══ 2 · CE QUE LES CAPSULES ÉTÉ CONTIENNENT RÉELLEMENT ═══
    //
    // Les vraies capsules, produites par le vrai moteur — jamais une
    // réimplémentation, qui divergerait aussitôt.
    console.log(`\n════════ 2 · LES PULLS RÉELLEMENT PRÉSENTS DANS LES 8 CAPSULES ÉTÉ ════════`);
    let capsulesAvecPull = 0;
    const occurrences = new Map<number, { it: CatalogItem; styles: string[] }>();
    for (const style of STYLES_FEMME) {
      const capsule = computeDefaultCapsule(profilAudit({ gender: "femme", styles: [style] }), w, [], "Été", pool);
      const dedans = capsule.filter((it) => it.cat === "pull");
      if (dedans.length) capsulesAvecPull += 1;
      for (const it of dedans) {
        if (!occurrences.has(it.id)) occurrences.set(it.id, { it, styles: [] });
        occurrences.get(it.id)!.styles.push(style);
      }
      console.log(`  ${style.padEnd(20)}${String(capsule.length).padStart(4)} pièces — pulls : ${dedans.map((p) => p.name).join(" · ") || "aucun"}`);
    }
    console.log(`\n  ${capsulesAvecPull}/8 capsules Été contiennent au moins un pull.`);

    // ═══ 3 · ATTRIBUTION, PIÈCE PAR PIÈCE ═══
    console.log(`\n════════ 3 · PAR QUELLE VOIE CHAQUE PULL EST-IL ENTRÉ ? ════════`);
    console.log(`  « légitime » = la pièce passe saison ET température : elle a sa place, quel`);
    console.log(`  que soit le chemin emprunté. « hors saison » = elle ne les passe pas, donc`);
    console.log(`  seul un filtre relâché ou ensure() a pu l'y mettre.`);
    console.log(`  ${"nom".padEnd(34)}${"saison déclarée".padStart(18)}${"min".padStart(5)}${"max".padStart(5)}${"rôle".padStart(9)}${"verdict".padStart(14)}${"capsules".padStart(10)}`);
    let horsSaison = 0;
    for (const { it, styles } of [...occurrences.values()].sort((a, b) => b.styles.length - a.styles.length)) {
      const okSaison = it.season === "Printemps / Été" || it.season === "Toutes saisons";
      const okTemp = (it.meteoMinTemp == null || TEMP_ETE >= it.meteoMinTemp) && (it.meteoMaxTemp == null || TEMP_ETE <= it.meteoMaxTemp);
      const verdict = okSaison && okTemp ? "légitime" : !okSaison && !okTemp ? "HORS SAISON+T°" : !okSaison ? "HORS SAISON" : "HORS T°";
      if (!(okSaison && okTemp)) horsSaison += 1;
      console.log(`  ${it.name.slice(0, 33).padEnd(34)}${String(it.season).padStart(18)}` +
        `${String(it.meteoMinTemp ?? "—").padStart(5)}${String(it.meteoMaxTemp ?? "—").padStart(5)}` +
        `${rolePieceOf(it).padStart(9)}${verdict.padStart(14)}${String(styles.length).padStart(10)}`);
    }
    console.log(`\n  ${occurrences.size} pulls distincts en capsule Été, dont ${horsSaison} hors de leur saison ou de leur plage.`);

    // ═══ 4 · LE FILET ensure() EST-IL EN CAUSE ? ═══
    //
    // Contre-épreuve directe : ensure("pull") ne filtre QUE genre, soleil et
    // bornes de température. On liste ce qu'il aurait pioché — il prend la
    // première pièce du pool filtré, favColors d'abord, donc l'ordre des ids
    // décide. Si le pull observé en capsule est celui-là, la voie 3 est la
    // plus probable ; s'il n'y est même pas éligible, c'est la voie 2.
    console.log(`\n════════ 4 · CE QU'ensure("pull") PEUT PIOCHER EN ÉTÉ ════════`);
    console.log(`  ensure() ne filtre jamais la saison — seulement genre, soleil et température.`);
    const candidatsEnsure = pulls
      .filter((it) => it.genre !== "homme")
      .filter((it) => (it.meteoMinTemp == null || TEMP_ETE >= it.meteoMinTemp) && (it.meteoMaxTemp == null || TEMP_ETE <= it.meteoMaxTemp))
      .sort((a, b) => a.id - b.id);
    console.log(`  candidats éligibles à ensure() en Été : ${candidatsEnsure.length}`);
    for (const it of candidatsEnsure.slice(0, 10)) {
      const okSaison = it.season === "Printemps / Été" || it.season === "Toutes saisons";
      console.log(`     ${it.name.slice(0, 40).padEnd(42)}${String(it.season).padStart(18)}${(okSaison ? "" : "  << HORS SAISON")}`);
    }
    if (!candidatsEnsure.length) {
      console.log(`  >>> ensure() ne trouverait AUCUN pull : il ne peut pas être la cause.`);
    }

    console.log(`\n  LECTURE SEULE. Aucun UPDATE, aucun ALTER.`);
    console.log(`  Cet audit ne décide pas si un pull en Été est souhaitable : il dit lesquels`);
    console.log(`  y sont, et par quel mécanisme, pour qu'un arbitrage porte sur des faits.`);
  });
});
