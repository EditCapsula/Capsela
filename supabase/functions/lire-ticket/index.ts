// lire-ticket — la photo d'un ticket de caisse lue pour préremplir des fiches de pièces (30/10/2026, cf. _shared/lectureTicket.ts).
//
// Même protection que lire-evenement et analyze-dressing-photo (_shared/protection.ts) : une utilisatrice connectée, un plafond par
// compte et par jour, OPENAI_API_KEY lue côté serveur seulement (secret déjà en place). La photo arrive en données (data URL JPEG), est
// envoyée à OpenAI sans journalisation (store: false), et N'EST JAMAIS ENREGISTRÉE : ni bucket, ni base. Seuls le nom du magasin et
// les articles vestimentaires reviennent à l'app (ticketLu) ; jamais un prix, une date ni un numéro. Jamais une erreur dure côté
// lecture : un échec donne { magasin: null, articles: [] } et l'app propose la saisie à la main.
//
// Déploiement : automatique au merge sur main (workflow « Déployer les fonctions Supabase »).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import { authentifier, consommerQuota, estAppelantAdmin, jetonDepuisEntete, limiteDepuisEnv } from "../_shared/protection.ts";
import { inviteTicket, ticketLu } from "../_shared/lectureTicket.ts";

// Plafond de tickets par compte et par jour. Modifiable par le secret MAX_TICKETS_PER_USER_PER_DAY ; une valeur absente ou illisible ne
// retire jamais le plafond.
const DEFAULT_DAILY_LIMIT_PER_USER = 20;
const DEFAULT_MODEL = "gpt-4.1-mini";
/** Une photo réduite côté app pèse quelques centaines de Ko ; au-delà de 4 Mo de texte base64, elle est refusée. */
const IMAGE_MAX = 4_000_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("LECTURE_TICKET_MODEL") || DEFAULT_MODEL;
  if (!openaiKey) return json({ error: "Configuration serveur incomplète (OPENAI_API_KEY)." }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cleAdmin = getAdminKey();
  if (!supabaseUrl || !cleAdmin) return json({ error: ADMIN_KEY_MISSING }, 500);
  const admin = createClient(supabaseUrl, cleAdmin);
  const estAdmin = estAppelantAdmin(req.headers.get("Authorization"), req.headers.get("apikey"), cleAdmin);
  const utilisatrice = estAdmin ? null : await authentifier(admin, jetonDepuisEntete(req.headers.get("Authorization")));
  if (!estAdmin && !utilisatrice) return json({ error: "Non authentifié." }, 401);

  let image = "";
  try {
    image = String((await req.json()).image ?? "");
  } catch {
    return json({ error: "image manquante." }, 400);
  }
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > IMAGE_MAX) return json({ error: "image invalide." }, 400);

  if (utilisatrice) {
    const limite = limiteDepuisEnv(Deno.env.get("MAX_TICKETS_PER_USER_PER_DAY"), DEFAULT_DAILY_LIMIT_PER_USER);
    const quota = await consommerQuota(admin, utilisatrice.id, "lire-ticket", limite);
    if (quota === "limite") return json({ error: "Limite quotidienne atteinte." }, 429);
    if (quota === "indisponible") return json({ error: "Service momentanément indisponible." }, 503);
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        store: false,
        temperature: 0,
        response_format: { type: "json_object" },
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: inviteTicket() },
              // Haute définition : le texte d'un ticket est petit.
              { type: "image_url", image_url: { url: image, detail: "high" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Échec appel OpenAI (${res.status})`);
    const data = await res.json();
    const contenu = data?.choices?.[0]?.message?.content;
    return json({ ...(contenu ? ticketLu(JSON.parse(contenu)) : { magasin: null, articles: [] }) });
  } catch (err) {
    // Jamais l'image ni le contenu du ticket dans les journaux.
    console.error(JSON.stringify({ fonction: "lire-ticket", error: err instanceof Error ? err.message : "inconnue" }));
    return json({ magasin: null, articles: [] });
  }
});
