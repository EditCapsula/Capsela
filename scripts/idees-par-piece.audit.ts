import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule } from "../src/lib/capsule";
import { getOutfitsForItem } from "../src/lib/logic";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason, Season } from "../src/lib/types";
import { EMPTY_PROFILE, type Profile } from "../src/lib/profile";
import type { Weather } from "../src/lib/data";

// Mesure de référence, en lecture seule : combien d'idées de tenue ("comment
// porter cette pièce") chaque pièce de la capsule obtient-elle réellement ?
//
// Pourquoi cet audit avant de toucher aux quotas (demande du 28/08/2026) :
// réduire la capsule réduit mécaniquement le vivier dans lequel getOutfitsForItem
// pioche pour composer ses idées. Une pièce peut donc se retrouver sans aucune
// idée — exactement ce qu'il faut éviter. Sans relevé AVANT, impossible de
// prouver qu'un changement de quotas n'a pas dégradé la couverture.
//
// Le pool passé à getOutfitsForItem est la capsule elle-même : on mesure la
// capacité de la capsule à s'auto-suffire, indépendamment des pièces réelles
// que l'utilisatrice a pu ajouter à son dressing.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const TEMP: Record<CapsuleSeason, number> = { Printemps: 16, "Été": 26, Automne: 13, Hiver: 5 };
const BUCKET: Record<CapsuleSeason, Season> = {
  Printemps: "Printemps / Été",
  "Été": "Printemps / Été",
  Automne: "Automne / Hiver",
  Hiver: "Automne / Hiver",
};

// Six combinaisons représentatives plutôt que les 56 : chaque pièce demande
// une passe complète de getOutfitsForItem (~37 ms), le tour complet coûterait
// des minutes pour un signal que ces six donnent déjà.
const CAS: { genre: "femme" | "homme"; style: string; saison: CapsuleSeason }[] = [
  { genre: "femme", style: "Casual chic", saison: "Été" },
  { genre: "femme", style: "Casual chic", saison: "Automne" },
  { genre: "femme", style: "Glamour", saison: "Hiver" },
  { genre: "homme", style: "Casual chic", saison: "Été" },
  { genre: "homme", style: "Casual chic", saison: "Automne" },
  { genre: "homme", style: "Streetwear", saison: "Printemps" },
];

function meteo(temp: number, season: Season): Weather {
  return { season, temp, label: temp < 10 ? "Froid" : temp < 20 ? "Doux" : "Chaud", seasons: [season, "Toutes saisons"] };
}

function profil(gender: "femme" | "homme", styles: string[]): Profile {
  return { ...EMPTY_PROFILE, gender, styles };
}

describe("Idées de tenue par pièce de capsule", () => {
  it("mesure la couverture actuelle", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SB_SECRET_KEY sont requis.");
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("vestiaire_universel")
      .select("*")
      .order("id", { ascending: true })
      .returns<VestiaireRow[]>();
    if (error) throw new Error(`Lecture du catalogue impossible : ${error.message}`);

    const pool = data
      .filter((r) => (r as VestiaireRow & { frozen?: boolean }).frozen !== true)
      .map(rowToCatalogItem)
      .filter((it): it is CatalogItem => Boolean(it));

    let totalPieces = 0;
    const distribution = new Map<number, number>(); // nb d'idées -> nb de pièces
    const vides: { cas: string; id: number; name: string; cat: string }[] = [];
    const uneSeule: { cas: string; id: number; name: string; cat: string }[] = [];

    for (const { genre, style, saison } of CAS) {
      const w = meteo(TEMP[saison], BUCKET[saison]);
      const p = profil(genre, [style]);
      const capsule = computeDefaultCapsule(p, w, [], saison, pool);
      const libelle = `${genre} · ${style} · ${saison}`;
      let videsCas = 0;
      let uneCas = 0;

      for (const piece of capsule) {
        const idees = getOutfitsForItem(piece.id, capsule, w, [], {}, genre);
        totalPieces++;
        distribution.set(idees.length, (distribution.get(idees.length) || 0) + 1);
        if (idees.length === 0) {
          videsCas++;
          vides.push({ cas: libelle, id: piece.id, name: piece.name, cat: piece.cat });
        } else if (idees.length === 1) {
          uneCas++;
          uneSeule.push({ cas: libelle, id: piece.id, name: piece.name, cat: piece.cat });
        }
      }
      console.log(
        `  ${libelle.padEnd(34)} ${String(capsule.length).padStart(3)} pièces  ·  ` +
        `${String(videsCas).padStart(2)} sans idée  ·  ${String(uneCas).padStart(2)} avec une seule`
      );
    }

    console.log(`\n════════ BILAN ════════`);
    console.log(`${CAS.length} combinaisons, ${totalPieces} pièce(s) évaluée(s).`);
    const tri = [...distribution.entries()].sort((a, b) => a[0] - b[0]);
    for (const [n, combien] of tri) {
      const pct = ((combien / totalPieces) * 100).toFixed(1);
      console.log(`  ${String(n).padStart(2)} idée(s) : ${String(combien).padStart(3)} pièce(s)  (${pct} %)`);
    }
    const zero = distribution.get(0) || 0;
    const une = distribution.get(1) || 0;
    console.log(`\n  SANS AUCUNE IDÉE : ${zero} (${((zero / totalPieces) * 100).toFixed(1)} %)`);
    console.log(`  AVEC UNE SEULE   : ${une} (${((une / totalPieces) * 100).toFixed(1)} %)`);
    console.log(`  AVEC AU MOINS 2  : ${totalPieces - zero - une} (${(((totalPieces - zero - une) / totalPieces) * 100).toFixed(1)} %)`);

    if (vides.length) {
      console.log(`\n── Pièces sans aucune idée ──`);
      for (const v of vides.slice(0, 40)) console.log(`  [${v.cas}] [#${v.id}] ${v.name} (${v.cat})`);
      if (vides.length > 40) console.log(`  … et ${vides.length - 40} autre(s).`);
    }
    if (uneSeule.length) {
      console.log(`\n── Pièces avec une seule idée ──`);
      for (const v of uneSeule.slice(0, 25)) console.log(`  [${v.cas}] [#${v.id}] ${v.name} (${v.cat})`);
      if (uneSeule.length > 25) console.log(`  … et ${uneSeule.length - 25} autre(s).`);
    }

    console.log("\nAucune modification effectuée — audit en lecture seule.");
  });
});
