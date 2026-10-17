import { createBrowserClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { estNatif } from "./authNatif";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when real Supabase credentials are configured; otherwise the app runs in demo mode. */
export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new Error("Supabase is not configured");
  // Dans l'app iOS / Android (17/10/2026) : la session dans le stockage local, pas dans des cookies — la vue web d'iOS, servie depuis
  // `capacitor://localhost`, ne garde pas les cookies posés par la page. Le retour de connexion est lu par auth.tsx (lien profond),
  // pas dans l'URL de la page. Sur le web, le client d'avant, inchangé.
  if (!client)
    client = estNatif()
      ? createClient(url!, anonKey!, {
          auth: { flowType: "pkce", storage: window.localStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
        })
      : createBrowserClient(url!, anonKey!);
  return client;
}
