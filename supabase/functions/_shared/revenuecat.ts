// LES ÉVÉNEMENTS D'ABONNEMENT DE REVENUECAT (17/11/2026, achats intégrés : src/lib/achats.ts). Module PUR, sans Deno : testé depuis
// src/lib/__tests__/revenuecat.test.ts, importé par la fonction revenuecat-webhook.
//
// RevenueCat prévient à chaque événement d'un abonnement (achat, renouvellement, annulation, expiration…). L'identifiant de la personne
// (app_user_id) est son identifiant Supabase, posé par l'app à la configuration. Ce module dit ce que l'événement change dans
// premium_access : un droit actif jusqu'à une échéance, un droit retiré, ou rien.
//
// Règles :
//   · achat, renouvellement, reprise, changement de formule, achat non renouvelable : actif jusqu'à expiration_at_ms ;
//   · annulation (la personne arrête le renouvellement) et problème de paiement : RIEN ne change — le droit court jusqu'à son
//     échéance déjà écrite, ou jusqu'à l'expiration que RevenueCat enverra (période de grâce d'Apple comprise) ;
//   · expiration : retiré ;
//   · transfert (un même compte Apple passé d'un compte Capsela à un autre) : retiré à l'ancien, l'achat suivant crée le nouveau ;
//   · test, ou événement d'un autre droit que « premium » : rien.
// Un accès accordé À LA MAIN (source « manuel ») n'est jamais touché par un événement de store : seule la propriétaire le retire.

export const DROIT_PREMIUM = "premium";

export interface EvenementRevenueCat {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  expiration_at_ms?: number | null;
  store?: string;
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  transferred_from?: string[];
  environment?: string;
}

export type Decision =
  | { action: "activer"; userId: string; source: "app_store" | "play_store"; expireLe: string | null }
  | { action: "retirer"; userIds: string[] }
  | { action: "rien"; raison: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const estUuid = (s: unknown): s is string => typeof s === "string" && UUID.test(s);

const ACTIVENT = new Set(["INITIAL_PURCHASE", "RENEWAL", "UNCANCELLATION", "PRODUCT_CHANGE", "NON_RENEWING_PURCHASE", "SUBSCRIPTION_EXTENDED"]);

function concernePremium(e: EvenementRevenueCat): boolean {
  const ids = e.entitlement_ids ?? (e.entitlement_id ? [e.entitlement_id] : null);
  // Sans liste (événement ancien format), on suppose le seul droit de l'app.
  return !ids || ids.includes(DROIT_PREMIUM);
}

export function decisionEvenement(e: EvenementRevenueCat | null | undefined): Decision {
  if (!e || typeof e.type !== "string") return { action: "rien", raison: "événement illisible" };
  if (e.type === "TEST") return { action: "rien", raison: "test" };
  if (e.type === "TRANSFER") {
    const anciens = (e.transferred_from ?? []).filter(estUuid);
    return anciens.length ? { action: "retirer", userIds: anciens } : { action: "rien", raison: "transfert sans compte Capsela" };
  }
  if (!concernePremium(e)) return { action: "rien", raison: "autre droit" };
  const userId = estUuid(e.app_user_id) ? e.app_user_id : estUuid(e.original_app_user_id) ? e.original_app_user_id : null;
  if (!userId) return { action: "rien", raison: "identifiant anonyme" };
  if (e.type === "EXPIRATION") return { action: "retirer", userIds: [userId] };
  if (ACTIVENT.has(e.type)) {
    const ms = typeof e.expiration_at_ms === "number" && Number.isFinite(e.expiration_at_ms) ? e.expiration_at_ms : null;
    return { action: "activer", userId, source: e.store === "PLAY_STORE" ? "play_store" : "app_store", expireLe: ms ? new Date(ms).toISOString() : null };
  }
  return { action: "rien", raison: `sans effet (${e.type})` };
}

/** L'en-tête Authorization reçu est-il celui configuré dans RevenueCat ? Comparaison à temps constant. */
export function autorisationValide(recu: string | null, attendu: string | undefined): boolean {
  if (!recu || !attendu) return false;
  const a = recu.replace(/^Bearer\s+/i, "").trim();
  const b = attendu.replace(/^Bearer\s+/i, "").trim();
  if (!b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
