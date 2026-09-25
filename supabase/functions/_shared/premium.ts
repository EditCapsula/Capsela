// Contrôle Premium CÔTÉ SERVEUR, pour les fonctions Edge (Avis de styliste,
// docs/avis-de-styliste.md section 5, 25/09/2026).
//
// POURQUOI ICI. Jusqu'à ce fichier, aucune fonction Edge ne lisait
// `premium_access` : le seul contrôle serveur était la fonction SQL
// `consommer_generation()` (migrations 0032/0033). Or l'Avis de styliste doit
// refuser un compte non Premium AVANT tout appel au modèle [DÉCIDÉ], et le
// masquage côté client ne suffit pas.
//
// ÉCHOUE EN FERMANT (arbitré le 25/09/2026). Si le statut ne peut pas être lu
// (erreur de base, table absente), la réponse est un REFUS — l'inverse de la
// règle « les paywalls échouent en ouvrant » de l'app (src/lib/premium.ts),
// parce qu'un accès accordé à tort déclenche ici un appel payant.
//
// Aucun import propre à Deno : le fichier est importé tel quel par les tests
// vitest (src/lib/__tests__/premiumServeur.test.ts), comme _shared/visualKey.ts.
// Le client Supabase est reçu en paramètre, typé par sa seule forme utile.

/** Ligne de `premium_access` (migration 0031) — seules les colonnes lues. */
export interface PremiumAccessRow {
  actif: boolean;
  expire_le: string | null;
}

/**
 * Ligne absente, désactivée ou expirée : pas de droit.
 * COPIE de `estActif` (src/lib/premium.ts) — le test miroir vérifie que les
 * deux rendent le même verdict ; à garder identique.
 */
export function estActif(row: PremiumAccessRow | null, maintenant = new Date()): boolean {
  if (!row || !row.actif) return false;
  if (!row.expire_le) return true;
  const fin = new Date(row.expire_le);
  return Number.isFinite(fin.getTime()) && fin > maintenant;
}

/** Forme minimale du client Supabase utilisée ici (client service role, qui ignore la RLS). */
export interface LecteurPremium {
  from(table: "premium_access"): {
    select(colonnes: string): {
      eq(colonne: "user_id", valeur: string): {
        maybeSingle(): PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
}

export type VerdictPremium =
  | { ok: true }
  // 403 : compte identifié, sans droit Premium actif.
  | { ok: false; statut: 403; raison: "non_premium" }
  // 503 : statut illisible — refus par prudence, l'appel peut être réessayé.
  | { ok: false; statut: 503; raison: "statut_illisible" };

/**
 * Le compte a-t-il un Premium actif ? À appeler après l'authentification
 * (l'identifiant vient du JWT validé, jamais du corps de la requête) et avant
 * tout appel au modèle. Ne lève jamais : rend un verdict que l'endpoint
 * traduit en réponse HTTP.
 */
export async function assertPremium(
  client: LecteurPremium,
  user: { id: string },
  maintenant = new Date()
): Promise<VerdictPremium> {
  try {
    const { data, error } = await client
      .from("premium_access")
      .select("actif, expire_le")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return { ok: false, statut: 503, raison: "statut_illisible" };
    return estActif(data as PremiumAccessRow | null, maintenant)
      ? { ok: true }
      : { ok: false, statut: 403, raison: "non_premium" };
  } catch {
    return { ok: false, statut: 503, raison: "statut_illisible" };
  }
}

/**
 * Règles d'accès côté serveur — COPIE de REGLES_ACCES (src/lib/autorisations.ts),
 * vérifiée par test miroir. Une fonctionnalité, une règle (arbitrage du
 * 25/09/2026, point 8).
 */
export const REGLES_ACCES = {
  AVIS_DE_STYLISTE: "PREMIUM_REQUIRED",
} as const;

/**
 * Autorisation d'utiliser une fonctionnalité — contrôle n° 3 de l'endpoint,
 * après l'authentification. PREMIUM_REQUIRED : `assertPremium`, donc refus si
 * le statut n'est pas CONFIRMÉ (pas de confirmation Premium = pas d'appel
 * OpenAI).
 *
 * À ARBITRER: quota d'analyses par utilisateur Premium (point 8) — aucun
 * quota appliqué tant qu'il n'est pas tranché ; il s'ajouterait ici.
 */
export async function autoriserFonctionnalite(
  client: LecteurPremium,
  user: { id: string },
  fonctionnalite: keyof typeof REGLES_ACCES,
  maintenant = new Date()
): Promise<VerdictPremium> {
  switch (REGLES_ACCES[fonctionnalite]) {
    case "PREMIUM_REQUIRED":
      return assertPremium(client, user, maintenant);
  }
}
