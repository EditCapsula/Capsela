// Edge Function video-recompense (24/09/2026) — accorde UNE génération
// supplémentaire après qu'une vidéo récompensée a été regardée jusqu'au bout.
//
// ELLE N'EST PAS APPELÉE PAR LE TÉLÉPHONE, ET C'EST TOUT LE SUJET. Le chemin
// est : le réseau publicitaire constate lui-même que la vidéo a été vue en
// entier, puis appelle CETTE fonction (server-side verification). L'app ne
// fait que déclencher la vidéo et attendre ; elle n'accorde rien, elle ne
// peut rien accorder — `accorder_bonus_generation` est révoquée à
// `authenticated` (migration 0033).
//
// Si le téléphone pouvait accorder le bonus, il suffirait d'appeler la
// fonction sans regarder quoi que ce soit. L'onglet réseau donne le nom de
// l'appel dès le premier usage légitime.
//
// FOURNISSEUR ARBITRÉ LE 02/11/2026 : GOOGLE ADMOB (src/lib/publicite.ts). AdMob appelle cette fonction en GET,
// tout dans l'adresse, signée avec une clé publique que Google publie (`_shared/admobSsv.ts`). La fonction :
//   1. vérifie la signature de Google — sans elle, 403, quoi que dise l'adresse ;
//   2. refuse un appel de plus d'une heure (adresse rejouée) ;
//   3. accorde le bonus au compte `user_id`, que l'app a passé à AdMob en chargeant la vidéo.
// Un rejeu dans l'heure ne rapporte rien : `accorder_bonus_generation` n'accorde qu'un bonus par jour.
//
// Déploiement SANS vérification de JWT (`--no-verify-jwt`, .github/workflows/deploy-supabase-function.yml) : AdMob
// n'a pas de jeton Supabase. C'est la signature de Google qui tient lieu d'authentification.
//
// Adresse à déclarer dans AdMob (bloc d'annonces → vérification côté serveur) :
//   https://tkrbzrazejrxavtfspll.supabase.co/functions/v1/video-recompense

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";
import {
  appelRecent,
  decouperAppelAdMob,
  signatureAdMobValide,
  URL_CLES_ADMOB,
  userIdValide,
  type CleAdMob,
} from "../_shared/admobSsv.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Les clés publiques de Google, gardées le temps de l'instance : Google les renouvelle rarement, et une clé inconnue
 * (renouvellement) relance la lecture une fois.
 */
let clesEnCache: CleAdMob[] | null = null;

async function clesAdMob(forcer = false): Promise<CleAdMob[]> {
  if (clesEnCache && !forcer) return clesEnCache;
  const r = await fetch(URL_CLES_ADMOB);
  if (!r.ok) throw new Error(`clés AdMob : HTTP ${r.status}`);
  const corps = (await r.json()) as { keys?: CleAdMob[] };
  clesEnCache = Array.isArray(corps.keys) ? corps.keys : [];
  return clesEnCache;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getAdminKey();
  if (!supabaseUrl || !serviceRoleKey) return json({ error: ADMIN_KEY_MISSING }, 500);

  const appel = decouperAppelAdMob(new URL(req.url).search);
  let verifie = false;
  if (appel) {
    try {
      let cles = await clesAdMob();
      if (!cles.some((c) => String(c.keyId) === appel.keyId)) cles = await clesAdMob(true);
      verifie = await signatureAdMobValide(appel, cles);
    } catch (e) {
      console.error(JSON.stringify({ etape: "cles", error: String(e) }));
      return json({ error: "Vérification indisponible." }, 503);
    }
  }
  if (!appel || !verifie) {
    // 403 et non 500 : la requête est comprise, elle n'est simplement pas
    // authentifiée. Le message ne dit pas POURQUOI elle échoue — un appelant
    // non légitime n'a pas à savoir ce qui manque.
    return json({ error: "Requête non vérifiée." }, 403);
  }
  if (!appelRecent(appel.timestamp, Date.now())) return json({ error: "Requête expirée." }, 403);

  // L'appel de test qu'AdMob envoie quand on enregistre l'adresse porte une signature valide mais pas de compte
  // Capsela : 200 sans rien accorder, pour que la console accepte l'adresse.
  if (!userIdValide(appel.userId)) return json({ accorde: false });
  const userId = appel.userId;

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin.rpc("accorder_bonus_generation", { p_user_id: userId });
  if (error) {
    console.error(JSON.stringify({ user_id: userId, error: error.message }));
    return json({ error: "Échec de l'attribution." }, 500);
  }
  // `accorde: false` n'est pas une erreur : c'est le bonus déjà pris du jour.
  const ligne = Array.isArray(data) ? data[0] : data;
  return json({ accorde: ligne?.accorde === true });
});

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
