import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { CategorieNotification, NotificationCapsela, TypeNotification } from "./centreNotifications";

/**
 * LES NOTIFICATIONS DANS LE COMPTE (table notifications, migration 0063, 12/11/2026). Même contrat que votesSuggestionsCompte.ts : la
 * migration est lancée à la main ; tant qu'elle ne l'est pas, une lecture rend `null` (l'appareil fait foi) et une écriture rend `false`
 * — les notifications restent sur l'appareil et repartent vers le compte à la visite suivante. Rien ne lève.
 */

export const PAGE_NOTIFICATIONS = 50;

interface Ligne {
  id: string;
  type: string;
  category: string;
  title: string;
  message: string;
  target_url: string | null;
  is_read: boolean;
  dedup_key: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const COLONNES = "id, type, category, title, message, target_url, is_read, dedup_key, metadata, created_at";

const depuisLigne = (r: Ligne): NotificationCapsela => ({
  id: r.id,
  cle: r.dedup_key,
  type: r.type as TypeNotification,
  categorie: r.category as CategorieNotification,
  titre: r.title,
  message: r.message,
  cible: r.target_url,
  lue: r.is_read,
  creeeLe: r.created_at,
  ...(r.metadata ? { meta: r.metadata } : {}),
});

/** Les plus récentes d'abord, par pages ; `avant` : la date de la dernière déjà lue (pagination par curseur, stable). */
export async function lireNotificationsDuCompte(userId: string, avant?: string): Promise<NotificationCapsela[] | null> {
  if (!isSupabaseConfigured) return null;
  try {
    let q = getSupabase().from("notifications").select(COLONNES).eq("user_id", userId).order("created_at", { ascending: false }).limit(PAGE_NOTIFICATIONS);
    if (avant) q = q.lt("created_at", avant);
    const { data, error } = await q;
    if (error) return null;
    return ((data ?? []) as Ligne[]).map(depuisLigne);
  } catch {
    return null;
  }
}

/** Ajoute ce que le compte n'a pas ; une clé déjà connue est ignorée (contrainte unique), jamais dédoublée. */
export async function ecrireNotificationsAuCompte(userId: string, liste: readonly NotificationCapsela[]): Promise<boolean> {
  if (!isSupabaseConfigured || !liste.length) return !liste.length;
  try {
    const { error } = await getSupabase()
      .from("notifications")
      .upsert(
        liste.map((n) => ({
          user_id: userId,
          type: n.type,
          category: n.categorie,
          title: n.titre,
          message: n.message,
          target_url: n.cible,
          is_read: n.lue,
          read_at: n.lue ? new Date().toISOString() : null,
          dedup_key: n.cle,
          metadata: n.meta ?? null,
          created_at: n.creeeLe,
        })),
        { onConflict: "user_id,dedup_key", ignoreDuplicates: true }
      );
    return !error;
  } catch {
    return false;
  }
}

/** Marque lues les notifications de ces clés ; `null` : toutes celles du compte. */
export async function marquerLuesAuCompte(userId: string, cles: readonly string[] | null): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  if (cles && !cles.length) return true;
  try {
    let q = getSupabase().from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", userId).eq("is_read", false);
    if (cles) q = q.in("dedup_key", [...cles]);
    const { error } = await q;
    return !error;
  } catch {
    return false;
  }
}
