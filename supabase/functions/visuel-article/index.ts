// visuel-article — le visuel indicatif d'un article lu sur un ticket de caisse (06/11/2026, _shared/visuelArticle.ts,
// docs/visuel-ticket.md).
//
// Même protection que lire-ticket : une utilisatrice connectée, la règle d'accès du ticket (LIRE_TICKET), un plafond par compte et par
// jour, OPENAI_API_KEY côté serveur seulement. L'image est créée par le moteur des visuels du catalogue (buildImagePrompt, fond
// transparent, WebP), puis rangée dans le dossier PRIVÉ de l'utilisatrice (dressing-photos/{user}/visuel-….detouree.webp) : la même
// description redemandée rend le même fichier, sans nouvelle génération ni quota consommé. Jamais une erreur dure : un échec rend
// { code } et l'app propose une photo.
//
// Secrets : OPENAI_API_KEY (déjà en place) ; facultatifs IMAGE_GENERATION_MODEL, IMAGE_GENERATION_QUALITY (ceux du catalogue) et
// MAX_VISUELS_ARTICLE_PER_USER_PER_DAY (30 par défaut). Déploiement : automatique au merge sur main.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import { buildImagePrompt } from "../_shared/imagePrompt.ts";
import { authentifier, consommerQuota, estAppelantAdmin, jetonDepuisEntete, limiteDepuisEnv } from "../_shared/protection.ts";
import { autoriserFonctionnalite, type LecteurPremium } from "../_shared/premium.ts";
import { articleValide, cheminVisuel, cleVisuel, ligneVestiaire } from "../_shared/visuelArticle.ts";
import { toWebp } from "../_shared/webp.ts";

const BUCKET = "dressing-photos";
const DEFAULT_DAILY_LIMIT_PER_USER = 30;
const DEFAULT_MODEL = "gpt-image-1";
const DEFAULT_QUALITY = "low";
/** La durée des liens rendus : celle des photos du dressing (DUREE_URL_PHOTO_DRESSING_S, 24 h). */
const DUREE_URL_S = 24 * 3600;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function empreinte(texte: string): Promise<string> {
  const octets = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texte)));
  return Array.from(octets.slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) return json({ error: "Configuration serveur incomplète (OPENAI_API_KEY)." }, 500);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cleAdmin = getAdminKey();
  if (!supabaseUrl || !cleAdmin) return json({ error: ADMIN_KEY_MISSING }, 500);
  const admin = createClient(supabaseUrl, cleAdmin);

  const estAdmin = estAppelantAdmin(req.headers.get("Authorization"), req.headers.get("apikey"), cleAdmin);
  const utilisatrice = estAdmin ? null : await authentifier(admin, jetonDepuisEntete(req.headers.get("Authorization")));
  if (!utilisatrice) return json({ error: "Non authentifié." }, 401);
  const verdict = await autoriserFonctionnalite(admin as unknown as LecteurPremium, utilisatrice, "LIRE_TICKET");
  if (!verdict.ok) return json({ error: verdict.raison }, verdict.statut);

  let article = null;
  try {
    article = articleValide(await req.json());
  } catch {
    article = null;
  }
  if (!article) return json({ error: "Article invalide." }, 400);

  const chemin = cheminVisuel(utilisatrice.id, await empreinte(cleVisuel(article)));
  const stockage = admin.storage.from(BUCKET);

  // Déjà créé pour la même description : rendu tel quel, sans génération ni quota.
  const deja = await stockage.createSignedUrl(chemin, DUREE_URL_S);
  if (!deja.error && deja.data?.signedUrl) return json({ url: deja.data.signedUrl, deja: true });

  const quota = await consommerQuota(admin, utilisatrice.id, "visuel-article", limiteDepuisEnv(Deno.env.get("MAX_VISUELS_ARTICLE_PER_USER_PER_DAY"), DEFAULT_DAILY_LIMIT_PER_USER));
  if (quota === "limite") return json({ code: "limite" });
  if (quota === "indisponible") return json({ code: "indisponible" });

  try {
    const { prompt } = buildImagePrompt(ligneVestiaire(article));
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("IMAGE_GENERATION_MODEL") || DEFAULT_MODEL,
        prompt,
        size: "1024x1024",
        quality: Deno.env.get("IMAGE_GENERATION_QUALITY") || DEFAULT_QUALITY,
        n: 1,
        background: "transparent",
        output_format: "png",
      }),
    });
    if (!res.ok) throw new Error(`génération ${res.status}`);
    const b64 = (await res.json())?.data?.[0]?.b64_json;
    if (!b64) throw new Error("réponse sans image");
    const image = await toWebp(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    // Une conversion WebP impossible rend le PNG : l'extension suit le format réel.
    const fichier = image.ext === "webp" ? chemin : chemin.replace(/\.webp$/, `.${image.ext}`);
    const envoi = await stockage.upload(fichier, image.bytes, { contentType: image.contentType, upsert: true });
    if (envoi.error) throw new Error("rangement");
    const signe = await stockage.createSignedUrl(fichier, DUREE_URL_S);
    if (signe.error || !signe.data?.signedUrl) throw new Error("signature");
    return json({ url: signe.data.signedUrl });
  } catch (err) {
    console.error(JSON.stringify({ fonction: "visuel-article", error: err instanceof Error ? err.message : "inconnue" }));
    return json({ code: "echec" });
  }
});
