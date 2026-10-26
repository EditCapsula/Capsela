// lire-evenement — le nom d'un événement de valise traduit en occasion (22/10/2026, cf. _shared/lectureEvenement.ts).
//
// Même protection que analyze-dressing-photo (_shared/protection.ts) : une utilisatrice connectée, un plafond par compte et par jour,
// OPENAI_API_KEY lue côté serveur seulement (secret déjà en place). Seul le NOM de l'événement part chez OpenAI, sans photo ni
// identifiant, journalisation refusée (store: false). Jamais une erreur dure : un échec donne { occasion: null } et l'app garde
// l'occasion du type choisi.
//
// Déploiement : automatique au merge sur main (workflow « Déployer les fonctions Supabase »).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import { authentifier, consommerQuota, estAppelantAdmin, jetonDepuisEntete, limiteDepuisEnv } from "../_shared/protection.ts";
import { invite, nomPropre, occasionLue } from "../_shared/lectureEvenement.ts";

// Plafond de lectures par compte et par jour : quelques événements par valise suffisent. Modifiable par le secret
// MAX_LECTURES_EVENEMENT_PER_USER_PER_DAY ; une valeur absente ou illisible ne retire jamais le plafond.
const DEFAULT_DAILY_LIMIT_PER_USER = 60;
const DEFAULT_MODEL = "gpt-4.1-mini";

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
  const model = Deno.env.get("LECTURE_EVENEMENT_MODEL") || DEFAULT_MODEL;
  if (!openaiKey) return json({ error: "Configuration serveur incomplète (OPENAI_API_KEY)." }, 500);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cleAdmin = getAdminKey();
  if (!supabaseUrl || !cleAdmin) return json({ error: ADMIN_KEY_MISSING }, 500);
  const admin = createClient(supabaseUrl, cleAdmin);
  const estAdmin = estAppelantAdmin(req.headers.get("Authorization"), req.headers.get("apikey"), cleAdmin);
  const utilisatrice = estAdmin ? null : await authentifier(admin, jetonDepuisEntete(req.headers.get("Authorization")));
  if (!estAdmin && !utilisatrice) return json({ error: "Non authentifié." }, 401);

  let nom = "";
  try {
    nom = nomPropre((await req.json()).nom);
  } catch {
    return json({ error: "nom manquant." }, 400);
  }
  if (!nom) return json({ occasion: null });

  if (utilisatrice) {
    const limite = limiteDepuisEnv(Deno.env.get("MAX_LECTURES_EVENEMENT_PER_USER_PER_DAY"), DEFAULT_DAILY_LIMIT_PER_USER);
    const quota = await consommerQuota(admin, utilisatrice.id, "lire-evenement", limite);
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
        max_tokens: 30,
        messages: [{ role: "user", content: invite(nom) }],
      }),
    });
    if (!res.ok) throw new Error(`Échec appel OpenAI (${res.status})`);
    const data = await res.json();
    const contenu = data?.choices?.[0]?.message?.content;
    return json({ occasion: contenu ? occasionLue(JSON.parse(contenu)) : null });
  } catch (err) {
    console.error(JSON.stringify({ fonction: "lire-evenement", error: err instanceof Error ? err.message : "inconnue" }));
    return json({ occasion: null });
  }
});
