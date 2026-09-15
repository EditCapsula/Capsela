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
  couleur_dominante: string | null;
  genre: string | null;
}

const court = (s: string | null, n: number) => (s ?? "—").slice(0, n).padEnd(n);

describe("visuels partagés entre pièces différentes", () => {
  it("cherche les pièces dont le visuel appartient à une autre", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error("SUPABASE_URL et SB_SECRET_KEY sont requis.");
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from("vestiaire_universel")
      .select("id, name, category, sous_type, url_image, affiliate_image_url, image_source, image_status, visual_asset_id, couleur_dominante, genre")
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

    // ═══ 3 · LE VISUEL EST-IL RANGÉ DANS LE DOSSIER DE SA CATÉGORIE ? ════
    //
    // Le chemin encode genre/catégorie au moment de la génération. Une ligne
    // `pulls_gilets` dont l'asset vit sous `hauts/` a donc été produite comme
    // un haut — et c'est exactement ce que l'utilisatrice a vu : un T-shirt
    // affiché sur un pull. Elle a confirmé de son côté que deux assets rangés
    // sous `pulls-gilets/` montrent bien des pulls, ce qui corrobore la lecture.
    console.log(`\n════════ 3 · VISUEL RANGÉ DANS LE MAUVAIS DOSSIER ════════`);
    const dossierDe = (url: string): string | null => {
      const m = /catalog-images\/([^/]+)\/([^/]+)\//.exec(url);
      return m ? m[2] : null;
    };
    const attendu = (categorie: string | null) => (categorie ?? "").replace(/_/g, "-");
    const malRangees = data.filter((l) => {
      const url = l.url_image;
      if (!url) return false;
      const d = dossierDe(url);
      return d != null && d !== attendu(l.category);
    });
    console.log(`  ${malRangees.length} ligne(s) sur ${data.length} pointent vers un dossier qui n'est pas celui de leur catégorie.`);
    const parCouple = new Map<string, Ligne[]>();
    for (const l of malRangees) {
      const cle = `${l.category} → ${dossierDe(l.url_image!)}`;
      parCouple.set(cle, [...(parCouple.get(cle) ?? []), l]);
    }
    for (const [cle, ls] of [...parCouple.entries()].sort((a, b) => b[1].length - a[1].length)) {
      console.log(`\n  ── ${cle} — ${ls.length} pièce(s) ──`);
      for (const l of ls.slice(0, 25)) {
        console.log(`     id ${String(l.id).padStart(5)}  ${court(l.genre, 9)}${court(l.sous_type, 24)}${court(l.couleur_dominante, 14)}${l.name ?? ""}`);
      }
      if (ls.length > 25) console.log(`     … et ${ls.length - 25} de plus.`);
    }

    // ═══ 4 · UN VISUEL CORRECT EXISTE-T-IL DÉJÀ POUR CHACUNE ? ═══════════
    //
    // S'il existe, dans la même catégorie et le même sous-type, une ligne
    // BIEN rangée et de la même couleur, alors repointer se fait en base et
    // ne coûte rien. Sinon, aucune correction de données ne rattrape le cas —
    // et il faut le dire plutôt que de laisser croire à une solution.
    console.log(`\n════════ 4 · REMPLAÇANT DÉJÀ DISPONIBLE, SANS RIEN RÉGÉNÉRER ? ════════`);
    const bienRangees = data.filter((l) => l.url_image && dossierDe(l.url_image) === attendu(l.category));
    const norm = (v: string | null) => (v ?? "").trim().toLowerCase();
    for (const l of malRangees) {
      const memeType = bienRangees.filter(
        (c) => c.category === l.category && norm(c.sous_type) === norm(l.sous_type)
      );
      const memeCouleur = memeType.filter((c) => norm(c.couleur_dominante) === norm(l.couleur_dominante));
      const memeGenre = memeCouleur.filter((c) => norm(c.genre) === norm(l.genre));
      const retenus = memeGenre.length ? memeGenre : memeCouleur;
      console.log(`\n  id ${String(l.id).padStart(5)}  ${court(l.sous_type, 24)}${court(l.couleur_dominante, 14)}${court(l.genre, 9)}${l.name ?? ""}`);
      console.log(`     sert  ${l.url_image}`);
      if (!retenus.length) {
        console.log(`     AUCUN remplaçant : ${memeType.length} pièce(s) de même sous-type bien rangées, aucune de la même couleur.`);
        for (const c of memeType.slice(0, 4)) console.log(`        (couleur ${court(c.couleur_dominante, 14)}id ${c.id})`);
        continue;
      }
      for (const c of retenus.slice(0, 3)) {
        console.log(`     candidat id ${String(c.id).padStart(5)}  ${court(c.couleur_dominante, 14)}${court(c.genre, 9)}${c.name ?? ""}`);
        console.log(`        ${c.url_image}`);
      }
    }

    console.log(`\n  LECTURE SEULE. Aucune écriture, aucune génération de visuel déclenchée.`);
  }, 600_000);
});
