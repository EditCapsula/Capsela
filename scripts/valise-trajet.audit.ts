import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { rowToItem, type DressingItemRow } from "../src/lib/dressing";
import type { CatalogItem } from "../src/lib/catalog";
import type { Item } from "../src/lib/types";
import { generateurMoteur, type SituationValise } from "../src/lib/valise";
import { rowToValise } from "../src/lib/valises";
import { rowToCatalogItem, type VestiaireRow } from "../src/lib/vestiaire";

// LE TRAJET SANS TENUE (12/11/2026, signalé sur une valise « Polynesia », 23 → 29 nov. : « Aucun look de ta valise ne répond encore à
// cette occasion » sur les deux trajets). LECTURE SEULE. La valise enregistrée : ses situations, ses looks, ce qui reste sans look ;
// puis le moteur rejoué sur la situation du trajet, avec les pièces de la valise, puis avec toutes les pièces (dressing + catalogue).
// Approximation : palette et colorimétrie du profil non reprises (couleurs vides) — NON DÉMONTRÉ qu'elles n'y jouent pas.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const PAGE = 1000;
const TIRAGES = 60;

const decrire = (p: Item | undefined) => (p ? `${p.id} ${p.name} [${p.cat}${p.shoeType ? `/${p.shoeType}` : ""}, ${p.season}${p.occasion?.length ? `, ${p.occasion.join("/")}` : ""}]` : "?");

describe("trajet sans tenue", () => {
  it("valise Polynesia", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: valises, error } = await supabase.from("valises").select("*").ilike("destination", "%polyn%").eq("depart", "2026-11-23");
    if (error) throw new Error(error.message);
    console.log(`Valises trouvées : ${valises?.length ?? 0}`);
    const rows: VestiaireRow[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error: e } = await supabase.from("vestiaire_universel").select("*").order("id", { ascending: true }).range(debut, debut + PAGE - 1).returns<VestiaireRow[]>();
      if (e) throw new Error(e.message);
      rows.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const catalogue = rows.map(rowToCatalogItem).filter((i): i is CatalogItem => !!i);
    for (const brut of valises ?? []) {
      const v = rowToValise(brut);
      const { data: dr } = await supabase.from("dressing_items").select("*").eq("user_id", (brut as { user_id: string }).user_id).returns<DressingItemRow[]>();
      const dressing = (dr ?? []).map(rowToItem);
      const tous = new Map<number, Item>([...catalogue, ...dressing].map((p) => [p.id, p]));
      console.log(`\n=== ${v.destination} ${v.depart} → ${v.retour}, ${v.bagage}, lavage ${v.lavage}, uniquementDressing ${v.uniquementDressing ?? false}, dressing ${dressing.length} pièces`);
      console.log("choix :", JSON.stringify(v.choix?.map((c) => ({ libelle: c.libelle, activite: c.activite, jours: c.jours }))));
      console.log("programme :", JSON.stringify(v.programme));
      v.situations.forEach((s, i) =>
        console.log(`situation ${i} : ${s.occasion} [${(s.sousIds ?? []).join(",")}] jours ${s.jours.join(",")} ${s.meteo.temp}° ${s.meteo.season ?? ""} contrainte ${s.contrainte ?? "-"} plancher ${s.plancher ?? "-"}${s.avecRandonnee ? " randonnée" : ""}`)
      );
      v.looks.forEach((l, i) => console.log(`look ${i} : situations ${l.situations.join(",")}${l.elargie ? " (élargi)" : ""} — ${l.ids.map((id) => decrire(tous.get(id))).join(" · ")}`));
      console.log("situationsSansLook :", JSON.stringify(v.situationsSansLook));
      console.log(`pièces (${v.pieceIds.length}) : ${v.pieceIds.map((id) => decrire(tous.get(id))).join(" | ")}`);
      const generer = generateurMoteur([], "femme");
      const trajets = v.situations.map((s, i) => ({ s, i })).filter(({ s }) => s.occasion === "voyage");
      for (const { s, i } of trajets) {
        for (const [nom, pool] of [
          ["pièces de la valise", v.pieceIds.map((id) => tous.get(id)).filter((p): p is Item => !!p)],
          ["dressing + catalogue", [...dressing, ...catalogue]],
        ] as const) {
          let vides = 0;
          const vus = new Map<string, number>();
          for (let k = 0; k < TIRAGES; k++) {
            const t = generer([...pool], s as SituationValise);
            if (!t) vides++;
            else vus.set(t.ids.map((id) => tous.get(id)?.name ?? id).join(" + "), (vus.get(t.ids.map((id) => tous.get(id)?.name ?? id).join(" + ")) ?? 0) + 1);
          }
          console.log(`trajet (situation ${i}) · ${nom} (${pool.length}) : ${vides}/${TIRAGES} sans tenue ; ${[...vus.entries()].slice(0, 4).map(([t, n]) => `${n}× ${t}`).join(" ; ")}`);
        }
      }
    }
  }, 300_000);
});
