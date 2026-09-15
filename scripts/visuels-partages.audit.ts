import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// UN VISUEL QUI NE MONTRE PAS LA BONNE PIÈCE — LECTURE SEULE.
//
// SIGNALÉ LE 15/09/2026, capture à l'appui : « Pull col V » s'affiche avec la
// photo d'un T-shirt gris à manches courtes.
//
// `resolveItemImage` ne fabrique rien et ne retombe sur AUCUN visuel
// générique : photo réelle, puis image affiliée, puis image générée, puis
// placeholder. Un T-shirt affiché sur un pull ne peut donc pas venir de
// l'affichage — le visuel est bel et bien attaché à cette ligne-là.
//
// DEUX CAUSES POSSIBLES, et il faut savoir laquelle avant de proposer quoi
// que ce soit :
//   · la ligne PARTAGE son visuel avec une autre pièce, d'un autre sous-type
//     — un mauvais rattachement, qui se corrige en base sans rien régénérer ;
//   · le visuel lui est propre mais a été généré de travers — là, aucune
//     correction de données ne le rattrape.
//
// Le script cherche donc la famille entière plutôt que le seul cas signalé :
// toutes les URL servies par PLUSIEURS pièces, et pour chaque groupe, si ces
// pièces partagent ou non catégorie et sous-type. Deux T-shirts blancs
// identiques qui partagent un visuel, c'est de l'économie ; un pull et un
// T-shirt qui le partagent, c'est le défaut.
//
// Aucune écriture, aucune régénération — l'utilisatrice a explicitement
// refusé de repayer des visuels, et ce script n'en déclenche aucun.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

interface Ligne {
  id: number;
  name: string | null;
  category: string | null;
  sous_type: string | null;
  url_image: string | null;
  affiliate_image_url: string | null;
  image_source: string | null;
  image_status: string | null;
  visual_asset_id: number | null;
}

const court = (s: string | null, n: number) => (s ?? "—").slice(0, n).padEnd(n);

describe("visuels partagés entre pièces différentes", () => {
  it("cherche les pièces dont le visuel appartient à une autre", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("vestiaire_universel")
      .select("id, name, category, sous_type, url_image, affiliate_image_url, image_source, image_status, visual_asset_id")
      .order("id", { ascending: true })
      .returns<Ligne[]>();
    if (error) throw new Error(`Lecture impossible : ${error.message}`);
    console.log(`Catalogue : ${data.length} lignes.`);

    // ═══ 0 · LE CAS SIGNALÉ ══════════════════════════════════════════════
    console.log(`\n════════ 0 · LE CAS SIGNALÉ — « Pull col V » ════════`);
    const visees = data.filter((l) => /col v/i.test(`${l.name} ${l.sous_type}`));
    console.log(`  ${"id".padStart(6)}  ${court("catégorie", 20)}${court("sous-type", 22)}${court("source", 12)}${court("statut", 10)}nom`);
    for (const l of visees) {
      console.log(`  ${String(l.id).padStart(6)}  ${court(l.category, 20)}${court(l.sous_type, 22)}${court(l.image_source, 12)}${court(l.image_status, 10)}${l.name ?? ""}`);
      console.log(`          url      ${l.url_image ?? "—"}`);
      if (l.affiliate_image_url) console.log(`          affilié  ${l.affiliate_image_url}`);
      console.log(`          asset    ${l.visual_asset_id ?? "—"}`);
    }

    // ═══ 1 · TOUTES LES URL SERVIES PAR PLUSIEURS PIÈCES ═════════════════
    console.log(`\n════════ 1 · VISUELS PARTAGÉS ════════`);
    const parUrl = new Map<string, Ligne[]>();
    for (const l of data) {
      const url = l.affiliate_image_url || l.url_image;
      if (!url) continue;
      parUrl.set(url, [...(parUrl.get(url) ?? []), l]);
    }
    const groupes = [...parUrl.entries()].filter(([, ls]) => ls.length > 1);
    const memeSousType = groupes.filter(([, ls]) =>
      ls.every((l) => l.category === ls[0].category && (l.sous_type ?? "") === (ls[0].sous_type ?? "")));
    const suspects = groupes.filter(([, ls]) => !ls.every((l) => l.category === ls[0].category));
    const memeCatAutreSousType = groupes.filter(
      ([, ls]) => ls.every((l) => l.category === ls[0].category)
        && !ls.every((l) => (l.sous_type ?? "") === (ls[0].sous_type ?? ""))
    );

    console.log(`  ${groupes.length} URL servies par plusieurs pièces.`);
    console.log(`     même catégorie ET même sous-type : ${memeSousType.length}  (économie légitime)`);
    console.log(`     même catégorie, sous-type différent : ${memeCatAutreSousType.length}  (à regarder)`);
    console.log(`     CATÉGORIES DIFFÉRENTES : ${suspects.length}  (défaut — c'est le cas signalé)`);

    for (const [titre, liste] of [
      ["CATÉGORIES DIFFÉRENTES", suspects],
      ["même catégorie, sous-type différent", memeCatAutreSousType],
    ] as const) {
      if (!liste.length) continue;
      console.log(`\n  ── ${titre} ──`);
      for (const [url, ls] of liste.slice(0, 40)) {
        console.log(`     ${url.slice(-58)}`);
        for (const l of ls) console.log(`        id ${String(l.id).padStart(5)}  ${court(l.category, 20)}${court(l.sous_type, 22)}${l.name ?? ""}`);
      }
      if (liste.length > 40) console.log(`     … et ${liste.length - 40} groupes de plus.`);
    }

    // ═══ 2 · MÊME CONSTAT PAR ASSET ══════════════════════════════════════
    console.log(`\n════════ 2 · MÊME LECTURE, PAR visual_asset_id ════════`);
    const parAsset = new Map<number, Ligne[]>();
    for (const l of data) if (l.visual_asset_id != null) parAsset.set(l.visual_asset_id, [...(parAsset.get(l.visual_asset_id) ?? []), l]);
    const assetsSuspects = [...parAsset.entries()].filter(([, ls]) => !ls.every((l) => l.category === ls[0].category));
    console.log(`  ${assetsSuspects.length} assets rattachés à des pièces de catégories différentes.`);
    for (const [id, ls] of assetsSuspects.slice(0, 20)) {
      console.log(`     asset ${id}`);
      for (const l of ls) console.log(`        id ${String(l.id).padStart(5)}  ${court(l.category, 20)}${court(l.sous_type, 22)}${l.name ?? ""}`);
    }

    console.log(`\n  LECTURE SEULE. Aucune écriture, aucune génération de visuel déclenchée.`);
  }, 600_000);
});
