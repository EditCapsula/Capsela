"use client";

/**
 * Consentement aux mesures d'audience (Google Analytics) — recette
 * 26/08/2026.
 *
 * La doctrine de la CNIL ne range pas Google Analytics parmi les traceurs
 * exemptés de consentement : aucun script de mesure ne doit être chargé
 * avant un choix explicite. D'où un état à trois valeurs — pas encore
 * demandé, accordé, refusé — et non un simple booléen : tant que la
 * personne n'a pas répondu, on ne charge rien ET on continue de lui poser
 * la question.
 *
 * Stocké en localStorage et non dans le profil serveur : le bandeau
 * s'affiche dès l'écran d'accueil, avant toute connexion, et le
 * consentement aux cookies s'attache à l'appareil, pas au compte. Une même
 * personne sur deux téléphones répond deux fois, ce qui est le
 * comportement attendu.
 *
 * Le refus est stocké au même titre que l'accord : sans ça, le bandeau
 * reviendrait à chaque lancement, ce qui revient à harceler jusqu'au oui.
 */

export type ConsentState = "unknown" | "granted" | "denied";

const STORAGE_KEY = "capsela.analyticsConsent";

/**
 * Le choix a une échéance de six mois (01/10/2026, docs/legal/README.md,
 * écart 7) : la CNIL recommande de redemander passé ce délai, et un accord
 * donné sans limite ne se renouvelle jamais. Passé l'échéance, l'état redevient
 * « pas encore demandé » : le bandeau revient et aucun script de mesure ne
 * charge. Le choix s'enregistre donc avec sa date.
 *
 * Un choix enregistré avant cette règle n'a pas de date : il est redemandé une
 * fois, plutôt que de se voir prêter une date qu'on ne connaît pas.
 */
export const VALIDITE_CHOIX_MS = 183 * 24 * 3600 * 1000;

/** Lit une valeur stockée : le choix s'il est daté et encore valide, sinon « unknown ». Pure, pour être testée. */
export function etatDepuisStockage(brut: string | null, maintenant: number): ConsentState {
  if (!brut) return "unknown";
  try {
    const { etat, le } = JSON.parse(brut) as { etat?: unknown; le?: unknown };
    if ((etat !== "granted" && etat !== "denied") || typeof le !== "number") return "unknown";
    return maintenant - le < VALIDITE_CHOIX_MS ? etat : "unknown";
  } catch {
    return "unknown";
  }
}

const listeners = new Set<(state: ConsentState) => void>();

/** Lecture défensive : localStorage jette en navigation privée sur certains navigateurs, et n'existe pas au rendu serveur. */
export function readConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    return etatDepuisStockage(window.localStorage.getItem(STORAGE_KEY), Date.now());
  } catch {
    return "unknown";
  }
}

/** Enregistre le choix et prévient les abonnés (bandeau, réglages) dans le même tour. */
export function setConsent(state: Exclude<ConsentState, "unknown">): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ etat: state, le: Date.now() }));
  } catch {
    // Stockage indisponible : le choix vaut pour la session en cours, le
    // bandeau réapparaîtra au prochain lancement. Jamais une erreur visible.
  }
  listeners.forEach((fn) => fn(state));
}

export function subscribeConsent(fn: (state: ConsentState) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
