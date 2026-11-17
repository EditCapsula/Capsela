// Edge Function revenuecat-webhook (17/11/2026, achats intégrés : src/lib/achats.ts) — reçoit les événements d'abonnement de
// RevenueCat et écrit le droit Premium dans premium_access (migration 0031), la table que lisent toutes les limites de l'app.
//
// Appelée par RevenueCat, qui n'a pas de jeton Supabase : déployée sans vérification du JWT (deploy-supabase-function.yml), elle
// s'authentifie par l'en-tête Authorization que la propriétaire configure dans RevenueCat (Integrations → Webhooks →
// « Authorization header value »), comparé au secret REVENUECAT_WEBHOOK_SECRET (Supabase → Edge Functions → Secrets). Sans secret, ou
// avec un en-tête différent : 401, rien n'est écrit.
//
// Ce que fait chaque événement : _shared/revenuecat.ts (pur, testé). Un accès accordé à la main (source « manuel ») n'est jamais
// remplacé ni retiré par un événement de store.
//
// Réponses : 200 quand l'événement est traité ou sans effet (RevenueCat ne le renvoie pas) ; 500 quand l'écriture échoue (RevenueCat
// le renverra plus tard).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import { autorisationValide, decisionEvenement, type EvenementRevenueCat } from "../_shared/revenuecat.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  if (!autorisationValide(req.headers.get("Authorization"), Deno.env.get("REVENUECAT_WEBHOOK_SECRET"))) {
    return json({ error: "Non autorisé." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const cle = getAdminKey();
  if (!supabaseUrl || !cle) return json({ error: ADMIN_KEY_MISSING }, 500);

  let corps: { event?: EvenementRevenueCat } | null = null;
  try {
    corps = await req.json();
  } catch {
    return json({ ok: true, ignore: "corps illisible" }, 200);
  }
  const decision = decisionEvenement(corps?.event);
  const admin = createClient(supabaseUrl, cle);

  try {
    if (decision.action === "activer") {
      const { data: existant } = await admin.from("premium_access").select("source, actif").eq("user_id", decision.userId).maybeSingle();
      if (existant?.source === "manuel" && existant.actif) return json({ ok: true, ignore: "accès manuel conservé" }, 200);
      const { error } = await admin
        .from("premium_access")
        .upsert({ user_id: decision.userId, actif: true, source: decision.source, expire_le: decision.expireLe }, { onConflict: "user_id" });
      if (error) throw error;
    } else if (decision.action === "retirer") {
      const { error } = await admin.from("premium_access").update({ actif: false }).in("user_id", decision.userIds).neq("source", "manuel");
      if (error) throw error;
    }
    console.log(JSON.stringify({ type: corps?.event?.type, decision: decision.action, environment: corps?.event?.environment }));
    return json({ ok: true, decision: decision.action }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    console.error(JSON.stringify({ type: corps?.event?.type, error: message }));
    return json({ error: "Écriture impossible : " + message }, 500);
  }
});

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
