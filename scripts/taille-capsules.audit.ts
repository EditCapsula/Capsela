import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";
import { computeDefaultCapsule } from "../src/lib/capsule";
import type { CatalogItem } from "../src/lib/catalog";
import type { CapsuleSeason } from "../src/lib/types";
import { EMPTY_PROFILE, type Profile } from "../src/lib/profile";
import type { Weather } from "../src/lib/data";
import type { Season } from "../src/lib/types";

// Audit de la TAILLE des capsules, en lecture seule.
//
// Le plafond annoncé est de 35 pièces (somme des quotas de CAPSULE_GROUPS),
// mais quatre mécanismes ajoutent des pièces PAR-DESSUS ce plafond :
//   1. le garde-fou de formalité, qui réintègre un palier absent ;
//   2. la garantie chaussures d'intérieur (Cocooning) ;
//   3. la garantie collants (femme, Automne/Hiver) ;
//   4. le bloc Sport, ajouté en entier et sans borne.
//
// Signalé : les capsules dépassent 40 pièces. Cet audit mesure la taille
// réelle pour chaque combinaison profil × saison et attribue le dépassement
// à son mécanisme, plutôt que de supposer lequel déborde.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const SAISONS: CapsuleSeason[] = ["Printemps", "Été", "Automne", "Hiver"];
const STYLES = ["Casual chic", "Classique chic", "Romantique", "Bohème", "Streetwear", "Preppy", "Glamour"];
/** Température représentative de chaque saison, pour que les filtres météo jouent normalement. */
const TEMP: Record<CapsuleSeason, number> = { Printemps: 16, "Été": 26, Automne: 13, Hiver: 5 };
/** Bucket météo correspondant, tel que l'app le calcule pour la saison affichée. */
const BUCKET: Record<CapsuleSeason, Season> = {
  Printemps: "Printemps / Été",
  "Été": "Printemps / Été",
  Automne: "Automne / Hiver",
  Hiver: "Automne / Hiver",
};

function meteo(temp: number, season: Season): Weather {
  return {
    season,
    temp,
    label: temp < 10 ? "Froid" : temp < 20 ? "Doux" : "Chaud",
    seasons: [season, "Toutes saisons"],
  };
}

function profil(gender: "femme" | "homme", styles: string[]): Profile {
  return { ...EMPTY_PROFILE, gender, styles };
}

describe("Taille des capsules", () => {
  it("mesure la taille réelle par profil et saison", async () => {
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
    console.log(`Catalogue : ${data.length} ligne(s), ${pool.length} exploitable(s) après gel et conversion.\n`);

    const tailles: number[] = [];
    let pire = { taille: 0, libelle: "", detail: "" };

    for (const gender of ["femme", "homme"] as const) {
      for (const style of STYLES) {
        for (const saison of SAISONS) {
          const capsule = computeDefaultCapsule(profil(gender, [style]), meteo(TEMP[saison], BUCKET[saison]), [], saison, pool);
          tailles.push(capsule.length);
          const parCat = new Map<string, number>();
          for (const it of capsule) parCat.set(it.cat, (parCat.get(it.cat) || 0) + 1);
          const detail = [...parCat.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(", ");
          const libelle = `${gender} · ${style} · ${saison}`;
          if (capsule.length > pire.taille) pire = { taille: capsule.length, libelle, detail };
          const marque = capsule.length > 40 ? "  ⚠ DÉPASSE 40" : "";
          console.log(`  ${String(capsule.length).padStart(3)} pièces  ${libelle.padEnd(38)}${marque}`);
        }
      }
    }

    const tri = [...tailles].sort((a, b) => a - b);
    const moyenne = tailles.reduce((s, n) => s + n, 0) / tailles.length;
    console.log(`\n════════ BILAN ════════`);
    console.log(`${tailles.length} combinaisons profil × style × saison.`);
    console.log(`  min ${tri[0]}  ·  médiane ${tri[Math.floor(tri.length / 2)]}  ·  max ${tri[tri.length - 1]}  ·  moyenne ${moyenne.toFixed(1)}`);
    console.log(`  ${tailles.filter((n) => n > 40).length} capsule(s) au-dessus de 40 pièces.`);
    console.log(`  ${tailles.filter((n) => n > 35).length} capsule(s) au-dessus du plafond annoncé de 35.`);
    console.log(`\nPire cas : ${pire.taille} pièces — ${pire.libelle}`);
    console.log(`  répartition : ${pire.detail}`);
    console.log("\nAucune modification effectuée — audit en lecture seule.");
  });
});
