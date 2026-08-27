// Edge Function delete-account (recette 25/08/2026) — supprime
// définitivement le compte Supabase Auth de l'appelant et toutes ses
// données. Ne peut pas être fait côté client : supprimer une ligne
// auth.users nécessite la clé service_role (jamais exposée au navigateur),
// que seule cette fonction, exécutée côté serveur, détient.
//
// Fichier volontairement autonome (aucun import vers ../_shared/*, même
// convention que analyze-dressing-photo) : déployable en copiant-collant
// ce seul fichier dans l'éditeur en ligne du dashboard Supabase.
//
// Sécurité : l'id à supprimer n'est JAMAIS lu depuis le corps de la
// requête — uniquement déduit du JWT envoyé dans l'en-tête Authorization
// par le client déjà connecté (getSupabase().functions.invoke envoie
// automatiquement la session en cours). Impossible pour un appelant de
// désigner un autre compte que le sien.
//
// Périmètre de la suppression :
// 1. Fichiers du bucket dressing-photos sous le préfixe {user_id}/ — un
//    retrait de ligne SQL ne supprime jamais les objets Storage associés,
//    ils resteraient orphelins sinon (droit à l'effacement RGPD).
// 2. auth.admin.deleteUser(user_id) — supprime la ligne auth.users, ce qui
//    cascade automatiquement (on delete cascade, déjà en place sur toutes
//    les migrations concernées) vers profiles, dressing_items,
//    outfit_history et saved_looks. Aucune suppression manuelle de ces
//    tables n'est donc nécessaire ici : un seul point de vérité pour la
//    cascade (le schéma), jamais une liste dupliquée et donc désynchronisable
//    à chaque nouvelle table utilisateur ajoutée plus tard.
//
// Déploiement SANS la CLI Supabase (dashboard) :
//   1. Dashboard Supabase → Edge Functions → "Deploy a new function".
//   2. Nom de la fonction : delete-account (exactement ce nom).
//   3. Coller l'intégralité de ce fichier, puis Deploy.
//   4. Aucun secret à ajouter tant que les clés JWT historiques sont
//      actives : SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont injectés
//      automatiquement par le runtime Edge Functions. Une fois ces clés
//      désactivées, il faut un secret SUPABASE_SECRET_KEY contenant la clé
//      `sb_secret_...` (cf. ../_shared/adminKey.ts).
//
// Déploiement avec la CLI (équivalent) :
//   supabase functions deploy delete-account

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ADMIN_KEY_MISSING, getAdminKey } from "../_shared/adminKey.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = getAdminKey();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonError(ADMIN_KEY_MISSING, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonError("Non authentifié.", 401);
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();

  // Client privilégié (service_role) — auth.getUser(jwt) valide le JWT de
  // l'appelant auprès du serveur Auth et renvoie l'utilisateur correspondant
  // SANS avoir besoin d'une session complète côté client : c'est le seul
  // moyen fiable de savoir qui appelle depuis une Edge Function. userId n'est
  // ensuite jamais lu ailleurs (jamais depuis le corps de la requête).
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userErr,
  } = await supabaseAdmin.auth.getUser(jwt);
  if (userErr || !user) return jsonError("Session invalide ou expirée.", 401);
  const userId = user.id;

  try {
    // 1. Fichiers du bucket dressing-photos (jamais cascadés par SQL).
    const { data: files, error: listErr } = await supabaseAdmin.storage.from("dressing-photos").list(userId);
    if (listErr) {
      console.error(JSON.stringify({ user_id: userId, step: "list_storage", error: listErr.message }));
    } else if (files?.length) {
      const paths = files.map((f) => `${userId}/${f.name}`);
      const { error: removeErr } = await supabaseAdmin.storage.from("dressing-photos").remove(paths);
      if (removeErr) {
        console.error(JSON.stringify({ user_id: userId, step: "remove_storage", error: removeErr.message }));
      }
    }

    // 2. Compte Auth — cascade profiles/dressing_items/outfit_history/saved_looks.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    return jsonOk({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur inconnue.";
    console.error(JSON.stringify({ user_id: userId, step: "delete_user", error: message }));
    return jsonError("Échec de la suppression du compte : " + message, 500);
  }
});

function jsonOk(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
