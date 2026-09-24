import { GENERATIONS_GRATUITES_PAR_JOUR } from "./premium";
import { getSupabase, isSupabaseConfigured } from "./supabase";

/**
 * QUOTA DE GÉNÉRATIONS — « Autre tenue », 2 par jour sans abonnement.
 *
 * Tout se décide côté base (migration 0032, fonction `consommer_generation`
 * en `security definer`). Ce fichier ne fait que l'appeler et traduire sa
 * réponse : il ne compte rien, ne mémorise rien, et surtout ne décide rien
 * qu'un navigateur pourrait réécrire.
 *
 * CE QUI EST DÉCOMPTÉ. Seul le geste volontaire « Autre tenue ». La tenue du
 * jour générée à l'ouverture ne l'est jamais — la limite borne l'exploration,
 * pas l'usage.
 *
 * COMME POUR LE DRESSING, ON ÉCHOUE EN OUVRANT. `null` veut dire « on ne sait
 * pas » : réseau coupé, mode démo, ou migration 0032 pas encore exécutée. Dans
 * ces trois cas AUCUNE limite ne s'applique. C'est ce qui rend cette
 * fonctionnalité déployable avant la table : tant que la fonction n'existe pas
 * en base, l'appel échoue et personne n'est bloqué.
 */

export interface QuotaGeneration {
  /** false = la limite était déjà atteinte, rien n'a été consommé. */
  consomme: boolean;
  utilisees: number;
  limite: number;
  premium: boolean;
}

/**
 * Peut-on afficher la tenue demandée ?
 *
 * Pure, donc testée. `consomme` est le seul champ qui tranche, et c'est
 * délibéré : après le deuxième tirage, `utilisees` vaut 2 — exactement comme
 * lors d'une troisième tentative refusée. Le compteur seul ne distingue pas
 * les deux ; la base, elle, sait si elle a écrit ou non.
 */
export function generationAutorisee(quota: QuotaGeneration | null): boolean {
  if (!quota) return true;
  if (quota.premium) return true;
  return quota.consomme;
}

/** Ce qu'il reste après coup, ou null quand il n'y a pas de limite à annoncer. */
export function generationsRestantes(quota: QuotaGeneration | null): number | null {
  if (!quota || quota.premium) return null;
  return Math.max(0, quota.limite - quota.utilisees);
}

/**
 * Consomme une génération et dit si elle était permise. Ne jette jamais :
 * un échec rend `null`, que `generationAutorisee` traite comme « permise ».
 */
export async function consommerGeneration(): Promise<QuotaGeneration | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data, error } = await getSupabase().rpc("consommer_generation");
    if (error) return null;
    return lireQuota(data);
  } catch {
    return null;
  }
}

/**
 * Lecture de la réponse du RPC — pure, donc testée.
 *
 * PostgREST rend une fonction `returns table` sous forme de tableau de lignes,
 * même quand il n'y en a qu'une. On accepte les deux formes plutôt que de
 * parier sur l'une : une réponse mal formée rend `null`, donc « on ne sait
 * pas », donc aucune limite — jamais un blocage sur une valeur qu'on n'a pas
 * comprise.
 */
export function lireQuota(data: unknown): QuotaGeneration | null {
  const ligne = Array.isArray(data) ? data[0] : data;
  if (!ligne || typeof ligne !== "object") return null;
  const q = ligne as Partial<QuotaGeneration>;
  if (typeof q.consomme !== "boolean") return null;
  if (typeof q.utilisees !== "number" || typeof q.limite !== "number") return null;
  return {
    consomme: q.consomme,
    utilisees: q.utilisees,
    // La limite vient de la base, jamais de la constante d'affichage : si les
    // deux divergeaient un jour, c'est la base qui a raison — c'est elle qui
    // l'applique. La constante ne sert qu'à écrire le chiffre sur la vitrine.
    limite: q.limite,
    premium: q.premium === true,
  };
}

/** Le chiffre annoncé sur l'écran Premium, pour n'avoir qu'une source côté client. */
export const LIMITE_AFFICHEE = GENERATIONS_GRATUITES_PAR_JOUR;
