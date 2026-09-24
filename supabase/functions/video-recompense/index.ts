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
// ÉTAT AU 24/09/2026 : AUCUN FOURNISSEUR N'EST ARBITRÉ. La fonction est donc
// complète SAUF sa vérification de signature, qui dépend du fournisseur —
// AdMob signe avec une clé publique qu'on récupère sur un endpoint Google,
// Unity et AppLovin utilisent un HMAC sur un secret partagé. Les trois ne se
// vérifient pas de la même façon, et écrire l'un des trois « au cas où »
// reviendrait à écrire du code qu'on ne pourra pas tester.
//
// En attendant, `verifierSignature` REFUSE TOUT. Ce n'est pas un trou laissé
// ouvert « en attendant » : c'est une porte fermée, et le seul moyen de
// l'ouvrir est de choisir un fournisseur et d'écrire sa vérification.
//
// Déploiement : inutile tant qu'aucun fournisseur n'existe. Le fichier est là
// pour que la mise en place se limite à trois gestes — choisir le
// fournisseur, écrire `verifierSignature`, poser le secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Vérifie que la requête vient bien du réseau publicitaire et concerne une
 * vidéo réellement visionnée.
 *
 * REFUSE TANT QU'AUCUN FOURNISSEUR N'EST CHOISI. Le secret n'existe pas, donc
 * il n'y a rien à comparer, donc on refuse — jamais l'inverse.
 */
async function verifierSignature(req: Request, corps: string): Promise<boolean> {
  const secret = Deno.env.get("VIDEO_SSV_SECRET");
  if (!secret) return false;
  // À écrire avec le fournisseur retenu : HMAC sur `corps` pour Unity et
  // AppLovin, vérification de signature par clé publique pour AdMob. Les deux
  // paramètres sont là pour que la signature de la fonction n'ait pas à
  // changer ce jour-là.
  void req;
  void corps;
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getAdminKey();
  if (!supabaseUrl || !serviceRoleKey) return json({ error: ADMIN_KEY_MISSING }, 500);

  const corps = await req.text();

  if (!(await verifierSignature(req, corps))) {
    // 403 et non 500 : la requête est comprise, elle n'est simplement pas
    // authentifiée. Le message ne dit pas POURQUOI elle échoue — un appelant
    // non légitime n'a pas à savoir s'il manque un secret ou si sa signature
    // est mauvaise.
    return json({ error: "Requête non vérifiée." }, 403);
  }

  let userId: string;
  try {
    userId = String(JSON.parse(corps).user_id || "");
    if (!userId) throw new Error("user_id manquant");
  } catch {
    return json({ error: "user_id manquant ou invalide." }, 400);
  }

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
