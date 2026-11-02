import { getSupabase, isSupabaseConfigured } from "./supabase";
import { nettoyerVotes, type EtatSuggestion, type TableVotes } from "./votesSuggestions";

/**
 * LES VOTES SUR LES SUGGESTIONS, DANS LE COMPTE (table suggestions_capsule, migration 0056, 02/11/2026). Même contrat que
 * retoursAccordsCompte.ts : la migration est lancée à la main ; tant qu'elle ne l'est pas, une lecture rend `null` (l'appareil fait foi)
 * et une écriture rend `false` — les votes restent sur l'appareil et repartent vers le compte à la visite suivante. Rien ne lève.
 */

export async function lireVotesDuCompte(userId: string): Promise<TableVotes | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase().from("suggestions_capsule").select("piece_id, etat").eq("user_id", userId);
    if (error) return null;
    const table: Record<string, string> = {};
    for (const r of (data ?? []) as { piece_id: number; etat: string }[]) table[String(r.piece_id)] = r.etat;
    return nettoyerVotes(table);
  } catch {
    return null;
  }
}

/** Enregistre un état, ou le retire (`etat` null). Rend false si l'écriture n'a pas abouti. */
export async function ecrireVoteDuCompte(userId: string, pieceId: number, etat: EtatSuggestion | null): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const table = getSupabase().from("suggestions_capsule");
    const { error } =
      etat === null
        ? await table.delete().eq("user_id", userId).eq("piece_id", pieceId)
        : await table.upsert({ user_id: userId, piece_id: pieceId, etat }, { onConflict: "user_id,piece_id" });
    return !error;
  } catch {
    return false;
  }
}

/** Renvoie vers le compte ce que seul l'appareil connaissait. Un échec est sans suite : retenté à la visite suivante. */
export async function envoyerVotesAuCompte(userId: string, table: TableVotes): Promise<void> {
  for (const [cle, etat] of Object.entries(table)) await ecrireVoteDuCompte(userId, Number(cle), etat);
}
