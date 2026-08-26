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

const listeners = new Set<(state: ConsentState) => void>();

/** Lecture défensive : localStorage jette en navigation privée sur certains navigateurs, et n'existe pas au rendu serveur. */
export function readConsent(): ConsentState {
  if (typeof window === "undefined") return "unknown";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "granted" || raw === "denied" ? raw : "unknown";
  } catch {
    return "unknown";
  }
}

/** Enregistre le choix et prévient les abonnés (bandeau, réglages) dans le même tour. */
export function setConsent(state: Exclude<ConsentState, "unknown">): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, state);
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
