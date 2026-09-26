import type { EtatPremium } from "./premium";

/*
 * RÈGLES D'ACCÈS AUX FONCTIONNALITÉS (arbitrage du 25/09/2026, point 8).
 *
 * Une seule règle par fonctionnalité, lue partout — l'accueil aujourd'hui,
 * tout autre point d'entrée demain — plutôt qu'une condition réécrite à
 * chaque écran. Côté serveur, la même règle est appliquée par
 * `autoriserFonctionnalite` (supabase/functions/_shared/premium.ts).
 */

/**
 * PHASE DE TEST (26/09/2026) : l'Avis de styliste est en ACCES_LIBRE tant que
 * Capsela n'est pas lancée publiquement — la propriétaire doit pouvoir le
 * tester en production sans abonnement. La logique Premium reste entière
 * (PREMIUM_REQUIRED ci-dessous, Gate, contrôle serveur) : pour remettre le
 * paywall au lancement, repasser la valeur à "PREMIUM_REQUIRED" ICI ET dans
 * supabase/functions/_shared/premium.ts (le test miroir exige les deux), puis
 * redéployer la fonction `stylist-advice`.
 */
export const REGLES_ACCES: Record<"AVIS_DE_STYLISTE", RegleAcces> = {
  AVIS_DE_STYLISTE: "ACCES_LIBRE",
};

/**
 * - PREMIUM_REQUIRED : réservé à un Premium confirmé ;
 * - ACCES_LIBRE : ouvert à tout compte, sans lire le statut Premium.
 */
export type RegleAcces = "PREMIUM_REQUIRED" | "ACCES_LIBRE";

export type Fonctionnalite = keyof typeof REGLES_ACCES;

/** La fonctionnalité est-elle réservée au Premium ? Pilote aussi le badge Premium affiché à côté d'elle. */
export function premiumRequis(fonctionnalite: Fonctionnalite): boolean {
  return REGLES_ACCES[fonctionnalite] === "PREMIUM_REQUIRED";
}

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
  return decisionSelonRegle(REGLES_ACCES[fonctionnalite], etat, verificationFaite);
}

/** La décision pour une règle donnée — séparée pour que PREMIUM_REQUIRED reste testée pendant la phase d'accès libre. */
export function decisionSelonRegle(regle: RegleAcces, etat: EtatPremium, verificationFaite: boolean): DecisionAcces {
  switch (regle) {
    case "ACCES_LIBRE":
      return "acces";
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
