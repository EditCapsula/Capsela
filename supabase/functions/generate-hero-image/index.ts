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
// DEPUIS LA PHOTO DU CATALOGUE (16/11/2026, arbitré : « option 2, commence par les robes »). L'audit visuels-coherence a montré que le
// visuel hero, dessiné d'après la seule description, ne représente souvent pas la même pièce que la photo du catalogue (338 écarts
// majeurs sur 619, dont la « Robe pull midi cintrée »). Avec `depuis_photo: true`, la photo du catalogue (url_image) est donnée au
// modèle comme RÉFÉRENCE (images/edits) : il pose à plat CE vêtement-là. Sans l'option, la génération d'avant, inchangée. L'ancien
// fichier n'est jamais effacé (le nouveau a son propre nom) : revenir en arrière, c'est remettre l'ancienne URL dans la colonne.
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
  let depuisPhoto = false;
  try {
    const body = await req.json();
    itemId = Number(body.item_id);
    force = body.force === true;
    depuisPhoto = body.depuis_photo === true;
    if (!Number.isFinite(itemId)) throw new Error("item_id invalide");
  } catch {
    return reponse({ ok: false, code: "entree", message: "item_id manquant ou invalide." }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: article, error: erreurLecture } = await supabase
    .from("vestiaire_universel")
    .select("id, name, category, sous_type, couleur_dominante, matiere, genre, coupe, niveau_tendance, silhouette_mode, details_mode, prompt_image_override, url_image_hero, url_image")
    .eq("id", itemId)
    .maybeSingle<VestiaireRow & { url_image_hero: string | null; url_image: string | null }>();
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

  // La référence : la photo du catalogue, lue avant tout appel payant.
  let reference: Blob | null = null;
  if (depuisPhoto) {
    if (!article.url_image) return reponse({ ok: false, code: "reference", message: "Pas de photo du catalogue (url_image) à prendre pour référence." }, 422);
    const r = await fetch(article.url_image);
    if (!r.ok) return reponse({ ok: false, code: "reference", message: `Photo du catalogue illisible (${r.status}).` }, 502);
    const type = r.headers.get("content-type") || "image/webp";
    reference = new Blob([await r.arrayBuffer()], { type });
  }

  let png: Uint8Array | null = null;
  let derniereErreur = "";
  for (let essai = 0; essai < 2 && !png; essai++) {
    try {
      png = reference
        ? await appelerImageDepuisPhoto(openaiKey, model, quality, `${CONSIGNE_REFERENCE}\n\n${construit.prompt}`, reference)
        : await appelerImage(openaiKey, model, quality, construit.prompt);
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

/** La consigne qui précède le prompt hero quand la photo du catalogue sert de référence. */
const CONSIGNE_REFERENCE = [
  "The reference image shows the exact garment to depict.",
  "Reproduce THIS garment exactly: same type, cut, neckline or collar, sleeves, length, closures (buttons, zip, wrap, tie, belt), pockets,",
  "pattern, color and material. Do not redesign it, do not add or remove any detail.",
  "Only change the presentation: laid flat, seen from above, with natural soft folds, as described below.",
].join(" ");

async function appelerImageDepuisPhoto(cle: string, model: string, quality: string, prompt: string, reference: Blob): Promise<Uint8Array> {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("image", reference, reference.type.includes("png") ? "reference.png" : reference.type.includes("jpeg") ? "reference.jpg" : "reference.webp");
  form.append("size", "1024x1024");
  form.append("quality", quality);
  form.append("background", "transparent");
  form.append("output_format", "png");
  form.append("n", "1");
  const res = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${cle}` }, body: form });
  if (!res.ok) throw new Error(`Échec génération image depuis la photo (${res.status}) : ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Réponse OpenAI sans image (b64_json manquant).");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function reponse(corps: Record<string, unknown>, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
