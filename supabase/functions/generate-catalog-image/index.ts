// Edge Function generate-catalog-image (recette 18/08/2026, gestion
// automatique des images produit du catalogue).
//
// Entrée : { item_id: number } — id BRUT de la ligne vestiaire_universel
// (pas l'id décalé de VESTIAIRE_ID_OFFSET côté app, cf. src/lib/vestiaire.ts).
//
// Étapes : récupère l'article -> revérifie url_image -> cherche un visuel
// réutilisable par clé visuelle -> sinon passe generating, construit le
// prompt, appelle OpenAI (gpt-image-1), upload dans Storage, met à jour la
// ligne, retourne image_url. Erreur à n'importe quelle étape -> image_status
// = error, jamais d'exception non gérée (le frontend garde le placeholder).
//
// Sécurité : OPENAI_API_KEY n'est lue que côté serveur (secret Supabase),
// jamais transmise au frontend. Déployer avec :
//   supabase functions deploy generate-catalog-image
//   supabase secrets set OPENAI_API_KEY=sk-...
//
// Limite connue : gpt-image-1 ne peut renvoyer que du PNG (pas de WebP
// natif) — stocké tel quel (`{id}-v{version}.png`) plutôt que de dépendre
// d'une conversion WebP en Deno non testable depuis cet environnement.
// Reste compatible à l'identique côté affichage (object-fit: contain).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { buildImagePrompt, storageFolderFor, type VestiaireRow } from "../_shared/imagePrompt.ts";

const BUCKET = "catalog-images";

interface VestiaireImageRow extends VestiaireRow {
  url_image: string | null;
  image_status: string | null;
  image_version: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError("Configuration serveur incomplète (SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY).", 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let itemId: number;
  try {
    const body = await req.json();
    itemId = Number(body.item_id);
    if (!Number.isFinite(itemId)) throw new Error("item_id invalide");
  } catch {
    return jsonError("item_id manquant ou invalide.", 400);
  }

  // 1-2. Récupère l'article, revérifie image_url (course possible entre deux
  // requêtes concurrentes sur la même pièce).
  const { data: row, error: fetchError } = await supabase
    .from("vestiaire_universel")
    .select(
      "id, name, category, sous_type, couleur_dominante, matiere, genre, styles, url_image, image_status, image_version"
    )
    .eq("id", itemId)
    .maybeSingle<VestiaireImageRow>();

  if (fetchError || !row) {
    return jsonError("Article introuvable.", 404);
  }
  if (row.url_image) {
    // 3. Déjà présente : retour immédiat, aucun appel API image.
    return jsonOk({ image_url: row.url_image });
  }

  try {
    // Clé visuelle (genre_category_sousType_couleur_matiere) : réutilise un
    // visuel déjà généré pour un article strictement équivalent plutôt que
    // d'en régénérer un — évite les doublons et les appels API inutiles.
    const { data: twin } = await supabase
      .from("vestiaire_universel")
      .select("url_image")
      .eq("image_status", "ready")
      .not("url_image", "is", null)
      .eq("category", row.category ?? "")
      .eq("sous_type", row.sous_type ?? "")
      .eq("couleur_dominante", row.couleur_dominante ?? "")
      .eq("matiere", row.matiere ?? "")
      .eq("genre", row.genre ?? "")
      .neq("id", row.id)
      .limit(1)
      .maybeSingle<{ url_image: string }>();

    if (twin?.url_image) {
      await supabase
        .from("vestiaire_universel")
        .update({
          url_image: twin.url_image,
          image_status: "ready",
          image_source: "generated",
          image_generated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      return jsonOk({ image_url: twin.url_image });
    }

    if (!openaiKey) {
      throw new Error("OPENAI_API_KEY absente des secrets Supabase.");
    }

    // 4. generating.
    await supabase.from("vestiaire_universel").update({ image_status: "generating" }).eq("id", row.id);

    // 5. Prompt.
    const prompt = buildImagePrompt(row);

    // 6-7. Génération (OpenAI gpt-image-1) — toujours du PNG en base64.
    const genRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
      }),
    });
    if (!genRes.ok) {
      const detail = await genRes.text().catch(() => "");
      throw new Error(`Échec génération image (${genRes.status}) : ${detail.slice(0, 300)}`);
    }
    const genData = await genRes.json();
    const b64 = genData?.data?.[0]?.b64_json;
    if (!b64) throw new Error("Réponse OpenAI sans image (b64_json manquant).");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

    // 8. Upload Storage.
    const version = (row.image_version ?? 0) + 1;
    const path = `${storageFolderFor(row)}/${row.id}-v${version}.png`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: "image/png", upsert: true });
    if (uploadError) throw new Error(`Échec upload Storage : ${uploadError.message}`);

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const imageUrl = publicUrlData.publicUrl;

    // 9-12. Mise à jour de la ligne.
    const { error: updateError } = await supabase
      .from("vestiaire_universel")
      .update({
        url_image: imageUrl,
        image_prompt: prompt,
        image_status: "ready",
        image_source: "generated",
        image_generated_at: new Date().toISOString(),
        image_version: version,
      })
      .eq("id", row.id);
    if (updateError) throw new Error(`Échec mise à jour de la ligne : ${updateError.message}`);

    // 13. Retour.
    return jsonOk({ image_url: imageUrl });
  } catch (err) {
    await supabase.from("vestiaire_universel").update({ image_status: "error" }).eq("id", row.id);
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    return jsonError(message, 500);
  }
});

function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
