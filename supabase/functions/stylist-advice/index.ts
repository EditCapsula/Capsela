// Fonction Edge « stylist-advice » — Avis de styliste (docs/avis-de-styliste.md).
//
// L'endpoint serveur de la spec (§10, §21) ne peut pas être une route
// Next.js : l'app est exportée en site statique (next.config.ts,
// `output: "export"`), sans serveur. Il est donc ici, comme les autres
// traitements serveur de Capsela (analyze-dressing-photo, delete-account).
//
// Ce fichier ne décide RIEN : il branche les vraies dépendances sur
// `traiterDemandeAvis` (_shared/avisStyliste.ts), où vivent l'ordre des
// contrôles, la validation et la charte — et leurs tests.
//
// Secrets (Supabase → Edge Functions → Secrets, jamais NEXT_PUBLIC_*) :
//   OPENAI_API_KEY               obligatoire (déjà utilisé par analyze-dressing-photo)
//   STYLIST_ADVICE_MODEL         facultatif, défaut MODELE_PAR_DEFAUT
//   STYLIST_ADVICE_TIMEOUT_MS    facultatif, défaut 45000 (arbitré)
//   SUPABASE_URL + SB_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY (cf. _shared/adminKey.ts)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAdminKey } from "../_shared/adminKey.ts";
import { corsHeaders } from "../_shared/cors.ts";
import type { LecteurPremium } from "../_shared/premium.ts";
import { DELAI_PAR_DEFAUT_MS, MODELE_PAR_DEFAUT, traiterDemandeAvis } from "../_shared/avisStyliste.ts";

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
    // Aucun appel au modèle possible, et aucun détail renvoyé au client.
    console.error("[stylist-advice] configuration serveur incomplète");
    return reponse(500, { ok: false, code: "configuration" });
  }

  const admin = createClient(supabaseUrl, cleAdmin);
  let corps: unknown = null;
  try {
    corps = await req.json();
  } catch {
    corps = null;
  }

  const delai = Number(Deno.env.get("STYLIST_ADVICE_TIMEOUT_MS"));
  const resultat = await traiterDemandeAvis(req.headers.get("Authorization"), corps, {
    authentifier: async (jwt) => {
      const { data, error } = await admin.auth.getUser(jwt);
      return error || !data.user ? null : { id: data.user.id };
    },
    // Client service role : lit premium_access sans dépendre de la RLS.
    lecteurPremium: admin as unknown as LecteurPremium,
    appelerModele: async (requete, signal) => {
      const res = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: { Authorization: `Bearer ${cleOpenAI}`, "Content-Type": "application/json" },
        body: JSON.stringify(requete),
        signal,
      });
      const json = await res.json().catch(() => null);
      // Seuls le statut et le type d'erreur sont journalisés — jamais la
      // photo, jamais le texte de la requête ni de la réponse.
      if (!res.ok) console.error("[stylist-advice] OpenAI", res.status, (json as { error?: { type?: string } } | null)?.error?.type ?? "");
      return { ok: res.ok, json };
    },
    // Suivi du coût par analyse (§19). À ARBITRER: stockage de ce journal
    // (§23, table dédiée ou outil analytics) — en attendant, les logs de la
    // fonction, qui ne contiennent ni photo, ni conseil, ni identité.
    journaliser: (ligne) => console.log(JSON.stringify(ligne)),
    maintenant: () => Date.now(),
    nouvelId: () => crypto.randomUUID(),
    modele: Deno.env.get("STYLIST_ADVICE_MODEL") || MODELE_PAR_DEFAUT,
    delaiMs: Number.isFinite(delai) && delai > 0 ? delai : DELAI_PAR_DEFAUT_MS,
  });
  return reponse(resultat.statut, resultat.corps);
});
