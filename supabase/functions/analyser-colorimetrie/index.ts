// Fonction Edge « analyser-colorimetrie » — colorimétrie par photo (docs/colorimetrie.md).
//
// Ce fichier ne décide RIEN : il branche les vraies dépendances sur
// `traiterDemandeColorimetrie` (_shared/colorimetrie.ts), où vivent l'ordre des
// contrôles (authentification, consentement, fichier), la lecture de la
// réponse et leurs tests.
//
// DÉPLOYÉE NE VEUT PAS DIRE OUVERTE : l'app ne propose la photo que si
// NEXT_PUBLIC_COLORIMETRIE_PHOTO=1 est posé dans Vercel, après la revue
// juridique (arbitré le 30/09/2026).
//
// Secrets (Supabase → Edge Functions → Secrets, jamais NEXT_PUBLIC_*) :
//   OPENAI_API_KEY               obligatoire (déjà utilisé par stylist-advice)
//   COLORIMETRIE_MODEL           facultatif, défaut MODELE_PAR_DEFAUT
//   SUPABASE_URL + SB_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY (cf. _shared/adminKey.ts)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAdminKey } from "../_shared/adminKey.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { DELAI_COLORIMETRIE_MS, MODELE_PAR_DEFAUT, traiterDemandeColorimetrie } from "../_shared/colorimetrie.ts";

function reponse(statut: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reponse(405, { ok: false, code: "configuration" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cleAdmin = getAdminKey();
  const cleOpenAI = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !cleAdmin || !cleOpenAI) {
    console.error("[analyser-colorimetrie] configuration serveur incomplète");
    return reponse(500, { ok: false, code: "configuration" });
  }

  const admin = createClient(supabaseUrl, cleAdmin);
  let corps: unknown = null;
  try {
    corps = await req.json();
  } catch {
    corps = null;
  }

  const resultat = await traiterDemandeColorimetrie(req.headers.get("Authorization"), corps, {
    authentifier: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id };
    },
    appelerModele: async (requete, signal) => {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${cleOpenAI}`, "Content-Type": "application/json" },
        body: JSON.stringify(requete),
        signal,
      });
      const json = await res.json().catch(() => null);
      // Seuls le statut et le type d'erreur sont journalisés — jamais la photo.
      if (!res.ok) console.error("[analyser-colorimetrie] OpenAI", res.status, (json as { error?: { type?: string } } | null)?.error?.type ?? "");
      return { ok: res.ok, json };
    },
    journaliser: (ligne) => console.log(JSON.stringify(ligne)),
    maintenant: () => Date.now(),
    modele: Deno.env.get("COLORIMETRIE_MODEL") || MODELE_PAR_DEFAUT,
    delaiMs: DELAI_COLORIMETRIE_MS,
  });
  return reponse(resultat.statut, resultat.corps);
});
