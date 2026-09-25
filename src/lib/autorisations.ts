import type { EtatPremium } from "./premium";

/*
 * RÈGLES D'ACCÈS AUX FONCTIONNALITÉS (arbitrage du 25/09/2026, point 8).
 *
 * Une seule règle par fonctionnalité, lue partout — l'accueil aujourd'hui,
 * tout autre point d'entrée demain — plutôt qu'une condition réécrite à
 * chaque écran. Côté serveur, la même règle est appliquée par
 * `autoriserFonctionnalite` (supabase/functions/_shared/premium.ts).
 */

export const REGLES_ACCES = {
  AVIS_DE_STYLISTE: "PREMIUM_REQUIRED",
} as const;

export type Fonctionnalite = keyof typeof REGLES_ACCES;

/**
 * - "acces" : ouvrir la fonctionnalité ;
 * - "verification" : statut encore inconnu, le relire avant de trancher ;
 * - "gate" : Premium Gate.
 */
export type DecisionAcces = "acces" | "verification" | "gate";

/**
 * PREMIUM_REQUIRED : un Premium CONFIRMÉ passe, tout le reste voit le Gate —
 * gratuit, abonnement expiré (déjà "gratuit" via estActif), mode démo et
 * statut inconnu, sans logique propre à chacun.
 *
 * Un statut inconnu n'est jamais pris pour du Premium : il déclenche d'abord
 * une vérification ; s'il reste inconnu une fois celle-ci faite, c'est le
 * comportement sûr — le Gate.
 */
export function decisionAcces(fonctionnalite: Fonctionnalite, etat: EtatPremium, verificationFaite: boolean): DecisionAcces {
  switch (REGLES_ACCES[fonctionnalite]) {
    case "PREMIUM_REQUIRED":
      if (etat === "premium") return "acces";
      if (etat === "inconnu" && !verificationFaite) return "verification";
      return "gate";
  }
}

/**
 * Traduction d'un refus de l'endpoint serveur (lot 3), pour que l'écran ne
 * confonde pas les deux cas (arbitrage du 25/09/2026) :
 * - 403 (compte identifié sans Premium actif) → Premium Gate ;
 * - toute autre erreur, dont 503 (statut Premium impossible à vérifier) →
 *   « Impossible d'analyser ta tenue pour le moment. » + Réessayer : ce n'est
 *   pas forcément un problème d'abonnement, le Gate serait faux.
 */
export function reactionRefusServeur(statut: number): "gate" | "erreur_reessayer" {
  return statut === 403 ? "gate" : "erreur_reessayer";
}
