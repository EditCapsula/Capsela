// Edge Function generate-hero-image (08/10/2026) — génère le visuel « hero » d'une pièce du catalogue : la même pièce, posée à plat
// avec des plis naturels (flat lay), pour le hero « Ton look du jour ». Il s'ajoute au visuel standard sans le remplacer.
//
// ADMINISTRATION SEULE (clé privilégiée) : un visuel coûte ~0,04 $ (qualité « medium »), aucune utilisatrice ne peut le déclencher.
// Entrée : { item_id: number, force?: boolean } — l'id BRUT de la ligne vestiaire_universel. Sans `force`, une pièce qui a déjà
// un visuel hero n'est pas régénérée.
//
// Sortie : { ok: true, url, ratio } ou { ok: false, code, message }. Si la migration 0049 (colonne url_image_hero) n'est pas
// exécutée, la fonction le dit avant tout appel payant.
//
// Même secret que generate-catalog-image : OPENAI_API_KEY (+ IMAGE_GENERATION_MODEL). Qualité propre au hero : HERO_IMAGE_QUALITY
// (défaut « medium » : le flat lay demande plus de détail qu'une vignette).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { CATEGORY_CANON, CATEGORY_FOLDER, type VestiaireRow } from "../_shared/imagePrompt.ts";
import { buildHeroImagePrompt } from "../_shared/heroPrompt.ts";
import { nomFichierHero, rognerSurLaPiece } from "../_shared/heroImage.ts";
import { dimensionsProportionnelles } from "../_shared/dimensions.ts";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import { estAppelantAdmin } from "../_shared/protection.ts";

const BUCKET = "catalog-images";
const DEFAULT_MODEL = "gpt-image-1";
const DEFAULT_QUALITY = "medium";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getAdminKey();
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("IMAGE_GENERATION_MODEL") || DEFAULT_MODEL;
  const quality = Deno.env.get("HERO_IMAGE_QUALITY") || DEFAULT_QUALITY;
  if (!supabaseUrl || !serviceRoleKey) return reponse({ ok: false, code: "config", message: ADMIN_KEY_MISSING }, 500);
  if (!openaiKey) return reponse({ ok: false, code: "config", message: "OPENAI_API_KEY manquante." }, 500);

  if (!estAppelantAdmin(req.headers.get("Authorization"), req.headers.get("apikey"), serviceRoleKey)) {
    return reponse({ ok: false, code: "interdit", message: "Réservé à l'administration." }, 403);
  }

  let itemId: number;
  let force = false;
  try {
    const body = await req.json();
    itemId = Number(body.item_id);
    force = body.force === true;
    if (!Number.isFinite(itemId)) throw new Error("item_id invalide");
  } catch {
    return reponse({ ok: false, code: "entree", message: "item_id manquant ou invalide." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: article, error: erreurLecture } = await supabase
    .from("vestiaire_universel")
    .select("id, name, category, sous_type, couleur_dominante, matiere, genre, coupe, niveau_tendance, silhouette_mode, details_mode, prompt_image_override, url_image_hero")
    .eq("id", itemId)
    .maybeSingle<VestiaireRow & { url_image_hero: string | null }>();
  if (erreurLecture) {
    // La colonne n'existe pas : la migration 0049 n'est pas exécutée. Rien n'est généré, rien n'est payé.
    return reponse({ ok: false, code: "migration", message: `Lecture impossible (${erreurLecture.message}) — la migration 0049 est-elle exécutée ?` }, 409);
  }
  if (!article) return reponse({ ok: false, code: "introuvable", message: "Article introuvable." }, 404);
  if (article.url_image_hero && !force) return reponse({ ok: true, deja: true, url: article.url_image_hero });

  const canon = CATEGORY_CANON[(article.category || "").trim().toLowerCase()];
  if (!canon) return reponse({ ok: false, code: "categorie", message: `Catégorie inconnue : ${article.category}` }, 422);
  const construit = buildHeroImagePrompt(article, null);
  if (!construit.ok) {
    return reponse({ ok: false, code: "incoherent", message: `Incohérence catégorie/sujet : « ${construit.canonCategory} » mais sujet « ${construit.noun} ». Génération annulée avant tout appel API.` }, 422);
  }

  let png: Uint8Array | null = null;
  let derniereErreur = "";
  for (let essai = 0; essai < 2 && !png; essai++) {
    try {
      png = await appelerImage(openaiKey, model, quality, construit.prompt);
    } catch (e) {
      derniereErreur = e instanceof Error ? e.message : String(e);
    }
  }
  if (!png) return reponse({ ok: false, code: "generation", message: derniereErreur || "Échec de génération." }, 502);

  // Rogner sur la pièce, plafonner à 800 px, encoder en WebP : le format est inscrit dans le nom du fichier.
  let webp: Uint8Array;
  let ratio: number;
  try {
    const { default: decoder } = await import("https://esm.sh/@jsquash/png@2.1.0/decode.js");
    const { default: redimensionner } = await import("https://esm.sh/@jsquash/resize@1.1.1");
    const { default: encoder } = await import("https://esm.sh/@jsquash/webp@1.4.0/encode.js");
    const decodee = await decoder(png.buffer as ArrayBuffer);
    const rognee = rognerSurLaPiece({ data: decodee.data, width: decodee.width, height: decodee.height });
    if (!rognee) return reponse({ ok: false, code: "vide", message: "L'image générée est vide (aucun pixel opaque)." }, 502);
    let image: { data: Uint8ClampedArray; width: number; height: number } = rognee;
    const cible = dimensionsProportionnelles(rognee.width, rognee.height);
    if (cible.width !== rognee.width || cible.height !== rognee.height) {
      image = await redimensionner(image as unknown as ImageData, cible);
    }
    ratio = image.width / image.height;
    webp = new Uint8Array(await encoder(image as unknown as ImageData, { quality: 80 }));
  } catch (e) {
    return reponse({ ok: false, code: "traitement", message: `Traitement de l'image impossible : ${e instanceof Error ? e.message : String(e)}` }, 500);
  }

  const genreBrut = (article.genre || "").trim().toLowerCase();
  const genre = genreBrut === "femme" ? "femme" : genreBrut === "homme" ? "homme" : "unisexe";
  const chemin = `hero/${genre}/${CATEGORY_FOLDER[canon] || canon}/${nomFichierHero(article.id, ratio, Date.now())}`;
  const { error: erreurUpload } = await supabase.storage.from(BUCKET).upload(chemin, webp, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (erreurUpload) return reponse({ ok: false, code: "upload", message: `Échec upload : ${erreurUpload.message}` }, 500);
  const { data: publique } = supabase.storage.from(BUCKET).getPublicUrl(chemin);

  const { error: erreurEcriture } = await supabase.from("vestiaire_universel").update({ url_image_hero: publique.publicUrl }).eq("id", article.id);
  if (erreurEcriture) return reponse({ ok: false, code: "ecriture", message: `Image envoyée mais colonne non écrite : ${erreurEcriture.message}`, url: publique.publicUrl }, 500);
  return reponse({ ok: true, url: publique.publicUrl, ratio: Number(ratio.toFixed(2)) });
});

async function appelerImage(cle: string, model: string, quality: string, prompt: string): Promise<Uint8Array> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, size: "1024x1024", quality, n: 1, background: "transparent", output_format: "png" }),
  });
  if (!res.ok) throw new Error(`Échec génération image (${res.status}) : ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Réponse OpenAI sans image (b64_json manquant).");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function reponse(corps: Record<string, unknown>, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
