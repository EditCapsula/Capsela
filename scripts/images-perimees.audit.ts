import { describe, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

// Audit des visuels périmés servis par le catalogue, en lecture seule.
//
// Signalé le 28/08/2026 : un débardeur servait un PNG de 2,5 Mo alors que la
// campagne de recompression avait produit un WebP de 84 Ko. La conversion a
// bien eu lieu côté visual_assets, mais certains articles pointent toujours
// vers l'ancien fichier — vestiaire_universel.url_image n'a pas suivi.
//
// Deux mesures, sans aucune écriture :
//   1. combien d'articles servent une URL différente de celle de leur asset ;
//   2. combien de PNG restent servis, et ce qu'ils pèsent réellement
//      (requêtes HEAD, aucun téléchargement de contenu).
//
// L'enjeu est l'egress Supabase, à 210 % du quota gratuit : un article périmé
// fait télécharger l'ancien fichier à chaque affichage.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SB_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const CONCURRENCE = 12;

interface ArticleRow {
  id: number;
  name: string | null;
  url_image: string | null;
  image_status: string | null;
  visual_asset_id: number | null;
}

interface AssetRow {
  id: number;
  image_url: string | null;
  image_status: string | null;
}

const ko = (o: number) => `${(o / 1024).toFixed(0)} Ko`;
const mo = (o: number) => `${(o / 1024 / 1024).toFixed(1)} Mo`;

/** Poids réel d'un fichier, sans télécharger son contenu. */
async function poids(url: string): Promise<number | null> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return null;
    const len = res.headers.get("content-length");
    return len ? Number(len) : null;
  } catch {
    return null;
  }
}

async function parLots<T, R>(items: T[], taille: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += taille) {
    out.push(...(await Promise.all(items.slice(i, i + taille).map(fn))));
  }
  return out;
}

describe("Visuels périmés", () => {
  it("compte les articles qui ne servent pas le visuel courant de leur asset", async () => {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      throw new Error("SUPABASE_URL (ou NEXT_PUBLIC_SUPABASE_URL) et SB_SECRET_KEY sont requis.");
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: articles, error: e1 } = await supabase
      .from("vestiaire_universel")
      .select("id, name, url_image, image_status, visual_asset_id")
      .order("id", { ascending: true })
      .returns<ArticleRow[]>();
    if (e1) throw new Error(`Lecture du catalogue impossible : ${e1.message}`);

    const { data: assets, error: e2 } = await supabase
      .from("visual_assets")
      .select("id, image_url, image_status")
      .returns<AssetRow[]>();
    if (e2) throw new Error(`Lecture des assets impossible : ${e2.message}`);

    const parId = new Map(assets.map((a) => [a.id, a]));
    const avecVisuel = articles.filter((a) => a.url_image);

    // 1. Article dont l'URL ne correspond plus à celle de son asset.
    const perimes = avecVisuel.filter((a) => {
      const asset = a.visual_asset_id === null ? null : parId.get(a.visual_asset_id);
      return asset?.image_url && asset.image_url !== a.url_image;
    });

    // 2. Répartition par format réellement servi.
    const png = avecVisuel.filter((a) => a.url_image!.toLowerCase().endsWith(".png"));
    const webp = avecVisuel.filter((a) => a.url_image!.toLowerCase().endsWith(".webp"));
    const autres = avecVisuel.length - png.length - webp.length;

    console.log(`Catalogue : ${articles.length} article(s), ${avecVisuel.length} avec un visuel.`);
    console.log(`  format servi : ${png.length} PNG · ${webp.length} WebP · ${autres} autre(s).`);
    console.log(`  ${perimes.length} article(s) servent une URL différente de celle de leur asset.\n`);

    // Poids réel : les PNG d'abord, puis un échantillon de WebP pour comparer.
    console.log(`Mesure du poids réel (requêtes HEAD, aucun contenu téléchargé)…`);
    const poidsPng = await parLots(png, CONCURRENCE, (a) => poids(a.url_image!));
    const totalPng = poidsPng.reduce<number>((s, p) => s + (p ?? 0), 0);
    const mesuresPng = poidsPng.filter((p): p is number => p !== null);

    const echantillon = webp.slice(0, 40);
    const poidsWebp = await parLots(echantillon, CONCURRENCE, (a) => poids(a.url_image!));
    const mesuresWebp = poidsWebp.filter((p): p is number => p !== null);
    const moyenneWebp = mesuresWebp.length ? mesuresWebp.reduce((s, p) => s + p, 0) / mesuresWebp.length : 0;

    const moyennePng = mesuresPng.length ? totalPng / mesuresPng.length : 0;

    console.log(`\n════════ BILAN ════════`);
    console.log(`PNG encore servis : ${png.length} article(s)`);
    console.log(`  poids mesuré sur ${mesuresPng.length} fichier(s) : ${mo(totalPng)} au total, ${mo(moyennePng)} en moyenne`);
    console.log(`WebP (échantillon de ${mesuresWebp.length}) : ${ko(moyenneWebp)} en moyenne`);
    if (moyenneWebp > 0 && moyennePng > 0) {
      console.log(`  rapport : un PNG pèse ${(moyennePng / moyenneWebp).toFixed(0)}× un WebP`);
      const economie = totalPng - png.length * moyenneWebp;
      console.log(`  économie par tour complet du catalogue : ${mo(economie)}`);
    }
    console.log(`\nArticles à re-synchroniser sur l'URL de leur asset : ${perimes.length}`);
    for (const a of perimes.slice(0, 15)) {
      const asset = parId.get(a.visual_asset_id!)!;
      console.log(`  [#${a.id}] ${a.name}`);
      console.log(`      sert  : ${a.url_image}`);
      console.log(`      asset : ${asset.image_url}`);
    }
    if (perimes.length > 15) console.log(`  … et ${perimes.length - 15} autre(s).`);
    console.log("\nAucune modification effectuée — audit en lecture seule.");
  });
});
