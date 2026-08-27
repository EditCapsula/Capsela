// Clé privilégiée des fonctions Edge — celle qui contourne les règles RLS.
//
// Migration en cours (27/08/2026) : Supabase remplace les clés JWT historiques
// (`anon` / `service_role`) par un nouveau système (`sb_publishable_...` /
// `sb_secret_...`). Les deux anciennes ne peuvent être désactivées qu'ensemble,
// et `anon` fait tourner l'app entière — la bascule doit donc se faire par
// étapes, sans jamais laisser de trou.
//
// D'où cet ordre de lecture :
//   1. SUPABASE_SECRET_KEY — secret à définir soi-même dans
//      Settings > Edge Functions > Secrets, contenant la clé `sb_secret_...` ;
//   2. SUPABASE_SERVICE_ROLE_KEY — variable injectée automatiquement par
//      Supabase, encore valable tant que les clés JWT ne sont pas désactivées.
//
// Tant que le secret n'est pas posé, tout continue de fonctionner par le
// repli. Une fois posé, les fonctions n'ont plus besoin des clés JWT et
// celles-ci peuvent être désactivées sans interruption de service.
export function getAdminKey(): string | undefined {
  return Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
}

/** Message d'erreur commun, pour ne pas laisser croire qu'une seule des deux variables est attendue. */
export const ADMIN_KEY_MISSING =
  "Configuration serveur incomplète : SUPABASE_URL et l'une de SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY sont requises.";
