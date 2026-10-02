import { getSupabase, isSupabaseConfigured } from "./supabase";
import { decomposerCle, nettoyer, type RetourAccord, type TableRetours } from "./retoursAccords";

/**
 * LES RETOURS SUR LES ACCORDS, DANS LE COMPTE (table accord_retours, migration 0047, 02/10/2026).
 *
 * La migration est exécutée à la main : tant qu'elle ne l'est pas, la table n'existe pas. Rien ici ne
 * lève donc jamais — une lecture qui échoue rend `null` (« on ne sait pas », l'appareil fait foi), une
 * écriture qui échoue rend `false`. Les retours restent alors sur l'appareil (retoursAccords.ts).
 */

export async function lireRetoursDuCompte(userId: string): Promise<TableRetours | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase().from("accord_retours").select("accord_cle, retour").eq("user_id", userId);
    if (error) return null;
    const table: Record<string, string> = {};
    for (const r of (data ?? []) as { accord_cle: string; retour: string }[]) table[r.accord_cle] = r.retour;
    return nettoyer(table);
  } catch {
    return null;
  }
}

/** Enregistre un retour, ou le retire (`retour` null). Rend false si l'écriture n'a pas abouti. */
export async function ecrireRetourDuCompte(userId: string, cle: string, retour: RetourAccord | null): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    if (retour === null) {
      const { error } = await getSupabase().from("accord_retours").delete().eq("user_id", userId).eq("accord_cle", cle);
      return !error;
    }
    const d = decomposerCle(cle);
    if (!d) return false;
    const { error } = await getSupabase()
      .from("accord_retours")
      .upsert({ user_id: userId, accord_cle: cle, saison: d.saison, couleurs: d.couleurs, retour }, { onConflict: "user_id,accord_cle" });
    return !error;
  } catch {
    return false;
  }
}

/** Renvoie vers le compte ce que seul l'appareil connaissait. Un échec est sans suite : ce sera retenté à la prochaine visite. */
export async function envoyerRetoursAuCompte(userId: string, table: TableRetours): Promise<void> {
  for (const [cle, retour] of Object.entries(table)) await ecrireRetourDuCompte(userId, cle, retour);
}
