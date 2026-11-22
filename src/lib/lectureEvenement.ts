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

/**
 * L'OCCASION DÉCRITE DANS PLANIFIER (22/11/2026) : la même lecture, avec ses PISTES — jusqu'à trois occasions plausibles quand le texte
 * ne permet pas de trancher (« signature chez le notaire »). Mêmes garanties : jamais bloquante, { occasion: null, suggestions: [] } en
 * démo, hors ligne, au-delà du quota ou sur une réponse douteuse.
 */
export async function lireOccasionDecrite(texte: string): Promise<{ occasion: OccasionKey | null; suggestions: OccasionKey[] }> {
  const vide = { occasion: null, suggestions: [] as OccasionKey[] };
  const propre = texte.trim();
  if (!propre || !isSupabaseConfigured) return vide;
  try {
    const { data, error } = await getSupabase().functions.invoke("lire-evenement", { body: { nom: propre } });
    if (error) return vide;
    const d = data as { occasion?: unknown; suggestions?: unknown } | null;
    const valide = (o: unknown): o is OccasionKey => typeof o === "string" && OCCASIONS_LISIBLES.includes(o as OccasionKey);
    const suggestions = Array.isArray(d?.suggestions) ? (d.suggestions as unknown[]).filter(valide).filter((o, i, t) => t.indexOf(o) === i).slice(0, 3) : [];
    return { occasion: valide(d?.occasion) ? d.occasion : null, suggestions };
  } catch {
    return vide;
  }
}
