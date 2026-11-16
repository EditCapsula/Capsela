import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { CATEGORIES_A_LONGUEUR, longueurDepuisLeNom } from "../src/lib/forme";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";

// LA LONGUEUR DU CATALOGUE D'APRÈS LE NOM (16/11/2026, choisi par la propriétaire : « un tri automatique d'après le nom des pièces, que
// tu relis avant que je l'applique », puis l'analyse des images pour le reste). LECTURE SEULE : rien n'est écrit en base.
//
// Pour chaque robe, jupe, manteau et veste active du catalogue sans longueur : la longueur que son nom et son sous-type disent
// (longueurDepuisLeNom, forme.ts), ou rien. Sortie : le décompte par catégorie, la liste à relire, les pièces laissées à l'analyse des
// images, et le SQL — qui ne touche que la colonne `longueur`, seulement là où elle est encore vide (relançable sans effet).

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;

describe("longueur du catalogue d'après le nom", () => {
  it("propose, sans rien écrire", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const rows: (VestiaireRow & { frozen?: boolean; sous_type?: string | null })[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1);
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as typeof rows));
      if (!data || data.length < PAGE) break;
    }
    if (rows.length && !("longueur" in rows[0])) throw new Error("La colonne longueur n'existe pas (migration 0064).");

    const proposees: { id: number; cat: string; nom: string; longueur: string }[] = [];
    const aLImage: { id: number; cat: string; nom: string }[] = [];
    let dejaRemplies = 0;
    for (const r of rows) {
      if (r.frozen) continue;
      const it = rowToCatalogItem(r);
      if (!it || !CATEGORIES_A_LONGUEUR.includes(it.cat)) continue;
      if (r.longueur) {
        dejaRemplies++;
        continue;
      }
      const l = longueurDepuisLeNom(it.cat, it.name, r.sous_type);
      if (l) proposees.push({ id: it.id, cat: it.cat, nom: it.name, longueur: l });
      else aLImage.push({ id: it.id, cat: it.cat, nom: it.name });
    }

    console.log(`\nPièces actives concernées (robe, jupe, manteau, veste) : ${proposees.length + aLImage.length + dejaRemplies}`);
    console.log(`Déjà renseignées : ${dejaRemplies} · proposées d'après le nom : ${proposees.length} · laissées à l'analyse des images : ${aLImage.length}`);
    for (const cat of CATEGORIES_A_LONGUEUR) {
      const p = proposees.filter((x) => x.cat === cat);
      const n = aLImage.filter((x) => x.cat === cat).length;
      const par = (l: string) => p.filter((x) => x.longueur === l).length;
      console.log(`  ${cat.padEnd(8)} : courte ${par("courte")} · midi ${par("midi")} · longue ${par("longue")} · à l'image ${n}`);
    }
    console.log("\n═══ À RELIRE : id · catégorie · longueur proposée · nom ═══");
    for (const x of proposees) console.log(`${x.id} · ${x.cat} · ${x.longueur} · ${x.nom}`);
    console.log("\n═══ LAISSÉES À L'ANALYSE DES IMAGES ═══");
    for (const x of aLImage) console.log(`${x.id} · ${x.cat} · ${x.nom}`);
    if (proposees.length) {
      console.log("\n═══ SQL (après relecture seulement) ═══");
      console.log("update public.vestiaire_universel v set longueur = c.longueur from (values");
      console.log(proposees.map((x) => `  (${x.id}, '${x.longueur}')`).join(",\n"));
      console.log(") as c(id, longueur) where v.id = c.id and v.longueur is null;");
    }
  }, 300_000);
});
