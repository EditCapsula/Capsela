import { getSupabase, isSupabaseConfigured } from "./supabase";
import type { OccasionKey } from "./types";

/*
 * LA LECTURE DU NOM D'UN ÉVÉNEMENT (22/10/2026, fonction Edge `lire-evenement`, supabase/functions/_shared/lectureEvenement.ts).
 *
 * Seulement pour un événement de type « Autre » qui a un nom : les autres types disent déjà leur occasion. La lecture ne fait que
 * traduire le nom en une occasion du moteur ; c'est toujours le moteur qui compose la tenue, avec les pièces du dressing. Jamais
 * bloquante : en mode démo, hors ligne, au-delà du quota ou sur une réponse douteuse, null — l'événement garde l'occasion de son type.
 */

/** Les occasions qu'un événement peut recevoir — miroir de OCCASIONS_EVENEMENT côté serveur (un test le verrouille). */
export const OCCASIONS_LISIBLES: readonly OccasionKey[] = ["quotidien", "travail_formel", "date", "soiree", "sport", "cocooning", "evenement_perso"];

export async function lireNomEvenement(nom: string): Promise<OccasionKey | null> {
  const propre = nom.trim();
  if (!propre || !isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase().functions.invoke("lire-evenement", { body: { nom: propre } });
    if (error) return null;
    const o = (data as { occasion?: unknown } | null)?.occasion;
    return typeof o === "string" && OCCASIONS_LISIBLES.includes(o as OccasionKey) ? (o as OccasionKey) : null;
  } catch {
    return null;
  }
}
